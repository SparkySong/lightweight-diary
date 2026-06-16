// cloudfunctions/aiChat/index.js —— 混合模式：知识库优先 + AI 处理开放性问题
const https = require('https');
const { matchKnowledge } = require('./knowledge-base');

const API_KEY = '9dd5302e8467401ea52c91d3cedb8b2c.6hoEdWuhxR2aXIEl';
const API_KEY_BACKUP = 'sk-43f98e89b7017525e80286fe7959b857690a6a7f99466f1ff37fc8161fc44bc3';

// ====== System Prompt（强制结构化输出）======
const SYSTEM_PROMPT = `你是轻体营养师。全程中文。

【规则】数值必须来自用户数据，无数据则说"暂无"。自然亲切像朋友聊天。
【必须遵守的排版格式】每次回复都必须用以下 Markdown 结构，禁止输出纯段落：
- 用 *小标题* 作为每个部分的标题（单星号独占一行）
- 要点用 - 开头的列表项（每条一项）
- 重点词用 **加粗**
- emoji 每段最多1个，放在句尾
- 每次回复结尾必须附带3-4个推荐的追问问题，用特殊标记：

【推荐追问】
- 问题1
- 问题2
- 问题3

这些追问要基于本次回复内容和用户数据，引导用户深入探索（如具体建议、下一步行动、相关话题）。

示例输出格式：
*分析结果*
- 今天摄入 **1180kcal**
- 距目标还剩 620kcal

*建议*
- 晚上可以吃蔬菜和瘦肉
- 少油少盐更健康 😊

【推荐追问】
- 帮我制定饮食计划
- 适合我的运动建议
- 我多久能达到目标体重

禁止JSON、代码块、英文`;

exports.main = async (event) => {
  console.log('[AI] === 收到请求 ===');
  
  const { messages, knowledgeBase } = event;
  console.log('[AI] messages 数量:', Array.isArray(messages) ? messages.length : '非数组');
  console.log('[AI] knowledgeBase 长度:', (knowledgeBase || '').length);
  console.log('[AI] knowledgeBase 内容预览:', (knowledgeBase || '').substring(0, 500));

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '请输入消息内容' };
  }

  // ====== 知识库优先匹配 ======
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && lastUserMsg.content) {
    const kbAnswer = matchKnowledge(lastUserMsg.content);
    if (kbAnswer) {
      console.log('[AI] ✅ 命中知识库，直接返回');
      return { success: true, reply: kbAnswer, fromKB: true };
    }
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let systemContent = SYSTEM_PROMPT + `\n\n当前日期：${todayStr}。`;
  let maxTokens = 300;

  // 检测特殊意图：周报分析 / 饮食计划
  const lastMsg = lastUserMsg ? lastUserMsg.content : '';
  const isWeeklyReport = /生成周报|本周分析|周报告|这周总结|上周分析|周报/.test(lastMsg);
  const isDietPlan = /饮食计划|下周吃|这周吃|推荐.*吃|制定.*饮食|饮食安排|食谱推荐|meal\s*plan/.test(lastMsg);

  if (isWeeklyReport) {
    systemContent += `\n\n【周报分析模式】用户请求生成本周健康周报。请根据用户数据，生成结构化的周报分析：\n1. 体重趋势总结（变化值、趋势方向）\n2. 饮食热量分析（日均摄入、超标天数）\n3. 运动情况回顾（运动天数、总消耗）\n4. 热量收支对比\n5. 给出3条具体个性化建议\n用 *标题* 作为每部分标题，- 列表展示要点。`;
    maxTokens = 1000;
  }

  if (isDietPlan) {
    systemContent += `\n\n【饮食计划模式】用户请求制定饮食计划。请根据用户的体重目标、热量目标和饮食偏好，生成7天的饮食建议。每天包含三餐推荐和预估热量。用 *标题* 作为每天标题，- 列表展示每餐内容。`;
    maxTokens = 2500;
  }

  if (knowledgeBase) {
    systemContent += `\n\n【用户数据】${knowledgeBase}\n数值必须来自以上数据`;
  }

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  // 主模型 + 备用模型降级策略
  const models = [
    { name: 'glm-4-flash', label: '主模型', host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', key: API_KEY },
    { name: 'claude-opus-4-8', label: '备用模型', host: 'ai.loserbai.cn', path: '/v1/chat/completions', key: API_KEY_BACKUP }
  ];

  for (const model of models) {
    const requestBody = JSON.stringify({
      model: model.name,
      messages: fullMessages,
      temperature: 0.3,
      max_tokens: maxTokens,
      stream: true
    });

    console.log(`[AI] 尝试${model.label}: ${model.name}`);
    console.log('[AI] 请求体大小:', requestBody.length, 'bytes');

    try {
      const reply = await callAPIStream(requestBody, model);
      console.log(`[AI] ${model.label}成功，长度:`, reply.length);
      const cleanReply = stripMarkdown(reply);
      return { success: true, reply: cleanReply, model: model.name };
    } catch (err) {
      console.error(`[AI] ${model.label}失败:`, err.message);
      // 主模型失败才尝试备用，备用模型失败直接返回
      if (model === models[models.length - 1]) {
        return { success: false, error: err.message };
      }
      // 短暂等待再切备用
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return { success: false, error: 'AI 服务暂时不可用，请稍后重试' };
};

// 清理 AI 回复（保留前端渲染需要的格式标记：*标题*、**加粗**、-列表）
function stripMarkdown(text) {
  let clean = text
    .replace(/^#{1,6}\s*/gm, '')           // 去掉 # 标题标记（用 * 替代）
    .replace(/`(.+?)`/g, '$1')              // 去掉行内代码
    .replace(/```[\s\S]*?```/g, '')          // 去掉代码块
    .replace(/^[-*_]{3,}\s*$/gm, '')        // 去掉分割线
    .replace(/\uFFFD/g, '');                 // 去掉乱码

  // 保留：*标题*、**加粗**、- 列表（这些给前端渲染器用）
  clean = clean.replace(/^\s*(assistant|system|user|function|tool)\s*$/gim, '');
  clean = clean.replace(/^\s*(assistant|system|user|function|tool)\s*\n/gim, '');
  // 去掉连续多余空行（最多保留1个空行用于分段）
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

// ====== SSE 流式调用 API（支持多模型不同地址）======
function callAPIStream(body, modelConfig) {
  return new Promise((resolve, reject) => {
    // 绝对超时：不管有没有数据都在指定时间后强制终止（避免流式数据持续到达导致无限等待）
    const ABSOLUTE_TIMEOUT = 20000; // 20秒绝对超时
    const options = {
      hostname: modelConfig.host,
      path: modelConfig.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.key}`,
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'text/event-stream'
      }
    };

    let fullText = '';
    let resolved = false;
    let destroyed = false;

    // 绝对超时定时器
    const absoluteTimer = setTimeout(() => {
      if (!resolved && !destroyed) {
        destroyed = true;
        reject(new Error(`请求超时(${ABSOLUTE_TIMEOUT / 1000}s)，模型 ${modelConfig.name} 无响应`));
      }
    }, ABSOLUTE_TIMEOUT);

    const cleanup = () => {
      clearTimeout(absoluteTimer);
      resolved = true;
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => { if (!resolved) { cleanup(); reject(new Error(`HTTP ${res.statusCode}: ${errData.substring(0, 200)}`)); } });
        return;
      }

      res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch (e) { /* 忽略解析错误 */ }
        }
      });

      res.on('end', () => {
        if (!resolved) {
          cleanup();
          if (fullText.trim()) resolve(fullText);
          else reject(new Error('AI 未返回有效回复'));
        }
      });
    });

    req.on('error', (err) => { if (!resolved) { cleanup(); reject(new Error(`网络错误: ${err.message}`)); } });
    
    // 空闲超时作为额外保障
    req.setTimeout(15000, () => { 
      if (!destroyed) {
        destroyed = true; 
        req.destroy(); 
      }
    });
    
    req.write(body);
    req.end();
  });
}

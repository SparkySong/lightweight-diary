// cloudfunctions/aiChat/index.js —— 混合模式：知识库优先 + AI 处理开放性问题
const https = require('https');
const { matchKnowledge } = require('./knowledge-base');

const API_KEY = '9dd5302e8467401ea52c91d3cedb8b2c.6hoEdWuhxR2aXIEl';
const API_KEY_BACKUP = 'sk-43f98e89b7017525e80286fe7959b857690a6a7f99466f1ff37fc8161fc44bc3';

// ====== System Prompt（强制结构化输出）======
const SYSTEM_PROMPT = `你是轻体营养师。全程中文。回复简洁清晰，重点突出。

【规则】数值必须来自用户数据，无数据则说"暂无"。自然亲切像朋友聊天。

【格式】用 - 列表展示要点，重点词加粗。每段最多1个emoji。

【推荐追问】结尾附2-3个相关追问。`;

exports.main = async (event) => {
  const { messages, knowledgeBase } = event;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '请输入消息内容' };
  }

  // ====== 知识库优先匹配 ======
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (lastUserMsg && lastUserMsg.content) {
    const kbAnswer = matchKnowledge(lastUserMsg.content);
    if (kbAnswer) {
      return { success: true, reply: kbAnswer, fromKB: true };
    }
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let systemContent = SYSTEM_PROMPT + `\n\n当前日期：${todayStr}。`;
  let maxTokens = 600;

  // 检测特殊意图：周报分析 / 饮食计划
  const lastMsg = lastUserMsg ? lastUserMsg.content : '';
  const isWeeklyReport = /生成周报|本周分析|周报告|这周总结|上周分析|周报/.test(lastMsg);
  const isDietPlan = /饮食计划|下周吃|这周吃|推荐.*吃|制定.*饮食|饮食安排|食谱推荐|meal\s*plan/.test(lastMsg);

  if (isWeeklyReport) {
    systemContent += `\n\n【周报模式】生成本周健康周报：体重趋势、饮食分析、运动回顾、建议。用列表展示。`;
    maxTokens = 800;
  }

  if (isDietPlan) {
    systemContent += `\n\n【饮食计划模式】生成3天饮食建议，每天三餐，简明扼要。`;
    maxTokens = 900;
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
    { name: 'glm-4-flash', label: '主模型', host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', key: API_KEY, timeout: 25000, idleTimeout: 10000 },
    { name: 'claude-opus-4-8', label: '备用模型', host: 'ai.loserbai.cn', path: '/v1/chat/completions', key: API_KEY_BACKUP, timeout: 20000, idleTimeout: 8000 }
  ];

  for (const model of models) {
    const requestBody = JSON.stringify({
      model: model.name,
      messages: fullMessages,
      temperature: 0.1,
      max_tokens: maxTokens,
      stream: true  // 流式模式：空闲超时可提前返回已有内容
    });

    try {
      // 流式调用：有空闲超时降级，不会一直等
      const reply = await callAPIStream(requestBody, model);
      const cleanReply = stripMarkdown(reply);
      return { success: true, reply: cleanReply, model: model.name };
    } catch (err) {
      console.error(`[AI] ${model.label}失败:`, err.message);
      if (model === models[models.length - 1]) {
        return { success: false, error: err.message };
      }
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

// ====== 非流式 API 调用（云函数环境更高效）======
function callAPINormal(body, modelConfig) {
  const TIMEOUT = modelConfig.timeout || 12000;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: modelConfig.host,
      path: modelConfig.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.key}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    let resolved = false;

    const cleanup = () => {
      clearTimeout(timer);
      resolved = true;
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error(`请求超时(${TIMEOUT / 1000}s)，模型 ${modelConfig.name}`));
      }
    }, TIMEOUT);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (resolved) return;
        cleanup();
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content;
          if (content) {
            resolve(content);
          } else {
            reject(new Error('AI 未返回有效回复'));
          }
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });

    req.on('error', (err) => {
      if (!resolved) {
        cleanup();
        reject(new Error(`网络错误: ${err.message}`));
      }
    });

    req.setTimeout(TIMEOUT, () => {
      if (!resolved) {
        req.destroy();
      }
    });

    req.write(body);
    req.end();
  });
}

// ====== SSE 流式调用 API（备用，保留兼容）======
function callAPIStream(body, modelConfig) {
  const ABSOLUTE_TIMEOUT = modelConfig.timeout || 15000;
  const IDLE_TIMEOUT = modelConfig.idleTimeout || 10000;

  return new Promise((resolve, reject) => {
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

    // 空闲超时：若持续无数据则提前返回已有内容
    let idleTimer = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (resolved || destroyed) return;
      idleTimer = setTimeout(() => {
        if (!resolved && !destroyed) {
          destroyed = true;
          // 如果已经收到了一些数据，返回部分结果而不报错
          if (fullText.trim()) {
            resolve(fullText);
          } else {
            reject(new Error(`AI 响应超时，模型 ${modelConfig.name} 无数据返回`));
          }
        }
      }, IDLE_TIMEOUT);
    };

    // 绝对超时定时器
    const absoluteTimer = setTimeout(() => {
      if (!resolved && !destroyed) {
        destroyed = true;
        if (fullText.trim()) {
          resolve(fullText); // 超时但有部分数据，也返回
        } else {
          reject(new Error(`请求超时(${ABSOLUTE_TIMEOUT / 1000}s)，模型 ${modelConfig.name} 无响应`));
        }
      }
    }, ABSOLUTE_TIMEOUT);

    const cleanup = () => {
      clearTimeout(absoluteTimer);
      clearTimeout(idleTimer);
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
        if (destroyed) return;
        resetIdleTimer();
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            // 收到结束信号，立即返回
            if (!resolved) {
              cleanup();
              destroyed = true;
              resolve(fullText);
            }
            return;
          }
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

    req.on('error', (err) => {
      if (!resolved) {
        cleanup();
        // 如果有部分数据，不报错直接返回
        if (fullText.trim()) { resolve(fullText); }
        else { reject(new Error(`网络错误: ${err.message}`)); }
      }
    });

    // 底层 socket 空闲超时
    req.setTimeout(ABSOLUTE_TIMEOUT, () => {
      if (!destroyed) {
        destroyed = true;
        req.destroy();
      }
    });

    req.write(body);
    req.end();

    // 启动第一个空闲定时器
    resetIdleTimer();
  });
}

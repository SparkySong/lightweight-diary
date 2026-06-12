// cloudfunctions/aiChat/index.js —— 混合模式：AI 只处理开放性问题
const https = require('https');

const API_KEY = 'sk-43f98e89b7017525e80286fe7959b857690a6a7f99466f1ff37fc8161fc44bc3';

// ====== 核心原则：数据保真第一 ======
const SYSTEM_PROMPT = `你是"轻体营养师"，一位专业的饮食与体重管理 AI 助手。

【最高优先级 — 数据保真】⚠️ 以下规则违反任何一条都属于严重错误：

1. 用户数据区域中的所有数值（热量、重量、身高、日期）是唯一事实来源。
   你回答中提到的任何数字，必须与【用户数据】中的数值一致或基于其计算得出。
   绝对禁止编造、猜测、近似任何不在数据中的数值！

2. 如果用户问的是"今天吃了什么""午餐多少热量"等涉及具体数据的，
   你必须直接引用【用户数据】中的原始记录来回答。
   例如：数据写"早餐：鸡蛋、牛奶（346kcal）"，你就说早餐是这些食物共346kcal。
   不可以说"早餐大概300kcal左右"或编造不存在的食物。

3. 如果数据中没有某项信息（如某餐没有记录），明确说"暂无记录"，不要编造。

4. 【今天】和【昨天】的记录严格区分。不要把昨天的数据当成今天的说。

【回答风格】
- 像朋友聊天一样自然、亲切、有温度
- 如果用户在调侃/开玩笑，可以幽默回应

【排版格式】
- 多个要点用编号：**1. 标题**：内容
- 小要点用 - 开头：- 要点内容  
- 关键信息用 **加粗**
- 每条建议单独一行
- 控制在 250 字以内
- 用 emoji 适当点缀（🥗💪🍎 等）

【禁止事项】
❌ 不要输出 JSON / 代码块 / 系统标记
❌ 不要编造数据中没有的数值
❌ 不要用模糊词汇（大概、大约、可能）替代精确数据`;

exports.main = async (event) => {
  console.log('[AI] === 收到请求 ===');
  
  const { messages, knowledgeBase } = event;
  console.log('[AI] messages 数量:', Array.isArray(messages) ? messages.length : '非数组');
  console.log('[AI] knowledgeBase 长度:', (knowledgeBase || '').length);
  console.log('[AI] knowledgeBase 内容预览:', (knowledgeBase || '').substring(0, 500));

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '请输入消息内容' };
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let systemContent = SYSTEM_PROMPT + `\n\n当前日期：${todayStr}。`;

  if (knowledgeBase) {
    systemContent += `\n\n===== 【用户数据 — 回答时必须以此为准】=====\n${knowledgeBase}\n===== 【用户数据结束】=====\n\n再次提醒：你回答中的所有数值必须来自以上数据！`;
  }

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  // 使用 Claude Opus 4.8：顶级智能模型
  const requestBody = JSON.stringify({
    model: 'claude-opus-4-8',
    messages: fullMessages,
    temperature: 0.5,
    max_tokens: 2048
  });

  console.log('[AI] 模型: Claude Opus 4.8, temperature: 0.5');
  console.log('[AI] 请求体大小:', requestBody.length, 'bytes');
  console.log('[AI] 开始调用 API...');

  try {
    const reply = await callAPI(requestBody);
    console.log('[AI] API 返回成功，长度:', reply.length);
    console.log('[AI] 回复内容:', reply.substring(0, 300));
    const cleanReply = stripMarkdown(reply);
    return { success: true, reply: cleanReply };
  } catch (err) {
    console.error('[AI] 调用 AI API 失败:', err.message);
    return {
      success: false,
      error: err.message || 'AI 服务暂时不可用，请稍后重试'
    };
  }
};

// 清理 AI 回复（保留加粗和编号格式用于前端渲染）
function stripMarkdown(text) {
  let clean = text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\uFFFD/g, '');

  clean = clean.replace(/^\s*(assistant|system|user|function|tool)\s*$/gim, '');
  clean = clean.replace(/^\s*(assistant|system|user|function|tool)\s*\n/gim, '');
  clean = clean.trim();

  const lines = clean.split('\n');
  const seen = new Set();
  const deduped = [];
  for (const line of lines) {
    const key = line.trim();
    if (key === '' || !seen.has(key)) {
      deduped.push(line);
      if (key) seen.add(key);
    }
  }
  return deduped.join('\n').trim();
}

// 调用 API 中转站
function callAPI(body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ai.loserbai.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error.message || result.error.code || JSON.stringify(result.error)));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            return;
          }
          const reply = result.choices?.[0]?.message?.content;
          if (!reply) reject(new Error('AI 未返回有效回复'));
          else resolve(reply);
        } catch (e) {
          reject(new Error(`解析失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`网络错误: ${err.message}`)));
    req.setTimeout(55000, () => { req.destroy(); reject(new Error('请求超时，请稍后重试')); });
    req.write(body);
    req.end();
  });
}

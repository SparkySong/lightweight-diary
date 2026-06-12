// cloudfunctions/aiChat/index.js —— 混合模式：AI 只处理开放性问题
const https = require('https');

const API_KEY = 'sk-43f98e89b7017525e80286fe7959b857690a6a7f99466f1ff37fc8161fc44bc3';

// ====== 精简 System Prompt（缩短 ~40%，减少 token 处理时间）======
const SYSTEM_PROMPT = `你是"轻体营养师"，专业的饮食与体重管理助手。

【数据保真规则】
- 回答中所有数值必须来自【用户数据】，禁止编造或近似
- 涉及具体饮食记录时直接引用原始数据
- 数据中没有的信息说"暂无记录"

【回答风格】自然亲切、像朋友聊天

【排版】编号列表用 **加粗标题**，关键信息加粗，控制在200字内，适当用emoji（🥗💪🍎）

【禁止】不要输出JSON、代码块、模糊词汇`;

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

  // 使用 Claude Opus 4.8（保留原模型 + 流式 + 精简 prompt 优化）
  const requestBody = JSON.stringify({
    model: 'claude-opus-4-8',
    messages: fullMessages,
    temperature: 0.5,
    max_tokens: 1024,
    stream: true   // 开启 SSE 流式输出
  });

  console.log('[AI] 模型: Claude Opus 4.8 (streaming), temperature: 0.5');
  console.log('[AI] 请求体大小:', requestBody.length, 'bytes');
  console.log('[AI] 开始调用 API...');

  try {
    // 流式调用：边生成边返回，用户无需干等
    const reply = await callAPIStream(requestBody);
    console.log('[AI] API 流式返回成功，长度:', reply.length);
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

// ====== SSE 流式调用 API（核心优化：边生成边返回）======
function callAPIStream(body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'ai.loserbai.cn',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'text/event-stream'
      }
    };

    let fullText = '';
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', chunk => { errData += chunk; });
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${errData.substring(0, 200)}`)));
        return;
      }

      // 解析 SSE 流：每个 data 行是一个 JSON 片段
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
        if (fullText.trim()) resolve(fullText);
        else reject(new Error('AI 未返回有效回复'));
      });
    });

    req.on('error', (err) => reject(new Error(`网络错误: ${err.message}`)));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('请求超时，请稍后重试')); });
    req.write(body);
    req.end();
  });
}

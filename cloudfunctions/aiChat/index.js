// cloudfunctions/aiChat/index.js —— 混合模式：知识库优先 + AI 处理开放性问题
const https = require('https');
const { matchKnowledge } = require('./knowledge-base');

const API_KEY = '9dd5302e8467401ea52c91d3cedb8b2c.6hoEdWuhxR2aXIEl';
const API_KEY_BACKUP = 'sk-43f98e89b7017525e80286fe7959b857690a6a7f99466f1ff37fc8161fc44bc3';

// ====== System Prompt（强制结构化输出）======
const SYSTEM_PROMPT = `你是轻体营养师。全程中文。回复简洁清晰，重点突出。

【规则】数值必须来自用户数据，无数据则说"暂无"。自然亲切像朋友聊天。

【安全边界】涉及疾病诊断、用药、孕产、哺乳、未成年人减重、进食障碍等问题时，只做一般性说明并明确建议咨询医生，不给出诊断、用药剂量或极端节食方案。

【格式】用 - 列表展示要点，重点词加粗。每段最多1个emoji。

【推荐追问】回复结尾另起一行，以【推荐追问】四个字开头（不加emoji、不加粗），之后每行一个问题，共2-3个。`;

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
  let temperature = 0.6; // 普通问答：语气自然

  // 检测特殊意图：周报分析 / 饮食计划
  const lastMsg = lastUserMsg ? lastUserMsg.content : '';
  const isWeeklyReport = /生成周报|本周分析|周报告|这周总结|上周分析|周报/.test(lastMsg);
  const isDietPlan = /饮食计划|下周吃|这周吃|推荐.*吃|制定.*饮食|饮食安排|食谱推荐|meal\s*plan/.test(lastMsg);

  if (isWeeklyReport) {
    systemContent += `\n\n【周报模式】生成本周健康周报：体重趋势、饮食分析、运动回顾、建议。用列表展示。`;
    maxTokens = 1200;
    temperature = 0.1; // 结构化输出求稳
  }

  if (isDietPlan) {
    systemContent += `\n\n【饮食计划模式】生成3天饮食建议，每天三餐，简明扼要。`;
    maxTokens = 1200;
    temperature = 0.1;
  }

  if (knowledgeBase) {
    systemContent += `\n\n【用户数据】${knowledgeBase}\n数值必须来自以上数据`;
  }

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  // 模型降级策略（带限流冷却）：
  // glm-4.7-flash 能力最强（免费，200K），优先使用；但免费档仅 1 并发，
  // 高峰期返回 429。命中 429 后该模型冷却 60 秒（容器内全局记忆），
  // 冷却期内直接走 glm-4-flash（免费、并发额度充足、稳定），不重复撞限流；
  // 冷却结束自动重试强模型。claude 代理作为最后备用。
  const models = [
    { name: 'glm-4.7-flash', label: '增强模型', host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', key: API_KEY, timeout: 25000, idleTimeout: 10000 },
    { name: 'glm-4-flash', label: '主模型', host: 'open.bigmodel.cn', path: '/api/paas/v4/chat/completions', key: API_KEY, timeout: 25000, idleTimeout: 10000 },
    { name: 'claude-opus-4-8', label: '备用模型', host: 'ai.loserbai.cn', path: '/v1/chat/completions', key: API_KEY_BACKUP, timeout: 20000, idleTimeout: 8000 }
  ];

  for (const model of models) {
    // 限流冷却期内跳过该模型（429 冷却表见模块级 rateLimitCooldown）
    const cooldownTable = global.rateLimitCooldown || {};
    if (Date.now() < (cooldownTable[model.name] || 0)) continue;

    const requestBody = JSON.stringify({
      model: model.name,
      messages: fullMessages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: true  // 流式模式：空闲超时可提前返回已有内容
    });

    try {
      // 流式调用：有空闲超时降级，不会一直等
      const reply = await callAPIStream(requestBody, model);
      // 返回前剥离推荐追问（不信任模型格式），追问以结构化字段返回给快捷栏
      const { clean, followUps } = splitFollowUps(reply);
      return { success: true, reply: stripMarkdown(clean), followUps, model: model.name };
    } catch (err) {
      // 429 限流：记录冷却时间，降级到下一模型（不当作错误刷屏）
      if (/HTTP 429|1305|访问量过大|rate.?limit/i.test(err.message || '')) {
        if (!global.rateLimitCooldown) global.rateLimitCooldown = {};
        global.rateLimitCooldown[model.name] = Date.now() + 60 * 1000;
        console.warn(`[AI] ${model.label}限流，60秒内自动降级，稍后重试更强模型`);
      } else {
        console.error(`[AI] ${model.label}失败:`, err.message);
      }
      if (model === models[models.length - 1]) {
        return { success: false, error: err.message };
      }
    }
  }
  return { success: false, error: 'AI 服务暂时不可用，请稍后重试' };
};

// ====== 推荐追问处理：定位关键词，剥离正文 + 结构化返回 =====
// 模型输出的头部格式高度不稳定（emoji/加粗/列表符/括号/冒号任意组合，
// 甚至会把"推荐追问】"接在正文句末同一行）。因此不猜整行格式，
// 而是逐行找关键词：关键词之后只允许装饰字符，关键词之前为空或正文以句末标点结束。
const FU_KEYS = ['你还可以问我', '推荐追问', '相关追问', '继续追问', '相关问题', '推荐问题', '延伸问题', '你可能想问', '继续问我', '还想问我', '追问'];

// 关键词之后允许出现的"装饰"（所有标点、符号emoji、空白；\p写法对代理对安全）
const DECOR_U = /[\s\p{P}\p{S}]/gu;
// 句末标点（正文在此结束后才接关键词，说明关键词是头部而非正文一部分）
const SENTENCE_END = /[。！？!?；;…]$/;

function splitFollowUps(text) {
  if (!text || typeof text !== 'string') return { clean: text || '', followUps: [] };
  const lines = text.split('\n');

  let headerIdx = -1, headerPrefix = '';
  outer:
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const key of FU_KEYS) {
      const idx = line.indexOf(key);
      if (idx === -1) continue;
      const after = line.slice(idx + key.length);
      // 关键词后还有文字/数字（如"推荐追问：1.如何吃"）→ 不是纯头部，交给行内兜底
      if (after.replace(DECOR_U, '') !== '') continue;
      const before = line.slice(0, idx);
      const beforeRtrim = before.replace(/\s+$/u, '');
      const beforeCore = before.replace(/[\s\p{P}\p{S}\d]/gu, '');
      if (beforeCore === '') {
        // 关键词前只有装饰/序号 → 整行就是头部
        headerIdx = i; headerPrefix = '';
        break outer;
      }
      if (SENTENCE_END.test(beforeRtrim)) {
        // 关键词前是完整句子（正文句末直接接头部，如"超过这个数值。推荐追问】"）
        headerIdx = i; headerPrefix = beforeRtrim;
        break outer;
      }
    }
  }

  if (headerIdx === -1) {
    // 兜底：行内格式 "推荐追问：1.xxx 2.yyy"（头部和问题同一行）
    const m = text.match(/(?:推荐追问|相关追问|继续追问)[ \t]*[：:]/);
    if (m) {
      const after = text.substring(text.indexOf(m[0]) + m[0].length);
      const qs = after.split(/\n+|\s*\d+[.、)]\s*/)
        .map(x => x.trim()).filter(x => x.length > 1 && x.length <= 30);
      return { clean: text.substring(0, text.indexOf(m[0])).trim(), followUps: qs.slice(0, 4) };
    }
    return { clean: text, followUps: [] };
  }

  const questions = lines.slice(headerIdx + 1)
    .map(l => l.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d+[.、)）]\s*/, '').trim())
    .filter(q => q.length > 1 && q.length <= 30);

  const cleanLines = lines.slice(0, headerIdx);
  if (headerPrefix) cleanLines.push(headerPrefix);
  return { clean: cleanLines.join('\n').trim(), followUps: questions.slice(0, 4) };
}

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

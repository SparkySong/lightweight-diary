// cloudfunctions/aiChat/index.js
const https = require('https');

// ===== 请在此处填入你的 SiliconFlow API Key =====
// 注册地址：https://cloud.siliconflow.cn  （注册即送免费额度，多种模型免费使用）
const API_KEY = 'sk-phzwenfpehlvrlmcquwpefqmcwepcnyqqwvbqfoqtgtqjncn';

const SYSTEM_PROMPT = `你是"轻体营养师"，一位专业的营养师助手。
请用纯文本回复，绝对不要用 ##、**、* 等Markdown符号。用emoji做标题即可。

当系统提供了用户健康档案或饮食记录时，直接分析，不要反问用户要数据。档案中的数值是准确的，直接引用不要重算。

分析饮食时，按这个简洁格式回复（只输出一次，不要重复）：
🍽️ 饮食记录
逐餐列出食物和热量

📊 营养估算
总热量、蛋白质、碳水、脂肪（蛋白质/碳水/脂肪单位必须是g）

📈 体重分析（如有档案数据）
简短评估

⭐ 健康评分：X/10
💡 建议（3条以内，简洁可执行）

自由问答直接回答即可，不需要上述格式。
不要编造数据，不要重复输出相同内容。`;

exports.main = async (event) => {
  const { messages, dietContext, userContext } = event;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '请输入消息内容' };
  }

  // 构建带系统 prompt 的完整消息列表
  let systemContent = SYSTEM_PROMPT;
  // 追加用户健康档案
  if (userContext) {
    systemContent += `\n\n${userContext}`;
  }
  // 追加饮食记录上下文
  if (dietContext) {
    systemContent += `\n\n${dietContext}`;
  }

  // 调试日志：查看实际发送给 AI 的上下文
  console.log('userContext:', userContext || '（空）');
  console.log('dietContext:', dietContext ? dietContext.substring(0, 200) : '（空）');

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  const requestBody = JSON.stringify({
    model: 'Qwen/Qwen2.5-7B-Instruct',
    messages: fullMessages,
    temperature: 0.5,
    max_tokens: 2048
  });

  try {
    const reply = await callAPI(requestBody);
    const cleanReply = stripMarkdown(reply);
    return { success: true, reply: cleanReply };
  } catch (err) {
    console.error('调用 AI API 失败:', err);
    return {
      success: false,
      error: err.message || 'AI 服务暂时不可用，请稍后重试'
    };
  }
};

// 去除 AI 回复中的 Markdown 格式符号和重复内容
function stripMarkdown(text) {
  let clean = text
    .replace(/^#{1,6}\s*/gm, '')           // 去掉 # ## ### 等标题符号
    .replace(/\*\*(.+?)\*\*/g, '$1')        // 去掉 **加粗**
    .replace(/\*(.+?)\*/g, '$1')            // 去掉 *斜体*
    .replace(/`(.+?)`/g, '$1')              // 去掉 `行内代码`
    .replace(/```[\s\S]*?```/g, '')          // 去掉 ```代码块```
    .replace(/^[-*_]{3,}\s*$/gm, '')        // 去掉分割线
    .replace(/\uFFFD/g, '')                 // 去掉替换字符
    .replace(/\s*t(\d)/g, ' $1')            // 修复 "t11g" → "11g" 类乱码
    .trim();

  // 去除重复段落：如果同一段落出现多次，只保留第一次
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

// 调用 SiliconFlow API（使用 Node.js 内置 https 模块）
function callAPI(body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.siliconflow.cn',
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
        console.log('API 状态码:', res.statusCode);
        console.log('API 返回:', data.substring(0, 500));
        try {
          const result = JSON.parse(data);
          if (result.error) {
            const errMsg = result.error.message || result.error.code || JSON.stringify(result.error);
            reject(new Error(errMsg));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
            return;
          }
          const reply = result.choices?.[0]?.message?.content;
          if (!reply) {
            reject(new Error('AI 未返回有效回复'));
            return;
          }
          resolve(reply);
        } catch (e) {
          reject(new Error(`解析失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`网络错误: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('请求超时，请稍后重试'));
    });

    req.write(body);
    req.end();
  });
}

// cloudfunctions/aiChat/index.js
const https = require('https');

// ===== 请在此处填入你的 SiliconFlow API Key =====
// 注册地址：https://cloud.siliconflow.cn  （注册即送免费额度，多种模型免费使用）
const API_KEY = 'sk-phzwenfpehlvrlmcquwpefqmcwepcnyqqwvbqfoqtgtqjncn';

const SYSTEM_PROMPT = `你是一位专业且亲切的营养师小助手，名叫"轻体营养师"。
你的职责：
- 根据用户提供的饮食记录，估算总热量、蛋白质、碳水化合物、脂肪含量
- 给出健康评分（1-10分）
- 提供3条简单可执行的改进建议
- 回答用户关于饮食、营养、减脂等方面的问答

回复规则：
1. 语言简洁口语化，像朋友聊天一样亲切自然
2. 分析饮食时，用以下格式回复：
   📊 **热量估算**
   - 总热量：约 XXX kcal
   - 蛋白质：约 XXg
   - 碳水：约 XXg
   - 脂肪：约 XXg

   ⭐ **健康评分**：X/10

   💡 **改进建议**
   1. ...
   2. ...
   3. ...
3. 如果是自由问答，直接简洁回答，不需要上述格式
4. 不要编造数据，对于不确定的食物热量，给出合理估算范围
5. 回复控制在200字以内，重点突出`;

exports.main = async (event) => {
  const { messages, dietContext } = event;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '请输入消息内容' };
  }

  // 构建带系统 prompt 的完整消息列表
  let systemContent = SYSTEM_PROMPT;
  // 如果携带了饮食记录上下文，追加到系统 prompt
  if (dietContext) {
    systemContent += `\n\n【用户今日饮食记录】\n${dietContext}`;
  }

  const fullMessages = [
    { role: 'system', content: systemContent },
    ...messages
  ];

  const requestBody = JSON.stringify({
    model: 'Qwen/Qwen2.5-7B-Instruct',
    messages: fullMessages,
    temperature: 0.7,
    max_tokens: 800
  });

  try {
    const reply = await callAPI(requestBody);
    return { success: true, reply };
  } catch (err) {
    console.error('调用 AI API 失败:', err);
    return {
      success: false,
      error: err.message || 'AI 服务暂时不可用，请稍后重试'
    };
  }
};

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

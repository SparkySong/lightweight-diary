// cloudfunctions/customerService/index.js
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// ============================================================
// ⚙️ 配置区 - 请根据需求修改以下内容
// ============================================================

// 消息推送 Token（必须与微信公众平台配置一致）
const TOKEN = process.env.CS_TOKEN || 'weight_tracker_cs_token';

// 自动回复配置
const AUTO_REPLIES = {
  // 欢迎语（用户首次进入客服时触发，关键词：空消息或特定事件）
  _welcome: '👋 你好！感谢使用「轻体日记」\n\n我可以帮你解答以下问题：\n• 体重记录\n• 饮食记录\n• 数据同步\n• 提醒设置\n• 隐私安全\n\n请直接输入你的问题，或点击下方菜单快速操作 👇',

  // 关键词 → 回复（支持多个关键词，不区分大小写）
  '体重': '📊 【体重记录】\n\n• 首页点击数字即可快速记录体重\n• 支持查看历史趋势图表\n• 长按某条记录可删除\n\n如有异常数据，请截图反馈给我们！',

  '饮食': '🍽️ 【饮食记录】\n\n• 在「饮食」页面可以添加每餐饮食\n• 支持从食物库搜索，也可以手动输入\n• 系统会自动计算卡路里\n\n如有食物库缺失的食物，可以在「个人中心」→「食物库管理」中添加！',

  '食物': '🍽️ 【食物库】\n\n• 内置常见食物及热量数据\n• 支持自定义添加食物\n• 搜索支持模糊匹配\n\n如果找不到某个食物，试试输入部分名称！',

  '数据': '☁️ 【数据同步】\n\n• 所有数据自动保存到云端\n• 更换设备后，用同一微信登录即可恢复\n• 数据不会丢失，请放心使用！',

  '同步': '☁️ 【数据同步】\n\n• 所有数据自动保存到云端\n• 更换设备后，用同一微信登录即可恢复\n• 数据不会丢失，请放心使用！',

  '提醒': '⏰ 【打卡提醒】\n\n• 在「个人中心」→「提醒设置」中开启\n• 支持自定义提醒时间\n• 需要允许小程序发送订阅消息\n\n如果收不到提醒，请检查微信「设置 → 通知」中是否允许了消息推送！',

  '隐私': '🔒 【隐私安全】\n\n• 所有数据仅存储在你的微信云环境中\n• 我们不会收集、分析或共享任何用户数据\n• 你可以随时在小程序内删除自己的数据\n\n放心使用，你的数据完全属于你！',

  '删除': '🗑️ 【删除账号/数据】\n\n目前可以在小程序内逐条删除记录。\n如需彻底清除所有数据，请联系人工客服处理。',

  '人工': null,   // null 表示转人工，不自动回复
  '客服': null,
};

// 转人工客服时的提示语
const TRANSFER_NOTICE = '👤 正在为你转接人工客服，请稍候...\n\n工作时间：周一至周五 9:00-18:00\n非工作时间留言将在次日回复。';

// ============================================================
// 签名验证
// ============================================================

function verifySignature(signature, timestamp, nonce) {
  const arr = [TOKEN, timestamp, nonce].sort();
  const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return hash === signature;
}

// ============================================================
// 自动回复匹配
// ============================================================

function matchReply(content) {
  const text = (content || '').toLowerCase();

  for (const [keyword, reply] of Object.entries(AUTO_REPLIES)) {
    if (keyword.startsWith('_')) continue; // 跳过特殊配置项
    if (text.includes(keyword.toLowerCase())) {
      return { reply, transfer: reply === null };
    }
  }

  return { reply: null, transfer: false };
}

// ============================================================
// HTTP 入口（用于消息推送）
// ============================================================

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // --- 签名验证（GET 请求）---
  if (event.httpMethod === 'GET' || event.queryStringParameters?.signature) {
    const { signature, timestamp, nonce, echostr } =
      event.queryStringParameters || event;

    if (verifySignature(signature, timestamp, nonce)) {
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: echostr,
      };
    }
    return { statusCode: 403, body: 'Signature verification failed' };
  }

  // --- 消息处理（POST 请求）---
  const msg = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : event;

  // console.log('[customerService] 收到消息:', JSON.stringify(msg));

  const msgType = msg.MsgType;
  const openid = msg.FromUserName;
  const content = (msg.Content || '').trim();

  // 只处理文本消息，其余转人工
  if (msgType !== 'text') {
    try {
      await cloud.openapi.customerServiceMessage.transfer({
        touser: openid,
      });
    } catch (e) {
      console.error('转人工失败:', e);
    }
    return { statusCode: 200, body: 'success' };
  }

  // 匹配关键词
  const { reply, transfer } = matchReply(content);

  // 转人工
  if (transfer) {
    try {
      await cloud.openapi.customerServiceMessage.send({
        touser: openid,
        msgtype: 'text',
        text: { content: TRANSFER_NOTICE },
      });
      await cloud.openapi.customerServiceMessage.transfer({
        touser: openid,
      });
    } catch (e) {
      console.error('转人工失败:', e);
    }
    return { statusCode: 200, body: 'success' };
  }

  // 自动回复
  if (reply) {
    try {
      await cloud.openapi.customerServiceMessage.send({
        touser: openid,
        msgtype: 'text',
        text: { content: reply },
      });
      // console.log(`[customerService] 已自动回复: ${openid}`);
    } catch (e) {
      console.error('自动回复失败:', e);
    }
  }
  // 未匹配到关键词时不回复，消息会推送给绑定的客服人员

  return { statusCode: 200, body: 'success' };
};

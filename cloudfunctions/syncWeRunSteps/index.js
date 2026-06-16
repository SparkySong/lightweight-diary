// cloudfunctions/syncWeRunSteps/index.js
// 使用标准 code → session_key → AES 解密 流程同步微信运动数据
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 从环境变量读取配置
const APPID = process.env.WX_APPID || 'wx128c080f16e6cc6b';
const SECRET = process.env.WX_APPSECRET || '';

/**
 * 用 code 换取 session_key 和 openid
 */
function code2Session(code) {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;
    httpsGet(url).then(resolve).catch(reject);
  });
}

/**
 * HTTPS GET 请求
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

/**
 * AES-128-CBC 解密微信加密数据
 */
function decryptWxData(encryptedData, iv, sessionKey) {
  const sessionKeyBuf = Buffer.from(sessionKey, 'base64');
  const ivBuf = Buffer.from(iv, 'base64');
  const cipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuf, ivBuf);
  cipher.setAutoPadding(true);
  let decoded = cipher.update(Buffer.from(encryptedData, 'base64'), 'binary', 'utf8');
  decoded += cipher.final('utf8');
  return JSON.parse(decoded);
}

exports.main = async (event) => {
  const OPENID = cloud.getWXContext().OPENID;
  const { encryptedData, iv, code } = event;

  console.log('[步数] OPENID:', OPENID);

  if (!encryptedData || !iv) {
    return { success: false, error: '缺少加密数据' };
  }
  if (!code) {
    return { success: false, error: '缺少登录凭证' };
  }
  if (!SECRET) {
    console.error('[步数] 未配置 WX_APPSECRET');
    return { success: false, error: '服务未正确配置，请联系开发者' };
  }

  try {
    // Step 1: 用 code 换取 session_key
    console.log('[步数] 正在换取 session_key...');
    const sessionRes = await code2Session(code);

    if (!sessionRes.session_key) {
      console.error('[步数] 获取 session_key 失败:', JSON.stringify(sessionRes));
      return { success: false, error: '获取会话密钥失败: ' + (sessionRes.errmsg || '未知错误') };
    }

    // Step 2: AES 解密微信运动数据
    console.log('[步数] 正在解密运动数据...');
    const decrypted = decryptWxData(encryptedData, iv, sessionRes.session_key);
    const stepInfo = decrypted.stepInfoList || [];
    console.log('[步数] 解密成功, stepInfoList长度:', stepInfo.length);

    if (stepInfo.length === 0) {
      return { success: false, error: '无步数数据' };
    }

    // 获取最新一天的数据
    const todayStep = stepInfo[stepInfo.length - 1];
    const steps = todayStep.step || 0;
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 计算消耗
    const calories = Math.round(steps * 0.04);
    const duration = Math.round(steps / 100);

    const collection = db.collection('exercises');

    // 检查今日是否已有步数记录
    const exist = await collection.where({
      _openid: OPENID,
      date: date,
      isAuto: true
    }).get();

    if (exist.data.length > 0) {
      await collection.doc(exist.data[0]._id).update({
        data: { steps, calories, duration, updateTime: db.serverDate() }
      });
    } else {
      await collection.add({
        data: {
          _openid: OPENID,
          date,
          type: 'walking',
          typeLabel: '步行',
          duration,
          calories,
          steps,
          isAuto: true,
          createTime: db.serverDate()
        }
      });
    }

    return { success: true, steps, calories, date };
  } catch (err) {
    console.error('[步数] 同步失败:', err);
    let errMsg = err.message || String(err);
    if (errMsg.includes('padding') || errMsg.includes('decrypt') || errMsg.includes('cipher')) {
      errMsg = '数据解密失败，请重新进入小程序后重试';
    }
    return { success: false, error: errMsg };
  }
};

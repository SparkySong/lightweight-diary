// cloudfunctions/sendReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 使用环境变量优先，fallback到硬编码值（便于本地开发调试）
const TEMPLATE_ID = process.env.TEMPLATE_ID || '5X2tUq0NbycqoeFiymKj4FiKaLts5K5ZdSgzqHf4Lt4';

// 云函数执行限制
const MAX_EXECUTION_TIME = 15000; // 最大执行时间 15s（云函数默认超时20s，预留余量）

/**
 * 获取 UTC+8 时区的日期字符串（正确处理跨天场景）
 */
function getUTC8DateStr(d) {
  const utc8 = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-${String(utc8.getUTCDate()).padStart(2, '0')}`;
}

function formatWeightValue(weight) {
  const value = parseFloat(weight);
  return Number.isFinite(value) ? `${value.toFixed(1)}kg` : '暂无记录';
}

exports.main = async (event, context) => {
  const startTime = Date.now();
  const now = new Date();
  const todayStr = getUTC8DateStr(now);

  // 使用 Intl API 或手动构造 UTC+8 时间，正确处理跨午夜场景
  const utc8Now = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const adjustedHour = utc8Now.getUTCHours();
  const currentMinute = utc8Now.getUTCMinutes();

  // 获取所有开启提醒的用户
  // 分页获取，突破默认100条限制
  const MAX_LIMIT = 100;
  let allUsers = [];
  let queryResult;
  
  do {
    queryResult = await db.collection('user_reminders')
      .where({ nextReminderDate: todayStr })
      .skip(allUsers.length)
      .limit(MAX_LIMIT)
      .get();
    allUsers = allUsers.concat(queryResult.data);
  } while (queryResult.data.length === MAX_LIMIT);

  const results = [];

  for (let i = 0; i < allUsers.length; i++) {
    // 超时保护：接近云函数超时限制时停止处理
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      console.warn(`[sendReminder] 接近超时限制，已处理 ${i}/${allUsers.length} 个用户，停止处理`);
      break;
    }

    const user = allUsers[i];

    // 检查是否到了用户的提醒时间
    const remindTime = user.remindTime || '08:00';
    const [targetHour, targetMinute] = remindTime.split(':').map(Number);
    // 计算用户提醒时间距0点的总分钟数
    const targetTotalMin = targetHour * 60 + targetMinute;
    // 计算当前时间距0点的总分钟数
    const currentTotalMin = adjustedHour * 60 + currentMinute;
    // 只在当前时间与目标时间相差15分钟以内时发送（确保偏差可控）
    if (Math.abs(currentTotalMin - targetTotalMin) > 15) {
      continue;
    }

    if (user.lastSentDate === todayStr && user.lastStatus === 'sent') {
      results.push({ openid: user.openid, status: 'already_sent' });
      continue;
    }

    try {
      // 获取最近一条体重记录
      const latestWeight = await db.collection('weight_records')
        .where({ openid: user.openid })
        .orderBy('date', 'desc')
        .limit(1)
        .get();

      const weightStr = latestWeight.data.length > 0
        ? formatWeightValue(latestWeight.data[0].weight)
        : '暂无记录';

      await cloud.openapi.subscribeMessage.send({
        touser: user.openid,
        templateId: TEMPLATE_ID,
        page: 'pages/index/index',
        data: {
          character_string9: { value: weightStr },
          thing3: { value: '今天还未记录体重，点击立即打卡' }
        }
      });

      await db.collection('user_reminders').doc(user._id).update({
        data: {
          nextReminderDate: '',
          lastSentDate: todayStr,
          lastStatus: 'sent',
          lastErrorCode: null,
          lastErrorMessage: '',
          updateTime: db.serverDate()
        }
      });

      results.push({ openid: user.openid, status: 'sent' });
    } catch (err) {
      console.error(`发送失败: ${user.openid}`, err);
      const isQuotaError = err.errCode === 43101;
      const failureStatus = isQuotaError ? 'consumed' : 'failed';

      await db.collection('user_reminders').doc(user._id).update({
        data: {
          nextReminderDate: '',
          lastSentDate: todayStr,
          lastStatus: failureStatus,
          lastErrorCode: err.errCode || null,
          lastErrorMessage: err.message || '',
          updateTime: db.serverDate()
        }
      });

      results.push({ openid: user.openid, status: 'failed', error: err.message, errCode: err.errCode });
    }
  }

  return { total: allUsers.length, processed: results.length, sent: results.filter(r => r.status === 'sent').length, results };
};

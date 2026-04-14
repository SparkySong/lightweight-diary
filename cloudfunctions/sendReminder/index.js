// cloudfunctions/sendReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 使用用户提供的订阅消息模板ID
const TEMPLATE_ID = '5X2tUq0NbycqoeFiymKj4FiKaLts5K5ZdSgzqHf4Lt4';

exports.main = async (event, context) => {
  const now = new Date();
  // 当前小时（UTC+8）
  const currentHour = now.getUTCHours() + 8;
  const adjustedHour = currentHour >= 24 ? currentHour - 24 : currentHour;
  const currentMinute = now.getUTCMinutes();

  // 获取所有开启提醒的用户
  // 分页获取，突破默认100条限制
  const MAX_LIMIT = 100;
  let allUsers = [];
  let queryResult;
  
  do {
    queryResult = await db.collection('user_reminders')
      .where({ enabled: true })
      .skip(allUsers.length)
      .limit(MAX_LIMIT)
      .get();
    allUsers = allUsers.concat(queryResult.data);
  } while (queryResult.data.length === MAX_LIMIT);

  const results = [];

  for (const user of allUsers) {
    // 检查订阅是否过期（7天有效期）
    if (user.expireTime && new Date(user.expireTime) < now) {
      await db.collection('user_reminders').doc(user._id).update({
        data: { enabled: false }
      });
      results.push({ openid: user.openid, status: 'expired' });
      continue;
    }

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

    // 检查今日是否已发送过
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (user.lastSentDate === todayStr) {
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
        ? `${latestWeight.data[0].weight} kg`
        : '暂无记录';

      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      await cloud.openapi.subscribeMessage.send({
        touser: user.openid,
        templateId: TEMPLATE_ID,
        page: 'pages/index/index',
        data: {
          thing1: { value: '体重打卡提醒' },
          thing2: { value: '记得称体重并记录' },
          thing3: { value: `上次: ${weightStr}` },
          time4: { value: `${String(adjustedHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}` }
        }
      });

      // 发送成功后，标记该用户今日已发送，避免重复
      await db.collection('user_reminders').doc(user._id).update({
        data: { lastSentDate: today }
      });

      results.push({ openid: user.openid, status: 'sent' });
    } catch (err) {
      console.error(`发送失败: ${user.openid}`, err);
      // 如果是订阅次数用完的错误，关闭提醒
      if (err.errCode === 43101 || err.errCode === 47003) {
        await db.collection('user_reminders').doc(user._id).update({
          data: { enabled: false }
        });
      }
      results.push({ openid: user.openid, status: 'failed', error: err.message, errCode: err.errCode });
    }
  }

  return { total: allUsers.length, sent: results.filter(r => r.status === 'sent').length, results };
};

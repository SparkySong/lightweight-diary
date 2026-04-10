// cloudfunctions/sendReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 使用用户提供的订阅消息模板ID
const TEMPLATE_ID = '5X2tUq0NbycqoeFiymKj4FiKaLts5K5ZdSgzqHf4Lt4';

exports.main = async (event, context) => {
  // 定时触发：每天早上8点发送提醒
  const now = new Date();
  const hour = now.getHours();

  // 获取所有开启提醒的用户
  const users = await db.collection('user_reminders')
    .where({ enabled: true })
    .limit(1000)
    .get();

  const results = [];

  for (const user of users.data) {
    // 检查订阅是否过期（7天有效期）
    if (user.expireTime && new Date(user.expireTime) < now) {
      await db.collection('user_reminders').doc(user._id).update({
        data: { enabled: false }
      });
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
          thing1: { value: '每日体重打卡提醒' },
          thing2: { value: '记得称体重并记录哦！坚持就是胜利 💪' },
          thing3: { value: `上次记录: ${weightStr}` },
          time4: { value: today }
        }
      });

      results.push({ openid: user.openid, status: 'sent' });
    } catch (err) {
      console.error(`发送失败: ${user.openid}`, err);
      results.push({ openid: user.openid, status: 'failed', error: err.message });
    }
  }

  return { total: users.data.length, results };
};

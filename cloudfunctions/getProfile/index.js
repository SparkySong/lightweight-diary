// cloudfunctions/getProfile/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // Get profile (height, nickname, avatarUrl, goalWeight)
  const profile = await db.collection('user_profiles')
    .where({ openid: OPENID })
    .get();

  // Get reminder settings
  const reminder = await db.collection('user_reminders')
    .where({ openid: OPENID })
    .get();

  const profileDoc = profile.data[0] || null;
  const reminderDoc = reminder.data[0] || null;
  const nextReminderDate = reminderDoc?.nextReminderDate || '';

  return {
    height: profileDoc?.height || null,
    nickname: profileDoc?.nickname || null,
    avatarUrl: profileDoc?.avatarUrl || null,
    goalWeight: profileDoc?.goalWeight || null,
    reminder: reminderDoc ? {
      enabled: Boolean(nextReminderDate),
      remindTime: reminderDoc.remindTime || '08:00',
      nextReminderDate,
      displayDate: nextReminderDate,
      lastStatus: reminderDoc.lastStatus || '',
      lastErrorCode: reminderDoc.lastErrorCode || null
    } : {
      enabled: false,
      remindTime: '08:00',
      nextReminderDate: '',
      displayDate: '',
      lastStatus: '',
      lastErrorCode: null
    }
  };
};

// cloudfunctions/getProfile/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // Get profile (height)
  const profile = await db.collection('user_profiles')
    .where({ openid: OPENID })
    .get();

  // Get reminder settings
  const reminder = await db.collection('user_reminders')
    .where({ openid: OPENID })
    .get();

  const reminderDoc = reminder.data[0] || null;
  const nextReminderDate = reminderDoc?.nextReminderDate || '';

  return {
    height: profile.data.length > 0 ? profile.data[0].height : null,
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

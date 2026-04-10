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

  return {
    height: profile.data.length > 0 ? profile.data[0].height : null,
    reminder: reminder.data.length > 0 ? {
      enabled: reminder.data[0].enabled,
      remindTime: reminder.data[0].remindTime || '08:00'
    } : { enabled: false, remindTime: '08:00' }
  };
};

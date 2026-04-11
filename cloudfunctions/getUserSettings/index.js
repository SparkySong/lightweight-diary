// cloudfunctions/getUserSettings/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  const res = await db.collection('user_settings')
    .where({ openid: OPENID })
    .get();

  if (res.data.length > 0) {
    return { 
      success: true,
      settings: {
        dailyCalorieTarget: res.data[0].dailyCalorieTarget || 0
      }
    };
  }
  return { success: true, settings: { dailyCalorieTarget: 0 } };
};

// cloudfunctions/saveUserSettings/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { dailyCalorieTarget } = event;

  if (dailyCalorieTarget === undefined) {
    return { success: false, error: '参数缺失' };
  }

  const collection = db.collection('user_settings');
  const exist = await collection.where({ openid: OPENID }).get();

  if (exist.data.length > 0) {
    await collection.doc(exist.data[0]._id).update({
      data: { 
        dailyCalorieTarget: parseInt(dailyCalorieTarget), 
        updateTime: db.serverDate() 
      }
    });
  } else {
    await collection.add({
      data: {
        openid: OPENID,
        dailyCalorieTarget: parseInt(dailyCalorieTarget),
        createTime: db.serverDate()
      }
    });
  }

  return { success: true };
};

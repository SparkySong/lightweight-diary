// cloudfunctions/setHeight/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { height } = event;

  if (!height) return { success: false, error: '参数缺失' };

  const collection = db.collection('user_profiles');
  const exist = await collection.where({ openid: OPENID }).get();

  if (exist.data.length > 0) {
    await collection.doc(exist.data[0]._id).update({
      data: { height: parseFloat(height), updateTime: db.serverDate() }
    });
  } else {
    await collection.add({
      data: {
        openid: OPENID,
        height: parseFloat(height),
        createTime: db.serverDate()
      }
    });
  }

  return { success: true };
};

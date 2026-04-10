// cloudfunctions/setGoal/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { goal } = event;

  if (!goal) return { success: false, error: '参数缺失' };

  const collection = db.collection('weight_goals');
  const exist = await collection.where({ openid: OPENID }).get();

  if (exist.data.length > 0) {
    await collection.doc(exist.data[0]._id).update({
      data: { goal: parseFloat(goal), updateTime: db.serverDate() }
    });
  } else {
    await collection.add({
      data: {
        openid: OPENID,
        goal: parseFloat(goal),
        createTime: db.serverDate()
      }
    });
  }

  return { success: true };
};

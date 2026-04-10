// cloudfunctions/addRecord/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { date, weight } = event;

  if (!date || !weight) return { success: false, error: '参数缺失' };

  const collection = db.collection('weight_records');

  // Check if record exists for this date
  const exist = await collection.where({
    openid: OPENID,
    date: date
  }).get();

  if (exist.data.length > 0) {
    await collection.doc(exist.data[0]._id).update({
      data: { weight, updateTime: db.serverDate() }
    });
    return { success: true, updated: true };
  }

  await collection.add({
    data: {
      openid: OPENID,
      date,
      weight,
      createTime: db.serverDate()
    }
  });

  return { success: true, updated: false };
};

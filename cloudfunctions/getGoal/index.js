// cloudfunctions/getGoal/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  const res = await db.collection('weight_goals')
    .where({ openid: OPENID })
    .get();

  if (res.data.length > 0) {
    return { goal: res.data[0].goal };
  }
  return { goal: null };
};

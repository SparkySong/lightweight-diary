// cloudfunctions/getPeriods/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { limit } = event;

  try {
    const res = await db.collection('periods')
      .where({ openid: OPENID })
      .orderBy('startDate', 'desc')
      .limit(limit || 50)
      .get();

    return { success: true, data: res.data };
  } catch (e) {
    console.error('获取经期记录失败', e);
    return { success: false, data: [], error: e.message };
  }
};

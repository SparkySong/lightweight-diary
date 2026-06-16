// cloudfunctions/getReports/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type, limit } = event;

  const query = { openid: OPENID };
  if (type) query.type = type;

  try {
    const res = await db.collection('reports')
      .where(query)
      .orderBy('createdAt', 'desc')
      .limit(limit || 20)
      .get();

    return { success: true, data: res.data };
  } catch (e) {
    console.error('获取报告失败', e);
    return { success: false, data: [], error: e.message };
  }
};

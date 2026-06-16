// cloudfunctions/getExercises/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { startDate, endDate, limit = 100 } = event;

  try {
    const collection = db.collection('exercises');
    let query = { openid: OPENID };

    if (startDate && endDate) {
      query.date = db.command.gte(startDate).and(db.command.lte(endDate));
    } else if (startDate) {
      query.date = db.command.gte(startDate);
    }

    const result = await collection
      .where(query)
      .orderBy('date', 'desc')
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();

    return { success: true, data: result.data };
  } catch (e) {
    if (e.message && e.message.includes('not exist')) {
      return { success: true, data: [], tip: '请在云开发控制台创建 exercises 集合' };
    }
    throw e;
  }
};

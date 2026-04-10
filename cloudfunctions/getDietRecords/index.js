// cloudfunctions/getDietRecords/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { date, startDate, endDate } = event;

  let query = { openid: OPENID };

  if (date) {
    query.date = date;
  } else if (startDate && endDate) {
    query.date = _.gte(startDate).and(_.lte(endDate));
  }

  const res = await db.collection('diet_records')
    .where(query)
    .orderBy('createTime', 'desc')
    .limit(100)
    .get();

  const mealLabels = {
    breakfast: '🌅 早餐',
    lunch: '☀️ 午餐',
    dinner: '🌙 晚餐',
    snack: '🍪 加餐'
  };

  const records = res.data.map(r => ({
    ...r,
    mealLabel: mealLabels[r.mealType] || r.mealType,
    totalCal: r.foods ? r.foods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0) : 0
  }));

  // Group by date
  const grouped = {};
  records.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = { date: r.date, records: [], totalCal: 0 };
    grouped[r.date].records.push(r);
    grouped[r.date].totalCal += r.totalCal;
  });

  const days = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

  return { data: records, days };
};

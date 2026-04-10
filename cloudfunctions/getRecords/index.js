// cloudfunctions/getRecords/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const MAX_LIMIT = 100;

  const res = await db.collection('weight_records')
    .where({ openid: OPENID })
    .orderBy('date', 'desc')
    .limit(MAX_LIMIT)
    .get();

  const records = res.data.map(r => {
    const d = new Date(r.date + 'T00:00:00');
    return {
      ...r,
      dateStr: `${d.getMonth() + 1}月${d.getDate()}日`,
      weight: parseFloat(r.weight)
    };
  });

  // Sort asc for diff calc
  const sortedAsc = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const diffMap = {};
  sortedAsc.forEach((r, i) => {
    if (i > 0) {
      diffMap[r.date] = parseFloat((r.weight - sortedAsc[i - 1].weight).toFixed(1));
    }
  });

  // Add diff to records (descending order)
  const result = records.map(r => {
    const diff = diffMap[r.date];
    let diffClass = 'neutral';
    if (diff !== undefined) {
      if (diff < 0) diffClass = 'down';
      else if (diff > 0) diffClass = 'up';
      else diffClass = 'neutral';
    }
    return { ...r, diff, diffClass };
  }).sort((a, b) => b.date.localeCompare(a.date));

  return { data: result };
};

// cloudfunctions/generateReport/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type } = event; // 'weekly' | 'monthly'

  if (!type || !['weekly', 'monthly'].includes(type)) {
    return { success: false, error: 'type 参数无效' };
  }

  const now = new Date();
  let startDate, endDate;

  if (type === 'weekly') {
    // 上周一到上周日
    const dayOfWeek = now.getDay() || 7; // 周日为7
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6);
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - dayOfWeek);
    startDate = formatStr(lastMonday);
    endDate = formatStr(lastSunday);
  } else {
    // 上月1日到上月最后一天
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    startDate = formatStr(lastMonth);
    endDate = formatStr(lastDay);
  }

  try {
    // 并行获取各类数据
    const [weightRes, dietRes, exerciseRes] = await Promise.allSettled([
      db.collection('records').where({
        openid: OPENID,
        date: _.gte(startDate).and(_.lte(endDate))
      }).orderBy('date', 'asc').limit(100).get(),
      db.collection('diet_records').where({
        openid: OPENID,
        date: _.gte(startDate).and(_.lte(endDate))
      }).limit(500).get(),
      db.collection('exercises').where({
        openid: OPENID,
        date: _.gte(startDate).and(_.lte(endDate))
      }).limit(500).get()
    ]);

    const weightRecords = weightRes.status === 'fulfilled' ? weightRes.value.data : [];
    const dietRecords = dietRes.status === 'fulfilled' ? dietRes.value.data : [];
    const exerciseRecords = exerciseRes.status === 'fulfilled' ? exerciseRes.value.data : [];

    // 体重变化
    let weightChange = 0;
    if (weightRecords.length >= 2) {
      const sorted = weightRecords.sort((a, b) => a.date.localeCompare(b.date));
      weightChange = parseFloat((sorted[sorted.length - 1].weight - sorted[0].weight).toFixed(1));
    }

    // 日均摄入 & 打卡天数
    const dailyCalories = {};
    dietRecords.forEach(r => {
      const cal = r.calories || (r.foods || []).reduce((s, f) => s + (parseInt(f.calories) || 0), 0);
      dailyCalories[r.date] = (dailyCalories[r.date] || 0) + cal;
    });
    const dietDays = Object.keys(dailyCalories).length;
    const totalCalories = Object.values(dailyCalories).reduce((s, c) => s + c, 0);
    const avgDailyCalories = dietDays > 0 ? Math.round(totalCalories / dietDays) : 0;

    // 运动统计
    const exerciseDaysSet = new Set(exerciseRecords.map(e => e.date));
    const exerciseDays = exerciseDaysSet.size;
    const totalExerciseCal = exerciseRecords.reduce((s, e) => s + (e.calories || 0), 0);

    // 打卡天数（体重记录）
    const checkinDays = weightRecords.length;

    // 生成亮点
    const highlights = [];
    if (checkinDays >= 7) highlights.push(`本期坚持打卡${checkinDays}天`);
    if (weightChange < -1) highlights.push(`成功减重${Math.abs(weightChange)}kg`);
    if (exerciseDays >= 5) highlights.push(`运动${exerciseDays}天，非常自律！`);
    if (avgDailyCalories > 0 && avgDailyCalories <= 1500) highlights.push('热量控制得很好');
    if (totalExerciseCal > 1000) highlights.push(`运动消耗${totalExerciseCal}kcal`);
    if (highlights.length === 0) highlights.push('继续坚持，每一步都算数');

    const report = {
      openid: OPENID,
      type,
      startDate,
      endDate,
      weightChange,
      avgDailyCalories,
      checkinDays,
      exerciseDays,
      totalExerciseCal,
      highlights,
      createdAt: db.serverDate()
    };

    // 存储报告（先删除同周期旧报告，再新增）
    try {
      // 使用 where 批量删除，避免逐条删除的竞态问题
      const existing = await db.collection('reports').where({
        openid: OPENID,
        type: type,
        startDate: startDate,
        endDate: endDate
      }).count();
      
      if (existing.total > 0) // 有旧数据则先删除
      {
        const batchSize = 20;
        let deletedCount = 0;
        while (deletedCount < existing.total) 
        {
          const batch = await db.collection('reports')
            .where({
              openid: OPENID,
              type: type,
              startDate: startDate,
              endDate: endDate
            })
            .limit(batchSize)
            .get();
          
          if (batch.data.length === 0) break;
          
          for (const old of batch.data) 
          {
            await db.collection('reports').doc(old._id).remove();
            deletedCount++;
          }
        }
      }
      const addRes = await db.collection('reports').add({ data: report });
      return { success: true, report: { ...report, _id: addRes._id, isOverwrite: existing.total > 0 } };
    } catch (addErr) {
      if (addErr.message && addErr.message.includes('not exist')) {
        return { success: false, error: '请在云开发控制台创建 reports 数据库集合后再试' };
      }
      throw addErr;
    }
  } catch (e) {
    console.error('生成报告失败', e);
    return { success: false, error: e.message };
  }
};

function formatStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

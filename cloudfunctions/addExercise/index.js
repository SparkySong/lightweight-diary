// cloudfunctions/addExercise/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { date, type, typeLabel, duration, calories, steps } = event;

  if (!date || !type || !duration || !calories) {
    return { success: false, error: '参数缺失' };
  }

  const collection = db.collection('exercises');

  try {
    // 检查是否已存在同日期的手动记录
    const exist = await collection.where({
      openid: OPENID,
      date: date,
      type: type,
      isAuto: false
    }).get();

    if (exist.data.length > 0) {
      // 更新现有记录
      await collection.doc(exist.data[0]._id).update({
        data: {
          duration,
          calories,
          steps: steps || 0,
          updateTime: db.serverDate()
        }
      });
      return { success: true, updated: true };
    }

    // 新增记录
    await collection.add({
      data: {
        openid: OPENID,
        date,
        type,
        typeLabel: typeLabel || type,
        duration,
        calories,
        steps: steps || 0,
        isAuto: false,
        createTime: db.serverDate()
      }
    });

    return { success: true, updated: false };
  } catch (e) {
    if (e.message && e.message.includes('not exist')) {
      return { success: false, error: '请在云开发控制台创建 exercises 数据库集合' };
    }
    return { success: false, error: e.message || '保存失败' };
  }
};

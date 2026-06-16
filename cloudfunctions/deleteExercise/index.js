// cloudfunctions/deleteExercise/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event;

  if (!id) return { success: false, error: '参数缺失' };

  const collection = db.collection('exercises');

  // 验证权限
  const record = await collection.doc(id).get();
  if (record.data.openid !== OPENID) {
    return { success: false, error: '无权删除' };
  }

  await collection.doc(id).remove();
  return { success: true };
};

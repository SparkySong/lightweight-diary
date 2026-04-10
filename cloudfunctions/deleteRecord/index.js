// cloudfunctions/deleteRecord/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { id } = event;

  if (!id) return { success: false, error: '缺少记录ID' };

  // Verify ownership
  const record = await db.collection('weight_records').doc(id).get();
  if (record.data.openid !== OPENID) {
    return { success: false, error: '无权删除' };
  }

  await db.collection('weight_records').doc(id).remove();
  return { success: true };
};

// cloudfunctions/getFoodLibrary/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  try {
    // 先检查集合是否存在
    try {
      await db.collection('food_library').limit(1).get();
    } catch (e) {
      if (e.errCode === -502005 || e.message.includes('collection not exists')) {
        // 集合不存在，尝试创建
        try {
          await db.createCollection('food_library');
          // console.log('集合 food_library 创建成功');
        } catch (createErr) {
          // console.log('创建集合失败，需要手动创建');
        }
      }
    }
    
    const res = await db.collection('food_library')
      .where({
        openid: OPENID
      })
      .orderBy('useCount', 'desc')
      .limit(100)
      .get();
    
    return { success: true, foods: res.data || [] };
  } catch (e) {
    console.error('获取食物库失败', e);
    return { success: false, error: e.message, foods: [] };
  }
};

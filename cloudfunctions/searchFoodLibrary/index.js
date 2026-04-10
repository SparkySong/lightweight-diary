// 云函数：搜索云端食物库
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { keyword } = event;
  
  if (!keyword || keyword.trim().length === 0) {
    return { success: true, foods: [] };
  }
  
  try {
    // 先检查集合是否存在，不存在则返回空
    try {
      await db.collection('food_library').limit(1).get();
    } catch (checkErr) {
      console.log('集合不存在，无需搜索');
      return { success: true, foods: [] };
    }
    
    // 模糊搜索云端食物库
    const res = await db.collection('food_library')
      .where(
        _.or([
          { openid: OPENID },
          { openid: _.exists(false) } // 兼容旧数据
        ])
      )
      .where({
        name: db.RegExp({
          regexp: keyword.trim(),
          options: 'i' // 不区分大小写
        })
      })
      .limit(10)
      .get();
    
    return {
      success: true,
      foods: res.data || []
    };
  } catch (e) {
    console.error('搜索食物库失败', e);
    return {
      success: false,
      error: e.message,
      foods: []
    };
  }
};

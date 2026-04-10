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
    // 模糊搜索云端食物库（合并所有条件到一个 where）
    const res = await db.collection('food_library')
      .where(
        _.and([
          _.or([
            { openid: OPENID },
            { openid: _.exists(false) } // 兼容旧数据
          ]),
          {
            name: db.RegExp({
              regexp: keyword.trim(),
              options: 'i' // 不区分大小写
            })
          }
        ])
      )
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

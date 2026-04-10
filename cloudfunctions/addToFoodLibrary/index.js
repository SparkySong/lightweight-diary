// cloudfunctions/addToFoodLibrary/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { foods } = event;

  if (!foods || !Array.isArray(foods)) return { success: false, error: '参数缺失' };

  // 先检查集合是否存在，不存在则创建
  try {
    await db.collection('food_library').limit(1).get();
  } catch (e) {
    if (e.errCode === -502005 || e.message.includes('collection not exists')) {
      // 集合不存在，尝试创建
      try {
        await db.createCollection('food_library');
        console.log('集合 food_library 创建成功');
      } catch (createErr) {
        console.error('创建集合失败', createErr);
        return { success: false, error: '数据库集合不存在，请手动创建 food_library 集合' };
      }
    }
  }

  const results = [];
  
  for (const food of foods) {
    if (!food.name) continue;
    
    try {
      // 检查是否已存在（按食物名称去重）
      const exist = await db.collection('food_library').where({
        openid: OPENID,
        name: food.name.trim()
      }).count();
      
      if (exist.total === 0) {
        // 不存在则添加
        await db.collection('food_library').add({
          data: {
            openid: OPENID,
            name: food.name.trim(),
            calories: parseInt(food.calories) || 0,
            unit: food.unit || '',
            createTime: db.serverDate(),
            useCount: 1
          }
        });
        results.push({ name: food.name, added: true });
      } else {
        // 已存在则增加使用次数
        await db.collection('food_library').where({
          openid: OPENID,
          name: food.name.trim()
        }).update({
          data: {
            useCount: db.command.inc(1)
          }
        });
        results.push({ name: food.name, added: false, exists: true });
      }
    } catch (itemErr) {
      console.error(`处理食物 ${food.name} 失败`, itemErr);
      results.push({ name: food.name, added: false, error: itemErr.message });
    }
  }

  return { success: true, results };
};

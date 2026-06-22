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
      try {
        await db.createCollection('food_library');
        // console.log('集合 food_library 创建成功');
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
      const newCalories = parseInt(food.calories) || 0;
      const newUnit = food.unit || '';
      
      // 检查是否已存在
      const existRes = await db.collection('food_library').where({
        openid: OPENID,
        name: food.name.trim()
      }).get();
      
      if (existRes.data.length === 0) {
        // 不存在则添加
        await db.collection('food_library').add({
          data: {
            openid: OPENID,
            name: food.name.trim(),
            calories: newCalories,
            unit: newUnit,
            createTime: db.serverDate(),
            useCount: 1
          }
        });
        results.push({ name: food.name, added: true });
      } else {
        // 已存在，检查能量是否相同
        const existingFood = existRes.data[0];
        // console.log(`食物 ${food.name} 已存在，当前能量: ${existingFood.calories}, 新能量: ${newCalories}`);
        
        const updateData = {
          useCount: db.command.inc(1)
        };
        
        // 如果能量不同，更新为最新能量
        if (existingFood.calories !== newCalories) {
          updateData.calories = newCalories;
          // console.log(`更新能量: ${existingFood.calories} -> ${newCalories}`);
        }
        // 如果单位不同，更新为单位
        if (existingFood.unit !== newUnit) {
          updateData.unit = newUnit;
        }
        
        // 使用 _id 更新更可靠
        const updateRes = await db.collection('food_library').doc(existingFood._id).update({
          data: updateData
        });
        
        // console.log(`更新结果:`, updateRes);
        
        const updated = existingFood.calories !== newCalories || existingFood.unit !== newUnit;
        results.push({ 
          name: food.name, 
          added: false, 
          exists: true,
          updated: updated,
          oldCalories: existingFood.calories,
          newCalories: newCalories
        });
      }
    } catch (itemErr) {
      console.error(`处理食物 ${food.name} 失败`, itemErr);
      results.push({ name: food.name, added: false, error: itemErr.message });
    }
  }

  return { success: true, results };
};

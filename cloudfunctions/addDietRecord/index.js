// cloudfunctions/addDietRecord/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { date, mealType, foods, calories, note } = event;

  if (!date || !mealType || !foods) return { success: false, error: '参数缺失' };

  await db.collection('diet_records').add({
    data: {
      openid: OPENID,
      date,
      mealType,     // breakfast / lunch / dinner / snack
      foods: foods || [],  // [{name, calories}]
      calories: calories || 0,
      note: note || '',
      createTime: db.serverDate()
    }
  });

  return { success: true };
};

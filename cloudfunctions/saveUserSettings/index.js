// cloudfunctions/saveUserSettings/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { dailyCalorieTarget, nickname, avatarUrl, goalWeight, height, weightUnit, calorieUnit } = event;

  // 保存热量目标、体重单位、热量单位到 user_settings
  const hasSettingsData = dailyCalorieTarget !== undefined || weightUnit !== undefined || calorieUnit !== undefined;
  if (hasSettingsData) {
    const collection = db.collection('user_settings');
    const exist = await collection.where({ openid: OPENID }).get();
    const settingsUpdateData = { updateTime: db.serverDate() };

    if (dailyCalorieTarget !== undefined) settingsUpdateData.dailyCalorieTarget = parseInt(dailyCalorieTarget);
    if (weightUnit !== undefined) settingsUpdateData.weightUnit = weightUnit;
    if (calorieUnit !== undefined) settingsUpdateData.calorieUnit = calorieUnit;

    if (exist.data.length > 0) {
      await collection.doc(exist.data[0]._id).update({
        data: settingsUpdateData
      });
    } else {
      await collection.add({
        data: {
          openid: OPENID,
          ...settingsUpdateData,
          createTime: db.serverDate()
        }
      });
    }
  }

  // 保存个人资料到 user_profiles（nickname / avatarUrl / goalWeight / height）
  const hasProfileData = nickname !== undefined || avatarUrl !== undefined || goalWeight !== undefined || height !== undefined;
  if (hasProfileData) {
    const profileCol = db.collection('user_profiles');
    const existProfile = await profileCol.where({ openid: OPENID }).get();
    const updateData = { updateTime: db.serverDate() };

    if (nickname !== undefined) updateData.nickname = nickname;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (goalWeight !== undefined) updateData.goalWeight = parseFloat(goalWeight);
    if (height !== undefined) updateData.height = parseFloat(height);

    if (existProfile.data.length > 0) {
      await profileCol.doc(existProfile.data[0]._id).update({ data: updateData });
    } else {
      await profileCol.add({
        data: {
          openid: OPENID,
          ...updateData,
          createTime: db.serverDate()
        }
      });
    }
  }

  return { success: true };
};

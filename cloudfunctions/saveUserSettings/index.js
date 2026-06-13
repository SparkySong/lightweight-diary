// cloudfunctions/saveUserSettings/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { dailyCalorieTarget, nickname, avatarUrl, goalWeight, height } = event;

  // 保存热量目标到 user_settings
  if (dailyCalorieTarget !== undefined) {
    const collection = db.collection('user_settings');
    const exist = await collection.where({ openid: OPENID }).get();

    if (exist.data.length > 0) {
      await collection.doc(exist.data[0]._id).update({
        data: { 
          dailyCalorieTarget: parseInt(dailyCalorieTarget), 
          updateTime: db.serverDate() 
        }
      });
    } else {
      await collection.add({
        data: {
          openid: OPENID,
          dailyCalorieTarget: parseInt(dailyCalorieTarget),
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

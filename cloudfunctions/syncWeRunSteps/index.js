// cloudfunctions/syncWeRunSteps/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { encryptedData, iv } = event;

  console.log('[步数] OPENID:', OPENID);
  console.log('[步数] 收到加密数据, encryptedData长度:', (encryptedData || '').length);

  if (!encryptedData || !iv) {
    console.error('[步数] 缺少加密数据');
    return { success: false, error: '缺少加密数据' };
  }

  try {
    // 解密微信运动数据
    const result = await cloud.openapi.werun.getWeRunData({
      openid: OPENID,
      encryptedData,
      iv
    });

    console.log('[步数] 解密结果:', JSON.stringify(result));
    const stepInfo = result.stepInfoList || [];
    console.log('[步数] stepInfoList长度:', stepInfo.length);

    if (stepInfo.length === 0) {
      return { success: false, error: '无步数数据' };
    }

    // 获取最新一天的数据
    const todayStep = stepInfo[stepInfo.length - 1];
    console.log('[步数] 最新数据:', JSON.stringify(todayStep));
    const steps = todayStep.step || 0;
    // 使用本地时间格式而非UTC，避免时区偏移导致日期不匹配
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 计算消耗：步数 × 0.04 千卡/步
    const calories = Math.round(steps * 0.04);
    const duration = Math.round(steps / 100); // 粗略估算：每100步约1分钟

    const collection = db.collection('exercises');

    // 检查今日是否已有步数记录
    const exist = await collection.where({
      openid: OPENID,
      date: date,
      isAuto: true
    }).get();

    if (exist.data.length > 0) {
      // 更新今日步数记录
      await collection.doc(exist.data[0]._id).update({
        data: {
          steps,
          calories,
          duration,
          updateTime: db.serverDate()
        }
      });
    } else {
      // 新增今日步数记录
      await collection.add({
        data: {
          openid: OPENID,
          date,
          type: 'walking',
          typeLabel: '步行',
          duration,
          calories,
          steps,
          isAuto: true,
          createTime: db.serverDate()
        }
      });
    }

    return { success: true, steps, calories, date };
  } catch (err) {
    console.error('同步步数失败:', err);
    return { success: false, error: err.message };
  }
};

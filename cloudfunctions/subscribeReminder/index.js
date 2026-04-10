// cloudfunctions/subscribeReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { enabled, remindTime } = event;

  const collection = db.collection('user_reminders');
  const exist = await collection.where({ openid: OPENID }).get();

  const data = {
    enabled: enabled !== false,
    remindTime: remindTime || '08:00',
    updateTime: db.serverDate()
  };

  // 订阅有效期7天
  if (enabled !== false) {
    const expire = new Date();
    expire.setDate(expire.getDate() + 7);
    data.expireTime = expire;
  }

  if (exist.data.length > 0) {
    await collection.doc(exist.data[0]._id).update({ data });
  } else {
    await collection.add({
      data: {
        openid: OPENID,
        ...data,
        createTime: db.serverDate()
      }
    });
  }

  return { success: true };
};

// cloudfunctions/subscribeReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

function getUTC8DateStr(date = new Date()) {
  const utc8 = new Date(date.getTime() + EIGHT_HOURS);
  return `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, '0')}-${String(utc8.getUTCDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDate.getUTCDate()).padStart(2, '0')}`;
}

function resolveNextReminderDate(remindTime, targetDate) {
  if (targetDate) {
    return targetDate;
  }

  const now = new Date();
  const utc8Now = new Date(now.getTime() + EIGHT_HOURS);
  const currentTotalMin = utc8Now.getUTCHours() * 60 + utc8Now.getUTCMinutes();
  const [targetHour, targetMinute] = remindTime.split(':').map(Number);
  const targetTotalMin = targetHour * 60 + targetMinute;
  const todayStr = getUTC8DateStr(now);

  return currentTotalMin < targetTotalMin ? todayStr : addDays(todayStr, 1);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { enabled, remindTime: inputRemindTime, targetDate, source } = event;

  const collection = db.collection('user_reminders');
  const exist = await collection.where({ openid: OPENID }).get();
  const existingDoc = exist.data[0] || null;
  const remindTime = inputRemindTime || existingDoc?.remindTime || '08:00';

  let nextReminderDate = '';
  let lastStatus = 'cancelled';

  if (enabled !== false) {
    nextReminderDate = resolveNextReminderDate(remindTime, targetDate);
    lastStatus = 'pending';
  }

  const data = {
    remindTime,
    nextReminderDate,
    lastAuthorizedAt: enabled !== false ? db.serverDate() : existingDoc?.lastAuthorizedAt || null,
    lastStatus,
    lastErrorCode: null,
    lastErrorMessage: '',
    source: source || 'manual',
    updateTime: db.serverDate()
  };

  if (enabled === false) {
    data.lastErrorCode = existingDoc?.lastErrorCode || null;
    data.lastErrorMessage = '';
  }

  if (existingDoc) {
    await collection.doc(existingDoc._id).update({ data });
  } else {
    await collection.add({
      data: {
        openid: OPENID,
        ...data,
        createTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    reminder: {
      enabled: Boolean(nextReminderDate),
      remindTime,
      nextReminderDate,
      displayDate: nextReminderDate
    }
  };
};

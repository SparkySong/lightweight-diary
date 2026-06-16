// cloudfunctions/addPeriod/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { action, id, startDate, endDate, flow, symptoms, notes } = event;

  // action: 'start' 开始经期 | 'end' 结束经期 | 'update' 更新 | 'add' 新增完整记录
  if (!action) return { success: false, error: '缺少 action 参数' };

  const collection = db.collection('periods');

  try {
    if (action === 'start') {
      // 检查是否有未结束的经期记录
      const ongoing = await collection.where({
        openid: OPENID,
        endDate: db.command.exists(false)
      }).get();

      if (ongoing.data.length > 0) {
        return { success: false, error: '已有进行中的经期记录，请先结束当前经期' };
      }

      const today = startDate || formatStr(new Date());
      await collection.add({
        data: {
          openid: OPENID,
          startDate: today,
          flow: flow || 'medium',
          symptoms: symptoms || [],
          notes: notes || '',
          createTime: db.serverDate()
        }
      });
      return { success: true, message: '经期已开始' };
    }

    if (action === 'end') {
      // 找到进行中的记录并添加结束日期
      const ongoing = await collection.where({
        openid: OPENID,
        endDate: db.command.exists(false)
      }).get();

      if (ongoing.data.length === 0) {
        return { success: false, error: '没有进行中的经期记录' };
      }

      const record = ongoing.data[0];
      const end = endDate || formatStr(new Date());
      const start = new Date(record.startDate);
      const endD = new Date(end);
      const periodLength = Math.ceil((endD - start) / (1000 * 60 * 60 * 24)) + 1;

      await collection.doc(record._id).update({
        data: {
          endDate: end,
          periodLength,
          updateTime: db.serverDate()
        }
      });
      return { success: true, message: '经期已结束', periodLength };
    }

    if (action === 'update' && id) {
      const updateData = { updateTime: db.serverDate() };
      if (flow) updateData.flow = flow;
      if (symptoms) updateData.symptoms = symptoms;
      if (notes !== undefined) updateData.notes = notes;
      if (startDate) updateData.startDate = startDate;
      if (endDate) updateData.endDate = endDate;

      await collection.doc(id).update({ data: updateData });
      return { success: true, message: '已更新' };
    }

    if (action === 'add') {
      if (!startDate) return { success: false, error: '缺少开始日期' };
      const data = {
        openid: OPENID,
        startDate,
        flow: flow || 'medium',
        symptoms: symptoms || [],
        notes: notes || '',
        createTime: db.serverDate()
      };
      if (endDate) {
        data.endDate = endDate;
        const start = new Date(startDate);
        const end = new Date(endDate);
        data.periodLength = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }
      await collection.add({ data });
      return { success: true, message: '已添加' };
    }

    return { success: false, error: '未知的 action' };
  } catch (e) {
    console.error('addPeriod 失败', e);
    return { success: false, error: e.message };
  }
};

function formatStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

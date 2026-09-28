// cloudfunctions/clearAllData/index.js
// 清空当前用户的所有云端业务数据（按 OPENID 过滤）。
// food_library 仅删除当前用户自建部分（openid == OPENID），保留无 openid 的历史/公共数据。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 需要按当前用户 openid 清空的全部业务集合。
// food_library 特殊：存在无 openid 的历史/公共数据，同样只按 openid 精确匹配删除，
// 因此可以与其他集合共用 where({ openid }).remove() 逻辑。
const COLLECTIONS = [
  'weight_records',
  'diet_records',
  'exercises',
  'periods',
  'reports',
  'user_settings',
  'user_profiles',
  'weight_goals',
  'user_reminders',
  'food_library',
];

// 云函数单次 where().remove() 存在删除条数上限，循环删尽直到本次删除数为 0。
const MAX_LOOP = 100;

async function clearCollection(name, openid) {
  let total = 0;
  for (let i = 0; i < MAX_LOOP; i++) {
    let res;
    try {
      res = await db.collection(name).where({ openid }).remove();
    } catch (e) {
      // 集合不存在（-502005）视为已清空，返回 0 且不记为失败。
      if (e && (e.errCode === -502005 || /collection not exists/i.test(e.message || ''))) {
        return { deleted: total, skipped: 'collection-not-exists' };
      }
      throw e;
    }
    const deleted = (res && res.stats && res.stats.deleted) || 0;
    total += deleted;
    if (deleted === 0) break;
  }
  return { deleted: total };
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, error: '无法获取用户身份（OPENID 缺失）' };
  }

  const deleted = {};
  const failures = [];

  for (const name of COLLECTIONS) {
    try {
      const r = await clearCollection(name, OPENID);
      deleted[name] = r.deleted;
    } catch (e) {
      deleted[name] = 0;
      failures.push({ collection: name, error: (e && e.message) || String(e) });
    }
  }

  return {
    success: failures.length === 0,
    deleted,
    failures,
  };
};

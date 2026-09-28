// cloudfunctions/clearAllData/index.js
// 清空当前用户的所有云端业务数据（按 OPENID 过滤）。
// 删除条件同时匹配 openid 与 _openid 两个字段：
//   - 多数云函数写入使用显式 openid 字段；
//   - syncWeRunSteps 写入 exercises 使用 _openid 字段（微信运动自动步数记录）；
//   - 客户端直接写入的记录由云开发自动附加 _openid。
// food_library 仅删除当前用户自建部分：无 openid/_openid 的历史/公共数据两个条件都不匹配，天然保留。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 需要按当前用户 openid 清空的全部业务集合。
// food_library 特殊：存在无 openid 的历史/公共数据，删除条件按 openid/_openid 精确匹配，
// 无归属字段的历史数据不会被命中，因此可与其他集合共用同一删除逻辑。
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

// 当前用户的删除过滤条件：openid 或 _openid 命中即视为本人数据。
function ownerFilter(openid) {
  return _.or([{ openid }, { _openid: openid }]);
}

async function clearCollection(name, openid) {
  let total = 0;
  for (let i = 0; i < MAX_LOOP; i++) {
    let res;
    try {
      res = await db.collection(name).where(ownerFilter(openid)).remove();
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

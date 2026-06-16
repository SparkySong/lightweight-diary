// pages/achievements/achievements.js
const app = getApp();

const getInitTheme = () => {
  const themeSetting = wx.getStorageSync('appTheme') || 'system';
  if (themeSetting === 'system') {
    try {
      if (wx.getDeviceInfo && wx.getDeviceInfo().theme) return wx.getDeviceInfo().theme;
      if (wx.getSystemInfoSync && wx.getSystemInfoSync().theme) return wx.getSystemInfoSync().theme;
      return wx.getStorageSync('lastSystemTheme') || 'dark';
    } catch (e) { return 'dark'; }
  }
  return themeSetting;
};

// 预设徽章列表
const BADGES = [
  { badgeId: 'first_checkin', name: '初来乍到', icon: '🌟', desc: '首次打卡', target: 1, category: 'checkin' },
  { badgeId: 'checkin_3', name: '三日坚持', icon: '🔥', desc: '累计打卡3天', target: 3, category: 'checkin' },
  { badgeId: 'checkin_7', name: '一周达人', icon: '⚡', desc: '连续打卡7天', target: 7, category: 'checkin' },
  { badgeId: 'checkin_30', name: '月度之星', icon: '🌙', desc: '连续打卡30天', target: 30, category: 'checkin' },
  { badgeId: 'checkin_100', name: '百日征途', icon: '🏆', desc: '累计打卡100天', target: 100, category: 'checkin' },
  { badgeId: 'lose_3', name: '轻装上阵', icon: '🎈', desc: '减重3kg', target: 3, category: 'weight' },
  { badgeId: 'lose_5', name: '蜕变时刻', icon: '🦋', desc: '减重5kg', target: 5, category: 'weight' },
  { badgeId: 'lose_10', name: '焕然一新', icon: '✨', desc: '减重10kg', target: 10, category: 'weight' },
  { badgeId: 'diet_7', name: '饮食自律', icon: '🥗', desc: '连续7天记录饮食', target: 7, category: 'diet' },
  { badgeId: 'first_exercise', name: '运动先锋', icon: '💪', desc: '首次记录运动', target: 1, category: 'exercise' },
  { badgeId: 'steps_15k', name: '步数王者', icon: '👑', desc: '单日步数超过15000', target: 15000, category: 'steps' },
  { badgeId: 'calorie_7', name: '热量管家', icon: '📊', desc: '连续7天热量摄入在目标范围内', target: 7, category: 'calorie' }
];

Page({
  data: {
    currentTheme: getInitTheme(),
    badges: [],
    unlockedCount: 0,
    totalCount: BADGES.length,
    loading: true,
    // 解锁弹窗
    showUnlockPopup: false,
    unlockQueue: [],
    currentUnlock: null
  },

  onLoad() {
    this.initTheme();
    this.checkAchievements();
  },

  onShow() {
    this.initTheme();
  },

  initTheme() {
    const effectiveTheme = app.getEffectiveTheme();
    if (this.data.currentTheme !== effectiveTheme) {
      this.setData({ currentTheme: effectiveTheme });
    }
    wx.setNavigationBarColor({
      frontColor: effectiveTheme === 'light' ? '#000000' : '#ffffff',
      backgroundColor: effectiveTheme === 'light' ? '#F8FAF9' : '#121212',
      animation: { duration: 0, timingFunc: 'linear' }
    });
  },

  async checkAchievements() {
    this.setData({ loading: true });
    try {
      // 并行获取所有需要的数据
      const [recordsRes, dietRes, exerciseRes] = await Promise.allSettled([
        wx.cloud.callFunction({ name: 'getRecords', data: { range: 365 } }),
        wx.cloud.callFunction({ name: 'getDietRecords', data: {} }),
        wx.cloud.callFunction({ name: 'getExercises', data: { limit: 500 } })
      ]);

      const weightRecords = recordsRes.status === 'fulfilled' ? (recordsRes.value.result?.data || []) : [];
      const dietData = dietRes.status === 'fulfilled' ? (dietRes.value.result?.days || []) : [];
      const exerciseRecords = exerciseRes.status === 'fulfilled' ? (exerciseRes.value.result?.data || []) : [];

      const checkinDays = weightRecords.length;
      
      // 计算减重总量
      let totalWeightLoss = 0;
      if (weightRecords.length >= 2) {
        const sorted = [...weightRecords].sort((a, b) => a.date.localeCompare(b.date));
        totalWeightLoss = Math.round((sorted[0].weight - sorted[sorted.length - 1].weight) * 10) / 10;
      }

      // 计算饮食记录天数
      const dietDays = dietData.filter(d => d.records && d.records.length > 0).length;

      // 运动天数
      const exerciseDaysSet = new Set(exerciseRecords.map(e => e.date));
      const exerciseDays = exerciseDaysSet.size;

      // 最大单日步数
      let maxSteps = 0;
      exerciseRecords.filter(e => e.type === 'walking' && e.steps).forEach(e => {
        if (e.steps > maxSteps) maxSteps = e.steps;
      });

      // 检查每个徽章
      const badges = BADGES.map(badge => {
        let progress = 0;
        let unlocked = false;

        switch (badge.category) {
          case 'checkin':
            progress = Math.min(checkinDays, badge.target);
            unlocked = checkinDays >= badge.target;
            break;
          case 'weight':
            progress = Math.round(Math.min(Math.max(totalWeightLoss, 0), badge.target) * 10) / 10;
            unlocked = totalWeightLoss >= badge.target;
            break;
          case 'diet':
            progress = Math.min(dietDays, badge.target);
            unlocked = dietDays >= badge.target;
            break;
          case 'exercise':
            progress = exerciseDays > 0 ? 1 : 0;
            unlocked = exerciseDays > 0;
            break;
          case 'steps':
            progress = Math.min(maxSteps, badge.target);
            unlocked = maxSteps >= badge.target;
            break;
          case 'calorie':
            // 简化：如果有热量目标且有7天达标则解锁
            progress = 0;
            unlocked = false;
            break;
        }

        const progressPercent = badge.target > 0 ? Math.round((progress / badge.target) * 100) : 0;
        
        return {
          ...badge,
          unlocked,
          progress,
          progressPercent: Math.min(progressPercent, 100)
        };
      });

      const unlockedCount = badges.filter(b => b.unlocked).length;
      this.setData({ badges, unlockedCount, loading: false });

      // 检测新解锁的徽章并弹窗提示
      const prevUnlocked = wx.getStorageSync('unlockedBadges') || [];
      const newlyUnlocked = badges.filter(b => b.unlocked && !prevUnlocked.includes(b.badgeId));
      if (newlyUnlocked.length > 0) {
        // 保存当前解锁的徽章列表
        wx.setStorageSync('unlockedBadges', badges.filter(b => b.unlocked).map(b => b.badgeId));
        // 展示解锁弹窗
        this.setData({
          unlockQueue: newlyUnlocked,
          currentUnlock: newlyUnlocked[0],
          showUnlockPopup: true
        });
      } else {
        // 同步解锁列表
        wx.setStorageSync('unlockedBadges', badges.filter(b => b.unlocked).map(b => b.badgeId));
      }
    } catch (e) {
      console.error('检查成就失败', e);
      this.setData({ loading: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  // 关闭解锁弹窗
  onCloseUnlockPopup() {
    const queue = this.data.unlockQueue;
    if (queue.length > 1) {
      // 还有下一个解锁的徽章
      const next = queue.slice(1);
      this.setData({
        unlockQueue: next,
        currentUnlock: next[0]
      });
    } else {
      this.setData({
        showUnlockPopup: false,
        unlockQueue: [],
        currentUnlock: null
      });
    }
  }
});

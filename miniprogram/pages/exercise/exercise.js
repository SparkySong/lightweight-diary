// pages/exercise/exercise.js
const app = getApp();
const db = wx.cloud.database();

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

// 运动类型配置
const EXERCISE_TYPES = [
  { type: 'walking', label: '步行', icon: '🚶', met: 3.5 },
  { type: 'running', label: '跑步', icon: '🏃', met: 7.0 },
  { type: 'swimming', label: '游泳', icon: '🏊', met: 6.0 },
  { type: 'gym', label: '健身', icon: '💪', met: 5.0 },
  { type: 'cycling', label: '骑行', icon: '🚴', met: 5.5 },
  { type: 'yoga', label: '瑜伽', icon: '🧘', met: 2.5 },
  { type: 'other', label: '其他', icon: '⚡', met: 4.0 }
];

const formatDateStr = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

Page({
  data: {
    currentTheme: getInitTheme(),
    today: formatDateStr(new Date()),
    // 步数
    todaySteps: 0,
    stepCalories: 0,
    stepSyncing: false,
    stepSynced: false,
    stepSyncTime: '',
    // 运动记录
    exercises: [],
    groupedExercises: [],
    loading: true,
    // 今日热量汇总
    todayIntake: 0,
    todayBurn: 0,
    todayBalance: 0,
    // 添加运动弹窗
    showAddPopup: false,
    selectedType: null,
    inputDuration: '',
    inputCalories: '',
    exerciseTypes: EXERCISE_TYPES,
    // Toast
    toastMsg: '',
    toastShow: false
  },

  onLoad() {
    this.initTheme();
    this.loadAll();
  },

  onShow() {
    this.initTheme();
    // 每次回到页面时刷新步数
    if (!this.data.loading) {
      this.syncWeRunSteps();
    }
    // 启动定时自动刷新（每30秒同步一次步数）
    this._startStepAutoRefresh();
  },

  onHide() {
    this._stopStepAutoRefresh();
  },

  onUnload() {
    this._stopStepAutoRefresh();
  },

  _startStepAutoRefresh() {
    if (this._stepTimer) return;
    this._stepTimer = setInterval(() => {
      if (!this.data.stepSyncing) {
        this.syncWeRunSteps();
      }
    }, 30000); // 30秒自动刷新
  },

  _stopStepAutoRefresh() {
    if (this._stepTimer) {
      clearInterval(this._stepTimer);
      this._stepTimer = null;
    }
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

  async loadAll() {
    this.setData({ loading: true });
    try {
      await Promise.allSettled([
        this.syncWeRunSteps(),
        this.loadExercises(),
        this.loadTodayDiet()
      ]);
    } catch (e) {
      console.error('加载运动数据失败', e);
    }
    this.setData({ loading: false });
  },

  // 加载今日饮食热量
  async loadTodayDiet() {
    try {
      const today = this.data.today;
      const res = await wx.cloud.callFunction({
        name: 'getDietRecords',
        data: { date: today }
      });
      const records = res.result?.data || [];
      const totalCal = records.reduce((sum, r) => sum + (r.totalCal || r.calories || 0), 0);
      this.setData({ todayIntake: Math.round(totalCal) });
      this.calcBalance();
    } catch (e) {
      console.warn('加载饮食数据失败', e);
    }
  },

  // 加载运动记录
  async loadExercises() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getExercises',
        data: { limit: 100 }
      });
      const exercises = res.result?.data || [];
      this.setData({ exercises });
      this.groupExercises(exercises);
      this.calcTodayStats(exercises);
    } catch (e) {
      console.error('加载运动记录失败', e);
    }
  },

  // 计算今日运动消耗
  calcTodayStats(exercises) {
    const today = this.data.today;
    const todayExercises = exercises.filter(e => e.date === today);
    const todayBurn = todayExercises.reduce((sum, e) => sum + (e.calories || 0), 0);
    this.setData({ todayBurn });
    this.calcBalance();
  },

  calcBalance() {
    const { todayIntake, todayBurn } = this.data;
    const weightData = wx.getStorageSync('weightData') || {};
    const userHeight = wx.getStorageSync('userHeight') || 165;
    const userGender = wx.getStorageSync('userGender') || 'female';
    const weight = weightData.currentWeight || 60;
    // Mifflin-St Jeor公式: 男性+5, 女性-161
    const genderOffset = userGender === 'male' ? 5 : -161;
    const bmr = Math.round(10 * weight + 6.25 * userHeight - 5 * 25 + genderOffset);
    const totalBurn = bmr + Math.round(todayBurn);
    const balance = Math.round(todayIntake) - totalBurn;
    this.setData({ todayBalance: balance, todayBalanceAbs: Math.abs(balance), todayTotalBurn: totalBurn, bmr });
  },

  // 按日期分组
  groupExercises(exercises) {
    const groups = {};
    exercises.forEach(ex => {
      if (!groups[ex.date]) {
        groups[ex.date] = { date: ex.date, items: [], totalCal: 0 };
      }
      groups[ex.date].items.push(ex);
      groups[ex.date].totalCal += (ex.calories || 0);
    });
    const grouped = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
    this.setData({ groupedExercises: grouped });
  },

  // 同步微信步数
  async syncWeRunSteps() {
    if (this.data.stepSyncing) return;
    this.setData({ stepSyncing: true });

    try {
      // 检查是否已授权
      const setting = await wx.getSetting();
      const werunAuth = setting.authSetting['scope.werun'];

      if (werunAuth === false) {
        // 用户之前明确拒绝过，必须引导去设置页手动开启
        wx.showModal({
          title: '需要微信运动权限',
          content: '您之前拒绝了微信运动授权，需要手动开启才能同步步数。是否前往设置？',
          confirmText: '去设置',
          success: async (res) => {
            if (res.confirm) {
              try {
                await wx.openSetting();
                // 用户可能在设置页重新授权了，再尝试同步
                const newSetting = await wx.getSetting();
                if (newSetting.authSetting['scope.werun']) {
                  this.setData({ stepSyncing: false });
                  this.syncWeRunSteps();
                } else {
                  this.setData({ stepSyncing: false, stepSynced: true });
                }
              } catch (e) {
                this.setData({ stepSyncing: false, stepSynced: true });
              }
            } else {
              this.setData({ stepSyncing: false, stepSynced: true });
            }
          }
        });
        return;
      }

      if (!werunAuth) {
        // 未授权（首次），尝试请求授权
        try {
          await wx.authorize({ scope: 'scope.werun' });
        } catch (e) {
          console.log('用户拒绝微信运动授权');
          wx.showModal({
            title: '步数同步需要授权',
            content: '授权微信运动后可以自动同步每日步数。是否前往设置开启？',
            confirmText: '去设置',
            success: async (res) => {
              if (res.confirm) {
                try {
                  await wx.openSetting();
                  const newSetting = await wx.getSetting();
                  if (newSetting.authSetting['scope.werun']) {
                    this.setData({ stepSyncing: false });
                    this.syncWeRunSteps();
                  } else {
                    this.setData({ stepSyncing: false, stepSynced: true });
                  }
                } catch (e) {
                  this.setData({ stepSyncing: false, stepSynced: true });
                }
              } else {
                this.setData({ stepSyncing: false, stepSynced: true });
              }
            }
          });
          return;
        }
      }

      // 已授权，获取加密数据
      const weRunData = await wx.getWeRunData();
      console.log('[步数] 获取到微信运动加密数据');
      
      // 发送到云函数解密
      const res = await wx.cloud.callFunction({
        name: 'syncWeRunSteps',
        data: {
          encryptedData: weRunData.encryptedData,
          iv: weRunData.iv
        }
      });

      console.log('[步数] 云函数返回:', JSON.stringify(res.result));

      if (res.result?.success) {
        const steps = res.result.steps || 0;
        const calories = res.result.calories || 0;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        this.setData({
          todaySteps: steps,
          stepCalories: calories,
          stepSynced: true,
          stepSyncTime: timeStr + ' 已同步'
        });
        // 重新加载运动记录（云函数可能新增了步数记录）
        await this.loadExercises();
      } else {
        console.warn('同步步数失败:', res.result?.error);
        wx.showToast({ title: '步数同步失败', icon: 'none' });
        this.setData({ stepSynced: true });
      }
    } catch (e) {
      console.warn('同步步数失败', e);
      wx.showToast({ title: '步数同步异常', icon: 'none' });
      this.setData({ stepSynced: true });
    }
    this.setData({ stepSyncing: false });
  },

  // 打开添加运动弹窗
  onAddExercise() {
    this.setData({ showAddPopup: true, selectedType: null, inputDuration: '', inputCalories: '' });
  },

  onClosePopup() {
    this.setData({ showAddPopup: false });
  },

  onSelectType(e) {
    const type = e.currentTarget.dataset.type;
    const typeConfig = EXERCISE_TYPES.find(t => t.type === type);
    this.setData({ selectedType: type });
    // 自动估算卡路里
    if (this.data.inputDuration) {
      this.estimateCalories(type, parseFloat(this.data.inputDuration));
    }
  },

  onDurationInput(e) {
    this.setData({ inputDuration: e.detail.value });
    if (this.data.selectedType) {
      this.estimateCalories(this.data.selectedType, parseFloat(e.detail.value));
    }
  },

  onCaloriesInput(e) {
    this.setData({ inputCalories: e.detail.value });
  },

  // 估算卡路里消耗
  estimateCalories(type, duration) {
    if (!duration || duration <= 0) return;
    const typeConfig = EXERCISE_TYPES.find(t => t.type === type);
    if (!typeConfig) return;
    const weightData = wx.getStorageSync('weightData') || {};
    const weight = weightData.currentWeight || 60;
    // MET × 体重(kg) × 时间(小时)
    const hours = duration / 60;
    const estimated = Math.round(typeConfig.met * weight * hours);
    this.setData({ inputCalories: String(estimated) });
  },

  // 保存运动记录
  async onSaveExercise() {
    const { selectedType, inputDuration, inputCalories } = this.data;
    if (!selectedType) { this.showToast('请选择运动类型'); return; }
    const duration = parseFloat(inputDuration);
    if (!duration || duration <= 0) { this.showToast('请输入运动时长'); return; }
    const calories = parseFloat(inputCalories) || 0;
    if (calories <= 0) { this.showToast('请输入消耗卡路里'); return; }

    const typeConfig = EXERCISE_TYPES.find(t => t.type === selectedType);
    
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addExercise',
        data: {
          date: this.data.today,
          type: selectedType,
          typeLabel: typeConfig.label,
          duration: Math.round(duration),
          calories: Math.round(calories)
        }
      });
      wx.hideLoading();
      if (res.result?.success) {
        this.showToast(res.result.updated ? '已更新' : '已添加');
        this.setData({ showAddPopup: false });
        await this.loadExercises();
      } else {
        this.showToast(res.result?.error || '保存失败，请重试');
      }
    } catch (e) {
      wx.hideLoading();
      console.error('保存运动记录失败', e);
      this.showToast('保存失败，请检查网络');
    }
  },

  // 删除运动记录
  onDeleteExercise(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除该运动记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({ name: 'deleteExercise', data: { id } });
            this.showToast('已删除');
            await this.loadExercises();
          } catch (e) {
            this.showToast('删除失败');
          }
        }
      }
    });
  },

  // 手动刷新步数
  onRefreshSteps() {
    this.syncWeRunSteps();
  },

  // 阻止冒泡
  stopPropagation() {},

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  },

  goBack() {
    wx.navigateBack();
  }
});

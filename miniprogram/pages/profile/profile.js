// pages/profile/profile.js
const app = getApp();
const VERSION = '1.0.0';

// 默认头像 base64（灰色圆形占位图）
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI0MCIgZmlsbD0iIzNhM2E0YSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMzIiIHI9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PGVsbGlwc2UgY3g9IjQwIiBjeT0iNjgiIHJ4PSIyNCIgcnk9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PC9zdmc+';

// 🔑 关键修复：从存储获取当前生效的主题（用于 data 初始值，避免闪烁）
const getInitTheme = () => {
  const themeSetting = wx.getStorageSync('appTheme') || 'dark';
  if (themeSetting === 'system') {
    try {
      if (wx.getDeviceInfo && wx.getDeviceInfo().theme) {
        return wx.getDeviceInfo().theme;
      }
      if (wx.getSystemInfoSync && wx.getSystemInfoSync().theme) {
        return wx.getSystemInfoSync().theme;
      }
      return wx.getStorageSync('lastSystemTheme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  }
  return themeSetting;
};

const getInitThemeSetting = () => {
  return wx.getStorageSync('appTheme') || 'dark';
};

const getInitThemeDesc = () => {
  const t = getInitThemeSetting();
  if (t === 'system') return '跟随系统';
  if (t === 'dark') return '深色模式';
  return '浅色模式';
};

Page({
  data: {
    // 主题 - 🔑 关键：初始值从存储直接读取，避免闪烁
    currentTheme: getInitTheme(),
    themeSetting: getInitThemeSetting(),
    themeDesc: getInitThemeDesc(),
    // 用户信息
    nickname: '轻体用户',
    avatarUrl: DEFAULT_AVATAR,
    height: null,
    goalWeight: null,
    daysCount: 0,
    totalLost: '--',
    goalRemaining: '--',
    // 偏好
    weightUnit: 'kg',
    calorieUnit: 'kcal',
    calorieGoal: 0,
    calorieGoalDisplay: '未设置',
    // 版本号
    version: VERSION,
    // 弹窗控制
    showProfileEdit: false,
    showCalorieGoal: false,
    showPreferences: false,
    showThemeSetting: false,
    showDataManage: false,
    showAbout: false,
    showHelp: false,
    showAgreement: false,
    agreementTitle: '',
    agreementContent: '',
    // 编辑表单
    editNickname: '',
    editHeight: '',
    editCurrentWeight: '',
    editGoalWeight: '',
    editCalorieGoal: '',
    // Toast
    toastMsg: '',
    toastShow: false,
    // 昵称编辑
    showNicknameEdit: false,
    editNickname: '',
    // 防闪炃：主题切换后第一次切 tab 时短暂隐藏页面
    hidePage: false
  },

  onLoad() {
    // 接力主题切换的 loading 遮罩，覆盖 reLaunch 瓦解瞬间的系统壳层过渡帧
    if (wx.getStorageSync('pendingThemeToast')) {
      wx.showLoading({ title: '切换中...', mask: true });
      setTimeout(() => wx.hideLoading(), 250);
    }
    // 🔑 关键修复：立即同步设置主题，避免切换页面时闪炃
    this.initTheme();
    // 同步初始化基础数据（避免异步加载未完成时弹窗为空）
    this.initBasicData();
    // 异步加载完整数据（含云端同步）
    this.loadUserData();
  },

  // 同步初始化基础数据（立即可用，优先从本地读取避免闪烁）
  initBasicData() {
    const nickname = wx.getStorageSync('nickname') || '轻体用户';
    const avatarUrl = wx.getStorageSync('avatarUrl') || DEFAULT_AVATAR;
    const weightUnit = wx.getStorageSync('weightUnit') || 'kg';
    const calorieUnit = wx.getStorageSync('calorieUnit') || 'kcal';
    const KG_TO_JIN = 2;
    const weightData = wx.getStorageSync('weightData') || {};
    const goalWeightKg = weightData.targetWeight || null;
    const currentWeightKg = weightData.currentWeight || null;
    // 根据单位转换显示
    const goalWeight = goalWeightKg ? (weightUnit === 'jin' ? goalWeightKg * KG_TO_JIN : goalWeightKg) : null;
    const currentWeight = currentWeightKg ? (weightUnit === 'jin' ? currentWeightKg * KG_TO_JIN : currentWeightKg) : null;
    const height = wx.getStorageSync('userHeight') || null;

    // 🔑 优化：优先从本地缓存读取热量目标，避免"未设置→有数字"的闪烁
    const cachedCalorieGoal = wx.getStorageSync('localCalorieGoal') || 0;
    let calorieGoalDisplay = '未设置';
    if (cachedCalorieGoal > 0) {
      if (calorieUnit === 'kj') {
        calorieGoalDisplay = Math.round(cachedCalorieGoal * 4.184) + ' kJ';
      } else {
        calorieGoalDisplay = cachedCalorieGoal + ' kcal';
      }
    }

    this.setData({ nickname, avatarUrl, height, goalWeight, currentWeight, weightUnit, calorieUnit, calorieGoal: cachedCalorieGoal, calorieGoalDisplay });
    this.loadStats(goalWeightKg);
  },

  onShow() {
    this.initTheme();
    this.showPendingThemeToast(); // 显示 reLaunch 后的主题切换提示
    // 每次显示都同步刷新本地数据（确保其他页面修改后数据最新）
    this.initBasicData();
    // 异步从云端拉取最新数据更新
    this.loadUserData();
  },

  // 读取 reLaunch 前存入的主题切换提示并显示一次
  showPendingThemeToast() {
    const msg = wx.getStorageSync('pendingThemeToast');
    if (!msg) return;
    wx.removeStorageSync('pendingThemeToast');
    this.showToast(msg);
  },

  onTabItemTap() {
    this.initTheme();
  },

  // ========== 主题相关 ==========
  initTheme() {
    const themeSetting = wx.getStorageSync('appTheme') || 'dark';
    const effectiveTheme = app.getEffectiveTheme();
    const themeDesc = this.calcThemeDesc(themeSetting);
    if (
      this.data.currentTheme !== effectiveTheme ||
      this.data.themeSetting !== themeSetting ||
      this.data.themeDesc !== themeDesc
    ) {
      this.setData({ currentTheme: effectiveTheme, themeSetting, themeDesc });
      // 仅主题变化时才调用原生API
      this.setNavigationBarColor(effectiveTheme);
      this.setPullDownRefreshBg(effectiveTheme);
      app.applyThemeToTabBar();
    }
  },

  onThemeChange() {
    const themeSetting = wx.getStorageSync('appTheme') || 'dark';
    const effectiveTheme = app.getEffectiveTheme();
    const themeDesc = this.calcThemeDesc(themeSetting);
    this.setData({ currentTheme: effectiveTheme, themeSetting, themeDesc });
    this.setNavigationBarColor(effectiveTheme);
    this.setPullDownRefreshBg(effectiveTheme);
    // applyThemeToTabBar 由 applyThemeWithSystem 调用，此处不重复
  },

  // 设置状态栏颜色
  setNavigationBarColor(theme) {
    if (theme === 'light') {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#f8f9fa',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#0f0f13',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    }
  },

  // 设置下拉刷新背景色
  setPullDownRefreshBg(theme) {
    if (theme === 'light') {
      wx.setBackgroundColor({
        backgroundColor: '#f8f9fa',
        backgroundColorTop: '#f8f9fa',
        backgroundColorBottom: '#f8f9fa',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'dark'
      });
    } else {
      wx.setBackgroundColor({
        backgroundColor: '#0f0f13',
        backgroundColorTop: '#0f0f13',
        backgroundColorBottom: '#0f0f13',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'light'
      });
    }
  },

  calcThemeDesc(setting) {
    if (setting === 'system') return '跟随系统';
    if (setting === 'dark') return '深色模式';
    return '浅色模式';
  },

  // ========== 数据加载 ==========
  async loadUserData() {
    // 从本地存储加载用户设置
    const nickname = wx.getStorageSync('nickname') || '轻体用户';
    const weightUnit = wx.getStorageSync('weightUnit') || 'kg';
    const calorieUnit = wx.getStorageSync('calorieUnit') || 'kcal';
    const KG_TO_JIN = 2;

    // 从本地存储加载体重数据
    const weightData = wx.getStorageSync('weightData') || {};
    const goalWeightKg = weightData.targetWeight || null;
    // 根据单位转换显示
    const goalWeight = goalWeightKg ? (weightUnit === 'jin' ? goalWeightKg * KG_TO_JIN : goalWeightKg) : null;
    const height = wx.getStorageSync('userHeight') || null;

    // 同步云端身高数据到本地
    await this.syncAllFromCloud();

    // 从云端获取最新体重记录
    const latestWeightKg = await this.getLatestWeightFromCloud();
    let currentWeight = null;
    if (latestWeightKg !== null) {
      // 保存到本地存储
      const weightData = wx.getStorageSync('weightData') || {};
      weightData.currentWeight = latestWeightKg;
      wx.setStorageSync('weightData', weightData);
      // 根据单位转换显示
      currentWeight = weightUnit === 'jin' ? latestWeightKg * KG_TO_JIN : latestWeightKg;
    }

    // 从云端获取热量目标，优先使用本地缓存
    let calorieGoal = wx.getStorageSync('localCalorieGoal') || 0;
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserSettings', data: {} });
      const cloudCalorieGoal = res.result.settings?.dailyCalorieTarget || 0;
      if (cloudCalorieGoal > 0) {
        // 云端有数据：缓存到本地（下次直接读取）
        calorieGoal = cloudCalorieGoal;
        wx.setStorageSync('localCalorieGoal', cloudCalorieGoal);
      }
      // 如果云端返回 0 但本地有缓存值，保留本地缓存（避免闪烁回"未设置"）
    } catch (e) {
      console.warn('获取云端热量目标失败，使用本地缓存', e);
    }

    // 更新热量目标显示
    let calorieGoalDisplay = '未设置';
    if (calorieGoal > 0) {
      if (calorieUnit === 'kj') {
        calorieGoalDisplay = Math.round(calorieGoal * 4.184) + ' kJ';
      } else {
        calorieGoalDisplay = calorieGoal + ' kcal';
      }
    }

    // 重新从本地获取（可能刚被云端数据更新）
    const syncedHeight = wx.getStorageSync('userHeight') || height;

    // 加载统计数据（使用原始 kg 值计算）
    this.loadStats(goalWeightKg);

    this.setData({
      nickname,
      height: syncedHeight,
      goalWeight,
      currentWeight,
      weightUnit,
      calorieUnit,
      calorieGoal,
      calorieGoalDisplay
    });
  },

  // 从云端同步个人数据到本地
  async syncAllFromCloud() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getProfile' });
      const result = res.result || {};
      // 同步身高
      if (result.height) {
        wx.setStorageSync('userHeight', result.height);
      }
      // 同步目标体重
      if (result.goalWeight) {
        const weightData = wx.getStorageSync('weightData') || {};
        weightData.targetWeight = result.goalWeight;
        wx.setStorageSync('weightData', weightData);
      }
    } catch (e) {
      console.warn('从云端同步数据失败', e);
    }
  },

  // 从云端获取最新体重记录
  async getLatestWeightFromCloud() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getRecords', data: { range: 1 } });
      const records = res.result.data || [];
      if (records.length > 0) {
        // 返回最新的体重记录（按日期降序排列的第一条）
        return records[0].weight;
      }
      return null;
    } catch (e) {
      console.warn('从云端获取最新体重失败', e);
      return null;
    }
  },

loadStats(goalWeight) {
    // 尝试从云端获取记录来计算统计
    try {
      const localRecords = wx.getStorageSync('localRecords') || [];
      if (localRecords.length > 0) {
        this.calcStats(localRecords, goalWeight);
        return;
      }
    } catch (e) {
      console.warn('读取本地记录失败', e);
    }
    // 异步从云端加载
    this.loadCloudStats(goalWeight);
  },

  async loadCloudStats(goalWeight) {
    try {
      const res = await wx.cloud.callFunction({ name: 'getRecords', data: { range: 365 } });
      const records = res.result.data || [];
      if (records.length > 0) {
        this.calcStats(records, goalWeight);
      }
    } catch (e) {
      console.warn('从云端加载统计失败', e);
    }
  },

  calcStats(records, goalWeight) {
    const { weightUnit } = this.data;
    const KG_TO_JIN = 2;
    const unitLabel = weightUnit === 'kg' ? 'kg' : '斤';
    
    // 打卡天数
    const daysCount = records.length;

    // 已减重量（第一条记录 - 最后一条记录）
    let totalLost = '--';
    if (records.length >= 2) {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].weight;
      const last = sorted[sorted.length - 1].weight;
      let diff = first - last;
      // 根据单位转换
      if (weightUnit === 'jin') {
        diff = diff * KG_TO_JIN;
      }
      totalLost = Math.abs(diff).toFixed(1);
    }

    // 距目标还差多少
    let goalRemaining = '--';
    if (goalWeight && records.length > 0) {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const currentWeight = sorted[sorted.length - 1].weight;
      // goalWeight 和 currentWeight 都是 kg 值，直接计算后再转换
      let diff = currentWeight - goalWeight;
      if (weightUnit === 'jin') {
        diff = diff * KG_TO_JIN;
      }
      if (diff > 0) {
        goalRemaining = `还差 ${diff.toFixed(1)} ${unitLabel}`;
      } else {
        goalRemaining = '🎉 已达标！';
      }
    }

    this.setData({ daysCount, totalLost, goalRemaining });
  },

  // ========== 功能入口点击 ==========
  onProfileCardTap() {
    this.setData({
      showProfileEdit: true,
      editNickname: this.data.nickname,
      editHeight: this.data.height ? String(this.data.height) : '',
      editGoalWeight: this.data.goalWeight ? String(this.data.goalWeight) : ''
    });
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    wx.showLoading({ title: '上传中...' });
    
    const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
    
    wx.cloud.uploadFile({
      cloudPath,
      filePath: avatarUrl,
      success: (res) => {
        wx.setStorageSync('avatarUrl', res.fileID);
        this.setData({ avatarUrl: res.fileID });
      },
      fail: () => {
        wx.setStorageSync('avatarUrl', avatarUrl);
        this.setData({ avatarUrl });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 昵称输入完成
  onNicknameBlur(e) {
    const nickname = e.detail.value.trim();
    if (nickname && nickname !== this.data.nickname) {
      wx.setStorageSync('nickname', nickname);
      this.setData({ nickname });
    }
  },

  // 点击昵称区域
  onNicknameTap() {
    this.setData({
      showNicknameEdit: true,
      editNickname: this.data.nickname
    });
  },

  // 关闭昵称编辑
  onCloseNicknameEdit() {
    this.setData({ showNicknameEdit: false });
  },

  // 昵称编辑输入（使用 bindinput 实时同步，解决 iOS 上 blur 事件可能晚于按钮点击的问题）
  onEditNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  // 保存昵称
  onSaveNickname() {
    const nickname = this.data.editNickname.trim() || '轻体用户';
    wx.setStorageSync('nickname', nickname);
    this.setData({ nickname, showNicknameEdit: false });
  },

  onMenuItemTap(e) {
    const action = e.currentTarget.dataset.action;
    const { weightUnit } = this.data;
    const KG_TO_JIN = 2;
    
    switch (action) {
      case 'profile':
        // 目标体重需要根据单位转换显示
        let displayGoalWeight = '';
        let displayCurrentWeight = '';
        const weightData = wx.getStorageSync('weightData') || {};
        if (this.data.goalWeight) {
          const goalWeightKg = this.data.goalWeight;
          // 从存储中获取原始 kg 值
          const originalGoalKg = weightData.targetWeight || goalWeightKg;
          displayGoalWeight = weightUnit === 'jin' 
            ? String(originalGoalKg * KG_TO_JIN) 
            : String(this.data.goalWeight);
        }
        // 获取当前体重
        if (weightData.currentWeight) {
          displayCurrentWeight = weightUnit === 'jin' 
            ? String(weightData.currentWeight * KG_TO_JIN) 
            : String(weightData.currentWeight);
        }
        this.setData({
          showProfileEdit: true,
          editNickname: this.data.nickname,
          editHeight: this.data.height ? String(this.data.height) : '',
          editCurrentWeight: displayCurrentWeight,
          editGoalWeight: displayGoalWeight
        });
        break;
      case 'calorieGoal':
        this.setData({
          showCalorieGoal: true,
          editCalorieGoal: this.data.calorieGoal ? String(this.data.calorieGoal) : ''
        });
        break;
      case 'preferences':
        this.setData({ showPreferences: true });
        break;
      case 'theme':
        this.setData({ showThemeSetting: true });
        break;
      case 'dataManage':
        this.setData({ showDataManage: true });
        break;
      case 'help':
        this.setData({ showHelp: true });
        break;
      case 'about':
        this.setData({ showAbout: true });
        break;
    }
  },

  // ========== 弹窗操作 ==========
  onPopupOverlayTap() {
    this.closeAllPopups();
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  preventTouchMove() {
    // 阻止弹窗遮罩层滚动穿透
  },

  onClosePopup() {
    this.closeAllPopups();
  },

  closeAllPopups() {
    this.setData({
      showProfileEdit: false,
      showCalorieGoal: false,
      showPreferences: false,
      showThemeSetting: false,
      showDataManage: false,
      showAbout: false,
      showHelp: false,
      showAgreement: false
    });
  },

  // ========== 个人信息编辑 ==========
  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  onHeightInput(e) {
    this.setData({ editHeight: e.detail.value });
  },

  onGoalWeightInput(e) {
    this.setData({ editGoalWeight: e.detail.value });
  },

  onCurrentWeightInput(e) {
    this.setData({ editCurrentWeight: e.detail.value });
  },

  async onSaveProfile() {
    const { editNickname, editHeight, editCurrentWeight, editGoalWeight, weightUnit } = this.data;
    const KG_TO_JIN = 2;

    // 验证
    if (editNickname.trim()) {
      wx.setStorageSync('nickname', editNickname.trim());
    }
    if (editHeight) {
      const h = parseFloat(editHeight);
      if (h < 100 || h > 250) {
        this.showToast('身高范围 100-250cm');
        return;
      }
      wx.setStorageSync('userHeight', h);
      // 同步到云端
      try {
        await wx.cloud.callFunction({ name: 'setHeight', data: { height: h } });
      } catch (e) {
        console.warn('同步身高到云端失败', e);
      }
    }
    // 保存当前体重到云端
    if (editCurrentWeight) {
      let cw = parseFloat(editCurrentWeight);
      // 根据单位进行验证
      const minWeight = weightUnit === 'jin' ? 40 : 20;
      const maxWeight = weightUnit === 'jin' ? 600 : 300;
      if (cw < minWeight || cw > maxWeight) {
        this.showToast(`当前体重范围 ${minWeight}-${maxWeight}${weightUnit}`);
        return;
      }
      // 如果是斤，转换为千克存储
      if (weightUnit === 'jin') {
        cw = cw / KG_TO_JIN;
      }
      const weightKg = parseFloat(cw.toFixed(1));
      
      // 保存到本地
      const weightData = wx.getStorageSync('weightData') || {};
      weightData.currentWeight = weightKg;
      wx.setStorageSync('weightData', weightData);
      
      // 同步到云端作为体重记录
      try {
        const today = new Date().toISOString().split('T')[0];
        await wx.cloud.callFunction({ 
          name: 'addRecord', 
          data: { date: today, weight: weightKg } 
        });
      } catch (e) {
        console.warn('同步当前体重到云端失败', e);
      }
    }
    if (editGoalWeight) {
      let w = parseFloat(editGoalWeight);
      // 根据单位进行验证
      const minWeight = weightUnit === 'jin' ? 40 : 20;
      const maxWeight = weightUnit === 'jin' ? 600 : 300;
      if (w < minWeight || w > maxWeight) {
        this.showToast(`目标体重范围 ${minWeight}-${maxWeight}${weightUnit}`);
        return;
      }
      // 如果是斤，转换为千克存储
      if (weightUnit === 'jin') {
        w = w / KG_TO_JIN;
      }
      const weightData = wx.getStorageSync('weightData') || {};
      weightData.targetWeight = parseFloat(w.toFixed(1));
      wx.setStorageSync('weightData', weightData);
    }

    this.showToast('保存成功 ✅');
    this.closeAllPopups();
    this.loadUserData();
  },

  // ========== 热量目标 ==========
  onCalorieGoalInput(e) {
    this.setData({ editCalorieGoal: e.detail.value });
  },

  async onSaveCalorieGoal() {
    const val = parseInt(this.data.editCalorieGoal);
    if (!val || val < 200 || val > 10000) {
      this.showToast('热量范围 200-10000kcal');
      return;
    }
    try {
      await wx.cloud.callFunction({
        name: 'saveUserSettings',
        data: { dailyCalorieTarget: val }
      });
      // 🔑 保存成功后立即更新本地缓存
      wx.setStorageSync('localCalorieGoal', val);
      this.showToast('热量目标已设置 🔥');
    } catch (e) {
      console.error('保存热量目标失败', e);
      this.showToast('保存失败');
    }
    this.closeAllPopups();
    this.loadUserData();
  },

  // ========== 偏好设置 ==========
  onWeightUnitChange(e) {
    // 支持从 WXML 调用（有 event）和从 app.notifyWeightUnitChange 调用（无参数）
    let unit;
    if (e && e.currentTarget && e.currentTarget.dataset) {
      unit = e.currentTarget.dataset.unit;
    } else if (e && typeof e === 'string') {
      // 从 app.notifyWeightUnitChange 调用时传入单位字符串
      unit = e;
    }
    
    if (!unit) return;
    
    wx.setStorageSync('weightUnit', unit);
    this.setData({ weightUnit: unit });
    // 刷新页面数据
    this.loadUserData();
    this.showToast(unit === 'kg' ? '已切换为千克' : '已切换为斤');
  },

  onCalorieUnitChange(e) {
    const unit = e.currentTarget.dataset.unit;
    wx.setStorageSync('calorieUnit', unit);
    this.setData({ calorieUnit: unit });
    this.showToast(unit === 'kcal' ? '已切换为千卡' : '已切换为千焦');
    // 刷新显示
    this.loadUserData();
  },

  // ========== 主题设置 ==========
  onSwitchTheme(e) {
    const theme = e.currentTarget.dataset.theme;

    if (theme === 'system') {
      const savedTheme = wx.getStorageSync('lastSystemTheme');
      if (!savedTheme) {
        wx.showModal({
          title: '选择当前系统主题',
          content: '您的微信版本暂不支持自动检测主题，请确认当前是深色还是浅色模式？',
          confirmText: '🌙 深色',
          cancelText: '☀️ 浅色',
          success: (res) => {
            const systemTheme = res.confirm ? 'dark' : 'light';
            this.applyThemeWithSystem(theme, systemTheme);
          }
        });
        return;
      }
    }

    this.applyThemeWithSystem(theme, theme === 'system' ? app.getSystemTheme() : theme);
  },

  applyThemeWithSystem(themeSetting, effectiveTheme) {
    wx.setStorageSync('appTheme', themeSetting);
    app.globalData.theme = themeSetting;

    if (themeSetting === 'system') {
      app.setSystemTheme(effectiveTheme);
    }

    this.setData({
      currentTheme: effectiveTheme,
      themeSetting: themeSetting,
      themeDesc: this.calcThemeDesc(themeSetting),
      showThemeSetting: false
    });

    app.applyThemeToTabBar();
    app.notifyThemeChange(effectiveTheme);

    // 记录切换后的提示文案，reLaunch 后由新页面读取并显示
    let toastMsg = '';
    if (themeSetting === 'system') toastMsg = '已切换到跟随系统 📱';
    else if (themeSetting === 'dark') toastMsg = '切换到深色模式 🌙';
    else toastMsg = '切换到浅色模式 ☀️';
    wx.setStorageSync('pendingThemeToast', toastMsg);

    // 显示 loading 遮罩 → reLaunch 到当前 tab，彻底重置所有 tab 的 WebView，消除闪炃
    wx.showLoading({ title: '切换中...', mask: true });
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/profile/profile',
        complete: () => {
          wx.hideLoading();
        }
      });
    }, 250);
  },

  // ========== 数据管理 ==========
  onViewHistory() {
    this.closeAllPopups();
    wx.switchTab({ url: '/pages/index/index' });
  },

  onClearAllData() {
    this.closeAllPopups();
    wx.showModal({
      title: '⚠️ 危险操作',
      content: '清空所有数据后将无法恢复，包括所有打卡记录、饮食记录和个人设置。确定要清空吗？',
      confirmText: '确定清空',
      confirmColor: '#e17055',
      cancelText: '再想想',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清空中...' });
          try {
            // 清空云端数据
            try {
              await wx.cloud.callFunction({ name: 'clearAllData' });
            } catch (e) {
              console.warn('清空云端数据失败', e);
            }

            // 清空本地存储
            wx.removeStorageSync('localRecords');
            wx.removeStorageSync('weightData');
            wx.removeStorageSync('nickname');
            wx.removeStorageSync('userHeight');
            wx.removeStorageSync('calorieGoal');
            wx.removeStorageSync('localCalorieGoal');
            // 保留主题和单位设置
            const appTheme = wx.getStorageSync('appTheme');
            const weightUnit = wx.getStorageSync('weightUnit');
            const calorieUnit = wx.getStorageSync('calorieUnit');

            wx.clearStorageSync();

            // 恢复需要保留的设置
            if (appTheme) wx.setStorageSync('appTheme', appTheme);
            if (weightUnit) wx.setStorageSync('weightUnit', weightUnit);
            if (calorieUnit) wx.setStorageSync('calorieUnit', calorieUnit);

            wx.hideLoading();
            this.showToast('数据已清空 🗑️');
            this.loadUserData();
          } catch (e) {
            wx.hideLoading();
            this.showToast('清空失败');
          }
        }
      }
    });
  },

  // ========== 帮助与反馈 ==========
  // (弹窗内容已在内嵌 WXML 中)

  // ========== 关于 ==========
  // (弹窗内容已在内嵌 WXML 中)

  // ========== 协议 ==========
  onLinkTap(e) {
    const type = e.currentTarget.dataset.url;
    let title = '';
    let content = '';

    if (type === 'agreement') {
      title = '用户协议';
      content = '一、服务条款\n\n欢迎使用轻体打卡小程序（以下简称"本小程序"）。在使用本小程序前，请您仔细阅读以下服务条款。\n\n1. 服务说明\n本小程序为用户提供体重记录、饮食记录、热量分析等健康管理辅助工具。所有数据仅供参考，不构成任何医疗建议。\n\n2. 用户责任\n用户应对自己输入的数据准确性负责。本小程序不会对用户因使用本服务而产生的任何直接或间接损失承担责任。\n\n3. 数据安全\n我们重视您的隐私保护，所有个人数据均通过微信云开发安全存储，我们不会向第三方泄露您的个人信息。\n\n4. 服务变更\n我们保留随时修改或中断服务的权利，恕不另行通知。\n\n5. 免责声明\n本小程序提供的热量数据、BMI计算等仅供参考，不能替代专业医疗或营养建议。如有健康问题，请咨询专业医生。\n\n二、知识产权\n\n本小程序的所有内容，包括但不限于文字、图片、代码、界面设计等，均受知识产权法保护，未经授权不得复制或使用。\n\n三、适用法律\n\n本协议适用中华人民共和国法律。如发生争议，双方应友好协商解决。';
    } else {
      title = '隐私政策';
      content = '轻体打卡小程序隐私政策\n\n生效日期：2026年4月13日\n\n我们非常重视您的隐私保护。本隐私政策说明我们如何收集、使用和保护您的个人信息。\n\n一、信息收集\n我们收集的信息包括您主动输入的数据和授权获取的信息：\n\n1. 您主动输入的数据：\n- 体重记录数据\n- 饮食记录数据\n- 身高、目标体重等个人健康信息\n\n2. 授权获取的信息：\n- 微信昵称：通过微信官方提供的昵称填写组件获取，用于在个人主页展示您的昵称，便于识别和个性化体验\n- 微信头像：通过微信官方提供的头像选择组件获取，用于在个人主页展示您的头像，提升使用体验\n\n上述微信昵称和头像的获取均通过微信官方能力实现，您可以在授权时自主选择是否提供。我们不会在未经您同意的情况下获取上述信息。\n\n二、信息使用\n您的信息仅用于以下目的：\n- 提供体重趋势分析和饮食热量分析功能\n- 保存和展示您的健康数据\n- 在个人主页展示您的昵称和头像，提供个性化体验\n- 改善产品体验\n\n三、信息存储\n您的数据通过微信云开发安全存储，采用加密传输和存储技术，确保数据安全。\n\n四、信息共享\n我们不会将您的个人信息出售、出租或以任何方式分享给第三方，除非：\n- 获得您的明确同意\n- 法律法规要求\n\n五、信息删除\n您可以随时通过"数据管理"功能清空您的所有数据。您也可以在个人信息设置中修改或更换昵称和头像。卸载小程序后，云端数据将依据微信云开发的数据保留策略处理。\n\n六、未成年人保护\n我们不对未成年人提供独立服务。如果您是未成年人，请在监护人指导下使用本小程序。\n\n七、政策更新\n我们可能会不定期更新本隐私政策，更新后将在小程序内通知您。';
    }

    this.setData({
      showAgreement: true,
      agreementTitle: title,
      agreementContent: content
    });
  },

  // ========== Toast ==========
  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  }
});

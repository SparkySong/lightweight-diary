// pages/profile/profile.js
const app = getApp();
const VERSION = '1.0.0';

Page({
  data: {
    // 主题
    currentTheme: app.globalData.theme || 'dark',
    themeSetting: (function() { const t = wx.getStorageSync('appTheme'); return t || 'dark'; })(),
    themeDesc: (function() { const t = wx.getStorageSync('appTheme') || 'dark'; if (t === 'system') return '跟随系统'; if (t === 'dark') return '深色模式'; return '浅色模式'; })(),
    // 用户信息
    nickname: '轻体用户',
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
    editGoalWeight: '',
    editCalorieGoal: '',
    // Toast
    toastMsg: '',
    toastShow: false
  },

  onLoad() {
    this.initTheme();
    // 同步初始化基础数据（避免异步加载未完成时弹窗为空）
    this.initBasicData();
    // 异步加载完整数据（含云端同步）
    this.loadUserData();
  },

  // 同步初始化基础数据（立即可用）
  initBasicData() {
    const nickname = wx.getStorageSync('nickname') || '轻体用户';
    const weightUnit = wx.getStorageSync('weightUnit') || 'kg';
    const calorieUnit = wx.getStorageSync('calorieUnit') || 'kcal';
    const weightData = wx.getStorageSync('weightData') || {};
    const goalWeight = weightData.targetWeight || null;
    const height = wx.getStorageSync('userHeight') || null;
    // 热量目标暂不设置，等云端返回后再更新
    this.setData({ nickname, height, goalWeight, weightUnit, calorieUnit, calorieGoal: 0, calorieGoalDisplay: '未设置' });
    this.loadStats(goalWeight);
  },

  onShow() {
    this.initTheme();
    // 每次显示都同步刷新本地数据（确保其他页面修改后数据最新）
    this.initBasicData();
    // 异步从云端拉取最新数据更新
    this.loadUserData();
  },

  // ========== 主题相关 ==========
  initTheme() {
    const themeSetting = wx.getStorageSync('appTheme') || 'dark';
    const effectiveTheme = app.getEffectiveTheme();
    const themeDesc = this.calcThemeDesc(themeSetting);
    this.setData({ currentTheme: effectiveTheme, themeSetting, themeDesc });
    app.applyThemeToTabBar();
  },

  onThemeChange() {
    const themeSetting = wx.getStorageSync('appTheme') || 'dark';
    const effectiveTheme = app.getEffectiveTheme();
    const themeDesc = this.calcThemeDesc(themeSetting);
    this.setData({ currentTheme: effectiveTheme, themeSetting, themeDesc });
    app.applyThemeToTabBar();
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

    // 从本地存储加载体重数据
    const weightData = wx.getStorageSync('weightData') || {};
    const goalWeight = weightData.targetWeight || null;
    const height = wx.getStorageSync('userHeight') || null;

    // 同步云端身高数据到本地
    await this.syncAllFromCloud();

    // 从云端获取热量目标
    let calorieGoal = 0;
    try {
      const res = await wx.cloud.callFunction({ name: 'getUserSettings', data: {} });
      calorieGoal = res.result.settings?.dailyCalorieTarget || 0;
    } catch (e) {
      console.warn('获取云端热量目标失败', e);
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

    // 加载统计数据
    this.loadStats(goalWeight);

    this.setData({
      nickname,
      height: syncedHeight,
      goalWeight,
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
    // 打卡天数
    const daysCount = records.length;

    // 已减重量（第一条记录 - 最后一条记录）
    let totalLost = '--';
    if (records.length >= 2) {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0].weight;
      const last = sorted[sorted.length - 1].weight;
      const diff = first - last;
      if (diff > 0) {
        totalLost = diff.toFixed(1);
      } else {
        totalLost = diff.toFixed(1);
      }
    }

    // 距目标还差多少
    let goalRemaining = '--';
    if (goalWeight && records.length > 0) {
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
      const currentWeight = sorted[sorted.length - 1].weight;
      const diff = currentWeight - goalWeight;
      if (diff > 0) {
        goalRemaining = diff.toFixed(1);
      } else {
        goalRemaining = '0';
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

  onMenuItemTap(e) {
    const action = e.currentTarget.dataset.action;
    switch (action) {
      case 'profile':
        this.setData({
          showProfileEdit: true,
          editNickname: this.data.nickname,
          editHeight: this.data.height ? String(this.data.height) : '',
          editGoalWeight: this.data.goalWeight ? String(this.data.goalWeight) : ''
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

  async onSaveProfile() {
    const { editNickname, editHeight, editGoalWeight } = this.data;

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
    if (editGoalWeight) {
      const w = parseFloat(editGoalWeight);
      if (w < 20 || w > 300) {
        this.showToast('体重范围 20-300kg');
        return;
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
    const unit = e.currentTarget.dataset.unit;
    wx.setStorageSync('weightUnit', unit);
    this.setData({ weightUnit: unit });
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

    let toastMsg = '';
    if (themeSetting === 'system') toastMsg = '已切换到跟随系统 📱';
    else if (themeSetting === 'dark') toastMsg = '切换到深色模式 🌙';
    else toastMsg = '切换到浅色模式 ☀️';
    this.showToast(toastMsg);
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
      content = '轻体打卡小程序隐私政策\n\n生效日期：2025年1月1日\n\n我们非常重视您的隐私保护。本隐私政策说明我们如何收集、使用和保护您的个人信息。\n\n一、信息收集\n我们收集的信息仅限于您主动输入的数据，包括：\n- 体重记录数据\n- 饮食记录数据\n- 身高、目标体重等个人健康信息\n- 昵称等基本信息\n\n二、信息使用\n您的信息仅用于以下目的：\n- 提供体重趋势分析和饮食热量分析功能\n- 保存和展示您的健康数据\n- 改善产品体验\n\n三、信息存储\n您的数据通过微信云开发安全存储，采用加密传输和存储技术，确保数据安全。\n\n四、信息共享\n我们不会将您的个人信息出售、出租或以任何方式分享给第三方，除非：\n- 获得您的明确同意\n- 法律法规要求\n\n五、信息删除\n您可以随时通过"数据管理"功能清空您的所有数据。卸载小程序后，云端数据将依据微信云开发的数据保留策略处理。\n\n六、未成年人保护\n我们不对未成年人提供独立服务。如果您是未成年人，请在监护人指导下使用本小程序。\n\n七、政策更新\n我们可能会不定期更新本隐私政策，更新后将在小程序内通知您。';
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

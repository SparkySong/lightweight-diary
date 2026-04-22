// pages/index/index.js
const db = wx.cloud.database();
const _ = db.command;

const app = getApp();

// 分页配置
const PAGE_SIZE = 15;

// 体重单位转换常量
const KG_TO_JIN = 2; // 1kg = 2斤

// 🔑 关键修复：从存储获取当前生效的主题（用于 data 初始值，避免闪烁）
const getInitTheme = () => {
  const themeSetting = wx.getStorageSync('appTheme') || 'dark';
  if (themeSetting === 'system') {
    // 跟随系统模式时，尝试获取系统主题
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

Page({
  data: {
    records: [],
    currentWeight: '--',
    lastChange: '',
    lastChangeClass: 'neutral',
    totalLost: '--',
    totalLostColor: '#e8e8ef',
    daysCount: 0,
    goalWeight: null,
    goalRemaining: '',
    goalProgress: 0,
    goalReached: false,
    inputDate: '',
    inputWeight: '',
    inputGoal: '',
    showGoalInput: false,
    streak: 0,
    chartRange: 7,
    chartWidth: 340,
    chartHeight: 200,
    toastMsg: '',
    toastShow: false,
    // BMI
    height: null,
    showHeightInput: false,
    inputHeight: '',
    bmiValue: '--',
    bmiCategory: '',
    bmiColor: '#8888a0',
    bmiBgColor: '#8888a0',
    bmiIndicatorLeft: 0,
    bmiIndicatorStyle: '',
    // Progress width
    goalProgressWidth: 0,
    // Reminder
    reminderEnabled: false,
    remindTime: '08:00',
    // 主题相关 - 🔑 关键：初始值从存储直接读取，避免闪烁
    currentTheme: getInitTheme(),
    currentThemeSetting: getInitThemeSetting(),
    themeColors: null,
    showThemeMenu: false,
    // 下拉刷新
    refreshing: false,
    // 云端状态
    cloudReady: false,
    cloudError: false,
    errorMsg: '',
    // 编辑记录相关
    showEditPanel: false,
    editRecordId: '',
    editDate: '',
    editWeight: '',
    // 分页加载相关
    allRecords: [],           // 存储所有记录
    displayedRecords: [],     // 当前显示的记录
    hasMoreRecords: true,     // 是否有更多记录
    isLoadingMore: false,     // 是否正在加载更多
    pageSize: PAGE_SIZE,      // 每页加载数量
    // 体重弹框相关
    weightPopupShow: false,
    weightPopupType: 'current', // 'current' 或 'target'
    weightInputValue: '',
    weightPopupError: '',
    // 体重单位相关
    weightUnit: 'kg',         // 当前体重单位设置
    weightUnitLabel: 'kg',    // 显示用的单位标签
    // 导航栏胶囊按钮适配
    navBarRightPadding: 0,    // 胶囊按钮右侧安全距离
    statusBarHeight: 0,       // 状态栏高度
  },

  onLoad() {
    // 🔑 关键修复：立即同步设置主题，避免切换页面时闪烁
    this.setTodayDate();
    this.initWeightUnit();
    this.initNavBarPadding();  // 计算胶囊按钮安全距离
    this.initTheme(); // 在数据加载前立即初始化主题
    // 数据加载放在主题初始化之后，不阻塞主题渲染
    this.loadAll();
  },

  onShow() {
    // 🔑 关键修复：立即同步刷新主题，再加载数据
    this.initWeightUnit();
    this.initTheme(); // 在数据加载前立即同步主题
    this.loadAll();
  },

  onTabItemTap() {
    this.initTheme();
  },
  
  // 初始化体重单位
  initWeightUnit() {
    const weightUnit = app.getWeightUnit();
    const weightUnitLabel = weightUnit === 'kg' ? 'kg' : '斤';
    this.setData({ weightUnit, weightUnitLabel });
  },

  // 初始化导航栏胶囊按钮安全距离（防止被胶囊按钮遮挡）
  initNavBarPadding() {
    try {
      // 获取系统信息
      const systemInfo = wx.getSystemInfoSync();
      let statusBarHeight = systemInfo.statusBarHeight || 0;

      // 获取胶囊按钮位置信息
      if (wx.getMenuButtonBoundingClientRect) {
        const menuButton = wx.getMenuButtonBoundingClientRect();
        if (menuButton && menuButton.width) {
          // 计算右侧安全距离 = 屏幕宽度 - 胶囊按钮右边界
          const screenWidth = systemInfo.screenWidth;
          // 胶囊按钮右边界到屏幕右侧的距离，再加上一些额外间距
          const navBarRightPadding = (screenWidth - menuButton.right) + 16; // 额外16rpx(约8px)的安全间距
          
          this.setData({
            statusBarHeight,
            navBarRightPadding: Math.max(navBarRightPadding, 20) // 最小保证20px
          });
        }
      } else {
        // 兜底：使用默认值
        this.setData({
          statusBarHeight,
          navBarRightPadding: 20
        });
      }
    } catch (e) {
      console.warn('获取胶囊按钮信息失败:', e);
      this.setData({
        navBarRightPadding: 20,
        statusBarHeight: 0
      });
    }
  },
  
  // 体重单位变化回调（从偏好设置页面切换后调用）
  onWeightUnitChange(unit) {
    if (!unit) return;
    // 先同步存储中的设置
    app.globalData.weightUnit = unit;
    const weightUnitLabel = unit === 'kg' ? 'kg' : '斤';
    this.setData({ weightUnit: unit, weightUnitLabel });
    // 重新加载所有数据以刷新显示
    this.loadAll();
  },

  setTodayDate() {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({ inputDate: date });
  },

  async loadAll() {
    wx.showLoading({ title: '加载中...' });
    try {
      // 重置状态
      this.setData({ cloudReady: false, cloudError: false, errorMsg: '' });
      
      // 使用 allSettled 代替 all，确保一个失败不会影响其他
      const results = await Promise.allSettled([
        this.loadRecords(),
        this.loadGoal(),
        this.loadProfile()
      ]);
      
      // 检查是否有成功的结果
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      const totalCount = results.length;
      
      if (successCount === totalCount) {
        // 所有云函数调用都成功
        this.setData({ cloudReady: true, cloudError: false });
      } else if (successCount > 0) {
        // 部分成功
        this.setData({ 
          cloudReady: true, 
          cloudError: true,
          errorMsg: `部分数据加载失败 (${totalCount - successCount}/${totalCount})`
        });
      } else {
        // 全部失败
        this.setData({ 
          cloudReady: false, 
          cloudError: true,
          errorMsg: '云服务连接失败，请检查云函数部署状态'
        });
        console.warn('所有云函数调用都失败了');
        
        // 尝试使用本地存储
        const localRecords = wx.getStorageSync('localRecords') || [];
        const localGoal = wx.getStorageSync('localGoal');
        const localProfile = wx.getStorageSync('localProfile') || { height: null, reminder: { enabled: false, remindTime: '08:00' }};
        const { weightUnit } = this.data;
        
        if (localRecords.length > 0) {
          // 对本地记录进行单位转换
          const formattedRecords = this.formatRecordsForDisplay(localRecords, weightUnit);
          this.setData({ records: formattedRecords, allRecords: formattedRecords });
          this.updateStats(formattedRecords);
          this.calcStreak(formattedRecords);
          this.drawChart(formattedRecords);
        }
        if (localGoal) {
          // 目标体重也需要转换
          const displayGoal = weightUnit === 'jin' ? localGoal * KG_TO_JIN : localGoal;
          this.setData({ goalWeight: displayGoal, showGoalInput: false });
          this.updateGoalProgress(displayGoal);
        }
        this.setData({
          height: localProfile.height,
          showHeightInput: !localProfile.height,
          reminderEnabled: localProfile.reminder.enabled,
          remindTime: localProfile.reminder.remindTime
        });
        this.calcBMI();
      }
    } catch (e) {
      console.error('loadAll 错误:', e);
      this.setData({ 
        cloudReady: false, 
        cloudError: true,
        errorMsg: '加载数据时发生错误'
      });
    }
    wx.hideLoading();
  },

  async loadRecords() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { range: this.data.chartRange }
      });
      let allRecords = res.result.data || [];
      
      // 根据体重单位转换显示值
      const { weightUnit } = this.data;
      allRecords = this.formatRecordsForDisplay(allRecords, weightUnit);
      
      // 初始化分页数据
      const displayedRecords = allRecords.slice(0, PAGE_SIZE);
      const hasMoreRecords = allRecords.length > PAGE_SIZE;
      
      this.setData({ 
        records: displayedRecords,
        allRecords: allRecords,
        displayedRecords: displayedRecords,
        hasMoreRecords: hasMoreRecords,
        isLoadingMore: false
      });
      
      this.updateStats(displayedRecords);
      this.drawChart(allRecords);
      this.calcStreak(allRecords);
      // 确保 BMI 在数据设置完成后计算
      this.calcBMI();
    } catch (e) {
      console.error('加载记录失败', e);
    }
  },
  
  // 格式化记录用于显示（根据体重单位转换）
  formatRecordsForDisplay(records, weightUnit) {
    const isJin = weightUnit === 'jin';
    return records.map(record => {
      // 确保转换为数字类型
      const originalWeight = parseFloat(record.weight);
      // 转换为显示用的单位
      const displayWeight = isJin ? originalWeight * KG_TO_JIN : originalWeight;
      // diff 也需要转换单位
      const displayDiff = (record.diff !== undefined && record.diff !== null)
        ? (isJin ? record.diff * KG_TO_JIN : record.diff)
        : undefined;
      return {
        ...record,
        originalWeight: originalWeight,  // 保留原始 kg 值
        weight: displayWeight,  // 数值类型，用于统计计算
        weightStr: displayWeight.toFixed(1),  // 字符串类型，用于显示
        displayWeight: displayWeight.toFixed(1),
        displayDiff: displayDiff,  // 转换后的 diff
        dateStr: record.date
      };
    });
  },
  
  // 加载更多记录
  loadMoreRecords() {
    if (this.data.isLoadingMore || !this.data.hasMoreRecords) {
      return;
    }

    this.setData({ isLoadingMore: true });

    const currentLength = this.data.displayedRecords.length;
    const allRecords = this.data.allRecords;
    const nextPage = allRecords.slice(currentLength, currentLength + PAGE_SIZE);
    
    if (nextPage.length === 0) {
      this.setData({ 
        hasMoreRecords: false,
        isLoadingMore: false 
      });
      return;
    }

    const newDisplayedRecords = [...this.data.displayedRecords, ...nextPage];
    const hasMoreRecords = newDisplayedRecords.length < allRecords.length;

    this.setData({
      records: newDisplayedRecords,
      displayedRecords: newDisplayedRecords,
      hasMoreRecords: hasMoreRecords,
      isLoadingMore: false
    });
    
    this.updateStats(newDisplayedRecords);
  },

  // 滚动到底部触发加载更多
  onRecordsScrollToLower() {
    this.loadMoreRecords();
  },

  async loadGoal() {
    const { weightUnit } = this.data;
    try {
      // 先从本地存储获取目标体重
      const weightData = wx.getStorageSync('weightData') || {};
      let goal = weightData.targetWeight || null;
      
      // 如果本地没有，尝试从云端获取
      if (!goal) {
        const res = await wx.cloud.callFunction({ name: 'getGoal' });
        goal = res.result.goal;
      }
      
      if (goal) {
        // 确保保留一位小数并同步到本地存储
        goal = parseFloat(parseFloat(goal).toFixed(1));
        weightData.targetWeight = goal;
        wx.setStorageSync('weightData', weightData);
        
        // 根据单位转换显示
        const displayGoal = weightUnit === 'jin' ? goal * KG_TO_JIN : goal;
        this.setData({ goalWeight: displayGoal, showGoalInput: false });
        this.updateGoalProgress(displayGoal); // 使用转换后的值（与 records 单位一致）
      } else {
        this.setData({ goalWeight: null, showGoalInput: true, goalRemaining: '未设置', goalProgress: 0 });
      }
    } catch (e) {
      console.error('加载目标失败', e);
    }
  },

  async loadProfile() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getProfile' });
      const { height, reminder } = res.result;
      this.setData({
        height: height,
        showHeightInput: !height,
        reminderEnabled: reminder.enabled,
        remindTime: reminder.remindTime
      });
      this.calcBMI();
    } catch (e) {
      console.error('加载资料失败', e);
    }
  },

  // --- BMI ---
  calcBMI() {
    // 使用 allRecords 获取完整数据（包括 originalWeight）
    const { height, allRecords } = this.data;
    const records = allRecords && allRecords.length > 0 ? allRecords : this.data.records;
    
    if (!height || !records || records.length === 0) {
      this.setData({ 
        bmiValue: '--', 
        bmiCategory: '请设置身高', 
        bmiColor: '#8888a0', 
        bmiBgColor: '#8888a0',
        bmiIndicatorLeft: 0,
        bmiIndicatorStyle: 'left: 0%;'
      });
      return;
    }
    
    // 获取最新体重
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];
    
    // 获取千克值 - 优先使用 originalWeight
    let w;
    if (latest.originalWeight !== undefined) {
      // 已经转换过，originalWeight 是原始千克值
      w = parseFloat(latest.originalWeight);
    } else {
      // 未转换的情况，从存储获取原始 kg 值
      const weightUnit = wx.getStorageSync('weightUnit') || 'kg';
      // records 中的 weight 可能是显示值，需要转回 kg
      const displayWeight = parseFloat(latest.weight);
      w = weightUnit === 'jin' ? displayWeight / KG_TO_JIN : displayWeight;
    }
    
    const h = height / 100;
    const bmi = (w / (h * h)).toFixed(1);
    // 计算 BMI 指示器位置 (0-40 范围)
    const bmiIndicatorLeft = Math.min(Math.max((bmi / 40) * 100, 0), 100);

    const isDark = this.data.currentTheme === 'dark';
    let category, color, bgColor;
    if (bmi < 18.5) { 
      category = '偏瘦'; 
      color = isDark ? '#6B7280' : '#868E96'; 
      bgColor = isDark ? 'rgba(107, 114, 128, 0.2)' : 'rgba(134, 142, 150, 0.15)';
    }
    else if (bmi < 24) { 
      category = '正常'; 
      color = isDark ? '#5FA895' : '#4A9B8A'; 
      bgColor = isDark ? 'rgba(95, 168, 149, 0.2)' : 'rgba(74, 155, 138, 0.15)';
    }
    else if (bmi < 28) { 
      category = '偏胖'; 
      color = isDark ? '#D4A574' : '#C49A6C'; 
      bgColor = isDark ? 'rgba(212, 165, 116, 0.2)' : 'rgba(196, 154, 108, 0.15)';
    }
    else { 
      category = '肥胖'; 
      color = isDark ? '#C98B8B' : '#B87B7B'; 
      bgColor = isDark ? 'rgba(201, 139, 139, 0.2)' : 'rgba(184, 123, 123, 0.15)';
    }

    this.setData({ 
      bmiValue: bmi, 
      bmiCategory: category, 
      bmiColor: color, 
      bmiBgColor: bgColor,
      bmiIndicatorLeft,
      bmiIndicatorStyle: `left: ${bmiIndicatorLeft}%;`
    });
  },

  // 点击遮罩层关闭身高输入
  onMaskTap() {
    if (this.data.showHeightInput) {
      this.cancelHeightEdit();
    }
  },

  // 停止事件冒泡（用于身高输入组件的catchtap）
  stopPropagation() {
    // 空函数，用于阻止事件冒泡到页面
  },

  // 取消身高编辑
  cancelHeightEdit() {
    this.setData({ 
      showHeightInput: false, 
      inputHeight: this.data.height ? String(this.data.height) : '' 
    });
  },

  onHeightInput(e) { this.setData({ inputHeight: e.detail.value }); },

  onEditHeight() {
    this.setData({ 
      showHeightInput: true, 
      inputHeight: this.data.height ? String(this.data.height) : '' 
    });
  },

  async onSetHeight() {
    const val = parseFloat(this.data.inputHeight);
    if (!val || val < 100 || val > 250) { this.showToast('请输入有效身高 (100-250cm)'); return; }

    try {
      await wx.cloud.callFunction({ name: 'setHeight', data: { height: val } });
      this.setData({ height: val, showHeightInput: false, inputHeight: '' });
      this.calcBMI();
      this.showToast('身高已设置');
    } catch (e) {
      this.showToast('设置失败');
    }
  },

  // --- Reminder ---
  async onToggleReminder() {
    if (!this.data.reminderEnabled) {
      // 开启提醒 - 请求订阅消息权限
      const success = await this.requestSubscribeAndSave(this.data.remindTime);
      if (success) {
        this.setData({ reminderEnabled: true });
        this.showToast('提醒已开启');
        // 记录今天已请求
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        wx.setStorageSync('lastSubscribeDate', todayStr);
      } else {
        this.showToast('需要授权通知权限');
      }
    } else {
      // 关闭提醒
      await wx.cloud.callFunction({
        name: 'subscribeReminder',
        data: { enabled: false }
      });
      this.setData({ reminderEnabled: false });
      // 清除订阅日期记录
      wx.removeStorageSync('lastSubscribeDate');
      this.showToast('提醒已关闭');
    }
  },

  // 点击时间选择器
  onTimePickerTap() {
    // 这个方法只是用来阻止事件冒泡到父元素的 onToggleReminder
    // e 参数不需要使用
  },
  
  onRemindTimeChange(e) {
    const newTime = e.detail.value;
    this.setData({ remindTime: newTime });
    if (this.data.reminderEnabled) {
      // 直接保存时间到云端
      wx.cloud.callFunction({
        name: 'subscribeReminder',
        data: { enabled: true, remindTime: newTime }
      });
      this.showToast('提醒时间已更新');
    }
  },

  // 请求订阅消息并保存设置到云端
  async requestSubscribeAndSave(remindTime) {
    const templateId = '5X2tUq0NbycqoeFiymKj4FiKaLts5K5ZdSgzqHf4Lt4';
    try {
      const res = await wx.requestSubscribeMessage({
        tmplIds: [templateId]
      });
      if (res[templateId] === 'accept') {
        await wx.cloud.callFunction({
          name: 'subscribeReminder',
          data: { enabled: true, remindTime: remindTime || this.data.remindTime }
        });
        return true;
      } else {
        console.warn('用户拒绝订阅消息授权');
        return false;
      }
    } catch (e) {
      console.error('请求订阅消息失败:', e);
      return false;
    }
  },

  // --- Navigation ---
  goToDiet() {
    wx.switchTab({ url: '/pages/diet/diet' });
  },

  // --- Stats ---
  updateStats(records) {
    const { weightUnit } = this.data;
    const unitLabel = weightUnit === 'kg' ? 'kg' : '斤';
    
    if (records.length === 0) {
      this.setData({
        currentWeight: '--', lastChange: '等待记录', lastChangeClass: 'neutral',
        totalLost: '--', totalLostColor: '#e8e8ef', daysCount: 0
      });
      this.calcBMI();
      return;
    }
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];

    // latest.weight 已经是转换后的值（kg 或 斤）
    let lastChange = '首次记录';
    let lastChangeClass = 'neutral';
    if (sorted.length >= 2) {
      const diff = latest.weight - sorted[1].weight;
      const absDisplayDiff = Math.abs(diff).toFixed(1);
      if (diff < 0) { lastChange = `↓ ${absDisplayDiff} ${unitLabel}`; lastChangeClass = 'down'; }
      else if (diff > 0) { lastChange = `↑ ${absDisplayDiff} ${unitLabel}`; lastChangeClass = 'up'; }
      else { lastChange = '持平'; lastChangeClass = 'neutral'; }
    }

    const sortedAsc = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const first = sortedAsc[0];
    const totalDiff = latest.weight - first.weight;
    const isDark = this.data.currentTheme === 'dark';
    let totalLost = '0.0', totalLostColor = isDark ? '#9CA3AF' : '#6B7280';
    if (totalDiff < 0) { totalLost = Math.abs(totalDiff).toFixed(1); totalLostColor = isDark ? '#5FA895' : '#4A9B8A'; }
    else if (totalDiff > 0) { totalLost = `+${totalDiff.toFixed(1)}`; totalLostColor = isDark ? '#C98B8B' : '#B87B7B'; }

    // latest.weight 已经是正确的显示值（已经过 formatRecordsForDisplay 转换）
    const displayWeight = latest.weight.toFixed(1);

    this.setData({
      currentWeight: displayWeight,
      lastChange, lastChangeClass,
      totalLost, totalLostColor,
      daysCount: records.length
    });

    if (this.data.goalWeight) this.updateGoalProgress(this.data.goalWeight);
    this.calcBMI();
  },

  updateGoalProgress(goal) {
    const { weightUnit } = this.data;
    const unitLabel = weightUnit === 'kg' ? 'kg' : '斤';
    const records = this.data.records;
    if (records.length === 0) return;
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = [...records].sort((a, b) => b.date.localeCompare(a.date))[0];
    
    // goalWeight 和 records 中的 weight 都已经是转换后的同单位值，直接计算
    const totalToLose = first.weight - goal;
    const remaining = latest.weight - goal;
    let progress = 0, goalRemaining = '', goalReached = false;

    if (totalToLose > 0) {
      const currentLost = first.weight - latest.weight;
      progress = Math.min(100, Math.max(0, (currentLost / totalToLose) * 100));
      if (remaining > 0) goalRemaining = `还差 ${Math.abs(remaining).toFixed(1)} ${unitLabel}`;
      else { goalRemaining = '已达标！'; goalReached = true; }
    } else if (totalToLose < 0) {
      const currentGain = latest.weight - first.weight;
      progress = Math.min(100, Math.max(0, (currentGain / Math.abs(totalToLose)) * 100));
      if (remaining < 0) goalRemaining = `还差 ${Math.abs(remaining).toFixed(1)} ${unitLabel}`;
      else { goalRemaining = '已达标！'; goalReached = true; }
    }
    this.setData({ goalRemaining, goalProgress: progress, goalProgressWidth: progress, goalReached });
  },

  calcStreak(records) {
    if (records.length === 0) { this.setData({ streak: 0 }); return; }
    const dates = [...new Set(records.map(r => r.date))].sort().reverse();
    let streak = 0;
    const today = new Date();
    let check = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < 365; i++) {
      const ds = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, '0')}-${String(check.getDate()).padStart(2, '0')}`;
      if (dates.includes(ds)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    this.setData({ streak });
  },

  // --- Chart ---
  drawChart(records) {
    const query = wx.createSelectorQuery();
    query.select('#chart').boundingClientRect();
    query.exec(res => {
      if (!res[0]) return;
      const { width, height } = res[0];
      this.setData({ chartWidth: width, chartHeight: height });
      this._drawChart(records, width, height);
    });
  },

  _drawChart(data, W, H) {
    const ctx = wx.createCanvasContext('chart');
    ctx.clearRect(0, 0, W, H);

    const { weightUnit } = this.data;
    const isJin = weightUnit === 'jin';

    let sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    if (this.data.chartRange !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.data.chartRange);
      const cs = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      sorted = sorted.filter(d => d.date >= cs);
    }

    if (sorted.length < 1) {
      const isDark = this.data.currentTheme === 'dark';
      ctx.setFillStyle(isDark ? '#6B7280' : '#9CA3AF');
      ctx.setFontSize(13);
      ctx.setTextAlign('center');
      ctx.fillText('记录数据后将显示趋势图', W / 2, H / 2);
      ctx.draw();
      return;
    }

    const pad = { t: 20, r: 16, b: 30, l: 44 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    // 使用已转换的 displayWeight（已经是正确的显示单位）
    const weights = sorted.map(d => parseFloat(d.weight));
    let minW = Math.min(...weights), maxW = Math.max(...weights);
    if (maxW - minW < 2) { minW -= 1; maxW += 1; }
    const range = maxW - minW;
    minW -= range * 0.1;
    maxW += range * 0.1;

    // Goal line - 从存储获取原始 kg 值，然后根据当前单位转换显示
    const originalGoal = wx.getStorageSync('weightData')?.targetWeight;
    if (originalGoal) {
      const displayGoal = isJin ? originalGoal * KG_TO_JIN : originalGoal;
      const goalY = isJin ? originalGoal * KG_TO_JIN : originalGoal;
      if (goalY >= minW && goalY <= maxW) {
        const gy = pad.t + cH - ((goalY - minW) / (maxW - minW)) * cH;
        ctx.setStrokeStyle('rgba(212, 165, 116, 0.3)');
        ctx.setLineWidth(1);
        ctx.setLineDash([6, 4], 0);
        ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
        ctx.setLineDash([], 0);
        ctx.setFillStyle('#D4A574');
        ctx.setFontSize(10);
        ctx.setTextAlign('right');
        ctx.fillText(`目标 ${displayGoal.toFixed(1)}`, W - pad.r, gy - 4);
      }
    }

    // Grid - 使用浅灰色虚线
    const isDark = this.data.currentTheme === 'dark';
    ctx.setStrokeStyle(isDark ? 'rgba(156, 163, 175, 0.15)' : 'rgba(156, 163, 175, 0.2)');
    ctx.setLineWidth(1);
    ctx.setLineDash([4, 4], 0);
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.t + (cH / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      const val = maxW - ((maxW - minW) / gridLines) * i;
      ctx.setFillStyle(isDark ? '#6B7280' : '#9CA3AF');
      ctx.setFontSize(10);
      ctx.setTextAlign('right');
      ctx.fillText(val.toFixed(1), pad.l - 6, y + 4);
    }
    ctx.setLineDash([], 0);

    const points = sorted.map((d, i) => ({
      x: sorted.length === 1 ? pad.l + cW / 2 : pad.l + (cW / (sorted.length - 1)) * i,
      y: pad.t + cH - ((parseFloat(d.weight) - minW) / (maxW - minW)) * cH,
      ...d
    }));

    // Area - 使用 Catmull-Rom 样条填充，保持与线条一致
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.t + cH);
    
    if (points.length === 1) {
      ctx.lineTo(points[0].x, points[0].y);
    } else if (points.length === 2) {
      ctx.lineTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    
    ctx.lineTo(points[points.length - 1].x, pad.t + cH);
    ctx.closePath();
    
    // 渐变填充
    if (isDark) {
      ctx.setFillStyle(ctx.createLinearGradient(0, pad.t, 0, pad.t + cH, [[0, 'rgba(95, 168, 149, 0.15)'], [1, 'rgba(95, 168, 149, 0.02)']])); 
    } else {
      ctx.setFillStyle(ctx.createLinearGradient(0, pad.t, 0, pad.t + cH, [[0, 'rgba(74, 155, 138, 0.12)'], [1, 'rgba(74, 155, 138, 0.01)']])); 
    }
    ctx.fill();

    // Line - 使用 Catmull-Rom 样条曲线，确保经过每个数据点
    ctx.setStrokeStyle(isDark ? '#5FA895' : '#4A9B8A'); 
    ctx.setLineWidth(2.5); 
    ctx.setLineJoin('round');
    ctx.setLineCap('round');
    ctx.beginPath();
    
    if (points.length === 1) {
      ctx.moveTo(points[0].x, points[0].y);
    } else if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
    } else {
      // Catmull-Rom 样条：确保线条平滑且经过每个控制点
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        // 计算控制点，使用 Catmull-Rom 转 Bezier 的方法
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }
    ctx.stroke();

    // Dots - 优化数据点样式
    points.forEach((p, idx) => {
      // 外圈
      ctx.beginPath(); 
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.setFillStyle(isDark ? '#121212' : '#FFFFFF'); 
      ctx.fill();
      // 内圈
      ctx.beginPath(); 
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.setFillStyle(isDark ? '#5FA895' : '#4A9B8A'); 
      ctx.fill();
    });

    // Date labels
    const maxLabels = 6;
    const step = Math.max(1, Math.floor(sorted.length / maxLabels));
    ctx.setFillStyle(isDark ? '#6B7280' : '#9CA3AF'); 
    ctx.setFontSize(9); 
    ctx.setTextAlign('center');
    for (let i = 0; i < sorted.length; i += step) {
      const d = sorted[i].date;
      ctx.fillText(`${parseInt(d.slice(5, 7))}/${parseInt(d.slice(8, 10))}`, points[i].x, H - 6);
    }
    ctx.draw();
  },

  // --- Events ---
  onDateChange(e) { this.setData({ inputDate: e.detail.value }); },
  onWeightInput(e) { this.setData({ inputWeight: e.detail.value }); },

  async onCheckin() {
    const { inputDate, inputWeight, weightUnit } = this.data;
    if (!inputDate) { this.showToast('请选择日期'); return; }
    let weight = parseFloat(inputWeight);
    if (!weight) { this.showToast('请输入有效体重'); return; }
    
    // 根据单位进行验证
    const minWeight = weightUnit === 'jin' ? 40 : 20;
    const maxWeight = weightUnit === 'jin' ? 600 : 300;
    if (weight < minWeight || weight > maxWeight) {
      this.showToast(`请输入${minWeight}-${maxWeight}之间的有效体重`);
      return;
    }
    
    // 如果是斤，转换为千克存储
    if (weightUnit === 'jin') {
      weight = weight / KG_TO_JIN;
    }

    wx.showLoading({ title: '打卡中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addRecord', data: { date: inputDate, weight }
      });
      if (res.result.success) {
        this.showToast(res.result.updated ? '记录已更新' : '打卡成功');
        this.setData({ inputWeight: '' });
        this.loadAll();
      }
    } catch (e) { this.showToast('打卡失败'); }
    wx.hideLoading();
  },

  onGoalInput(e) { this.setData({ inputGoal: e.detail.value }); },

  // 点击目标体重卡片编辑
  onEditGoal(e) {
    // 阻止事件冒泡
    e && e.stopPropagation && e.stopPropagation();
    this.setData({ 
      showGoalInput: true, 
      inputGoal: this.data.goalWeight ? String(this.data.goalWeight) : '' 
    });
  },

  async onSetGoal() {
    const { weightUnit } = this.data;
    let val = parseFloat(this.data.inputGoal);
    if (!val) { this.showToast('请输入有效目标体重'); return; }
    
    // 根据单位进行验证
    const minWeight = weightUnit === 'jin' ? 40 : 20;
    const maxWeight = weightUnit === 'jin' ? 600 : 300;
    if (val < minWeight || val > maxWeight) {
      this.showToast(`请输入${minWeight}-${maxWeight}之间的有效目标体重`);
      return;
    }
    
    // 如果是斤，转换为千克存储
    if (weightUnit === 'jin') {
      val = val / KG_TO_JIN;
    }
    
    val = parseFloat(val.toFixed(1));
    try {
      await wx.cloud.callFunction({ name: 'setGoal', data: { goal: val } });
      
      // 同时保存到本地
      const weightData = wx.getStorageSync('weightData') || {};
      weightData.targetWeight = val;
      wx.setStorageSync('weightData', weightData);
      
      this.showToast('目标已设定');
      
      // 根据单位转换显示
      const displayGoal = weightUnit === 'jin' ? val * KG_TO_JIN : val;
      this.setData({ goalWeight: displayGoal, showGoalInput: false, inputGoal: '' });
      this.updateGoalProgress(val);
    } catch (e) { this.showToast('设定失败'); }
  },

  // 取消目标编辑
  onCancelGoal() {
    this.setData({ showGoalInput: false, inputGoal: '' });
  },

  // 点击页面取消目标输入
  onCancelGoalInput(e) {
    if (this.data.showGoalInput) {
      this.setData({ showGoalInput: false, inputGoal: '' });
    }
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    e && e.stopPropagation && e.stopPropagation();
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const date = e.currentTarget.dataset.date;
    wx.showModal({
      title: '确认删除', content: `删除 ${date} 的记录？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({ name: 'deleteRecord', data: { id } });
            this.showToast('已删除'); this.loadAll();
          } catch (e) { this.showToast('删除失败'); }
        }
      }
    });
  },

  onRangeChange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ chartRange: range === 'all' ? 'all' : parseInt(range) });
    this.loadRecords();
  },

  updateBmiIndicatorStyle() {
    const query = wx.createSelectorQuery();
    query.select('.bmi-indicator').boundingClientRect();
    query.exec((res) => {
      if (res[0] && this.data.bmiValue !== '--') {
        // const left = this.data.bmiIndicatorLeft + '%';
        const indicatorNode = wx.createSelectorQuery().select('.bmi-indicator');
        indicatorNode.fields({ style: ['left'] });
        indicatorNode.exec((styleRes) => {
          if (styleRes[0]) {
            // 使用 wx.nextTick 确保 DOM 更新完成
            wx.nextTick(() => {
              const indicatorNode2 = wx.createSelectorQuery().select('.bmi-indicator');
              indicatorNode2.fields({ style: ['left'] }, (result) => {
                if (result) {
                  // 实际应用中，我们可以在这里设置样式
                  // 但由于微信小程序的限制，我们需要使用不同的方法
                }
              }).exec();
            });
          }
        });
      }
    });
  },

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  },
  
  // 主题相关方法
  initTheme() {
    const themeSetting = app.getThemeSetting();
    const effectiveTheme = app.getEffectiveTheme();
    if (this.data.currentTheme !== effectiveTheme || this.data.currentThemeSetting !== themeSetting) {
      this.setData({ 
        currentTheme: effectiveTheme,
        currentThemeSetting: themeSetting
      });
    }
    
    // 动态设置下拉刷新背景色
    this.setPullDownRefreshBg(effectiveTheme);
    
    app.applyThemeToTabBar();
  },
  
  // 页面主题变化回调（跟随系统主题时调用）
  onThemeChange() {
    const themeSetting = app.getThemeSetting();
    const effectiveTheme = app.getEffectiveTheme();
    this.setData({
      currentTheme: effectiveTheme,
      currentThemeSetting: themeSetting
    });
    this.setPullDownRefreshBg(effectiveTheme);
    app.applyThemeToTabBar();
  },
  
  // 设置下拉刷新背景色
  setPullDownRefreshBg(theme) {
    try {
      if (theme === 'light') {
        // 浅色模式：设置浅色背景
        if (wx.setBackgroundColor && typeof wx.setBackgroundColor === 'function') {
          wx.setBackgroundColor({
            backgroundColor: '#F8FAF9',
            backgroundColorTop: '#F8FAF9',
            backgroundColorBottom: '#F8FAF9',
          });
        }
        if (wx.setBackgroundTextStyle && typeof wx.setBackgroundTextStyle === 'function') {
          wx.setBackgroundTextStyle({
            textStyle: 'dark' // 浅色背景上用黑色文字
          });
        }
        // 设置状态栏文字颜色为深色
        if (wx.setNavigationBarColor) {
          wx.setNavigationBarColor({
            frontColor: '#000000',
            backgroundColor: '#F8FAF9',
            animation: { duration: 200, timingFunc: 'easeInOut' }
          });
        }
      } else {
        // 深色模式：设置深色背景
        if (wx.setBackgroundColor && typeof wx.setBackgroundColor === 'function') {
          wx.setBackgroundColor({
            backgroundColor: '#121212',
            backgroundColorTop: '#121212',
            backgroundColorBottom: '#121212',
          });
        }
        if (wx.setBackgroundTextStyle && typeof wx.setBackgroundTextStyle === 'function') {
          wx.setBackgroundTextStyle({
            textStyle: 'light' // 深色背景上用白色文字
          });
        }
        // 设置状态栏文字颜色为浅色
        if (wx.setNavigationBarColor) {
          wx.setNavigationBarColor({
            frontColor: '#ffffff',
            backgroundColor: '#121212',
            animation: { duration: 200, timingFunc: 'easeInOut' }
          });
        }
      }
    } catch (err) {
      console.warn('设置下拉刷新背景色出错:', err);
    }
  },
  
  // 切换主题
  onSwitchTheme(e) {
    const theme = e.currentTarget.dataset.theme;
    
    // 如果选择跟随系统但无法检测到系统主题，提示用户选择
    if (theme === 'system') {
      // 检测系统主题
      const detectedTheme = app.getSystemTheme();
      const savedTheme = wx.getStorageSync('lastSystemTheme');
      
      // 如果没有保存过主题（首次使用跟随系统），让用户确认
      if (!savedTheme) {
        wx.showModal({
          title: '选择当前系统主题',
          content: '您的微信版本暂不支持自动检测主题，请确认您的微信当前是深色还是浅色模式？',
          confirmText: '深色',
          cancelText: '浅色',
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
  
  // 应用主题
  applyThemeWithSystem(themeSetting, effectiveTheme) {
    // 保存主题设置
    wx.setStorageSync('appTheme', themeSetting);
    app.globalData.theme = themeSetting;
    
    // 如果是跟随系统，保存检测到的系统主题
    if (themeSetting === 'system') {
      app.setSystemTheme(effectiveTheme);
    }
    
    this.setData({
      currentTheme: effectiveTheme,
      currentThemeSetting: themeSetting,
      showThemeMenu: false
    });
    
    // 设置下拉刷新背景色
    this.setPullDownRefreshBg(effectiveTheme);
    
    // 更新tabBar主题
    app.applyThemeToTabBar();
    
    // 通知所有已加载页面同步更新主题（避免切换页面时闪烁）
    app.notifyThemeChange(effectiveTheme);
    
    // 显示提示
    let toastMsg = '';
    if (themeSetting === 'system') {
      toastMsg = '已切换到跟随系统';
    } else if (themeSetting === 'dark') {
      toastMsg = '切换到深色模式';
    } else {
      toastMsg = '切换到浅色模式';
    }
    this.showToast(toastMsg);
  },
  
  // 显示/隐藏主题菜单
  onToggleThemeMenu() {
    this.setData({
      showThemeMenu: !this.data.showThemeMenu
    });
  },
  
  // --- 编辑体重功能 ---
  onEditRecord(e) {
    const record = e.currentTarget.dataset.record;
    // record.weight 已经是数值类型（转换后的），需要格式化为字符串显示
    this.setData({
      editRecordId: record._id,
      editDate: record.date,
      editWeight: String(parseFloat(record.weight).toFixed(1)),
      showEditPanel: true
    });
  },

  onEditWeightInput(e) {
    this.setData({ editWeight: e.detail.value });
  },

  closeEditPanel() {
    this.setData({
      showEditPanel: false,
      editRecordId: '',
      editDate: '',
      editWeight: ''
    });
  },

  async onSaveEdit() {
    const { editRecordId, editWeight, weightUnit } = this.data;
    let weight = parseFloat(editWeight);
    
    if (!editRecordId || !weight) {
      this.showToast('请输入有效体重');
      return;
    }
    
    // 根据单位验证范围
    const minWeight = weightUnit === 'jin' ? 40 : 20;
    const maxWeight = weightUnit === 'jin' ? 600 : 300;
    if (weight < minWeight || weight > maxWeight) {
      this.showToast(`请输入${minWeight}-${maxWeight}之间的有效体重`);
      return;
    }
    
    // 如果是斤，转换为千克存储
    if (weightUnit === 'jin') {
      weight = weight / KG_TO_JIN;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addRecord',
        data: { date: this.data.editDate, weight }
      });
      if (res.result.success) {
        this.showToast('体重已更新');
        this.closeEditPanel();
        this.loadAll();
      }
    } catch (e) {
      this.showToast('保存失败');
    }
    wx.hideLoading();
  },

  // 下拉刷新相关方法
  onPullDownRefresh() {
    console.log('下拉刷新开始');
    this.setData({ refreshing: true });
    
    // 加载数据
    this.loadAll().then(() => {
      // 停止下拉刷新
      setTimeout(() => {
        if (wx.stopPullDownRefresh) {
          wx.stopPullDownRefresh();
        }
        this.setData({ refreshing: false });
      }, 500);
    });
  },

  // 打开体重弹框
  openWeightPopup(e) {
    const type = e.currentTarget.dataset.type;
    const currentWeight = this.data.currentWeight;
    const goalWeight = this.data.goalWeight;
    
    let inputValue = '';
    if (type === 'current') {
      inputValue = currentWeight !== '--' ? currentWeight : '';
    } else {
      inputValue = goalWeight ? String(goalWeight) : '';
    }
    
    this.setData({
      weightPopupShow: true,
      weightPopupType: type,
      weightInputValue: inputValue,
      weightPopupError: ''
    });
  },

  // 关闭体重弹框
  closeWeightPopup() {
    this.setData({
      weightPopupShow: false,
      weightInputValue: '',
      weightPopupError: ''
    });
  },

  // 体重输入
  onWeightPopupInput(e) {
    this.setData({ weightInputValue: e.detail.value });
  },

  // 保存体重
  async saveWeightPopup() {
    const { weightUnit } = this.data;
    let value = parseFloat(this.data.weightInputValue);
    
    if (!value) {
      this.setData({ weightPopupError: '请输入有效体重' });
      return;
    }
    
    // 根据单位进行验证（斤的范围是40-600，kg的范围是20-300）
    const minWeight = weightUnit === 'jin' ? 40 : 20;
    const maxWeight = weightUnit === 'jin' ? 600 : 300;
    
    if (value < minWeight || value > maxWeight) {
      this.setData({ weightPopupError: `请输入${minWeight}-${maxWeight}之间的有效体重` });
      return;
    }
    
    // 如果是斤，转换为千克存储
    if (weightUnit === 'jin') {
      value = value / KG_TO_JIN;
    }
    
    this.setData({ weightPopupError: '' });
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      if (this.data.weightPopupType === 'current') {
        // 保存当前体重 - 添加今日打卡记录
        const today = this.data.inputDate;
        const res = await wx.cloud.callFunction({
          name: 'addRecord',
          data: { date: today, weight: value }
        });
        
        if (res.result && res.result.success) {
          this.showToast('体重已记录');
          this.closeWeightPopup();
          this.loadAll();
        } else {
          this.showToast('保存失败');
        }
      } else {
        // 保存目标体重到本地存储（保留一位小数）
        const weightData = wx.getStorageSync('weightData') || {};
        weightData.targetWeight = parseFloat(value.toFixed(1));
        wx.setStorageSync('weightData', weightData);
        
        // 同时同步到云端
        try {
          await wx.cloud.callFunction({ name: 'setGoal', data: { goal: weightData.targetWeight } });
        } catch (e) {
          console.warn('同步目标体重到云端失败', e);
        }
        
        this.showToast('目标体重已设置');
        this.closeWeightPopup();
        
        // 根据单位转换显示
        const displayGoal = weightUnit === 'jin' ? weightData.targetWeight * KG_TO_JIN : weightData.targetWeight;
        this.setData({ goalWeight: displayGoal });
        
        // 重新计算目标相关信息（使用转换后的displayGoal，与records单位一致）
        this.updateGoalProgress(displayGoal);
      }
    } catch (e) {
      console.error('保存体重失败', e);
      this.showToast('保存失败');
    }
    
    wx.hideLoading();
  }
});

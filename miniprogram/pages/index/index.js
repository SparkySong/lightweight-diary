// pages/index/index.js
const db = wx.cloud.database();
const _ = db.command;

const app = getApp();

// 分页配置
const PAGE_SIZE = 15;

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
    // 主题相关
    currentTheme: 'dark',
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
    pageSize: PAGE_SIZE       // 每页加载数量
  },

  onLoad() {
    this.setTodayDate();
    this.loadAll();
    this.initTheme();
  },

  onShow() {
    this.loadAll();
    // 页面显示时确保tabBar应用正确主题
    setTimeout(() => {
      app.applyThemeToTabBar();
    }, 100);
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
        
        if (localRecords.length > 0) {
          this.setData({ records: localRecords });
          this.updateStats(localRecords);
          this.calcStreak(localRecords);
          this.drawChart(localRecords);
        }
        if (localGoal) {
          this.setData({ goalWeight: localGoal, showGoalInput: false });
          this.updateGoalProgress(localGoal);
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
      const allRecords = res.result.data || [];
      
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
    } catch (e) {
      console.error('加载记录失败', e);
    }
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
    try {
      const res = await wx.cloud.callFunction({ name: 'getGoal' });
      const goal = res.result.goal;
      if (goal) {
        this.setData({ goalWeight: goal, showGoalInput: false });
        this.updateGoalProgress(goal);
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
    const { height, currentWeight } = this.data;
    if (!height || currentWeight === '--') {
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
    const h = height / 100;
    const w = parseFloat(currentWeight);
    const bmi = (w / (h * h)).toFixed(1);
    // 计算 BMI 指示器位置 (0-40 范围)
    const bmiIndicatorLeft = Math.min(Math.max((bmi / 40) * 100, 0), 100);

    let category, color, bgColor;
    if (bmi < 18.5) { 
      category = '偏瘦'; 
      color = '#74b9ff'; 
      bgColor = 'rgba(116, 185, 255, 0.2)';
    }
    else if (bmi < 24) { 
      category = '正常'; 
      color = '#00b894'; 
      bgColor = 'rgba(0, 184, 148, 0.2)';
    }
    else if (bmi < 28) { 
      category = '偏胖'; 
      color = '#fdcb6e'; 
      bgColor = 'rgba(253, 203, 110, 0.2)';
    }
    else { 
      category = '肥胖'; 
      color = '#e17055'; 
      bgColor = 'rgba(225, 112, 85, 0.2)';
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
      try {
        const templateId = '5X2tUq0NbycqoeFiymKj4FiKaLts5K5ZdSgzqHf4Lt4';
        const res = await wx.requestSubscribeMessage({
          tmplIds: [templateId]
        });
        if (res[templateId] === 'accept') {
          await wx.cloud.callFunction({
            name: 'subscribeReminder',
            data: { enabled: true, remindTime: this.data.remindTime }
          });
          this.setData({ reminderEnabled: true });
          this.showToast('提醒已开启 🔔');
        } else {
          this.showToast('需要授权通知权限');
        }
      } catch (e) {
        // 用户拒绝或出错
        console.error('订阅消息失败:', e);
        this.showToast('开启提醒失败');
      }
    } else {
      // 关闭提醒
      await wx.cloud.callFunction({
        name: 'subscribeReminder',
        data: { enabled: false }
      });
      this.setData({ reminderEnabled: false });
      this.showToast('提醒已关闭');
    }
  },

  // 点击时间选择器
  onTimePickerTap() {
    // 这个方法只是用来阻止事件冒泡到父元素的 onToggleReminder
    // e 参数不需要使用
  },
  
  onRemindTimeChange(e) {
    this.setData({ remindTime: e.detail.value });
    if (this.data.reminderEnabled) {
      wx.cloud.callFunction({
        name: 'subscribeReminder',
        data: { enabled: true, remindTime: e.detail.value }
      });
    }
  },

  // --- Navigation ---
  goToDiet() {
    wx.switchTab({ url: '/pages/diet/diet' });
  },

  // --- Stats ---
  updateStats(records) {
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

    let lastChange = '首次记录';
    let lastChangeClass = 'neutral';
    if (sorted.length >= 2) {
      const diff = latest.weight - sorted[1].weight;
      if (diff < 0) { lastChange = `↓ ${Math.abs(diff).toFixed(1)} kg`; lastChangeClass = 'down'; }
      else if (diff > 0) { lastChange = `↑ ${diff.toFixed(1)} kg`; lastChangeClass = 'up'; }
      else { lastChange = '持平'; lastChangeClass = 'neutral'; }
    }

    const sortedAsc = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const first = sortedAsc[0];
    const totalDiff = latest.weight - first.weight;
    let totalLost = '0.0', totalLostColor = '#e8e8ef';
    if (totalDiff < 0) { totalLost = Math.abs(totalDiff).toFixed(1); totalLostColor = '#00b894'; }
    else if (totalDiff > 0) { totalLost = `+${totalDiff.toFixed(1)}`; totalLostColor = '#e17055'; }

    this.setData({
      currentWeight: latest.weight.toFixed(1),
      lastChange, lastChangeClass,
      totalLost, totalLostColor,
      daysCount: records.length
    });

    if (this.data.goalWeight) this.updateGoalProgress(this.data.goalWeight);
    this.calcBMI();
  },

  updateGoalProgress(goal) {
    const records = this.data.records;
    if (records.length === 0) return;
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = [...records].sort((a, b) => b.date.localeCompare(a.date))[0];
    const totalToLose = first.weight - goal;
    const remaining = latest.weight - goal;
    let progress = 0, goalRemaining = '', goalReached = false;

    if (totalToLose > 0) {
      const currentLost = first.weight - latest.weight;
      progress = Math.min(100, Math.max(0, (currentLost / totalToLose) * 100));
      if (remaining > 0) goalRemaining = `还差 ${remaining.toFixed(1)} kg`;
      else { goalRemaining = '🎉 已达标！'; goalReached = true; }
    } else if (totalToLose < 0) {
      const currentGain = latest.weight - first.weight;
      progress = Math.min(100, Math.max(0, (currentGain / Math.abs(totalToLose)) * 100));
      if (remaining < 0) goalRemaining = `还差 ${Math.abs(remaining).toFixed(1)} kg`;
      else { goalRemaining = '🎉 已达标！'; goalReached = true; }
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

    let sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    if (this.data.chartRange !== 'all') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.data.chartRange);
      const cs = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      sorted = sorted.filter(d => d.date >= cs);
    }

    if (sorted.length < 1) {
      ctx.setFillStyle('#8888a0');
      ctx.setFontSize(13);
      ctx.setTextAlign('center');
      ctx.fillText('记录数据后将显示趋势图', W / 2, H / 2);
      ctx.draw();
      return;
    }

    const pad = { t: 20, r: 16, b: 30, l: 44 };
    const cW = W - pad.l - pad.r;
    const cH = H - pad.t - pad.b;

    const weights = sorted.map(d => d.weight);
    let minW = Math.min(...weights), maxW = Math.max(...weights);
    if (maxW - minW < 2) { minW -= 1; maxW += 1; }
    const range = maxW - minW;
    minW -= range * 0.1;
    maxW += range * 0.1;

    // Goal line
    const goal = this.data.goalWeight;
    if (goal && goal >= minW && goal <= maxW) {
      const gy = pad.t + cH - ((goal - minW) / (maxW - minW)) * cH;
      ctx.setStrokeStyle('rgba(253, 203, 110, 0.3)');
      ctx.setLineWidth(1);
      ctx.setLineDash([6, 4], 0);
      ctx.beginPath(); ctx.moveTo(pad.l, gy); ctx.lineTo(W - pad.r, gy); ctx.stroke();
      ctx.setLineDash([], 0);
      ctx.setFillStyle('#fdcb6e');
      ctx.setFontSize(10);
      ctx.setTextAlign('right');
      ctx.fillText(`目标 ${goal}`, W - pad.r, gy - 4);
    }

    // Grid
    ctx.setStrokeStyle('rgba(42, 42, 58, 0.6)');
    ctx.setLineWidth(1);
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.t + (cH / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      const val = maxW - ((maxW - minW) / gridLines) * i;
      ctx.setFillStyle('#8888a0');
      ctx.setFontSize(10);
      ctx.setTextAlign('right');
      ctx.fillText(val.toFixed(1), pad.l - 6, y + 4);
    }

    const points = sorted.map((d, i) => ({
      x: sorted.length === 1 ? pad.l + cW / 2 : pad.l + (cW / (sorted.length - 1)) * i,
      y: pad.t + cH - ((d.weight - minW) / (maxW - minW)) * cH,
      ...d
    }));

    // Area
    ctx.beginPath(); ctx.moveTo(points[0].x, pad.t + cH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.t + cH);
    ctx.closePath(); ctx.setFillStyle('rgba(108, 92, 231, 0.15)'); ctx.fill();

    // Line
    ctx.setStrokeStyle('#6c5ce7'); ctx.setLineWidth(2.5); ctx.setLineJoin('round');
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.setFillStyle('#6c5ce7'); ctx.fill();
      ctx.setStrokeStyle('#1a1a24'); ctx.setLineWidth(2); ctx.stroke();
    });

    // Date labels
    const maxLabels = 6;
    const step = Math.max(1, Math.floor(sorted.length / maxLabels));
    ctx.setFillStyle('#8888a0'); ctx.setFontSize(9); ctx.setTextAlign('center');
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
    const { inputDate, inputWeight } = this.data;
    if (!inputDate) { this.showToast('请选择日期'); return; }
    const weight = parseFloat(inputWeight);
    if (!weight || weight < 20 || weight > 300) { this.showToast('请输入有效体重'); return; }

    wx.showLoading({ title: '打卡中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addRecord', data: { date: inputDate, weight }
      });
      if (res.result.success) {
        this.showToast(res.result.updated ? '记录已更新 ✏️' : '打卡成功 ✅');
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
    const val = parseFloat(this.data.inputGoal);
    if (!val || val < 20 || val > 300) { this.showToast('请输入有效目标体重'); return; }
    try {
      await wx.cloud.callFunction({ name: 'setGoal', data: { goal: val } });
      this.showToast('目标已设定 🎯');
      this.setData({ goalWeight: val, showGoalInput: false, inputGoal: '' });
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
    const theme = app.getTheme();
    this.setData({ 
      currentTheme: theme
    });
    
    // 动态设置下拉刷新背景色
    this.setPullDownRefreshBg(theme);
  },
  
  // 设置下拉刷新背景色
  setPullDownRefreshBg(theme) {
    try {
      if (theme === 'light') {
        // 浅色模式：设置浅色背景
        if (wx.setBackgroundColor && typeof wx.setBackgroundColor === 'function') {
          wx.setBackgroundColor({
            backgroundColor: '#f8f9fa',
            backgroundColorTop: '#f8f9fa',
            backgroundColorBottom: '#f8f9fa',
          });
        }
        if (wx.setBackgroundTextStyle && typeof wx.setBackgroundTextStyle === 'function') {
          wx.setBackgroundTextStyle({
            textStyle: 'dark' // 浅色背景上用黑色文字
          });
        }
      } else {
        // 深色模式：设置深色背景
        if (wx.setBackgroundColor && typeof wx.setBackgroundColor === 'function') {
          wx.setBackgroundColor({
            backgroundColor: '#0f0f13',
            backgroundColorTop: '#0f0f13',
            backgroundColorBottom: '#0f0f13',
          });
        }
        if (wx.setBackgroundTextStyle && typeof wx.setBackgroundTextStyle === 'function') {
          wx.setBackgroundTextStyle({
            textStyle: 'light' // 深色背景上用白色文字
          });
        }
      }
    } catch (err) {
      console.warn('设置下拉刷新背景色出错:', err);
    }
  },
  
  // 切换主题
  onSwitchTheme() {
    // 切换全局主题
    const newTheme = app.switchTheme();
    
    this.setData({
      currentTheme: newTheme,
      showThemeMenu: false
    });
    
    // 设置下拉刷新背景色
    this.setPullDownRefreshBg(newTheme);
    
    // 更新tabBar主题
    app.applyThemeToTabBar();
    
    // 显示提示
    this.showToast(newTheme === 'dark' ? '切换到深色模式 🌙' : '切换到浅色模式 ☀️');
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
    this.setData({
      editRecordId: record._id,
      editDate: record.date,
      editWeight: String(record.weight),
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
    const { editRecordId, editWeight } = this.data;
    const weight = parseFloat(editWeight);
    if (!editRecordId || !weight || weight < 20 || weight > 300) {
      this.showToast('请输入有效体重');
      return;
    }

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addRecord',
        data: { date: this.data.editDate, weight }
      });
      if (res.result.success) {
        this.showToast('体重已更新 ✏️');
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
  }
});

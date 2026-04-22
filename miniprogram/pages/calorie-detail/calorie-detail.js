// pages/calorie-detail/calorie-detail.js
const app = getApp();

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

// 低卡替代方案数据
const lowCalRecipes = {
  dinner: ['鸡胸肉沙拉', '水煮虾+蔬菜', '清蒸鱼+西兰花', '豆腐蔬菜汤', '藜麦沙拉'],
  snack: ['无糖酸奶', '小把坚果', '黄瓜条', '煮鸡蛋', '黑咖啡'],
  carb: ['糙米饭', '玉米', '红薯', '全麦面包', '藜麦']
};

Page({
  data: {
    currentTheme: getInitTheme(),
    todayDate: '',
    unit: 'kcal',
    customTarget: '',
    showTargetInput: false,
    todayData: {
      totalCal: 0,
      targetCal: 1500,
      remainingCal: 1500,
      deficit: -500,
      meals: {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snack: 0
      }
    },
    mealLegend: [],
    weekData: [],
    overLimitDays: 0,
    mealRecommend: [],
    statusClass: 'normal',
    statusIcon: 'normal',
    statusText: '今日达标',
    adviceTitle: '今日建议',
    adviceList: [],
    overReason: '',
    altTitle: '',
    altList: [],
    toastShow: false,
    toastMsg: ''
  },

  // 页面饼图宽度和高度
  pieChartWidth: 0,
  pieChartHeight: 0,
  lineChartWidth: 0,
  lineChartHeight: 0,
  barChartWidth: 0,
  barChartHeight: 0,

  onLoad() {
    this.initTheme();
    this.setTodayDate();
    this.initCharts();
    this.loadUserData();
  },

  onShow() {
    // 每次进入页面都重新初始化主题
    this.initTheme();
    this.loadUserData().then(() => {
      this.loadRecords();
      // 重新绘制图表
      setTimeout(() => {
        this.drawPieChart();
        this.drawLineChart();
        this.drawBarChart();
      }, 300);
    });
  },

  onReady() {
    // 延迟绘制，等待数据加载
    setTimeout(() => {
      this.loadUserData().then(() => {
        this.drawPieChart();
        this.drawLineChart();
        this.drawBarChart();
      });
    }, 500);
  },

  setTodayDate() {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({ todayDate: date });
  },

  initTheme() {
    const theme = app.getEffectiveTheme();
    // 只有主题变化时才更新
    if (this.data.currentTheme !== theme) {
      this.setData({ currentTheme: theme });
    }
    
    // 动态设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: theme === 'light' ? '#000000' : '#ffffff',
      backgroundColor: theme === 'light' ? '#F8FAF9' : '#121212',
      animation: { duration: 0, timingFunc: 'linear' }
    });
    
    if (wx.setBackgroundTextStyle) {
      wx.setBackgroundTextStyle({
        textStyle: theme === 'light' ? 'dark' : 'light'
      });
    }

    if (theme === 'light') {
      wx.setBackgroundColor({
        backgroundColor: '#F8FAF9',
        backgroundColorTop: '#F8FAF9',
        backgroundColorBottom: '#F8FAF9',
      });
    } else {
      wx.setBackgroundColor({
        backgroundColor: '#121212',
        backgroundColorTop: '#121212',
        backgroundColorBottom: '#121212',
      });
    }
  },

  onThemeChange() {
    this.initTheme();
    setTimeout(() => {
      this.drawPieChart();
      this.drawLineChart();
      this.drawBarChart();
    }, 0);
  },

  async loadUserData() {
    try {
      // 只从云端获取用户设置的目标热量
      const res = await wx.cloud.callFunction({ name: 'getUserSettings', data: {} });
      const customTarget = res.result.settings?.dailyCalorieTarget || 0;
      
      // 默认热量目标（如果云端没有设置）
      const defaultTarget = 1500;
      
      this.setData({
        customTarget: customTarget || defaultTarget,
        showTargetInput: false
      });
    } catch (e) {
      console.error('加载用户数据失败', e);
      // 云端失败时使用默认值
      this.setData({
        customTarget: 1500,
        showTargetInput: false
      });
    }
  },

  async loadRecords() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      // 云函数返回的是 days 格式，每个day包含records数组
      const allDays = res.result.days || [];
      
      console.log('=== 热量分析调试 ===');
      console.log('allDays:', JSON.stringify(allDays).slice(0, 500));
      console.log('todayDate:', this.data.todayDate);
      
      // 将 days 转换为 records 数组，同时聚合每个record的热量
      const allRecords = [];
      allDays.forEach(day => {
        if (day.records && Array.isArray(day.records)) {
          day.records.forEach(record => {
            // 使用 totalCal 字段（云函数计算的每条记录总热量）
            allRecords.push({
              ...record,
              date: day.date,
              calories: record.totalCal || record.calories || 0
            });
          });
        }
      });
      
      console.log('allRecords count:', allRecords.length);
      console.log('allRecords sample:', JSON.stringify(allRecords.slice(0, 2)));
      
      // 计算今日数据
      this.calculateTodayData(allRecords);
      
      // 计算近7天数据
      this.calculateWeekData(allRecords);
      
      // 绘制图表
      setTimeout(() => {
        this.drawPieChart();
        this.drawLineChart();
        this.drawBarChart();
      }, 100);
      
    } catch (e) {
      console.error('加载饮食记录失败', e);
      // 即使出错也显示示例图表
      setTimeout(() => {
        this.drawPieChart();
        this.drawLineChart();
        this.drawBarChart();
      }, 100);
    }
  },

  calculateTodayData(records) {
    const today = this.data.todayDate;
    const todayRecords = records.filter(r => r.date === today);
    
    console.log('todayRecords:', JSON.stringify(todayRecords));
    
    // 计算三餐热量
    const meals = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0
    };
    
    todayRecords.forEach(record => {
      const mealType = record.mealType || 'snack';
      meals[mealType] = (meals[mealType] || 0) + (record.calories || 0);
    });
    
    console.log('meals:', JSON.stringify(meals));
    
    const totalCal = Object.values(meals).reduce((a, b) => a + b, 0);
    // 目标热量上限5000，防止存储异常值导致计算溢出
    const targetCal = Math.min(this.data.customTarget || 1500, 5000);
    const remainingCal = targetCal - totalCal;
    
    // 热量缺口计算：摄入 - 目标消耗
    // 负数表示热量不足（有利于减脂），正数表示摄入超标
    const deficit = totalCal - targetCal;
    
    // 确定状态
    let statusClass, statusIcon, statusText;
    const percent = totalCal / targetCal;
    
    if (percent >= 1) {
      statusClass = 'danger';
      statusIcon = 'danger';
      statusText = '已超标';
    } else if (percent >= 0.8) {
      statusClass = 'warning';
      statusIcon = 'warning';
      statusText = '临近超标';
    } else if (percent >= 0.7) {
      statusClass = 'success';
      statusIcon = 'success';
      statusText = '今日达标';
    } else {
      statusClass = 'low';
      statusIcon = 'low';
      statusText = '热量偏低';
    }
    
    // 计算图例数据 - 使用低饱和度配色
    const isDark = this.data.currentTheme === 'dark';
    const mealLegend = [
      { name: '早餐', color: isDark ? '#D4A574' : '#C49A6C', cal: meals.breakfast, percent: totalCal > 0 ? Math.round(meals.breakfast / totalCal * 100) : 0 },
      { name: '午餐', color: isDark ? '#5FA895' : '#4A9B8A', cal: meals.lunch, percent: totalCal > 0 ? Math.round(meals.lunch / totalCal * 100) : 0 },
      { name: '晚餐', color: isDark ? '#8B9EAF' : '#7A8E9F', cal: meals.dinner, percent: totalCal > 0 ? Math.round(meals.dinner / totalCal * 100) : 0 },
      { name: '加餐', color: isDark ? '#C98B8B' : '#B87B7B', cal: meals.snack, percent: totalCal > 0 ? Math.round(meals.snack / totalCal * 100) : 0 }
    ];
    
    // 计算三餐推荐对比
    const mealRecommend = [
      { name: '早餐', target: Math.round(targetCal * 0.3), actual: meals.breakfast, isOver: meals.breakfast > targetCal * 0.35 },
      { name: '午餐', target: Math.round(targetCal * 0.4), actual: meals.lunch, isOver: meals.lunch > targetCal * 0.45 },
      { name: '晚餐', target: Math.round(targetCal * 0.3), actual: meals.dinner, isOver: meals.dinner > targetCal * 0.35 }
    ];
    
    // 生成建议
    const { adviceTitle, adviceList, overReason, altTitle, altList } = this.generateAdvice(totalCal, targetCal, meals, percent);
    
    this.setData({
      todayData: {
        totalCal,
        targetCal,
        remainingCal,
        deficit,
        meals
      },
      mealLegend,
      mealRecommend,
      statusClass,
      statusIcon,
      statusText,
      adviceTitle,
      adviceList,
      overReason: overReason || '整体热量偏高',
      altTitle,
      altList
    });
  },

  calculateWeekData(records) {
    const today = new Date();
    const weekData = [];
    const targetCal = Math.min(this.data.customTarget || 1500, 5000);
    let overLimitDays = 0;
    
    // 获取近7天的数据
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const dayRecords = records.filter(r => r.date === dateStr);
      const totalCal = dayRecords.reduce((sum, r) => sum + (r.calories || 0), 0);
      
      // 获取星期几
      const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
      const dayName = dayNames[date.getDay()];
      
      // 直接使用真实数据，没有数据则为0
      weekData.push({
        date: dateStr,
        day: dayName,
        cal: totalCal,
        isOver: totalCal > targetCal,
        percent: totalCal > 0 ? Math.round(totalCal / targetCal * 100) : 0
      });
      
      if (totalCal > targetCal) {
        overLimitDays++;
      }
    }
    
    this.setData({
      weekData,
      overLimitDays
    });
  },

  generateAdvice(totalCal, targetCal, meals, percent) {
    let adviceTitle = '今日建议';
    let adviceList = [];
    let overReason = '';
    let altTitle = '';
    let altList = [];
    
    if (percent >= 1) {
      // 超标情况
      adviceTitle = '热量超标建议';
      
      // 找出超标来源
      const mealThresholds = {
        breakfast: targetCal * 0.3,
        lunch: targetCal * 0.4,
        dinner: targetCal * 0.3,
        snack: targetCal * 0.1
      };
      
      if (meals.dinner > mealThresholds.dinner * 1.2) {
        overReason = '晚餐热量过高';
        altTitle = '低卡晚餐推荐';
        altList = lowCalRecipes.dinner;
      } else if (meals.snack > mealThresholds.snack * 1.5) {
        overReason = '加餐零食热量过高';
        altTitle = '低卡零食替代';
        altList = lowCalRecipes.snack;
      } else {
        overReason = '整体热量摄入偏多';
      }
      
      adviceList = [
        `明日可减少 ${Math.round(targetCal * 0.1)}-${Math.round(targetCal * 0.15)} 大卡摄入`,
        '或增加 30 分钟快走，消耗约 150 大卡',
        '建议选择低油低糖的食物'
      ];
      
    } else if (percent >= 0.8) {
      // 临近超标
      adviceTitle = '热量临近超标';
      adviceList = [
        '今日热量接近目标，注意控制',
        '剩余热量约 ' + Math.round(targetCal - totalCal) + ' 大卡',
        '建议选择清淡食物'
      ];
      
    } else if (percent >= 0.7) {
      // 达标
      adviceTitle = '控卡建议';
      adviceList = [
        '今日热量达标，继续保持',
        '可适当增加蛋白质摄入',
        '建议每餐都有蔬菜'
      ];
      
    } else if (totalCal > 0) {
      // 热量不足
      adviceTitle = '热量偏低提示';
      adviceList = [
        '热量摄入偏低，注意均衡营养',
        '避免过度节食影响代谢',
        '建议适当增加健康加餐'
      ];
      altTitle = '优质加餐推荐';
      altList = ['一个水煮蛋 + 一杯牛奶', '无糖酸奶 + 坚果'];
      
    } else {
      // 暂无数据
      adviceTitle = '开始记录';
      adviceList = [
        '今日暂无饮食记录',
        '点击下方按钮开始记录',
        '合理的饮食是减脂成功的关键'
      ];
    }
    
    return { adviceTitle, adviceList, overReason, altTitle, altList };
  },

  initCharts() {
    const sysInfo = wx.getSystemInfoSync();
    // 使用rpx转px计算（设计稿宽度750rpx）
    const scale = sysInfo.windowWidth / 750;
    
    // 设置图表尺寸（rpx转px）
    this.pieChartWidth = 140 * scale;
    this.pieChartHeight = 140 * scale;
    this.lineChartWidth = sysInfo.windowWidth - 60;
    this.lineChartHeight = 125;
    this.barChartWidth = sysInfo.windowWidth - 60;
    this.barChartHeight = 100;
    
    // 设置canvas实际尺寸
    this.setData({ chartReady: true });
  },

  // 绘制饼图
  drawPieChart() {
    if (this.pieChartWidth === 0) {
      setTimeout(() => this.drawPieChart(), 100);
      return;
    }

    const { meals } = this.data.todayData;
    const { currentTheme } = this.data;
    
    const ctx = wx.createCanvasContext('pieChart');
    const width = this.pieChartWidth;
    const height = this.pieChartHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 5;
    
    const data = [
      { value: meals.breakfast, color: currentTheme === 'dark' ? '#D4A574' : '#C49A6C' },
      { value: meals.lunch, color: currentTheme === 'dark' ? '#5FA895' : '#4A9B8A' },
      { value: meals.dinner, color: currentTheme === 'dark' ? '#8B9EAF' : '#7A8E9F' },
      { value: meals.snack, color: currentTheme === 'dark' ? '#C98B8B' : '#B87B7B' }
    ];
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    // 绘制背景圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.setFillStyle(currentTheme === 'light' ? '#F3F4F6' : '#1E1E1E');
    ctx.fill();
    
    if (total === 0) {
      // 无数据时显示虚线圆环提示
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 10, 0, 2 * Math.PI);
      ctx.setStrokeStyle(currentTheme === 'light' ? '#D1D5DB' : '#2A2A2A');
      ctx.setLineWidth(20);
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      
      // 绘制中心文字
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
      ctx.setFillStyle(currentTheme === 'light' ? '#FFFFFF' : '#121212');
      ctx.fill();
      
      ctx.setFillStyle(currentTheme === 'light' ? '#6B7280' : '#6B7280');
      ctx.setFontSize(12);
      ctx.setTextAlign('center');
      ctx.fillText('暂无数据', centerX, centerY + 4);
    } else {
      let startAngle = -Math.PI / 2;
      
      data.forEach(item => {
        if (item.value > 0) {
          const sweepAngle = (item.value / total) * 2 * Math.PI;
          const endAngle = startAngle + sweepAngle;
          
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, endAngle);
          ctx.closePath();
          ctx.setFillStyle(item.color);
          ctx.fill();
          
          startAngle = endAngle;
        }
      });
      
      // 绘制中心空白（圆环效果）
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
      ctx.setFillStyle(currentTheme === 'light' ? '#F8FAF9' : '#121212');
      ctx.fill();
    }
    
    ctx.draw();
  },

  // 绘制折线图
  drawLineChart() {
    const { weekData } = this.data;
    const targetCal = this.data.todayData.targetCal;
    const { currentTheme } = this.data;
    
    const ctx = wx.createCanvasContext('lineChart');
    const width = this.lineChartWidth;
    const height = this.lineChartHeight;
    const padding = { top: 15, right: 15, bottom: 25, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // 找到最大值
    const maxCal = Math.max(...weekData.map(d => d.cal), targetCal * 1.2);
    
    // 绘制目标线
    const targetY = padding.top + chartHeight - (targetCal / maxCal) * chartHeight;
    ctx.beginPath();
    ctx.setStrokeStyle(currentTheme === 'light' ? '#D4A574' : '#D4A574');
    ctx.setLineWidth(2);
    ctx.setLineDash([5, 5]);
    ctx.moveTo(padding.left, targetY);
    ctx.lineTo(width - padding.right, targetY);
    ctx.stroke();
    
    // 绘制折线
    const xStep = chartWidth / 6;
    ctx.beginPath();
    ctx.setStrokeStyle(currentTheme === 'light' ? '#4A9B8A' : '#5FA895');
    ctx.setLineWidth(3);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');
    
    weekData.forEach((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.cal / maxCal) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // 绘制数据点和标签
    weekData.forEach((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.cal / maxCal) * chartHeight;
      
      // 数据点
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.setFillStyle(d.isOver ? (currentTheme === 'light' ? '#B87B7B' : '#C98B8B') : (currentTheme === 'light' ? '#4A9B8A' : '#5FA895'));
      ctx.fill();
      
      // 内部白点
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.setFillStyle(currentTheme === 'light' ? '#FFFFFF' : '#121212');
      ctx.fill();
      
      // 日期标签
      ctx.setFillStyle(currentTheme === 'light' ? '#6B7280' : '#6B7280');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.fillText(d.day, x, height - 8);
    });
    
    // Y轴标签
    ctx.setFillStyle(currentTheme === 'light' ? '#6B7280' : '#6B7280');
    ctx.setFontSize(10);
    ctx.setTextAlign('right');
    ctx.fillText(targetCal + '', padding.left - 5, targetY + 4);
    ctx.fillText('0', padding.left - 5, padding.top + chartHeight + 4);
    
    ctx.draw();
  },

  // 绘制柱状图
  drawBarChart() {
    const { meals } = this.data.todayData;
    const targetCal = this.data.todayData.targetCal;
    const { currentTheme } = this.data;
    
    if (this.barChartWidth === 0) {
      setTimeout(() => this.drawBarChart(), 100);
      return;
    }
    
    const ctx = wx.createCanvasContext('barChart');
    const width = this.barChartWidth;
    const height = this.barChartHeight;
    const padding = { top: 15, right: 15, bottom: 25, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const isDark = currentTheme === 'dark';
    const barData = [
      { name: '早餐', value: meals.breakfast, target: targetCal * 0.3, color: isDark ? '#D4A574' : '#C49A6C' },
      { name: '午餐', value: meals.lunch, target: targetCal * 0.4, color: isDark ? '#5FA895' : '#4A9B8A' },
      { name: '晚餐', value: meals.dinner, target: targetCal * 0.3, color: isDark ? '#8B9EAF' : '#7A8E9F' }
    ];
    
    const maxValue = Math.max(...barData.map(d => Math.max(d.value, d.target)));
    const barWidth = chartWidth / barData.length * 0.6;
    const barGap = chartWidth / barData.length;
    
    barData.forEach((d, i) => {
      const baseX = padding.left + i * barGap + (barGap - barWidth) / 2;
      
      // 推荐高度线
      const targetHeight = (d.target / maxValue) * chartHeight;
      const targetY = padding.top + chartHeight - targetHeight;
      
      ctx.beginPath();
      ctx.setStrokeStyle(isDark ? '#3A3A3A' : '#E5E7EB');
      ctx.setLineWidth(1);
      ctx.setLineDash([3, 3]);
      ctx.moveTo(baseX, targetY);
      ctx.lineTo(baseX + barWidth, targetY);
      ctx.stroke();
      
      // 实际高度柱
      const actualHeight = (d.value / maxValue) * chartHeight;
      const actualY = padding.top + chartHeight - actualHeight;
      
      ctx.beginPath();
      ctx.rect(baseX, actualY, barWidth, actualHeight);
      ctx.setFillStyle(d.value > d.target * 1.1 ? (isDark ? '#C98B8B' : '#B87B7B') : d.color);
      ctx.fill();
      
      // 标签
      ctx.setFillStyle(isDark ? '#F5F5F5' : '#1A1A1A');
      ctx.setFontSize(11);
      ctx.setTextAlign('center');
      ctx.fillText(d.name, baseX + barWidth / 2, height - 8);
    });
    
    ctx.draw();
  },

  // 目标输入
  onTargetInput(e) {
    this.setData({ customTarget: e.detail.value });
  },

  // 修改目标
  editTarget() {
    this.setData({ showTargetInput: true });
  },

  // 保存目标
  async saveTarget() {
    const target = parseInt(this.data.customTarget);
    if (!target || target < 500 || target > 5000) {
      this.showToast('请输入500-5000之间的数值');
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      await wx.cloud.callFunction({
        name: 'saveUserSettings',
        data: { dailyCalorieTarget: target }
      });
      
      this.showToast('目标已设定');
      this.setData({ showTargetInput: false });
      this.loadRecords();
    } catch (e) {
      console.error('云端保存失败', e);
      this.showToast('保存失败，请重试');
    } finally {
      wx.hideLoading();
    }
  },

  // 单位切换
  switchUnit(e) {
    const unit = e.currentTarget.dataset.unit;
    this.setData({ unit });
  },

  // 查看食谱
  goToRecipe() {
    wx.navigateTo({
      url: '/pages/recipe/recipe'
    });
  },

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadRecords().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});

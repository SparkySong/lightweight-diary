// pages/diet/diet.js
const app = getApp();

Page({
  data: {
    inputDate: '',
    mealType: 'breakfast',
    mealTypes: [
      { key: 'breakfast', label: '🌅 早餐', selected: true },
      { key: 'lunch', label: '☀️ 午餐', selected: false },
      { key: 'dinner', label: '🌙 晚餐', selected: false },
      { key: 'snack', label: '🍪 加餐', selected: false }
    ],
    foods: [{ name: '', calories: '' }],
    days: [],
    showAddPanel: false,
    toastMsg: '',
    toastShow: false,
    // 主题相关
    currentTheme: 'dark'
  },

  onLoad() {
    this.setTodayDate();
    this.initTheme();
  },

  onShow() {
    this.loadRecords();
    // 重新检查主题状态，确保页面显示正确的主题
    this.initTheme();
  },

  setTodayDate() {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({ inputDate: date });
  },

  async loadRecords() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      this.setData({ days: res.result.days || [] });
    } catch (e) {
      console.error('加载饮食记录失败', e);
    }
  },

  toggleAddPanel() {
    this.setData({ showAddPanel: !this.data.showAddPanel });
  },

  onDateChange(e) {
    this.setData({ inputDate: e.detail.value });
  },

  selectMealType(e) {
    const key = e.currentTarget.dataset.key;
    const mealTypes = this.data.mealTypes.map(m => ({
      ...m, selected: m.key === key
    }));
    this.setData({ mealType: key, mealTypes });
  },

  onFoodNameInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const foods = [...this.data.foods];
    foods[idx].name = e.detail.value;
    this.setData({ foods });
  },

  onFoodCalInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const foods = [...this.data.foods];
    foods[idx].calories = e.detail.value;
    this.setData({ foods });
  },

  addFoodItem() {
    if (this.data.foods.length >= 10) {
      this.showToast('最多添加10项');
      return;
    }
    this.setData({
      foods: [...this.data.foods, { name: '', calories: '' }]
    });
  },

  removeFoodItem(e) {
    const idx = e.currentTarget.dataset.idx;
    if (this.data.foods.length <= 1) {
      this.setData({ foods: [{ name: '', calories: '' }] });
      return;
    }
    const foods = this.data.foods.filter((_, i) => i !== idx);
    this.setData({ foods });
  },

  async onSubmit() {
    const { inputDate, mealType, foods } = this.data;

    if (!inputDate) { this.showToast('请选择日期'); return; }

    const validFoods = foods.filter(f => f.name.trim());
    if (validFoods.length === 0) { this.showToast('请至少输入一项食物'); return; }

    const totalCal = validFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);

    wx.showLoading({ title: '保存中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addDietRecord',
        data: {
          date: inputDate,
          mealType,
          foods: validFoods,
          calories: totalCal
        }
      });
      if (res.result.success) {
        this.showToast('记录成功 🍽️');
        this.setData({
          foods: [{ name: '', calories: '' }],
          showAddPanel: false
        });
        this.loadRecords();
      }
    } catch (e) {
      this.showToast('保存失败');
    }
    wx.hideLoading();
  },

  async onDeleteDiet(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除这条饮食记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({ name: 'deleteDietRecord', data: { id } });
            this.showToast('已删除');
            this.loadRecords();
          } catch (e) {
            this.showToast('删除失败');
          }
        }
      }
    });
  },

  // 预设食物快速添加
  quickAdd(e) {
    const item = e.currentTarget.dataset.item;
    const foods = [...this.data.foods];
    const emptyIdx = foods.findIndex(f => !f.name.trim());
    if (emptyIdx >= 0) {
      foods[emptyIdx] = { ...item };
    } else {
      foods.push({ ...item });
    }
    this.setData({ foods });
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
    if (theme === 'light') {
      // 浅色模式：设置浅色背景
      wx.setBackgroundColor({
        backgroundColor: '#f8f9fa',
        backgroundColorTop: '#f8f9fa',
        backgroundColorBottom: '#f8f9fa',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'dark' // 浅色背景上用黑色文字
      });
    } else {
      // 深色模式：设置深色背景
      wx.setBackgroundColor({
        backgroundColor: '#0f0f13',
        backgroundColorTop: '#0f0f13',
        backgroundColorBottom: '#0f0f13',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'light' // 深色背景上用白色文字
      });
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    console.log('饮食页面下拉刷新开始');
    
    // 加载数据
    this.loadRecords().then(() => {
      // 停止下拉刷新
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 500);
    });
  }
});

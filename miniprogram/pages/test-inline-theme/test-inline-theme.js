// pages/test-inline-theme/test-inline-theme.js
Page({
  data: {
    currentTheme: 'dark',
    showDialog: false
  },

  onLoad() {
    // 获取当前主题
    const app = getApp();
    this.setData({
      currentTheme: app.globalData.currentTheme || 'dark'
    });
  },

  toggleTheme() {
    const newTheme = this.data.currentTheme === 'dark' ? 'light' : 'dark';
    this.setData({
      currentTheme: newTheme
    });
  },

  showDialog() {
    this.setData({
      showDialog: true
    });
  },

  hideDialog() {
    this.setData({
      showDialog: false
    });
  },

  onConfirm() {
    wx.showToast({
      title: '确认成功',
      icon: 'success'
    });
    this.hideDialog();
  },

  onCancel() {
    this.hideDialog();
  }
});
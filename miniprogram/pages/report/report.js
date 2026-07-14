const Toast = require("../../vant/toast/toast");
// pages/report/report.js
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

Page({
  data: {
    currentTheme: getInitTheme(),
    activeTab: 'weekly',
    reports: [],
    loading: true,
    generating: false,
    currentReport: null
  },

  onLoad() {
    this.initTheme();
    this.loadReports();
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

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab, currentReport: null });
    this.loadReports(tab);
  },

  async loadReports(type) {
    type = type || this.data.activeTab;
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getReports',
        data: { type, limit: 20 }
      });
      const reports = (res.result?.data || []).map(r => ({
        ...r,
        typeLabel: r.type === 'weekly' ? '周报' : '月报',
        dateRange: `${r.startDate} ~ ${r.endDate}`,
        weightChangeDisplay: r.weightChange > 0 ? `+${r.weightChange}` : String(r.weightChange),
        weightChangeAbs: Math.abs(r.weightChange),
        isLoss: r.weightChange < 0
      }));
      this.setData({ reports, loading: false });
      // 如果当前选中的报告不在新列表中，重新选中第一个
      const currentInList = reports.find(r => r._id === this.data.currentReport?._id);
      if (!currentInList && reports.length > 0) {
        this.setData({ currentReport: reports[0] });
      }
    } catch (e) {
      console.error('加载报告失败', e);
      this.setData({ loading: false });
    }
  },

  async onGenerateReport() {
    if (this.data.generating) return;
    
    this.setData({ generating: true });
    wx.showLoading({ title: '生成中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateReport',
        data: { type: this.data.activeTab }
      });
      wx.hideLoading();
      if (res.result?.success) {
        this.showToast(res.result.report?.isOverwrite ? '报告已覆盖更新' : '报告已生成');
        await this.loadReports();
      } else {
        const errMsg = res.result?.error || '生成失败';
        wx.showModal({
          title: '生成失败',
          content: errMsg,
          showCancel: false
        });
      }
    } catch (e) {
      wx.hideLoading();
      this.showToast('生成失败');
    }
    this.setData({ generating: false });
  },

  onSelectReport(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ currentReport: this.data.reports[idx] });
  },

  goBack() {
    wx.navigateBack();
  },

  showToast(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  }
});

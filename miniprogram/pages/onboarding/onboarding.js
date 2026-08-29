const app = getApp();

Page({
  data: {
    currentTheme: 'dark',
    step: 1,
    gender: 'female',
    height: '',
    unit: 'kg',
    currentWeight: '',
    goalWeight: '',
    error: ''
  },

  onLoad() {
    this.setData({ currentTheme: app.getEffectiveTheme() });
  },

  setGender(e) {
    this.setData({ gender: e.currentTarget.dataset.gender, error: '' });
  },

  setUnit(e) {
    this.setData({ unit: e.currentTarget.dataset.unit, error: '' });
  },

  onHeight(e) {
    this.setData({ height: e.detail.value, error: '' });
  },

  onCurrent(e) {
    this.setData({ currentWeight: e.detail.value, error: '' });
  },

  onGoal(e) {
    this.setData({ goalWeight: e.detail.value, error: '' });
  },

  back() {
    this.setData({ step: this.data.step - 1, error: '' });
  },

  next() {
    const { step, height, currentWeight, unit } = this.data;
    if (step === 1) {
      const h = parseFloat(height);
      if (!h || h < 100 || h > 250) {
        this.setData({ error: '请输入 100-250 之间的身高' });
        return;
      }
      this.setData({ step: 2, error: '' });
    } else if (step === 2) {
      const w = parseFloat(currentWeight);
      const min = unit === 'jin' ? 40 : 20;
      const max = unit === 'jin' ? 600 : 300;
      if (!w || w < min || w > max) {
        this.setData({ error: `请输入 ${min}-${max} 之间的体重` });
        return;
      }
      this.setData({ step: 3, error: '' });
    } else {
      const g = parseFloat(this.data.goalWeight);
      if (g) {
        const gmin = unit === 'jin' ? 40 : 20;
        const gmax = unit === 'jin' ? 600 : 300;
        if (g < gmin || g > gmax) {
          this.setData({ error: `请输入 ${gmin}-${gmax} 之间的目标体重` });
          return;
        }
      }
      this.finish();
    }
  },

  skipAll() {
    wx.setStorageSync('onboarded', 1);
    wx.reLaunch({ url: '/pages/index/index' });
  },

  toKg(v) {
    return this.data.unit === 'jin' ? v / 2 : v;
  },

  async finish() {
    const { gender, height, unit, currentWeight, goalWeight } = this.data;
    const curKg = parseFloat(this.toKg(parseFloat(currentWeight)).toFixed(2));
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    wx.setStorageSync('userGender', gender);
    wx.setStorageSync('userHeight', parseFloat(height));
    wx.setStorageSync('localProfile', { height: parseFloat(height) });
    wx.setStorageSync('weightUnit', unit);

    const localRecords = wx.getStorageSync('localRecords') || [];
    localRecords.unshift({ date: today, weight: curKg });
    wx.setStorageSync('localRecords', localRecords);

    let goalKg = null;
    const g = parseFloat(goalWeight);
    if (g) {
      goalKg = parseFloat(this.toKg(g).toFixed(2));
      wx.setStorageSync('localGoal', goalKg);
      const wd = wx.getStorageSync('weightData') || {};
      wd.targetWeight = goalKg;
      wd.currentWeight = curKg;
      wx.setStorageSync('weightData', wd);
    }

    try {
      // 引导数据即用户当前真实数据，直接同步云端（同日记录为更新语义）
      await wx.cloud.callFunction({ name: 'addRecord', data: { date: today, weight: curKg } });
      if (goalKg) {
        await wx.cloud.callFunction({ name: 'setGoal', data: { goal: goalKg } });
      }
      const profileSync = { height: parseFloat(height), gender, weightUnit: unit };
        if (goalKg) profileSync.goalWeight = goalKg;
        await wx.cloud.callFunction({ name: 'saveUserSettings', data: profileSync });
    } catch (e) {
      console.warn('引导数据云端同步失败，已保存本地', e);
    }

    wx.setStorageSync('onboarded', 1);
    wx.reLaunch({ url: '/pages/index/index' });
  }
});

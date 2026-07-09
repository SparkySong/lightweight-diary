// pages/period/period.js
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

const SYMPTOMS_LIST = ['痛经', '头痛', '疲劳', '情绪波动', '腹胀', '腰酸', '胸胀', '失眠'];
const FLOW_OPTIONS = [
  { value: 'light', label: '少量' },
  { value: 'medium', label: '中等' },
  { value: 'heavy', label: '大量' }
];

const formatDateStr = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

Page({
  data: {
    currentTheme: getInitTheme(),
    today: formatDateStr(new Date()),
    // 日历
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    calendarDays: [],
    // 经期数据
    periods: [],
    hasOngoing: false,
    ongoingRecord: null,
    // 预测
    avgCycleLength: 28,
    nextPeriodDate: '',
    ovulationDate: '',
    cycleDay: 0, // 月经干净天数（日常口语）
    cycleDayMedical: 0, // 周期第X天（医学标准）
    // UI
    showRecordPopup: false,
    recordAction: 'start', // 'start' | 'edit'
    editingRecordId: '',
    selectedFlow: 'medium',
    selectedSymptoms: [],
    selectedDate: formatDateStr(new Date()),
    selectedEndDate: '',
    symptomsList: SYMPTOMS_LIST,
    customSymptoms: [],
    customSymptomInput: '',
    showCustomInput: false,
    flowOptions: FLOW_OPTIONS,
    loading: true,
    // Toast
    toastMsg: '',
    toastShow: false
  },

  onLoad() {
    this.initTheme();
    this.generateCalendar();
    this.loadPeriods();
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

  // 生成月历
  generateCalendar() {
    const { currentYear, currentMonth } = this.data;
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = [];
    // 前面的空白
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', date: '', type: 'empty' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, date: dateStr, type: 'normal' });
    }
    this.setData({ calendarDays: days });
    this.markCalendarDays();
  },

  // 标记日历上的经期日、预测经期、排卵日
  markCalendarDays() {
    const { calendarDays, periods, nextPeriodDate, ovulationDate, today } = this.data;
    const updated = calendarDays.map(d => {
      if (d.type === 'empty') return d;
      let type = 'normal';
      let label = '';
      // 检查是否是经期日
      for (const p of periods) {
        const start = p.startDate;
        const end = p.endDate || formatDateStr(new Date()); // 未结束则到今天
        if (d.date >= start && d.date <= end) {
          type = 'period';
          label = '经期';
          break;
        }
      }
      // 预测经期
      if (nextPeriodDate && d.date === nextPeriodDate && type === 'normal') {
        type = 'predicted';
        label = '预计';
      }
      // 排卵日
      if (ovulationDate && d.date === ovulationDate && type === 'normal') {
        type = 'ovulation';
        label = '排卵';
      }
      // 今天
      if (d.date === today) {
        d.isToday = true;
      }
      return { ...d, type, label };
    });
    this.setData({ calendarDays: updated });
  },

  // 加载经期数据
  async loadPeriods() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getPeriods',
        data: { limit: 50 }
      });
      const periods = res.result?.data || [];
      // 统一计算持续天数（避免数据库脏数据导致显示错误）
      periods.forEach(p => {
        if (p.startDate && p.endDate) {
          p.periodLength = Math.ceil(
            (new Date(p.endDate) - new Date(p.startDate)) / (1000 * 60 * 60 * 24)
          ) + 1;
        } else if (p.startDate) {
          // 进行中的，按到今天算
          p.periodLength = Math.ceil(
            (new Date(formatDateStr(new Date())) - new Date(p.startDate)) / (1000 * 60 * 60 * 24)
          ) + 1;
        } else {
          p.periodLength = 0;
        }
      });
      const hasOngoing = periods.some(p => !p.endDate);
      const ongoingRecord = periods.find(p => !p.endDate) || null;

      // 计算平均周期
      const completedPeriods = periods.filter(p => p.endDate);
      let avgCycleLength = 28;
      if (completedPeriods.length >= 2) {
        let totalDiff = 0;
        for (let i = 0; i < completedPeriods.length - 1 && i < 5; i++) {
          const d1 = new Date(completedPeriods[i].startDate);
          const d2 = new Date(completedPeriods[i + 1].startDate);
          totalDiff += Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        }
        const count = Math.min(completedPeriods.length - 1, 5);
        avgCycleLength = Math.round(totalDiff / count);
      }

      // 预测下次经期和排卵日
      let nextPeriodDate = '';
      let ovulationDate = '';
      let cycleDay = 0; // 月经干净天数（日常口语）
      let cycleDayMedical = 0; // 周期第X天（医学标准）
      if (periods.length > 0) {
        const lastStart = new Date(periods[0].startDate);
        if (!hasOngoing) {
          const nextDate = new Date(lastStart);
          nextDate.setDate(nextDate.getDate() + avgCycleLength);
          nextPeriodDate = formatDateStr(nextDate);
          // 排卵日 = 下次经期 - 14天
          const ovDate = new Date(nextDate);
          ovDate.setDate(ovDate.getDate() - 14);
          ovulationDate = formatDateStr(ovDate);
        }
        // 计算两个周期天数
        const todayDate = new Date();
        const todayStr = formatDateStr(todayDate);
        const startStr = periods[0].startDate;
        // 医学标准：从经期开始日计算（周期第X天）
        cycleDayMedical = Math.floor((new Date(todayStr) - new Date(startStr)) / (1000 * 60 * 60 * 24)) + 1;
        if (periods[0].endDate) {
          // 经期已结束，月经干净天数从结束日开始计算
          const endStr = periods[0].endDate;
          cycleDay = Math.floor((new Date(todayStr) - new Date(endStr)) / (1000 * 60 * 60 * 24));
        } else {
          // 经期进行中，月经干净天数为0
          cycleDay = 0;
        }
      }

      this.setData({
        periods, hasOngoing, ongoingRecord,
        avgCycleLength, nextPeriodDate, ovulationDate, cycleDay, cycleDayMedical,
        loading: false
      });
      this.markCalendarDays();
    } catch (e) {
      console.error('加载经期数据失败', e);
      this.setData({ loading: false });
    }
  },

  // 月份切换
  onPrevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
    this.markCalendarDays();
  },

  onNextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
    this.markCalendarDays();
  },

  // 经期来了
  onStartPeriod() {
    if (this.data.hasOngoing) {
      this.showToast('当前已有进行中的经期');
      return;
    }
    this.setData({
      showRecordPopup: true,
      selectedFlow: 'medium',
      selectedSymptoms: [],
      selectedDate: formatDateStr(new Date()),
      customSymptoms: [],
      customSymptomInput: '',
      showCustomInput: false,
      recordAction: 'start'
    });
  },

  // 经期结束
  onEndPeriod() {
    if (!this.data.hasOngoing) {
      this.showToast('当前没有进行中的经期');
      return;
    }
    wx.showModal({
      title: '确认',
      content: '确认今天为经期结束日？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '保存中...' });
          try {
            const result = await wx.cloud.callFunction({
              name: 'addPeriod',
              data: { action: 'end' }
            });
            wx.hideLoading();
            if (result.result?.success) {
              this.showToast('经期已结束');
              await this.loadPeriods();
            } else {
              this.showToast(result.result?.error || '操作失败');
            }
          } catch (e) {
            wx.hideLoading();
            this.showToast('操作失败');
          }
        }
      }
    });
  },

  // 弹窗操作
  onClosePopup() {
    this.setData({ showRecordPopup: false });
  },

  onFlowSelect(e) {
    this.setData({ selectedFlow: e.currentTarget.dataset.flow });
  },

  onSymptomToggle(e) {
    const index = e.currentTarget.dataset.index;
    const selected = [...this.data.selectedSymptoms];
    selected[index] = !selected[index];
    this.setData({ selectedSymptoms: selected });
  },

  // 点击+号显示输入
  onShowCustomInput() {
    this.setData({ showCustomInput: true });
  },

  // 自定义症状输入
  onCustomSymptomInput(e) {
    this.setData({ customSymptomInput: e.detail.value });
  },

  // 添加自定义症状
  onAddCustomSymptom() {
    const val = this.data.customSymptomInput.trim();
    if (!val) {
      this.setData({ showCustomInput: false });
      return;
    }
    const allSymptoms = [...this.data.symptomsList, ...this.data.customSymptoms];
    if (allSymptoms.includes(val)) {
      this.showToast('该症状已存在');
      this.setData({ showCustomInput: false, customSymptomInput: '' });
      return;
    }
    const customSymptoms = [...this.data.customSymptoms, val];
    const selectedSymptoms = [...this.data.selectedSymptoms, true];
    this.setData({
      customSymptoms,
      selectedSymptoms,
      customSymptomInput: '',
      showCustomInput: false
    });
  },

  // 删除自定义症状
  onRemoveCustomSymptom(e) {
    const idx = e.currentTarget.dataset.idx;
    const baseLen = this.data.symptomsList.length;
    const removeAt = baseLen + idx;
    const customSymptoms = [...this.data.customSymptoms];
    customSymptoms.splice(idx, 1);
    const selectedSymptoms = [...this.data.selectedSymptoms];
    selectedSymptoms.splice(removeAt, 1);
    this.setData({ customSymptoms, selectedSymptoms });
  },

  onDateChange(e) {
    this.setData({ selectedDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ selectedEndDate: e.detail.value });
  },

  // 编辑历史记录
  onEditPeriod(e) {
    const item = e.currentTarget.dataset.item;
    const allSymptoms = [...this.data.symptomsList, ...this.data.customSymptoms];
    const symptomArr = new Array(allSymptoms.length).fill(false);
    if (item.symptoms && item.symptoms.length > 0) {
      item.symptoms.forEach(s => {
        const idx = allSymptoms.indexOf(s);
        if (idx >= 0) symptomArr[idx] = true;
      });
    }
    // 识别出记录中的自定义症状
    const customInRecord = (item.symptoms || []).filter(s => !SYMPTOMS_LIST.includes(s));
    this.setData({
      showRecordPopup: true,
      recordAction: 'edit',
      editingRecordId: item._id,
      selectedDate: item.startDate,
      selectedEndDate: item.endDate || '',
      selectedFlow: item.flow || 'medium',
      selectedSymptoms: symptomArr,
      customSymptoms: customInRecord
    });
  },

  // 确认编辑
  async onConfirmEdit() {
    wx.showLoading({ title: '保存中...' });
    try {
      const allSymptoms = [...this.data.symptomsList, ...this.data.customSymptoms];
      const symptoms = allSymptoms.filter((_, i) => this.data.selectedSymptoms[i]);
      const result = await wx.cloud.callFunction({
        name: 'addPeriod',
        data: {
          action: 'update',
          id: this.data.editingRecordId,
          startDate: this.data.selectedDate,
          endDate: this.data.selectedEndDate || null,
          flow: this.data.selectedFlow,
          symptoms: symptoms
        }
      });
      wx.hideLoading();
      if (result.result?.success) {
        this.showToast('已更新');
        this.setData({ showRecordPopup: false });
        await this.loadPeriods();
      } else {
        this.showToast(result.result?.error || '保存失败');
      }
    } catch (e) {
      wx.hideLoading();
      this.showToast('保存失败');
    }
  },

  onPickerCancel() {},

  async onConfirmRecord() {
    wx.showLoading({ title: '保存中...' });
    try {
      // 将布尔数组转换为实际症状名称
      const allSymptoms = [...this.data.symptomsList, ...this.data.customSymptoms];
      const symptoms = allSymptoms.filter((_, i) => this.data.selectedSymptoms[i]);
      const result = await wx.cloud.callFunction({
        name: 'addPeriod',
        data: {
          action: 'start',
          startDate: this.data.selectedDate,
          flow: this.data.selectedFlow,
          symptoms: symptoms
        }
      });
      wx.hideLoading();
      if (result.result?.success) {
        this.showToast('经期已记录');
        this.setData({ showRecordPopup: false });
        await this.loadPeriods();
      } else {
        this.showToast(result.result?.error || '保存失败');
      }
    } catch (e) {
      wx.hideLoading();
      this.showToast('保存失败');
    }
  },

  // 删除记录
  onDeletePeriod(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除该经期记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({ name: 'deletePeriod', data: { id } });
            this.showToast('已删除');
            await this.loadPeriods();
          } catch (e) {
            this.showToast('删除失败');
          }
        }
      }
    });
  },

  stopPropagation() {},
  preventTouchMove() {},

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  },

  goBack() {
    wx.navigateBack();
  }
});

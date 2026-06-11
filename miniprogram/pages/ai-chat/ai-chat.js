// pages/ai-chat/ai-chat.js
const app = getApp();

// 欢迎消息
const WELCOME_MSG = '你好呀！我是你的 AI 营养师 🥗\n\n我已经读取了你的健康档案和饮食记录，你可以直接问我：\n- 分析一下我的情况\n- 我的BMI正常吗\n- 今天吃得怎么样\n\n当然也可以问我任何饮食、减脂的问题～';

// 默认头像（灰色圆形占位图）
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI0MCIgZmlsbD0iIzNhM2E0YSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMzIiIHI9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PGVsbGlwc2UgY3g9IjQwIiBjeT0iNjgiIHJ4PSIyNCIgcnk9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PC9zdmc+';

Page({
  data: {
    messages: [],
    inputValue: '',
    isLoading: false,
    scrollToView: '',
    dietContext: '',
    userContext: '',
    userAvatar: DEFAULT_AVATAR,
    copiedIndex: -1,
    currentTheme: app.getEffectiveTheme(),
    quickQuestions: [
      '分析我的整体情况',
      '我的BMI正常吗',
      '今天吃得怎么样',
      '给我一条健康建议'
    ]
  },

  onLoad(options) {
    // 从本地恢复聊天记录
    const savedMessages = wx.getStorageSync('aiChatMessages');
    const welcomeMsg = { role: 'assistant', content: WELCOME_MSG };
    if (savedMessages && savedMessages.length > 0) {
      this.setData({ messages: savedMessages });
    } else {
      this.setData({ messages: [welcomeMsg] });
    }

    // 构建用户健康档案
    this.setData({ userContext: this.buildUserContext() });

    // 加载用户头像
    const savedAvatar = wx.getStorageSync('avatarUrl');
    if (savedAvatar) {
      this.setData({ userAvatar: savedAvatar });
    }

    // 自动从云端加载饮食记录
    this.loadDietData();

    // 如果从饮食页面跳转并携带了饮食数据，覆盖云端数据
    if (options.dietData) {
      try {
        const dietData = JSON.parse(decodeURIComponent(options.dietData));
        const context = this.buildDietContext(dietData);
        this.setData({ dietContext: context });
      } catch (e) {
        console.warn('解析饮食数据失败', e);
      }
    }

    // 设置导航栏颜色
    this.setNavColor();
    // 滚动到底部
    setTimeout(() => this.scrollToBottom(), 100);
  },

  onShow() {
    this.initTheme();
  },

  initTheme() {
    const theme = app.getEffectiveTheme();
    if (this.data.currentTheme !== theme) {
      this.setData({ currentTheme: theme });
      this.setNavColor();
    }
  },

  setNavColor() {
    const theme = this.data.currentTheme;
    if (theme === 'light') {
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#F8FAF9',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    } else {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#121212',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    }
  },

  // 从云端加载饮食记录
  async loadDietData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      const days = res.result.days || [];
      if (days.length > 0) {
        const recentDays = days.slice(0, 3);
        const context = this.buildDietContext(recentDays);
        this.setData({ dietContext: context });
      }
    } catch (e) {
      console.warn('加载饮食记录失败', e);
    }
  },

  // 构建用户健康档案上下文
  buildUserContext() {
    const parts = [];

    const height = wx.getStorageSync('userHeight');
    if (height) parts.push(`身高：${height}cm`);

    const weightData = wx.getStorageSync('weightData') || {};
    const weightUnit = wx.getStorageSync('weightUnit') || 'kg';
    const toJin = weightUnit === 'jin' ? 2 : 1;
    const unitLabel = weightUnit === 'jin' ? '斤' : 'kg';

    if (weightData.currentWeight) {
      const cwKg = weightData.currentWeight;
      const cwJin = (cwKg * 2).toFixed(1);
      parts.push(`当前体重：${cwJin}斤（${cwKg.toFixed(1)}kg）`);
    }
    if (weightData.targetWeight) {
      const twKg = weightData.targetWeight;
      const twJin = (twKg * 2).toFixed(1);
      parts.push(`目标体重：${twJin}斤（${twKg.toFixed(1)}kg）`);
      if (weightData.currentWeight) {
        const diffJin = ((weightData.currentWeight - weightData.targetWeight) * 2).toFixed(1);
        const diffKg = (weightData.currentWeight - weightData.targetWeight).toFixed(1);
        if (diffJin > 0) {
          parts.push(`距目标：还差${diffJin}斤（${diffKg}kg），这是已计算好的准确数值`);
        } else {
          parts.push(`距目标：已达标！超出${Math.abs(diffJin)}斤`);
        }
      }
    }

    if (height && weightData.currentWeight) {
      const bmi = (weightData.currentWeight / Math.pow(height / 100, 2)).toFixed(1);
      let bmiLevel = '';
      if (bmi < 18.5) bmiLevel = '偏瘦';
      else if (bmi < 24) bmiLevel = '正常';
      else if (bmi < 28) bmiLevel = '偏胖';
      else bmiLevel = '肥胖';
      parts.push(`BMI：${bmi}（${bmiLevel}）`);
    }

    const calorieGoal = wx.getStorageSync('localCalorieGoal');
    if (calorieGoal) parts.push(`每日热量目标：${calorieGoal}kcal`);

    const localRecords = wx.getStorageSync('localRecords') || [];
    if (localRecords.length >= 2) {
      const sorted = [...localRecords].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const diff = ((first.weight - last.weight) * toJin).toFixed(1);
      parts.push(`打卡${sorted.length}次，体重变化：${diff > 0 ? '减了' : '涨了'}${Math.abs(diff)}${unitLabel}`);
    }

    if (parts.length === 0) return '（用户暂未填写健康档案）';
    return '【用户健康档案】\n' + parts.join('\n');
  },

  // 构建饮食上下文文本
  buildDietContext(dietData) {
    if (!dietData || !dietData.length) return '';
    const lines = dietData.map(day => {
      const records = day.records.map(r => {
        const foods = r.foods.map(f => `${f.name}(${f.calories || 0}kcal)`).join('、');
        return `  ${r.mealLabel}：${foods}`;
      }).join('\n');
      return `【${day.date}】共 ${day.totalCal} kcal\n${records}`;
    }).join('\n\n');
    return '【近期饮食记录】\n' + lines;
  },

  // 快捷提问
  onQuickQuestion(e) {
    const question = e.currentTarget.dataset.q;
    if (this.data.isLoading) return;
    this.sendMessage(question);
  },

  // 输入框输入
  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  // 发送消息
  async onSend() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.isLoading) return;
    this.sendMessage(text);
  },

  // 核心：发送消息并获取 AI 回复
  async sendMessage(text) {
    // 添加用户消息
    const userMsg = { role: 'user', content: text };
    const messages = [...this.data.messages, userMsg];
    this.setData({
      messages,
      inputValue: '',
      isLoading: true,
      userContext: this.buildUserContext()
    });
    this.saveMessages(messages);
    this.scrollToBottom();

    // 构建发送给云函数的消息（只保留最近的 10 条，避免 token 超限）
    const recentMessages = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiChat',
        data: {
          messages: recentMessages,
          userContext: this.data.userContext || '',
          dietContext: this.data.dietContext || ''
        }
      });

      const result = res.result || {};
      if (result.success && result.reply) {
        const aiMsg = { role: 'assistant', content: result.reply };
        const updatedMessages = [...this.data.messages, aiMsg];
        this.setData({
          messages: updatedMessages,
          isLoading: false
        });
        this.saveMessages(updatedMessages);
      } else {
        const errMsg = {
          role: 'assistant',
          content: `抱歉，出了点小问题：${result.error || '未知错误'}\n请稍后再试试～`
        };
        const errMessages = [...this.data.messages, errMsg];
        this.setData({
          messages: errMessages,
          isLoading: false
        });
        this.saveMessages(errMessages);
      }
    } catch (err) {
      console.error('调用 AI 云函数失败:', err);
      const errMsg = {
        role: 'assistant',
        content: `服务异常：${err.message || '未知错误'}\n请稍后再试试～`
      };
      const netMessages = [...this.data.messages, errMsg];
      this.setData({
        messages: netMessages,
        isLoading: false
      });
      this.saveMessages(netMessages);
    }

    this.scrollToBottom();
  },

  // 滚动到底部
  scrollToBottom() {
    const messages = this.data.messages;
    if (messages.length > 0) {
      this.setData({
        scrollToView: `msg-${messages.length - 1}`
      });
    }
  },

  // 保存聊天记录到本地（最多保留 50 条）
  saveMessages(messages) {
    const toSave = messages.slice(-50);
    wx.setStorageSync('aiChatMessages', toSave);
  },

  // 复制消息内容
  onCopyMessage(e) {
    const text = e.currentTarget.dataset.text;
    const index = e.currentTarget.dataset.index;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.hideToast();
        this.setData({ copiedIndex: index });
        setTimeout(() => {
          this.setData({ copiedIndex: -1 });
        }, 3000);
      }
    });
  },

  // 清空对话
  onClearChat() {
    wx.showModal({
      title: '清空对话',
      content: '确定要清空当前聊天记录吗？',
      success: (res) => {
        if (res.confirm) {
          const welcomeMsg = { role: 'assistant', content: WELCOME_MSG };
          const msgs = [welcomeMsg];
          this.setData({
            messages: msgs,
            dietContext: ''
          });
          this.saveMessages(msgs);
        }
      }
    });
  }
});

// pages/ai-chat/ai-chat.js
const app = getApp();

// 欢迎消息
const WELCOME_MSG = '你好呀！我是你的 AI 营养师 🥗\n\n你可以跟我说今天吃了什么，我来帮你分析热量和营养；也可以问我任何关于饮食、减脂的问题～\n\n试试点击下方快捷提问开始吧！';

Page({
  data: {
    messages: [],        // 消息列表: [{role: 'user'|'assistant', content: ''}]
    inputValue: '',      // 输入框内容
    isLoading: false,    // AI 正在回复
    scrollToView: '',    // 滚动到底部
    dietContext: '',     // 携带的饮食记录上下文
    // 主题
    currentTheme: app.getEffectiveTheme(),
    // 快捷提问
    quickQuestions: [
      '分析今日饮食',
      '推荐减脂晚餐',
      '蛋白质怎么补',
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

    // 如果从饮食页面跳转并携带了饮食数据
    if (options.dietData) {
      try {
        const dietData = JSON.parse(decodeURIComponent(options.dietData));
        const context = this.buildDietContext(dietData);
        this.setData({ dietContext: context });
        // 自动发送分析请求
        setTimeout(() => {
          this.sendDietAnalysis(context);
        }, 500);
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
    return lines;
  },

  // 发送饮食分析（自动模式）
  sendDietAnalysis(context) {
    const userMsg = '请帮我分析一下今天的饮食记录';
    this.sendMessage(userMsg);
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
      isLoading: true
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
        content: '网络不太好，检查一下网络再试试吧～'
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

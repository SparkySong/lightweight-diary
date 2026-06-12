// pages/ai-chat/ai-chat.js —— 混合模式：数据问题用模板，开放问题用 AI + 流式输出
const app = getApp();

// 欢迎消息
const WELCOME_MSG = '你好呀！我是你的专属营养师 🤖\n\n你可以直接问我：\n- 分析一下我的情况\n- 我的BMI正常吗\n- 今天吃得怎么样\n\n也可以问我任何饮食、减脂的问题～';

// 默认头像
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSI0MCIgZmlsbD0iIzNhM2E0YSIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMzIiIHI9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PGVsbGlwc2UgY3g9IjQwIiBjeT0iNjgiIHJ4PSIyNCIgcnk9IjE2IiBmaWxsPSIjNmE2YTdhIi8+PC9zdmc+';

Page({
  data: {
    messages: [],
    inputValue: '',
    isLoading: false,
    isStreaming: false,       // 流式输出进行中
    scrollToView: '',
    knowledgeBase: '',
    userAvatar: DEFAULT_AVATAR,
    copiedIndex: -1,
    currentTheme: app.getEffectiveTheme(),
    hidePage: false,
    quickQuestions: [
      '分析我的整体情况',
      '我的BMI正常吗',
      '今天吃得怎么样',
      '给我一条健康建议'
    ],
    // 编辑模式状态
    editIndex: -1,
    editValue: ''
  },

  // 流式输出定时器引用
  _typingTimer: null,

  async onLoad(options) {
    const savedMessages = wx.getStorageSync('aiChatMessages');
    const welcomeMsg = { role: 'assistant', content: WELCOME_MSG };
    if (savedMessages && savedMessages.length > 0) {
      this.setData({ messages: savedMessages });
    } else {
      this.setData({ messages: [welcomeMsg] });
    }

    const savedAvatar = wx.getStorageSync('avatarUrl');
    if (savedAvatar) {
      this.setData({ userAvatar: savedAvatar });
    }

    try {
      await Promise.all([this.loadDietData(), this.refreshWeightFromCloud()]);
    } catch (e) {
      console.warn('预加载数据失败，使用缓存:', e);
    }
    this.buildKnowledgeBase();

    if (options.dietData) {
      try {
        const dietData = JSON.parse(decodeURIComponent(options.dietData));
        this._externalDietData = dietData;
        this.buildKnowledgeBase();
      } catch (e) {
        console.warn('解析饮食数据失败', e);
      }
    }

    this.initTheme();
    setTimeout(() => this.scrollToBottom(), 100);
  },

  onShow() {
    // 每次进入页面都重新初始化主题
    this.initTheme();
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

  // ===== 数据加载 =====

  _dietRawData: null,

  async loadDietData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      const days = res.result.days || [];
      this._dietRawData = days.length > 0 ? days.slice(0, 2) : null;
    } catch (e) {
      console.warn('加载饮食记录失败', e);
    }
  },

  async refreshWeightFromCloud() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRecords', data: { range: 1 }, timeout: 10000
      });
      const records = res.result.data || [];
      if (records.length > 0) {
        const latestKg = parseFloat(records[0].weight);
        if (latestKg) {
          const weightData = wx.getStorageSync('weightData') || {};
          weightData.currentWeight = latestKg;
          wx.setStorageSync('weightData', weightData);
        }
      }
    } catch (e) {
      console.warn('刷新体重数据失败', e);
    }
  },

  // ===== 意图识别 =====

  _detectIntent(text) {
    const t = text.toLowerCase().trim();
    // 食品安全/健康咨询类问题 → 走 AI，不要用模板
    if (/隔夜|放冰箱|冷藏|加热.*吃|微波炉|变质|坏了|能.*吃|可以.*吃|安全吗|有没有毒|细菌|保质期|过期|剩菜|剩饭|外卖|路边摊|卫生|食物中毒/.test(t)) return 'general';
    if (/bmi|体质指数|体重指数/.test(t)) return 'bmi';
    if (/体重|多重|多重了|目前多重|当前多重|减了|瘦了|胖了/.test(t) && !/饮食|吃|食谱|建议|怎么/.test(t)) return 'weight';
    // today_diet 排除：不是在问"我今天吃了什么/记录"，而是其他涉及"吃"的问题
    if (/(今天|今日).*(饮食|吃了什么|摄入|热量)/.test(t) || /今天吃.*怎么样|今天吃得/.test(t)) return 'today_diet';
    if (/分析.*情况|整体.*情况|我的情况|综合.*分析|全面.*分析/.test(t)) return 'overview';
    if (/饮食记录|吃了什么|最近.*吃|昨天.*吃|前天.*吃/.test(t)) return 'diet_history';
    if (/目标|还差多少|距目标|还要减|还.*减/.test(t) && !/怎么|如何|建议/.test(t)) return 'goal';
    return 'general';
  },

  // ===== 模板回答 =====

  _templateReply(intent) {
    const height = wx.getStorageSync('userHeight');
    const weightData = wx.getStorageSync('weightData') || {};
    const cw = weightData.currentWeight || null;
    const tw = weightData.targetWeight || null;
    const goalCal = wx.getStorageSync('localCalorieGoal') || null;

    if (intent === 'bmi') {
      if (!height || !cw) return '你还没有填写身高和体重信息哦，去个人资料页补充一下吧～';
      const bmi = cw / Math.pow(height / 100, 2);
      let level, advice;
      if (bmi < 18.5) { level = '偏瘦'; advice = '建议适当增加热量摄入，多补充优质蛋白和碳水。'; }
      else if (bmi < 24) { level = '正常'; advice = '继续保持良好的饮食和运动习惯！'; }
      else if (bmi < 28) { level = '偏胖'; advice = '建议控制饮食总热量，增加有氧运动。'; }
      else { level = '肥胖'; advice = '建议制定科学的减脂计划，必要时咨询医生。'; }
      const cwJin = (cw * 2).toFixed(1);
      return `你目前的 BMI 是 ${bmi.toFixed(1)}，属于「${level}」范围。\n\n身高 ${height}cm，体重 ${cwJin}斤（${cw.toFixed(1)}kg）。\n\n${advice}`;
    }

    if (intent === 'weight') {
      if (!cw) return '还没有体重记录哦，去首页记录一下吧～';
      const cwJin = (cw * 2).toFixed(1);
      let reply = `你当前的体重是 ${cwJin}斤（${cw.toFixed(1)}kg）`;
      if (tw) {
        const diff = cw - tw;
        const diffJin = (Math.abs(diff) * 2).toFixed(1);
        if (diff > 0.05) reply += `\n距离目标 ${diffJin}斤（${diff.toFixed(1)}kg），继续加油！`;
        else if (diff < -0.05) reply += `\n已经超过目标 ${diffJin}斤了，注意维持就好～`;
        else reply += `\n已经达到目标体重了，太棒了！🎉`;
      }
      return reply;
    }

    if (intent === 'goal') {
      if (!cw || !tw) return '你还没有设置目标体重哦，去个人资料页设置一下吧～';
      const diff = cw - tw;
      const diffJin = (Math.abs(diff) * 2).toFixed(1);
      if (diff > 0.05)
        return `当前体重 ${(cw * 2).toFixed(1)}斤，目标 ${(tw * 2).toFixed(1)}斤，还差 ${diffJin}斤（${diff.toFixed(1)}kg）。\n\n按每周减 0.5kg 的健康速度，大约还需要 ${(diff / 0.5).toFixed(0)} 周左右。加油！`;
      else if (diff < -0.05)
        return `你已经达标啦！当前 ${(cw * 2).toFixed(1)}斤，目标 ${(tw * 2).toFixed(1)}斤，还低了 ${diffJin}斤。保持住就好～`;
      else
        return `你已经达到目标体重了！当前 ${(cw * 2).toFixed(1)}斤，继续保持！🎉`;
    }

    if (intent === 'today_diet') {
      const todayInfo = this._getTodayDietInfo();
      if (!todayInfo) return '今天还没有饮食记录哦，去饮食页面记录一下吧～';
      const { totalCal, mealDetails } = todayInfo;
      let reply = `今天的饮食情况：\n\n${mealDetails}\n\n总共摄入 ${totalCal}kcal`;
      if (goalCal) {
        const remaining = goalCal - totalCal;
        if (remaining > 0) {
          reply += `，距目标还剩 ${remaining}kcal。`;
          if (remaining > goalCal * 0.5) reply += '\n\n今天吃得比较少，注意营养均衡哦～';
        } else {
          reply += `，已超过目标 ${Math.abs(remaining)}kcal，注意控制一下。`;
        }
      }
      return reply;
    }

    if (intent === 'diet_history') {
      return this._getDietHistoryText() || '最近还没有饮食记录哦～';
    }

    if (intent === 'overview') {
      return this._buildOverviewReply();
    }

    return null;
  },

  _getTodayDietInfo() {
    const dietData = this._externalDietData || this._dietRawData;
    if (!dietData || !dietData.length) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const todayData = dietData.find(d => this.formatDate(d.date) === todayStr);
    if (!todayData || !todayData.records || todayData.records.length === 0) return null;
    const cleanName = (name) => name.replace(/[""''<>{}[\]\\|\/]/g, '').replace(/\s+/g, ' ').trim();
    let totalCal = 0;
    const mealParts = [];
    for (const r of todayData.records) {
      const foodNames = (r.foods || []).map(f => cleanName(f.name)).filter(Boolean);
      if (foodNames.length === 0) continue;
      const cal = r.foods.reduce((s, f) => s + (parseInt(f.calories) || 0), 0);
      totalCal += cal;
      mealParts.push(`${r.mealLabel || '?'}：${foodNames.join('、')}（${cal}kcal）`);
    }
    if (totalCal === 0) return null;
    return { totalCal, mealDetails: mealParts.join('\n') };
  },

  _getDietHistoryText() {
    const dietData = this._externalDietData || this._dietRawData;
    if (!dietData || !dietData.length) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    const cleanName = (name) => name.replace(/[""''<>{}[\]\\|\/]/g, '').replace(/\s+/g, ' ').trim();
    const lines = [];
    for (const day of dietData) {
      const ds = this.formatDate(day.date);
      const meals = day.records || [];
      let calcTotal = 0;
      const mealLines = [];
      for (const r of meals) {
        const foodNames = (r.foods || []).map(f => cleanName(f.name)).filter(Boolean);
        if (foodNames.length === 0) continue;
        const cal = r.foods.reduce((s, f) => s + (parseInt(f.calories) || 0), 0);
        calcTotal += cal;
        mealLines.push(`  ${r.mealLabel || '?'}：${foodNames.join('、')}（${cal}kcal）`);
      }
      if (mealLines.length === 0) continue;
      const tag = ds === todayStr ? '今天' : ds === yStr ? '昨天' : ds;
      lines.push(`${tag} 共 ${calcTotal}kcal`);
      lines.push(...mealLines);
    }
    return lines.length > 0 ? lines.join('\n') : null;
  },

  _buildOverviewReply() {
    const height = wx.getStorageSync('userHeight');
    const weightData = wx.getStorageSync('weightData') || {};
    const cw = weightData.currentWeight || null;
    const tw = weightData.targetWeight || null;
    const goalCal = wx.getStorageSync('localCalorieGoal') || null;
    const parts = [];

    if (cw) {
      const cwJin = (cw * 2).toFixed(1);
      parts.push(`📏 体重：${cwJin}斤（${cw.toFixed(1)}kg）`);
      if (tw) {
        const diff = cw - tw;
        if (diff > 0.05) parts.push(`🎯 目标差距：还差 ${(diff * 2).toFixed(1)}斤（${diff.toFixed(1)}kg）`);
        else if (diff < -0.05) parts.push(`🎯 目标：已达标！超出 ${(Math.abs(diff) * 2).toFixed(1)}斤`);
        else parts.push(`🎯 目标：已达标！🎉`);
      }
    }

    if (height && cw) {
      const bmi = cw / Math.pow(height / 100, 2);
      let level = bmi < 18.5 ? '偏瘦' : bmi < 24 ? '正常' : bmi < 28 ? '偏胖' : '肥胖';
      parts.push(`📊 BMI：${bmi.toFixed(1)}（${level}）`);
    }

    const todayInfo = this._getTodayDietInfo();
    if (todayInfo) {
      const calLine = `🍽 今日摄入：${todayInfo.totalCal}kcal`;
      if (goalCal) {
        const remaining = goalCal - todayInfo.totalCal;
        parts.push(remaining > 0 ? `${calLine} / 目标 ${goalCal}kcal（还剩 ${remaining}kcal）` : `${calLine} / 目标 ${goalCal}kcal（已超标 ${Math.abs(remaining)}kcal）`);
      } else {
        parts.push(calLine);
      }
    } else {
      parts.push('🍽 今日饮食：暂无记录');
    }

    if (cw && tw && (cw - tw) > 0.05) parts.push('\n💪 继续保持，你离目标越来越近了！');
    else if (height && cw) {
      const bmi = cw / Math.pow(height / 100, 2);
      if (bmi >= 24 && bmi < 28) parts.push('\n💪 建议每天少吃 200-300kcal，加上 30 分钟有氧运动，会看到明显变化！');
    }

    if (parts.length === 0) return '你还没有填写健康档案哦，去个人资料页补充一下吧～';
    return parts.join('\n');
  },

  // ===== 知识库构建 =====

  buildKnowledgeBase() {
    const sections = [];
    sections.push(this._buildProfileSection());
    const dietSection = this._buildDietSection();
    if (dietSection) sections.push(dietSection);
    const kb = sections.join('\n\n');
    console.log('[KB] 知识库长度:', kb.length, '内容预览:', kb.substring(0, 300));
    this.setData({ knowledgeBase: kb });
    return kb;
  },

  _buildProfileSection() {
    const parts = [];
    const height = wx.getStorageSync('userHeight');
    const weightData = wx.getStorageSync('weightData') || {};
    const cw = weightData.currentWeight;
    const tw = weightData.targetWeight;
    const goalCal = wx.getStorageSync('localCalorieGoal');
    if (!height && !cw) return '【档案】暂无';
    if (height) parts.push(`身高${height}cm`);
    if (cw) { parts.push(`体重${cw.toFixed(1)}kg`); if (tw) { const d=cw-tw; parts.push(`目标差${d.toFixed(1)}kg`); } }
    if (height && cw) { const bmi=cw/Math.pow(height/100,2); parts.push(`BMI ${bmi.toFixed(1)}`); }
    if (goalCal) parts.push(`日目标${goalCal}kcal`);
    return '【档案】' + parts.join('，') || '【档案】暂无';
  },

  _buildDietSection() {
    const dietData = this._externalDietData || this._dietRawData;
    if (!dietData || !dietData.length) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const cleanName = (name) => name.replace(/["'<>{}[\]\\|\/]/g, '').trim();
    const lines = [];
    for (const day of dietData) {
      const ds = this.formatDate(day.date);
      const meals = day.records || [];
      let total = 0;
      const items = [];
      for (const r of meals) {
        const foods = (r.foods || []).map(f => cleanName(f.name)).filter(Boolean);
        if (!foods.length) continue;
        const cal = r.foods.reduce((s, f) => s + (parseInt(f.calories)||0), 0);
        total += cal;
        items.push(`${r.mealLabel||'?'}:${foods.join('+')}=${cal}kcal`);
      }
      if (!items.length) continue;
      const tag = ds === todayStr ? '今天' : ds;
      lines.push(`${tag} ${total}kcal | ${items.join('；')}`);
    }
    return '【饮食】\n' + lines.join('\n');
  },

  formatDate(dateStr) {
    if (!dateStr) return '未知';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return dateStr;
  },

  // ===== 交互：快捷提问 / 输入 =====

  onQuickQuestion(e) {
    const q = e.currentTarget.dataset.q;
    if (this.data.isLoading) return;
    this.sendMessage(q);
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  async onSend() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.isLoading) return;
    this.sendMessage(text);
  },

  // ===== 发送消息（混合模式 + 流式输出）=====

  async sendMessage(text, isResend = false) {
    const userMsg = { role: 'user', content: text };

    let messages;
    if (isResend && this.data.editIndex >= 0) {
      // 重发模式：替换编辑中的那条用户消息
      messages = [...this.data.messages];
      messages[this.data.editIndex] = userMsg;
      this.setData({ messages, inputValue: '', isLoading: true, editIndex: -1, editValue: '' });
    } else {
      messages = [...this.data.messages, userMsg];
      this.setData({ messages, inputValue: '', isLoading: true });
    }

    this.saveMessages(messages);
    this.scrollToBottom();

    // 意图识别 → 模板优先
    const intent = this._detectIntent(text);
    console.log('[Chat] 意图:', intent, '问题:', text.substring(0, 30));

    const templateReply = this._templateReply(intent);
    if (templateReply) {
      // 模板命中 → 用打字机效果展示
      console.log('[Chat] 模板命中，流式展示');
      this._startStreamEffect(templateReply, messages);
      return;
    }

    // 走 AI
    console.log('[Chat] 模板未命中，走 AI');
    try {
      await Promise.all([this.loadDietData(), this.refreshWeightFromCloud()]);
    } catch(e) {}
    const kb = this.buildKnowledgeBase();
    const recentMsgs = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiChat',
        data: { messages: recentMsgs, knowledgeBase: kb }
      });

      const result = res.result || {};
      if (result.success && result.reply) {
        this._startStreamEffect(result.reply, messages);
      } else {
        this._showError(result.error || '未知错误');
      }
    } catch (err) {
      console.error('调用 AI 失败:', err);
      this._showError(err.message || '网络异常');
    }
  },

  // ===== 核心功能：打字机流式输出效果 =====

  /**
   * 将 AI 文本转换为 rich-text nodes（规范排版）
   * 处理：**加粗** / *小标题* / 数字列表 / 项目符号（合并连续项）
   * 兜底：纯文本自动识别隐含结构并美化
   */
  _formatRichText(text) {
    if (!text) return '';
    let html = text;
    // 转义 HTML（在格式标记处理之前）
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // **加粗** → <strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // *小标题* → <h3>（单星号包裹的短文本，独占一行）
    html = html.replace(/^\*(.+?)\*$/gm, '<h3>$1</h3>');
    // 行内 *文字* 去掉星号（避免显示为原始符号）
    html = html.replace(/(?<!\n)\*(?!\*)(.+?)\*(?!\*)/g, '$1');

    const lines = html.split('\n');
    const result = [];
    let inOl = false;
    let inUl = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 空行 → 关闭当前列表环境
      if (!line) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        continue;
      }

      // 已是 HTML 标签（<h3>, <strong> 包裹等）
      if (line.startsWith('<')) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (line.startsWith('<h3>')) {
          result.push(line);
        } else {
          result.push(`<p>${line}</p>`);
        }
        continue;
      }

      // 有序列表：1. 2. 3. 或 1）2）或 (1)(2)
      const olMatch = line.match(/^(\d+)[\.\）、\s]\s*(.+)$/);
      if (olMatch) {
        if (inUl) { result.push('</ul>'); inUl = false; }
        if (!inOl) { inOl = true; result.push('<ol class="ai-ol">'); }
        result.push(`<li>${olMatch[2]}</li>`);
        continue;
      }

      // 无序列表：- • · 👉 ✅ ⚠️ 💡 🔸 ▸ ► 等开头
      const ulMatch = line.match(/^[-•·👉✅⚠️💡🔸▸►]\s*(.+)$/);
      if (ulMatch) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inUl) { inUl = true; result.push('<ul class="ai-ul">'); }
        result.push(`<li>${ulMatch[1]}</li>`);
        continue;
      }

      // === 兜底：纯文本智能结构识别 ===

      // 识别隐含小标题：以 "总结|建议|注意|总体|总之|所以|但是|不过|另外" 等开头的短行
      const headingMatch = line.match(/^(总结|建议|注意|总体|总之|所以|不过|另外|分析|结论|提醒|小贴士|温馨提示)[：:]\s*(.*)$/);
      if (headingMatch && line.length < 30) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (inUl) { result.push('</ul>'); inUl = false; }
        result.push(`<h3>${headingMatch[1]}${headingMatch[2] ? '：' + headingMatch[2] : ''}</h3>`);
        continue;
      }

      // 识别隐含列表项：以 "首先|其次|然后|最后|一是|二是|三是|另外|还有" 开头
      const implicitLi = line.match(/^(首先|其次|然后|最后|其一|其二|其三|一是|二是|三是|另外|还有|此外|而且)[，,：:]\s*(.+)$/);
      if (implicitLi) {
        if (inOl) { result.push('</ol>'); inOl = false; }
        if (!inUl) { inUl = true; result.push('<ul class="ai-ul">'); }
        result.push(`<li>${implicitLi[2]}</li>`);
        continue;
      }

      // 普通文本段落
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (inUl) { result.push('</ul>'); inUl = false; }
      result.push(`<p>${line}</p>`);
    }

    // 收尾关闭未关闭的标签
    if (inOl) result.push('</ol>');
    if (inUl) result.push('</ul>');

    return result.join('');
  },

  /**
   * 打字机效果：收到完整文本后逐字显示，模拟流式体验
   */
  _startStreamEffect(fullText, baseMessages) {
    const aiIndex = baseMessages.length;

    // 插入 streaming 状态的空消息
    const streamMsg = { role: 'assistant', content: fullText, displayContent: '', streaming: true };
    const updated = [...baseMessages, streamMsg];

    this.setData({
      messages: updated,
      isStreaming: true,
      isLoading: false   // 关闭点点点，改用光标闪烁
    });

    this.saveMessages(updated);

    // 清除旧定时器
    if (this._typingTimer) clearInterval(this._typingTimer);

    let charPos = 0;
    // 加速打字机：每次多推几个字，间隔更短
    const stepSize = fullText.length > 100 ? 4 : 2;
    const intervalMs = fullText.length > 100 ? 8 : 14;

    this._typingTimer = setInterval(() => {
      charPos += stepSize;

      if (charPos >= fullText.length) {
        // 流式完成
        clearInterval(this._typingTimer);
        this._typingTimer = null;

        // 最终态：关闭 streaming 标记和光标，生成富文本
        const finalMsgs = this.data.messages.map((m, i) =>
          i === aiIndex
            ? { ...m, displayContent: fullText, richNodes: this._formatRichText(fullText), streaming: false }
            : m
        );
        this.setData({ messages: finalMsgs, isStreaming: false });
        this.saveMessages(finalMsgs);
        this.scrollToBottom();
        return;
      }

      // 推进显示内容
      const partial = fullText.substring(0, charPos);

      // 高效更新：只修改特定索引的 displayContent
      const keyPath = `messages[${aiIndex}].displayContent`;
      this.setData({ [keyPath]: partial });
      this.scrollToBottom();
    }, intervalMs);
  },

  // ===== 消息操作：编辑重发 & 长按复制 =====

  /**
   * 用户气泡单击 → 直接进入编辑模式
   */
  onMsgTap(e) {
    const { index, content } = e.currentTarget.dataset;
    if (!content) return;
    this.setData({
      editIndex: index,
      editValue: content
    });
  },

  /**
   * 用户气泡长按 → 复制到剪贴板
   */
  onMsgLongPress(e) {
    const { content } = e.currentTarget.dataset;
    if (content) {
      wx.setClipboardData({ data: content });
    }
  },

  onEditInput(e) {
    this.setData({ editValue: e.detail.value });
  },

  onCancelEdit() {
    this.setData({ editIndex: -1, editValue: '' });
  },

  onResendEdit() {
    const newText = this.data.editValue.trim();
    if (!newText) {
      this.setData({ editIndex: -1, editValue: '' });
      return;
    }

    // 裁剪：保留到被编辑的消息为止（删掉后续的AI回复等）
    const cutAt = this.data.editIndex + 1;
    const trimmed = this.data.messages.slice(0, cutAt);
    this.saveMessages(trimmed);
    this.setData({ editIndex: -1, editValue: '' });

    // 用新内容重新发送
    this.sendMessage(newText, true);
  },

  // ===== 辅助方法 =====

  _showError(errMsg) {
    const msg = { role: 'assistant', content: `抱歉出了点问题：${errMsg}\n请稍后再试试～` };
    const updated = [...this.data.messages, msg];
    this.setData({ messages: updated, isLoading: false, isStreaming: false });
    this.saveMessages(updated);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const msgs = this.data.messages;
    if (msgs.length > 0) this.setData({ scrollToView: `msg-${msgs.length - 1}` });
  },

  saveMessages(msgs) {
    wx.setStorageSync('aiChatMessages', msgs.slice(-50));
  },

  onCopyMessage(e) {
    const { text, index } = e.currentTarget.dataset;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.hideToast();
        this.setData({ copiedIndex: index });
        setTimeout(() => this.setData({ copiedIndex: -1 }), 3000);
      }
    });
  },

  onShareAppMessage() {
    const lastAi = [...this.data.messages].reverse().find(m => m.role === 'assistant');
    return {
      title: lastAi ? lastAi.content.slice(0,30) + (lastAi.content.length>30?'...':'') : '营养师为你解答饮食健康问题',
      path: '/pages/ai-chat/ai-chat',
      imageUrl: '/images/share-ai-chat.png'
    };
  },

  onShareTimeline() {
    return { title: '健康问答 - 你的专属营养师', query: '', imageUrl: '/images/share-ai-chat.png' };
  },

  onClearChat() {
    // 流式输出时禁止清空
    if (this.data.isStreaming) return;

    wx.showModal({
      title: '清空对话', content: '确定要清空吗？',
      success: (res) => {
        if (res.confirm) {
          // 停止正在进行的打字效果
          if (this._typingTimer) {
            clearInterval(this._typingTimer);
            this._typingTimer = null;
          }
          const msgs = [{ role: 'assistant', content: WELCOME_MSG }];
          this.setData({ messages: msgs, knowledgeBase: '', isStreaming: false });
          this.saveMessages(msgs);
        }
      }
    });
  }
});

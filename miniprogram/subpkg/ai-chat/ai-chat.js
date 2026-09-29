const Toast = require("../../vant/toast/toast").default;
// subpkg/ai-chat/ai-chat.js —— 混合模式：数据问题用模板，开放问题用 AI + 流式输出
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
    scrollTop: 0,            // 流式输出时强制滚动到底部
    knowledgeBase: '',
    userAvatar: DEFAULT_AVATAR,
    copiedIndex: -1,
    currentTheme: app.getEffectiveTheme(),
    quickQuestions: [
      '分析我的整体情况',
      '我的 BMI正常吗',
      '今天吃得怎么样',
      '生成周报',
      '帮我制定饮食计划'
    ],
    // 编辑模式状态
    editIndex: -1,
    editValue: '',
    // 结构化卡片类型
    cardType: ''  // 'report' | 'dietPlan' | ''
  },

  // 流式输出定时器引用
  _typingTimer: null,
  // 限流：上次发送时间戳
  _lastSendTime: 0,

  async onLoad(options) {
    const savedMessages = wx.getStorageSync('aiChatMessages');
    const welcomeMsg = { role: 'assistant', content: WELCOME_MSG };
    let restored = [];
    if (savedMessages && savedMessages.length > 0) {
      // 修复旧消息：为缺少 richNodes 的 AI 消息生成富文本，同时剥离推荐追问
      // isError 的错误气泡是临时态，恢复时丢弃
      restored = savedMessages.filter(m => !m.isError).map(m => {
        if (m.role === 'assistant' && m.content && !m.cardType) {
          // 先剥离 content 中可能残留的推荐追问
          const cleanContent = this._stripRecommendationBlock(m.content);
          return {
            ...m,
            content: cleanContent,
            richNodes: this._formatRichText(cleanContent),
            displayContent: cleanContent
          };
        }
        return m;
      });
      this.setData({ messages: restored });
    } else {
      this.setData({ messages: [welcomeMsg] });
    }

    const savedAvatar = wx.getStorageSync('avatarUrl');
    if (savedAvatar) {
      this.setData({ userAvatar: savedAvatar });
    }

    // 恢复快捷推荐：优先取最后一条 AI 消息上随消息持久化的 quickQuestions，
    // 保证重进页面与退出前展示完全一致
    let restoredQuick = null;
    for (let i = restored.length - 1; i >= 0; i--) {
      const m = restored[i];
      if (m.role === 'assistant' && Array.isArray(m.quickQuestions) && m.quickQuestions.length > 0) {
        restoredQuick = m.quickQuestions;
        break;
      }
    }
    if (!restoredQuick) {
      // 旧版本消息未内嵌 quickQuestions，回退读独立 storage；
      // 但若推荐项已被用户当作问题问过，说明 storage 停留在更早的回复（旧版兜底推荐未落盘导致），判定过期
      const savedQuickQuestions = wx.getStorageSync('aiChatQuickQuestions');
      const asked = new Set(restored.filter(m => m.role === 'user').map(m => m.content));
      if (savedQuickQuestions && savedQuickQuestions.length > 0 && !savedQuickQuestions.some(q => asked.has(q))) {
        restoredQuick = savedQuickQuestions;
      }
    }
    if (!restoredQuick && restored.length > 0) {
      // 最后兜底：按最后一条 AI 回复重新生成（content 已剥离追问，走主题回退）
      const lastAi = [...restored].reverse().find(m => m.role === 'assistant' && m.content && !m.isError && !m.cardType);
      if (lastAi) restoredQuick = this._computeQuickQuestions(lastAi.content);
    }
    if (restoredQuick && restoredQuick.length > 0) {
      this._applyQuickQuestions(restoredQuick);
    }

    try {
      await Promise.all([this.loadDietData(), this.refreshWeightFromCloud(), this.loadExerciseData()]);
      this._lastDataLoadTime = Date.now();
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
        // console.warn('解析饮食数据失败', e);
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
  _exerciseRawData: null,

  async loadDietData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      const days = res.result.days || [];
      this._dietRawData = days.length > 0 ? days.slice(0, 2) : null;
    } catch (e) {
      console.warn('加载饮食记录失败', e);
    }
  },

  async loadExerciseData() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getExercises', data: { limit: 20 } });
      this._exerciseRawData = res.result?.data || [];
    } catch (e) {
      // console.warn('加载运动数据失败', e);
    }
  },

  async loadPeriods() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getPeriods', data: { limit: 12 } });
      this._periodRecords = (res.result && res.result.data) || [];
    } catch (e) {
      // console.warn('加载经期数据失败', e);
    }
  },

  async refreshWeightFromCloud() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRecords', data: { range: 30 }, timeout: 10000
      });
      const records = res.result.data || [];
      if (records.length > 0) {
        // 保存近 30 天体重记录，供 AI 分析趋势
        this._weightRecords = records;
        const latestKg = parseFloat(records[0].weight);
        if (latestKg) {
          const weightData = wx.getStorageSync('weightData') || {};
          weightData.currentWeight = latestKg;
          wx.setStorageSync('weightData', weightData);
        }
      }
    } catch (e) {
      // console.warn('刷新体重数据失败', e);
    }
  },

  // ===== 意图识别 =====

  _detectIntent(text) {
    const t = text.toLowerCase().trim();
    if (!t) return 'general';

    // 开放性/咨询类问题（建议、趋势、标准范围、计划、方法、原因等）一律走 AI，
    // AI 能结合用户数据回答，模板只适合"查当前数值/查记录"这类确定请求
    if (/怎么|怎样|如何|为什么|为啥|建议|推荐|合适|好不好|能不能|可不可以|应该|计划|安排|食谱|范围|标准|趋势|变化|有效|方法|经验|怎么办|减.*多少|瘦.*多少|吃什么|吃啥/.test(t)) return 'general';
    // 食品安全/健康咨询类问题 → 走 AI
    if (/隔夜|放冰箱|冷藏|加热.*吃|微波炉|变质|坏了|能.*吃|可以.*吃|安全吗|有没有毒|细菌|保质期|过期|剩菜|剩饭|外卖|路边摊|卫生|食物中毒/.test(t)) return 'general';

    // 以下为"查数值/查记录"类确定请求，命中本地模板，即时响应
    if (/(今天|今日).*(饮食|吃了什么|摄入|热量)/.test(t) || /今天吃.*怎么样|今天吃得/.test(t)) return 'today_diet';
    if (/饮食记录|吃了什么|最近.*吃|昨天.*吃|前天.*吃/.test(t)) return 'diet_history';
    if (/分析.*情况|整体.*情况|我的情况|综合.*分析|全面.*分析/.test(t)) return 'overview';
    if (/bmi|体质指数|体重指数/.test(t)) return 'bmi';
    if (/还差多少|距目标|距离目标|还要减|目标进度|目标还差/.test(t)) return 'goal';
    if (/现在.*(体重|多重)|当前.*(体重|多重)|今天.*(体重|多重)|目前.*(体重|多重)|体重多少|多重了|有?多重/.test(t)) return 'weight';

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
    const weightSection = this._buildWeightSection();
    if (weightSection) sections.push(weightSection);
    const periodSection = this._buildPeriodSection();
    if (periodSection) sections.push(periodSection);
    const dietSection = this._buildDietSection();
    if (dietSection) sections.push(dietSection);
    const exerciseSection = this._buildExerciseSection();
    if (exerciseSection) sections.push(exerciseSection);
    const kb = sections.join('\n\n');
    // console.log('[KB] 知识库长度:', kb.length, '内容预览:', kb.substring(0, 300));
    this.setData({ knowledgeBase: kb });
    return kb;
  },

  // 连续打卡天数：从今天往回数，今天未打卡则从昨天起算（给 AI 展示真实连续链）
  _calcStreak(records) {
    if (!records || !records.length) return 0;
    const dates = [...new Set(records.map(r => this.formatDate(r.date)))];
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = new Date();
    let check = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!dates.includes(fmt(check))) check.setDate(check.getDate() - 1);
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      if (dates.includes(fmt(check))) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    return streak;
  },

  // 经期状态：上次经期、当前是否在经期、平均周期与下次预测
  _buildPeriodSection() {
    const records = this._periodRecords;
    if (!records || !records.length) return null;
    const sorted = [...records].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const last = sorted[0];
    const start = new Date(last.startDate);
    if (isNaN(start.getTime())) return null;
    const now = new Date();
    const daysAgo = Math.floor((now - start) / 86400000);
    if (daysAgo < 0 || daysAgo > 180) return null;

    const fmt = d => `${d.getMonth() + 1}月${d.getDate()}日`;
    const parts = [];
    parts.push(`上次经期${fmt(start)}开始（${daysAgo}天前）`);

    const duration = last.endDate
      ? Math.max(1, Math.round((new Date(last.endDate) - start) / 86400000) + 1)
      : 5;
    if (daysAgo < duration) parts.push(`目前处于经期第${daysAgo + 1}天`);

    // 平均周期（取最近最多6个间隔，过滤异常值）
    let avgCycle = null;
    if (sorted.length >= 2) {
      let total = 0, count = 0;
      for (let i = 0; i < sorted.length - 1 && count < 6; i++) {
        const diff = Math.round((new Date(sorted[i].startDate) - new Date(sorted[i + 1].startDate)) / 86400000);
        if (diff >= 15 && diff <= 60) { total += diff; count++; }
      }
      if (count > 0) avgCycle = Math.round(total / count);
    }
    if (avgCycle) {
      const next = new Date(start);
      next.setDate(next.getDate() + avgCycle);
      const daysTo = Math.round((next - now) / 86400000);
      parts.push(`平均周期${avgCycle}天，下次预计${fmt(next)}（${daysTo >= 0 ? `约${daysTo + 1}天后` : `已推迟${-daysTo}天`}）`);
    }
    return '【经期】' + parts.join('，');
  },

  // 近期待体重记录（按日期升序），供 AI 分析变化趋势
  _buildWeightSection() {
    const records = this._weightRecords;
    if (!records || !records.length) return null;
    const lines = [...records]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-15)
      .map(r => {
        const kg = parseFloat(r.weight);
        if (isNaN(kg)) return null;
        return `${this.formatDate(r.date).slice(5)} ${(kg * 2).toFixed(1)}斤`;
      })
      .filter(Boolean);
    if (!lines.length) return null;
    return '【近期待体重记录，日期由早到晚，单位斤】\n' + lines.join('\n');
  },

  _buildProfileSection() {
    const parts = [];
    const height = wx.getStorageSync('userHeight');
    const gender = wx.getStorageSync('userGender');
    const weightData = wx.getStorageSync('weightData') || {};
    const cw = weightData.currentWeight;
    const tw = weightData.targetWeight;
    const goalCal = wx.getStorageSync('localCalorieGoal');
    if (!height && !cw) return '【档案】暂无';
    if (gender === 'male' || gender === 'female') parts.push(gender === 'male' ? '男' : '女');
    if (height) parts.push(`身高${height}cm`);
    if (cw) { parts.push(`体重${cw.toFixed(1)}kg`); if (tw) { const d=cw-tw; parts.push(`目标差${d.toFixed(1)}kg`); } }
    if (height && cw) { const bmi=cw/Math.pow(height/100,2); parts.push(`BMI ${bmi.toFixed(1)}`); }
    if (goalCal) parts.push(`日目标${goalCal}kcal`);
    const streak = this._calcStreak(this._weightRecords);
    if (streak > 0) parts.push(`连续打卡${streak}天`);
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

  _buildExerciseSection() {
    const exercises = this._exerciseRawData;
    if (!exercises || !exercises.length) return null;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    // 取最近 7 天的运动数据
    const recentExercises = exercises.slice(0, 15);
    const lines = [];
    const dateGroups = {};
    recentExercises.forEach(ex => {
      if (!dateGroups[ex.date]) dateGroups[ex.date] = [];
      dateGroups[ex.date].push(ex);
    });
    Object.keys(dateGroups).sort().reverse().forEach(date => {
      const items = dateGroups[date];
      const tag = date === todayStr ? '今天' : date;
      const details = items.map(ex => `${ex.typeLabel||ex.type}(${ex.duration}分钟,${ex.calories}kcal)`).join('、');
      const totalCal = items.reduce((s, ex) => s + (ex.calories || 0), 0);
      lines.push(`${tag} ${details} = ${totalCal}kcal`);
    });
    return '【运动】\n' + lines.join('\n');
  },

  formatDate(dateStr) {
    if (!dateStr) return '未知';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return dateStr;
  },

  // ===== 推荐追问处理 =====

  // 追问头部关键词（云端同款逻辑，双端一致；长词在前，避免"推荐追问"被"追问"先命中）
  _FU_KEYS: ['你还可以问我', '推荐追问', '相关追问', '继续追问', '相关问题', '推荐问题', '延伸问题', '你可能想问', '继续问我', '还想问我', '追问'],
  _FU_DECOR_U: /[\s\p{P}\p{S}]/gu,
  _FU_SENTENCE_END: /[。！？!?；;…]$/,

  /**
   * 定位追问头部并拆分：逐行找关键词，关键词之后只允许标点/符号/空白，
   * 关键词之前为空/纯装饰（或序号）、或正文以句末标点收尾
   * （模型可能把头部接在正文句末同一行，甚至只输出半个括号）。
   * 模型输出格式不稳定，逐条猜正则永远猜不全，这是唯一可靠的做法。
   */
  _splitFollowUps(text) {
    if (!text || typeof text !== 'string') return { clean: text || '', followUps: [] };
    const lines = text.split('\n');
    const DECOR = this._FU_DECOR_U, SENT_END = this._FU_SENTENCE_END;

    let headerIdx = -1, headerPrefix = '';
    outer:
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const key of this._FU_KEYS) {
        const idx = line.indexOf(key);
        if (idx === -1) continue;
        const after = line.slice(idx + key.length);
        // 关键词后还有文字/数字（如"推荐追问：1.如何吃"）→ 交给行内兜底
        if (after.replace(DECOR, '') !== '') continue;
        const before = line.slice(0, idx);
        const beforeRtrim = before.replace(/\s+$/u, '');
        const beforeCore = before.replace(/[\s\p{P}\p{S}\d]/gu, '');
        if (beforeCore === '') {
          // 关键词前只有装饰/序号 → 整行就是头部
          headerIdx = i; headerPrefix = '';
          break outer;
        }
        if (SENT_END.test(beforeRtrim) || SENT_END.test(before.replace(/[\s\p{S}]+$/u, ''))) {
          // 关键词前是完整句子（正文句末直接接头部）；
          // 句末标点与关键词之间隔 emoji/符号（如"…哦！🌟 【推荐追问】"）同样判定为头部
          headerIdx = i; headerPrefix = beforeRtrim;
          break outer;
        }
        if (before.endsWith('【') && after.startsWith('】')) {
          // 关键词被【】完整包裹（头部标记完整），即使正文同行也强制拆分；
          // 保留前置正文时去掉悬空的半括号
          headerIdx = i; headerPrefix = beforeRtrim.replace(/【$/u, '');
          break outer;
        }
      }
    }

    if (headerIdx === -1) {
      const m = text.match(/(?:推荐追问|相关追问|继续追问)[ \t]*[：:]/);
      if (m) {
        const after = text.substring(text.indexOf(m[0]) + m[0].length);
        const qs = after.split(/\n+|\s*\d+[.、)]\s*/)
          .map(x => x.trim()).filter(x => x.length > 1 && x.length <= 30);
        return { clean: text.substring(0, text.indexOf(m[0])).trim(), followUps: qs.slice(0, 4) };
      }
      return { clean: text, followUps: [] };
    }

    const questions = lines.slice(headerIdx + 1)
      .map(l => l.replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d+[.、)）]\s*/, '').trim())
      .filter(q => q.length > 1 && q.length <= 30);

    const cleanLines = lines.slice(0, headerIdx);
    if (headerPrefix) cleanLines.push(headerPrefix);
    return { clean: cleanLines.join('\n').trim(), followUps: questions.slice(0, 4) };
  },

  /**
   * 剥离追问区块（气泡不展示），与 _splitFollowUps 同源
   */
  _stripRecommendationBlock(text) {
    if (!text) return text;
    return this._splitFollowUps(text).clean;
  },
  // ===== 交互：快捷提问 / 输入 =====

  onQuickQuestion(e) {
    const q = e.currentTarget.dataset.q;
    if (this.data.isLoading) return;
    this.sendMessage(q);
  },

    /**
   * 快捷推荐唯一写入口：展示与落盘同步，避免"看到的"和"重进后看到的"不一致
   */
  _applyQuickQuestions(list) {
    this.setData({ quickQuestions: list });
    wx.setStorageSync('aiChatQuickQuestions', list);
  },

  /**
   * 根据一段 AI 回复计算推荐追问：优先解析回复自带的追问区块，
   * 否则按回复主题智能回退生成
   */
  _computeQuickQuestions(text) {
    if (!text) return [];
    const { followUps } = this._splitFollowUps(text);
    if (followUps.length > 0) return followUps;

    // ===== 智能回退：AI 未输出推荐追问时，根据 AI 回复内容动态生成 =====
    const suggestions = [];
    const themeTests = [
      { test: /BMI|体质指数|bmi/, questions: ['如何降低BMI', '我的体重标准范围是多少', '饮食上怎么调整BMI'] },
      { test: /体重.*斤|(?:kg|公斤)/, questions: ['我的体重变化趋势', '如何更有效减重', '设定多少目标体重合适'] },
      { test: /热量|kcal|卡路里|能量/, questions: ['低热量食物推荐', '明天怎么控制饮食', '如何减少零食摄入'] },
      { test: /运动|锻炼|健身|步数|骑行|跑步|步行/, questions: ['推荐适合的运动', '运动后吃什么恢复', '每天运动多久合适'] },
      { test: /饮食|吃|食物|营养|早餐|午餐|晚餐|零食/, questions: ['如何搭配三餐', '蛋白质怎么补充', '哪些食物热量低'] },
      { test: /减[重肥脂瘦]|瘦身|塑形|体脂/, questions: ['减脂期怎么吃', '如何突破平台期', '增肌减脂怎么平衡'] },
      { test: /经期|月经|生理期/, questions: ['经期饮食注意什么', '经期能运动吗', '经期如何缓解不适'] },
      { test: /健康|养生|睡眠|喝水/, questions: ['如何改善睡眠', '每天喝多少水合适', '养成哪些好习惯'] },
      { test: /报告|分析|总结/, questions: ['详细分析我的数据', '下周怎么调整', '我的进步如何'] },
    ];

    for (const t of themeTests) {
      if (t.test.test(text)) {
        suggestions.push(...t.questions);
        if (suggestions.length >= 3) break;
      }
    }

    if (suggestions.length === 0) {
      suggestions.push('今天吃了什么', '今天运动了吗', '本周体重变化', '热量缺口怎么算');
    }
    return suggestions.slice(0, 4);
  },

  /**
   * 从最后一条 AI 回复计算推荐追问并更新快捷栏（含落盘），返回计算结果
   * 与剥离共用 _splitFollowUps，保证"气泡不显示"和"快捷栏显示"两者一致
   */
  _updateDynamicQuickQuestions(messages) {
    const msgs = messages || this.data.messages;
    if (!msgs || msgs.length === 0) return null;

    const lastAiReply = [...msgs].reverse().find(m => m.role === 'assistant' && m.content);
    if (!lastAiReply) return null;

    const quick = this._computeQuickQuestions(lastAiReply.content);
    if (quick.length === 0) return null;
    this._applyQuickQuestions(quick);
    return quick;
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
    // 限流：3秒内禁止重复发送
    const now = Date.now();
    if (now - this._lastSendTime < 3000) {
      wx.showToast({ title: '发送太快啦，稍等一下～', icon: 'none' });
      return;
    }
    this._lastSendTime = now;

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
    // console.log('[Chat] 意图:', intent, '问题:', text.substring(0, 30));

    const templateReply = this._templateReply(intent);
    if (templateReply) {
      // 模板命中 → 用打字机效果展示
      // console.log('[Chat] 模板命中，流式展示');
      this._startStreamEffect(templateReply, messages);
      return;
    }

    // 走 AI
    // 智能加载：缓存未过期则跳过数据重新加载（避免每次AI调用都读数据库）
    const cacheAge = Date.now() - (this._lastDataLoadTime || 0);
    if (cacheAge > 30000) {
      // 超过30秒才重新加载
      try {
        await Promise.all([this.loadDietData(), this.refreshWeightFromCloud(), this.loadExerciseData(), this.loadPeriods()]);
        this._lastDataLoadTime = Date.now();
      } catch(e) {}
    }
    const kb = this.buildKnowledgeBase();
    // 近 6 条上下文，保证"推荐早餐→换一个"这类多轮追问不丢上文
    const recentMsgs = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await wx.cloud.callFunction({
        name: 'aiChat',
        data: { messages: recentMsgs, knowledgeBase: kb }
      });

      const result = res.result || {};
      if (result.success && result.reply) {
        // 检测是否为结构化卡片内容
        const cardInfo = this._detectCardType(text, result.reply);
        if (cardInfo) {
          this._renderStructuredCard(cardInfo, messages, result.reply, result.followUps);
        } else {
          this._startStreamEffect(result.reply, messages, result.followUps);
        }
      } else {
        this._showFriendlyError(result.error || '未知错误', text);
      }
    } catch (err) {
      console.error('调用 AI 失败:', err);
      this._showFriendlyError(err.message || '网络异常', text);
    }
  },

  // 失败重试：移除错误气泡，重发最后一条用户消息
  onRetrySend() {
    if (this.data.isLoading || this.data.isStreaming) return;
    const msgs = [...this.data.messages];
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant' && msgs[msgs.length - 1].isError) msgs.pop();
    const question = this._lastFailedQuestion;
    if (!question) return;
    // 找最后一条用户消息，用重发模式原样替换（等价于重新发送）
    let idx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { idx = i; break; }
    }
    if (idx < 0) return;
    this.setData({ messages: msgs, editIndex: idx }, () => {
      this._lastSendTime = 0; // 重试不受 3 秒发送限流影响
      this.sendMessage(question, true);
    });
  },

  // ===== 核心功能：打字机流式输出效果 =====

  /**
   * 将 AI 文本转换为 rich-text nodes（规范排版）
   * 处理：**加粗** / *小标题* / 数字列表 / 项目符号（合并连续项）
   * 兜底：纯文本自动识别隐含结构并美化
   */
  _formatRichText(text) {
    if (!text) return '';
    // 先剥离推荐追问区块（这部分给快捷推荐栏用，不在气泡里展示）
    let html = this._stripRecommendationBlock(text);
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

      // 有序列表：1. 2. 3. 或 1）2）或 1、（必须紧跟标点，避免"9 乘以"被误判为列表）
      const olMatch = line.match(/^(\d+)[.）、]\s*(.+)$/);
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

  // ===== 结构化卡片检测与渲染 =====

  /**
   * 检测 AI 回复是否为结构化卡片（周报 / 饮食计划）
   * 返回 { type: 'report'|'dietPlan', sections: [...] } 或 null
   */
  _detectCardType(userText, aiReply) {
    const ut = (userText || '').toLowerCase();
    // 先剥离推荐追问区块，避免混入卡片内容
    const cleanReply = this._stripRecommendationBlock(aiReply || '');
    if (/周报|本周分析|周报告|这周总结|上周分析/.test(ut)) {
      return { type: 'report', sections: this._parseReportSections(cleanReply) };
    }
    if (/饮食计划|下周吃|这周吃|制定.*饮食|饮食安排|meal\s*plan/.test(ut)) {
      return { type: 'dietPlan', sections: this._parseDietPlanSections(cleanReply) };
    }
    return null;
  },

  /**
   * 解析周报内容为结构化段落
   */
  _parseReportSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentTitle = '';
    let currentItems = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // 匹配多种标题格式：
      // 1. *单星号标题*
      // 2. **双星号加粗标题**（AI 有时用 bold 格式输出标题）
      // 3. 数字序号 1. xxx / 1、xxx
      const titleMatch = line.match(/^\*(.+?)\*$/) 
        || line.match(/^\*\*(.+?)\*\*[：:\s]*$/) 
        || line.match(/^(\d+[\.\、])\s*(.+)/);
      if (titleMatch) {
        if (currentTitle && currentItems.length > 0) {
          sections.push({ title: currentTitle, items: [...currentItems] });
        }
        currentTitle = titleMatch[2] ? titleMatch[2] : titleMatch[1];
        currentItems = [];
        continue;
      }
      // 列表项
      const liMatch = line.match(/^[-•·]\s*(.+)$/);
      if (liMatch) {
        currentItems.push(liMatch[1].replace(/\*\*(.+?)\*\*/g, '$1'));
        continue;
      }
      // 普通文本行
      if (line) {
        currentItems.push(line.replace(/\*\*(.+?)\*\*/g, '$1'));
      }
    }
    if (currentTitle && currentItems.length > 0) {
      sections.push({ title: currentTitle, items: currentItems });
    }
    return sections;
  },

  /**
   * 解析饮食计划为每天/每餐一个卡片
   * 支持格式：
   *   - **早餐计划** / *第1天* / 1. 第一天
   *   - - 食物名 xxx（xxx kcal）
   */
  _parseDietPlanSections(text) {
    const days = [];
    const lines = text.split('\n');
    let currentDay = '';
    let currentMeals = [];

    // 标题行正则：**标题** / *标题* / 数字序号.标题 / 中文日期等
    const headerPatterns = [
      /^\s*\*\*(.+)\*\*\s*$/,          // **标题**
      /^\s*\*(.+)\*\s*$/,               // *标题*
      /^(\d+)[\.\、\）]\s*(.+)$/,       // 1. 标题 / 1、标题
      /^(第\s*[一二三四五六七八九十\d]+\s*天)$/,  // 第X天
      /^(Day\s*\d+)$/i,                  // Day X
      /^(周[一二三四五六日]|星期[一二三四五六日])$/,  // 周X/星期X
      /^(\d{4}年\d{1,2}月\d{1,2}日|\d{1,2}月\d{1,2}日)$/,  // 6月16日
      /^((?:早|午|晚|加|夜|下午)餐(?:计划|安排|建议)?|(?:饮食)?计划概览|总体建议|注意事项|温馨提示)/,  // 早餐计划/午餐/加餐建议等
    ];

    function matchHeader(line) {
      for (const p of headerPatterns) {
        const m = line.match(p);
        if (m) return m[1] || m[2] || line;
      }
      return null;
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue; // 空行跳过

      // 尝试匹配标题行
      const title = matchHeader(line);
      if (title) {
        if (currentDay && currentMeals.length > 0) {
          days.push({ day: currentDay, meals: [...currentMeals] });
        } else if (currentDay) {
          days.push({ day: currentDay, meals: ['(暂无详细内容)'] });
        }
        currentDay = title.replace(/\*/g, '').replace(/^\d+[\.\、\)]\s*/, '').trim() || '计划详情';
        currentMeals = [];
        continue;
      }

      // 列表项 = 餐次（支持 - • · 1. 2. 等前缀）
      const mealMatch = line.match(/^[-•··]\s*(.+)$/) || line.match(/^(\d+)[\.\）、\s]\s*(.+)$/);
      if (mealMatch) {
        const content = mealMatch[2] || mealMatch[1];
        currentMeals.push(content.replace(/\*\*(.+?)\*\*/g, '$1'));
        continue;
      }

      // 普通文本行：如果已有标题则归入 meals，否则跳过前言
      if (currentDay) {
        currentMeals.push(line.replace(/\*\*(.+?)\*\*/g, '$1'));
      }
    }

    // 收尾
    if (currentDay) {
      if (currentMeals.length > 0) {
        days.push({ day: currentDay, meals: [...currentMeals] });
      } else {
        days.push({ day: currentDay, meals: ['(暂无详细内容)'] });
      }
    }

    // 兜底：完全没解析出结构 → 整段文本作为单个卡片
    if (days.length === 0 && text.trim()) {
      days.push({
        day: '饮食计划',
        meals: text.split('\n').map(l => l.trim().replace(/[#*]/g, '')).filter(Boolean)
      });
    }

    return days;
  },

  /**
   * 渲染结构化卡片消息（跳过流式，直接显示卡片）
   */
  _renderStructuredCard(cardInfo, baseMessages, fallbackText, presetQuestions) {
    // 1. 快捷栏：优先用云端结构化追问；否则从原文解析；结果随消息持久化
    let quick = null;
    if (Array.isArray(presetQuestions) && presetQuestions.length > 0) {
      quick = presetQuestions;
      this._applyQuickQuestions(quick);
    } else if (fallbackText) {
      const tempMsgs = [...baseMessages, { role: 'assistant', content: fallbackText }];
      quick = this._updateDynamicQuickQuestions(tempMsgs);
    }

    // 兜底：解析出的内容为空时，降级为普通文本展示
    if (!cardInfo.sections || cardInfo.sections.length === 0) {
      // console.log('[Chat] 卡片解析为空，降级为文本展示');
      if (fallbackText) {
        this._startStreamEffect(fallbackText, baseMessages, presetQuestions);
        return;
      }
    }
    const aiIndex = baseMessages.length;
    const cardMsg = {
      role: 'assistant',
      content: '', // 原始文本不展示
      cardType: cardInfo.type,
      cardData: cardInfo.sections,
      streaming: false,
      quickQuestions: quick || this.data.quickQuestions
    };
    const updated = [...baseMessages, cardMsg];
    this.setData({ messages: updated, isLoading: false, isStreaming: false });
    this.saveMessages(updated);
    this.scrollToBottom();
  },

  /**
   * 打字机效果：收到完整文本后逐字显示，模拟流式体验
   * presetQuestions：云端已结构化解析好的追问，优先使用（不再猜测格式）
   */
  _startStreamEffect(fullText, baseMessages, presetQuestions) {
    const aiIndex = baseMessages.length;

    // 1. 快捷栏：优先用云端结构化追问；否则从原文解析（模板回复等场景）
    // 计算结果随消息一起持久化，重进页面可原样恢复
    let quick = null;
    if (Array.isArray(presetQuestions) && presetQuestions.length > 0) {
      quick = presetQuestions;
      this._applyQuickQuestions(quick);
    } else {
      const tempMsgs = [...baseMessages, { role: 'assistant', content: fullText }];
      quick = this._updateDynamicQuickQuestions(tempMsgs);
    }

    // 2. 剥离推荐追问，只展示纯净回复给用户（云端已剥离过，这里幂等兜底）
    const cleanText = this._stripRecommendationBlock(fullText);

    // 插入 streaming 状态的空消息
    const streamMsg = { role: 'assistant', content: cleanText, displayContent: '', streaming: true, quickQuestions: quick || this.data.quickQuestions };
    const updated = [...baseMessages, streamMsg];

    this.setData({
      messages: updated,
      isStreaming: true,
      isLoading: false   // 关闭点点点，改用光标闪烁
    }, () => {
      // 立即滚动到底部（不重置 scrollTop，不干扰 scrollToBottom 的结果）
      this._queryScrollToBottom();
    });

    this.saveMessages(updated);

    // 清除旧定时器
    if (this._typingTimer) clearInterval(this._typingTimer);

    let charPos = 0;
    const stepSize = cleanText.length > 100 ? 6 : 3;
    const intervalMs = cleanText.length > 100 ? 5 : 10;

    this._typingTimer = setInterval(() => {
      charPos += stepSize;

      if (charPos >= cleanText.length) {
        // 流式完成
        clearInterval(this._typingTimer);
        this._typingTimer = null;

        const finalMsgs = this.data.messages.map((m, i) =>
          i === aiIndex
            ? { ...m, displayContent: cleanText, richNodes: this._formatRichText(cleanText), streaming: false }
            : m
        );
        this.setData({ messages: finalMsgs, isStreaming: false }, () => {
          this._queryScrollToBottom();
        });
        this.saveMessages(finalMsgs);
        return;
      }

      // 推进显示内容，每 tick 都滚动到底部
      const partial = cleanText.substring(0, charPos);
      const keyPath = `messages[${aiIndex}].displayContent`;
      this.setData({ [keyPath]: partial }, () => {
        this._queryScrollToBottom();
      });
    }, intervalMs);
  },

  /**
   * 用 createSelectorQuery 测量真实内容高度并滚动到底部（微信小程序最可靠的滚动方案）
   */
  _queryScrollToBottom() {
    wx.createSelectorQuery()
      .select('.chat-messages').scrollOffset()
      .select('.chat-list').boundingClientRect()
      .exec((res) => {
        if (res && res[1] && res[1].height) {
          // 设一个远大于内容高度的值，框架自动 clamp 到最大可滚动位置
          this.setData({ scrollTop: res[1].height + 2000 });
        }
      });
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

  // 把技术性错误转成用户友好提示
  _showFriendlyError(rawErr, lastQuestion) {
    let tip = 'AI 暂时有点忙，请稍后再试试～';
    if (/429|限流|速率限制/.test(rawErr)) {
      tip = '问得太快啦，等一会再试试吧～';
    } else if (/exhausted|502|503|504/.test(rawErr)) {
      tip = '营养师正在休息中，过几秒再问问看～';
    } else if (/timeout|超时/.test(rawErr)) {
      tip = '响应有点慢，稍等一下再试试～';
    } else if (/网络错误|network/.test(rawErr)) {
      tip = '网络连接有点问题，检查一下网络再试试～';
    }
    if (lastQuestion) this._lastFailedQuestion = lastQuestion;
    // 以错误气泡形式展示，提供一键重试（不弹 toast，避免打断对话流）
    const msgs = [...this.data.messages, { role: 'assistant', content: tip, isError: true }];
    this.setData({ messages: msgs, isLoading: false }, () => this._queryScrollToBottom());
    this.saveMessages(msgs);
  },

  scrollToBottom() {
    // 统一用真实高度查询滚动，不再用 scroll-into-view（避免与后续 setData 冲突）
    this._queryScrollToBottom();
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
      path: '/subpkg/ai-chat/ai-chat',
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
          const defaultQuestions = [
            '分析我的整体情况',
            '我的 BMI正常吗',
            '今天吃得怎么样',
            '生成周报',
            '帮我制定饮食计划'
          ];
          this.setData({ messages: msgs, knowledgeBase: '', isStreaming: false });
          this.saveMessages(msgs);
          this._applyQuickQuestions(defaultQuestions);
        }
      }
    });
  }
});

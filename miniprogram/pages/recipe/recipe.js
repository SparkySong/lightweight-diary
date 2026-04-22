// pages/recipe/recipe.js
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

// 静态原始数据（不改动）
const rawRecipeData = [
  {
    category: '早餐',
    limit: '≤300kcal',
    emoji: '🌞',
    icon: 'breakfast',
    collapsed: false,
    items: [
      { name: '水煮蛋2个 + 无糖豆浆 + 小黄瓜', cal: 210, tag: '高蛋白', tagClass: 'protein' },
      { name: '全麦面包1片 + 煎蛋 + 小番茄', cal: 250, tag: '低GI', tagClass: 'lowgi' },
      { name: '纯燕麦50g + 无糖牛奶 + 蓝莓', cal: 270, tag: '高纤维', tagClass: 'fiber' },
      { name: '玉米半根 + 鸡蛋1个 + 凉拌菠菜', cal: 220, tag: '低脂', tagClass: 'lowfat' },
      { name: '紫薯100g + 无糖酸奶', cal: 230, tag: '低GI', tagClass: 'lowgi' },
      { name: '鸡蛋白3个 + 全麦馒头半个', cal: 180, tag: '高蛋白', tagClass: 'protein' }
    ]
  },
  {
    category: '午餐',
    limit: '≤500kcal',
    emoji: '🍚',
    icon: 'lunch',
    collapsed: false,
    items: [
      { name: '鸡胸肉沙拉（生菜+玉米+黄瓜）', cal: 340, tag: '高蛋白', tagClass: 'protein' },
      { name: '番茄龙利鱼 + 糙米饭半碗', cal: 410, tag: '低脂', tagClass: 'lowfat' },
      { name: '黑椒牛肉片 + 西兰花 + 玉米', cal: 430, tag: '高蛋白', tagClass: 'protein' },
      { name: '冬瓜丸子汤（瘦肉）+ 小份杂粮饭', cal: 390, tag: '低脂', tagClass: 'lowfat' },
      { name: '凉拌鸡丝 + 清炒油麦菜 + 紫薯', cal: 420, tag: '高蛋白', tagClass: 'protein' },
      { name: '豆腐蔬菜煲 + 少量藜麦饭', cal: 360, tag: '高纤维', tagClass: 'fiber' },
      { name: '虾仁蒸蛋 + 清炒上海青', cal: 330, tag: '高蛋白', tagClass: 'protein' }
    ]
  },
  {
    category: '晚餐',
    limit: '≤400kcal',
    emoji: '🥗',
    icon: 'dinner',
    collapsed: false,
    items: [
      { name: '菌菇豆腐汤 + 凉拌菠菜', cal: 170, tag: '低脂', tagClass: 'lowfat' },
      { name: '虾仁滑蛋 + 清炒西兰花', cal: 310, tag: '高蛋白', tagClass: 'protein' },
      { name: '清蒸巴沙鱼 + 冬瓜', cal: 260, tag: '低脂', tagClass: 'lowfat' },
      { name: '番茄金针菇肥牛卷（少油）', cal: 350, tag: '高蛋白', tagClass: 'protein' },
      { name: '黄瓜鸡蛋汤 + 凉拌木耳', cal: 200, tag: '低脂', tagClass: 'lowfat' },
      { name: '生菜鸡胸肉卷（无沙拉酱）', cal: 280, tag: '高蛋白', tagClass: 'protein' },
      { name: '海带豆腐味增汤 + 凉拌鸡丝', cal: 290, tag: '低脂', tagClass: 'lowfat' }
    ]
  },
  {
    category: '加餐',
    limit: '≤100kcal',
    emoji: '🍎',
    icon: 'snack',
    collapsed: false,
    items: [
      { name: '无糖酸奶1小杯 + 3颗杏仁', cal: 80, tag: '高蛋白', tagClass: 'protein' },
      { name: '小苹果1个 / 梨1个', cal: 55, tag: '低GI', tagClass: 'lowgi' },
      { name: '小黄瓜1根 / 圣女果10颗', cal: 35, tag: '低脂', tagClass: 'lowfat' },
      { name: '水煮玉米半根', cal: 90, tag: '高纤维', tagClass: 'fiber' },
      { name: '魔芋果冻1杯', cal: 15, tag: '低卡', tagClass: 'lowcal' },
      { name: '水煮山药100g', cal: 70, tag: '低GI', tagClass: 'lowgi' }
    ]
  }
];

// ========== 基于日期的伪随机数生成器 ==========

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getTodayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayLabel() {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekDays[d.getDay()]}`;
}

// 基于日期种子打乱数组顺序（Fisher-Yates + 种子随机），同一天结果相同
function shuffleSeeded(arr, rng) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 纯随机取元素
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

Page({
  data: {
    currentTheme: getInitTheme(),
    recipeList: [],
    toastShow: false,
    toastMsg: '',
    // 每日推荐
    showDailyPlan: false,
    dailyPlan: [],
    totalCal: 0,
    todayLabel: '',
    _lastDayKey: ''
  },

  onLoad() {
    this.initTheme();
    this.generateDailyRecipeList();
  },

  onShow() {
    this.initTheme();
    // 每次显示时检查日期是否变了，如果换了天则重新打乱列表
    const todayKey = getTodayKey();
    if (todayKey !== this.data._lastDayKey) {
      this.generateDailyRecipeList();
    }
  },

  initTheme() {
    const theme = app.getEffectiveTheme();
    if (this.data.currentTheme !== theme) {
      this.setData({ currentTheme: theme });
    }

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
        backgroundColorBottom: '#F8FAF9'
      });
    } else {
      wx.setBackgroundColor({
        backgroundColor: '#121212',
        backgroundColorTop: '#121212',
        backgroundColorBottom: '#121212'
      });
    }
  },

  onThemeChange() {
    this.initTheme();
  },

  // 📅 每日打乱食谱列表（基于日期种子，同一天固定）
  generateDailyRecipeList() {
    const todayKey = getTodayKey();
    const baseSeed = hashString(todayKey);

    // 为每个分类用不同的种子打乱
    const shuffledList = rawRecipeData.map((cat, index) => {
      const catSeed = hashString(baseSeed + '-' + index);
      const rng = createSeededRandom(catSeed);
      return {
        ...cat,
        items: shuffleSeeded(cat.items, rng)
      };
    });

    this.setData({
      _lastDayKey: todayKey,
      recipeList: shuffledList,
      todayLabel: getTodayLabel()
    });
  },

  // 切换分类折叠/展开
  toggleSection(e) {
    const index = e.currentTarget.dataset.index;
    const key = `recipeList[${index}].collapsed`;
    this.setData({
      [key]: !this.data.recipeList[index].collapsed
    });
  },

  // 🎲 随机推荐今日三餐
  randomRecommend() {
    const plan = rawRecipeData.map(cat => ({
      category: cat.category,
      emoji: cat.emoji,
      icon: cat.icon,
      ...pickOne(cat.items)
    }));

    const totalCal = plan.reduce((sum, item) => sum + item.cal, 0);

    this.setData({
      dailyPlan: plan,
      totalCal: totalCal,
      showDailyPlan: true
    });

    // 向下滚动一点，确保推荐卡片在可视区域内
    setTimeout(() => {
      wx.pageScrollTo({
        scrollTop: 99999,
        duration: 250
      });
    }, 100);
  },

  // 关闭每日推荐
  closeDailyPlan() {
    this.setData({ showDailyPlan: false });
  },

  // 再换一餐（单独替换某一类）
  reshuffleMeal(e) {
    const idx = e.currentTarget.dataset.index;
    const cat = rawRecipeData[idx];
    const newItem = pickOne(cat.items);

    const key = `dailyPlan[${idx}]`;
    this.setData({
      [key]: {
        category: cat.category,
        emoji: cat.emoji,
        icon: cat.icon,
        ...newItem
      }
    });

    // 重新计算总热量
    const newPlan = this.data.dailyPlan.map((item, i) =>
      i === idx ? { category: cat.category, emoji: cat.emoji, icon: cat.icon, ...newItem } : item
    );
    const totalCal = newPlan.reduce((sum, item) => sum + item.cal, 0);
    this.setData({ totalCal });
  },

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  }
});

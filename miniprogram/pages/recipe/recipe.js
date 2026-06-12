// pages/recipe/recipe.js
const app = getApp();

const getInitTheme = () => {
  const themeSetting = wx.getStorageSync('appTheme') || 'system';
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

// 静态原始数据（大容量食谱库，每日随机抽取展示）
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
      { name: '鸡蛋白3个 + 全麦馒头半个', cal: 180, tag: '高蛋白', tagClass: 'protein' },
      { name: '蒸南瓜150g + 水煮蛋1个', cal: 200, tag: '低GI', tagClass: 'lowgi' },
      { name: '杂粮粥半碗 + 卤牛肉3片', cal: 260, tag: '高蛋白', tagClass: 'protein' },
      { name: '牛油果半个 + 全麦吐司1片 + 荷包蛋', cal: 290, tag: '高纤维', tagClass: 'fiber' },
      { name: '小米粥1碗 + 瘦肉末蒸蛋', cal: 240, tag: '低脂', tagClass: 'lowfat' },
      { name: '红薯100g + 无糖花生酱 + 牛奶', cal: 280, tag: '高纤维', tagClass: 'fiber' },
      { name: '希腊酸奶 + 奇异果 + 坚果碎', cal: 250, tag: '高蛋白', tagClass: 'protein' },
      { name: '蔬菜鸡蛋饼（菠菜+胡萝卜）+ 豆浆', cal: 230, tag: '高纤维', tagClass: 'fiber' },
      { name: '藜麦饭小碗 + 鸡胸肉丁 + 黄瓜', cal: 280, tag: '高蛋白', tagClass: 'protein' },
      { name: '香蕉1根 + 杏仁奶 + 燕麦片30g', cal: 260, tag: '高纤维', tagClass: 'fiber' },
      { name: '茶叶蛋2个 + 小米粥半碗 + 咸菜少许', cal: 220, tag: '高蛋白', tagClass: 'protein' },
      { name: '全麦卷饼（卷鸡蛋+生菜）+ 无糖拿铁', cal: 270, tag: '均衡', tagClass: 'balanced' },
      { name: '豆腐脑（少卤）+ 油条半根', cal: 240, tag: '低脂', tagClass: 'lowfat' },
      { name: '三文鱼50g + 牛油果开放吐司', cal: 295, tag: '高蛋白', tagClass: 'protein' },
      { name: '芋头蒸糕2块 + 无糖豆浆', cal: 210, tag: '低GI', tagClass: 'lowgi' },
      { name: '虾仁滑蛋 + 刀切馒头半个', cal: 265, tag: '高蛋白', tagClass: 'protein' },
      { name: '黑芝麻糊1碗 + 水煮蛋1个', cal: 195, tag: '低GI', tagClass: 'lowgi' },
      { name: '荞麦面一小撮 + 卤蛋 + 凉拌豆芽', cal: 255, tag: '高纤维', tagClass: 'fiber' },
      { name: '鹰嘴豆泥 + 胡萝卜条 + 全麦饼干2片', cal: 240, tag: '高纤维', tagClass: 'fiber' },
      { name: '皮蛋瘦肉粥半碗 + 凉拌海带丝', cal: 235, tag: '均衡', tagClass: 'balanced' },
      { name: '蛋白粉摇摇杯 + 苹果半个 + 燕麦棒', cal: 275, tag: '高蛋白', tagClass: 'protein' }
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
      { name: '虾仁蒸蛋 + 清炒上海青', cal: 330, tag: '高蛋白', tagClass: 'protein' },
      { name: '香煎三文鱼 + 芦笋 + 糙米饭', cal: 450, tag: '高蛋白', tagClass: 'protein' },
      { name: '青椒炒肉丝（瘦）+ 蒸南瓜 + 杂粮饭', cal: 420, tag: '均衡', tagClass: 'balanced' },
      { name: '白灼虾10只 + 蒜蓉西兰花 + 紫薯', cal: 380, tag: '高蛋白', tagClass: 'protein' },
      { name: '番茄牛腩（少油）+ 土豆 + 少量饭', cal: 470, tag: '均衡', tagClass: 'balanced' },
      { name: '金针菇肥牛卷（少油）+ 生菜包饭', cal: 400, tag: '高蛋白', tagClass: 'protein' },
      { name: '清蒸鲈鱼 + 蒜蓉空心菜 + 糙米饭', cal: 430, tag: '低脂', tagClass: 'lowfat' },
      { name: '鸡丁炒豌豆 + 蒸山药 + 杂粮饭小碗', cal: 395, tag: '高纤维', tagClass: 'fiber' },
      { name: '韩式辣豆腐汤 + 杂粮饭半碗 + 泡菜少量', cal: 360, tag: '高蛋白', tagClass: 'protein' },
      { name: '蒜香烤鸡腿（去皮）+ 凉拌黄瓜 + 玉米', cal: 450, tag: '高蛋白', tagClass: 'protein' },
      { name: '蛤蜊冬瓜汤 + 清炒芥兰 + 糙米饭', cal: 350, tag: '低脂', tagClass: 'lowfat' },
      { name: '孜然羊肉（瘦）+ 孜然洋葱 + 藜麦饭', cal: 480, tag: '高蛋白', tagClass: 'protein' },
      { name: '日式味增汤 + 三文鱼刺身 + 寿司卷4个', cal: 420, tag: '高蛋白', tagClass: 'protein' },
      { name: '宫保鸡丁（少油少糖）+ 杂粮饭', cal: 440, tag: '高蛋白', tagClass: 'protein' },
      { name: '清炖排骨（去油）+ 白萝卜 + 少量饭', cal: 460, tag: '均衡', tagClass: 'balanced' },
      { name: '蒜苔炒腊肉（少量）+ 炒时蔬 + 糙米饭', cal: 455, tag: '均衡', tagClass: 'balanced' },
      { name: '咖喱鸡肉（低脂版）+ 土豆胡萝卜 + 少量饭', cal: 435, tag: '高蛋白', tagClass: 'protein' },
      { name: '红烧狮子头（瘦肉）+ 青菜 + 蒸蛋羹', cal: 440, tag: '高蛋白', tagClass: 'protein' },
      { name: '酸汤肥牛 + 金针菇 + 莴笋叶', cal: 415, tag: '高蛋白', tagClass: 'protein' },
      { name: '椒盐鱿鱼 + 爆炒圆白菜 + 杂粮饭', cal: 425, tag: '高蛋白', tagClass: 'protein' },
      { name: '糖醋里脊（少油版）+ 西红柿炒蛋 + 米饭', cal: 465, tag: '均衡', tagClass: 'balanced' },
      { name: '回锅肉（瘦多肥少）+ 蒜苗 + 荞麦面', cal: 475, tag: '均衡', tagClass: 'balanced' }
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
      { name: '海带豆腐味增汤 + 凉拌鸡丝', cal: 290, tag: '低脂', tagClass: 'lowfat' },
      { name: '西芹百合炒腰果 + 小份糙米饭', cal: 320, tag: '高纤维', tagClass: 'fiber' },
      { name: '蒸蛋羹 + 凉拌黄瓜 + 半根玉米', cal: 250, tag: '均衡', tagClass: 'balanced' },
      { name: '白灼生菜 + 卤牛肉薄片 + 小米粥', cal: 275, tag: '高蛋白', tagClass: 'protein' },
      { name: '丝瓜蛤蜊汤 + 蒜蓉秋葵', cal: 195, tag: '低脂', tagClass: 'lowfat' },
      { name: '烤鳕鱼 + 芦笋 + 小份藜麦', cal: 330, tag: '高蛋白', tagClass: 'protein' },
      { name: '苦瓜炒蛋 + 凉拌茄子', cal: 220, tag: '低脂', tagClass: 'lowfat' },
      { name: '鸡丝凉面（少麻酱）+ 黄瓜丝', cal: 310, tag: '均衡', tagClass: 'balanced' },
      { name: '紫菜蛋花汤 + 蒸红薯 + 凉拌豆干', cal: 285, tag: '高纤维', tagClass: 'fiber' },
      { name: '清炖鸡汤（去油）+ 青菜 + 少量米饭', cal: 340, tag: '低脂', tagClass: 'lowfat' },
      { name: '蒜蓉蒸虾 + 炒空心菜', cal: 295, tag: '高蛋白', tagClass: 'protein' },
      { name: '萝卜丝鲫鱼汤 + 凉拌海带', cal: 260, tag: '低脂', tagClass: 'lowfat' },
      { name: '蚝油杏鲍菇 + 清炒荷兰豆', cal: 180, tag: '低卡', tagClass: 'lowcal' },
      { name: '魔芋丝炒肉末 + 番茄汤', cal: 230, tag: '低卡', tagClass: 'lowcal' },
      { name: '蒸饺5个（素馅）+ 绿豆汤', cal: 270, tag: '均衡', tagClass: 'balanced' },
      { name: '凉拌荞麦面 + 鸡丝 + 蔬菜丝', cal: 300, tag: '高纤维', tagClass: 'fiber' },
      { name: '冬瓜排骨汤（去油）+ 炒苋菜', cal: 315, tag: '低脂', tagClass: 'lowfat' },
      { name: '煎蛋豆腐煲 + 凉拌木耳菜', cal: 275, tag: '高蛋白', tagClass: 'protein' },
      { name: '西红柿鸡蛋面（小份，少油）', cal: 290, tag: '均衡', tagClass: 'balanced' },
      { name: '清炒虾仁芦笋 + 半根玉米', cal: 305, tag: '高蛋白', tagClass: 'protein' },
      { name: '海带绿豆汤 + 蒸南瓜 + 凉拌鸡胗', cal: 245, tag: '低脂', tagClass: 'lowfat' }
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
      { name: '水煮山药100g', cal: 70, tag: '低GI', tagClass: 'lowgi' },
      { name: '蓝莓一小把 + 希腊酸奶1勺', cal: 75, tag: '高蛋白', tagClass: 'protein' },
      { name: '香蕉半根 + 花生酱少许', cal: 95, tag: '高纤维', tagClass: 'fiber' },
      { name: '橙子1个', cal: 60, tag: '低GI', tagClass: 'lowgi' },
      { name: '核桃2颗 + 红枣2颗', cal: 65, tag: '高纤维', tagClass: 'fiber' },
      { name: '无糖豆浆1杯', cal: 85, tag: '高蛋白', tagClass: 'protein' },
      { name: '葡萄柚半个', cal: 40, tag: '低GI', tagClass: 'lowgi' },
      { name: '海苔脆片2-3片', cal: 20, tag: '低卡', tagClass: 'lowcal' },
      { name: '煮毛豆一把（带壳）', cal: 95, tag: '高蛋白', tagClass: 'protein' },
      { name: '猕猴桃1个', cal: 55, tag: '低GI', tagClass: 'lowgi' },
      { name: '无糖黑巧1小块(10g)', cal: 55, tag: '低GI', tagClass: 'lowgi' },
      { name: '木瓜1/4个', cal: 50, tag: '低GI', tagClass: 'lowgi' },
      { name: '蒸紫薯80g', cal: 88, tag: '高纤维', tagClass: 'fiber' },
      { name: '开心果10颗', cal: 70, tag: '高纤维', tagClass: 'fiber' },
      { name: '无糖椰子水半杯', cal: 35, tag: '低卡', tagClass: 'lowcal' },
      { name: '草莓6-8颗', cal: 35, tag: '低GI', tagClass: 'lowgi' },
      { name: '蒸板栗3-4颗', cal: 65, tag: '高纤维', tagClass: 'fiber' },
      { name: '奶酪棒1根', cal: 65, tag: '高蛋白', tagClass: 'protein' },
      { name: '冻酸奶块3-4块', cal: 45, tag: '低GI', tagClass: 'lowgi' },
      { name: '无糖燕窝一小盅', cal: 50, tag: '低卡', tagClass: 'lowcal' },
      { name: '小柿子/圣女果8-10颗', cal: 32, tag: '低GI', tagClass: 'lowgi' },
      { name: '奇亚籽布丁（无糖）1小杯', cal: 90, tag: '高纤维', tagClass: 'fiber' },
      { name: '烤鹰嘴豆1小把', cal: 78, tag: '高纤维', tagClass: 'fiber' }
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

// 基于日期种子从数组中选取指定数量的元素（同一天结果相同）
function pickSubsetSeeded(arr, count, rng) {
  // 先用 Fisher-Yates 打乱
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // 取前 count 个（不超过数组长度）
  return shuffled.slice(0, Math.min(count, arr.length));
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

  // 📅 每日随机选取食谱（基于日期种子，同天固定，隔天换新）
  // 每个分类每天展示不同的子集，而不是全部打乱顺序
  generateDailyRecipeList() {
    const todayKey = getTodayKey();
    const baseSeed = hashString(todayKey);

    // 为每个分类用不同的种子，每天选取不同食谱
    const dailyList = rawRecipeData.map((cat, index) => {
      const catSeed = hashString(baseSeed + '-' + index);
      const rng = createSeededRandom(catSeed);
      // 每个分类最多展示5条（如果总数≤5则全部展示），每天选不同的
      const showCount = cat.items.length <= 5 ? cat.items.length : 5;
      return {
        ...cat,
        items: pickSubsetSeeded(cat.items, showCount, rng),
        totalCount: cat.items.length
      };
    });

    this.setData({
      _lastDayKey: todayKey,
      recipeList: dailyList,
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

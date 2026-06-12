// pages/diet/diet.js
const app = getApp();

// 分页配置
const PAGE_SIZE = 10;

// 🔑 关键修复：从存储获取当前生效的主题（用于 data 初始值，避免闪烁）
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

// 本地食物数据库（卡路里单位：每份/100g千卡）
const foodDatabase = [
  // 主食类
  { name: '米饭', calories: 116, unit: '碗(150g)', serving: '116' },
  { name: '米饭一碗', calories: 174, unit: '碗', serving: '174' },
  { name: '白米饭', calories: 116, unit: '碗(150g)', serving: '116' },
  { name: '馒头', calories: 223, unit: '个(100g)', serving: '223' },
  { name: '面条', calories: 284, unit: '碗(100g)', serving: '284' },
  { name: '挂面', calories: 346, unit: '100g', serving: '346' },
  { name: '包子', calories: 227, unit: '个(100g)', serving: '227' },
  { name: '饺子', calories: 242, unit: '个(100g)', serving: '242' },
  { name: '包子一个', calories: 227, unit: '个', serving: '227' },
  { name: '煎饼', calories: 280, unit: '个(100g)', serving: '280' },
  { name: '烧饼', calories: 302, unit: '个(100g)', serving: '302' },
  { name: '油条', calories: 386, unit: '根(50g)', serving: '193' },
  { name: '煎饼果子', calories: 400, unit: '个', serving: '400' },
  { name: '手抓饼', calories: 350, unit: '张', serving: '350' },
  { name: '炒饭', calories: 350, unit: '碗', serving: '350' },
  { name: '炒面', calories: 380, unit: '碗', serving: '380' },
  { name: '盖浇饭', calories: 420, unit: '份', serving: '420' },
  
  // 肉类
  { name: '鸡胸肉', calories: 133, unit: '100g', serving: '133' },
  { name: '鸡胸肉100g', calories: 133, unit: '100g', serving: '133' },
  { name: '鸡腿肉', calories: 209, unit: '100g', serving: '209' },
  { name: '鸡翅', calories: 203, unit: '个(70g)', serving: '142' },
  { name: '鸡腿', calories: 181, unit: '个(100g)', serving: '181' },
  { name: '猪肉', calories: 143, unit: '100g', serving: '143' },
  { name: '五花肉', calories: 395, unit: '100g', serving: '395' },
  { name: '瘦肉', calories: 143, unit: '100g', serving: '143' },
  { name: '牛肉', calories: 125, unit: '100g', serving: '125' },
  { name: '牛排', calories: 271, unit: '块(100g)', serving: '271' },
  { name: '牛腩', calories: 190, unit: '100g', serving: '190' },
  { name: '羊肉', calories: 143, unit: '100g', serving: '143' },
  { name: '烤肉', calories: 300, unit: '份(100g)', serving: '300' },
  { name: '炸鸡', calories: 298, unit: '块(100g)', serving: '298' },
  { name: '香肠', calories: 310, unit: '根(50g)', serving: '155' },
  { name: '火腿', calories: 270, unit: '片(30g)', serving: '81' },
  { name: '培根', calories: 542, unit: '100g', serving: '542' },
  { name: '猪排', calories: 260, unit: '块(100g)', serving: '260' },
  { name: '牛腱子肉', calories: 120, unit: '100g', serving: '120' },
  
  // 海鲜类
  { name: '鱼', calories: 90, unit: '100g', serving: '90' },
  { name: '清蒸鱼', calories: 100, unit: '份(100g)', serving: '100' },
  { name: '红烧鱼', calories: 140, unit: '份(100g)', serving: '140' },
  { name: '煎鱼', calories: 160, unit: '份(100g)', serving: '160' },
  { name: '虾', calories: 85, unit: '100g', serving: '85' },
  { name: '白虾', calories: 85, unit: '100g', serving: '85' },
  { name: '基围虾', calories: 85, unit: '100g', serving: '85' },
  { name: '虾仁', calories: 90, unit: '100g', serving: '90' },
  { name: '螃蟹', calories: 95, unit: '100g', serving: '95' },
  { name: '大闸蟹', calories: 120, unit: '只(150g)', serving: '180' },
  { name: '小龙虾', calories: 85, unit: '100g', serving: '85' },
  { name: '三文鱼', calories: 183, unit: '100g', serving: '183' },
  { name: '金枪鱼', calories: 144, unit: '100g', serving: '144' },
  { name: '鳕鱼', calories: 88, unit: '100g', serving: '88' },
  { name: '鲈鱼', calories: 95, unit: '100g', serving: '95' },
  { name: '鲫鱼', calories: 90, unit: '100g', serving: '90' },
  { name: '鲳鱼', calories: 100, unit: '100g', serving: '100' },
  { name: '生蚝', calories: 57, unit: '个(50g)', serving: '29' },
  { name: '扇贝', calories: 60, unit: '个(40g)', serving: '24' },
  { name: '鲍鱼', calories: 84, unit: '个(50g)', serving: '42' },
  { name: '海参', calories: 78, unit: '100g', serving: '78' },
  
  // 蛋类
  { name: '鸡蛋', calories: 144, unit: '个(100g)', serving: '144' },
  { name: '水煮蛋', calories: 144, unit: '个', serving: '144' },
  { name: '水煮蛋一个', calories: 78, unit: '个', serving: '78' },
  { name: '煮鸡蛋', calories: 144, unit: '个(100g)', serving: '144' },
  { name: '煎蛋', calories: 196, unit: '个(100g)', serving: '196' },
  { name: '荷包蛋', calories: 196, unit: '个', serving: '196' },
  { name: '炒蛋', calories: 196, unit: '份(100g)', serving: '196' },
  { name: '蛋炒饭', calories: 350, unit: '碗', serving: '350' },
  { name: '咸蛋', calories: 190, unit: '个(70g)', serving: '133' },
  { name: '皮蛋', calories: 171, unit: '个(70g)', serving: '120' },
  
  // 蔬菜类
  { name: '青菜', calories: 14, unit: '100g', serving: '14' },
  { name: '白菜', calories: 18, unit: '100g', serving: '18' },
  { name: '菠菜', calories: 20, unit: '100g', serving: '20' },
  { name: '油菜', calories: 14, unit: '100g', serving: '14' },
  { name: '西兰花', calories: 34, unit: '100g', serving: '34' },
  { name: '花菜', calories: 26, unit: '100g', serving: '26' },
  { name: '菜花', calories: 26, unit: '100g', serving: '26' },
  { name: '生菜', calories: 13, unit: '100g', serving: '13' },
  { name: '黄瓜', calories: 15, unit: '100g', serving: '15' },
  { name: '西红柿', calories: 15, unit: '100g', serving: '15' },
  { name: '番茄', calories: 15, unit: '100g', serving: '15' },
  { name: '土豆', calories: 76, unit: '100g', serving: '76' },
  { name: '土豆丝', calories: 120, unit: '份(100g)', serving: '120' },
  { name: '土豆炖牛肉', calories: 180, unit: '份(200g)', serving: '360' },
  { name: '红薯', calories: 99, unit: '100g', serving: '99' },
  { name: '紫薯', calories: 70, unit: '100g', serving: '70' },
  { name: '玉米', calories: 112, unit: '根(100g)', serving: '112' },
  { name: '南瓜', calories: 26, unit: '100g', serving: '26' },
  { name: '冬瓜', calories: 11, unit: '100g', serving: '11' },
  { name: '苦瓜', calories: 18, unit: '100g', serving: '18' },
  { name: '茄子', calories: 21, unit: '100g', serving: '21' },
  { name: '豆角', calories: 34, unit: '100g', serving: '34' },
  { name: '四季豆', calories: 34, unit: '100g', serving: '34' },
  { name: '豌豆', calories: 105, unit: '100g', serving: '105' },
  { name: '荷兰豆', calories: 27, unit: '100g', serving: '27' },
  { name: '莲藕', calories: 70, unit: '100g', serving: '70' },
  { name: '芦笋', calories: 20, unit: '100g', serving: '20' },
  { name: '芹菜', calories: 14, unit: '100g', serving: '14' },
  { name: '韭菜', calories: 26, unit: '100g', serving: '26' },
  { name: '蒜苗', calories: 40, unit: '100g', serving: '40' },
  { name: '青椒', calories: 22, unit: '100g', serving: '22' },
  { name: '辣椒', calories: 32, unit: '100g', serving: '32' },
  { name: '洋葱', calories: 39, unit: '100g', serving: '39' },
  { name: '大葱', calories: 30, unit: '100g', serving: '30' },
  { name: '生姜', calories: 41, unit: '100g', serving: '41' },
  { name: '金针菇', calories: 26, unit: '100g', serving: '26' },
  { name: '香菇', calories: 26, unit: '100g', serving: '26' },
  { name: '蘑菇', calories: 22, unit: '100g', serving: '22' },
  { name: '木耳', calories: 21, unit: '100g', serving: '21' },
  { name: '银耳', calories: 200, unit: '100g', serving: '200' },
  { name: '海带', calories: 12, unit: '100g', serving: '12' },
  
  // 豆制品
  { name: '豆腐', calories: 81, unit: '100g', serving: '81' },
  { name: '嫩豆腐', calories: 81, unit: '100g', serving: '81' },
  { name: '老豆腐', calories: 100, unit: '100g', serving: '100' },
  { name: '豆浆', calories: 33, unit: '杯(240ml)', serving: '79' },
  { name: '豆花', calories: 50, unit: '碗(200g)', serving: '100' },
  { name: '豆腐脑', calories: 50, unit: '碗(200g)', serving: '100' },
  { name: '豆腐皮', calories: 447, unit: '100g', serving: '447' },
  { name: '腐竹', calories: 459, unit: '100g', serving: '459' },
  { name: '千张', calories: 262, unit: '100g', serving: '262' },
  { name: '素鸡', calories: 192, unit: '100g', serving: '192' },
  { name: '豆干', calories: 140, unit: '100g', serving: '140' },
  { name: '毛豆', calories: 131, unit: '100g', serving: '131' },
  
  // 水果类
  { name: '苹果', calories: 52, unit: '个(200g)', serving: '104' },
  { name: '苹果一个', calories: 95, unit: '个', serving: '95' },
  { name: '香蕉', calories: 93, unit: '根(100g)', serving: '93' },
  { name: '香蕉一根', calories: 105, unit: '根', serving: '105' },
  { name: '橙子', calories: 47, unit: '个(150g)', serving: '71' },
  { name: '橘子', calories: 44, unit: '个(100g)', serving: '44' },
  { name: '葡萄', calories: 67, unit: '100g', serving: '67' },
  { name: '西瓜', calories: 30, unit: '100g', serving: '30' },
  { name: '哈密瓜', calories: 34, unit: '100g', serving: '34' },
  { name: '火龙果', calories: 55, unit: '个(300g)', serving: '165' },
  { name: '猕猴桃', calories: 61, unit: '个(80g)', serving: '49' },
  { name: '芒果', calories: 65, unit: '个(150g)', serving: '98' },
  { name: '菠萝', calories: 44, unit: '块(100g)', serving: '44' },
  { name: '草莓', calories: 30, unit: '100g', serving: '30' },
  { name: '蓝莓', calories: 57, unit: '100g', serving: '57' },
  { name: '柚子', calories: 42, unit: '瓣(100g)', serving: '42' },
  { name: '梨', calories: 50, unit: '个(180g)', serving: '90' },
  { name: '桃', calories: 51, unit: '个(150g)', serving: '77' },
  { name: '杏', calories: 38, unit: '100g', serving: '38' },
  { name: '樱桃', calories: 63, unit: '100g', serving: '63' },
  { name: '荔枝', calories: 71, unit: '100g', serving: '71' },
  { name: '龙眼', calories: 73, unit: '100g', serving: '73' },
  { name: '枇杷', calories: 39, unit: '100g', serving: '39' },
  { name: '石榴', calories: 73, unit: '个(200g)', serving: '146' },
  { name: '柿子', calories: 71, unit: '个(150g)', serving: '107' },
  { name: '枣', calories: 125, unit: '100g', serving: '125' },
  { name: '椰子', calories: 231, unit: '个(300g)', serving: '693' },
  
  // 奶制品
  { name: '牛奶', calories: 54, unit: '杯(240ml)', serving: '130' },
  { name: '牛奶一杯', calories: 150, unit: '杯', serving: '150' },
  { name: '酸奶', calories: 72, unit: '杯(100g)', serving: '72' },
  { name: '纯牛奶', calories: 54, unit: '杯(240ml)', serving: '130' },
  { name: '脱脂牛奶', calories: 35, unit: '杯(240ml)', serving: '83' },
  { name: '奶酪', calories: 328, unit: '片(30g)', serving: '98' },
  { name: '芝士', calories: 328, unit: '片(30g)', serving: '98' },
  { name: '黄油', calories: 717, unit: '10g', serving: '72' },
  { name: '奶油', calories: 340, unit: '100g', serving: '340' },
  
  // 零食/甜点
  { name: '面包', calories: 265, unit: '片(50g)', serving: '133' },
  { name: '全麦面包', calories: 247, unit: '片(50g)', serving: '124' },
  { name: '全麦面包一片', calories: 70, unit: '片', serving: '70' },
  { name: '吐司', calories: 265, unit: '片(50g)', serving: '133' },
  { name: '蛋糕', calories: 347, unit: '块(100g)', serving: '347' },
  { name: '奶油蛋糕', calories: 400, unit: '块(100g)', serving: '400' },
  { name: '饼干', calories: 435, unit: '100g', serving: '435' },
  { name: '曲奇', calories: 488, unit: '100g', serving: '488' },
  { name: '薯片', calories: 548, unit: '包(100g)', serving: '548' },
  { name: '爆米花', calories: 387, unit: '100g', serving: '387' },
  { name: '巧克力', calories: 546, unit: '块(30g)', serving: '164' },
  { name: '冰淇淋', calories: 207, unit: '100g', serving: '207' },
  { name: '奶茶', calories: 60, unit: '杯(500ml)', serving: '300' },
  { name: '珍珠奶茶', calories: 70, unit: '杯(500ml)', serving: '350' },
  { name: '可乐', calories: 43, unit: '罐(330ml)', serving: '142' },
  { name: '雪碧', calories: 42, unit: '罐(330ml)', serving: '139' },
  { name: '果汁', calories: 45, unit: '杯(250ml)', serving: '113' },
  { name: '坚果', calories: 600, unit: '100g', serving: '600' },
  { name: '花生', calories: 567, unit: '100g', serving: '567' },
  { name: '瓜子', calories: 583, unit: '100g', serving: '583' },
  { name: '核桃', calories: 646, unit: '100g', serving: '646' },
  { name: '杏仁', calories: 579, unit: '100g', serving: '579' },
  { name: '腰果', calories: 552, unit: '100g', serving: '552' },
  { name: '开心果', calories: 614, unit: '100g', serving: '614' },
  { name: '话梅', calories: 280, unit: '100g', serving: '280' },
  { name: '果冻', calories: 80, unit: '个(20g)', serving: '16' },
  
  // 饮品类
  { name: '咖啡', calories: 2, unit: '杯(240ml)', serving: '5' },
  { name: '美式咖啡', calories: 2, unit: '杯(240ml)', serving: '5' },
  { name: '拿铁', calories: 67, unit: '杯(240ml)', serving: '67' },
  { name: '卡布奇诺', calories: 74, unit: '杯(240ml)', serving: '74' },
  { name: '星巴克拿铁', calories: 150, unit: '杯(360ml)', serving: '150' },
  { name: '星冰乐', calories: 260, unit: '杯(360ml)', serving: '260' },
  { name: '绿茶', calories: 1, unit: '杯(240ml)', serving: '2' },
  { name: '红茶', calories: 2, unit: '杯(240ml)', serving: '5' },
  { name: '普洱茶', calories: 1, unit: '杯(240ml)', serving: '2' },
  { name: '蜂蜜水', calories: 30, unit: '杯(240ml)', serving: '60' },
  
  // 汤类
  { name: '紫菜蛋花汤', calories: 25, unit: '碗(200g)', serving: '50' },
  { name: '番茄蛋汤', calories: 30, unit: '碗(200g)', serving: '60' },
  { name: '鸡蛋汤', calories: 35, unit: '碗(200g)', serving: '70' },
  { name: '青菜豆腐汤', calories: 28, unit: '碗(200g)', serving: '56' },
  { name: '玉米排骨汤', calories: 80, unit: '碗(250g)', serving: '200' },
  { name: '鸡汤', calories: 36, unit: '碗(200g)', serving: '72' },
  { name: '鱼汤', calories: 30, unit: '碗(200g)', serving: '60' },
  { name: '莲藕排骨汤', calories: 90, unit: '碗(250g)', serving: '225' },
  { name: '酸辣汤', calories: 50, unit: '碗(200g)', serving: '100' },
  
  // 沙拉/凉菜
  { name: '沙拉', calories: 35, unit: '份(100g)', serving: '35' },
  { name: '沙拉一份', calories: 120, unit: '份', serving: '120' },
  { name: '蔬菜沙拉', calories: 35, unit: '份(100g)', serving: '35' },
  { name: '水果沙拉', calories: 60, unit: '份(150g)', serving: '90' },
  { name: '凉拌黄瓜', calories: 30, unit: '份(100g)', serving: '30' },
  { name: '凉拌木耳', calories: 35, unit: '份(100g)', serving: '35' },
  { name: '凉拌海带丝', calories: 25, unit: '份(100g)', serving: '25' },
  { name: '凉皮', calories: 130, unit: '份(200g)', serving: '260' },
  { name: '凉面', calories: 280, unit: '碗(250g)', serving: '700' },
  
  // 快餐类
  { name: '汉堡', calories: 354, unit: '个', serving: '354' },
  { name: '薯条', calories: 312, unit: '份(中)', serving: '312' },
  { name: '炸薯条', calories: 312, unit: '份(中)', serving: '312' },
  { name: '炸鸡腿', calories: 280, unit: '个', serving: '280' },
  { name: '鸡米花', calories: 300, unit: '份(100g)', serving: '300' },
  { name: '鸡块', calories: 298, unit: '份(100g)', serving: '298' },
  { name: '披萨', calories: 266, unit: '片(100g)', serving: '266' },
  { name: '热狗', calories: 290, unit: '个', serving: '290' },
  { name: '三明治', calories: 250, unit: '个', serving: '250' },
  { name: '寿司', calories: 150, unit: '个(30g)', serving: '150' },
  { name: '关东煮', calories: 150, unit: '份(200g)', serving: '150' },
  { name: '麻辣烫', calories: 200, unit: '碗(300g)', serving: '600' },
  { name: '冒菜', calories: 180, unit: '碗(300g)', serving: '540' },
  { name: '火锅', calories: 150, unit: '份(200g)', serving: '300' },
  { name: '串串', calories: 120, unit: '串(30g)', serving: '120' },
  { name: '烤肉', calories: 300, unit: '份(150g)', serving: '450' },
  { name: '自助餐', calories: 800, unit: '餐', serving: '800' },
  
  // 中式菜肴
  { name: '宫保鸡丁', calories: 197, unit: '份(200g)', serving: '394' },
  { name: '鱼香肉丝', calories: 180, unit: '份(200g)', serving: '360' },
  { name: '回锅肉', calories: 210, unit: '份(200g)', serving: '420' },
  { name: '红烧肉', calories: 250, unit: '份(200g)', serving: '500' },
  { name: '糖醋里脊', calories: 220, unit: '份(200g)', serving: '440' },
  { name: '麻婆豆腐', calories: 130, unit: '份(200g)', serving: '260' },
  { name: '青椒肉丝', calories: 150, unit: '份(200g)', serving: '300' },
  { name: '西红柿炒蛋', calories: 100, unit: '份(200g)', serving: '200' },
  { name: '土豆烧牛肉', calories: 180, unit: '份(250g)', serving: '450' },
  { name: '糖醋排骨', calories: 230, unit: '份(200g)', serving: '460' },
  { name: '水煮鱼', calories: 200, unit: '份(300g)', serving: '600' },
  { name: '酸菜鱼', calories: 150, unit: '份(300g)', serving: '450' },
  { name: '红烧狮子头', calories: 200, unit: '个(80g)', serving: '160' },
  { name: '京酱肉丝', calories: 170, unit: '份(200g)', serving: '340' },
  { name: '木须肉', calories: 140, unit: '份(200g)', serving: '280' },
  { name: '干煸四季豆', calories: 100, unit: '份(150g)', serving: '150' },
  { name: '蒜蓉西兰花', calories: 60, unit: '份(200g)', serving: '120' },
  { name: '蚝油生菜', calories: 40, unit: '份(200g)', serving: '80' },
  { name: '干锅花菜', calories: 120, unit: '份(250g)', serving: '300' },
  { name: '地三鲜', calories: 130, unit: '份(250g)', serving: '325' },
  { name: '酸辣土豆丝', calories: 100, unit: '份(150g)', serving: '150' },
  { name: '麻婆豆腐', calories: 130, unit: '份(200g)', serving: '260' },
  { name: '红烧茄子', calories: 80, unit: '份(200g)', serving: '160' },
  
  // 其他
  { name: '泡面', calories: 470, unit: '桶', serving: '470' },
  { name: '方便面', calories: 470, unit: '桶', serving: '470' },
  { name: '水饺', calories: 242, unit: '份(100g)', serving: '242' },
  { name: '蒸饺', calories: 220, unit: '份(100g)', serving: '220' },
  { name: '蒸包子', calories: 227, unit: '个', serving: '227' },
  { name: '小笼包', calories: 250, unit: '笼(6个)', serving: '250' },
  { name: '蒸蛋', calories: 120, unit: '碗(150g)', serving: '120' },
  { name: '鸡蛋羹', calories: 120, unit: '碗(150g)', serving: '120' },
  { name: '肉夹馍', calories: 320, unit: '个', serving: '320' },
  { name: '肉包子', calories: 227, unit: '个(100g)', serving: '227' },
  { name: '鸡蛋灌饼', calories: 280, unit: '个', serving: '280' },
];

// 检查食物是否存在于本地数据库
function isFoodInDatabase(foodName) {
  const lowerName = foodName.toLowerCase().trim();
  return foodDatabase.some(food => food.name.toLowerCase() === lowerName);
}

Page({
  data: {
    inputDate: '',
    mealType: 'breakfast',
    mealTypes: [
      { key: 'breakfast', label: '🌅 早餐', selected: true },
      { key: 'lunch', label: '☀️ 午餐', selected: false },
      { key: 'dinner', label: '🌙 晚餐', selected: false },
      { key: 'snack', label: '🍪 加餐', selected: false }
    ],
    foods: [{ name: '', calories: '' }],
    days: [],
    showAddPanel: false,
    toastMsg: '',
    toastShow: false,
    // 主题相关 - 🔑 关键：初始值从存储直接读取，避免闪烁
    currentTheme: getInitTheme(),
    // 编辑相关
    isEditing: false,
    editRecordId: '',
    // 食物搜索相关
    searchResults: [],
    searchActiveIndex: -1,
    showSearchPanel: false,
    // 总热量预览
    totalCalPreview: 0,
    // 分页加载相关
    allDays: [],           // 存储所有数据
    displayedDays: [],     // 当前显示的数据
    hasMore: true,         // 是否有更多数据
    isLoadingMore: false,  // 是否正在加载更多
    pageSize: PAGE_SIZE,   // 每页加载数量
    // 云端自定义食物库
    customFoods: [],       // 存储云端自定义食物
    // 防闪炃：主题切换后第一次切 tab 时短暂隐藏页面
    hidePage: false
  },

  onLoad() {
    // 接力主题切换的 loading 遮罩，覆盖 reLaunch 瓦解瞬间的系统壳层过渡帧
    if (wx.getStorageSync('pendingThemeToast')) {
      wx.showLoading({ title: '切换中...', mask: true });
      setTimeout(() => wx.hideLoading(), 250);
    }
    // 🔑 关键修复：立即同步设置主题，避免切换页面时闪炃
    this.setTodayDate();
    this.initTheme();
    // 加载云端自定义食物（不阻塞主题渲染）
    this.loadCustomFoods();
  },

  onShow() {
    // 🔑 关键修复：立即同步刷新主题，再加载数据
    this.initTheme();
    this.showPendingThemeToast(); // 显示 reLaunch 后的主题切换提示
    
    this.loadRecords();
    // 加载云端自定义食物
    this.loadCustomFoods();
  },

  // 读取 reLaunch 前存入的主题切换提示并显示一次
  showPendingThemeToast() {
    const msg = wx.getStorageSync('pendingThemeToast');
    if (!msg) return;
    wx.removeStorageSync('pendingThemeToast');
    this.showToast(msg);
  },

  onTabItemTap() {
    this.initTheme();
  },
  
  // 加载云端自定义食物库
  async loadCustomFoods() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getFoodLibrary',
        data: {}
      });
      
      console.log('=== 云端食物库数据 ===');
      console.log('原始返回:', res);
      
      if (res.result && res.result.foods && res.result.foods.length > 0) {
        // 保存到 data 中，搜索时使用
        this.setData({ customFoods: res.result.foods });
        
        let addedCount = 0;
        // 合并到本地数据库
        res.result.foods.forEach(food => {
          const exists = foodDatabase.some(f => f.name.toLowerCase() === food.name.toLowerCase());
          if (!exists) {
            foodDatabase.push({
              name: food.name,
              calories: food.calories,
              unit: food.unit || '',
              serving: food.calories
            });
            addedCount++;
          }
        });
        console.log(`=== 合并了 ${addedCount} 个新食物到本地 ===`);
        console.log('当前 foodDatabase 长度:', foodDatabase.length);
      } else {
        this.setData({ customFoods: [] });
        console.log('云端食物库为空');
      }
    } catch (e) {
      console.error('加载自定义食物库失败', e);
    }
  },
  
  // 搜索食物（本地 + 云端实时）
  async searchFoods(keyword) {
    if (!keyword || keyword.trim().length < 1) {
      return [];
    }
    const lowerKeyword = keyword.toLowerCase().trim();
    
    // 1. 搜索本地数据库
    const localResults = foodDatabase.filter(food => 
      food.name.toLowerCase().includes(lowerKeyword)
    );
    console.log('本地搜索结果:', localResults);
    
    // 2. 搜索云端自定义食物库（直接调用云函数）
    let cloudResults = [];
    try {
      const res = await wx.cloud.callFunction({
        name: 'searchFoodLibrary',
        data: { keyword: keyword.trim() }
      });
      
      console.log('云端搜索返回:', res);
      
      if (res.result && res.result.foods && res.result.foods.length > 0) {
        cloudResults = res.result.foods.map(food => ({
          name: food.name,
          calories: food.calories,
          unit: food.unit || '',
          serving: food.calories
        }));
        console.log('云端匹配的食物:', cloudResults);
      }
    } catch (e) {
      console.error('云端搜索失败:', e);
      // 云端失败不影响本地搜索
    }
    
    // 3. 合并结果去重（云端数据优先，覆盖本地同名食物）
    const allResults = [...localResults];
    cloudResults.forEach(cloudFood => {
      const localIndex = allResults.findIndex(f => f.name.toLowerCase() === cloudFood.name.toLowerCase());
      if (localIndex >= 0) {
        // 本地有同名食物，用云端数据替换（云端是最新保存的）
        allResults[localIndex] = cloudFood;
      } else {
        // 本地没有，添加云端食物
        allResults.push(cloudFood);
      }
    });
    
    console.log('最终合并结果:', allResults);
    return allResults.slice(0, 6);
  },

  setTodayDate() {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({ inputDate: date });
  },

  async loadRecords() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getDietRecords', data: {} });
      const allDays = res.result.days || [];
      
      // 初始化分页数据
      const displayedDays = allDays.slice(0, PAGE_SIZE);
      const hasMore = allDays.length > PAGE_SIZE;
      
      this.setData({ 
        days: displayedDays,
        allDays: allDays,
        displayedDays: displayedDays,
        hasMore: hasMore,
        isLoadingMore: false
      });
    } catch (e) {
      console.error('加载饮食记录失败', e);
    }
  },

  // 加载更多数据
  loadMore() {
    if (this.data.isLoadingMore || !this.data.hasMore) {
      return;
    }

    this.setData({ isLoadingMore: true });

    const currentLength = this.data.displayedDays.length;
    const allDays = this.data.allDays;
    const nextPage = allDays.slice(currentLength, currentLength + PAGE_SIZE);
    
    if (nextPage.length === 0) {
      this.setData({ 
        hasMore: false,
        isLoadingMore: false 
      });
      return;
    }

    const newDisplayedDays = [...this.data.displayedDays, ...nextPage];
    const hasMore = newDisplayedDays.length < allDays.length;

    this.setData({
      days: newDisplayedDays,
      displayedDays: newDisplayedDays,
      hasMore: hasMore,
      isLoadingMore: false
    });
  },

  // 滚动到底部触发加载更多
  onScrollToLower() {
    this.loadMore();
  },

  toggleAddPanel() {
    // 打开面板时重置为当天日期
    if (!this.data.showAddPanel) {
      // 设置今天日期
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      // 查找今天+早餐的记录
      let newEditRecordId = '';
      let newFoods = [{ name: '', calories: '' }];
      let newIsEditing = false;
      
      const dayData = this.data.allDays.find(d => d.date === today);
      if (dayData) {
        const mealRecord = dayData.records.find(r => r.mealType === 'breakfast');
        if (mealRecord) {
          newEditRecordId = mealRecord._id;
          newFoods = mealRecord.foods.map(f => ({ ...f }));
          newIsEditing = true;
        }
      }
      
      this.setData({
        inputDate: today,
        isEditing: newIsEditing,
        editRecordId: newEditRecordId,
        mealType: 'breakfast',
        mealTypes: [
          { key: 'breakfast', label: '🌅 早餐', selected: true },
          { key: 'lunch', label: '☀️ 午餐', selected: false },
          { key: 'dinner', label: '🌙 晚餐', selected: false },
          { key: 'snack', label: '🍪 加餐', selected: false }
        ],
        foods: newFoods,
        totalCalPreview: 0
      });
      
      // 计算总热量
      if (newIsEditing) {
        this.calcTotalCal();
      }
    }
    this.setData({ showAddPanel: !this.data.showAddPanel });
  },

  onDateChange(e) {
    this.setData({ inputDate: e.detail.value });
  },

  selectMealType(e) {
    const key = e.currentTarget.dataset.key;
    const mealTypes = this.data.mealTypes.map(m => ({
      ...m, selected: m.key === key
    }));
    
    this.setData({ mealType: key, mealTypes });
    
    // 无论是否编辑模式，都尝试加载该日期+餐食的数据
    const currentDate = this.data.inputDate;
    let newEditRecordId = '';
    let newFoods = [{ name: '', calories: '' }];
    let newIsEditing = false;
    
    // 查找该日期下对应餐食的记录
    const dayData = this.data.allDays.find(d => d.date === currentDate);
    if (dayData) {
      const mealRecord = dayData.records.find(r => r.mealType === key);
      if (mealRecord) {
        // 找到记录，加载数据
        newEditRecordId = mealRecord._id;
        newFoods = mealRecord.foods.map(f => ({ ...f }));
        newIsEditing = true;
      }
    }
    
    this.setData({
      editRecordId: newEditRecordId,
      foods: newFoods,
      isEditing: newIsEditing
    });
    
    this.calcTotalCal();
  },

  onFoodNameInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const foods = [...this.data.foods];
    const name = e.detail.value;
    foods[idx].name = name;
    
    this.setData({ 
      foods,
      searchActiveIndex: idx
    });
    
    // 搜索匹配的食物（支持本地 + 云端）
    this.searchFoods(name).then(results => {
      this.setData({
        searchResults: results,
        showSearchPanel: results.length > 0
      });
    });
    
    // 更新总热量
    this.calcTotalCal();
  },
  
  // 选择推荐的食物
  selectFood(e) {
    const item = e.currentTarget.dataset.item;
    const idx = e.currentTarget.dataset.idx;
    const foods = [...this.data.foods];
    
    // 填充食物名称和卡路里（使用 calories 字段）
    foods[idx].name = item.name;
    foods[idx].calories = item.calories || item.serving;
    
    this.setData({
      foods,
      searchResults: [],
      showSearchPanel: false,
      searchActiveIndex: -1
    });
    
    // 更新总热量
    this.calcTotalCal();
  },
  
  // 隐藏搜索面板
  hideSearchPanel() {
    this.setData({
      showSearchPanel: false,
      searchResults: []
    });
  },
  
  // 计算总热量
  calcTotalCal() {
    const total = this.data.foods.reduce((sum, f) => {
      return sum + (parseInt(f.calories) || 0);
    }, 0);
    this.setData({ totalCalPreview: total });
  },

  onFoodCalInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const foods = [...this.data.foods];
    foods[idx].calories = e.detail.value;
    this.setData({ foods });
    // 更新总热量
    this.calcTotalCal();
  },

  addFoodItem() {
    if (this.data.foods.length >= 10) {
      this.showToast('最多添加10项');
      return;
    }
    this.setData({
      foods: [...this.data.foods, { name: '', calories: '' }]
    });
    // 更新总热量
    this.calcTotalCal();
  },

  removeFoodItem(e) {
    const idx = e.currentTarget.dataset.idx;
    if (this.data.foods.length <= 1) {
      this.setData({ foods: [{ name: '', calories: '' }] });
      this.calcTotalCal();
      return;
    }
    const foods = this.data.foods.filter((_, i) => i !== idx);
    this.setData({ foods });
    // 更新总热量
    this.calcTotalCal();
  },

  async onSubmit() {
    const { inputDate, mealType, foods, isEditing, editRecordId } = this.data;

    if (!inputDate) { this.showToast('请选择日期'); return; }

    const validFoods = foods.filter(f => f.name.trim());
    if (validFoods.length === 0) { this.showToast('请至少输入一项食物'); return; }

    const totalCal = validFoods.reduce((sum, f) => sum + (parseInt(f.calories) || 0), 0);
    
    console.log('=== 提交食物 ===');
    console.log('validFoods:', validFoods);
    
    wx.showLoading({ title: '保存中...' });
    try {
      // 如果是编辑模式，先删除原记录
      if (isEditing && editRecordId) {
        await wx.cloud.callFunction({ name: 'deleteDietRecord', data: { id: editRecordId } });
      }
      
      const res = await wx.cloud.callFunction({
        name: 'addDietRecord',
        data: {
          date: inputDate,
          mealType,
          foods: validFoods,
          calories: totalCal
        }
      });
      
      // 每次保存都将食物同步到云端食物库（云函数会自动判断是新增还是更新）
      try {
        console.log('正在同步食物到云端:', validFoods);
        const libraryRes = await wx.cloud.callFunction({
          name: 'addToFoodLibrary',
          data: { foods: validFoods }
        });
        console.log('云端食物库返回:', libraryRes);
        
        // 如果返回了更新信息，更新本地数据库
        if (libraryRes.result && libraryRes.result.results) {
          libraryRes.result.results.forEach(result => {
            if (result.updated || result.added) {
              // 更新本地数据库
              const localIndex = foodDatabase.findIndex(f => f.name.toLowerCase() === result.name.toLowerCase());
              if (localIndex >= 0) {
                foodDatabase[localIndex].calories = result.newCalories;
                foodDatabase[localIndex].serving = result.newCalories;
              }
            }
          });
        }
      } catch (e) {
        console.error('同步食物到云端失败', e);
      }
      
      if (res.result.success) {
        const msg = isEditing ? '记录已更新 ✏️' : '记录成功 🍽️';
        this.showToast(msg);
        this.setData({
          foods: [{ name: '', calories: '' }],
          showAddPanel: false,
          isEditing: false,
          editRecordId: ''
        });
        this.loadRecords();
      }
    } catch (e) {
      this.showToast('保存失败');
    }
    wx.hideLoading();
  },

  async onDeleteDiet(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除这条饮食记录？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({ name: 'deleteDietRecord', data: { id } });
            this.showToast('已删除');
            this.loadRecords();
          } catch (e) {
            this.showToast('删除失败');
          }
        }
      }
    });
  },

  // 编辑饮食记录
  onEditDiet(e) {
    const meal = e.currentTarget.dataset.meal;
    const mealTypes = this.data.mealTypes.map(m => ({
      ...m, selected: m.key === meal.mealType
    }));
    this.setData({
      isEditing: true,
      editRecordId: meal._id,
      inputDate: meal.date,
      mealType: meal.mealType,
      mealTypes: mealTypes,
      foods: meal.foods.map(f => ({ ...f })),
      showAddPanel: true
    });
    // 计算并显示总热量
    this.calcTotalCal();
  },

  // 取消编辑
  cancelEdit() {
    this.setData({
      isEditing: false,
      editRecordId: '',
      inputDate: '',
      mealType: 'breakfast',
      mealTypes: [
        { key: 'breakfast', label: '🌅 早餐', selected: true },
        { key: 'lunch', label: '☀️ 午餐', selected: false },
        { key: 'dinner', label: '🌙 晚餐', selected: false },
        { key: 'snack', label: '🍪 加餐', selected: false }
      ],
      foods: [{ name: '', calories: '' }],
      showAddPanel: false
    });
  },

  // 预设食物快速添加
  quickAdd(e) {
    const item = e.currentTarget.dataset.item;
    const foods = [...this.data.foods];
    const emptyIdx = foods.findIndex(f => !f.name.trim());
    if (emptyIdx >= 0) {
      foods[emptyIdx] = { ...item };
    } else {
      foods.push({ ...item });
    }
    this.setData({ foods });
    // 更新总热量预览
    this.calcTotalCal();
  },

  showToast(msg) {
    this.setData({ toastMsg: msg, toastShow: true });
    setTimeout(() => this.setData({ toastShow: false }), 2000);
  },
  
  // 跳转到热量分析页面
  goToCalorieAnalysis() {
    wx.navigateTo({
      url: '/pages/calorie-detail/calorie-detail'
    });
  },

  // 跳转到 AI 营养师聊天页面
  goToAiChat() {
    wx.navigateTo({
      url: '/pages/ai-chat/ai-chat'
    });
  },
  
  // 主题相关方法
  initTheme() {
    const theme = app.getEffectiveTheme();
    // 状态栏颜色必须每次都设置，否则首次进入/切Tab时状态栏文字看不清
    this.setPullDownRefreshBg(theme);
    if (this.data.currentTheme !== theme) {
      this.setData({
        currentTheme: theme
      });
      app.applyThemeToTabBar();
    }
  },

  // 页面主题变化回调（由 notifyThemeChange 触发）
  onThemeChange() {
    const theme = app.getEffectiveTheme();
    this.setData({
      currentTheme: theme
    });
    this.setPullDownRefreshBg(theme);
    // applyThemeToTabBar 由 applyThemeWithSystem 调用，此处不重复
  },
  
  // 设置下拉刷新背景色
  setPullDownRefreshBg(theme) {
    if (theme === 'light') {
      // 浅色模式：设置浅色背景
      wx.setBackgroundColor({
        backgroundColor: '#f8f9fa',
        backgroundColorTop: '#f8f9fa',
        backgroundColorBottom: '#f8f9fa',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'dark' // 浅色背景上用黑色文字
      });
      // 设置状态栏文字颜色为深色
      wx.setNavigationBarColor({
        frontColor: '#000000',
        backgroundColor: '#f8f9fa',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    } else {
      // 深色模式：设置深色背景
      wx.setBackgroundColor({
        backgroundColor: '#0f0f13',
        backgroundColorTop: '#0f0f13',
        backgroundColorBottom: '#0f0f13',
      });
      wx.setBackgroundTextStyle({
        textStyle: 'light' // 深色背景上用白色文字
      });
      // 设置状态栏文字颜色为浅色
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#0f0f13',
        animation: { duration: 0, timingFunc: 'linear' }
      });
    }
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    console.log('饮食页面下拉刷新开始');
    
    // 加载数据
    this.loadRecords().then(() => {
      // 停止下拉刷新
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 500);
    });
  }
});

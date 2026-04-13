// components/custom-tab-bar/custom-tab-bar.js
const app = getApp();

Component({
  /**
   * 组件的属性列表
   */
  properties: {},

  /**
   * 组件的初始数据
   */
  data: {
    theme: 'dark',
    list: [
      {
        pagePath: "/pages/index/index",
        text: "打卡",
        iconPath: "../../images/tab-weight.png",
        selectedIconPath: "../../images/tab-weight-active.png"
      },
      {
        pagePath: "/pages/diet/diet",
        text: "饮食",
        iconPath: "../../images/tab-diet.png",
        selectedIconPath: "../../images/tab-diet-active.png"
      }
    ],
    selected: 0
  },

  /**
   * 组件的方法列表
   */
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      
      // 切换tab
      wx.switchTab({
        url: item.pagePath
      });
    },
    
    updateTheme(theme) {
      const currentTheme = theme || 'dark';
      
      // 浅色主题下：激活用普通图标，未激活用高亮图标（反过来）
      // 深色主题下：激活用高亮图标，未激活用普通图标（正常）
      const list = [
        {
          pagePath: "/pages/index/index",
          text: "打卡",
          iconPath: currentTheme === 'light' ? '../../images/tab-weight-active.png' : '../../images/tab-weight.png',
          selectedIconPath: currentTheme === 'light' ? '../../images/tab-weight.png' : '../../images/tab-weight-active.png'
        },
        {
          pagePath: "/pages/diet/diet",
          text: "饮食",
          iconPath: currentTheme === 'light' ? '../../images/tab-diet-active.png' : '../../images/tab-diet.png',
          selectedIconPath: currentTheme === 'light' ? '../../images/tab-diet.png' : '../../images/tab-diet-active.png'
        }
      ];
      
      this.setData({
        theme: currentTheme,
        list: list 
      });
    }
  },

  lifetimes: {
    attached: function() {
      // 获取当前页面路径
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentPath = '/' + currentPage.route;
      
      // 设置当前选中的tab
      const list = this.data.list;
      for (let i = 0; i < list.length; i++) {
        if (list[i].pagePath === currentPath) {
          this.setData({
            selected: i
          });
          break;
        }
      }
      
      // 设置初始主题（同时更新图标路径）
      if (app.globalData.theme) {
        this.updateTheme(app.globalData.theme);
      }
    }
  }
});
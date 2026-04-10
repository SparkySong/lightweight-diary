// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      traceUser: true,
      env: wx.cloud.DYNAMIC_CURRENT_ENV
    });
    
    // 初始化主题（默认深色模式）
    this.initTheme();
    
    // 应用主题到tabBar
    this.applyThemeToTabBar();
  },
  
  // 初始化主题
  initTheme() {
    let theme = wx.getStorageSync('appTheme');
    if (!theme) {
      theme = 'dark'; // 默认深色模式
      wx.setStorageSync('appTheme', theme);
    }
    this.globalData.theme = theme;
  },
  
  // 切换主题
  switchTheme() {
    let theme = wx.getStorageSync('appTheme');
    theme = theme === 'dark' ? 'light' : 'dark';
    wx.setStorageSync('appTheme', theme);
    this.globalData.theme = theme;
    
    // 应用主题到tabBar
    this.applyThemeToTabBar();
    
    return theme;
  },
  
  // 获取当前主题
  getTheme() {
    return wx.getStorageSync('appTheme') || 'dark';
  },
  
  // 应用主题到tabBar
  applyThemeToTabBar() {
    const theme = this.getTheme();
    const tabBarConfig = {
      color: theme === 'dark' ? '#8888a0' : '#868e96',
      selectedColor: theme === 'dark' ? '#6c5ce7' : '#4c6ef5',
      backgroundColor: theme === 'dark' ? '#0f0f13' : '#ffffff',
      borderStyle: theme === 'dark' ? 'black' : 'white'
    };
    
    // 存储当前tabBar配置供页面使用
    this.globalData.tabBarConfig = tabBarConfig;
    this.globalData.theme = theme;
    
    // 更新自定义tabBar主题
    this.updateCustomTabBarTheme(theme);
  },
  
  // 更新自定义tabBar组件的主题
  updateCustomTabBarTheme(theme) {
    try {
      // 获取当前页面栈
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        
        // 如果有自定义tabBar组件，则更新其主题
        if (currentPage.selectComponent) {
          const customTabBar = currentPage.selectComponent('.custom-tab-bar');
          if (customTabBar && customTabBar.updateTheme) {
            customTabBar.updateTheme(theme);
          }
        }
      }
    } catch (error) {
      console.log('更新自定义tabBar主题失败:', error);
    }
  },
  
  // 获取tabBar配置（供页面使用）
  getTabBarConfig() {
    return this.globalData.tabBarConfig || {
      color: '#8888a0',
      selectedColor: '#6c5ce7',
      backgroundColor: '#0f0f13',
      borderStyle: 'black'
    };
  },
  
  globalData: {
    userInfo: null,
    theme: 'dark', // 默认为深色模式
    tabBarConfig: null
  }
});

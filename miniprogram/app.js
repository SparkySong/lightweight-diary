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
    
    // 监听系统主题变化
    this.watchSystemTheme();
    
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
    const themeSetting = wx.getStorageSync('appTheme');
    // 如果用户选择跟随系统，则返回系统主题
    if (themeSetting === 'system') {
      return this.getSystemTheme();
    }
    return themeSetting || 'dark';
  },
  
  // 获取微信客户端主题
  getSystemTheme() {
    try {
      // 尝试所有可能的 API 获取主题
      const apis = [
        { name: 'wx.getAppBaseInfo', fn: wx.getAppBaseInfo },
        { name: 'wx.getDeviceInfo', fn: wx.getDeviceInfo },
        { name: 'wx.getSystemSetting', fn: wx.getSystemSetting },
        { name: 'wx.getSystemInfoSync', fn: wx.getSystemInfoSync }
      ];
      
      for (const api of apis) {
        if (typeof api.fn === 'function') {
          try {
            const info = api.fn();
            if (info && info.theme) {
              wx.setStorageSync('lastSystemTheme', info.theme);
              return info.theme;
            }
          } catch (e) {
            // 继续尝试下一个 API
          }
        }
      }
      
      // 如果所有 API 都无法获取主题，使用上次保存的主题
      const lastSystemTheme = wx.getStorageSync('lastSystemTheme');
      if (lastSystemTheme) {
        return lastSystemTheme;
      }
      
      // 首次使用且无法检测，默认深色（与小程序默认主题一致）
      return 'dark';
    } catch (e) {
      return 'dark';
    }
  },
  
  // 设置系统主题（供用户手动选择）
  setSystemTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      wx.setStorageSync('lastSystemTheme', theme);
    }
  },
  
  // 监听微信客户端主题变化
  watchSystemTheme() {
    try {
      // 基础库 2.21+ 支持 wx.onThemeChange
      if (typeof wx.onThemeChange === 'function') {
        wx.onThemeChange((res) => {
          console.log('微信主题变化通知:', res.theme);
          // 保存检测到的系统主题
          if (res.theme === 'dark' || res.theme === 'light') {
            wx.setStorageSync('lastSystemTheme', res.theme);
          }
          
          const themeSetting = wx.getStorageSync('appTheme');
          // 仅当用户选择跟随系统时才响应
          if (themeSetting === 'system') {
            // 更新 globalData 中的主题
            this.globalData.theme = res.theme;
            // 应用主题到tabBar
            this.applyThemeToTabBar();
            // 通知页面主题变化
            this.notifyThemeChange();
          }
        });
        console.log('已注册微信主题变化监听');
      } else {
        console.log('当前版本不支持 wx.onThemeChange，将使用 onShow 检测');
      }
      
      // 首次启动时保存检测到的系统主题
      const currentTheme = this.getSystemTheme();
      wx.setStorageSync('lastSystemTheme', currentTheme);
      console.log('首次保存系统主题:', currentTheme);
    } catch (err) {
      console.error('监听微信主题变化失败:', err);
    }
  },
  
  // 通知所有页面主题变化
  notifyThemeChange() {
    const pages = getCurrentPages();
    pages.forEach(page => {
      if (page.onThemeChange) {
        page.onThemeChange();
      }
    });
  },
  
  // 获取主题设置（区分手动设置和跟随系统）
  getThemeSetting() {
    return wx.getStorageSync('appTheme') || 'dark';
  },
  
  // 获取显示用主题（实际生效的主题）
  getEffectiveTheme() {
    const themeSetting = this.getThemeSetting();
    if (themeSetting === 'system') {
      return this.getSystemTheme();
    }
    return themeSetting;
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
    
    // 动态更新原生 tabBar 样式
    try {
      wx.setTabBarStyle({
        color: tabBarConfig.color,
        selectedColor: tabBarConfig.selectedColor,
        backgroundColor: tabBarConfig.backgroundColor,
        borderStyle: tabBarConfig.borderStyle,
        fail: (err) => {
          console.error('设置tabBar样式失败:', err);
        }
      });
      
      // 更新 tabBar 图标（浅色主题：激活用普通图标，未激活用高亮图标）
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        const route = currentPage.route;
        
        // 根据主题决定图标路径
        // 浅色主题：激活用普通图标，未激活用高亮图标
        // 深色主题：激活用高亮图标，未激活用普通图标
        const indexIconPath = theme === 'light' ? 'images/tab-weight-active.png' : 'images/tab-weight.png';
        const indexSelectedIconPath = theme === 'light' ? 'images/tab-weight.png' : 'images/tab-weight-active.png';
        const dietIconPath = theme === 'light' ? 'images/tab-diet-active.png' : 'images/tab-diet.png';
        const dietSelectedIconPath = theme === 'light' ? 'images/tab-diet.png' : 'images/tab-diet-active.png';
        
        // 根据当前页面更新图标选中状态
        if (route === 'pages/index/index') {
          wx.setTabBarItem({
            index: 0,
            iconPath: indexIconPath,
            selectedIconPath: indexSelectedIconPath,
            text: '打卡'
          });
          wx.setTabBarItem({
            index: 1,
            iconPath: dietIconPath,
            selectedIconPath: dietIconPath,
            text: '饮食'
          });
        } else if (route === 'pages/diet/diet') {
          wx.setTabBarItem({
            index: 0,
            iconPath: indexIconPath,
            selectedIconPath: indexIconPath,
            text: '打卡'
          });
          wx.setTabBarItem({
            index: 1,
            iconPath: dietIconPath,
            selectedIconPath: dietSelectedIconPath,
            text: '饮食'
          });
        }
      }
    } catch (err) {
      console.error('更新tabBar失败:', err);
    }
    
    // 更新自定义tabBar主题（如果有的话）
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

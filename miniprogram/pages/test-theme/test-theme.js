const app = getApp();
const Toast = require('../../vant/toast/toast');

Page({
  data: {
    currentTheme: 'dark',
    showDialog: false,
    showPopup: false,
    showActionSheet: false,
    dialogType: 'confirm', // confirm, input, custom
    actions: [
      { name: '编辑记录', value: 'edit', icon: 'edit' },
      { name: '分享记录', value: 'share', icon: 'share' },
      { name: '删除记录', value: 'delete', icon: 'delete', color: '#EF4444' }
    ]
  },

  onLoad() {
    this.setData({
      currentTheme: app.getTheme()
    });
  },

  onShow() {
    // 更新主题
    this.setData({
      currentTheme: app.getTheme()
    });
  },

  // 切换主题
  switchTheme() {
    const newTheme = app.switchTheme();
    this.setData({
      currentTheme: newTheme
    });
    Toast({
      message: `已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`,
      position: 'bottom'
    });
  },

  // 显示确认对话框
  showConfirmDialog() {
    this.setData({
      showDialog: true,
      dialogType: 'confirm'
    });
  },

  // 显示输入对话框
  showInputDialog() {
    this.setData({
      showDialog: true,
      dialogType: 'input'
    });
  },

  // 关闭Dialog
  onCloseDialog() {
    this.setData({
      showDialog: false
    });
  },

  // 确认对话框
  onConfirmDialog() {
    Toast({
      message: '确认操作',
      position: 'bottom'
    });
    this.onCloseDialog();
  },

  // 取消对话框
  onCancelDialog() {
    this.onCloseDialog();
  },

  // 显示Popup
  showPopup() {
    this.setData({
      showPopup: true
    });
  },

  // 关闭Popup
  onClosePopup() {
    this.setData({
      showPopup: false
    });
  },

  // 显示ActionSheet
  showActionSheet() {
    this.setData({
      showActionSheet: true
    });
  },

  // 关闭ActionSheet
  onCloseActionSheet() {
    this.setData({
      showActionSheet: false
    });
  },

  // ActionSheet选项点击
  onActionSheetSelect(e) {
    const { index } = e.detail;
    const action = this.data.actions[index];
    Toast({
      message: `选择了${action.name}`,
      position: 'bottom'
    });
    this.onCloseActionSheet();
  }
});
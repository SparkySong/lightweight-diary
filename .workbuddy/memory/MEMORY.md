# 轻体日记小程序项目记忆

## 项目概述
- **项目名称**: 轻体日记 (weight-tracker-miniprogram)
- **项目类型**: 微信小程序
- **主要功能**: 体重记录、饮食记录、运动记录、经期追踪、成就系统

## 技术栈
- **前端**: 微信小程序原生开发 (WXML/WXSS/WXS)
- **UI组件库**: Vant Weapp @1.11.6
- **设计风格**: 薄荷健康风格，薄荷绿主色调 (#22C55E)
- **主题支持**: 深色/浅色主题切换

## 重构记录
### 2026-07-11 重构完成
- 引入Vant组件库，按需引入21个核心组件
- 建立完整的设计系统（颜色、间距、圆角、阴影）
- 重构核心页面（index, diet, exercise, profile）
- 迁移所有页面Toast组件到Vant Toast
- 包大小控制：约663KB（远低于2MB限制）

### 2026-07-13 报错修复
- **ES6语法修复**：将所有Vant组件的ES6语法（import/export）转换为CommonJS语法（require/module.exports）
- **缺失依赖修复**：补全了 `info`、`goods-action`、`picker-column` 等 Vant 内部依赖组件
- **路径报错修复**：删除了未使用的 `tabbar` 和 `tabbar-item` 组件，解决了路径解析问题
- **wxs 补全**：复制了 `wxs` 目录，解决了组件样式依赖问题
- **mixins 补全**：复制了 `mixins` 目录，解决了 `button` 等组件依赖 `basic.js` 的报错

### 2026-07-13 主题色修正
- **问题**：用户反馈主题色薄荷绿设置错误，应该是更亮更清新的绿色（#22C55E）
- **解决方案**：全局替换所有颜色值，从`#4A9B8A`改为`#22C55E`
- **修正范围**：配置文件、样式文件、页面样式、Vant组件、JavaScript代码

## 组件依赖注意事项 (2026-07-13 更新)
### Vant Weapp 组件依赖
Vant Weapp 组件之间存在复杂的依赖关系，**按需复制组件时必须连同依赖一起复制**，否则会导致报错：
- `van-icon` 依赖 `van-info`
- `van-dialog` 依赖 `van-goods-action` (及其子组件)
- `van-picker` 依赖 `picker-column`
- 多个组件依赖 `wxs` 目录
- `tabbar` 依赖 `tabbar-item`
- `button` 等组件依赖 `mixins` 目录

### 解决方案
1.  **检查依赖**：使用 `grep -rh "usingComponents" -A 10` 检查组件的 `index.json` 文件
2.  **补全依赖**：将缺失的依赖组件一起复制到 `vant` 目录
3.  **删除未使用组件**：如果组件未在项目中使用（如 `tabbar`），建议删除其目录，以免引发缓存或路径解析问题

### ES6语法修复 (2026-07-13)
**问题**：Vant Weapp 原始代码使用 ES6 语法（import/export），但微信小程序不支持 ES6 模块语法
**解决方案**：将所有 ES6 语法转换为 CommonJS 语法：
- 将 `import { xxx } from './xxx'` 改为 `const { xxx } = require('./xxx')`
- 将 `export const xxx = ...` 改为 `const xxx = ...; module.exports = { xxx }`
- 将 `export default xxx` 改为 `module.exports = xxx`

**已修复的关键文件**：
- `vant/common/validator.js`
- `vant/common/component.js`
- `vant/common/color.js`
- `vant/common/utils.js`
- `vant/common/version.js`
- `vant/common/relation.js`
- `vant/mixins/basic.js`
- `vant/mixins/button.js`
- `vant/mixins/transition.js`
- `vant/mixins/link.js`
- `vant/mixins/page-scroll.js`
- `vant/mixins/touch.js`
- `vant/toast/toast.js`
- `vant/toast/index.js`
- `vant/dialog/index.js`
- `vant/dialog/dialog.js`
- `vant/icon/index.js`
- 以及所有其他 Vant 组件文件

## 设计规范
### 颜色系统
- 主色调: #22C55E (薄荷绿)
- 成功色: #22C55E
- 警告色: #F59E0B
- 错误色: #EF4444

### 间距系统 (8rpx基准)
- xs: 8rpx
- sm: 16rpx
- md: 24rpx
- lg: 32rpx
- xl: 40rpx

### 圆角系统
- sm: 8rpx
- md: 16rpx
- lg: 24rpx
- full: 999rpx

## 注意事项
1. Vant Toast使用方式：`const Toast = require('../../vant/toast/toast'); Toast({ message: '提示' });`
2. Vant Dialog使用方式：`<van-dialog show="" bind:confirm="onConfirm">`
3. 主题变量使用：`color: var(--text-primary); background: var(--bg-card);`
4. 设计系统在app.wxss中全局导入，无需单独引入

## 文件结构
```
miniprogram/
├── styles/
│   └── design-system.wxss    # 设计系统
├── vant/                     # Vant组件库 (按需引入)
│   ├── common/               # 公共依赖
│   ├── info/                 # 信息角标
│   ├── goods-action/         # 商品操作栏
│   ├── picker-column/        # 选择器列
│   ├── sidebar/              # 侧边栏
│   ├── sticky/               # 粘性布局
│   ├── tab/                  # 标签页
│   ├── tabs/                 # 标签页容器
│   ├── wxs/                  # WXS 工具函数
│   ├── mixins/               # 混入函数 (basic.js 等)
│   └── ... (其他核心组件)
└── pages/
    ├── index/                # 首页 ✅
    ├── diet/                 # 饮食页 ✅
    ├── exercise/             # 运动页 ✅
    ├── profile/              # 个人页 ✅
    └── ... (其他页面已更新Toast)
```

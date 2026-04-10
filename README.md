

# 轻量日记 (Lightweight Diary)

一个基于微信小程序云开发的轻量级日记应用，支持饮食记录和生活日志的云端存储与管理。

## 功能特性

- 📝 **日记记录** - 快速记录每日生活点滴
- 🍽️ **饮食追踪** - 记录每日饮食情况
- ☁️ **云端存储** - 数据安全存储在云数据库
- 📱 **小程序支持** - 完美的微信小程序集成

## 技术栈

- **前端框架**: 微信小程序
- **后端**: 微信云开发 (CloudBase)
- **数据库 SDK**: @cloudbase/database
- **Node.js SDK**: @cloudbase/node-sdk

## 项目结构

```
├── cloudfunctions/
│   ├── addDietRecord/     # 饮食记录云函数
│   │   ├── index.js
│   │   ├── config.json
│   │   └── package.json
│   └── addRecord/         # 日记记录云函数
│       ├── index.js
│       ├── config.json
│       └── package.json
└── .cloudbase/
    └── container/
        └── debug.json
```

## 云函数说明

### addDietRecord
饮食记录云函数，用于添加用户的饮食数据。

### addRecord
日记记录云函数，用于添加日常日记内容。

## 快速开始

### 1. 环境要求

- Node.js 14.0+
- 微信开发者工具

### 2. 安装依赖

在云函数目录中安装依赖：

```bash
cd cloudfunctions/addRecord
npm install
```

### 3. 配置云开发环境

在微信开发者工具中创建云开发环境，并在 `cloudfunctions/addRecord/config.json` 中配置环境 ID。

### 4. 部署云函数

使用微信开发者工具上传并部署云函数。

## 数据结构

### 日记记录 (records)
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | ObjectId | 记录ID |
| content | String | 日记内容 |
| createTime | Date | 创建时间 |
| tags | Array | 标签 |

### 饮食记录 (diet)
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | ObjectId | 记录ID |
| foodName | String | 食物名称 |
| calories | Number | 卡路里 |
| mealType | String | 餐次(早餐/午餐/晚餐) |
| createTime | Date | 创建时间 |

## 使用说明

1. 初始化云开发环境
2. 调用云函数添加记录
3. 查询历史记录
4. 数据统计分析

## 注意事项

- 请确保云数据库已创建相应的集合
- 云函数运行时长限制为 60 秒
- 注意保护用户隐私数据

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！
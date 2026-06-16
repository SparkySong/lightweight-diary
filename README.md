# 轻体日记 (Lightweight Diary)

一个基于微信云开发的**体重管理与健康饮食追踪**小程序，支持 AI 营养师对话、饮食热量分析、运动记录、经期管理、低卡食谱推荐等丰富功能。

## 功能特性

### 体重管理
- 每日体重打卡记录（支持 kg / 斤 双单位）
- 体重趋势折线图（平滑曲线 + 面积填充）
- BMI 实时计算与分级展示（含可视化进度条）
- 目标设定与进度追踪
- 连续打卡天数统计
- 微信订阅消息打卡提醒

### 今日能量
- 实时热量收支概览（已吃 / 基础代谢 / 剩余可摄入）
- 一眼判断是否超标，智能提示建议
- 能量构成进度条可视化

### 饮食追踪
- 四餐分类记录：早餐、午餐、晚餐、加餐
- 内置 **280+ 种**常见食物卡路里数据库
- 云端自定义食物库（用户添加的食物自动同步）
- 实时模糊搜索（本地 + 云端合并去重）
- 单餐/每日热量实时统计

### 运动记录
- 自定义运动类型与时长记录
- 微信运动步数自动同步
- 运动消耗热量计算
- 今日运动数据汇总

### 热量分析
- 今日总热量 vs 目标热量对比
- 三餐分布环形饼图
- 近 7 天热量趋势折线图
- 三餐实际 vs 推荐摄入量柱状图对比
- 智能建议引擎（根据超标/达标状态生成差异化建议）

### 经期管理
- 经期记录（开始/结束日期）
- 持续天数自动计算
- 经期历史列表与管理
- 进行中经期状态标记

### AI 营养师
- **混合架构**：结构化问题模板即时响应，开放性问题调用 AI 大模型
- 7 种意图识别（BMI、体重、今日饮食、综合概况等）
- 调用 Claude Opus 4.8，SSE 流式输出
- 打字机逐字展示效果 + 富文本渲染
- 自动注入用户档案和饮食数据作为上下文

### 低卡食谱推荐
- **110+ 道**低卡健康食谱（早餐 / 午餐 / 晚餐 / 加餐）
- 6 种营养标签（高蛋白、低脂、高纤维、低GI、低卡、均衡）
- 基于日期的伪随机推荐（同天固定、隔天换新）
- 一键生成今日套餐

### 健康报告
- AI 生成个性化健康分析报告
- 历史报告存档与查看

### 成就系统
- 多维度健康成就徽章
- 打卡里程碑与激励

### 主题系统
- 三种模式：深色 / 浅色 / 跟随系统（默认跟随系统）
- 全局主题变量统一管理
- TabBar 图标与颜色动态切换
- 状态栏颜色自适应

## 技术栈

| 技术 | 说明 |
|------|------|
| 前端框架 | 微信小程序原生开发 |
| 后端 | 微信云开发 (CloudBase) |
| 数据库 | 微信云数据库（10 个集合） |
| AI 能力 | Claude Opus 4.8（SSE 流式传输） |
| UI 风格 | 现代简约设计，深色/浅色双主题 |

## 项目结构

```
├── miniprogram/
│   ├── pages/
│   │   ├── index/              # 打卡页 - 体重记录、BMI、今日能量
│   │   ├── diet/               # 饮食页 - 每日饮食记录
│   │   ├── exercise/           # 运动页 - 运动记录与步数同步
│   │   ├── period/             # 经期页 - 经期记录与管理
│   │   ├── profile/            # 我的 - 个人中心与设置
│   │   ├── calorie-detail/     # 热量分析详情页
│   │   ├── recipe/             # 低卡食谱推荐页
│   │   ├── ai-chat/            # AI 营养师聊天页
│   │   ├── report/             # 健康报告页
│   │   └── achievements/       # 成就页
│   ├── styles/
│   │   ├── theme.wxss          # CSS 变量定义（双主题）
│   │   └── simple-theme.wxss   # 通用组件主题样式
│   ├── app.js                  # 应用入口（主题管理核心逻辑）
│   └── app.wxss                # 全局样式
├── cloudfunctions/
│   ├── addRecord               # 添加/更新体重记录
│   ├── deleteRecord            # 删除体重记录
│   ├── getRecords              # 获取体重记录列表
│   ├── getGoal                 # 获取目标体重
│   ├── setGoal                 # 设置目标体重
│   ├── addDietRecord           # 新增饮食记录
│   ├── deleteDietRecord        # 删除饮食记录
│   ├── getDietRecords          # 获取饮食记录（按日分组）
│   ├── addToFoodLibrary        # 批量添加/更新食物到云端库
│   ├── getFoodLibrary          # 获取用户自定义食物列表
│   ├── searchFoodLibrary       # 模糊搜索云端食物库
│   ├── addExercise             # 新增运动记录
│   ├── deleteExercise          # 删除运动记录
│   ├── getExercises            # 获取运动记录
│   ├── syncWeRunSteps          # 同步微信运动步数
│   ├── addPeriod               # 新增经期记录
│   ├── deletePeriod            # 删除经期记录
│   ├── getPeriods              # 获取经期记录
│   ├── generateReport          # 生成健康报告
│   ├── getReports              # 获取历史报告
│   ├── getUserSettings         # 获取用户设置
│   ├── saveUserSettings        # 保存用户设置（含性别）
│   ├── getProfile              # 获取用户档案（含性别、身高）
│   ├── subscribeReminder       # 管理/取消订阅提醒
│   ├── sendReminder            # 定时触发器：批量发送提醒
│   ├── aiChat                  # AI 大模型调用（Claude）
│   └── customerService         # 微信客服消息自动回复
└── images/                      # 图标资源（TabBar 等）
```

## 数据模型

### 体重记录 (`weight_records`)
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | String | 文档 ID |
| openid | String | 用户 OpenID |
| date | String | 日期 YYYY-MM-DD |
| weight | Number | 体重（kg） |
| createTime / updateTime | Date | 创建/更新时间 |

### 饮食记录 (`diet_records`)
| 字段 | 类型 | 说明 |
|------|------|------|
| _id | String | 文档 ID |
| openid | String | 用户 OpenID |
| date | String | 日期 |
| mealType | String | 餐型: breakfast/lunch/dinner/snack |
| foods | Array | 食物列表 `[{name, calories}]` |
| calories | Number | 该餐总热量 |

### 其他集合
| 集合名 | 用途 |
|--------|------|
| `weight_goals` | 目标体重 |
| `user_profiles` | 用户档案（身高、性别等） |
| `food_library` | 自定义食物库 |
| `user_settings` | 用户设置（每日热量目标） |
| `user_reminders` | 订阅提醒配置 |
| `exercises` | 运动记录 |
| `periods` | 经期记录 |
| `reports` | 健康报告 |

## 快速开始

### 环境要求
- Node.js 14.0+
- 微信开发者工具
- 已开通微信云开发环境

### 安装部署

1. 克隆项目并用微信开发者工具打开
2. 在云开发控制台创建以下集合：
   - `weight_records`、`weight_goals`、`user_profiles`
   - `diet_records`、`food_library`
   - `user_settings`、`user_reminders`
   - `exercises`、`periods`、`reports`
3. 在每个云函数目录执行 `npm install`
4. 上传并部署所有云函数（选择云端安装依赖）
5. 在 `app.js` 中确认云环境初始化配置

## 注意事项

- 云函数运行时长限制为 60 秒
- 所有数据操作通过 OpenID 校验归属权
- AI 聊天功能需配置外部 API Key（见 `cloudfunctions/aiChat/index.js`）
- 提醒订阅依赖微信订阅消息能力（需申请对应模板）

## License

MIT License

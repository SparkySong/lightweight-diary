# Lightweight Diary

A **weight management and diet tracking** Mini Program built on WeChat Cloud Development, featuring AI nutritionist chat, calorie analysis, exercise tracking, period management, and low-calorie recipe recommendations.

## Features

### Weight Management
- Daily weight check-in (supports kg / jin dual units)
- Weight trend line chart (smooth Catmull-Rom spline with area fill)
- Real-time BMI calculation & classification (with visual progress bar)
- Goal setting & progress tracking
- Consecutive check-in streak counter
- WeChat subscription message reminders

### Today's Energy
- Real-time calorie balance overview (intake / BMR / remaining)
- At-a-glance over-target detection with smart suggestions
- Energy composition progress bar visualization

### Diet Tracking
- 4 meal categories: Breakfast, Lunch, Dinner, Snack
- Built-in **280+** food items with calorie data
- Cloud-based custom food library (user-added foods auto-sync)
- Real-time fuzzy search (local + cloud merged & deduplicated)
- Per-meal / daily calorie totals

### Exercise Tracking
- Custom exercise type & duration logging
- WeChat Run step auto-sync
- Exercise calorie burn calculation
- Daily exercise summary

### Calorie Analysis
- Daily total vs target comparison
- Meal distribution donut chart
- 7-day calorie trend line chart
- Actual vs recommended intake bar chart comparison
- Smart suggestion engine (context-aware recommendations based on status)

### Period Management
- Period logging (start/end dates)
- Auto-calculated duration days
- Period history list & management
- Active period status indicator

### AI Nutritionist
- **Hybrid architecture**: Template responses for structured queries (instant), AI LLM for open questions
- 7 intent categories (BMI, weight, today's diet, overview, etc.)
- Powered by Claude Opus 4.8 via SSE streaming
- Typewriter effect + rich text rendering
- Auto-injects user profile & diet data as context

### Low-Cal Recipe Library
- **110+** healthy recipes (Breakfast / Lunch / Dinner / Snack)
- 6 nutrition tags (high-protein, low-fat, high-fiber, low-GI, low-cal, balanced)
- Date-seeded pseudo-random recommendation (stable per day, changes next day)
- One-tap daily meal plan generation

### Health Reports
- AI-generated personalized health analysis reports
- Historical report archive & viewing

### Achievements
- Multi-dimensional health achievement badges
- Check-in milestones & incentives

### Theme System
- 3 modes: Dark / Light / Follow System (default: follow system)
- Global CSS variable management
- Dynamic TabBar icon & color switching
- Adaptive status bar color

## Tech Stack

| Technology | Description |
|------------|-------------|
| Frontend | Native WeChat Mini Program |
| Backend | WeChat Cloud Development (CloudBase) |
| Database | WeChat Cloud Database (10 collections) |
| AI | Claude Opus 4.8 (SSE streaming) |
| UI Design | Modern minimalist, dark/light dual theme |

## Project Structure

```
├── miniprogram/
│   ├── pages/
│   │   ├── index/              # Check-in - Weight records & trend chart
│   │   ├── diet/               # Diet - Daily meal logging
│   │   ├── profile/            # Profile - Settings & user info
│   │   ├── calorie-detail/     # Calorie analysis detail page
│   │   ├── recipe/             # Low-cal recipe recommendations
│   │   └── ai-chat/            # AI nutritionist chat
│   ├── styles/
│   │   ├── theme.wxss          # CSS variable definitions (dual theme)
│   │   └── simple-theme.wxss   # Common component theme styles
│   ├── app.js                  # App entry (theme management core)
│   └── app.wxss                # Global styles
├── cloudfunctions/
│   ├── addRecord               # Add/update weight record
│   ├── deleteRecord            # Delete weight record
│   ├── getRecords              # Get weight record list
│   ├── getGoal                 # Get goal weight
│   ├── setGoal                 # Set goal weight
│   ├── setHeight               # Set user height
│   ├── addDietRecord           # New diet record
│   ├── deleteDietRecord        # Delete diet record
│   ├── getDietRecords          # Get diet records (grouped by date)
│   ├── addToFoodLibrary        # Batch add/update food to cloud library
│   ├── getFoodLibrary          # Get user custom food list
│   ├── searchFoodLibrary       # Fuzzy search cloud food library
│   ├── getUserSettings         # Get user settings
│   ├── saveUserSettings        # Save user settings
│   ├── subscribeReminder       # Manage/cancel reminder subscription
│   ├── sendReminder            # Cron trigger: batch send reminders
│   ├── aiChat                  # AI model call (Claude)
│   ├── customerService         # WeChat CS auto-reply
│   └── getProfile              # Get user profile
└── images/                      # Icons (TabBar etc.)
```

## Data Schema

### Weight Records (`weight_records`)
| Field | Type | Description |
|-------|------|-------------|
| _id | String | Document ID |
| openid | String | User OpenID |
| date | String | Date YYYY-MM-DD |
| weight | Number | Weight (kg) |
| createTime / updateTime | Date | Create/update timestamp |

### Diet Records (`diet_records`)
| Field | Type | Description |
|-------|------|-------------|
| _id | String | Document ID |
| openid | String | User OpenID |
| date | String | Date |
| mealType | String | Meal type: breakfast/lunch/dinner/snack |
| foods | Array | Food list `[{name, calories}]` |
| calories | Number | Total calories for this meal |

### Other Collections
| Collection | Purpose |
|------------|---------|
| `weight_goals` | Goal weight |
| `user_profiles` | User profile (height etc.) |
| `food_library` | Custom food library |
| `user_settings` | User settings (daily calorie target) |
| `user_reminders` | Subscription reminder config |

## Quick Start

### Prerequisites
- Node.js 14.0+
- WeChat Developer Tools
- Active WeCloud environment

### Setup

1. Clone the repo and open in WeChat Developer Tools
2. Create these collections in CloudBase console:
   - `weight_records`, `weight_goals`, `user_profiles`
   - `diet_records`, `food_library`
   - `user_settings`, `user_reminders`
3. Run `npm install` in each cloud function directory
4. Upload & deploy all functions (choose "cloud install dependencies")
5. Verify cloud env config in `app.js`

## Notes

- Max cloud function execution time: 60 seconds
- All data operations verified by OpenID ownership
- AI chat requires external API key configuration (`cloudfunctions/aiChat/index.js`)
- Reminder subscriptions require approved message templates from WeChat platform

## License

MIT License

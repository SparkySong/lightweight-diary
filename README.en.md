# Lightweight Diary

A lightweight diary application based on WeChat Mini Program Cloud Development, supporting cloud storage and management of diet tracking and life logs.

## Features

- 📝 **Diary Entry** - Quickly record daily life moments  
- 🍽️ **Diet Tracking** - Log daily food intake  
- ☁️ **Cloud Storage** - Data securely stored in cloud database  
- 📱 **Mini Program Support** - Seamless integration with WeChat Mini Program  

## Technology Stack

- **Frontend Framework**: WeChat Mini Program  
- **Backend**: WeChat Cloud Development (CloudBase)  
- **Database SDK**: @cloudbase/database  
- **Node.js SDK**: @cloudbase/node-sdk  

## Project Structure

```
├── cloudfunctions/
│   ├── addDietRecord/     # Diet record cloud function
│   │   ├── index.js
│   │   ├── config.json
│   │   └── package.json
│   └── addRecord/         # Diary record cloud function
│       ├── index.js
│       ├── config.json
│       └── package.json
└── .cloudbase/
    └── container/
        └── debug.json
```

## Cloud Functions Description

### addDietRecord
Cloud function for adding user diet data.

### addRecord
Cloud function for adding daily diary entries.

## Quick Start

### 1. Prerequisites

- Node.js 14.0+
- WeChat Developer Tool

### 2. Install Dependencies

Install dependencies in the cloud function directories:

```bash
cd cloudfunctions/addRecord
npm install
```

### 3. Configure Cloud Development Environment

Create a Cloud Development environment in the WeChat Developer Tool, and configure the environment ID in `cloudfunctions/addRecord/config.json`.

### 4. Deploy Cloud Functions

Upload and deploy the cloud functions using the WeChat Developer Tool.

## Data Schema

### Diary Records (records)
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Record ID |
| content | String | Diary content |
| createTime | Date | Creation time |
| tags | Array | Tags |

### Diet Records (diet)
| Field | Type | Description |
|-------|------|-------------|
| _id | ObjectId | Record ID |
| foodName | String | Food name |
| calories | Number | Calories |
| mealType | String | Meal type (breakfast/lunch/dinner) |
| createTime | Date | Creation time |

## Usage Instructions

1. Initialize the Cloud Development environment  
2. Call cloud functions to add records  
3. Query historical records  
4. Perform data analytics  

## Notes

- Ensure the corresponding collections are created in the cloud database  
- Cloud functions have a maximum execution time limit of 60 seconds  
- Protect user privacy data appropriately  

## License

MIT License

## Contribution Guidelines

Issues and Pull Requests are welcome!
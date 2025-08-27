# Vision Lens

一个基于 React + Vite 的智能图像识别应用，集成了 Google Gemini AI 和 Firebase。

## 功能特性

- 📸 实时摄像头拍照
- 🤖 Google Gemini AI 图像识别
- 💾 IndexedDB 本地数据存储
- 📱 响应式设计（支持移动端）
- 📊 历史记录查看

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 API Key

在 `src/App.jsx` 中替换你的 Google Gemini API Key：

```javascript
const API_KEY = "YOUR_GOOGLE_GEMINI_API_KEY";
```

### 3. 运行开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 运行

### 4. 构建生产版本

```bash
npm run build
```

## 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **AI 服务**: Google Gemini 2.5 Flash
- **本地存储**: IndexedDB (使用 idb 库)

## 注意事项

- 需要摄像头权限
- 建议在 HTTPS 环境下使用
- API Key 仅用于开发测试，生产环境请使用安全的方式管理

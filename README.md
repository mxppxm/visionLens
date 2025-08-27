# Vision Lens 📸✨

一个智能的图像识别和问答应用，让你的摄像头变成智能百科全书！

## 🚀 项目简介

Vision Lens 是一个基于 React 的 Web 应用，它能够：

- 通过摄像头实时拍照
- 使用 Google Gemini AI 模型分析图片内容
- 自动生成并回答关于图片的百科问题
- 保存历史记录到本地数据库

只需一次点击，你就能获得关于任何物体、场景或文字的详细解答！

## ✨ 功能特性

### 🎯 核心功能

- **实时摄像头预览** - 支持后置摄像头，适合拍摄各种物体
- **智能图像处理** - 自动压缩和优化图片，提升 AI 识别效果
- **AI 百科问答** - 基于 Google Gemini 2.5 Flash 模型，提供准确的百科知识
- **历史记录** - 本地保存所有拍照和问答记录，支持离线浏览
- **性能监控** - 实时显示图片处理和 AI 响应时间

### 🔧 技术特性

- **渐进式 Web 应用** - 可安装到手机桌面，体验接近原生应用
- **本地数据存储** - 使用 IndexedDB 安全存储用户数据
- **响应式设计** - 适配各种屏幕尺寸
- **优雅的错误处理** - 友好的错误提示和恢复机制

## 🛠️ 技术栈

- **前端框架**: React 18
- **构建工具**: Vite
- **样式框架**: Tailwind CSS
- **数据库**: IndexedDB (通过 idb 库)
- **AI 服务**: Google Gemini API
- **摄像头**: WebRTC getUserMedia API

## 📦 安装和使用

### 环境要求

- Node.js >= 16.0.0
- 现代浏览器（支持 getUserMedia API）
- HTTPS 环境（摄像头权限要求）

### 快速开始

1. **克隆项目**

```bash
git clone https://github.com/your-username/visionLens.git
cd visionLens
```

2. **安装依赖**

```bash
yarn install
# 或
npm install
```

3. **配置 API Key**

   - 访问 [Google AI Studio](https://aistudio.google.com/)
   - 创建新的 API Key
   - 在应用界面中点击"设置 API Key"按钮
   - 输入你的 API Key

4. **启动开发服务器**

```bash
yarn dev
# 或
npm run dev
```

5. **访问应用**
   - 打开浏览器访问 `http://localhost:5173`
   - 允许摄像头权限
   - 开始拍照和提问！

### 生产部署

```bash
# 构建生产版本
yarn build
# 或
npm run build

# 预览生产版本
yarn preview
# 或
npm run preview
```

## 🔑 API Key 配置

### 获取 Google Gemini API Key

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录你的 Google 账户
3. 创建新项目或选择现有项目
4. 生成 API Key
5. 复制 API Key 以备使用

### 在应用中设置

- 首次使用时，点击界面上的"设置 API Key"按钮
- 粘贴你的 API Key
- API Key 将安全保存在本地浏览器中

> ⚠️ **安全提醒**: API Key 仅保存在你的本地浏览器中，不会发送到任何服务器。但请注意保护你的 API Key，避免在公共场所暴露。

## 📱 使用技巧

### 最佳拍照效果

- 确保光线充足
- 将目标物体置于画面中心
- 避免模糊和抖动
- 尽量拍摄清晰的文字或明显的物体

### 支持的问答类型

- **物体识别**: "这是什么？"
- **文字识别**: OCR 文字提取和解释
- **场景描述**: 环境和背景信息
- **知识问答**: 相关的百科知识

## 🗂️ 数据管理

### 历史记录

- 所有拍照记录自动保存到本地
- 包含原图、处理后图片和 AI 回答
- 支持按时间倒序浏览
- 数据仅存储在本地，保护隐私

### 用户标识

- 自动生成唯一用户 ID
- 用于区分不同用户的历史记录
- 重装应用或清除数据后会重新生成

## 🔧 开发指南

### 项目结构

```
visionLens/
├── src/
│   ├── App.jsx          # 主应用组件
│   ├── main.jsx         # 应用入口
│   └── index.css        # 全局样式
├── public/              # 静态资源
├── package.json         # 项目配置
├── tailwind.config.js   # Tailwind 配置
├── vite.config.js       # Vite 配置
└── README.md           # 项目文档
```

### 开发环境

```bash
# 启动开发服务器
yarn dev

# 代码格式化（如果配置了）
yarn format

# 类型检查（如果使用 TypeScript）
yarn type-check
```

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 如何贡献

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 报告问题

如果你发现了 bug 或有功能建议，请[创建 Issue](https://github.com/your-username/visionLens/issues)。

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源协议。

## 🔗 相关链接

- [Google Gemini API 文档](https://ai.google.dev/docs)
- [React 官方文档](https://react.dev/)
- [Vite 官方文档](https://vitejs.dev/)
- [Tailwind CSS 文档](https://tailwindcss.com/)

## 💡 致谢

感谢以下开源项目和服务：

- Google Gemini AI 提供强大的图像识别能力
- React 社区的优秀生态
- Vite 团队的出色构建工具
- 所有为开源社区做出贡献的开发者们

---

**让你的相机变得更智能！** 🚀

如果这个项目对你有帮助，请给它一个 ⭐️

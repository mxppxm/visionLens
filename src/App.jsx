import React, { useState, useEffect, useRef } from "react";
import { openDB } from "idb";

const App = () => {
  // 引用 DOM 元素
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 应用状态
  const [videoStream, setVideoStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [imageProcessingTime, setImageProcessingTime] = useState(null);
  const [totalApiTime, setTotalApiTime] = useState(null);
  const [status, setStatus] = useState("等待您的照片...");
  const [processedImage, setProcessedImage] = useState(null);
  const [history, setHistory] = useState([]);

  // 历史记录分页
  const [displayedHistory, setDisplayedHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 摄像头状态
  const [cameraStatus, setCameraStatus] = useState("initializing"); // initializing, success, failed, retrying
  const [cameraError, setCameraError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isManualRetry, setIsManualRetry] = useState(false);
  const MAX_RETRY_COUNT = 3;

  // 用户状态
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);

  // API Key 相关状态
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  // 大模型选择相关状态
  const [selectedModel, setSelectedModel] = useState("gemini"); // 默认使用gemini
  const [models] = useState([
    {
      id: "gemini",
      name: "Gemini 2.5 Flash",
      description: "Google 的高性能多模态模型",
      apiKeyLabel: "Google Gemini API Key",
      apiKeyPlaceholder: "输入你的 Gemini API Key",
    },
    {
      id: "glm",
      name: "智谱 GLM-4V-Flash",
      description: "智谱AI的多模态大模型",
      apiKeyLabel: "智谱AI API Key",
      apiKeyPlaceholder: "输入你的智谱AI API Key",
    },
  ]);

  // 历史记录模态框状态
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const startTimeRef = useRef(null);
  const imageProcessingStartRef = useRef(null);
  // 添加摄像头初始化状态的 ref，避免竞态条件
  const isInitializingRef = useRef(false);
  const currentRetryRef = useRef(0);

  // === IndexedDB 初始化 ===
  const initDB = async () => {
    try {
      const database = await openDB("VisionLensDB", 1, {
        upgrade(db) {
          // 创建历史记录存储
          if (!db.objectStoreNames.contains("history")) {
            const historyStore = db.createObjectStore("history", {
              keyPath: "id",
              autoIncrement: true,
            });
            historyStore.createIndex("createdAt", "createdAt", {
              unique: false,
            });
            historyStore.createIndex("userId", "userId", { unique: false });
          }
        },
      });
      setDb(database);
      return database;
    } catch (error) {
      console.error("IndexedDB 初始化失败:", error);
      return null;
    }
  };

  // === 初始化用户和数据库 ===
  useEffect(() => {
    const initializeApp = async () => {
      // 生成或获取用户ID
      let storedUserId = localStorage.getItem("visionLens_userId");
      if (!storedUserId) {
        storedUserId = crypto.randomUUID();
        localStorage.setItem("visionLens_userId", storedUserId);
      }
      setUserId(storedUserId);

      // 获取存储的模型选择
      const storedModel = localStorage.getItem("visionLens_selectedModel");
      if (storedModel && models.find((m) => m.id === storedModel)) {
        setSelectedModel(storedModel);
      }

      // 获取存储的 API Key (基于选择的模型)
      const currentModel = storedModel || "gemini";
      const storedApiKey = localStorage.getItem(
        `visionLens_apiKey_${currentModel}`
      );
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }

      // 初始化数据库
      await initDB();
    };

    initializeApp();
  }, []);

  // === API Key 和模型管理 ===
  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      // 保存模型选择
      localStorage.setItem("visionLens_selectedModel", selectedModel);
      // 保存对应模型的 API Key
      localStorage.setItem(
        `visionLens_apiKey_${selectedModel}`,
        apiKeyInput.trim()
      );
      setShowApiKeyModal(false);
      setApiKeyInput("");
    }
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    // 加载对应模型的 API Key
    const storedApiKey = localStorage.getItem(`visionLens_apiKey_${modelId}`);
    setApiKey(storedApiKey || "");
    setApiKeyInput(storedApiKey || "");
  };

  const handleOpenApiKeyModal = () => {
    const currentApiKey =
      localStorage.getItem(`visionLens_apiKey_${selectedModel}`) || "";
    setApiKeyInput(currentApiKey);
    setShowApiKeyModal(true);
  };

  const handleCloseApiKeyModal = () => {
    setShowApiKeyModal(false);
    setApiKeyInput("");
  };

  // === 历史记录模态框管理 ===
  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
  };

  const handleCloseHistoryModal = () => {
    setShowHistoryModal(false);
  };

  // === 加载历史记录 ===
  const loadHistory = async () => {
    if (!db || !userId) return;

    try {
      const tx = db.transaction("history", "readonly");
      const store = tx.objectStore("history");
      const userIndex = store.index("userId");
      const userHistory = await userIndex.getAll(userId);

      // 按创建时间降序排序
      userHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(userHistory);

      // 重置分页并显示第一页
      setHistoryPage(1);
      updateDisplayedHistory(userHistory, 1);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  };

  // === 更新显示的历史记录 ===
  const updateDisplayedHistory = (allHistory, page) => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    const newDisplayed = allHistory.slice(startIndex, endIndex);
    setDisplayedHistory(newDisplayed);
  };

  // === 加载更多历史记录 ===
  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    updateDisplayedHistory(history, nextPage);
  };

  // === 保存记录到 IndexedDB ===
  const saveToHistory = async (imageData, answer) => {
    if (!db || !userId) return;

    try {
      const record = {
        userId,
        processedImage: `data:image/jpeg;base64,${imageData}`,
        answer,
        createdAt: new Date().toISOString(),
      };

      const tx = db.transaction("history", "readwrite");
      const store = tx.objectStore("history");
      await store.add(record);
      await tx.complete;

      // 重新加载历史记录
      await loadHistory();
    } catch (error) {
      console.error("保存历史记录失败:", error);
    }
  };

  // === 监听数据库和用户ID变化，加载历史记录 ===
  useEffect(() => {
    if (db && userId) {
      loadHistory();
    }
  }, [db, userId]);

  // === 环境检测 ===
  const getEnvironmentInfo = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isWeChat = /micromessenger/i.test(userAgent);
    const isMobile =
      /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      );
    const isHTTPS = location.protocol === "https:";
    const isLocalhost =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.hostname === "0.0.0.0";
    const supportsCameraAPI = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );

    // 检测更多环境信息
    const browserInfo = {
      isChrome: /chrome/i.test(userAgent),
      isSafari: /safari/i.test(userAgent) && !/chrome/i.test(userAgent),
      isFirefox: /firefox/i.test(userAgent),
      isEdge: /edge/i.test(userAgent),
    };

    // 详细的环境信息打印（仅在初始化时打印，避免重复）
    if (cameraStatus === "initializing" || !cameraStatus) {
      console.log("🔍 环境检测信息:");
      console.log("- 微信环境:", isWeChat);
      console.log("- 移动端:", isMobile);
      console.log("- HTTPS:", isHTTPS);
      console.log("- 本地环境:", isLocalhost);
      console.log("- 摄像头API支持:", supportsCameraAPI);
      console.log("- navigator.mediaDevices:", !!navigator.mediaDevices);
      console.log("- getUserMedia:", !!navigator.mediaDevices?.getUserMedia);
      console.log("- 浏览器信息:", browserInfo);
      console.log("- 用户代理:", userAgent);
      console.log("- 设备像素比:", window.devicePixelRatio);
      console.log("- 屏幕尺寸:", `${screen.width}x${screen.height}`);
      console.log("- 视窗尺寸:", `${window.innerWidth}x${window.innerHeight}`);
    }

    return {
      isWeChat,
      isMobile,
      isHTTPS,
      isLocalhost,
      supportsCameraAPI,
      canUseCamera: supportsCameraAPI && (isHTTPS || isLocalhost),
      browserInfo,
    };
  };

  // === 摄像头配置策略 ===
  const getCameraConstraints = () => {
    const { isMobile, isWeChat } = getEnvironmentInfo();

    // 简化的配置策略，避免过度复杂化
    const strategies = [
      // 策略1: 后置摄像头（移动端优先）
      ...(isMobile
        ? [
            {
              video: {
                facingMode: "environment",
                width: { ideal: 720 },
                height: { ideal: 480 },
              },
            },
          ]
        : []),
      // 策略2: 标准配置
      {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      },
      // 策略3: 微信兼容配置
      {
        video: true,
      },
    ];

    return strategies;
  };

  // === 摄像头初始化函数 ===
  const setupCamera = async (strategyIndex = 0) => {
    const strategies = getCameraConstraints();

    if (strategyIndex >= strategies.length) {
      console.error("🚫 所有摄像头配置都尝试失败");
      throw new Error("所有摄像头配置都尝试失败");
    }

    const constraint = strategies[strategyIndex];
    console.log(
      `📷 尝试摄像头配置 ${strategyIndex + 1}/${strategies.length}:`,
      constraint
    );

    try {
      console.log("📞 调用 navigator.mediaDevices.getUserMedia...");
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      console.log("✅ getUserMedia 成功，获得 stream:", stream);
      console.log(
        "📺 stream tracks:",
        stream.getTracks().map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
        }))
      );

      // 设置视频流
      setVideoStream(stream);
      if (videoRef.current) {
        console.log("🎬 设置 video.srcObject...");
        videoRef.current.srcObject = stream;

        // 等待视频就绪 - 优化事件处理，避免内存泄漏
        return new Promise((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            reject(new Error("视频元素已被卸载"));
            return;
          }

          let isResolved = false;
          const timeout = setTimeout(() => {
            if (!isResolved) {
              console.error("⏰ 视频加载超时 (8秒)");
              cleanup();
              reject(new Error("视频加载超时"));
            }
          }, 8000);

          const cleanup = () => {
            if (video) {
              video.onloadedmetadata = null;
              video.oncanplay = null;
              video.onloadstart = null;
              video.onerror = null;
            }
            clearTimeout(timeout);
          };

          const handleLoadedMetadata = () => {
            if (!isResolved) {
              isResolved = true;
              console.log("✅ 视频元素 loadedmetadata 事件触发");
              console.log("📐 视频尺寸:", {
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                duration: video.duration,
              });
              cleanup();
              resolve(stream);
            }
          };

          const handleError = (err) => {
            if (!isResolved) {
              isResolved = true;
              console.error("❌ 视频元素错误:", err);
              console.error("❌ 视频元素错误详情:", {
                error: video.error,
                networkState: video.networkState,
                readyState: video.readyState,
              });
              cleanup();
              reject(new Error("视频显示失败"));
            }
          };

          video.onloadedmetadata = handleLoadedMetadata;
          video.onerror = handleError;

          // 如果已经加载完成，直接触发
          if (video.readyState >= 1) {
            handleLoadedMetadata();
          }
        });
      }

      return stream;
    } catch (error) {
      console.error(`❌ 配置 ${strategyIndex + 1} 失败:`, {
        name: error.name,
        message: error.message,
        constraint: constraint,
      });

      // 避免深度递归，改用循环
      if (strategyIndex + 1 < strategies.length) {
        return setupCamera(strategyIndex + 1);
      } else {
        throw new Error("所有摄像头配置都尝试失败");
      }
    }
  };

  // === 检查环境兼容性 ===
  const checkEnvironmentCompatibility = () => {
    const env = getEnvironmentInfo();

    if (!env.supportsCameraAPI) {
      throw new Error("CAMERA_NOT_SUPPORTED");
    }

    if (!env.canUseCamera) {
      throw new Error("HTTPS_REQUIRED");
    }

    if (env.isWeChat) {
      // 微信环境特殊检查
      console.log("检测到微信环境，使用兼容模式");
    }

    return env;
  };

  // === 初始化摄像头主函数 ===
  const initializeCamera = async (isRetry = false) => {
    // 使用 ref 避免竞态条件
    if (isInitializingRef.current) {
      console.log("⚠️ 摄像头正在初始化中，跳过重复调用");
      return;
    }

    isInitializingRef.current = true;

    try {
      // 环境检查
      const env = checkEnvironmentCompatibility();
      console.log("🚀 开始摄像头初始化...", {
        isRetry,
        env,
        currentRetryCount: retryCount,
        timestamp: new Date().toISOString(),
      });

      setCameraStatus(isRetry ? "retrying" : "initializing");
      setCameraError(null);
      setErrorMessage(null);

      const statusText = isRetry
        ? `正在重试初始化摄像头... (${retryCount + 1}/${MAX_RETRY_COUNT})`
        : "正在初始化摄像头...";
      setStatus(statusText);

      // 停止现有流
      if (videoStream) {
        console.log("🛑 停止现有视频流...");
        videoStream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);
      }

      // 清理现有的video元素
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        // 清理可能残留的事件监听器
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onerror = null;
        videoRef.current.oncanplay = null;
        videoRef.current.onloadstart = null;
      }

      const stream = await setupCamera();

      // 检查组件是否已卸载
      if (!isInitializingRef.current) {
        console.log("⚠️ 组件已卸载，停止初始化");
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        return;
      }

      setCameraStatus("success");
      setStatus("已就绪，等待您的照片...");
      setRetryCount(0);
      currentRetryRef.current = 0;
      setIsManualRetry(false);
      console.log("🎉 摄像头初始化成功！");
    } catch (error) {
      console.error("❌ 摄像头初始化失败:", error);

      // 检查组件是否已卸载
      if (!isInitializingRef.current) {
        console.log("⚠️ 组件已卸载，停止错误处理");
        return;
      }

      setCameraStatus("failed");

      const errorMessage = getCameraErrorMessage(error);
      setCameraError(errorMessage);
      setStatus("摄像头初始化失败");

      // 优化的自动重试逻辑 - 使用 ref 避免竞态条件
      if (!isManualRetry && currentRetryRef.current < MAX_RETRY_COUNT) {
        const nextRetryCount = currentRetryRef.current + 1;
        currentRetryRef.current = nextRetryCount;
        console.log(`⏰ 将在2秒后进行第 ${nextRetryCount} 次重试...`);

        setTimeout(() => {
          // 检查组件是否已卸载和状态是否仍然为失败
          if (isInitializingRef.current && cameraStatus === "failed") {
            setRetryCount(nextRetryCount);
            isInitializingRef.current = false; // 重置标志
            initializeCamera(true);
          }
        }, 2000);
      } else {
        console.log("❌ 达到最大重试次数或手动重试，停止自动重试");
        currentRetryRef.current = 0;
      }
    } finally {
      // 只有在成功或最终失败时才重置标志
      if (
        cameraStatus === "success" ||
        currentRetryRef.current >= MAX_RETRY_COUNT ||
        isManualRetry
      ) {
        isInitializingRef.current = false;
      }
    }
  };

  // === 获取错误信息 ===
  const getCameraErrorMessage = (error) => {
    const env = getEnvironmentInfo();

    // HTTPS 要求错误
    if (error.message === "HTTPS_REQUIRED") {
      return {
        title: "需要 HTTPS 连接",
        message: env.isWeChat
          ? "微信环境需要安全连接才能访问摄像头：\n1. 点击右上角 ••• \n2. 选择「在浏览器中打开」\n3. 确保网址以 https:// 开头"
          : "摄像头API需要HTTPS连接或localhost环境才能工作",
        showRetry: false,
      };
    }

    // 不支持摄像头API
    if (error.message === "CAMERA_NOT_SUPPORTED") {
      return {
        title: "浏览器不支持摄像头",
        message: "您的浏览器不支持摄像头API，请更新浏览器或使用其他浏览器",
        showRetry: false,
      };
    }

    // 权限被拒绝
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      return {
        title: "摄像头权限被拒绝",
        message: env.isWeChat
          ? "微信中的摄像头权限被限制：\n\n📱 解决方案：\n1. 点击右上角 「•••」\n2. 选择 「在浏览器中打开」\n3. 在浏览器中允许摄像头权限\n\n💡 微信内置浏览器限制了 getUserMedia API"
          : "请允许访问摄像头权限，然后点击重试",
        showRetry: true,
      };
    }

    // 未找到设备
    if (
      error.name === "NotFoundError" ||
      error.name === "DeviceNotFoundError"
    ) {
      return {
        title: "未找到摄像头设备",
        message: env.isWeChat
          ? "微信环境无法访问摄像头：\n1. 确保设备有摄像头\n2. 在浏览器中打开此页面\n3. 微信可能阻止了摄像头访问"
          : "您的设备可能没有摄像头，或摄像头正在被其他应用使用",
        showRetry: true,
      };
    }

    // 摄像头被占用
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return {
        title: "摄像头被占用",
        message: "摄像头可能正在被其他应用使用，请关闭其他摄像头应用后重试",
        showRetry: true,
      };
    }

    // 配置不支持
    if (
      error.name === "OverconstrainedError" ||
      error.name === "ConstraintNotSatisfiedError"
    ) {
      return {
        title: "摄像头配置不支持",
        message: "您的设备不支持所需的摄像头配置，正在尝试其他配置...",
        showRetry: true,
      };
    }

    // 通用错误
    return {
      title: "摄像头初始化失败",
      message: env.isWeChat
        ? "微信环境摄像头访问受限：\n\n🔧 推荐解决方案：\n1. 点击右上角 「•••」\n2. 选择「在浏览器中打开」\n3. 获得完整的摄像头功能\n\n💡 微信内置浏览器对 getUserMedia API 有严格限制"
        : "请检查摄像头权限设置，或点击重试",
      showRetry: true,
    };
  };

  // === 手动重试摄像头 ===
  const handleRetryCamera = () => {
    console.log("🔄 用户手动重试摄像头...");

    // 停止任何正在进行的初始化
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }

    // 重置状态
    setIsManualRetry(true);
    setRetryCount(0);
    setCameraStatus("initializing");
    setCameraError(null);
    setErrorMessage(null);

    // 延迟一点时间再开始，确保状态已清理
    setTimeout(() => {
      initializeCamera(true);
    }, 100);
  };

  // === 空格键拍照功能 ===
  useEffect(() => {
    const handleKeyPress = (event) => {
      // 检查是否按下空格键
      if (event.code === "Space") {
        // 检查是否在输入框中或者模态框打开状态
        const isInputFocused =
          document.activeElement &&
          (document.activeElement.tagName === "INPUT" ||
            document.activeElement.tagName === "TEXTAREA");

        // 检查模态框是否打开
        const isModalOpen = showHistoryModal || showApiKeyModal;

        // 检查摄像头和加载状态
        const canTakePhoto =
          !isLoading &&
          videoStream &&
          cameraStatus === "success" &&
          !isInputFocused &&
          !isModalOpen;

        if (canTakePhoto) {
          event.preventDefault(); // 防止页面滚动
          handleCaptureAndAnalyze();
        }
      }
    };

    // 添加键盘事件监听器
    document.addEventListener("keydown", handleKeyPress);

    // 清理函数
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [isLoading, videoStream, cameraStatus, showHistoryModal, showApiKeyModal]);

  // === 摄像头和拍照逻辑 ===
  useEffect(() => {
    console.log("🔧 组件挂载，开始初始化摄像头...");
    initializeCamera();

    return () => {
      console.log("🔧 组件即将卸载，清理资源...");

      // 停止初始化标志
      isInitializingRef.current = false;
      currentRetryRef.current = 0;

      if (videoStream) {
        console.log("🛑 清理视频流...");
        videoStream.getTracks().forEach((track) => track.stop());
      }

      // 清理video元素
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onerror = null;
        videoRef.current.oncanplay = null;
        videoRef.current.onloadstart = null;
      }
    };
  }, []);

  // === API 调用函数 ===
  // 调用 Gemini API
  const callGeminiAPI = async (imageData) => {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "请根据图片内容回答百科问题，只返回问题和答案",
            },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageData,
              },
            },
          ],
        },
      ],
    };

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "未能获取答案。";
  };

  // 调用智谱 GLM API
  const callGLMAPI = async (imageData) => {
    // 智谱 GLM API 调用逻辑
    const payload = {
      model: "glm-4.5v",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请根据图片内容回答百科问题，只返回问题和答案。不需要返回选项。从选项中选择正确的答案",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageData}`,
              },
            },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    };

    const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `智谱 GLM API 调用失败! Status: ${response.status}, Error: ${errorText}`
      );
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "未能获取答案。";
  };

  // 根据选择的模型调用对应的 API
  const callAIAPI = async (imageData) => {
    switch (selectedModel) {
      case "gemini":
        return await callGeminiAPI(imageData);
      case "glm":
        return await callGLMAPI(imageData);
      default:
        throw new Error("未知的模型类型");
    }
  };

  // === AI回复解析和高亮函数 ===
  const parseAndHighlightAnswer = (text, isCompact = false) => {
    if (!text) return null;

    // 尝试匹配不同的问答格式
    const patterns = [
      /^(.+?[问题：问：Q:\s]*)(.+?)[\s]*([答案：答：A:\s]*)(.+)$/is,
      /^(.+?)[\s]*答案[：:\s]*(.+)$/is,
      /^(.+?)[\s]*回答[：:\s]*(.+)$/is,
      /^(.+?)[\s]*解答[：:\s]*(.+)$/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const question = match[1]?.trim();
        const answer = match[match.length - 1]?.trim();

        if (question && answer && question !== answer) {
          if (isCompact) {
            // 紧凑模式：用于历史记录，只显示答案部分
            return (
              <div className="bg-green-100 px-2 py-1 rounded text-xs">
                <span className="font-medium text-green-800">答案: </span>
                <span className="text-gray-700">{answer}</span>
              </div>
            );
          } else {
            // 完整模式：用于主界面
            return (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">问题</p>
                  <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                    {question}
                  </p>
                </div>
                <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    答案
                  </p>
                  <p className="text-gray-700 leading-relaxed font-medium text-base sm:text-lg">
                    {answer}
                  </p>
                </div>
              </div>
            );
          }
        }
      }
    }

    // 如果没有匹配到特定格式，查找关键词并高亮可能的答案部分
    const keywordPatterns = [
      /(答案|答|回答|解答)[：:\s]*([^。！？\n]+[。！？]?)/gi,
      /(这是|这个是|它是)[：:\s]*([^。！？\n]+[。！？]?)/gi,
    ];

    let highlightedText = text;
    let hasHighlight = false;

    for (const pattern of keywordPatterns) {
      highlightedText = highlightedText.replace(
        pattern,
        (match, keyword, content) => {
          hasHighlight = true;
          if (isCompact) {
            return `${keyword}<span style="background-color: #fef08a; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${content}</span>`;
          } else {
            return `${keyword}<span class="bg-yellow-200 px-1 rounded font-medium">${content}</span>`;
          }
        }
      );
    }

    if (hasHighlight) {
      const className = isCompact
        ? "text-gray-700 leading-relaxed break-all text-xs"
        : "text-gray-700 leading-relaxed break-all text-base sm:text-lg";

      return (
        <div
          className={className}
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
      );
    }

    // 默认显示原文
    const className = isCompact
      ? "text-gray-700 leading-relaxed break-all text-xs"
      : "text-gray-700 leading-relaxed break-all text-base sm:text-lg";

    return <p className={className}>{text}</p>;
  };

  // 图片预处理函数：包括灰度转换、尺寸和质量压缩
  const preprocessAndCompressImage = (video) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 设置最大宽度，按比例压缩
    const maxWidth = 800;
    const ratio = maxWidth / video.videoWidth;
    canvas.width = maxWidth;
    canvas.height = video.videoHeight * ratio;

    // 绘制图片
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 转换为灰度图
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
    }
    ctx.putImageData(imageData, 0, 0);

    // 以较低的JPEG质量（0.7）压缩并返回base64数据
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  };

  // 拍照并直接发送给 AI
  const handleCaptureAndAnalyze = async () => {
    if (!videoRef.current || cameraStatus !== "success") {
      setErrorMessage("摄像头未就绪，请稍后重试。");
      return;
    }

    if (!apiKey) {
      const currentModel = models.find((m) => m.id === selectedModel);
      setErrorMessage(
        `请先设置你的 ${currentModel?.name || "所选模型"} API Key。`
      );
      setShowApiKeyModal(true);
      return;
    }

    setIsLoading(true);
    setAnswer(null);
    setImageProcessingTime(null);
    setTotalApiTime(null);
    setErrorMessage(null);
    setProcessedImage(null);

    const video = videoRef.current;

    imageProcessingStartRef.current = performance.now();
    const imageData = preprocessAndCompressImage(video);
    const imageProcessingEnd = performance.now();
    setImageProcessingTime(
      ((imageProcessingEnd - imageProcessingStartRef.current) / 1000).toFixed(2)
    );

    setProcessedImage(`data:image/jpeg;base64,${imageData}`);

    startTimeRef.current = performance.now();

    try {
      const currentModel = models.find((m) => m.id === selectedModel);
      setStatus(`正在向 ${currentModel?.name || "所选模型"} 提交照片...`);

      const responseText = await callAIAPI(imageData);
      setAnswer(responseText);

      const apiEnd = performance.now();
      setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));
      setStatus("完成！");

      // === 将记录保存到 IndexedDB ===
      await saveToHistory(imageData, responseText);
    } catch (error) {
      console.error("API call failed:", error);
      setErrorMessage("哎呀，出了点问题，请重试。");
      setStatus("出错了。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-2 sm:p-4 font-sans overflow-x-hidden w-full max-w-full">
      <div className="w-full mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 overflow-x-hidden max-w-full sm:max-w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex-shrink truncate">
            Vision Lens
          </h1>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* 历史记录按钮 */}
            <button
              onClick={handleOpenHistoryModal}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 min-h-[44px] flex-shrink-0"
              title="查看历史记录"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">
                历史
              </span>
            </button>

            {/* 设置按钮 */}
            <button
              onClick={handleOpenApiKeyModal}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 min-h-[44px] flex-shrink-0"
              title="设置 API Key"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-xs sm:text-sm text-gray-600 hidden sm:inline">
                设置
              </span>
            </button>
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden mb-4 sm:mb-6 border-2 sm:border-4 border-gray-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
            style={{ display: cameraStatus === "success" ? "block" : "none" }}
          ></video>
          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* 摄像头状态覆盖层 */}
          {cameraStatus !== "success" && (
            <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center p-4">
              {/* 加载状态 */}
              {(cameraStatus === "initializing" ||
                cameraStatus === "retrying") && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-600 font-medium">
                    {cameraStatus === "retrying"
                      ? `正在重试 (${retryCount}/${MAX_RETRY_COUNT})...`
                      : "正在初始化摄像头..."}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    首次使用需要允许摄像头权限
                  </p>
                </div>
              )}

              {/* 失败状态 */}
              {cameraStatus === "failed" && cameraError && (
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {cameraError.title}
                  </h3>

                  <p className="text-gray-600 text-sm mb-4 whitespace-pre-line leading-relaxed">
                    {cameraError.message}
                  </p>

                  {/* 重试按钮 */}
                  {cameraError.showRetry && (
                    <button
                      onClick={handleRetryCamera}
                      disabled={cameraStatus === "retrying"}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                    >
                      {cameraStatus === "retrying" ? "重试中..." : "🔄 重试"}
                    </button>
                  )}

                  {retryCount >= MAX_RETRY_COUNT && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        💡 如果问题持续，建议：
                        <br />
                        {getEnvironmentInfo().isWeChat ? (
                          <>
                            1. 点击右上角 「•••」→「在浏览器中打开」
                            <br />
                            2. 在浏览器中重新访问此页面
                            <br />
                            3. 允许浏览器访问摄像头权限
                          </>
                        ) : (
                          <>
                            1. 刷新页面重试
                            <br />
                            2. 检查浏览器摄像头权限设置
                            <br />
                            3. 确保使用HTTPS连接
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 摄像头状态指示器 */}
          {cameraStatus === "success" && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
              <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
              摄像头已就绪
            </div>
          )}

          {/* 环境提示 */}
          {cameraStatus === "success" && (
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              {getEnvironmentInfo().isWeChat && (
                <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium">
                  微信环境
                </div>
              )}
              {!getEnvironmentInfo().isHTTPS &&
                !getEnvironmentInfo().isLocalhost && (
                  <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                    非HTTPS
                  </div>
                )}
            </div>
          )}
        </div>

        <button
          onClick={handleCaptureAndAnalyze}
          disabled={isLoading || !videoStream || cameraStatus !== "success"}
          className={`w-full px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base sm:text-lg text-white rounded-full transition-all duration-300 min-h-[48px] ${
            isLoading || cameraStatus !== "success"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
          }`}
        >
          {isLoading
            ? "正在分析..."
            : cameraStatus !== "success"
            ? "等待摄像头就绪..."
            : "拍照并获取答案"}
        </button>
        <div className="text-center mt-2">
          <p className="text-sm text-gray-500">{status}</p>
          {cameraStatus === "success" && !isLoading && (
            <p className="text-xs text-gray-400 mt-1">
              💡 提示：点击按钮或按下
              <span className="bg-gray-200 px-1 rounded font-mono">空格键</span>
              来拍照
            </p>
          )}
        </div>

        {!apiKey && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              📝 请先点击右上角"设置"按钮配置你的{" "}
              {models.find((m) => m.id === selectedModel)?.name || "所选模型"}{" "}
              API Key
            </p>
          </div>
        )}

        {/* 环境信息显示（调试用） */}
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <details className="text-xs text-gray-600">
            <summary className="cursor-pointer font-medium">
              🔧 环境信息 (调试面板)
            </summary>
            <div className="mt-2 space-y-1">
              <p>
                🌐 环境: {getEnvironmentInfo().isWeChat ? "微信" : "浏览器"}
              </p>
              <p>
                📱 设备: {getEnvironmentInfo().isMobile ? "移动端" : "桌面端"}
              </p>
              <p>
                🔒 协议: {getEnvironmentInfo().isHTTPS ? "HTTPS" : "HTTP"}{" "}
                {getEnvironmentInfo().isLocalhost && "(本地)"}
              </p>
              <p>
                📷 摄像头API:{" "}
                {getEnvironmentInfo().supportsCameraAPI
                  ? "✅ 支持"
                  : "❌ 不支持"}
              </p>
              <p>
                🎥 可用性:{" "}
                {getEnvironmentInfo().canUseCamera ? "✅ 可用" : "❌ 不可用"}
              </p>
              <p>📊 摄像头状态: {cameraStatus}</p>
              <p>
                🔄 重试次数: {retryCount}/{MAX_RETRY_COUNT}
              </p>
              <p>📺 视频流: {videoStream ? "已获取" : "未获取"}</p>
              <p>🔧 vConsole: 已启用 (检查右下角绿色按钮)</p>
              <p>🏷️ 用户代理: {navigator.userAgent}</p>
            </div>
          </details>
        </div>

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 rounded-lg shadow-inner">
          <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-3">
            AI 答案
          </h2>
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 inline-block"></div>
            </div>
          )}
          {errorMessage && (
            <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
          )}
          {!isLoading && !errorMessage && (
            <>
              {imageProcessingTime && (
                <p className="text-gray-500 text-sm mb-1">
                  图片处理耗时:{" "}
                  <span className="font-semibold text-blue-600">
                    {imageProcessingTime}
                  </span>{" "}
                  秒
                </p>
              )}
              {totalApiTime && (
                <p className="text-gray-500 text-sm mb-2">
                  AI总响应耗时 (包含网络):{" "}
                  <span className="font-semibold text-blue-600">
                    {totalApiTime}
                  </span>{" "}
                  秒
                </p>
              )}
              <div className="overflow-hidden">
                {answer ? (
                  parseAndHighlightAnswer(answer)
                ) : (
                  <p className="text-gray-500 italic">等待您的照片...</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 历史记录模态框 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-x-hidden">
          <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-h-[80vh] overflow-hidden flex flex-col mx-auto max-w-full sm:max-w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                历史记录 📸
              </h2>
              <button
                onClick={handleCloseHistoryModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {userId && (
              <p className="text-xs sm:text-sm text-center text-gray-500 mb-4 break-all overflow-hidden">
                您的用户ID：
                <span className="font-mono text-xs block sm:inline break-all overflow-hidden">
                  {userId}
                </span>
              </p>
            )}

            {history.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-center text-gray-500 italic">
                  暂无历史记录。
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <div className="space-y-3">
                  {displayedHistory.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* 缩略图 */}
                      <div className="flex-shrink-0">
                        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gray-200">
                          <img
                            src={item.processedImage}
                            alt={`History Image ${index}`}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => {
                              // 创建模态框显示大图
                              const modal = document.createElement("div");
                              modal.className =
                                "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]";
                              modal.innerHTML = `
                                <div class="relative max-w-3xl max-h-full">
                                  <img src="${item.processedImage}" class="max-w-full max-h-full rounded-lg" />
                                  <button class="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition-colors">
                                    ×
                                  </button>
                                </div>
                              `;
                              modal.addEventListener("click", (e) => {
                                if (
                                  e.target === modal ||
                                  e.target.tagName === "BUTTON"
                                ) {
                                  document.body.removeChild(modal);
                                }
                              });
                              document.body.appendChild(modal);
                            }}
                          />
                        </div>
                      </div>

                      {/* 内容区域 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-1">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString("zh-CN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "处理中..."}
                        </p>
                        <div className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                          <p className="font-semibold text-gray-700 mb-1">
                            AI 答案:
                          </p>
                          <div className="line-clamp-3 overflow-hidden break-all">
                            {item.answer ? (
                              parseAndHighlightAnswer(item.answer, true)
                            ) : (
                              <p className="text-gray-500 italic text-xs">
                                无答案
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 加载更多按钮 */}
                  {displayedHistory.length < history.length && (
                    <div className="pt-4 text-center">
                      <button
                        onClick={loadMoreHistory}
                        className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200 min-h-[44px]"
                      >
                        加载更多 ({history.length - displayedHistory.length}{" "}
                        条记录)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Key 设置模态框 */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-x-hidden">
          <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-h-screen overflow-y-auto overflow-x-hidden mx-auto max-w-full sm:max-w-full md:max-w-lg lg:max-w-xl xl:max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">设置 API Key</h2>
              <button
                onClick={handleCloseApiKeyModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              {/* 模型选择区域 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择大模型
                </label>
                <div className="space-y-2">
                  {models.map((model) => (
                    <label
                      key={model.id}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedModel === model.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={model.id}
                        checked={selectedModel === model.id}
                        onChange={(e) => handleModelChange(e.target.value)}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">
                          {model.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {model.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* API Key 配置区域 */}
              <div>
                {selectedModel === "gemini" && (
                  <p className="text-sm text-gray-600 mb-3">
                    请输入你的 Google Gemini API Key。如果你还没有 API
                    Key，请访问{" "}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Google AI Studio
                    </a>{" "}
                    免费获取。
                  </p>
                )}

                {selectedModel === "glm" && (
                  <p className="text-sm text-gray-600 mb-3">
                    请输入你的智谱AI API Key。如果你还没有 API Key，请访问{" "}
                    <a
                      href="https://bigmodel.cn/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      智谱AI开放平台
                    </a>{" "}
                    获取。
                  </p>
                )}

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {models.find((m) => m.id === selectedModel)?.apiKeyLabel ||
                    "API Key"}
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    models.find((m) => m.id === selectedModel)
                      ?.apiKeyPlaceholder || "输入你的 API Key"
                  }
                  className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overflow-hidden"
                  autoFocus
                />

                <p className="text-xs text-gray-500 mt-2">
                  🔒 你的 API Key 仅保存在本地浏览器中，不会发送到任何服务器。
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCloseApiKeyModal}
                className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                  apiKeyInput.trim()
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                保存
              </button>
            </div>

            {!apiKey && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ 首次使用需要设置{" "}
                  {models.find((m) => m.id === selectedModel)?.name ||
                    "所选模型"}{" "}
                  API Key 才能开始使用智能识别功能。
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

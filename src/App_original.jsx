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
  const [status, setStatus] = useState("等待拍摄题目...");
  const [processedImage, setProcessedImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [countdown, setCountdown] = useState(null);

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
      description: "Google 的高性能题目解答模型",
      apiKeyLabel: "Google Gemini API Key",
      apiKeyPlaceholder: "输入你的 Gemini API Key",
    },
    {
      id: "glm_4v",
      name: "智谱 GLM-4V-Plus (快速版)",
      description: "智谱AI题目解答模型，响应速度快，适合日常练习",
      apiKeyLabel: "智谱AI API Key",
      apiKeyPlaceholder: "输入你的智谱AI API Key",
    },
    {
      id: "glm_flashx",
      name: "智谱 GLM-4.1V-FlashX (推理版)",
      description: "智谱AI深度推理模型，准确度高，适合难题解答",
      apiKeyLabel: "智谱AI API Key",
      apiKeyPlaceholder: "输入你的智谱AI API Key",
    },
  ]);

  // 历史记录模态框状态
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // 当前记录ID（用于更新验证结果）
  const [currentRecordId, setCurrentRecordId] = useState(null);

  // 并发分析结果状态
  const [concurrentResults, setConcurrentResults] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState([]);
  const [consistencyResult, setConsistencyResult] = useState(null);

  // 并发分析配置
  const [concurrentCount, setConcurrentCount] = useState(3); // 默认3次并发

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

      // 智谱相关模型共享API Key
      let keyModelId = currentModel;
      if (currentModel === "glm_flashx" || currentModel === "glm_4v") {
        keyModelId = "glm"; // 智谱模型共享API Key
      }

      const storedApiKey = localStorage.getItem(
        `visionLens_apiKey_${keyModelId}`
      );
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }

      // 获取存储的并发数配置
      const storedConcurrentCount = localStorage.getItem(
        "visionLens_concurrentCount"
      );
      if (storedConcurrentCount) {
        const count = parseInt(storedConcurrentCount, 10);
        if (count >= 1 && count <= 5) {
          // 限制在1-5次之间
          setConcurrentCount(count);
        }
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

      // 智谱相关模型共享API Key
      let keyModelId = selectedModel;
      if (selectedModel === "glm_flashx" || selectedModel === "glm_4v") {
        keyModelId = "glm"; // 智谱模型共享API Key
      }

      // 保存对应模型的 API Key
      localStorage.setItem(
        `visionLens_apiKey_${keyModelId}`,
        apiKeyInput.trim()
      );

      setShowApiKeyModal(false);
      setApiKeyInput("");
    }
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);

    // 智谱相关模型共享API Key
    let keyModelId = modelId;
    if (modelId === "glm_flashx" || modelId === "glm_4v") {
      keyModelId = "glm"; // 智谱模型共享API Key
    }

    // 加载对应模型的 API Key
    const storedApiKey = localStorage.getItem(
      `visionLens_apiKey_${keyModelId}`
    );
    setApiKey(storedApiKey || "");
    setApiKeyInput(storedApiKey || "");
  };

  const handleOpenApiKeyModal = () => {
    // 智谱相关模型共享API Key
    let keyModelId = selectedModel;
    if (selectedModel === "glm_flashx" || selectedModel === "glm_4v") {
      keyModelId = "glm"; // 智谱模型共享API Key
    }

    const currentApiKey =
      localStorage.getItem(`visionLens_apiKey_${keyModelId}`) || "";
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
      // 确保answer数据格式正确保存
      let answerToSave = answer;
      if (typeof answer === "object" && answer.question && answer.answer) {
        // 保持JSON格式用于后续解析
        answerToSave = answer;
      }

      const record = {
        userId,
        processedImage: `data:image/jpeg;base64,${imageData}`,
        answer: answerToSave,
        createdAt: new Date().toISOString(),
      };

      const tx = db.transaction("history", "readwrite");
      const store = tx.objectStore("history");
      const result = await store.add(record);
      await tx.complete;

      // 重新加载历史记录
      await loadHistory();

      // 返回新记录的ID，用于后续更新
      return result;
    } catch (error) {
      console.error("保存历史记录失败:", error);
      return null;
    }
  };

  // === 更新历史记录 ===
  const updateHistoryRecord = async (recordId, updatedAnswer) => {
    if (!db || !userId || !recordId) return;

    try {
      const tx = db.transaction("history", "readwrite");
      const store = tx.objectStore("history");

      // 获取现有记录
      const existingRecord = await store.get(recordId);
      if (!existingRecord) {
        console.warn("未找到要更新的历史记录:", recordId);
        return;
      }

      // 更新答案字段
      existingRecord.answer = updatedAnswer;
      existingRecord.updatedAt = new Date().toISOString();

      // 保存更新后的记录
      await store.put(existingRecord);
      await tx.complete;

      // 重新加载历史记录
      await loadHistory();
    } catch (error) {
      console.error("更新历史记录失败:", error);
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
      const stream = await navigator.mediaDevices.getUserMedia(constraint);

      // 设置视频流
      setVideoStream(stream);
      if (videoRef.current) {
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
    }

    return env;
  };

  // === 初始化摄像头主函数 ===
  const initializeCamera = async (isRetry = false) => {
    // 使用 ref 避免竞态条件
    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;

    try {
      // 环境检查
      const env = checkEnvironmentCompatibility();

      setCameraStatus(isRetry ? "retrying" : "initializing");
      setCameraError(null);
      setErrorMessage(null);

      const statusText = isRetry
        ? `正在重试初始化摄像头... (${retryCount + 1}/${MAX_RETRY_COUNT})`
        : "正在初始化摄像头...";
      setStatus(statusText);

      // 停止现有流
      if (videoStream) {
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
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        return;
      }

      setCameraStatus("success");
      setStatus("已就绪，等待拍摄题目...");
      setRetryCount(0);
      currentRetryRef.current = 0;
      setIsManualRetry(false);
    } catch (error) {
      console.error("❌ 摄像头初始化失败:", error);

      // 检查组件是否已卸载
      if (!isInitializingRef.current) {
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

        setTimeout(() => {
          // 简化检查逻辑，只检查组件是否已卸载
          if (isInitializingRef.current) {
            setRetryCount(nextRetryCount);
            isInitializingRef.current = false; // 重置标志
            initializeCamera(true);
          }
        }, 2000);
      } else {
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
    initializeCamera();

    return () => {
      // 停止初始化标志
      isInitializingRef.current = false;
      currentRetryRef.current = 0;

      if (videoStream) {
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

  // === 学术题目分析Prompt ===
  const AI_ANALYSIS_PROMPT = `你是一位学术题目解答专家，专门解答各类学科题目。请直接分析图片中的题目并给出准确答案，不要输出任何思考过程或观察标记。

重要：禁止输出以下内容：
- 任何尖括号标记（如 observation、thinking、reflection 等）
- 思考过程、观察过程、分析步骤
- 代码块标记
- 任何非JSON内容

专注识别以下题目类型：

🔹 填空题处理（核心重点）：
- 精准识别空格、下划线、括号等填空标记：____、___、__、(  )、（）
- 根据上下文和学科知识确定填空内容
- 答案必须简短精确：单词、术语、数字、概念
- 绝不给出解释，只给出要填入的精确内容

🔹 选择题处理：
- 识别题干和选项A、B、C、D等
- 分析各选项，给出正确答案
- 格式：选项字母+内容

🔹 计算题处理：
- 数学、物理、化学计算题
- 给出最终数值答案
- 包含单位（如适用）

🔹 问答题处理：
- 语文、历史、地理、生物等学科问答
- 简洁准确回答要点
- 避免冗长解释

🔹 文字识别：
- 古诗词、文言文、外语等文字内容
- 准确识别并回答相关问题

输出要求：
只能输出标准JSON格式，不要任何额外内容：
{"question": "问题内容", "answer": "答案内容"}

示例：
填空题："水的化学分子式是____" 输出 {"question": "水的化学分子式是什么？", "answer": "H₂O"}
选择题："1+1=? A.1 B.2 C.3" 输出 {"question": "1+1等于多少？", "answer": "B.2"}
计算题："3×4=" 输出 {"question": "3×4等于多少？", "answer": "12"}
语文题："《静夜思》的作者是谁？" 输出 {"question": "《静夜思》的作者是谁？", "answer": "李白"}

记住：
- 专注学术题目，忽略非题目内容
- 填空题答案要极其精确简洁
- 数学题给出数值答案
- 文科题给出关键要点
- 只输出JSON格式，答案准确有效`;

  // === API 调用函数 ===
  // 调用 Gemini API
  const callGeminiAPI = async (imageData) => {
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: AI_ANALYSIS_PROMPT,
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

  // 统一处理智谱API响应的函数
  const parseGLMResponse = (data, modelName) => {
    const content = data.choices?.[0]?.message?.content || "未能获取答案。";

    // 尝试解析JSON格式响应
    try {
      // 清理可能的标记符和多余内容
      let cleanContent = content
        // 移除智谱模型的观察标记
        .replace(/<\|observation\|>/g, "")
        .replace(/<\|thinking\|>/g, "")
        .replace(/<\|\/thinking\|>/g, "")
        .replace(/<\|reflection\|>/g, "")
        .replace(/<\|\/reflection\|>/g, "")
        // 移除各种box标记符
        .replace(/<\|begin_of_box\|>/g, "")
        .replace(/<\|end_of_box\|>/g, "")
        .replace(/<\|box_start\|>/g, "")
        .replace(/<\|box_end\|>/g, "")
        // 移除代码块标记
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        // 移除可能的开始/结束标记
        .replace(/^.*?begin.*?\n?/i, "")
        .replace(/\n?.*?end.*?$/i, "")
        // 提取JSON部分 - 查找第一个 { 到最后一个 }
        .replace(/^[^{]*/, "")
        .replace(/[^}]*$/, "")
        .trim();

      // 修复JSON中的引号问题
      cleanContent = cleanContent
        // 将中文双引号替换为英文双引号
        .replace(/"/g, '"')
        .replace(/"/g, '"');

      // 尝试修复JSON字符串中的引号嵌套问题
      try {
        // 如果直接解析失败，尝试提取和重构JSON
        JSON.parse(cleanContent);
      } catch (e) {
        // 尝试用正则提取question和answer的值
        const questionMatch = cleanContent.match(
          /"question"\s*:\s*"(.*?)(?=",\s*"answer")/s
        );
        const answerMatch = cleanContent.match(
          /"answer"\s*:\s*"(.*?)(?="\s*})/s
        );

        if (questionMatch && answerMatch) {
          let question = questionMatch[1];
          let answer = answerMatch[1];

          // 清理question和answer中的多余引号
          question = question
            .replace(/^[""]/, "")
            .replace(/[""]$/, "")
            .replace(/\\"/g, '"');
          answer = answer
            .replace(/^[""]/, "")
            .replace(/[""]$/, "")
            .replace(/\\"/g, '"');

          // 重新构造正确的JSON
          cleanContent = JSON.stringify({
            question: question,
            answer: answer,
          });
        }
      }

      // 如果还没找到有效的JSON格式，尝试用正则提取
      if (!cleanContent.startsWith("{") || !cleanContent.endsWith("}")) {
        // 更强大的JSON提取正则，能处理嵌套和复杂情况
        const jsonMatches = [
          // 标准JSON格式
          /\{[^{}]*?"question"[^{}]*?"answer"[^{}]*?\}/s,
          // 带换行的JSON格式
          /\{[\s\S]*?"question"[\s\S]*?"answer"[\s\S]*?\}/,
          // 最宽松的匹配
          /\{.*?"question".*?"answer".*?\}/s,
        ];

        for (const regex of jsonMatches) {
          const match = content.match(regex);
          if (match) {
            cleanContent = match[0];
            break;
          }
        }
      }

      const jsonResponse = JSON.parse(cleanContent);
      if (jsonResponse.question && jsonResponse.answer) {
        return jsonResponse;
      }
    } catch (error) {
      // 如果解析失败，检查是否只有标记符
      console.warn("JSON解析失败，原始内容:", content);
    }

    // 如果内容只是观察标记或空白，返回错误信息
    const strippedContent = content.replace(/<\|[^|]*\|>/g, "").trim();
    if (!strippedContent || strippedContent.length < 10) {
      return {
        question: "模型响应异常",
        answer: "模型只返回了观察标记，请尝试重新拍照或切换其他模型",
      };
    }

    return content;
  };

  // 调用智谱 GLM-4V API (快速版)
  const callGLM4VAPI = async (imageData) => {
    const payload = {
      model: "glm-4v-plus", // GLM-4V-Plus 多模态版本
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: AI_ANALYSIS_PROMPT,
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
      temperature: 0.4,
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
        `智谱 GLM-4V-Plus API 调用失败 (model: glm-4v-plus)! Status: ${response.status}, Error: ${errorText}`
      );
    }

    const data = await response.json();
    return parseGLMResponse(data, "GLM-4V");
  };

  // 调用智谱 GLM-4.1V-FlashX API (推理版)
  const callGLMFlashXAPI = async (imageData) => {
    const payload = {
      model: "glm-4.1v-thinking-flashx", // 推理版本
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: AI_ANALYSIS_PROMPT,
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
      temperature: 0.4,
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
        `智谱 GLM-4.1V-FlashX API 调用失败 (model: glm-4.1v-thinking-flashx)! Status: ${response.status}, Error: ${errorText}`
      );
    }

    const data = await response.json();
    return parseGLMResponse(data, "GLM-4.1V-FlashX");
  };

  // 创建超时Promise
  const createTimeoutPromise = (timeout = 10000) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("API调用超时，请求已取消"));
      }, timeout);
    });
  };

  // 并发分析同一张图片 - 实时显示结果
  const performConcurrentAnalysis = async (imageData) => {
    // 根据配置初始化进度状态
    const initialProgress = Array.from(
      { length: concurrentCount },
      (_, index) => ({
        id: index + 1,
        status: "starting",
        progress: 0,
        result: null,
        error: null,
        timeSpent: null,
      })
    );
    setAnalysisProgress(initialProgress);
    setConcurrentResults([]);
    setConsistencyResult(null);

    // 用于跟踪已完成的结果
    const completedResults = [];
    let completedCount = 0;

    // 创建指定数量的独立分析任务 - 不等待全部完成
    const analysisPromises = Array.from(
      { length: concurrentCount },
      async (_, index) => {
        const id = index + 1;
        const startTime = performance.now();

        try {
          // 更新状态为进行中
          setAnalysisProgress((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "analyzing", progress: 50 }
                : item
            )
          );

          const result = await callAIAPI(imageData);
          const endTime = performance.now();
          const timeSpent = ((endTime - startTime) / 1000).toFixed(2);

          const taskResult = { id, result, timeSpent, error: null };

          // 立即更新进度状态
          setAnalysisProgress((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "completed",
                    progress: 100,
                    result: result,
                    timeSpent: timeSpent,
                  }
                : item
            )
          );

          // 立即更新并发结果 - 不等待其他任务
          completedResults.push(taskResult);
          completedCount++;

          setConcurrentResults([...completedResults]);

          // 实时更新一致性分析
          const currentConsistency = analyzeConsistency([...completedResults]);
          setConsistencyResult(currentConsistency);

          // 实时更新UI答案显示
          setAnswer({
            type: "concurrent_analysis",
            results: [...completedResults],
            consistency: currentConsistency,
            analysisProgress: analysisProgress,
          });

          // 更新状态显示
          setStatus(
            `🎯 已完成 ${completedCount}/${concurrentCount} 次解答验证`
          );

          return taskResult;
        } catch (error) {
          const endTime = performance.now();
          const timeSpent = ((endTime - startTime) / 1000).toFixed(2);

          const taskResult = {
            id,
            result: null,
            timeSpent,
            error: error.message,
          };

          // 立即更新进度状态为错误
          setAnalysisProgress((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "error",
                    progress: 100,
                    error: error.message,
                    timeSpent: timeSpent,
                  }
                : item
            )
          );

          // 即使失败也要立即更新结果
          completedResults.push(taskResult);
          completedCount++;

          setConcurrentResults([...completedResults]);

          // 实时更新一致性分析（包含错误）
          const currentConsistency = analyzeConsistency([...completedResults]);
          setConsistencyResult(currentConsistency);

          // 实时更新UI答案显示（包含失败结果）
          setAnswer({
            type: "concurrent_analysis",
            results: [...completedResults],
            consistency: currentConsistency,
            analysisProgress: analysisProgress,
          });

          // 更新状态显示
          setStatus(
            `🎯 已完成 ${completedCount}/${concurrentCount} 次解答验证 (含失败)`
          );

          return taskResult;
        }
      }
    );

    // 等待所有分析完成（用于最终处理，但不阻塞UI更新）
    try {
      const allResults = await Promise.all(analysisPromises);

      // 最终更新状态
      const finalConsistency = analyzeConsistency(allResults);
      setConsistencyResult(finalConsistency);
      setStatus(`🎯 并发分析完成！一致性：${finalConsistency.message}`);

      return { results: allResults, consistency: finalConsistency };
    } catch (error) {
      // 如果有未捕获的错误，也要保证返回当前结果
      const finalConsistency = analyzeConsistency(completedResults);
      setConsistencyResult(finalConsistency);
      setStatus(`🎯 分析完成（部分失败）！一致性：${finalConsistency.message}`);

      return { results: completedResults, consistency: finalConsistency };
    }
  };

  // 分析结果的一致性（支持实时部分结果）
  const analyzeConsistency = (results) => {
    const validResults = results.filter((r) => r.result && !r.error);
    const totalCount = results.length;
    const successCount = validResults.length;
    const failedCount = totalCount - successCount;

    // 如果还没有任何结果
    if (totalCount === 0) {
      return {
        type: "waiting",
        color: "gray",
        message: "等待分析结果...",
        matches: [],
        totalCount,
        successCount,
        failedCount,
      };
    }

    // 如果所有已完成的都失败了
    if (validResults.length === 0) {
      return {
        type: "all_failed",
        color: "red",
        message:
          totalCount < concurrentCount
            ? `${failedCount}/${totalCount} 分析失败`
            : `${concurrentCount}次分析都失败了`,
        matches: [],
        totalCount,
        successCount,
        failedCount,
      };
    }

    // 如果只有一次成功（且总数可能还在增长）
    if (validResults.length === 1) {
      return {
        type: "only_one_success",
        color: totalCount < concurrentCount ? "yellow" : "red",
        message:
          totalCount < concurrentCount
            ? `1/${totalCount} 分析成功，其他进行中...`
            : "只有一次分析成功",
        matches: [],
        totalCount,
        successCount,
        failedCount,
      };
    }

    // 提取答案进行比较
    const answers = validResults.map((r) => {
      if (typeof r.result === "object" && r.result.answer) {
        return r.result.answer.toLowerCase().trim();
      } else if (typeof r.result === "string") {
        // 尝试从字符串中提取答案
        const answerMatch = r.result.match(/答案[：:\s]*([^。！？\n]+)/i);
        if (answerMatch) {
          return answerMatch[1].toLowerCase().trim();
        }
        return r.result.toLowerCase().trim();
      }
      return "";
    });

    // 计算相似度和匹配
    const matches = [];
    for (let i = 0; i < answers.length; i++) {
      for (let j = i + 1; j < answers.length; j++) {
        const similarity = calculateSimilarity(answers[i], answers[j]);
        if (similarity > 0.8) {
          // 80%相似度认为匹配
          matches.push({
            ids: [validResults[i].id, validResults[j].id],
            similarity: similarity,
            answer: answers[i],
          });
        }
      }
    }

    // 分析一致性类型（支持实时部分结果）
    if (validResults.length === concurrentCount) {
      // 全部都成功
      if (matches.length >= 2) {
        // 检查是否三个都匹配
        const allMatch =
          matches.some((m) => m.similarity > 0.9) &&
          answers.every((a) => calculateSimilarity(a, answers[0]) > 0.8);
        if (allMatch) {
          return {
            type: "all_consistent",
            color: "green",
            message: `${concurrentCount}次结果完全一致`,
            matches: matches,
            validResults: validResults,
            totalCount,
            successCount,
            failedCount,
          };
        } else {
          return {
            type: "two_consistent",
            color: "yellow",
            message: "两次结果一致",
            matches: matches,
            validResults: validResults,
            totalCount,
            successCount,
            failedCount,
          };
        }
      } else {
        return {
          type: "all_different",
          color: "red",
          message: `${concurrentCount}次结果都不一致`,
          matches: matches,
          validResults: validResults,
          totalCount,
          successCount,
          failedCount,
        };
      }
    } else if (validResults.length === 2) {
      // 两次成功
      if (matches.length > 0) {
        return {
          type: "two_consistent",
          color: totalCount < concurrentCount ? "green" : "yellow", // 如果还在进行中，暂时显示绿色
          message:
            totalCount < concurrentCount
              ? `两次结果一致，等待其他${concurrentCount - totalCount}次...`
              : "两次成功且结果一致",
          matches: matches,
          validResults: validResults,
          totalCount,
          successCount,
          failedCount,
        };
      } else {
        return {
          type: "two_different",
          color: "red",
          message:
            totalCount < concurrentCount
              ? `两次结果不一致，等待其他${concurrentCount - totalCount}次...`
              : "两次成功但结果不一致",
          matches: matches,
          validResults: validResults,
          totalCount,
          successCount,
          failedCount,
        };
      }
    }

    return {
      type: "uncertain",
      color: "gray",
      message:
        totalCount < concurrentCount ? "分析进行中..." : "无法确定一致性",
      matches: matches,
      validResults: validResults,
      totalCount,
      successCount,
      failedCount,
    };
  };

  // 计算两个字符串的相似度
  const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;

    // 简单的相似度计算：基于编辑距离
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
  };

  // 计算编辑距离
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  // 根据选择的模型调用对应的 API，带超时机制
  const callAIAPI = async (imageData) => {
    const apiCall = async () => {
      switch (selectedModel) {
        case "gemini":
          return await callGeminiAPI(imageData);
        case "glm_4v":
          return await callGLM4VAPI(imageData);
        case "glm_flashx":
          return await callGLMFlashXAPI(imageData);
        default:
          throw new Error(`未知的模型类型: ${selectedModel}`);
      }
    };

    // 使用Promise.race实现10秒超时机制
    try {
      const result = await Promise.race([
        apiCall(),
        createTimeoutPromise(10000),
      ]);

      return result;
    } catch (error) {
      if (error.message.includes("超时")) {
        throw new Error("请求超时：AI服务响应时间过长，请稍后重试");
      }
      throw error;
    }
  };

  // === AI回复解析和高亮函数 ===
  const parseAndHighlightAnswer = (responseData, isCompact = false) => {
    if (!responseData) return null;

    // 处理并发分析结果
    if (
      typeof responseData === "object" &&
      responseData.type === "concurrent_analysis"
    ) {
      const { results, consistency } = responseData;

      // 获取一致性对应的颜色类名
      const getConsistencyColorClass = (color) => {
        switch (color) {
          case "green":
            return {
              bg: "bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600",
              border: "border-green-300",
              text: "text-white",
              badge: "bg-green-100 text-green-800 border-green-300",
            };
          case "yellow":
            return {
              bg: "bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600",
              border: "border-yellow-300",
              text: "text-white",
              badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
            };
          case "red":
            return {
              bg: "bg-gradient-to-br from-red-400 via-pink-500 to-rose-600",
              border: "border-red-300",
              text: "text-white",
              badge: "bg-red-100 text-red-800 border-red-300",
            };
          case "gray":
            return {
              bg: "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600",
              border: "border-blue-300",
              text: "text-white",
              badge: "bg-blue-100 text-blue-800 border-blue-300",
            };
          default:
            return {
              bg: "bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600",
              border: "border-gray-300",
              text: "text-white",
              badge: "bg-gray-100 text-gray-800 border-gray-300",
            };
        }
      };

      const colorClass = getConsistencyColorClass(consistency.color);

      if (isCompact) {
        // 紧凑模式：用于历史记录
        return (
          <div className={`px-3 py-2 rounded-lg border-2 ${colorClass.badge}`}>
            <div className="text-xs font-bold mb-2 flex items-center">
              <span className="mr-1">🚀</span>
              并发分析 ({consistency.message})
            </div>
            <div className="space-y-1">
              {results.slice(0, 2).map((result) => (
                <div
                  key={result.id}
                  className="bg-white bg-opacity-50 px-2 py-1 rounded text-xs"
                >
                  <div className="font-medium flex items-center justify-between">
                    <span>分析 #{result.id}</span>
                    {result.timeSpent && (
                      <span className="text-gray-600">
                        ⏱️{result.timeSpent}s
                      </span>
                    )}
                  </div>
                  {result.error ? (
                    <div className="text-red-600 text-xs">
                      ❌ {result.error}
                    </div>
                  ) : (
                    <div className="text-gray-700 text-xs">
                      {/* 紧凑模式下也完整显示答案 */}
                      <div className="font-medium text-green-800 mb-1">
                        答案:
                      </div>
                      <div className="font-semibold text-gray-900">
                        {result.result?.answer ||
                          (typeof result.result === "string"
                            ? result.result
                            : "无结果")}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {results.length > 2 && (
                <div className="text-xs text-gray-600 text-center">
                  ... 还有 {results.length - 2} 个结果
                </div>
              )}
            </div>
          </div>
        );
      } else {
        // 完整模式：用于主界面
        return (
          <div className="space-y-6">
            {/* 一致性总结卡片 */}
            <div
              className={`relative p-6 rounded-2xl border-3 shadow-2xl ${colorClass.bg} ${colorClass.border}`}
            >
              <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl"></div>
              <div className="relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                  <h2
                    className={`text-2xl lg:text-3xl font-bold ${colorClass.text} flex items-center mb-2 lg:mb-0`}
                  >
                    <span className="mr-3 text-3xl">
                      {consistency.color === "green"
                        ? "✅"
                        : consistency.color === "yellow"
                        ? "⚠️"
                        : consistency.color === "gray"
                        ? "🔄"
                        : "❌"}
                    </span>
                    并发分析结果
                  </h2>
                  <div
                    className={`px-4 py-2 ${colorClass.badge} rounded-full font-bold text-lg border-2`}
                  >
                    {consistency.message}
                  </div>
                </div>

                <div className="bg-white bg-opacity-95 p-6 rounded-xl">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      🎯 一致性分析
                    </h3>
                    <p className="text-gray-700 leading-relaxed">
                      {consistency.type === "all_consistent" &&
                        `${concurrentCount}次分析结果完全一致，可信度极高！`}
                      {consistency.type === "two_consistent" &&
                        (consistency.totalCount < concurrentCount
                          ? `已有两次分析结果一致，等待其他${
                              concurrentCount - consistency.totalCount
                            }次确认...`
                          : "有两次分析结果一致，可信度较高。")}
                      {consistency.type === "all_different" &&
                        `${concurrentCount}次分析结果都不相同，建议重新分析。`}
                      {consistency.type === "all_failed" &&
                        (consistency.totalCount < concurrentCount
                          ? `已有${consistency.failedCount}次分析失败，其他任务进行中...`
                          : `${concurrentCount}次分析都失败了，请检查网络或API设置。`)}
                      {consistency.type === "only_one_success" &&
                        (consistency.totalCount < concurrentCount
                          ? "已有一次分析成功，其他任务进行中..."
                          : "只有一次分析成功，建议重新尝试。")}
                      {consistency.type === "two_different" &&
                        (consistency.totalCount < concurrentCount
                          ? `两次分析结果不一致，等待其他${
                              concurrentCount - consistency.totalCount
                            }次判断...`
                          : "两次成功但结果不一致，可能存在不确定性。")}
                      {consistency.type === "waiting" &&
                        "正在启动题目解答，请稍候..."}
                      {consistency.type === "uncertain" &&
                        (consistency.totalCount < concurrentCount
                          ? "分析进行中，请等待更多结果..."
                          : "无法确定一致性，建议重新分析。")}
                    </p>
                  </div>

                  {/* 如果有匹配的结果，显示最佳答案 */}
                  {consistency.matches && consistency.matches.length > 0 && (
                    <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                      <h4 className="font-bold text-green-800 mb-2">
                        🏆 最可能的答案
                      </h4>
                      <div className="text-xl font-bold text-green-900">
                        {consistency.matches[0].answer}
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        匹配度:{" "}
                        {(consistency.matches[0].similarity * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 详细结果展示 */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                📊 详细分析结果 ({results.length}/{concurrentCount})
              </h3>
              {results.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="animate-pulse text-gray-500">
                    <div className="text-4xl mb-2">🚀</div>
                    <div className="text-lg font-medium">题目解答启动中...</div>
                    <div className="text-sm">
                      {concurrentCount}次验证同时进行，结果会立即显示
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`grid gap-4 ${
                    results.length === 1
                      ? "grid-cols-1 max-w-md mx-auto"
                      : results.length === 2
                      ? "grid-cols-1 lg:grid-cols-2"
                      : "grid-cols-1 lg:grid-cols-3"
                  }`}
                >
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="border rounded-lg p-4 bg-white shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-2">
                            {result.id}
                          </span>
                          <span className="font-medium">分析 #{result.id}</span>
                        </div>
                        {result.timeSpent && (
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            ⏱️ {result.timeSpent}s
                          </span>
                        )}
                      </div>

                      {result.error ? (
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <div className="text-red-800 font-medium flex items-center mb-1">
                            <span className="mr-1">❌</span>
                            分析失败
                          </div>
                          <div className="text-red-600 text-sm">
                            {result.error}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded p-3">
                          <div className="text-gray-800 font-medium flex items-center mb-2">
                            <span className="mr-1">✅</span>
                            分析结果
                          </div>
                          <div className="text-gray-700 text-sm leading-relaxed">
                            {/* 完整显示每个结果的内容 */}
                            {result.result?.question && (
                              <div className="mb-2">
                                <div className="font-medium text-blue-800 text-xs mb-1">
                                  问题:
                                </div>
                                <div className="text-gray-700 text-xs">
                                  {result.result.question}
                                </div>
                              </div>
                            )}
                            <div className="font-medium text-green-800 text-xs mb-1">
                              答案:
                            </div>
                            <div className="text-gray-900 font-semibold">
                              {result.result?.answer ||
                                (typeof result.result === "string"
                                  ? result.result
                                  : "无具体结果")}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 显示未完成任务的占位符 */}
                  {results.length < concurrentCount &&
                    Array.from(
                      { length: concurrentCount - results.length },
                      (_, index) => {
                        const placeholderId = results.length + index + 1;
                        return (
                          <div
                            key={`placeholder-${placeholderId}`}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center">
                                <span className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-bold mr-2">
                                  {placeholderId}
                                </span>
                                <span className="font-medium text-gray-500">
                                  分析 #{placeholderId}
                                </span>
                              </div>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                            </div>

                            <div className="bg-gray-100 border border-gray-200 rounded p-3">
                              <div className="text-gray-500 font-medium flex items-center mb-2">
                                <span className="mr-1">⏳</span>
                                分析中...
                              </div>
                              <div className="text-gray-400 text-sm">
                                正在等待AI响应，结果会立即显示在这里
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                </div>
              )}
            </div>

            {/* 实时进度显示（如果还在进行中） */}
            {analysisProgress &&
              analysisProgress.some((p) => p.status === "analyzing") && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-bold text-blue-800 mb-3">🔄 分析进度</h4>
                  <div className="space-y-2">
                    {analysisProgress.map((progress) => (
                      <div key={progress.id} className="flex items-center">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                          {progress.id}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-blue-900">
                              分析 #{progress.id} -{" "}
                              {progress.status === "analyzing"
                                ? "分析中..."
                                : "等待中"}
                            </span>
                            <span className="text-sm text-blue-700">
                              {progress.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        );
      }
    }

    // 处理错误记录
    if (
      typeof responseData === "object" &&
      responseData.type &&
      responseData.type.includes("error")
    ) {
      const { type, error, message, timestamp, model } = responseData;

      if (isCompact) {
        // 紧凑模式：用于历史记录
        return (
          <div className="bg-gradient-to-r from-red-100 to-orange-100 px-3 py-2 rounded-lg border-2 border-red-300">
            <div className="text-xs font-bold text-red-900 mb-1 flex items-center">
              <span className="mr-1">❌</span>
              {error}
            </div>
            <div className="text-xs text-red-700">{message}</div>
            <div className="text-xs text-red-600 mt-1 flex justify-between">
              <span>模型: {model}</span>
              <span>{new Date(timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        );
      } else {
        // 完整模式：用于主界面
        return (
          <div className="relative p-6 rounded-2xl border-3 shadow-2xl bg-gradient-to-br from-red-400 via-orange-500 to-red-600 border-red-300">
            <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl"></div>
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                <h2 className="text-2xl lg:text-3xl font-bold text-white flex items-center mb-2 lg:mb-0">
                  <span className="mr-3 text-3xl">❌</span>
                  {error}
                </h2>
                <div className="px-4 py-2 bg-white bg-opacity-90 text-gray-800 rounded-full font-bold">
                  模型: {model}
                </div>
              </div>
              <div className="bg-white bg-opacity-95 p-6 rounded-xl">
                <p className="text-gray-800 leading-relaxed text-lg">
                  {message}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  时间: {new Date(timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      }
    }

    // 如果是JSON对象格式的响应，直接处理
    if (
      typeof responseData === "object" &&
      responseData.question &&
      responseData.answer
    ) {
      const { question, answer } = responseData;

      // 检测是否为填空题
      const isFillInBlank =
        question.includes("填") ||
        question.includes("空") ||
        question.includes("____") ||
        question.includes("___") ||
        question.includes("__") ||
        question.includes("(  )") ||
        question.includes("（  ）") ||
        /填.*?空|空.*?填|什么|哪.*?个|是.*?\?/.test(question);

      if (isCompact) {
        // 紧凑模式：用于历史记录
        return (
          <div
            className={`px-3 py-2 rounded-lg border ${
              isFillInBlank
                ? "bg-gradient-to-r from-orange-100 to-red-100 border-orange-200"
                : "bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-200"
            }`}
          >
            <div
              className={`font-medium text-xs mb-1 ${
                isFillInBlank ? "text-orange-800" : "text-emerald-800"
              }`}
            >
              {isFillInBlank ? "📝 填空题: " : "Q: "}
              {question}
            </div>
            <div
              className={`text-white px-2 py-1 rounded font-bold text-sm ${
                isFillInBlank
                  ? "bg-gradient-to-r from-orange-500 to-red-500"
                  : "bg-gradient-to-r from-emerald-500 to-green-500"
              }`}
            >
              {answer}
            </div>
          </div>
        );
      } else {
        // 完整模式：用于主界面
        return (
          <div className="space-y-4">
            <div
              className={`p-4 border-l-4 rounded-r-lg shadow-sm ${
                isFillInBlank
                  ? "bg-gradient-to-r from-orange-50 to-red-50 border-orange-500"
                  : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500"
              }`}
            >
              <p
                className={`text-sm font-semibold mb-2 flex items-center ${
                  isFillInBlank ? "text-orange-800" : "text-blue-800"
                }`}
              >
                {isFillInBlank ? (
                  <>
                    <span className="mr-2">📝</span>
                    填空题
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    问题
                  </>
                )}
              </p>
              <p className="text-gray-700 leading-relaxed text-base">
                {question}
              </p>
            </div>

            {/* 醒目的答案显示区域 - 填空题使用特殊样式 */}
            <div
              className={`relative p-6 rounded-xl shadow-xl border-2 ${
                isFillInBlank
                  ? "bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 border-orange-300"
                  : "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 border-emerald-300"
              }`}
            >
              {/* 装饰性背景图案 */}
              <div className="absolute inset-0 bg-white bg-opacity-10 rounded-xl"></div>
              <div className="absolute top-2 right-2 opacity-20">
                {isFillInBlank ? (
                  <span className="text-4xl text-white">📝</span>
                ) : (
                  <svg
                    className="w-8 h-8 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
              </div>

              <div className="relative z-10">
                <p className="text-sm font-bold text-white mb-3 flex items-center">
                  {isFillInBlank ? (
                    <>
                      <span className="mr-2">📝</span>
                      填空答案
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      答案
                    </>
                  )}
                </p>
                <div className="bg-white bg-opacity-95 p-4 rounded-lg shadow-inner">
                  <p
                    className={`text-gray-800 leading-relaxed font-bold text-center ${
                      isFillInBlank
                        ? "text-2xl sm:text-3xl lg:text-4xl border-2 border-dashed border-orange-300 py-4 bg-orange-50"
                        : "text-xl sm:text-2xl lg:text-3xl"
                    }`}
                  >
                    {answer}
                  </p>
                  {isFillInBlank && (
                    <p className="text-xs text-orange-600 text-center mt-2">
                      🎯 填空题答案
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }
    }

    // 如果是字符串格式，尝试解析
    const text =
      typeof responseData === "string" ? responseData : String(responseData);

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

  // 拍照并进行三次并发分析
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
    setCurrentRecordId(null); // 重置记录ID

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
      setStatus(
        `🚀 正在解答题目 (${concurrentCount}次验证, ${
          currentModel?.name || "所选模型"
        })...`
      );

      // 启动倒计时 - 根据并发数动态调整超时时间
      const timeoutSeconds = Math.max(8, concurrentCount * 3); // 最少8秒，每个并发任务加3秒
      setCountdown(timeoutSeconds);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // 立即设置初始答案状态，然后让performConcurrentAnalysis实时更新
      setAnswer({
        type: "concurrent_analysis",
        results: [],
        consistency: {
          type: "waiting",
          color: "gray",
          message: "等待分析结果...",
          matches: [],
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
        },
        analysisProgress: analysisProgress,
      });

      const concurrentData = await performConcurrentAnalysis(imageData);

      // 清理倒计时
      clearInterval(countdownInterval);
      setCountdown(null);

      const apiEnd = performance.now();
      setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));

      setStatus(
        `🎯 并发分析完成！一致性：${concurrentData.consistency.message}`
      );

      // === 将记录保存到 IndexedDB ===
      const recordId = await saveToHistory(imageData, {
        type: "concurrent_analysis",
        results: concurrentData.results,
        consistency: concurrentData.consistency,
      });
      if (recordId) {
        setCurrentRecordId(recordId);
      }
    } catch (error) {
      console.error("Concurrent analysis failed:", error);

      // 清理倒计时（确保在任何错误情况下都清理）
      setCountdown(null);

      // 根据错误类型显示不同的错误信息
      let errorResponse = null;
      if (error.message.includes("超时")) {
        setErrorMessage(
          "⏰ " + error.message + "\n系统已自动重置，可以立即进行下一次拍照。"
        );
        setStatus("并发分析超时，请重试");

        // 超时时重置处理时间显示
        const timeoutEnd = performance.now();
        setTotalApiTime(
          ((timeoutEnd - startTimeRef.current) / 1000).toFixed(2) + " (超时)"
        );

        // 为超时情况创建错误记录对象
        errorResponse = {
          type: "concurrent_timeout_error",
          error: "并发分析超时",
          message: error.message,
          timestamp: new Date().toISOString(),
          model: selectedModel,
        };
      } else if (error.message.includes("API Key")) {
        setErrorMessage("🔑 API Key 错误：" + error.message);
        setStatus("API Key 问题");

        errorResponse = {
          type: "api_key_error",
          error: "API Key 错误",
          message: error.message,
          timestamp: new Date().toISOString(),
          model: selectedModel,
        };
      } else if (error.message.includes("网络")) {
        setErrorMessage("🌐 网络连接问题：" + error.message);
        setStatus("网络错误");

        errorResponse = {
          type: "network_error",
          error: "网络错误",
          message: error.message,
          timestamp: new Date().toISOString(),
          model: selectedModel,
        };
      } else {
        setErrorMessage("❌ " + (error.message || "未知错误，请重试"));
        setStatus("并发分析出错了");

        errorResponse = {
          type: "concurrent_unknown_error",
          error: "并发分析未知错误",
          message: error.message || "未知错误",
          timestamp: new Date().toISOString(),
          model: selectedModel,
        };
      }

      // 保存错误记录到历史（如果有可用的图片数据）
      if (errorResponse && imageData) {
        try {
          await saveToHistory(imageData, errorResponse);
        } catch (saveError) {
          console.error("保存错误记录失败:", saveError);
        }
      }
    } finally {
      // 确保loading状态和倒计时总是被重置，防止界面卡死
      setIsLoading(false);
      setCountdown(null);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-2 sm:p-4 font-sans overflow-x-hidden w-full max-w-full">
      <div className="w-full mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 overflow-x-hidden max-w-full sm:max-w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex-shrink truncate">
            📚 题目解答助手
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
            ? `正在解答题目 (${concurrentCount}次验证)...`
            : cameraStatus !== "success"
            ? "等待摄像头就绪..."
            : `📸 拍照解题 (${concurrentCount}次验证)`}
        </button>
        <div className="text-center mt-2">
          <p className="text-sm text-gray-500">
            {status}
            {countdown !== null && (
              <span className="ml-2 inline-flex items-center">
                <span className="animate-pulse text-orange-600 font-bold">
                  ⏰ {countdown}秒
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  (超时自动取消)
                </span>
              </span>
            )}
          </p>
          {countdown !== null && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-orange-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${((8 - countdown) / 8) * 100}%`,
                }}
              ></div>
            </div>
          )}
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

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 rounded-lg shadow-inner">
          <h2 className="text-lg sm:text-xl font-bold text-gray-700 mb-3">
            📝 题目解答
          </h2>
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 inline-block"></div>
            </div>
          )}
          {errorMessage && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 mb-1">
                {typeof errorMessage === "object" ? errorMessage.title : "错误"}
              </h4>
              <p className="text-red-600 text-sm">
                {typeof errorMessage === "object"
                  ? errorMessage.message
                  : errorMessage}
              </p>
            </div>
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
                  <p className="text-gray-500 italic">等待拍摄题目...</p>
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

              {/* 并发分析配置 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  并发分析次数
                </label>
                <select
                  value={concurrentCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    setConcurrentCount(count);
                    localStorage.setItem(
                      "visionLens_concurrentCount",
                      count.toString()
                    );
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={1}>1次 (单次分析，速度最快)</option>
                  <option value={2}>2次 (双重验证)</option>
                  <option value={3}>3次 (三重验证，推荐)</option>
                  <option value={4}>4次 (高可靠性)</option>
                  <option value={5}>5次 (极高可靠性，速度较慢)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  💡 更多并发次数可以提高答案准确性，但会增加耗时和API调用费用
                </p>
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

                {(selectedModel === "glm_4v" ||
                  selectedModel === "glm_flashx") && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <h4 className="font-medium text-blue-900 mb-2">
                      智谱AI模型说明：
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>
                        • <strong>GLM-4V-Plus (快速版)</strong>
                        ：响应速度快，适合日常练习和简单题目
                      </li>
                      <li>
                        • <strong>GLM-4.1V-FlashX (推理版)</strong>
                        ：深度推理，准确度更高，适合复杂题目和难题
                      </li>
                      <li>• 两个模型共享同一个API Key</li>
                    </ul>
                    <p className="text-sm text-blue-700 mt-2">
                      如果你还没有 API Key，请访问{" "}
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
                  </div>
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

import React, { useState, useEffect, useRef } from "react";

// 组件导入
import CameraManager from "./components/CameraManager.jsx";
import CameraDisplay from "./components/CameraDisplay.jsx";
import ApiKeyModal from "./components/ApiKeyModal.jsx";
import HistoryModal from "./components/HistoryModal.jsx";
import AnswerDisplay from "./components/AnswerDisplay.jsx";

// 工具函数导入
import {
  initDB,
  saveToHistory,
  loadHistory,
  getUserId,
  getSavedModel,
  getSavedApiKey,
  saveApiKey,
  saveSelectedModel,
  getSavedConcurrentCount,
  saveConcurrentCount,
} from "./utils/database.js";
import { preprocessAndCompressImage } from "./utils/imageProcessing.js";
import { performConcurrentAnalysis } from "./utils/concurrentAnalysis.js";

// 配置导入
import { AI_MODELS, getModelStorageKey } from "./config/models.js";

/**
 * 重构后的主应用组件
 * 使用组合模式整合各个子组件，提高代码的可维护性和可重用性
 */
const App = () => {
  // === 核心状态管理 ===
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [videoStream, setVideoStream] = useState(null);

  // === AI分析相关状态 ===
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [concurrentCount, setConcurrentCount] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [status, setStatus] = useState("等待拍摄题目...");
  const [countdown, setCountdown] = useState(null);

  // === 性能监控状态 ===
  const [imageProcessingTime, setImageProcessingTime] = useState(null);
  const [totalApiTime, setTotalApiTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // === 历史记录状态 ===
  const [history, setHistory] = useState([]);
  const [displayedHistory, setDisplayedHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [currentRecordId, setCurrentRecordId] = useState(null);

  // === 并发分析状态 ===
  const [analysisProgress, setAnalysisProgress] = useState([]);

  // === 模态框状态 ===
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // === Refs ===
  const startTimeRef = useRef(null);
  const imageProcessingStartRef = useRef(null);

  // === 常量 ===
  const ITEMS_PER_PAGE = 10;

  // === 摄像头管理 ===
  const {
    videoRef,
    cameraStatus,
    cameraError,
    retryCount,
    handleRetryCamera,
    getEnvironmentInfo,
    MAX_RETRY_COUNT,
  } = CameraManager({
    onStreamReady: setVideoStream,
    onError: setErrorMessage,
    onStatusChange: setStatus,
  });

  // === 初始化应用 ===
  useEffect(() => {
    const initializeApp = async () => {
      // 初始化用户ID
      const storedUserId = getUserId();
      setUserId(storedUserId);

      // 初始化模型选择
      const storedModel = getSavedModel(AI_MODELS);
      setSelectedModel(storedModel);

      // 初始化API Key
      const storedApiKey = getSavedApiKey(storedModel);
      setApiKey(storedApiKey);

      // 初始化并发数配置
      const storedConcurrentCount = getSavedConcurrentCount();
      setConcurrentCount(storedConcurrentCount);

      // 初始化数据库
      const database = await initDB();
      setDb(database);
    };

    initializeApp();
  }, []);

  // === 加载历史记录 ===
  useEffect(() => {
    if (db && userId) {
      loadHistoryData();
    }
  }, [db, userId]);

  const loadHistoryData = async () => {
    const userHistory = await loadHistory(db, userId);
    setHistory(userHistory);
    setHistoryPage(1);
    updateDisplayedHistory(userHistory, 1);
  };

  const updateDisplayedHistory = (allHistory, page) => {
    const startIndex = 0;
    const endIndex = page * ITEMS_PER_PAGE;
    const newDisplayed = allHistory.slice(startIndex, endIndex);
    setDisplayedHistory(newDisplayed);
  };

  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    updateDisplayedHistory(history, nextPage);
  };

  // === API Key管理 ===
  const handleSaveApiKey = (newApiKey) => {
    setApiKey(newApiKey);
    saveSelectedModel(selectedModel);
    saveApiKey(selectedModel, newApiKey);
    setShowApiKeyModal(false);
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    const storedApiKey = getSavedApiKey(modelId);
    setApiKey(storedApiKey);
  };

  const handleConcurrentCountChange = (count) => {
    setConcurrentCount(count);
    saveConcurrentCount(count);
  };

  // === 空格键拍照功能 ===
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === "Space") {
        const isInputFocused =
          document.activeElement &&
          (document.activeElement.tagName === "INPUT" ||
            document.activeElement.tagName === "TEXTAREA");

        const isModalOpen = showHistoryModal || showApiKeyModal;
        const canTakePhoto =
          !isLoading &&
          videoStream &&
          cameraStatus === "success" &&
          !isInputFocused &&
          !isModalOpen;

        if (canTakePhoto) {
          event.preventDefault();
          handleCaptureAndAnalyze();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isLoading, videoStream, cameraStatus, showHistoryModal, showApiKeyModal]);

  // === 主要拍照分析功能 ===
  const handleCaptureAndAnalyze = async () => {
    if (!videoRef.current || cameraStatus !== "success") {
      setErrorMessage("摄像头未就绪，请稍后重试。");
      return;
    }

    if (!apiKey) {
      const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
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
    setCurrentRecordId(null);

    const video = videoRef.current;

    // 图像处理
    imageProcessingStartRef.current = performance.now();
    const imageData = preprocessAndCompressImage(video);
    const imageProcessingEnd = performance.now();
    setImageProcessingTime(
      ((imageProcessingEnd - imageProcessingStartRef.current) / 1000).toFixed(2)
    );
    setProcessedImage(`data:image/jpeg;base64,${imageData}`);

    startTimeRef.current = performance.now();

    try {
      const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
      setStatus(
        `🚀 正在解答题目 (${concurrentCount}次验证, ${
          currentModel?.name || "所选模型"
        })...`
      );

      // 启动倒计时
      const timeoutSeconds = Math.max(8, concurrentCount * 3);
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

      // 设置初始答案状态
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
      });

      const concurrentData = await performConcurrentAnalysis(
        imageData,
        selectedModel,
        apiKey,
        concurrentCount,
        setAnalysisProgress,
        setAnswer
      );

      // 清理倒计时
      clearInterval(countdownInterval);
      setCountdown(null);

      const apiEnd = performance.now();
      setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));

      setStatus(
        `🎯 并发分析完成！一致性：${concurrentData.consistency.message}`
      );

      // 保存到历史记录
      const recordId = await saveToHistory(db, userId, imageData, {
        type: "concurrent_analysis",
        results: concurrentData.results,
        consistency: concurrentData.consistency,
      });

      if (recordId) {
        setCurrentRecordId(recordId);
        await loadHistoryData(); // 重新加载历史记录
      }
    } catch (error) {
      console.error("Concurrent analysis failed:", error);
      setCountdown(null);

      let errorResponse = null;
      if (error.message.includes("超时")) {
        setErrorMessage(
          "⏰ " + error.message + "\n系统已自动重置，可以立即进行下一次拍照。"
        );
        setStatus("并发分析超时，请重试");

        const timeoutEnd = performance.now();
        setTotalApiTime(
          ((timeoutEnd - startTimeRef.current) / 1000).toFixed(2) + " (超时)"
        );

        errorResponse = {
          type: "concurrent_timeout_error",
          error: "并发分析超时",
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

      // 保存错误记录
      if (errorResponse && imageData) {
        try {
          await saveToHistory(db, userId, imageData, errorResponse);
          await loadHistoryData();
        } catch (saveError) {
          console.error("保存错误记录失败:", saveError);
        }
      }
    } finally {
      setIsLoading(false);
      setCountdown(null);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-2 sm:p-4 font-sans overflow-x-hidden w-full max-w-full">
      <div className="w-full mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 overflow-x-hidden max-w-full sm:max-w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex-shrink truncate">
            📚 题目解答助手
          </h1>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button
              onClick={() => setShowHistoryModal(true)}
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
            <button
              onClick={() => setShowApiKeyModal(true)}
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

        {/* 摄像头显示 */}
        <CameraDisplay
          videoRef={videoRef}
          cameraStatus={cameraStatus}
          cameraError={cameraError}
          retryCount={retryCount}
          maxRetryCount={MAX_RETRY_COUNT}
          onRetry={handleRetryCamera}
          getEnvironmentInfo={getEnvironmentInfo}
        />

        {/* 拍照按钮和状态 */}
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

        {/* 状态和倒计时 */}
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
                style={{ width: `${((8 - countdown) / 8) * 100}%` }}
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

        {/* API Key提示 */}
        {!apiKey && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              📝 请先点击右上角"设置"按钮配置你的{" "}
              {AI_MODELS.find((m) => m.id === selectedModel)?.name ||
                "所选模型"}{" "}
              API Key
            </p>
          </div>
        )}

        {/* 答案显示区域 */}
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
                  <AnswerDisplay responseData={answer} />
                ) : (
                  <p className="text-gray-500 italic">等待拍摄题目...</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 历史记录模态框 */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        displayedHistory={displayedHistory}
        history={history}
        onLoadMore={loadMoreHistory}
        parseAndHighlightAnswer={(data, compact) => (
          <AnswerDisplay responseData={data} isCompact={compact} />
        )}
        userId={userId}
      />

      {/* API Key设置模态框 */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSave={handleSaveApiKey}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        models={AI_MODELS}
        apiKey={apiKey}
        concurrentCount={concurrentCount}
        onConcurrentCountChange={handleConcurrentCountChange}
      />
    </div>
  );
};

export default App;

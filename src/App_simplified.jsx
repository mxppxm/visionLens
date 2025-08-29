import React, { useState, useEffect, useRef } from "react";
import CameraManager from "./components/CameraManager.jsx";
import CameraDisplay from "./components/CameraDisplay.jsx";
import ApiKeyModal from "./components/ApiKeyModal.jsx";
import HistoryModal from "./components/HistoryModal.jsx";
import AnswerDisplay from "./components/AnswerDisplay.jsx";
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
import { AI_MODELS } from "./config/models.js";

/**
 * 简化的主应用组件
 * 保持核心功能的同时控制在300行以内
 */
const App = () => {
  // === 核心状态 ===
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [selectedModel, setSelectedModel] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [concurrentCount, setConcurrentCount] = useState(3);

  // === 分析状态 ===
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [status, setStatus] = useState("等待拍摄题目...");
  const [countdown, setCountdown] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [imageProcessingTime, setImageProcessingTime] = useState(null);
  const [totalApiTime, setTotalApiTime] = useState(null);

  // === 历史记录状态 ===
  const [history, setHistory] = useState([]);
  const [displayedHistory, setDisplayedHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);

  // === UI状态 ===
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // === Refs ===
  const startTimeRef = useRef(null);
  const imageProcessingStartRef = useRef(null);
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

  // === 初始化 ===
  useEffect(() => {
    const init = async () => {
      setUserId(getUserId());
      setSelectedModel(getSavedModel(AI_MODELS));
      setConcurrentCount(getSavedConcurrentCount());
      setDb(await initDB());
    };
    init();
  }, []);

  useEffect(() => {
    if (db && userId) loadHistoryData();
  }, [db, userId]);

  useEffect(() => {
    const storedApiKey = getSavedApiKey(selectedModel);
    setApiKey(storedApiKey);
  }, [selectedModel]);

  // === 历史记录管理 ===
  const loadHistoryData = async () => {
    const userHistory = await loadHistory(db, userId);
    setHistory(userHistory);
    setHistoryPage(1);
    updateDisplayedHistory(userHistory, 1);
  };

  const updateDisplayedHistory = (allHistory, page) => {
    const endIndex = page * ITEMS_PER_PAGE;
    setDisplayedHistory(allHistory.slice(0, endIndex));
  };

  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryPage(nextPage);
    updateDisplayedHistory(history, nextPage);
  };

  // === API管理 ===
  const handleSaveApiKey = (newApiKey) => {
    setApiKey(newApiKey);
    saveSelectedModel(selectedModel);
    saveApiKey(selectedModel, newApiKey);
    setShowApiKeyModal(false);
  };

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    setApiKey(getSavedApiKey(modelId));
  };

  const handleConcurrentCountChange = (count) => {
    setConcurrentCount(count);
    saveConcurrentCount(count);
  };

  // === 键盘事件 ===
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

  // === 主分析功能 ===
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

    const video = videoRef.current;

    // 图像处理
    imageProcessingStartRef.current = performance.now();
    const imageData = preprocessAndCompressImage(video);
    const imageProcessingEnd = performance.now();
    setImageProcessingTime(
      ((imageProcessingEnd - imageProcessingStartRef.current) / 1000).toFixed(2)
    );

    startTimeRef.current = performance.now();

    try {
      const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
      setStatus(
        `🚀 正在解答题目 (${concurrentCount}次验证, ${
          currentModel?.name || "所选模型"
        })...`
      );

      // 倒计时
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
        () => {}, // 进度回调简化
        setAnswer
      );

      clearInterval(countdownInterval);
      setCountdown(null);

      const apiEnd = performance.now();
      setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));
      setStatus(
        `🎯 并发分析完成！一致性：${concurrentData.consistency.message}`
      );

      // 保存历史
      await saveToHistory(db, userId, imageData, {
        type: "concurrent_analysis",
        results: concurrentData.results,
        consistency: concurrentData.consistency,
      });
      await loadHistoryData();
    } catch (error) {
      console.error("Analysis failed:", error);
      setCountdown(null);
      setErrorMessage("❌ " + (error.message || "未知错误，请重试"));
      setStatus("分析出错了");
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

        {/* 摄像头 */}
        <CameraDisplay
          videoRef={videoRef}
          cameraStatus={cameraStatus}
          cameraError={cameraError}
          retryCount={retryCount}
          maxRetryCount={MAX_RETRY_COUNT}
          onRetry={handleRetryCamera}
          getEnvironmentInfo={getEnvironmentInfo}
        />

        {/* 拍照按钮 */}
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

        {/* 状态显示 */}
        <div className="text-center mt-2">
          <p className="text-sm text-gray-500">
            {status}
            {countdown !== null && (
              <span className="ml-2 inline-flex items-center">
                <span className="animate-pulse text-orange-600 font-bold">
                  ⏰ {countdown}秒
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

        {/* 答案显示 */}
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
                  AI总响应耗时:{" "}
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

      {/* 模态框 */}
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

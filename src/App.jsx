import React, { useState, useEffect, useRef } from "react";
import CameraDisplay from "./components/CameraDisplay.jsx";
import ApiKeyModal from "./components/ApiKeyModal.jsx";
import HistoryModal from "./components/HistoryModal.jsx";
import AnswerDisplay from "./components/AnswerDisplay.jsx";
import AppHeader from "./components/AppHeader.jsx";
import StatusDisplay from "./components/StatusDisplay.jsx";
import CaptureButton from "./components/CaptureButton.jsx";
import { useCameraManager } from "./hooks/useCameraManager.js";
import { usePhotoAnalysis } from "./hooks/usePhotoAnalysis.js";
import {
  initDB,
  loadHistory,
  getUserId,
  getSavedModel,
  getSavedApiKey,
  saveApiKey,
  saveSelectedModel,
  getSavedConcurrentCount,
  saveConcurrentCount,
} from "./utils/database.js";
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

  // === UI状态 ===
  const [status, setStatus] = useState("等待拍摄题目...");
  const [errorMessage, setErrorMessage] = useState(null);

  // === 历史记录状态 ===
  const [history, setHistory] = useState([]);
  const [displayedHistory, setDisplayedHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);

  // === UI状态 ===
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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
  } = useCameraManager({
    onStreamReady: setVideoStream,
    onError: setErrorMessage,
    onStatusChange: setStatus,
  });

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

  // === 拍照分析管理 ===
  const {
    isLoading,
    answer,
    countdown,
    imageProcessingTime,
    totalApiTime,
    handleCaptureAndAnalyze,
  } = usePhotoAnalysis({
    videoRef,
    cameraStatus,
    selectedModel,
    apiKey,
    concurrentCount,
    db,
    userId,
    onHistoryReload: loadHistoryData,
    onError: setErrorMessage,
    onStatusChange: setStatus,
    showApiKeyModal,
    setShowApiKeyModal,
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

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-2 sm:p-4 font-sans overflow-x-hidden w-full max-w-full">
      <div className="w-full mx-auto bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 overflow-x-hidden max-w-full sm:max-w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        {/* 头部 */}
        <AppHeader
          onShowHistory={() => setShowHistoryModal(true)}
          onShowSettings={() => setShowApiKeyModal(true)}
        />

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
        <CaptureButton
          onClick={handleCaptureAndAnalyze}
          isLoading={isLoading}
          hasVideoStream={!!videoStream}
          cameraStatus={cameraStatus}
          concurrentCount={concurrentCount}
        />

        {/* 状态显示 */}
        <StatusDisplay status={status} countdown={countdown} />

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

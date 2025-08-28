import { useState, useRef } from "react";
import { preprocessAndCompressImage } from "../utils/imageProcessing.js";
import { performConcurrentAnalysis } from "../utils/concurrentAnalysis.js";
import { saveToHistory } from "../utils/database.js";
import { AI_MODELS } from "../config/models.js";

/**
 * 拍照分析自定义Hook
 * 处理图像捕获、预处理、AI分析和结果保存的完整流程
 * @param {Object} dependencies - 依赖项
 * @returns {Object} 分析状态和方法
 */
export const usePhotoAnalysis = ({
    videoRef,
    cameraStatus,
    selectedModel,
    apiKey,
    concurrentCount,
    db,
    userId,
    onHistoryReload,
    onError,
    onStatusChange,
    showApiKeyModal,
    setShowApiKeyModal
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [answer, setAnswer] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [imageProcessingTime, setImageProcessingTime] = useState(null);
    const [totalApiTime, setTotalApiTime] = useState(null);

    const startTimeRef = useRef(null);
    const imageProcessingStartRef = useRef(null);

    /**
     * 执行拍照和分析的主要功能
     */
    const handleCaptureAndAnalyze = async () => {
        if (!videoRef.current || cameraStatus !== "success") {
            onError("摄像头未就绪，请稍后重试。");
            return;
        }

        if (!apiKey) {
            const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
            onError(`请先设置你的 ${currentModel?.name || "所选模型"} API Key。`);
            setShowApiKeyModal(true);
            return;
        }

        setIsLoading(true);
        setAnswer(null);
        setImageProcessingTime(null);
        setTotalApiTime(null);
        onError(null);

        const video = videoRef.current;

        // 图像处理
        imageProcessingStartRef.current = performance.now();
        const imageData = preprocessAndCompressImage(video);
        const imageProcessingEnd = performance.now();
        setImageProcessingTime(((imageProcessingEnd - imageProcessingStartRef.current) / 1000).toFixed(2));

        startTimeRef.current = performance.now();

        try {
            const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
            onStatusChange(`🚀 正在解答题目 (${concurrentCount}次验证, ${currentModel?.name || "所选模型"})...`);

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
                () => { }, // 进度回调简化
                setAnswer
            );

            clearInterval(countdownInterval);
            setCountdown(null);

            const apiEnd = performance.now();
            setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));
            onStatusChange(`🎯 并发分析完成！一致性：${concurrentData.consistency.message}`);

            // 保存历史
            await saveToHistory(db, userId, imageData, {
                type: "concurrent_analysis",
                results: concurrentData.results,
                consistency: concurrentData.consistency,
            });
            await onHistoryReload();
        } catch (error) {
            console.error("Analysis failed:", error);
            setCountdown(null);
            onError("❌ " + (error.message || "未知错误，请重试"));
            onStatusChange("分析出错了");
        } finally {
            setIsLoading(false);
            setCountdown(null);
        }
    };

    return {
        isLoading,
        answer,
        countdown,
        imageProcessingTime,
        totalApiTime,
        handleCaptureAndAnalyze,
    };
};

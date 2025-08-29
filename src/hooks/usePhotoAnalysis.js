import React, { useState, useRef } from "react";
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
    const currentTaskIdRef = useRef(null);
    const countdownIntervalRef = useRef(null);

    /**
     * 生成唯一的任务ID
     */
    const generateTaskId = () => {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    };

    /**
     * 检查结果是否属于当前任务
     */
    const isCurrentTask = (taskId) => {
        return taskId === currentTaskIdRef.current;
    };

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

        // 生成新的任务ID，标记新任务开始
        const taskId = generateTaskId();
        currentTaskIdRef.current = taskId;

        // 清理之前的倒计时
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
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

            // 倒计时 - 统一10秒
            const timeoutSeconds = 10;
            setCountdown(timeoutSeconds);
            let isTimedOut = false;
            let hasReceivedResultAfterTimeout = false;
            countdownIntervalRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                        isTimedOut = true;
                        // 超时时显示状态，但不终止分析，继续等待结果
                        if (isCurrentTask(taskId)) {
                            onStatusChange("⏰ 分析中，请稍候...");
                            setIsLoading(false); // 取消加载状态，但不显示失败
                        }
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

            // 结果回调函数，检查任务ID
            const onResultCallback = (result) => {
                // 验证任务ID，确保只处理当前任务的结果
                if (result.taskId === taskId && isCurrentTask(taskId)) {
                    setAnswer(result);
                    // 如果超时后才收到结果，更新状态并标记
                    if (isTimedOut) {
                        hasReceivedResultAfterTimeout = true;
                        onStatusChange("🎯 分析完成！");
                    }
                }
            };

            let hasSavedToDatabase = false; // 防止重复保存

            // 独立的数据库保存回调，即使任务被覆盖也要保存
            const onDatabaseSaveCallback = async (finalResult, imageDataForSave) => {
                if (finalResult && imageDataForSave && !hasSavedToDatabase) {
                    try {
                        // 只保存最终完整的结果，或者有成功结果的情况
                        if (finalResult.consistency.successCount > 0 || finalResult.results.length >= concurrentCount) {
                            hasSavedToDatabase = true;
                            await saveToHistory(db, userId, imageDataForSave, {
                                type: "concurrent_analysis",
                                results: finalResult.results,
                                consistency: finalResult.consistency,
                            });
                            // 如果是当前任务，刷新历史记录
                            if (isCurrentTask(taskId)) {
                                await onHistoryReload();
                            }
                        }
                    } catch (error) {
                        console.error("保存历史记录失败:", error);
                        hasSavedToDatabase = false; // 如果保存失败，重置状态
                    }
                }
            };

            const concurrentData = await performConcurrentAnalysis(
                imageData,
                selectedModel,
                apiKey,
                concurrentCount,
                () => { }, // 进度回调简化
                onResultCallback,
                taskId, // 传递任务ID
                onDatabaseSaveCallback // 传递数据库保存回调
            );

            // 只有在当前任务还是活跃的情况下才处理最终UI更新
            if (isCurrentTask(taskId)) {
                // 清理倒计时
                if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                }
                setCountdown(null);

                const apiEnd = performance.now();
                setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));

                // 如果没有超时，或者超时了但没有通过回调显示结果，才更新状态
                if (!isTimedOut || !hasReceivedResultAfterTimeout) {
                    onStatusChange(`🎯 并发分析完成！一致性：${concurrentData.consistency.message}`);
                }
                setIsLoading(false);
            }

            // 数据库保存通过回调已经处理，这里不需要重复保存
        } catch (error) {
            console.error("Analysis failed:", error);
            // 只有当前任务才处理错误，且如果超时后已有结果显示，不要用错误覆盖
            if (isCurrentTask(taskId)) {
                setCountdown(null);
                // 如果超时后已经收到部分结果，不要显示错误，保持现有结果
                if (!isTimedOut || !hasReceivedResultAfterTimeout) {
                    onError("❌ " + (error.message || "未知错误，请重试"));
                    onStatusChange("分析出错了");
                }
                setIsLoading(false);
            }
        }
    };

    // 清理函数
    const cleanup = () => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        currentTaskIdRef.current = null;
    };

    // 组件卸载时清理
    React.useEffect(() => {
        return cleanup;
    }, []);

    return {
        isLoading,
        answer,
        countdown,
        imageProcessingTime,
        totalApiTime,
        handleCaptureAndAnalyze,
        cleanup,
    };
};

/**
 * 并发分析工具模块
 * 提供多次并发AI分析功能
 */

import { callAIAPI } from './apiService.js';
import { analyzeConsistency } from './consistencyAnalysis.js';

/**
 * 执行并发分析
 * @param {string} imageData - 图像数据
 * @param {string} selectedModel - 选择的模型
 * @param {string} apiKey - API密钥
 * @param {number} concurrentCount - 并发次数
 * @param {Function} onProgress - 进度回调
 * @param {Function} onResult - 结果回调
 * @param {string} taskId - 任务ID
 * @param {Function} onDatabaseSave - 数据库保存回调
 * @returns {Promise<Object>} 并发分析结果
 */
export const performConcurrentAnalysis = async (
    imageData,
    selectedModel,
    apiKey,
    concurrentCount,
    onProgress,
    onResult,
    taskId = null,
    onDatabaseSave = null
) => {
    // 初始化进度状态
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
    onProgress?.(initialProgress);

    // 用于跟踪已完成的结果
    const completedResults = [];
    let completedCount = 0;

    // 创建指定数量的独立分析任务
    const analysisPromises = Array.from(
        { length: concurrentCount },
        async (_, index) => {
            const id = index + 1;
            const startTime = performance.now();

            try {
                // 更新状态为进行中
                onProgress?.((prev) =>
                    prev.map((item) =>
                        item.id === id
                            ? { ...item, status: "analyzing", progress: 50 }
                            : item
                    )
                );

                const result = await callAIAPI(selectedModel, imageData, apiKey);
                const endTime = performance.now();
                const timeSpent = ((endTime - startTime) / 1000).toFixed(2);

                const taskResult = { id, result, timeSpent, error: null };

                // 立即更新进度状态
                onProgress?.((prev) =>
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

                // 立即更新并发结果
                completedResults.push(taskResult);
                completedCount++;

                // 实时更新一致性分析
                const currentConsistency = analyzeConsistency(completedResults, concurrentCount);

                // 实时更新UI显示
                onResult?.({
                    type: "concurrent_analysis",
                    results: [...completedResults],
                    consistency: currentConsistency,
                    taskId: taskId, // 包含任务ID用于验证
                });

                // 如果有足够的成功结果，立即保存（防止用户快速点击导致结果丢失）
                if (currentConsistency.successCount > 0 && onDatabaseSave) {
                    const partialResult = { results: [...completedResults], consistency: currentConsistency };
                    onDatabaseSave(partialResult, imageData).catch(error => {
                        console.error("实时保存失败:", error);
                    });
                }

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
                onProgress?.((prev) =>
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

                // 实时更新一致性分析（包含错误）
                const currentConsistency = analyzeConsistency(completedResults, concurrentCount);

                // 实时更新UI显示（包含失败结果）
                onResult?.({
                    type: "concurrent_analysis",
                    results: [...completedResults],
                    consistency: currentConsistency,
                    taskId: taskId, // 包含任务ID用于验证
                });

                // 如果有任何结果（包括失败），都尝试保存
                if (completedResults.length > 0 && onDatabaseSave) {
                    const partialResult = { results: [...completedResults], consistency: currentConsistency };
                    onDatabaseSave(partialResult, imageData).catch(error => {
                        console.error("实时保存失败:", error);
                    });
                }

                return taskResult;
            }
        }
    );

    try {
        const allResults = await Promise.allSettled(analysisPromises);

        // 提取实际结果（Promise.allSettled返回的是{status, value/reason}格式）
        const actualResults = allResults.map(result =>
            result.status === 'fulfilled' ? result.value : {
                id: result.reason?.id || 0,
                result: null,
                timeSpent: '0.00',
                error: result.reason?.message || '未知错误'
            }
        );

        // 最终更新状态
        const finalConsistency = analyzeConsistency(actualResults, concurrentCount);
        const finalResult = { results: actualResults, consistency: finalConsistency };

        // 自动保存到数据库，无论UI是否还在显示
        if (onDatabaseSave) {
            await onDatabaseSave(finalResult, imageData);
        }

        return finalResult;
    } catch (error) {
        console.error('并发分析出现未捕获错误:', error);
        // 如果有未捕获的错误，也要保证返回当前结果
        const finalConsistency = analyzeConsistency(completedResults, concurrentCount);
        const finalResult = { results: completedResults, consistency: finalConsistency };

        // 即使有错误也要保存已完成的结果
        if (onDatabaseSave) {
            await onDatabaseSave(finalResult, imageData).catch(saveError => {
                console.error('保存失败结果时出错:', saveError);
            });
        }

        return finalResult;
    }
};

/**
 * 获取最佳答案
 * @param {Object} consistency - 一致性分析结果
 * @returns {string|null} 最佳答案
 */
export const getBestAnswer = (consistency) => {
    if (consistency.matches && consistency.matches.length > 0) {
        // 返回相似度最高的答案
        const bestMatch = consistency.matches.reduce((best, current) =>
            current.similarity > best.similarity ? current : best
        );
        return bestMatch.answer;
    }

    // 如果没有匹配，返回第一个有效结果的答案
    if (consistency.validResults && consistency.validResults.length > 0) {
        const firstResult = consistency.validResults[0];
        if (typeof firstResult.result === "object" && firstResult.result.answer) {
            return firstResult.result.answer;
        } else if (typeof firstResult.result === "string") {
            return firstResult.result;
        }
    }

    return null;
};

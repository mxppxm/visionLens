/**
 * 一致性分析工具模块
 * 专门处理分析结果的一致性检查
 */

/**
 * 计算两个字符串的相似度
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 相似度(0-1)
 */
export const calculateSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = levenshteinDistance(str1, str2);
    return (maxLength - distance) / maxLength;
};

/**
 * 计算编辑距离
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 编辑距离
 */
export const levenshteinDistance = (str1, str2) => {
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

/**
 * 分析结果的一致性
 * @param {Array} results - 分析结果数组
 * @param {number} concurrentCount - 总并发次数
 * @returns {Object} 一致性分析结果
 */
export const analyzeConsistency = (results, concurrentCount = 3) => {
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
            message: totalCount < concurrentCount
                ? `${failedCount}/${totalCount} 分析失败`
                : `${concurrentCount}次分析都失败了`,
            matches: [],
            totalCount,
            successCount,
            failedCount,
        };
    }

    // 如果只有一次成功
    if (validResults.length === 1) {
        return {
            type: "only_one_success",
            color: totalCount < concurrentCount ? "green" : "yellow", // 改为绿色，表示有结果了
            message: totalCount < concurrentCount
                ? `1/${totalCount} 分析成功，其他进行中...`
                : "只有一次分析成功",
            matches: [],
            validResults: validResults, // 添加这个字段，确保可以显示结果
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
                matches.push({
                    ids: [validResults[i].id, validResults[j].id],
                    similarity: similarity,
                    answer: answers[i],
                });
            }
        }
    }

    // 分析一致性类型
    if (validResults.length === concurrentCount) {
        // 全部都成功
        if (matches.length >= 2) {
            const allMatch = matches.some((m) => m.similarity > 0.9) &&
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
                color: totalCount < concurrentCount ? "green" : "yellow",
                message: totalCount < concurrentCount
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
                message: totalCount < concurrentCount
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
        message: totalCount < concurrentCount ? "分析进行中..." : "无法确定一致性",
        matches: matches,
        validResults: validResults,
        totalCount,
        successCount,
        failedCount,
    };
};

/**
 * 获取最佳答案
 * @param {Object} consistency - 一致性分析结果
 * @returns {string|null} 最佳答案
 */
export const getBestAnswer = (consistency) => {
    if (consistency.matches && consistency.matches.length > 0) {
        const bestMatch = consistency.matches.reduce((best, current) =>
            current.similarity > best.similarity ? current : best
        );
        return bestMatch.answer;
    }

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

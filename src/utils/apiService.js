/**
 * API服务工具模块
 * 提供统一的AI模型调用接口，集成v0 AI优化功能
 */

import { callGeminiAPI, callDoubaoVisionAPI, callDoubaoLiteAPI, callDoubaoFlashAPI } from './apiModels.js';
import { enhanceErrorHandling, optimizeAPIRequest } from './v0Integration.js';

// 学术题目分析Prompt
export const AI_ANALYSIS_PROMPT = `你是一位学术题目解答专家，专门解答各类学科题目。请直接分析图片中的题目并给出准确答案，不要输出任何思考过程或观察标记。

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

/**
 * 创建超时Promise
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise} 超时Promise
 */
export const createTimeoutPromise = (timeout = 30000) => {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error("API调用超时，请求已取消"));
        }, timeout);
    });
};

/**
 * 根据选择的模型调用对应的 API，带超时机制和v0优化
 * @param {string} selectedModel - 选择的模型
 * @param {string} imageData - 图像数据
 * @param {string} apiKey - API密钥
 * @returns {Promise<*>} API响应
 */
export const callAIAPI = async (selectedModel, imageData, apiKey) => {
    const apiCall = async () => {
        switch (selectedModel) {
            case "gemini":
                return await callGeminiAPI(imageData, apiKey, AI_ANALYSIS_PROMPT);
            case "doubao_vision":
                return await callDoubaoVisionAPI(imageData, apiKey, AI_ANALYSIS_PROMPT);
            case "doubao_lite":
                return await callDoubaoLiteAPI(imageData, apiKey, AI_ANALYSIS_PROMPT);
            case "doubao_flash":
                return await callDoubaoFlashAPI(imageData, apiKey, AI_ANALYSIS_PROMPT);
            default:
                throw new Error(`未知的模型类型: ${selectedModel}`);
        }
    };

    try {
        // 使用v0优化请求参数
        const optimizedParams = await optimizeAPIRequest({
            model: selectedModel,
            imageData,
            apiKey,
            prompt: AI_ANALYSIS_PROMPT
        });

        const result = await Promise.race([
            apiCall(),
            createTimeoutPromise(30000), // API调用允许30秒超时，确保有足够时间完成
        ]);

        return result;
    } catch (error) {
        // 使用v0增强错误处理
        const enhancedError = await enhanceErrorHandling(error, {
            model: selectedModel,
            operation: 'AI_API_CALL'
        });

        throw enhancedError;
    }
};

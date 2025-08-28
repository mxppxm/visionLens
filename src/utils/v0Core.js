/**
 * v0 AI核心功能模块
 * 提供基础的v0 AI集成功能
 */

import { generateText } from 'ai';
import { vercel } from '@ai-sdk/vercel';

/**
 * v0 AI模型配置
 */
export const V0_MODEL_CONFIG = {
    model: vercel('v0-1.0-md'),
    temperature: 0.3,
    maxTokens: 4000,
};

/**
 * 使用v0生成优化的代码
 * @param {string} prompt - 代码生成提示
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} 生成的代码
 */
export const generateCodeWithV0 = async (prompt, options = {}) => {
    try {
        const { text } = await generateText({
            ...V0_MODEL_CONFIG,
            ...options,
            prompt: `作为一名专业的React代码架构师，请基于以下需求生成高质量、可维护的代码：

${prompt}

请遵循以下规范：
1. 使用现代React Hooks
2. 采用函数式组件
3. 包含完整的TypeScript类型定义
4. 添加详细的文档注释
5. 遵循最佳实践和性能优化
6. 确保代码可读性和可维护性
7. 包含错误处理机制
8. 使用Tailwind CSS进行样式设计

请直接返回完整的代码，不需要解释。`,
        });

        return text;
    } catch (error) {
        console.error('v0代码生成失败:', error);
        throw new Error(`v0代码生成失败: ${error.message}`);
    }
};

/**
 * 优化API请求参数
 * @param {Object} requestParams - 请求参数
 * @returns {Promise<Object>} 优化后的参数
 */
export const optimizeAPIRequest = async (requestParams) => {
    try {
        // 基于模型类型优化超时时间
        const timeoutMap = {
            'gemini': 10000,
            'glm_4v': 12000,
            'glm_flashx': 8000
        };

        // 优化图片大小限制
        const imageSizeLimit = requestParams.model === 'glm_flashx' ? 4 * 1024 * 1024 : 20 * 1024 * 1024;

        return {
            ...requestParams,
            timeout: timeoutMap[requestParams.model] || 8000,
            imageSizeLimit,
            retryAttempts: 2,
            optimizedPrompt: requestParams.prompt // 暂时保持原样，后续可以用v0优化
        };
    } catch (error) {
        console.error('API请求优化失败:', error);
        return requestParams; // 返回原参数作为后备
    }
};

/**
 * 增强错误处理
 * @param {Error} error - 原始错误
 * @param {Object} context - 错误上下文
 * @returns {Promise<Error>} 增强后的错误
 */
export const enhanceErrorHandling = async (error, context = {}) => {
    try {
        // 错误分类和用户友好的错误消息
        const errorEnhancements = {
            'API调用超时': '网络连接超时，请检查网络环境后重试',
            '401': 'API密钥无效或已过期，请检查设置',
            '429': '请求频率过高，请稍后再试',
            '500': 'AI服务暂时不可用，请稍后重试',
            'ECONNREFUSED': '无法连接到AI服务，请检查网络连接',
            'NETWORK_ERROR': '网络连接异常，请检查网络设置'
        };

        let enhancedMessage = error.message;

        // 检查错误类型并提供更好的错误消息
        for (const [key, enhancement] of Object.entries(errorEnhancements)) {
            if (error.message.includes(key) || error.code === key) {
                enhancedMessage = enhancement;
                break;
            }
        }

        // 添加上下文信息
        if (context.model) {
            enhancedMessage += ` (模型: ${context.model})`;
        }

        const enhancedError = new Error(enhancedMessage);
        enhancedError.originalError = error;
        enhancedError.context = context;
        enhancedError.timestamp = new Date().toISOString();

        return enhancedError;
    } catch (enhancementError) {
        console.error('错误处理增强失败:', enhancementError);
        return error; // 返回原错误作为后备
    }
};

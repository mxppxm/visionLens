/**
 * AI模型配置
 * 定义支持的AI模型列表和相关配置
 */

export const AI_MODELS = [
    {
        id: "gemini",
        name: "Gemini 2.5 Flash",
        description: "Google 的高性能题目解答模型",
        apiKeyLabel: "Google Gemini API Key",
        apiKeyPlaceholder: "输入你的 Gemini API Key",
        provider: "google",
        features: ["text", "image", "fast_response"],
        defaultTimeout: 10000,
    },
    {
        id: "doubao_vision",
        name: "豆包模型 (高精度)",
        description: "字节跳动豆包大模型 doubao-seed-1-6-250615，具备强大的图片理解与推理能力",
        apiKeyLabel: "火山引擎 API Key",
        apiKeyPlaceholder: "输入你的火山引擎 API Key",
        provider: "bytedance",
        features: ["text", "image", "visual_understanding", "high_accuracy"],
        defaultTimeout: 10000,
    },
    {
        id: "doubao_lite",
        name: "豆包模型 (快速版)",
        description: "字节跳动豆包大模型 doubao-seed-1-6-250615，优化参数配置，响应速度更快",
        apiKeyLabel: "火山引擎 API Key",
        apiKeyPlaceholder: "输入你的火山引擎 API Key",
        provider: "bytedance",
        features: ["text", "image", "fast_response"],
        defaultTimeout: 10000,
        sharedKeyWith: "doubao_vision",
    },
    {
        id: "doubao_flash",
        name: "豆包 Flash 模型",
        description: "字节跳动豆包大模型 doubao-seed-1-6-flash-250715，超快响应速度，适合实时场景",
        apiKeyLabel: "火山引擎 API Key",
        apiKeyPlaceholder: "输入你的火山引擎 API Key",
        provider: "bytedance",
        features: ["text", "image", "ultra_fast", "real_time"],
        defaultTimeout: 10000,
        sharedKeyWith: "doubao_vision",
    },

];

/**
 * 获取模型的实际存储键名（用于API Key存储）
 * @param {string} modelId - 模型ID
 * @returns {string} 存储键名
 */
export const getModelStorageKey = (modelId) => {
    const model = AI_MODELS.find(m => m.id === modelId);
    if (!model) return modelId;

    // 豆包相关模型共享API Key
    if (model.provider === "bytedance") {
        return "doubao";
    }

    return modelId;
};

/**
 * 获取模型配置
 * @param {string} modelId - 模型ID
 * @returns {Object|null} 模型配置对象
 */
export const getModelConfig = (modelId) => {
    return AI_MODELS.find(m => m.id === modelId) || null;
};

/**
 * 获取默认模型
 * @returns {string} 默认模型ID
 */
export const getDefaultModel = () => {
    return "doubao_vision"; // 使用豆包视觉理解模型作为默认模型
};

/**
 * 验证模型ID是否有效
 * @param {string} modelId - 模型ID
 * @returns {boolean} 是否有效
 */
export const isValidModel = (modelId) => {
    return AI_MODELS.some(m => m.id === modelId);
};

/**
 * 获取模型的超时时间
 * @param {string} modelId - 模型ID
 * @returns {number} 超时时间（毫秒）
 */
export const getModelTimeout = (modelId) => {
    const model = getModelConfig(modelId);
    return model?.defaultTimeout || 30000;
};

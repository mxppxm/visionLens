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
        defaultTimeout: 8000,
    },
    {
        id: "glm_4v",
        name: "智谱 GLM-4V-Plus (快速版)",
        description: "智谱AI题目解答模型，响应速度快，适合日常练习",
        apiKeyLabel: "智谱AI API Key",
        apiKeyPlaceholder: "输入你的智谱AI API Key",
        provider: "zhipu",
        features: ["text", "image", "fast_response"],
        defaultTimeout: 8000,
        sharedKeyWith: "glm_flashx", // 与其他模型共享API Key
    },
    {
        id: "glm_flashx",
        name: "智谱 GLM-4.1V-FlashX (推理版)",
        description: "智谱AI深度推理模型，准确度高，适合难题解答",
        apiKeyLabel: "智谱AI API Key",
        apiKeyPlaceholder: "输入你的智谱AI API Key",
        provider: "zhipu",
        features: ["text", "image", "deep_reasoning"],
        defaultTimeout: 10000,
        sharedKeyWith: "glm_4v", // 与其他模型共享API Key
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

    // 智谱相关模型共享API Key
    if (model.provider === "zhipu") {
        return "glm";
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
    return "gemini";
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
    return model?.defaultTimeout || 8000;
};

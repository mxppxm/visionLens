/**
 * IndexedDB数据库操作工具模块
 * 提供数据库初始化、历史记录管理等功能
 */

import { openDB } from "idb";

/**
 * 初始化IndexedDB数据库
 * @returns {Promise<IDBPDatabase>} 数据库实例
 */
export const initDB = async () => {
    try {
        const database = await openDB("VisionLensDB", 1, {
            upgrade(db) {
                // 创建历史记录存储
                if (!db.objectStoreNames.contains("history")) {
                    const historyStore = db.createObjectStore("history", {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                    historyStore.createIndex("createdAt", "createdAt", {
                        unique: false,
                    });
                    historyStore.createIndex("userId", "userId", { unique: false });
                }
            },
        });
        return database;
    } catch (error) {
        console.error("IndexedDB 初始化失败:", error);
        return null;
    }
};

/**
 * 保存记录到 IndexedDB
 * @param {IDBPDatabase} db - 数据库实例
 * @param {string} userId - 用户ID
 * @param {string} imageData - 图像数据
 * @param {*} answer - 答案数据
 * @returns {Promise<number|null>} 新记录的ID
 */
export const saveToHistory = async (db, userId, imageData, answer) => {
    if (!db || !userId) return null;

    try {
        // 确保answer数据格式正确保存
        let answerToSave = answer;
        if (typeof answer === "object" && answer.question && answer.answer) {
            // 保持JSON格式用于后续解析
            answerToSave = answer;
        }

        const record = {
            userId,
            processedImage: `data:image/jpeg;base64,${imageData}`,
            answer: answerToSave,
            createdAt: new Date().toISOString(),
        };

        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");
        const result = await store.add(record);
        await tx.complete;

        return result;
    } catch (error) {
        console.error("保存历史记录失败:", error);
        return null;
    }
};

/**
 * 加载用户的历史记录
 * @param {IDBPDatabase} db - 数据库实例
 * @param {string} userId - 用户ID
 * @returns {Promise<Array>} 历史记录列表
 */
export const loadHistory = async (db, userId) => {
    if (!db || !userId) return [];

    try {
        const tx = db.transaction("history", "readonly");
        const store = tx.objectStore("history");
        const userIndex = store.index("userId");
        const userHistory = await userIndex.getAll(userId);

        // 按创建时间降序排序
        userHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return userHistory;
    } catch (error) {
        console.error("加载历史记录失败:", error);
        return [];
    }
};

/**
 * 更新历史记录
 * @param {IDBPDatabase} db - 数据库实例
 * @param {string} userId - 用户ID
 * @param {number} recordId - 记录ID
 * @param {*} updatedAnswer - 更新的答案
 * @returns {Promise<boolean>} 是否更新成功
 */
export const updateHistoryRecord = async (db, userId, recordId, updatedAnswer) => {
    if (!db || !userId || !recordId) return false;

    try {
        const tx = db.transaction("history", "readwrite");
        const store = tx.objectStore("history");

        // 获取现有记录
        const existingRecord = await store.get(recordId);
        if (!existingRecord) {
            console.warn("未找到要更新的历史记录:", recordId);
            return false;
        }

        // 更新答案字段
        existingRecord.answer = updatedAnswer;
        existingRecord.updatedAt = new Date().toISOString();

        // 保存更新后的记录
        await store.put(existingRecord);
        await tx.complete;

        return true;
    } catch (error) {
        console.error("更新历史记录失败:", error);
        return false;
    }
};

/**
 * 生成或获取用户ID
 * @returns {string} 用户ID
 */
export const getUserId = () => {
    let storedUserId = localStorage.getItem("visionLens_userId");
    if (!storedUserId) {
        storedUserId = crypto.randomUUID();
        localStorage.setItem("visionLens_userId", storedUserId);
    }
    return storedUserId;
};

/**
 * 保存模型选择到本地存储
 * @param {string} modelId - 模型ID
 */
export const saveSelectedModel = (modelId) => {
    localStorage.setItem("visionLens_selectedModel", modelId);
};

/**
 * 获取保存的模型选择
 * @param {Array} models - 可用模型列表
 * @returns {string} 模型ID
 */
export const getSavedModel = (models) => {
    const storedModel = localStorage.getItem("visionLens_selectedModel");
    if (storedModel && models.find((m) => m.id === storedModel)) {
        return storedModel;
    }
    return "gemini"; // 默认模型
};

/**
 * 保存API Key到本地存储
 * @param {string} modelId - 模型ID
 * @param {string} apiKey - API密钥
 */
export const saveApiKey = (modelId, apiKey) => {
    // 智谱相关模型共享API Key
    let keyModelId = modelId;
    if (modelId === "glm_flashx" || modelId === "glm_4v") {
        keyModelId = "glm";
    }

    localStorage.setItem(`visionLens_apiKey_${keyModelId}`, apiKey);
};

/**
 * 获取保存的API Key
 * @param {string} modelId - 模型ID
 * @returns {string} API密钥
 */
export const getSavedApiKey = (modelId) => {
    // 智谱相关模型共享API Key
    let keyModelId = modelId;
    if (modelId === "glm_flashx" || modelId === "glm_4v") {
        keyModelId = "glm";
    }

    return localStorage.getItem(`visionLens_apiKey_${keyModelId}`) || "";
};

/**
 * 保存并发分析次数配置
 * @param {number} count - 并发次数
 */
export const saveConcurrentCount = (count) => {
    localStorage.setItem("visionLens_concurrentCount", count.toString());
};

/**
 * 获取保存的并发分析次数配置
 * @returns {number} 并发次数
 */
export const getSavedConcurrentCount = () => {
    const storedConcurrentCount = localStorage.getItem("visionLens_concurrentCount");
    if (storedConcurrentCount) {
        const count = parseInt(storedConcurrentCount, 10);
        if (count >= 1 && count <= 5) {
            return count;
        }
    }
    return 3; // 默认3次
};

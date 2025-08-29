/**
 * API模型调用实现
 * 包含各个AI模型的具体调用逻辑
 */

/**
 * 调用 Gemini API
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callGeminiAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: prompt,
                    },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageData,
                        },
                    },
                ],
            },
        ],
    };

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "未能获取答案。";
};

/**
 * 调用豆包视觉理解模型 API
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callDoubaoVisionAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        model: "doubao-seed-1-6-250615",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData}`,
                        },
                    },
                    {
                        type: "text",
                        text: prompt,
                    },
                ],
            },
        ],
        temperature: 0.3,
        top_p: 0.8,
    };

    const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `豆包视觉理解模型 API 调用失败! Status: ${response.status}, Error: ${errorText}`
        );
    }

    const data = await response.json();
    return parseDoubaoResponse(data, "豆包视觉理解模型");
};

/**
 * 调用豆包 Lite 模型 API
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callDoubaoLiteAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        model: "doubao-seed-1-6-250615",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData}`,
                        },
                    },
                    {
                        type: "text",
                        text: prompt,
                    },
                ],
            },
        ],
        temperature: 0.4,
        top_p: 0.9,
    };

    const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `豆包 Lite 模型 API 调用失败! Status: ${response.status}, Error: ${errorText}`
        );
    }

    const data = await response.json();
    return parseDoubaoResponse(data, "豆包 Lite");
};

/**
 * 调用豆包 Flash 模型 API
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callDoubaoFlashAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        model: "doubao-seed-1-6-flash-250715",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData}`,
                        },
                    },
                    {
                        type: "text",
                        text: prompt,
                    },
                ],
            },
        ],
        temperature: 0.2,  // 更低温度，优化速度
        top_p: 0.7,        // 更低top_p，优化速度
    };

    const API_URL = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `豆包 Flash 模型 API 调用失败! Status: ${response.status}, Error: ${errorText}`
        );
    }

    const data = await response.json();
    return parseDoubaoResponse(data, "豆包 Flash");
};

/**
 * 解析豆包API响应
 * @param {Object} data - API响应数据
 * @param {string} modelName - 模型名称
 * @returns {Object|string} 解析后的响应
 */
export const parseDoubaoResponse = (data, modelName) => {
    const content = data.choices?.[0]?.message?.content || "未能获取答案。";

    try {
        // 清理可能的标记符和多余内容
        let cleanContent = content.trim();

        // 检查是否已经是JSON格式
        if (cleanContent.startsWith("{") && cleanContent.endsWith("}")) {
            try {
                const jsonResponse = JSON.parse(cleanContent);
                if (jsonResponse.question && jsonResponse.answer) {
                    return jsonResponse;
                }
            } catch (e) {
                // 如果不是有效JSON，继续处理
            }
        }

        // 尝试从内容中提取问题和答案
        const lines = cleanContent.split('\n').filter(line => line.trim());

        // 查找是否有明确的题目和答案结构
        let question = "题目解析";
        let answer = cleanContent;

        // 如果内容包含明显的题目标识，尝试分离
        if (cleanContent.includes('题目') || cleanContent.includes('问题')) {
            const questionMatch = cleanContent.match(/(?:题目|问题)[:：]?\s*(.+?)(?=\n|答案|解答|$)/i);
            if (questionMatch) {
                question = questionMatch[1].trim();
                answer = cleanContent.replace(questionMatch[0], '').trim();
            }
        }

        // 构造标准JSON响应
        return {
            question: question,
            answer: answer
        };
    } catch (error) {
        console.warn(`${modelName} 响应解析失败，原始内容:`, content);

        // 检查是否是常见的错误消息
        if (content.includes("无法处理该图像") || content.includes("抱歉") || content.includes("无法识别")) {
            return {
                question: "图像识别失败",
                answer: "AI模型无法识别图像中的内容。建议：\n1. 确保图像清晰且包含题目\n2. 检查API Key是否正确配置\n3. 尝试重新拍照或切换其他模型",
            };
        }

        if (content.includes("API") && (content.includes("key") || content.includes("Key"))) {
            return {
                question: "API配置错误",
                answer: "API Key配置有误，请检查设置中的火山引擎API Key是否正确",
            };
        }

        // 返回原始内容
        return {
            question: "题目解析",
            answer: content
        };
    }
};



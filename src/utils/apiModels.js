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
 * 调用智谱 GLM-4V API (快速版)
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callGLM4VAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        model: "glm-4v-plus",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: prompt,
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData}`,
                        },
                    },
                ],
            },
        ],
        temperature: 0.4,
    };

    const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

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
            `智谱 GLM-4V-Plus API 调用失败! Status: ${response.status}, Error: ${errorText}`
        );
    }

    const data = await response.json();
    return parseGLMResponse(data, "GLM-4V");
};

/**
 * 调用智谱 GLM-4.1V-FlashX API (推理版)
 * @param {string} imageData - Base64编码的图像数据
 * @param {string} apiKey - API密钥
 * @param {string} prompt - 分析提示
 * @returns {Promise<string>} API响应
 */
export const callGLMFlashXAPI = async (imageData, apiKey, prompt) => {
    const payload = {
        model: "glm-4.1v-thinking-flashx",
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: prompt,
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${imageData}`,
                        },
                    },
                ],
            },
        ],
        temperature: 0.4,
    };

    const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

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
            `智谱 GLM-4.1V-FlashX API 调用失败! Status: ${response.status}, Error: ${errorText}`
        );
    }

    const data = await response.json();
    return parseGLMResponse(data, "GLM-4.1V-FlashX");
};

/**
 * 解析智谱API响应
 * @param {Object} data - API响应数据
 * @param {string} modelName - 模型名称
 * @returns {Object|string} 解析后的响应
 */
export const parseGLMResponse = (data, modelName) => {
    const content = data.choices?.[0]?.message?.content || "未能获取答案。";

    try {
        // 清理可能的标记符和多余内容
        let cleanContent = content
            .replace(/<\|observation\|>/g, "")
            .replace(/<\|thinking\|>/g, "")
            .replace(/<\|\/thinking\|>/g, "")
            .replace(/<\|reflection\|>/g, "")
            .replace(/<\|\/reflection\|>/g, "")
            .replace(/<\|begin_of_box\|>/g, "")
            .replace(/<\|end_of_box\|>/g, "")
            .replace(/<\|box_start\|>/g, "")
            .replace(/<\|box_end\|>/g, "")
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .replace(/^.*?begin.*?\n?/i, "")
            .replace(/\n?.*?end.*?$/i, "")
            .replace(/^[^{]*/, "")
            .replace(/[^}]*$/, "")
            .trim();

        // 修复JSON中的引号问题
        cleanContent = cleanContent
            .replace(/"/g, '"')
            .replace(/"/g, '"');

        // 尝试修复JSON字符串中的引号嵌套问题
        try {
            JSON.parse(cleanContent);
        } catch (e) {
            // 尝试用正则提取question和answer的值
            const questionMatch = cleanContent.match(
                /"question"\s*:\s*"(.*?)(?=",\s*"answer")/s
            );
            const answerMatch = cleanContent.match(
                /"answer"\s*:\s*"(.*?)(?="\s*})/s
            );

            if (questionMatch && answerMatch) {
                let question = questionMatch[1]
                    .replace(/^[""]/, "")
                    .replace(/[""]$/, "")
                    .replace(/\\"/g, '"');
                let answer = answerMatch[1]
                    .replace(/^[""]/, "")
                    .replace(/[""]$/, "")
                    .replace(/\\"/g, '"');

                cleanContent = JSON.stringify({
                    question: question,
                    answer: answer,
                });
            }
        }

        // 如果还没找到有效的JSON格式，尝试用正则提取
        if (!cleanContent.startsWith("{") || !cleanContent.endsWith("}")) {
            const jsonMatches = [
                /\{[^{}]*?"question"[^{}]*?"answer"[^{}]*?\}/s,
                /\{[\s\S]*?"question"[\s\S]*?"answer"[\s\S]*?\}/,
                /\{.*?"question".*?"answer".*?\}/s,
            ];

            for (const regex of jsonMatches) {
                const match = content.match(regex);
                if (match) {
                    cleanContent = match[0];
                    break;
                }
            }
        }

        const jsonResponse = JSON.parse(cleanContent);
        if (jsonResponse.question && jsonResponse.answer) {
            return jsonResponse;
        }
    } catch (error) {
        console.warn("JSON解析失败，原始内容:", content);

        // 检查是否是常见的错误消息
        if (content.includes("无法处理该图像") || content.includes("抱歉")) {
            return {
                question: "图像识别失败",
                answer: "AI模型无法识别图像中的内容。建议：\n1. 确保图像清晰且包含题目\n2. 检查API Key是否正确配置\n3. 尝试重新拍照或切换其他模型",
            };
        }

        if (content.includes("API") && content.includes("key")) {
            return {
                question: "API配置错误",
                answer: "API Key配置有误，请检查设置中的API Key是否正确",
            };
        }
    }

    // 如果内容只是观察标记或空白，返回错误信息
    const strippedContent = content.replace(/<\|[^|]*\|>/g, "").trim();
    if (!strippedContent || strippedContent.length < 10) {
        return {
            question: "模型响应异常",
            answer: "模型只返回了观察标记，请尝试重新拍照或切换其他模型",
        };
    }

    return content;
};

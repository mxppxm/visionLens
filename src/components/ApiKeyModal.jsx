import React, { useState, useEffect } from "react";

/**
 * API Key设置模态框组件
 * 负责模型选择、API Key配置和并发分析设置
 * @param {Object} props - 组件属性
 * @param {boolean} props.isOpen - 模态框是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onSave - 保存回调
 * @param {string} props.selectedModel - 当前选择的模型
 * @param {Function} props.onModelChange - 模型变化回调
 * @param {Array} props.models - 模型列表
 * @param {string} props.apiKey - 当前API Key
 * @param {number} props.concurrentCount - 并发分析次数
 * @param {Function} props.onConcurrentCountChange - 并发次数变化回调
 */
const ApiKeyModal = ({
  isOpen,
  onClose,
  onSave,
  selectedModel,
  onModelChange,
  models,
  apiKey,
  concurrentCount,
  onConcurrentCountChange,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState("");

  // 当模态框打开时，加载当前API Key
  useEffect(() => {
    if (isOpen) {
      // 智谱相关模型共享API Key
      let keyModelId = selectedModel;
      if (selectedModel === "glm_flashx" || selectedModel === "glm_4v") {
        keyModelId = "glm";
      }

      const currentApiKey =
        localStorage.getItem(`visionLens_apiKey_${keyModelId}`) || "";
      setApiKeyInput(currentApiKey);
    }
  }, [isOpen, selectedModel]);

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      onSave(apiKeyInput.trim());
      setApiKeyInput("");
    }
  };

  const handleClose = () => {
    onClose();
    setApiKeyInput("");
  };

  const handleConcurrentCountChange = (count) => {
    onConcurrentCountChange(count);
    localStorage.setItem("visionLens_concurrentCount", count.toString());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-x-hidden">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-h-screen overflow-y-auto overflow-x-hidden mx-auto max-w-full sm:max-w-full md:max-w-lg lg:max-w-xl xl:max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">设置 API Key</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          {/* 模型选择区域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择大模型
            </label>
            <div className="space-y-2">
              {models.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedModel === model.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={selectedModel === model.id}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">
                      {model.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {model.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 并发分析配置 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              并发分析次数
            </label>
            <select
              value={concurrentCount}
              onChange={(e) =>
                handleConcurrentCountChange(parseInt(e.target.value, 10))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1次 (单次分析，速度最快)</option>
              <option value={2}>2次 (双重验证)</option>
              <option value={3}>3次 (三重验证，推荐)</option>
              <option value={4}>4次 (高可靠性)</option>
              <option value={5}>5次 (极高可靠性，速度较慢)</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              💡 更多并发次数可以提高答案准确性，但会增加耗时和API调用费用
            </p>
          </div>

          {/* API Key 配置区域 */}
          <div>
            {selectedModel === "gemini" && (
              <p className="text-sm text-gray-600 mb-3">
                请输入你的 Google Gemini API Key。如果你还没有 API Key，请访问{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Google AI Studio
                </a>{" "}
                免费获取。
              </p>
            )}

            {(selectedModel === "glm_4v" || selectedModel === "glm_flashx") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <h4 className="font-medium text-blue-900 mb-2">
                  智谱AI模型说明：
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>
                    • <strong>GLM-4V-Plus (快速版)</strong>
                    ：响应速度快，适合日常练习和简单题目
                  </li>
                  <li>
                    • <strong>GLM-4.1V-FlashX (推理版)</strong>
                    ：深度推理，准确度更高，适合复杂题目和难题
                  </li>
                  <li>• 两个模型共享同一个API Key</li>
                </ul>
                <p className="text-sm text-blue-700 mt-2">
                  如果你还没有 API Key，请访问{" "}
                  <a
                    href="https://bigmodel.cn/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    智谱AI开放平台
                  </a>{" "}
                  获取。
                </p>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-2">
              {models.find((m) => m.id === selectedModel)?.apiKeyLabel ||
                "API Key"}
            </label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={
                models.find((m) => m.id === selectedModel)?.apiKeyPlaceholder ||
                "输入你的 API Key"
              }
              className="w-full max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent overflow-hidden"
              autoFocus
            />

            <p className="text-xs text-gray-500 mt-2">
              🔒 你的 API Key 仅保存在本地浏览器中，不会发送到任何服务器。
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKeyInput.trim()}
            className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
              apiKeyInput.trim()
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            保存
          </button>
        </div>

        {!apiKey && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ 首次使用需要设置{" "}
              {models.find((m) => m.id === selectedModel)?.name || "所选模型"}{" "}
              API Key 才能开始使用智能识别功能。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyModal;

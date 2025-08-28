import React from "react";
import ConcurrentAnalysisDisplay from "./answer/ConcurrentAnalysisDisplay.jsx";
import QuestionAnswerDisplay from "./answer/QuestionAnswerDisplay.jsx";

/**
 * 答案显示组件
 * 负责解析和高亮显示AI的答案内容
 * @param {Object} props - 组件属性
 * @param {*} props.responseData - 响应数据
 * @param {boolean} props.isCompact - 是否为紧凑模式
 */
const AnswerDisplay = ({ responseData, isCompact = false }) => {
  // 处理并发分析结果
  if (responseData?.type === "concurrent_analysis") {
    return (
      <ConcurrentAnalysisDisplay
        responseData={responseData}
        isCompact={isCompact}
      />
    );
  }

  // 处理错误记录
  if (responseData?.type?.includes("error")) {
    return <ErrorDisplay responseData={responseData} isCompact={isCompact} />;
  }

  // 处理JSON对象格式的响应
  if (responseData?.question && responseData?.answer) {
    return (
      <QuestionAnswerDisplay
        responseData={responseData}
        isCompact={isCompact}
      />
    );
  }

  // 处理字符串格式
  return <TextDisplay responseData={responseData} isCompact={isCompact} />;
};

/**
 * 错误显示组件
 */
const ErrorDisplay = ({ responseData, isCompact }) => {
  const { error, message, timestamp, model } = responseData;

  if (isCompact) {
    return (
      <div className="bg-gradient-to-r from-red-100 to-orange-100 px-3 py-2 rounded-lg border-2 border-red-300">
        <div className="text-xs font-bold text-red-900 mb-1 flex items-center">
          <span className="mr-1">❌</span>
          {error}
        </div>
        <div className="text-xs text-red-700">{message}</div>
        <div className="text-xs text-red-600 mt-1 flex justify-between">
          <span>模型: {model}</span>
          <span>{new Date(timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 rounded-2xl border-3 shadow-2xl bg-gradient-to-br from-red-400 via-orange-500 to-red-600 border-red-300">
      <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl"></div>
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
          <h2 className="text-2xl lg:text-3xl font-bold text-white flex items-center mb-2 lg:mb-0">
            <span className="mr-3 text-3xl">❌</span>
            {error}
          </h2>
          <div className="px-4 py-2 bg-white bg-opacity-90 text-gray-800 rounded-full font-bold">
            模型: {model}
          </div>
        </div>
        <div className="bg-white bg-opacity-95 p-6 rounded-xl">
          <p className="text-gray-800 leading-relaxed text-lg">{message}</p>
          <p className="text-sm text-gray-600 mt-2">
            时间: {new Date(timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * 文本显示组件
 */
const TextDisplay = ({ responseData, isCompact }) => {
  const text =
    typeof responseData === "string" ? responseData : String(responseData);

  // 尝试匹配不同的问答格式
  const patterns = [
    /^(.+?[问题：问：Q:\s]*)(.+?)[\s]*([答案：答：A:\s]*)(.+)$/is,
    /^(.+?)[\s]*答案[：:\s]*(.+)$/is,
    /^(.+?)[\s]*回答[：:\s]*(.+)$/is,
    /^(.+?)[\s]*解答[：:\s]*(.+)$/is,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const question = match[1]?.trim();
      const answer = match[match.length - 1]?.trim();

      if (question && answer && question !== answer) {
        if (isCompact) {
          return (
            <div className="bg-green-100 px-2 py-1 rounded text-xs">
              <span className="font-medium text-green-800">答案: </span>
              <span className="text-gray-700">{answer}</span>
            </div>
          );
        } else {
          return (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
                <p className="text-sm font-medium text-blue-800 mb-1">问题</p>
                <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                  {question}
                </p>
              </div>
              <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded-r-lg">
                <p className="text-sm font-medium text-green-800 mb-1">答案</p>
                <p className="text-gray-700 leading-relaxed font-medium text-base sm:text-lg">
                  {answer}
                </p>
              </div>
            </div>
          );
        }
      }
    }
  }

  // 高亮关键词
  const keywordPatterns = [
    /(答案|答|回答|解答)[：:\s]*([^。！？\n]+[。！？]?)/gi,
    /(这是|这个是|它是)[：:\s]*([^。！？\n]+[。！？]?)/gi,
  ];

  let highlightedText = text;
  let hasHighlight = false;

  for (const pattern of keywordPatterns) {
    highlightedText = highlightedText.replace(
      pattern,
      (match, keyword, content) => {
        hasHighlight = true;
        if (isCompact) {
          return `${keyword}<span style="background-color: #fef08a; padding: 1px 2px; border-radius: 2px; font-weight: 500;">${content}</span>`;
        } else {
          return `${keyword}<span class="bg-yellow-200 px-1 rounded font-medium">${content}</span>`;
        }
      }
    );
  }

  if (hasHighlight) {
    const className = isCompact
      ? "text-gray-700 leading-relaxed break-all text-xs"
      : "text-gray-700 leading-relaxed break-all text-base sm:text-lg";

    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: highlightedText }}
      />
    );
  }

  // 默认显示原文
  const className = isCompact
    ? "text-gray-700 leading-relaxed break-all text-xs"
    : "text-gray-700 leading-relaxed break-all text-base sm:text-lg";

  return <p className={className}>{text}</p>;
};

export default AnswerDisplay;

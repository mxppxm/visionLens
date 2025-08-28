/**
 * 问答格式显示组件
 * 专门处理标准问答格式的显示
 */

import React from "react";

/**
 * 问答显示组件
 */
const QuestionAnswerDisplay = ({ responseData, isCompact }) => {
  const { question, answer } = responseData;

  // 检测是否为填空题
  const isFillInBlank =
    question.includes("填") ||
    question.includes("空") ||
    question.includes("____") ||
    question.includes("___") ||
    /填.*?空|空.*?填|什么|哪.*?个|是.*?\?/.test(question);

  if (isCompact) {
    return (
      <div
        className={`px-3 py-2 rounded-lg border ${
          isFillInBlank
            ? "bg-gradient-to-r from-orange-100 to-red-100 border-orange-200"
            : "bg-gradient-to-r from-emerald-100 to-green-100 border-emerald-200"
        }`}
      >
        <div
          className={`font-medium text-xs mb-1 ${
            isFillInBlank ? "text-orange-800" : "text-emerald-800"
          }`}
        >
          {isFillInBlank ? "📝 填空题: " : "Q: "}
          {question}
        </div>
        <div
          className={`text-white px-2 py-1 rounded font-bold text-sm ${
            isFillInBlank
              ? "bg-gradient-to-r from-orange-500 to-red-500"
              : "bg-gradient-to-r from-emerald-500 to-green-500"
          }`}
        >
          {answer}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`p-4 border-l-4 rounded-r-lg shadow-sm ${
          isFillInBlank
            ? "bg-gradient-to-r from-orange-50 to-red-50 border-orange-500"
            : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500"
        }`}
      >
        <p
          className={`text-sm font-semibold mb-2 flex items-center ${
            isFillInBlank ? "text-orange-800" : "text-blue-800"
          }`}
        >
          {isFillInBlank ? (
            <>
              <span className="mr-2">📝</span>
              填空题
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              问题
            </>
          )}
        </p>
        <p className="text-gray-700 leading-relaxed text-base">{question}</p>
      </div>

      {/* 醒目的答案显示区域 */}
      <div
        className={`relative p-6 rounded-xl shadow-xl border-2 ${
          isFillInBlank
            ? "bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 border-orange-300"
            : "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 border-emerald-300"
        }`}
      >
        <div className="absolute inset-0 bg-white bg-opacity-10 rounded-xl"></div>
        <div className="relative z-10">
          <p className="text-sm font-bold text-white mb-3 flex items-center">
            {isFillInBlank ? (
              <>
                <span className="mr-2">📝</span>
                填空答案
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                答案
              </>
            )}
          </p>
          <div className="bg-white bg-opacity-95 p-4 rounded-lg shadow-inner">
            <p
              className={`text-gray-800 leading-relaxed font-bold text-center ${
                isFillInBlank
                  ? "text-2xl sm:text-3xl lg:text-4xl border-2 border-dashed border-orange-300 py-4 bg-orange-50"
                  : "text-xl sm:text-2xl lg:text-3xl"
              }`}
            >
              {answer}
            </p>
            {isFillInBlank && (
              <p className="text-xs text-orange-600 text-center mt-2">
                🎯 填空题答案
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionAnswerDisplay;

/**
 * 并发分析结果显示组件
 * 专门处理并发分析结果的显示逻辑
 */

import React from "react";

/**
 * 并发分析结果显示组件
 */
const ConcurrentAnalysisDisplay = ({ responseData, isCompact }) => {
  const { results, consistency } = responseData;

  const getConsistencyColorClass = (color) => {
    const colorClasses = {
      green: {
        bg: "bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600",
        border: "border-green-300",
        text: "text-white",
        badge: "bg-green-100 text-green-800 border-green-300",
      },
      yellow: {
        bg: "bg-gradient-to-br from-yellow-400 via-orange-500 to-amber-600",
        border: "border-yellow-300",
        text: "text-white",
        badge: "bg-yellow-100 text-yellow-800 border-yellow-300",
      },
      red: {
        bg: "bg-gradient-to-br from-red-400 via-pink-500 to-rose-600",
        border: "border-red-300",
        text: "text-white",
        badge: "bg-red-100 text-red-800 border-red-300",
      },
      gray: {
        bg: "bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600",
        border: "border-blue-300",
        text: "text-white",
        badge: "bg-blue-100 text-blue-800 border-blue-300",
      },
    };
    return colorClasses[color] || colorClasses.gray;
  };

  const colorClass = getConsistencyColorClass(consistency.color);

  if (isCompact) {
    return (
      <div className={`px-3 py-2 rounded-lg border-2 ${colorClass.badge}`}>
        <div className="text-xs font-bold mb-2 flex items-center">
          <span className="mr-1">🚀</span>
          并发分析 ({consistency.message})
        </div>
        <div className="space-y-1">
          {results.slice(0, 2).map((result) => (
            <div
              key={result.id}
              className="bg-white bg-opacity-50 px-2 py-1 rounded text-xs"
            >
              <div className="font-medium flex items-center justify-between">
                <span>分析 #{result.id}</span>
                {result.timeSpent && (
                  <span className="text-gray-600">⏱️{result.timeSpent}s</span>
                )}
              </div>
              {result.error ? (
                <div className="text-red-600 text-xs">❌ {result.error}</div>
              ) : (
                <div className="text-gray-700 text-xs">
                  <div className="font-medium text-green-800 mb-1">答案:</div>
                  <div className="font-semibold text-gray-900">
                    {result.result?.answer ||
                      (typeof result.result === "string"
                        ? result.result
                        : "无结果")}
                  </div>
                </div>
              )}
            </div>
          ))}
          {results.length > 2 && (
            <div className="text-xs text-gray-600 text-center">
              ... 还有 {results.length - 2} 个结果
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <FullConcurrentAnalysisDisplay
      results={results}
      consistency={consistency}
      colorClass={colorClass}
    />
  );
};

/**
 * 完整并发分析结果显示组件
 */
const FullConcurrentAnalysisDisplay = ({
  results,
  consistency,
  colorClass,
}) => {
  return (
    <div className="space-y-6">
      {/* 一致性总结卡片 */}
      <div
        className={`relative p-6 rounded-2xl border-3 shadow-2xl ${colorClass.bg} ${colorClass.border}`}
      >
        <div className="absolute inset-0 bg-white bg-opacity-20 rounded-2xl"></div>
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
            <h2
              className={`text-2xl lg:text-3xl font-bold ${colorClass.text} flex items-center mb-2 lg:mb-0`}
            >
              <span className="mr-3 text-3xl">
                {consistency.color === "green"
                  ? "✅"
                  : consistency.color === "yellow"
                  ? "⚠️"
                  : consistency.color === "gray"
                  ? "🔄"
                  : "❌"}
              </span>
              并发分析结果
            </h2>
            <div
              className={`px-4 py-2 ${colorClass.badge} rounded-full font-bold text-lg border-2`}
            >
              {consistency.message}
            </div>
          </div>

          <ConsistencyAnalysis consistency={consistency} />

          {/* 最佳答案显示 */}
          {(consistency.matches?.length > 0 ||
            consistency.type === "only_one_success") && (
            <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <h4 className="font-bold text-green-800 mb-2">
                {consistency.type === "only_one_success"
                  ? "🎯 分析答案"
                  : "🏆 最可能的答案"}
              </h4>
              <div className="text-xl font-bold text-green-900">
                {consistency.matches?.length > 0
                  ? consistency.matches[0].answer
                  : consistency.validResults?.[0]?.result?.answer ||
                    (typeof consistency.validResults?.[0]?.result === "string"
                      ? consistency.validResults[0].result
                      : "处理中...")}
              </div>
              {consistency.matches?.length > 0 ? (
                <p className="text-sm text-green-700 mt-1">
                  匹配度: {(consistency.matches[0].similarity * 100).toFixed(1)}
                  %
                </p>
              ) : (
                <p className="text-sm text-green-700 mt-1">
                  首个分析结果，其他分析进行中...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 详细结果展示 */}
      <DetailedResultsDisplay results={results} />
    </div>
  );
};

/**
 * 一致性分析组件
 */
const ConsistencyAnalysis = ({ consistency }) => {
  const getMessage = () => {
    switch (consistency.type) {
      case "all_consistent":
        return "3次分析结果完全一致，可信度极高！";
      case "two_consistent":
        return consistency.totalCount < 3
          ? `已有两次分析结果一致，等待其他确认...`
          : "有两次分析结果一致，可信度较高。";
      case "all_different":
        return "3次分析结果都不相同，建议重新分析。";
      case "all_failed":
        return consistency.totalCount < 3
          ? `已有${consistency.failedCount}次分析失败，其他任务进行中...`
          : "分析都失败了，请检查网络或API设置。";
      case "only_one_success":
        return consistency.totalCount < 3
          ? "🎉 首个分析完成！答案已显示，其他验证进行中..."
          : "只有一次分析成功，建议重新尝试。";
      case "waiting":
        return "正在启动题目解答，请稍候...";
      default:
        return consistency.totalCount < 3
          ? "分析进行中，请等待更多结果..."
          : "无法确定一致性，建议重新分析。";
    }
  };

  return (
    <div className="bg-white bg-opacity-95 p-6 rounded-xl">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 mb-2">🎯 一致性分析</h3>
        <p className="text-gray-700 leading-relaxed">{getMessage()}</p>
      </div>
    </div>
  );
};

/**
 * 详细结果展示组件
 */
const DetailedResultsDisplay = ({ results }) => {
  const concurrentCount = 3; // 假设默认值

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        📊 详细分析结果 ({results.length}/{concurrentCount})
      </h3>
      {results.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="animate-pulse text-gray-500">
            <div className="text-4xl mb-2">🚀</div>
            <div className="text-lg font-medium">题目解答启动中...</div>
            <div className="text-sm">验证同时进行，结果会立即显示</div>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            results.length === 1
              ? "grid-cols-1 max-w-md mx-auto"
              : results.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 lg:grid-cols-3"
          }`}
        >
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 结果卡片组件
 */
const ResultCard = ({ result }) => {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-2">
            {result.id}
          </span>
          <span className="font-medium">分析 #{result.id}</span>
        </div>
        {result.timeSpent && (
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            ⏱️ {result.timeSpent}s
          </span>
        )}
      </div>

      {result.error ? (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="text-red-800 font-medium flex items-center mb-1">
            <span className="mr-1">❌</span>
            分析失败
          </div>
          <div className="text-red-600 text-sm">{result.error}</div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <div className="text-gray-800 font-medium flex items-center mb-2">
            <span className="mr-1">✅</span>
            分析结果
          </div>
          <div className="text-gray-700 text-sm leading-relaxed">
            {result.result?.question && (
              <div className="mb-2">
                <div className="font-medium text-blue-800 text-xs mb-1">
                  问题:
                </div>
                <div className="text-gray-700 text-xs">
                  {result.result.question}
                </div>
              </div>
            )}
            <div className="font-medium text-green-800 text-xs mb-1">答案:</div>
            <div className="text-gray-900 font-semibold">
              {result.result?.answer ||
                (typeof result.result === "string"
                  ? result.result
                  : "无具体结果")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcurrentAnalysisDisplay;

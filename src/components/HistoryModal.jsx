import React from "react";

/**
 * 历史记录模态框组件
 * 负责显示用户的历史解答记录
 * @param {Object} props - 组件属性
 * @param {boolean} props.isOpen - 模态框是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Array} props.displayedHistory - 显示的历史记录
 * @param {Array} props.history - 完整历史记录
 * @param {Function} props.onLoadMore - 加载更多回调
 * @param {Function} props.parseAndHighlightAnswer - 答案解析函数
 * @param {string} props.userId - 用户ID
 */
const HistoryModal = ({
  isOpen,
  onClose,
  displayedHistory,
  history,
  onLoadMore,
  parseAndHighlightAnswer,
  userId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-x-hidden">
      <div className="bg-white rounded-xl shadow-xl p-4 sm:p-6 w-full max-h-[80vh] overflow-hidden flex flex-col mx-auto max-w-full sm:max-w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            历史记录 📸
          </h2>
          <button
            onClick={onClose}
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

        {userId && (
          <p className="text-xs sm:text-sm text-center text-gray-500 mb-4 break-all overflow-hidden">
            您的用户ID：
            <span className="font-mono text-xs block sm:inline break-all overflow-hidden">
              {userId}
            </span>
          </p>
        )}

        {history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-center text-gray-500 italic">暂无历史记录。</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="space-y-3">
              {displayedHistory.map((item, index) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  index={index}
                  parseAndHighlightAnswer={parseAndHighlightAnswer}
                />
              ))}

              {/* 加载更多按钮 */}
              {displayedHistory.length < history.length && (
                <div className="pt-4 text-center">
                  <button
                    onClick={onLoadMore}
                    className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-200 min-h-[44px]"
                  >
                    加载更多 ({history.length - displayedHistory.length} 条记录)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 历史记录项组件
 * @param {Object} props - 组件属性
 * @param {Object} props.item - 历史记录项
 * @param {number} props.index - 索引
 * @param {Function} props.parseAndHighlightAnswer - 答案解析函数
 */
const HistoryItem = ({ item, index, parseAndHighlightAnswer }) => {
  const handleImageClick = () => {
    // 创建模态框显示大图
    const modal = document.createElement("div");
    modal.className =
      "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]";
    modal.innerHTML = `
      <div class="relative max-w-3xl max-h-full">
        <img src="${item.processedImage}" class="max-w-full max-h-full rounded-lg" />
        <button class="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition-colors">
          ×
        </button>
      </div>
    `;
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.tagName === "BUTTON") {
        document.body.removeChild(modal);
      }
    });
    document.body.appendChild(modal);
  };

  return (
    <div className="flex gap-3 p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* 缩略图 */}
      <div className="flex-shrink-0">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-gray-200">
          <img
            src={item.processedImage}
            alt={`History Image ${index}`}
            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
            onClick={handleImageClick}
          />
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-1">
          {item.createdAt
            ? new Date(item.createdAt).toLocaleString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "处理中..."}
        </p>
        <div className="text-gray-600 text-xs sm:text-sm leading-relaxed">
          <p className="font-semibold text-gray-700 mb-1">AI 答案:</p>
          <div className="line-clamp-3 overflow-hidden break-all">
            {item.answer ? (
              parseAndHighlightAnswer(item.answer, true)
            ) : (
              <p className="text-gray-500 italic text-xs">无答案</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;

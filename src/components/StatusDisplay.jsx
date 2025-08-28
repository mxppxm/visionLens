import React from "react";

/**
 * 状态显示组件
 * 显示分析状态、倒计时和进度条
 * @param {Object} props - 组件属性
 * @param {string} props.status - 状态文本
 * @param {number|null} props.countdown - 倒计时秒数
 */
const StatusDisplay = ({ status, countdown }) => {
  return (
    <div className="text-center mt-2">
      <p className="text-sm text-gray-500">
        {status}
        {countdown !== null && (
          <span className="ml-2 inline-flex items-center">
            <span className="animate-pulse text-orange-600 font-bold">
              ⏰ {countdown}秒
            </span>
          </span>
        )}
      </p>
      {countdown !== null && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-orange-500 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${((8 - countdown) / 8) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;

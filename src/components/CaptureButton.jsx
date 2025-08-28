import React from "react";

/**
 * 拍照按钮组件
 * 处理拍照分析操作
 * @param {Object} props - 组件属性
 * @param {Function} props.onClick - 点击回调
 * @param {boolean} props.isLoading - 是否加载中
 * @param {boolean} props.hasVideoStream - 是否有视频流
 * @param {string} props.cameraStatus - 摄像头状态
 * @param {number} props.concurrentCount - 并发次数
 */
const CaptureButton = ({
  onClick,
  isLoading,
  hasVideoStream,
  cameraStatus,
  concurrentCount,
}) => {
  const isDisabled = isLoading || !hasVideoStream || cameraStatus !== "success";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`w-full px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base sm:text-lg text-white rounded-full transition-all duration-300 min-h-[48px] ${
        isDisabled
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-blue-600 hover:bg-blue-700 active:scale-95"
      }`}
    >
      {isLoading
        ? `正在解答题目 (${concurrentCount}次验证)...`
        : cameraStatus !== "success"
        ? "等待摄像头就绪..."
        : `📸 拍照解题 (${concurrentCount}次验证)`}
    </button>
  );
};

export default CaptureButton;

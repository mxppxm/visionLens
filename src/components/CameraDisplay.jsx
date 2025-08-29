import React from "react";

/**
 * 摄像头显示组件
 * 负责显示摄像头画面、状态指示器和错误信息
 * @param {Object} props - 组件属性
 * @param {React.RefObject} props.videoRef - 视频元素引用
 * @param {string} props.cameraStatus - 摄像头状态
 * @param {Object} props.cameraError - 错误信息
 * @param {number} props.retryCount - 重试次数
 * @param {number} props.maxRetryCount - 最大重试次数
 * @param {Function} props.onRetry - 重试回调
 * @param {Function} props.getEnvironmentInfo - 获取环境信息
 * @param {Function} props.onHealthCheck - 健康检查回调
 */
const CameraDisplay = ({
  videoRef,
  cameraStatus,
  cameraError,
  retryCount,
  maxRetryCount,
  onRetry,
  getEnvironmentInfo,
  onHealthCheck,
}) => {
  const environmentInfo = getEnvironmentInfo();

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden mb-4 sm:mb-6 border-2 sm:border-4 border-gray-200">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover transform scale-x-[-1]"
        style={{ display: cameraStatus === "success" ? "block" : "none" }}
      />

      {/* 摄像头状态覆盖层 */}
      {cameraStatus !== "success" && (
        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center p-4">
          {/* 加载状态 */}
          {(cameraStatus === "initializing" || cameraStatus === "retrying") && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 font-medium">
                {cameraStatus === "retrying"
                  ? `正在重试 (${retryCount}/${maxRetryCount})...`
                  : "正在初始化摄像头..."}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                首次使用需要允许摄像头权限
              </p>
            </div>
          )}

          {/* 失败状态 */}
          {cameraStatus === "failed" && cameraError && (
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {cameraError.title}
              </h3>

              <p className="text-gray-600 text-sm mb-4 whitespace-pre-line leading-relaxed">
                {cameraError.message}
              </p>

              {/* 重试按钮 */}
              {cameraError.showRetry && (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={onRetry}
                    disabled={cameraStatus === "retrying"}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                  >
                    {cameraStatus === "retrying" ? "重试中..." : "🔄 重试"}
                  </button>
                  {onHealthCheck && (
                    <button
                      onClick={onHealthCheck}
                      className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium text-sm"
                      title="检查摄像头状态"
                    >
                      🔍 检查
                    </button>
                  )}
                </div>
              )}

              {retryCount >= maxRetryCount && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    💡 如果问题持续，建议：
                    <br />
                    {environmentInfo.isWeChat ? (
                      <>
                        1. 点击右上角 「•••」→「在浏览器中打开」
                        <br />
                        2. 在浏览器中重新访问此页面
                        <br />
                        3. 允许浏览器访问摄像头权限
                      </>
                    ) : (
                      <>
                        1. 刷新页面重试
                        <br />
                        2. 检查浏览器摄像头权限设置
                        <br />
                        3. 确保使用HTTPS连接
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 摄像头状态指示器 */}
      {cameraStatus === "success" && (
        <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
          <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
          摄像头已就绪
        </div>
      )}

      {/* 环境提示 */}
      {cameraStatus === "success" && (
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {environmentInfo.isWeChat && (
            <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium">
              微信环境
            </div>
          )}
          {!environmentInfo.isHTTPS && !environmentInfo.isLocalhost && (
            <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
              非HTTPS
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CameraDisplay;

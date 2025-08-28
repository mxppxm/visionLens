/**
 * 摄像头管理自定义Hook
 * 将复杂的摄像头逻辑从组件中分离出来
 */

import { useState, useEffect, useRef } from "react";

/**
 * 摄像头管理Hook
 * @param {Object} options - 配置选项
 * @param {Function} options.onStreamReady - 摄像头就绪回调
 * @param {Function} options.onError - 错误回调
 * @param {Function} options.onStatusChange - 状态变化回调
 * @returns {Object} 摄像头管理相关状态和方法
 */
export const useCameraManager = ({ onStreamReady, onError, onStatusChange }) => {
    // 状态管理
    const [cameraStatus, setCameraStatus] = useState("initializing");
    const [cameraError, setCameraError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isManualRetry, setIsManualRetry] = useState(false);
    const [videoStream, setVideoStream] = useState(null);

    // Refs
    const videoRef = useRef(null);
    const isInitializingRef = useRef(false);
    const currentRetryRef = useRef(0);

    // 常量
    const MAX_RETRY_COUNT = 3;

    // 环境检测
    const getEnvironmentInfo = () => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isWeChat = /micromessenger/i.test(userAgent);
        const isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isHTTPS = location.protocol === "https:";
        const isLocalhost = location.hostname === "localhost" ||
            location.hostname === "127.0.0.1" ||
            location.hostname === "0.0.0.0";
        const supportsCameraAPI = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

        return {
            isWeChat,
            isMobile,
            isHTTPS,
            isLocalhost,
            supportsCameraAPI,
            canUseCamera: supportsCameraAPI && (isHTTPS || isLocalhost),
        };
    };

    // 摄像头配置策略
    const getCameraConstraints = () => {
        const { isMobile } = getEnvironmentInfo();

        const strategies = [
            // 策略1: 后置摄像头（移动端优先）
            ...(isMobile ? [{
                video: {
                    facingMode: "environment",
                    width: { ideal: 720 },
                    height: { ideal: 480 },
                },
            }] : []),
            // 策略2: 标准配置
            {
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            },
            // 策略3: 微信兼容配置
            {
                video: true,
            },
        ];

        return strategies;
    };

    // 摄像头初始化函数
    const setupCamera = async (strategyIndex = 0) => {
        const strategies = getCameraConstraints();

        if (strategyIndex >= strategies.length) {
            throw new Error("所有摄像头配置都尝试失败");
        }

        const constraint = strategies[strategyIndex];
        console.log(`📷 尝试摄像头配置 ${strategyIndex + 1}/${strategies.length}:`, constraint);

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraint);

            setVideoStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;

                return new Promise((resolve, reject) => {
                    const video = videoRef.current;
                    if (!video) {
                        reject(new Error("视频元素已被卸载"));
                        return;
                    }

                    let isResolved = false;
                    const timeout = setTimeout(() => {
                        if (!isResolved) {
                            cleanup();
                            reject(new Error("摄像头初始化超时，请检查摄像头权限并重试"));
                        }
                    }, 5000); // 减少超时时间到5秒

                    const cleanup = () => {
                        if (video) {
                            video.onloadedmetadata = null;
                            video.oncanplay = null;
                            video.onerror = null;
                        }
                        clearTimeout(timeout);
                    };

                    const handleLoadedMetadata = () => {
                        if (!isResolved) {
                            isResolved = true;
                            cleanup();
                            resolve(stream);
                        }
                    };

                    const handleError = (err) => {
                        if (!isResolved) {
                            isResolved = true;
                            console.error("❌ 视频元素错误:", err);
                            cleanup();
                            reject(new Error("视频显示失败"));
                        }
                    };

                    video.onloadedmetadata = handleLoadedMetadata;
                    video.onerror = handleError;

                    if (video.readyState >= 1) {
                        handleLoadedMetadata();
                    }
                });
            }

            return stream;
        } catch (error) {
            console.error(`❌ 配置 ${strategyIndex + 1} 失败:`, error);

            if (strategyIndex + 1 < strategies.length) {
                return setupCamera(strategyIndex + 1);
            } else {
                throw new Error("所有摄像头配置都尝试失败");
            }
        }
    };

    // 检查环境兼容性
    const checkEnvironmentCompatibility = () => {
        const env = getEnvironmentInfo();

        if (!env.supportsCameraAPI) {
            throw new Error("CAMERA_NOT_SUPPORTED");
        }

        if (!env.canUseCamera) {
            throw new Error("HTTPS_REQUIRED");
        }

        return env;
    };

    // 获取错误信息
    const getCameraErrorMessage = (error) => {
        const env = getEnvironmentInfo();

        if (error.message === "HTTPS_REQUIRED") {
            return {
                title: "需要 HTTPS 连接",
                message: env.isWeChat
                    ? "微信环境需要安全连接才能访问摄像头：\n1. 点击右上角 ••• \n2. 选择「在浏览器中打开」\n3. 确保网址以 https:// 开头"
                    : "摄像头API需要HTTPS连接或localhost环境才能工作",
                showRetry: false,
            };
        }

        if (error.message === "CAMERA_NOT_SUPPORTED") {
            return {
                title: "浏览器不支持摄像头",
                message: "您的浏览器不支持摄像头API，请更新浏览器或使用其他浏览器",
                showRetry: false,
            };
        }

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            return {
                title: "摄像头权限被拒绝",
                message: env.isWeChat
                    ? "微信中的摄像头权限被限制：\n\n📱 解决方案：\n1. 点击右上角 「•••」\n2. 选择 「在浏览器中打开」\n3. 在浏览器中允许摄像头权限"
                    : "请允许访问摄像头权限，然后点击重试",
                showRetry: true,
            };
        }

        if (error.name === "NotFoundError" || error.name === "DeviceNotFoundError") {
            return {
                title: "未找到摄像头设备",
                message: env.isWeChat
                    ? "微信环境无法访问摄像头：\n1. 确保设备有摄像头\n2. 在浏览器中打开此页面"
                    : "您的设备可能没有摄像头，或摄像头正在被其他应用使用",
                showRetry: true,
            };
        }

        return {
            title: "摄像头初始化失败",
            message: "请检查摄像头权限设置，或点击重试",
            showRetry: true,
        };
    };

    // 初始化摄像头主函数
    const initializeCamera = async (isRetry = false) => {
        if (isInitializingRef.current) return;

        isInitializingRef.current = true;

        try {
            checkEnvironmentCompatibility();

            const newStatus = isRetry ? "retrying" : "initializing";
            setCameraStatus(newStatus);
            setCameraError(null);
            onStatusChange?.(newStatus);

            // 停止现有流
            if (videoStream) {
                videoStream.getTracks().forEach((track) => track.stop());
                setVideoStream(null);
            }

            const stream = await setupCamera();

            if (!isInitializingRef.current) {
                if (stream) {
                    stream.getTracks().forEach((track) => track.stop());
                }
                return;
            }

            setCameraStatus("success");
            setRetryCount(0);
            currentRetryRef.current = 0;
            setIsManualRetry(false);
            onStreamReady?.(stream);
            onStatusChange?.("success");
        } catch (error) {
            console.error("❌ 摄像头初始化失败:", error);

            if (!isInitializingRef.current) return;

            setCameraStatus("failed");
            const errorMessage = getCameraErrorMessage(error);
            setCameraError(errorMessage);
            onError?.(errorMessage);

            // 自动重试逻辑
            if (!isManualRetry && currentRetryRef.current < MAX_RETRY_COUNT) {
                const nextRetryCount = currentRetryRef.current + 1;
                currentRetryRef.current = nextRetryCount;

                setTimeout(() => {
                    if (isInitializingRef.current) {
                        setRetryCount(nextRetryCount);
                        isInitializingRef.current = false;
                        initializeCamera(true);
                    }
                }, 2000);
            } else {
                currentRetryRef.current = 0;
            }
        } finally {
            if (cameraStatus === "success" ||
                currentRetryRef.current >= MAX_RETRY_COUNT ||
                isManualRetry) {
                isInitializingRef.current = false;
            }
        }
    };

    // 手动重试摄像头
    const handleRetryCamera = () => {
        if (videoStream) {
            videoStream.getTracks().forEach((track) => track.stop());
            setVideoStream(null);
        }

        setIsManualRetry(true);
        setRetryCount(0);
        setCameraStatus("initializing");
        setCameraError(null);

        setTimeout(() => {
            initializeCamera(true);
        }, 100);
    };

    // 组件挂载时初始化摄像头
    useEffect(() => {
        initializeCamera();

        return () => {
            isInitializingRef.current = false;
            currentRetryRef.current = 0;

            if (videoStream) {
                videoStream.getTracks().forEach((track) => track.stop());
            }

            if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.onloadedmetadata = null;
                videoRef.current.onerror = null;
            }
        };
    }, []);

    return {
        videoRef,
        cameraStatus,
        cameraError,
        retryCount,
        videoStream,
        handleRetryCamera,
        getEnvironmentInfo,
        MAX_RETRY_COUNT,
    };
};

import React, { useState, useEffect, useRef } from "react";
import { openDB } from "idb";

const App = () => {
  // 引用 DOM 元素
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 应用状态
  const [videoStream, setVideoStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [imageProcessingTime, setImageProcessingTime] = useState(null);
  const [totalApiTime, setTotalApiTime] = useState(null);
  const [status, setStatus] = useState("等待您的照片...");
  const [processedImage, setProcessedImage] = useState(null);
  const [history, setHistory] = useState([]);

  // 用户状态
  const [userId, setUserId] = useState(null);
  const [db, setDb] = useState(null);

  const startTimeRef = useRef(null);
  const imageProcessingStartRef = useRef(null);

  // ⚠️ 警告：请在这里输入你的 API Key。
  // ⚠️ 这仅用于本地测试，请勿部署到公共服务器！
  const API_KEY = "AIzaSyBwhKVxH1--4_93fhRuUmCEH5gR3b4cjUg";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

  // === IndexedDB 初始化 ===
  const initDB = async () => {
    try {
      const database = await openDB("VisionLensDB", 1, {
        upgrade(db) {
          // 创建历史记录存储
          if (!db.objectStoreNames.contains("history")) {
            const historyStore = db.createObjectStore("history", {
              keyPath: "id",
              autoIncrement: true,
            });
            historyStore.createIndex("createdAt", "createdAt", {
              unique: false,
            });
            historyStore.createIndex("userId", "userId", { unique: false });
          }
        },
      });
      setDb(database);
      return database;
    } catch (error) {
      console.error("IndexedDB 初始化失败:", error);
      return null;
    }
  };

  // === 初始化用户和数据库 ===
  useEffect(() => {
    const initializeApp = async () => {
      // 生成或获取用户ID
      let storedUserId = localStorage.getItem("visionLens_userId");
      if (!storedUserId) {
        storedUserId = crypto.randomUUID();
        localStorage.setItem("visionLens_userId", storedUserId);
      }
      setUserId(storedUserId);

      // 初始化数据库
      await initDB();
    };

    initializeApp();
  }, []);

  // === 加载历史记录 ===
  const loadHistory = async () => {
    if (!db || !userId) return;

    try {
      const tx = db.transaction("history", "readonly");
      const store = tx.objectStore("history");
      const userIndex = store.index("userId");
      const userHistory = await userIndex.getAll(userId);

      // 按创建时间降序排序
      userHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setHistory(userHistory);
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
  };

  // === 保存记录到 IndexedDB ===
  const saveToHistory = async (imageData, answer) => {
    if (!db || !userId) return;

    try {
      const record = {
        userId,
        processedImage: `data:image/jpeg;base64,${imageData}`,
        answer,
        createdAt: new Date().toISOString(),
      };

      const tx = db.transaction("history", "readwrite");
      const store = tx.objectStore("history");
      await store.add(record);
      await tx.complete;

      // 重新加载历史记录
      await loadHistory();
    } catch (error) {
      console.error("保存历史记录失败:", error);
    }
  };

  // === 监听数据库和用户ID变化，加载历史记录 ===
  useEffect(() => {
    if (db && userId) {
      loadHistory();
    }
  }, [db, userId]);

  // === 摄像头和拍照逻辑 ===
  useEffect(() => {
    const setupCamera = async () => {
      try {
        setStatus("正在初始化摄像头...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("已就绪，等待您的照片...");
      } catch (err) {
        console.error("无法访问摄像头: ", err);
        setErrorMessage("无法访问摄像头，请检查权限设置。");
        setStatus("初始化失败。");
      }
    };
    setupCamera();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // 图片预处理函数：包括灰度转换、尺寸和质量压缩
  const preprocessAndCompressImage = (video) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 设置最大宽度，按比例压缩
    const maxWidth = 800;
    const ratio = maxWidth / video.videoWidth;
    canvas.width = maxWidth;
    canvas.height = video.videoHeight * ratio;

    // 绘制图片
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 转换为灰度图
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
    }
    ctx.putImageData(imageData, 0, 0);

    // 以较低的JPEG质量（0.7）压缩并返回base64数据
    return canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
  };

  // 拍照并直接发送给 AI
  const handleCaptureAndAnalyze = async () => {
    if (!videoRef.current) {
      setErrorMessage("摄像头未就绪，请稍后重试。");
      return;
    }

    if (API_KEY === "YOUR_API_KEY" || !API_KEY) {
      setErrorMessage("请先在代码中替换 'YOUR_API_KEY' 为你的实际 API Key。");
      return;
    }

    setIsLoading(true);
    setAnswer(null);
    setImageProcessingTime(null);
    setTotalApiTime(null);
    setErrorMessage(null);
    setProcessedImage(null);

    const video = videoRef.current;

    imageProcessingStartRef.current = performance.now();
    const imageData = preprocessAndCompressImage(video);
    const imageProcessingEnd = performance.now();
    setImageProcessingTime(
      ((imageProcessingEnd - imageProcessingStartRef.current) / 1000).toFixed(2)
    );

    setProcessedImage(`data:image/jpeg;base64,${imageData}`);

    startTimeRef.current = performance.now();

    try {
      setStatus("正在向 AI 提交照片...");

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: "请根据图片内容回答百科问题，只返回问题和答案。" },
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

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
      }

      const data = await response.json();
      const responseText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || "未能获取答案。";
      setAnswer(responseText);

      const apiEnd = performance.now();
      setTotalApiTime(((apiEnd - startTimeRef.current) / 1000).toFixed(2));
      setStatus("完成！");

      // === 将记录保存到 IndexedDB ===
      await saveToHistory(imageData, responseText);
    } catch (error) {
      console.error("API call failed:", error);
      setErrorMessage("哎呀，出了点问题，请重试。");
      setStatus("出错了。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 font-sans">
      <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Vision Lens
        </h1>

        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-6 border-4 border-gray-200">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
          ></video>
          <canvas ref={canvasRef} className="hidden"></canvas>
        </div>

        <button
          onClick={handleCaptureAndAnalyze}
          disabled={isLoading || !videoStream}
          className={`w-full px-6 py-3 font-semibold text-lg text-white rounded-full transition-all duration-300 ${
            isLoading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95"
          }`}
        >
          {isLoading ? "正在分析..." : "拍照并获取答案"}
        </button>
        <p className="text-center text-sm text-gray-500 mt-2">{status}</p>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
          <h2 className="text-xl font-bold text-gray-700 mb-3">处理后的图片</h2>
          <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-6 border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
            {processedImage ? (
              <img
                src={processedImage}
                alt="Processed Image"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-sm">
                这里将显示处理后的图片。
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-700 mt-6 mb-3">AI 答案</h2>
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 inline-block"></div>
            </div>
          )}
          {errorMessage && (
            <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
          )}
          {!isLoading && !errorMessage && (
            <>
              {imageProcessingTime && (
                <p className="text-gray-500 text-sm mb-1">
                  图片处理耗时:{" "}
                  <span className="font-semibold text-blue-600">
                    {imageProcessingTime}
                  </span>{" "}
                  秒
                </p>
              )}
              {totalApiTime && (
                <p className="text-gray-500 text-sm mb-2">
                  AI总响应耗时 (包含网络):{" "}
                  <span className="font-semibold text-blue-600">
                    {totalApiTime}
                  </span>{" "}
                  秒
                </p>
              )}
              <p className="text-gray-600 leading-relaxed">
                {answer || "等待您的照片..."}
              </p>
            </>
          )}
        </div>
      </div>

      {/* 历史记录部分 */}
      <div className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          历史记录 📸
        </h2>
        {userId && (
          <p className="text-sm text-center text-gray-500 mb-4 break-words">
            您的用户ID：<span className="font-mono">{userId}</span>
          </p>
        )}

        {history.length === 0 ? (
          <p className="text-center text-gray-500 italic">暂无历史记录。</p>
        ) : (
          <div className="space-y-6">
            {history.map((item, index) => (
              <div
                key={item.id}
                className="p-4 bg-gray-50 rounded-lg shadow-sm"
              >
                <p className="text-xs text-gray-400 mb-2">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : "处理中..."}
                </p>
                <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden mb-3 border border-gray-200">
                  <img
                    src={item.processedImage}
                    alt={`History Image ${index}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-gray-600 text-sm leading-relaxed">
                  <span className="font-semibold text-gray-700">AI 答案:</span>{" "}
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

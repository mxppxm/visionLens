import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// vConsole 用于移动端调试
import VConsole from "vconsole";

// 在开发环境或移动端启用 vConsole
const isMobile =
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
const isDev = import.meta.env.DEV;

if (isDev || isMobile) {
  const vConsole = new VConsole({
    defaultPlugins: ["system", "network", "element", "storage"],
    theme: "light",
  });
  console.log("📱 vConsole 已启用，用于移动端调试");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

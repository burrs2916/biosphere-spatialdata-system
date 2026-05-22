import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { pluginLoader } from "./editor/plugins";

pluginLoader.initialize().then(() => {
  console.log("[Main] Plugin system initialized");
}).catch((err) => {
  console.error("[Main] Plugin system initialization failed:", err);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

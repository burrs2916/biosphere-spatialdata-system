/**
 * VideoPlayerRenderer — 视频播放器组件
 *
 * 支持 WebRTC 实时视频流播放，提供全屏和截图功能。
 * 对标 sprayv2 的视频监控模块。
 */

import { useState, useRef, useCallback, useEffect } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import type { ComponentRendererProps } from "../../../types/editor";
import { logger } from "../../../utils/logger";

export function VideoPlayerRenderer({ config }: ComponentRendererProps) {
  const videoUrl = (config.videoUrl as string) ?? "";
  const videoTitle = (config.videoTitle as string) ?? "视频监控";
  const autoPlay = (config.autoPlay as boolean) ?? true;
  const showControls = (config.showControls as boolean) ?? true;

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [hasError, setHasError] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  // 初始化视频流
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    // WebRTC 视频流（假设 URL 格式为 webrtc://xxx 或 http://xxx/stream）
    if (videoUrl.startsWith("webrtc://") || videoUrl.includes("webrtc")) {
      // TODO: 需要集成 WebRTC Streamer 库
      logger.warn("VideoPlayer", "WebRTC stream not fully implemented", { videoUrl });
      setHasError(true);
    } else {
      // 普通视频 URL（MP4, HLS, RTSP 转 HLS 等）
      videoRef.current.src = videoUrl;
      if (autoPlay) {
        videoRef.current.play().catch((err) => {
          logger.error("VideoPlayer", "Auto play failed", { error: err.message });
          setHasError(true);
        });
      }
    }
  }, [videoUrl, autoPlay]);

  // 全屏切换
  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        logger.error("VideoPlayer", "Fullscreen failed", { error: err.message });
        setSnackbar({ open: true, message: "全屏失败", severity: "error" });
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        logger.error("VideoPlayer", "Exit fullscreen failed", { error: err.message });
      });
    }
  }, [isFullscreen]);

  // 播放/暂停
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        logger.error("VideoPlayer", "Play failed", { error: err.message });
        setSnackbar({ open: true, message: "播放失败", severity: "error" });
      });
    }
  }, [isPlaying]);

  // 截图
  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");

    // 下载截图
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${videoTitle}_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.click();

    setSnackbar({ open: true, message: "截图已保存", severity: "success" });
    logger.info("VideoPlayer", "Screenshot captured", { videoTitle });
  }, [videoTitle]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar({ open: false, message: "", severity: "info" });
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      sx={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#000",
        borderRadius: 1,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 视频标题 */}
      <Box
        sx={{
          position: "absolute",
          top: 8,
          left: 12,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "4px 8px",
          borderRadius: 1,
          zIndex: 10,
        }}
      >
        {videoTitle}
      </Box>

      {/* 视频元素 */}
      {videoUrl ? (
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          muted
          playsInline
          onError={() => {
            setHasError(true);
            logger.error("VideoPlayer", "Video error", { videoUrl });
          }}
        />
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            gap: 1,
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 48 }} />
          <Box sx={{ fontSize: 14 }}>未配置视频源</Box>
        </Box>
      )}

      {/* 错误提示 */}
      {hasError && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ef4444",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          视频加载失败
        </Box>
      )}

      {/* 控制按钮 */}
      {showControls && videoUrl && !hasError && (
        <Box
          sx={{
            position: "absolute",
            bottom: 8,
            right: 12,
            display: "flex",
            gap: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "4px 8px",
            borderRadius: 1,
            zIndex: 10,
          }}
        >
          <Tooltip title={isPlaying ? "暂停" : "播放"} arrow>
            <IconButton size="small" onClick={handlePlayPause} sx={{ color: "#fff" }}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="截图" arrow>
            <IconButton size="small" onClick={handleCapture} sx={{ color: "#fff" }}>
              <PhotoCameraIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={isFullscreen ? "退出全屏" : "全屏"} arrow>
            <IconButton size="small" onClick={handleFullscreen} sx={{ color: "#fff" }}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
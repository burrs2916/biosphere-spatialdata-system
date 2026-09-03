/**
 * AI 助手抽屉 —— 导航栏 AI 图标开合的右侧面板（对话 / 运维角色 / 模型配置 三个 tab）。
 * 纯新增容器：不改动任何现有布局组件的内部逻辑。
 */
import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ModelConfigPage from "./ModelConfigPage";
import AgentManager from "./AgentManager";
import AgentChat from "./AgentChat";
import { useAgentStore } from "../store/agentStore";
import { requireConfigAccess } from "../../../utils/authGate";

export interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function AiAssistantDrawer({ open, onClose }: AiAssistantDrawerProps) {
  const [tab, setTab] = useState<"chat" | "role" | "config">("chat");
  // 系统日志页「AI 辅助整理」注入 seed 时，自动切回对话 tab，确保用户能看到 agent 的执行与回复
  const pendingSeedPrompt = useAgentStore((s) => s.pendingSeedPrompt);
  useEffect(() => {
    if (pendingSeedPrompt) setTab("chat");
  }, [pendingSeedPrompt]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: 600, maxWidth: "92vw", display: "flex", flexDirection: "column" },
        },
      }}
    >
      {/* 头部 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <SupportAgentRoundedIcon sx={{ fontSize: 20, color: "success.main" }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>AI 助手</Typography>
        <Typography sx={{ fontSize: 10, color: "text.secondary", ml: "auto" }}>
          喷雾降尘 · 实时数据查询
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => {
          const next = v as "chat" | "role" | "config";
          // 对话为使用项（免费），运维角色/模型配置为配置项（需登录）
          if (next === "role" || next === "config") {
            requireConfigAccess(() => setTab(next));
          } else {
            setTab(next);
          }
        }}
        variant="fullWidth"
        sx={{ minHeight: 34, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, "& .MuiTab-root": { minHeight: 34, fontSize: 12, minWidth: "auto", px: 1 } }}
      >
        <Tab value="chat" label="对话" icon={<ChatRoundedIcon sx={{ fontSize: 15 }} />} iconPosition="start" />
        <Tab value="role" label="运维角色" icon={<SupportAgentRoundedIcon sx={{ fontSize: 15 }} />} iconPosition="start" />
        <Tab value="config" label="模型配置" icon={<TuneRoundedIcon sx={{ fontSize: 15 }} />} iconPosition="start" />
      </Tabs>

      {/* 内容 */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ display: tab === "chat" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
          <AgentChat
            onOpenSettings={() => requireConfigAccess(() => setTab("config"))}
            onManageAgent={() => requireConfigAccess(() => setTab("role"))}
          />
        </Box>
        {tab === "role" && <AgentManager />}
        {tab === "config" && <ModelConfigPage />}
      </Box>
    </Drawer>
  );
}

import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import FolderIcon from "@mui/icons-material/Folder";
import CategoryIcon from "@mui/icons-material/Category";
import WidgetsIcon from "@mui/icons-material/Widgets";
import ExtensionIcon from "@mui/icons-material/Extension";
import SettingsIcon from "@mui/icons-material/Settings";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LayersIcon from "@mui/icons-material/Layers";
import GridOnIcon from "@mui/icons-material/GridOn";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import StarIcon from "@mui/icons-material/Star";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BarChartIcon from "@mui/icons-material/BarChart";
import InsertChartIcon from "@mui/icons-material/InsertChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TimelineIcon from "@mui/icons-material/Timeline";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import WaterfallChartIcon from "@mui/icons-material/WaterfallChart";
import TableChartIcon from "@mui/icons-material/TableChart";
import SpeedIcon from "@mui/icons-material/Speed";
import MapIcon from "@mui/icons-material/Map";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import WallpaperIcon from "@mui/icons-material/Wallpaper";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import PublicIcon from "@mui/icons-material/Public";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import VideocamIcon from "@mui/icons-material/Videocam";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PaletteIcon from "@mui/icons-material/Palette";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TimerIcon from "@mui/icons-material/Timer";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import { resolveIcon } from "../../editor/plugins";
import { iconsApi } from "../../services/tauri";
import type { IconGroup, SystemIcon } from "../../services/tauri";
import { CustomIconTabs } from "./CustomIconTabs";

export const ICON_CATEGORIES: Array<{
  label: string;
  items: Array<{ key: string; label: string; Icon: React.ComponentType<any> }>;
}> = [
  {
    label: "通用",
    items: [
      { key: "folder", label: "文件夹", Icon: FolderIcon },
      { key: "category", label: "分类", Icon: CategoryIcon },
      { key: "widgets", label: "组件", Icon: WidgetsIcon },
      { key: "extension", label: "扩展", Icon: ExtensionIcon },
      { key: "settings", label: "设置", Icon: SettingsIcon },
      { key: "dashboard", label: "仪表盘", Icon: DashboardIcon },
      { key: "layers", label: "图层", Icon: LayersIcon },
      { key: "grid_on", label: "网格", Icon: GridOnIcon },
      { key: "search", label: "搜索", Icon: SearchIcon },
      { key: "add", label: "添加", Icon: AddIcon },
      { key: "edit", label: "编辑", Icon: EditIcon },
      { key: "delete", label: "删除", Icon: DeleteIcon },
      { key: "refresh", label: "刷新", Icon: RefreshIcon },
      { key: "check", label: "确认", Icon: CheckIcon },
      { key: "check_circle", label: "完成", Icon: CheckCircleIcon },
      { key: "info", label: "信息", Icon: InfoIcon },
      { key: "warning", label: "警告", Icon: WarningIcon },
      { key: "error", label: "错误", Icon: ErrorIcon },
      { key: "help", label: "帮助", Icon: HelpIcon },
      { key: "star", label: "收藏", Icon: StarIcon },
      { key: "visibility", label: "可见", Icon: VisibilityIcon },
      { key: "close", label: "关闭", Icon: CloseIcon },
      { key: "arrow_back", label: "后退", Icon: ArrowBackIcon },
      { key: "arrow_forward", label: "前进", Icon: ArrowForwardIcon },
    ],
  },
  {
    label: "数据可视化",
    items: [
      { key: "bar_chart", label: "柱状图", Icon: BarChartIcon },
      { key: "insert_chart", label: "插入图表", Icon: InsertChartIcon },
      { key: "pie_chart", label: "饼图", Icon: PieChartIcon },
      { key: "show_chart", label: "折线图", Icon: ShowChartIcon },
      { key: "timeline", label: "时间线", Icon: TimelineIcon },
      { key: "bubble_chart", label: "气泡图", Icon: BubbleChartIcon },
      { key: "scatter_plot", label: "散点图", Icon: ScatterPlotIcon },
      { key: "donut_large", label: "环形图", Icon: DonutLargeIcon },
      { key: "stacked_bar_chart", label: "堆叠图", Icon: StackedBarChartIcon },
      { key: "waterfall_chart", label: "瀑布图", Icon: WaterfallChartIcon },
      { key: "table_chart", label: "表格", Icon: TableChartIcon },
      { key: "speed", label: "仪表", Icon: SpeedIcon },
    ],
  },
  {
    label: "地图与空间",
    items: [
      { key: "map", label: "地图", Icon: MapIcon },
      { key: "architecture", label: "CAD图纸", Icon: ArchitectureIcon },
      { key: "wallpaper", label: "蓝图", Icon: WallpaperIcon },
      { key: "public", label: "地球", Icon: PublicIcon },
      { key: "whatshot", label: "热力图", Icon: WhatshotIcon },
      { key: "layers", label: "图层", Icon: LayersIcon },
      { key: "view_in_ar", label: "3D视图", Icon: ViewInArIcon },
    ],
  },
  {
    label: "媒体与内容",
    items: [
      { key: "text_fields", label: "文本", Icon: TextFieldsIcon },
      { key: "image", label: "图片", Icon: ImageIcon },
      { key: "crop_square", label: "形状", Icon: CropSquareIcon },
      { key: "videocam", label: "视频", Icon: VideocamIcon },
      { key: "music_note", label: "音乐", Icon: MusicNoteIcon },
      { key: "palette", label: "调色板", Icon: PaletteIcon },
      { key: "auto_awesome", label: "特效", Icon: AutoAwesomeIcon },
      { key: "timer", label: "计时器", Icon: TimerIcon },
    ],
  },
  {
    label: "文件与传输",
    items: [
      { key: "upload", label: "上传", Icon: UploadIcon },
      { key: "download", label: "下载", Icon: DownloadIcon },
    ],
  },
];

const EMOJI_CATEGORIES: Array<{ label: string; items: string[] }> = [
  { label: "身份认证", items: ["🔑", "🚪", "🔄", "✅", "👤", "🛡️", "🔒", "🔓", "🔐", "🔏", "📜", "🪪", "🗝️"] },
  { label: "系统工具", items: ["⚙️", "🔧", "📊", "📈", "📉", "📋", "📁", "📂", "🗂️", "📅", "📆", "⏰", "⏱️", "🔔", "📢", "📣"] },
  { label: "通信信息", items: ["📧", "💬", "📱", "💻", "🌐", "📡", "🔔", "📌", "📮", "✉️", "💌", "📨", "📤", "📥", "📫", "📪"] },
  { label: "商务机构", items: ["🏢", "🏬", "🏦", "🏪", "🏭", "🏛️", "🏠", "🏗️", "🏘️", "🏨", "🏫", "🏬", "🏭"] },
  { label: "目标用户", items: ["🎯", "👥", "👤", "👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🔬", "👩‍🔬", "👨‍🏫", "👩‍🏫", "👨‍⚕️", "👩‍⚕️", "👨‍🚀"] },
  { label: "自然物品", items: ["🌟", "⭐", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌪️", "🌫️", "🌬️", "🌀", "🌈"] },
  { label: "手势动作", items: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲"] },
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [mainTab, setMainTab] = useState(1);
  const [materialTab, setMaterialTab] = useState(0);
  const [emojiTab, setEmojiTab] = useState(0);

  const [groups, setGroups] = useState<IconGroup[]>([]);
  const [icons, setIcons] = useState<SystemIcon[]>([]);
  const [iconFileUrls, setIconFileUrls] = useState<Record<string, string>>({});
  const [iconsLoading, setIconsLoading] = useState(false);

  useEffect(() => {
    if (mainTab === 2 && groups.length === 0 && !iconsLoading) {
      setIconsLoading(true);
      Promise.all([iconsApi.getAllGroups(), iconsApi.getAllIcons(), iconsApi.getIconFileUrls()])
        .then(([g, i, u]) => {
          setGroups(g);
          setIcons(i);
          setIconFileUrls(u);
        })
        .catch(() => {})
        .finally(() => setIconsLoading(false));
    }
  }, [mainTab, groups.length, iconsLoading]);

  const getDisplayName = () => {
    if (value.startsWith("emoji-")) {
      const parts = value.split("-");
      const catIdx = parseInt(parts[1], 10);
      const itemIdx = parseInt(parts[2], 10);
      const emoji = EMOJI_CATEGORIES[catIdx]?.items[itemIdx];
      return emoji || "Emoji 图标";
    }
    if (value.startsWith("custom-")) {
      const icon = icons.find((i) => i.id === value.replace("custom-", ""));
      return icon?.name || "自定义图标";
    }
    const found = ICON_CATEGORIES.flatMap((c) => c.items).find((i) => i.key === value);
    return found?.label || value;
  };

  const renderPreview = () => {
    if (value.startsWith("emoji-")) {
      const parts = value.split("-");
      const catIdx = parseInt(parts[1], 10);
      const itemIdx = parseInt(parts[2], 10);
      const emoji = EMOJI_CATEGORIES[catIdx]?.items[itemIdx];
      return emoji ? (
        <Typography sx={{ fontSize: 18 }}>{emoji}</Typography>
      ) : null;
    }
    if (value.startsWith("custom-")) {
      const iconId = value.replace("custom-", "");
      const url = iconFileUrls[iconId];
      return url ? (
        <img src={url} alt="" style={{ maxWidth: 18, maxHeight: 18 }} />
      ) : (
        <FolderIcon sx={{ fontSize: 18 }} />
      );
    }
    return resolveIcon(value, "folder", 18);
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ fontSize: 10, color: "text.secondary", mb: 0.5, display: "block" }}>
        图标
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 0.75,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          mb: 1,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            borderRadius: 0.5,
            color: "text.secondary",
          }}
        >
          {renderPreview()}
        </Box>
        <Typography variant="caption" sx={{ fontSize: 11, flex: 1 }}>
          {getDisplayName()}
        </Typography>
      </Box>

      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 28,
          mb: 0.5,
          "& .MuiTab-root": { minHeight: 28, py: 0, fontSize: 10, minWidth: "auto", px: 1 },
        }}
      >
        <Tab label="😀 Emoji" />
        <Tab label="🎨 Material" />
        <Tab label="📁 自定义" />
      </Tabs>

      {mainTab === 0 && (
        <>
          <Tabs
            value={emojiTab}
            onChange={(_, v) => setEmojiTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 24, mb: 0.5, "& .MuiTab-root": { minHeight: 24, py: 0, fontSize: 9, minWidth: "auto", px: 0.8 } }}
          >
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <Tab key={idx} label={cat.label} />
            ))}
          </Tabs>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 0.5,
              maxHeight: 150,
              overflow: "auto",
              "&::-webkit-scrollbar": { width: 3 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
            }}
          >
            {EMOJI_CATEGORIES[emojiTab]?.items.map((emoji, idx) => {
              const iconKey = `emoji-${emojiTab}-${idx}`;
              const isSelected = value === iconKey;
              return (
                <Paper
                  key={idx}
                  onClick={() => onChange(iconKey)}
                  sx={{
                    p: 0.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 0.75,
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: isSelected ? "primary.main" : "divider",
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    transition: "all 0.1s",
                    "&:hover": {
                      bgcolor: "action.hover",
                      borderColor: "primary.main",
                      transform: "scale(1.1)",
                    },
                  }}
                >
                  <Typography sx={{ fontSize: "1.1rem" }}>{emoji}</Typography>
                </Paper>
              );
            })}
          </Box>
        </>
      )}

      {mainTab === 1 && (
        <>
          <Tabs
            value={materialTab}
            onChange={(_, v) => setMaterialTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 24, mb: 0.5, "& .MuiTab-root": { minHeight: 24, py: 0, fontSize: 9, minWidth: "auto", px: 0.8 } }}
          >
            {ICON_CATEGORIES.map((cat, idx) => (
              <Tab key={idx} label={cat.label} />
            ))}
          </Tabs>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 0.5,
              maxHeight: 150,
              overflow: "auto",
              "&::-webkit-scrollbar": { width: 3 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 2 },
            }}
          >
            {ICON_CATEGORIES[materialTab]?.items.map((item) => (
              <Paper
                key={item.key}
                onClick={() => onChange(item.key)}
                sx={{
                  p: 0.5,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.25,
                  borderRadius: 0.75,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: value === item.key ? "primary.main" : "divider",
                  bgcolor: value === item.key ? "action.selected" : "transparent",
                  transition: "all 0.1s",
                  "&:hover": {
                    bgcolor: "action.hover",
                    borderColor: "primary.main",
                    transform: "scale(1.08)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: value === item.key ? "primary.main" : "text.secondary",
                  }}
                >
                  <item.Icon sx={{ fontSize: 18 }} />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 7,
                    textAlign: "center",
                    lineHeight: 1,
                    color: value === item.key ? "primary.main" : "text.disabled",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {item.label}
                </Typography>
              </Paper>
            ))}
          </Box>
        </>
      )}

      {mainTab === 2 && (
        <Box sx={{ maxHeight: 250, overflow: "auto", "&::-webkit-scrollbar": { width: 3 }, "&::-webkit-scrollbar-thumb": { borderRadius: 2 } }}>
          {iconsLoading ? (
            <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center", display: "block" }}>
              加载中...
            </Typography>
          ) : (
            <CustomIconTabs
              groups={groups}
              icons={icons}
              iconFileUrls={iconFileUrls}
              onSelectIcon={(iconId) => onChange(`custom-${iconId}`)}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

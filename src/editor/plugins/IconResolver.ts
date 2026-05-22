import React from "react";
import Box from "@mui/material/Box";
import SvgIcon from "@mui/material/SvgIcon";

import PaletteIcon from "@mui/icons-material/Palette";
import BarChartIcon from "@mui/icons-material/BarChart";
import PublicIcon from "@mui/icons-material/Public";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import WidgetsIcon from "@mui/icons-material/Widgets";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ImageIcon from "@mui/icons-material/Image";
import CropSquareIcon from "@mui/icons-material/CropSquare";
import SpeedIcon from "@mui/icons-material/Speed";
import MapIcon from "@mui/icons-material/Map";
import VideocamIcon from "@mui/icons-material/Videocam";
import CategoryIcon from "@mui/icons-material/Category";
import ExtensionIcon from "@mui/icons-material/Extension";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import TableChartIcon from "@mui/icons-material/TableChart";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TimerIcon from "@mui/icons-material/Timer";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import LayersIcon from "@mui/icons-material/Layers";
import GridOnIcon from "@mui/icons-material/GridOn";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import UploadIcon from "@mui/icons-material/Upload";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import StarIcon from "@mui/icons-material/Star";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import HelpIcon from "@mui/icons-material/Help";
import FolderIcon from "@mui/icons-material/Folder";
import InsertChartIcon from "@mui/icons-material/InsertChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TimelineIcon from "@mui/icons-material/Timeline";
import BubbleChartIcon from "@mui/icons-material/BubbleChart";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import StackedBarChartIcon from "@mui/icons-material/StackedBarChart";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WaterfallChartIcon from "@mui/icons-material/WaterfallChart";
import ArchitectureIcon from "@mui/icons-material/Architecture";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import WallpaperIcon from "@mui/icons-material/Wallpaper";

const LIGATURE_MAP: Record<string, React.ComponentType<any>> = {
  palette: PaletteIcon,
  bar_chart: BarChartIcon,
  public: PublicIcon,
  video_library: VideoLibraryIcon,
  auto_awesome: AutoAwesomeIcon,
  widgets: WidgetsIcon,
  text_fields: TextFieldsIcon,
  image: ImageIcon,
  crop_square: CropSquareIcon,
  speed: SpeedIcon,
  map: MapIcon,
  videocam: VideocamIcon,
  category: CategoryIcon,
  extension: ExtensionIcon,
  music_note: MusicNoteIcon,
  table_chart: TableChartIcon,
  dashboard: DashboardIcon,
  timer: TimerIcon,
  view_in_ar: ViewInArIcon,
  layers: LayersIcon,
  grid_on: GridOnIcon,
  settings: SettingsIcon,
  add: AddIcon,
  search: SearchIcon,
  delete: DeleteIcon,
  edit: EditIcon,
  visibility: VisibilityIcon,
  upload: UploadIcon,
  download: DownloadIcon,
  refresh: RefreshIcon,
  close: CloseIcon,
  check: CheckIcon,
  arrow_back: ArrowBackIcon,
  arrow_forward: ArrowForwardIcon,
  star: StarIcon,
  info: InfoIcon,
  warning: WarningIcon,
  error: ErrorIcon,
  help: HelpIcon,
  folder: FolderIcon,
  insert_chart: InsertChartIcon,
  pie_chart: PieChartIcon,
  show_chart: ShowChartIcon,
  timeline: TimelineIcon,
  bubble_chart: BubbleChartIcon,
  scatter_plot: ScatterPlotIcon,
  donut_large: DonutLargeIcon,
  stacked_bar_chart: StackedBarChartIcon,
  waterfall_chart: WaterfallChartIcon,
  check_circle: CheckCircleIcon,
  architecture: ArchitectureIcon,
  whatshot: WhatshotIcon,
  wallpaper: WallpaperIcon,
};

export type IconType = "material" | "svg" | "url";

export interface IconDescriptor {
  type: IconType;
  value: string;
  color?: string;
  fontSize?: number;
}

const iconCache = new Map<string, React.ReactElement>();

function parseIconString(iconStr: string): IconDescriptor {
  if (iconStr.startsWith("data:") || iconStr.startsWith("http://") || iconStr.startsWith("https://")) {
    return { type: "url", value: iconStr };
  }
  if (iconStr.startsWith("<svg") || iconStr.startsWith("<?xml")) {
    return { type: "svg", value: iconStr };
  }
  return { type: "material", value: iconStr };
}

export function resolveIcon(
  icon: string | IconDescriptor | undefined,
  fallback: string = "widgets",
  fontSize: number = 16
): React.ReactElement {
  if (!icon) {
    return renderMaterialIcon(fallback, fontSize);
  }

  const descriptor: IconDescriptor = typeof icon === "string" ? parseIconString(icon) : icon;
  const cacheKey = `${descriptor.type}:${descriptor.value}:${fontSize}`;

  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  let element: React.ReactElement;

  switch (descriptor.type) {
    case "material":
      element = renderMaterialIcon(descriptor.value, fontSize);
      break;
    case "svg":
      element = renderSvgIcon(descriptor.value, fontSize, descriptor.color);
      break;
    case "url":
      element = renderUrlIcon(descriptor.value, fontSize);
      break;
    default:
      element = renderMaterialIcon(fallback, fontSize);
  }

  iconCache.set(cacheKey, element);
  return element;
}

function renderMaterialIcon(name: string, fontSize: number): React.ReactElement {
  const Component = LIGATURE_MAP[name];
  if (Component) {
    return React.createElement(Component, {
      sx: { fontSize, lineHeight: 1 },
    });
  }
  return React.createElement(SvgIcon, {
    sx: { fontSize, lineHeight: 1 },
    children: name,
  });
}

function renderSvgIcon(svgString: string, fontSize: number, color?: string): React.ReactElement {
  return React.createElement(Box, {
    sx: {
      width: fontSize,
      height: fontSize,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      "& svg": {
        width: "100%",
        height: "100%",
        fill: color || "currentColor",
      },
    },
    dangerouslySetInnerHTML: { __html: svgString },
  });
}

function renderUrlIcon(url: string, fontSize: number): React.ReactElement {
  return React.createElement("img", {
    src: url,
    alt: "icon",
    style: {
      width: fontSize,
      height: fontSize,
      objectFit: "contain",
    },
  });
}

export function registerIcon(_name: string, descriptor: IconDescriptor): void {
  iconCache.delete(`${descriptor.type}:${descriptor.value}:16`);
  iconCache.delete(`${descriptor.type}:${descriptor.value}:20`);
  iconCache.delete(`${descriptor.type}:${descriptor.value}:24`);
}

export function clearIconCache(): void {
  iconCache.clear();
}

import * as React from "react";
import Box from "@mui/material/Box";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import CloseIcon from "@mui/icons-material/Close";
import PaletteIcon from "@mui/icons-material/Palette";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import LinkIcon from "@mui/icons-material/Link";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import DescriptionIcon from "@mui/icons-material/Description";
import ArticleIcon from "@mui/icons-material/Article";
import BookIcon from "@mui/icons-material/Book";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import StarIcon from "@mui/icons-material/Star";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import NotificationsIcon from "@mui/icons-material/Notifications";
import InfoIcon from "@mui/icons-material/Info";
import HelpIcon from "@mui/icons-material/Help";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import ReportIcon from "@mui/icons-material/Report";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CancelIcon from "@mui/icons-material/Cancel";
import ClearIcon from "@mui/icons-material/Clear";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import MenuOpenIcon from "@mui/icons-material/Menu";
import DomainIcon from "@mui/icons-material/Domain";
import ListIcon from "@mui/icons-material/List";
import GridViewIcon from "@mui/icons-material/GridView";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import LaunchIcon from "@mui/icons-material/Launch";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import LockIcon from "@mui/icons-material/Lock";
import SecurityIcon from "@mui/icons-material/Security";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import BlockIcon from "@mui/icons-material/Block";
import EmailIcon from "@mui/icons-material/Email";
import MailIcon from "@mui/icons-material/Mail";
import InboxIcon from "@mui/icons-material/Inbox";
import OutboxIcon from "@mui/icons-material/Outbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import ChatIcon from "@mui/icons-material/Chat";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import ForumIcon from "@mui/icons-material/Forum";
import AnnouncementIcon from "@mui/icons-material/Announcement";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import StorageIcon from "@mui/icons-material/Storage";
import BackupIcon from "@mui/icons-material/Backup";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import SyncIcon from "@mui/icons-material/Sync";
import UpdateIcon from "@mui/icons-material/Update";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import StopIcon from "@mui/icons-material/Stop";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import ImageIcon from "@mui/icons-material/Image";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import ComputerIcon from "@mui/icons-material/Computer";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import TabletIcon from "@mui/icons-material/Tablet";
import TvIcon from "@mui/icons-material/Tv";
import WatchIcon from "@mui/icons-material/Watch";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import MouseIcon from "@mui/icons-material/Mouse";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import CameraIcon from "@mui/icons-material/Camera";
import PhoneIcon from "@mui/icons-material/Phone";
import WifiIcon from "@mui/icons-material/Wifi";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EventIcon from "@mui/icons-material/Event";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import WorkIcon from "@mui/icons-material/Work";
import BusinessIcon from "@mui/icons-material/Business";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import BuildIcon from "@mui/icons-material/Build";
import SettingsIcon from "@mui/icons-material/Settings";
import CodeIcon from "@mui/icons-material/Code";
import TerminalIcon from "@mui/icons-material/Terminal";
import AddIcon from "@mui/icons-material/Add";
import { useAuthStore } from "../../store/authStore";
import { useIconStore } from "../../store/iconStore";
import { useShallow } from "zustand/react/shallow";
import type { ApiEndpoint, MenuIcon } from "../../services/tauri";
import { iconsApi } from "../../services/tauri";

const MATERIAL_ICON_MAP: Record<string, React.ReactElement> = {
  Home: <HomeIcon />,
  Search: <SearchIcon />,
  Add: <AddIcon />,
  Edit: <EditIcon />,
  Delete: <DeleteIcon />,
  Save: <SaveRoundedIcon />,
  Refresh: <RefreshIcon />,
  Print: <PrintIcon />,
  Share: <ShareIcon />,
  ContentCopy: <ContentCopyIcon />,
  ContentCut: <ContentCutIcon />,
  ContentPaste: <ContentPasteIcon />,
  Undo: <UndoIcon />,
  Redo: <RedoIcon />,
  Link: <LinkIcon />,
  NoteAdd: <NoteAddIcon />,
  Description: <DescriptionIcon />,
  Article: <ArticleIcon />,
  Book: <BookIcon />,
  LibraryBooks: <LibraryBooksIcon />,
  Star: <StarIcon />,
  Favorite: <FavoriteIcon />,
  Bookmark: <BookmarkIcon />,
  ThumbUp: <ThumbUpIcon />,
  ThumbDown: <ThumbDownIcon />,
  Check: <CheckIcon />,
  CheckCircle: <CheckCircleIcon />,
  Done: <DoneIcon />,
  DoneAll: <DoneAllIcon />,
  Notifications: <NotificationsIcon />,
  Info: <InfoIcon />,
  Help: <HelpIcon />,
  Warning: <WarningIcon />,
  Error: <ErrorIcon />,
  Report: <ReportIcon />,
  ReportProblem: <ReportProblemIcon />,
  Cancel: <CancelIcon />,
  Clear: <ClearIcon />,
  Close: <CloseIcon />,
  HighlightOff: <HighlightOffIcon />,
  Menu: <MenuOpenIcon />,
  Dashboard: <DomainIcon />,
  List: <ListIcon />,
  Grid: <GridViewIcon />,
  OpenInNew: <OpenInNewIcon />,
  OpenInBrowser: <OpenInBrowserIcon />,
  Launch: <LaunchIcon />,
  Person: <PersonIcon />,
  People: <PeopleIcon />,
  Account: <ManageAccountsIcon />,
  Lock: <LockIcon />,
  Security: <SecurityIcon />,
  Verified: <VerifiedUserIcon />,
  VpnKey: <VpnKeyIcon />,
  DoNotDisturb: <DoNotDisturbIcon />,
  Block: <BlockIcon />,
  Email: <EmailIcon />,
  Mail: <MailIcon />,
  Inbox: <InboxIcon />,
  Outbox: <OutboxIcon />,
  Send: <SendIcon />,
  Drafts: <DraftsIcon />,
  Chat: <ChatIcon />,
  ChatBubble: <ChatBubbleIcon />,
  Forum: <ForumIcon />,
  Announcement: <AnnouncementIcon />,
  Folder: <FolderIcon />,
  File: <InsertDriveFileIcon />,
  Upload: <CloudUploadIcon />,
  Download: <CloudDownloadIcon />,
  Storage: <StorageIcon />,
  Backup: <BackupIcon />,
  Cloud: <CloudIcon />,
  CloudQueue: <CloudQueueIcon />,
  CloudDone: <CloudDoneIcon />,
  Sync: <SyncIcon />,
  Update: <UpdateIcon />,
  PlayCircle: <PlayCircleIcon />,
  PauseCircle: <PauseCircleIcon />,
  Stop: <StopIcon />,
  SkipNext: <SkipNextIcon />,
  SkipPrevious: <SkipPreviousIcon />,
  VolumeUp: <VolumeUpIcon />,
  VolumeDown: <VolumeDownIcon />,
  VolumeOff: <VolumeOffIcon />,
  MusicNote: <MusicNoteIcon />,
  VideoLibrary: <VideoLibraryIcon />,
  Image: <ImageIcon />,
  PhotoLibrary: <PhotoLibraryIcon />,
  Computer: <ComputerIcon />,
  Smartphone: <SmartphoneIcon />,
  Tablet: <TabletIcon />,
  Tv: <TvIcon />,
  Watch: <WatchIcon />,
  Headphones: <HeadphonesIcon />,
  Mouse: <MouseIcon />,
  Keyboard: <KeyboardIcon />,
  Camera: <CameraIcon />,
  Phone: <PhoneIcon />,
  Wifi: <WifiIcon />,
  Bluetooth: <BluetoothIcon />,
  Schedule: <ScheduleIcon />,
  Event: <EventIcon />,
  LocationOn: <LocationOnIcon />,
  Work: <WorkIcon />,
  Business: <BusinessIcon />,
  Palette: <PaletteIcon />,
  DarkMode: <DarkModeIcon />,
  LightMode: <LightModeIcon />,
  Brightness6: <Brightness6Icon />,
  Build: <BuildIcon />,
  Settings: <SettingsIcon />,
  Code: <CodeIcon />,
  Terminal: <TerminalIcon />,
};

const MENU_ICON_MAP: Record<MenuIcon, React.ReactElement> = {
  login: <LoginRoundedIcon />,
  logout: <LogoutRoundedIcon />,
  refresh: <RefreshRoundedIcon />,
  verify: <VerifiedUserRoundedIcon />,
  userInfo: <PersonRoundedIcon />,
  settings: <SettingsRoundedIcon />,
  key: <VpnKeyRoundedIcon />,
  shield: <ShieldRoundedIcon />,
};

const EMOJI_GROUPS = [
  { label: "身份认证", emojis: ["🔑", "🚪", "🔄", "✅", "👤", "🛡️", "🔒", "🔓", "🔐", "🔏", "📜", "🪪", "🗝️", "🔑", "🛡️"] },
  { label: "系统工具", emojis: ["⚙️", "🔧", "📊", "📈", "📉", "📋", "📁", "📂", "🗂️", "📅", "📆", "⏰", "⏱️", "🔔", "📢", "📣"] },
  { label: "通信信息", emojis: ["📧", "💬", "📱", "💻", "🌐", "📡", "🔔", "📌", "📮", "✉️", "💌", "📨", "📤", "📥", "📫", "📪"] },
  { label: "商务机构", emojis: ["🏢", "🏬", "🏦", "🏪", "🏭", "🏛️", "🏠", "🏗️", "🏘️", "🏚️", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭"] },
  { label: "目标用户", emojis: ["🎯", "👥", "👤", "👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🔬", "👩‍🔬", "👨‍🏫", "👩‍🏫", "👨‍⚕️", "👩‍⚕️", "👨‍🚀"] },
  { label: "表情符号", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩"] },
  { label: "手势动作", emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲"] },
  { label: "自然物品", emojis: ["🌟", "⭐", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌪️", "🌫️", "🌬️", "🌀", "🌈"] },
];

const PRESET_ICON_NAMES: Record<string, string> = {
  login: "登录",
  logout: "注销",
  refresh: "刷新",
  verify: "验证",
  userInfo: "用户信息",
  settings: "设置",
  key: "密钥",
  shield: "安全",
};

export default function OptionsMenu() {
  const [loading, setLoading] = React.useState(false);
  const [iconFileUrls, setIconFileUrls] = React.useState<Record<string, string>>({});
  const [notification, setNotification] = React.useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const endpoints = useAuthStore(useShallow((state) => state.webhook.endpoints));
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAuthenticated = !!currentUser;
  console.log("[OptionsMenu] isAuthenticated:", isAuthenticated, "currentUser:", currentUser);
  const performLogin = useAuthStore((state) => state.performLogin);
  const performLogout = useAuthStore((state) => state.performLogout);
  const executeEndpoint = useAuthStore((state) => state.executeEndpoint);
  const icons = useIconStore((state) => state.icons);
  const fetchAllIcons = useIconStore((state) => state.fetchAllIcons);
  const fetchAllGroups = useIconStore((state) => state.fetchAllGroups);

  React.useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchAllIcons(), fetchAllGroups()]);
      try {
        const urls = await iconsApi.getIconFileUrls();
        setIconFileUrls(urls);
      } catch {
        setIconFileUrls({});
      }
    };
    loadData();
  }, []);

  const getMenuIcon = (iconId: string | undefined) => {
    if (!iconId) {
      return <LoginRoundedIcon />;
    }

    if (PRESET_ICON_NAMES[iconId]) {
      return MENU_ICON_MAP[iconId];
    }

    if (iconId.startsWith("emoji-")) {
      const parts = iconId.split("-");
      const groupIndex = parseInt(parts[1], 10);
      const emojiIndex = parseInt(parts[2], 10);
      const emoji = EMOJI_GROUPS[groupIndex]?.emojis[emojiIndex];
      return <span style={{ fontSize: "1.25rem" }}>{emoji || "❓"}</span>;
    }

    if (iconId.startsWith("material-")) {
      const iconName = iconId.replace("material-", "");
      return MATERIAL_ICON_MAP[iconName] || <SettingsRoundedIcon />;
    }

    const icon = icons.find((i) => i.id === iconId);
    if (icon && iconFileUrls[iconId]) {
      return <img src={iconFileUrls[iconId]} alt={icon.name} style={{ width: "1.25rem", height: "1.25rem" }} />;
    }

    return <PaletteIcon />;
  };

  const menuEndpoints = endpoints.filter((e) => e.bindToMenu);
  
  // 调试信息 - 已注释
  // console.log("[OptionsMenu] 所有端点:", endpoints);
  // console.log("[OptionsMenu] 绑定到菜单的端点:", menuEndpoints);
  // console.log("[OptionsMenu] 是否已认证:", isAuthenticated);
  
  // 找到登录端点：通过 endpointType === "login" 来判断
  const loginEndpoint = menuEndpoints.find((e) => e.endpointType === "login") || 
                       menuEndpoints.find((e) => e.endpointType !== "logout");
  
  // 找到注销端点：通过 endpointType === "logout" 来判断
  const logoutEndpoint = menuEndpoints.find((e) => e.endpointType === "logout");
  
  // 其他功能端点：排除登录和注销端点，通过 endpointType 判断
  const otherEndpoints = menuEndpoints.filter((e) => {
    if (e.endpointType === "logout") {
      return false;
    }
    if (e.endpointType === "refresh") {
      return false;
    }
    const isLogin = (e.endpointType === "login") || (loginEndpoint && e.id === loginEndpoint.id);
    if (isLogin) {
      return false;
    }
    return true;
  });
  
  // console.log("[OptionsMenu] loginEndpoint:", loginEndpoint);
  // console.log("[OptionsMenu] logoutEndpoint:", logoutEndpoint);
  // console.log("[OptionsMenu] 其他功能端点:", otherEndpoints);

  const handleEndpointAction = async (endpoint: ApiEndpoint) => {
    setLoading(true);
    try {
      if (endpoint.endpointType === "logout") {
        await performLogout();
      } else if (!isAuthenticated) {
        // 未登录时所有非注销端点点击都执行登录
        await performLogin();
      } else {
        // 已登录时执行对应端点
        await executeEndpoint(endpoint);
      }
    } catch (error) {
      if (endpoint.endpointType === "logout") {
        setNotification({
          message: `登出失败: ${error instanceof Error ? error.message : "未知错误"}`,
          severity: "error",
        });
      } else if (!isAuthenticated) {
        setNotification({
          message: `登录失败: ${error instanceof Error ? error.message : "未知错误"}`,
          severity: "error",
        });
      } else {
        setNotification({
          message: `${endpoint.name}执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
          severity: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    // 未登录时显示登录按钮，绝对不会显示注销按钮
    ...(!isAuthenticated && loginEndpoint
      ? [{
          icon: getMenuIcon(loginEndpoint.menuIcon),
          name: loginEndpoint.name,
          endpoint: loginEndpoint,
        }]
      : []),
    // 已登录时只显示注销按钮，未登录状态下绝对不显示
    ...(isAuthenticated && logoutEndpoint
      ? [{
          icon: getMenuIcon(logoutEndpoint.menuIcon),
          name: logoutEndpoint.name,
          endpoint: logoutEndpoint,
        }]
      : []),
    // 始终显示其他功能按钮
    ...otherEndpoints.map((endpoint) => ({
      icon: getMenuIcon(endpoint.menuIcon),
      name: endpoint.name,
      endpoint,
    }))
  ];

  // console.log("[OptionsMenu] 最终 actions 数组:", actions);
  
  if (menuEndpoints.length === 0) {
    return null;
  }

  return (
    <Box sx={{ position: "relative", width: 40, height: 40 }}>
      <SpeedDial
        ariaLabel="用户操作菜单"
        direction="up"
        icon={
          <SpeedDialIcon
            icon={<AddRoundedIcon />}
            openIcon={<CloseIcon />}
          />
        }
        FabProps={{
          size: "small",
          disabled: loading,
          sx: {
            width: 36,
            height: 36,
            boxShadow: 2,
            "&:hover": {
              boxShadow: 4,
            },
          },
        }}
        sx={{
          position: "absolute",
          bottom: 0,
          right: 0,
          "& .MuiSpeedDial-actions": {
            paddingBottom: 8,
          },
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            slotProps={{
              tooltip: {
                title: action.name,
                placement: "left",
              },
              fab: {
                sx: {
                  width: 40,
                  height: 40,
                  boxShadow: 2,
                  "&:hover": {
                    boxShadow: 4,
                  },
                },
              },
            }}
            onClick={() => handleEndpointAction(action.endpoint)}
          />
        ))}
      </SpeedDial>

      <Snackbar
        open={notification !== null}
        autoHideDuration={3000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setNotification(null)}
          severity={notification?.severity || "success"}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification?.message || ""}
        </Alert>
      </Snackbar>
    </Box>
  );
}

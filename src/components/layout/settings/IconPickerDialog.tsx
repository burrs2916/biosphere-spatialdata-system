import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import AddIcon from "@mui/icons-material/Add";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import SecurityIcon from "@mui/icons-material/Security";
import DomainIcon from "@mui/icons-material/Domain";
import SettingsIcon from "@mui/icons-material/Settings";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MenuOpenIcon from "@mui/icons-material/Menu";
import ListIcon from "@mui/icons-material/List";
import GridViewIcon from "@mui/icons-material/GridView";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import LockIcon from "@mui/icons-material/Lock";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import EmailIcon from "@mui/icons-material/Email";
import ChatIcon from "@mui/icons-material/Chat";
import NotificationsIcon from "@mui/icons-material/Notifications";
import InfoIcon from "@mui/icons-material/Info";
import HelpIcon from "@mui/icons-material/Help";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import StorageIcon from "@mui/icons-material/Storage";
import BackupIcon from "@mui/icons-material/Backup";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import PrintIcon from "@mui/icons-material/Print";
import ShareIcon from "@mui/icons-material/Share";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import ScheduleIcon from "@mui/icons-material/Schedule";
import EventIcon from "@mui/icons-material/Event";
import BookIcon from "@mui/icons-material/Book";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import DescriptionIcon from "@mui/icons-material/Description";
import ArticleIcon from "@mui/icons-material/Article";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import StarIcon from "@mui/icons-material/Star";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import WorkIcon from "@mui/icons-material/Work";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import PhoneIcon from "@mui/icons-material/Phone";
import CameraIcon from "@mui/icons-material/Camera";
import ImageIcon from "@mui/icons-material/Image";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import VideoLibraryIcon from "@mui/icons-material/VideoLibrary";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";
import StopIcon from "@mui/icons-material/Stop";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PaletteIcon from "@mui/icons-material/Palette";
import BuildIcon from "@mui/icons-material/Build";
import CodeIcon from "@mui/icons-material/Code";
import TerminalIcon from "@mui/icons-material/Terminal";
import ComputerIcon from "@mui/icons-material/Computer";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import TabletIcon from "@mui/icons-material/Tablet";
import TvIcon from "@mui/icons-material/Tv";
import WatchIcon from "@mui/icons-material/Watch";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import MouseIcon from "@mui/icons-material/Mouse";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import WifiIcon from "@mui/icons-material/Wifi";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import SyncIcon from "@mui/icons-material/Sync";
import UpdateIcon from "@mui/icons-material/Update";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import LaunchIcon from "@mui/icons-material/Launch";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import ForumIcon from "@mui/icons-material/Forum";
import AnnouncementIcon from "@mui/icons-material/Announcement";
import MailIcon from "@mui/icons-material/Mail";
import OutboxIcon from "@mui/icons-material/Outbox";
import InboxIcon from "@mui/icons-material/Inbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import ReportIcon from "@mui/icons-material/Report";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import CancelIcon from "@mui/icons-material/Cancel";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import DoNotDisturbIcon from "@mui/icons-material/DoNotDisturb";
import BlockIcon from "@mui/icons-material/Block";
import ClearIcon from "@mui/icons-material/Clear";
import CloseIcon from "@mui/icons-material/Close";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CheckIcon from "@mui/icons-material/Check";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import type { IconGroup, SystemIcon } from "../../../services/tauri";
import { CustomIconTabs } from "../../component/CustomIconTabs";

// --- Exported constants and helpers ---

export const EMOJI_GROUPS = [
  { label: "身份认证", emojis: ["🔑", "🚪", "🔄", "✅", "👤", "🛡️", "🔒", "🔓", "🔐", "🔏", "📜", "🪪", "🗝️", "🔑", "🛡️"] },
  { label: "系统工具", emojis: ["⚙️", "🔧", "📊", "📈", "📉", "📋", "📁", "📂", "🗂️", "📅", "📆", "⏰", "⏱️", "🔔", "📢", "📣"] },
  { label: "通信信息", emojis: ["📧", "💬", "📱", "💻", "🌐", "📡", "🔔", "📌", "📮", "✉️", "💌", "📨", "📤", "📥", "📫", "📪"] },
  { label: "商务机构", emojis: ["🏢", "🏬", "🏦", "🏪", "🏭", "🏛️", "🏠", "🏗️", "🏘️", "🏚️", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭"] },
  { label: "目标用户", emojis: ["🎯", "👥", "👤", "👨‍💼", "👩‍💼", "👨‍💻", "👩‍💻", "👨‍🎨", "👩‍🎨", "👨‍🔬", "👩‍🔬", "👨‍🏫", "👩‍🏫", "👨‍⚕️", "👩‍⚕️", "👨‍🚀"] },
  { label: "表情符号", emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩"] },
  { label: "手势动作", emojis: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲"] },
  { label: "自然物品", emojis: ["🌟", "⭐", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌪️", "🌫️", "🌬️", "🌀", "🌈"] },
];

export const PRESET_ICON_NAMES: Record<string, string> = {
  login: "登录",
  logout: "注销",
  refresh: "刷新",
  verify: "验证",
  userInfo: "用户信息",
  settings: "设置",
  key: "密钥",
  shield: "安全",
};

const MATERIAL_ICON_COMPONENTS: Record<string, React.ComponentType<{ sx?: any }>> = {
  Home: HomeIcon,
  Search: SearchIcon,
  Add: AddIcon,
  Edit: EditIcon,
  Delete: (props) => <ClearIcon {...props} />, // placeholder, will be replaced below
  Save: SaveRoundedIcon,
  Refresh: RefreshIcon,
  Print: PrintIcon,
  Share: ShareIcon,
  ContentCopy: ContentCopyIcon,
  ContentCut: ContentCutIcon,
  ContentPaste: ContentPasteIcon,
  Undo: UndoIcon,
  Redo: RedoIcon,
  Link: LinkIcon,
  NoteAdd: NoteAddIcon,
  Description: DescriptionIcon,
  Article: ArticleIcon,
  Book: BookIcon,
  LibraryBooks: LibraryBooksIcon,
  Star: StarIcon,
  Favorite: FavoriteIcon,
  Bookmark: BookmarkIcon,
  ThumbUp: ThumbUpIcon,
  ThumbDown: ThumbDownIcon,
  Check: CheckIcon,
  CheckCircle: CheckCircleIcon,
  Done: DoneIcon,
  DoneAll: DoneAllIcon,
  Notifications: NotificationsIcon,
  Info: InfoIcon,
  Help: HelpIcon,
  Warning: WarningIcon,
  Error: ErrorIcon,
  Report: ReportIcon,
  ReportProblem: ReportProblemIcon,
  Cancel: CancelIcon,
  Clear: ClearIcon,
  Close: CloseIcon,
  HighlightOff: HighlightOffIcon,
  Menu: MenuOpenIcon,
  Dashboard: DomainIcon,
  List: ListIcon,
  Grid: GridViewIcon,
  OpenInNew: OpenInNewIcon,
  OpenInBrowser: OpenInBrowserIcon,
  Launch: LaunchIcon,
  Person: PersonIcon,
  People: PeopleIcon,
  Account: ManageAccountsIcon,
  Lock: LockIcon,
  Security: SecurityIcon,
  Verified: VerifiedUserIcon,
  VpnKey: VpnKeyIcon,
  DoNotDisturb: DoNotDisturbIcon,
  Block: BlockIcon,
  Email: EmailIcon,
  Mail: MailIcon,
  Inbox: InboxIcon,
  Outbox: OutboxIcon,
  Send: SendIcon,
  Drafts: DraftsIcon,
  Chat: ChatIcon,
  ChatBubble: ChatBubbleIcon,
  Forum: ForumIcon,
  Announcement: AnnouncementIcon,
  Folder: FolderIcon,
  File: InsertDriveFileIcon,
  Upload: CloudUploadIcon,
  Download: CloudDownloadIcon,
  Storage: StorageIcon,
  Backup: BackupIcon,
  Cloud: CloudIcon,
  CloudQueue: CloudQueueIcon,
  CloudDone: CloudDoneIcon,
  Sync: SyncIcon,
  Update: UpdateIcon,
  PlayCircle: PlayCircleIcon,
  PauseCircle: PauseCircleIcon,
  Stop: StopIcon,
  SkipNext: SkipNextIcon,
  SkipPrevious: SkipPreviousIcon,
  VolumeUp: VolumeUpIcon,
  VolumeDown: VolumeDownIcon,
  VolumeOff: VolumeOffIcon,
  MusicNote: MusicNoteIcon,
  VideoLibrary: VideoLibraryIcon,
  Image: ImageIcon,
  PhotoLibrary: PhotoLibraryIcon,
  Computer: ComputerIcon,
  Smartphone: SmartphoneIcon,
  Tablet: TabletIcon,
  Tv: TvIcon,
  Watch: WatchIcon,
  Headphones: HeadphonesIcon,
  Mouse: MouseIcon,
  Keyboard: KeyboardIcon,
  Camera: CameraIcon,
  Phone: PhoneIcon,
  Wifi: WifiIcon,
  Bluetooth: BluetoothIcon,
  Schedule: ScheduleIcon,
  Event: EventIcon,
  LocationOn: LocationOnIcon,
  Work: WorkIcon,
  Business: BusinessIcon,
  Palette: PaletteIcon,
  DarkMode: DarkModeIcon,
  LightMode: LightModeIcon,
  Brightness6: Brightness6Icon,
  Build: BuildIcon,
  Settings: SettingsIcon,
  Code: CodeIcon,
  Terminal: TerminalIcon,
};

// Fix Delete mapping to use actual Delete icon (was placeholder above)
import DeleteIcon from "@mui/icons-material/Delete";
(MATERIAL_ICON_COMPONENTS as any).Delete = DeleteIcon;

export function renderMenuIcon(
  iconId: string,
  icons: SystemIcon[],
  iconFileUrls: Record<string, string>,
  fontSize: number = 18
): React.ReactNode {
  const sx = { fontSize };

  if (PRESET_ICON_NAMES[iconId]) {
    return <VpnKeyIcon sx={sx} />;
  }
  if (iconId.startsWith("emoji-")) {
    const parts = iconId.split("-");
    const groupIndex = parseInt(parts[1], 10);
    const emojiIndex = parseInt(parts[2], 10);
    const emoji = EMOJI_GROUPS[groupIndex]?.emojis[emojiIndex];
    return <span style={{ fontSize }}>{emoji || "❓"}</span>;
  }
  if (iconId.startsWith("material-")) {
    const iconName = iconId.replace("material-", "");
    const IconComp = MATERIAL_ICON_COMPONENTS[iconName];
    return IconComp ? <IconComp sx={sx} /> : <SettingsIcon sx={sx} />;
  }
  const icon = icons.find((i) => i.id === iconId);
  if (icon && iconFileUrls[iconId]) {
    return <img src={iconFileUrls[iconId]} alt={icon.name} style={{ width: fontSize, height: fontSize }} />;
  }
  return <PaletteIcon sx={sx} />;
}

// --- IconCategoryTabs generic helper ---

interface IconCategoryTabsProps<T> {
  categories: Array<{ label: string; items: T[] }>;
  onSelect: (catIndex: number, itemIndex: number) => void;
  renderItem: (item: T) => React.ReactNode;
  showItemName?: boolean;
}

export function IconCategoryTabs<T>({ categories, onSelect, renderItem, showItemName }: IconCategoryTabsProps<T>) {
  const [tabIndex, setTabIndex] = React.useState(0);

  return (
    <Box>
      <Tabs
        value={tabIndex}
        onChange={(_, newValue) => setTabIndex(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        {categories.map((cat, index) => (
          <Tab key={index} label={cat.label} />
        ))}
      </Tabs>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 1.5,
        }}
      >
        {categories[tabIndex]?.items.map((item, _index) => (
          <Paper
            key={_index}
            sx={{
              p: 1.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              borderRadius: 2,
              cursor: "pointer",
              border: "1px solid",
              borderColor: "divider",
              "&:hover": {
                bgcolor: "action.hover",
                borderColor: "primary.main",
                transform: "scale(1.05)",
                transition: "transform 0.1s",
              },
            }}
            onClick={() => onSelect(tabIndex, _index)}
          >
            {item && renderItem(item)}
            {showItemName && typeof item === "object" && item && "name" in item && (
              <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                {(item as any).name}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

// --- MATERIAL_ICONS_CATEGORIES for the picker dialog ---

const MATERIAL_ICONS_CATEGORIES = [
  {
    label: "常用操作",
    items: [
      { name: "Home", Icon: HomeIcon },
      { name: "Search", Icon: SearchIcon },
      { name: "Add", Icon: AddIcon },
      { name: "Edit", Icon: EditIcon },
      { name: "Delete", Icon: DeleteIcon },
      { name: "Save", Icon: SaveRoundedIcon },
      { name: "Refresh", Icon: RefreshIcon },
      { name: "Print", Icon: PrintIcon },
      { name: "Share", Icon: ShareIcon },
    ],
  },
  {
    label: "内容编辑",
    items: [
      { name: "ContentCopy", Icon: ContentCopyIcon },
      { name: "ContentCut", Icon: ContentCutIcon },
      { name: "ContentPaste", Icon: ContentPasteIcon },
      { name: "Undo", Icon: UndoIcon },
      { name: "Redo", Icon: RedoIcon },
      { name: "Link", Icon: LinkIcon },
      { name: "NoteAdd", Icon: NoteAddIcon },
      { name: "Description", Icon: DescriptionIcon },
      { name: "Article", Icon: ArticleIcon },
      { name: "Book", Icon: BookIcon },
      { name: "LibraryBooks", Icon: LibraryBooksIcon },
    ],
  },
  {
    label: "收藏与标记",
    items: [
      { name: "Star", Icon: StarIcon },
      { name: "Favorite", Icon: FavoriteIcon },
      { name: "Bookmark", Icon: BookmarkIcon },
      { name: "ThumbUp", Icon: ThumbUpIcon },
      { name: "ThumbDown", Icon: ThumbDownIcon },
      { name: "Check", Icon: CheckIcon },
      { name: "CheckCircle", Icon: CheckCircleIcon },
      { name: "Done", Icon: DoneIcon },
      { name: "DoneAll", Icon: DoneAllIcon },
    ],
  },
  {
    label: "通知与状态",
    items: [
      { name: "Notifications", Icon: NotificationsIcon },
      { name: "Info", Icon: InfoIcon },
      { name: "Help", Icon: HelpIcon },
      { name: "Warning", Icon: WarningIcon },
      { name: "Error", Icon: ErrorIcon },
      { name: "Report", Icon: ReportIcon },
      { name: "ReportProblem", Icon: ReportProblemIcon },
      { name: "Cancel", Icon: CancelIcon },
      { name: "Clear", Icon: ClearIcon },
      { name: "Close", Icon: CloseIcon },
      { name: "HighlightOff", Icon: HighlightOffIcon },
    ],
  },
  {
    label: "系统导航",
    items: [
      { name: "Menu", Icon: MenuOpenIcon },
      { name: "Home", Icon: HomeIcon },
      { name: "Settings", Icon: SettingsIcon },
      { name: "Dashboard", Icon: DomainIcon },
      { name: "List", Icon: ListIcon },
      { name: "Grid", Icon: GridViewIcon },
      { name: "OpenInNew", Icon: OpenInNewIcon },
      { name: "OpenInBrowser", Icon: OpenInBrowserIcon },
      { name: "Launch", Icon: LaunchIcon },
    ],
  },
  {
    label: "用户账户",
    items: [
      { name: "Person", Icon: PersonIcon },
      { name: "People", Icon: PeopleIcon },
      { name: "Account", Icon: ManageAccountsIcon },
      { name: "Lock", Icon: LockIcon },
      { name: "Security", Icon: SecurityIcon },
      { name: "Verified", Icon: VerifiedUserIcon },
      { name: "VpnKey", Icon: VpnKeyIcon },
      { name: "DoNotDisturb", Icon: DoNotDisturbIcon },
      { name: "Block", Icon: BlockIcon },
    ],
  },
  {
    label: "通信内容",
    items: [
      { name: "Email", Icon: EmailIcon },
      { name: "Mail", Icon: MailIcon },
      { name: "Inbox", Icon: InboxIcon },
      { name: "Outbox", Icon: OutboxIcon },
      { name: "Send", Icon: SendIcon },
      { name: "Drafts", Icon: DraftsIcon },
      { name: "Chat", Icon: ChatIcon },
      { name: "ChatBubble", Icon: ChatBubbleIcon },
      { name: "Forum", Icon: ForumIcon },
      { name: "Announcement", Icon: AnnouncementIcon },
    ],
  },
  {
    label: "文件数据",
    items: [
      { name: "Folder", Icon: FolderIcon },
      { name: "File", Icon: InsertDriveFileIcon },
      { name: "Upload", Icon: CloudUploadIcon },
      { name: "Download", Icon: CloudDownloadIcon },
      { name: "Storage", Icon: StorageIcon },
      { name: "Backup", Icon: BackupIcon },
      { name: "Cloud", Icon: CloudIcon },
      { name: "CloudQueue", Icon: CloudQueueIcon },
      { name: "CloudDone", Icon: CloudDoneIcon },
      { name: "Sync", Icon: SyncIcon },
      { name: "Update", Icon: UpdateIcon },
    ],
  },
  {
    label: "媒体娱乐",
    items: [
      { name: "PlayCircle", Icon: PlayCircleIcon },
      { name: "PauseCircle", Icon: PauseCircleIcon },
      { name: "Stop", Icon: StopIcon },
      { name: "SkipNext", Icon: SkipNextIcon },
      { name: "SkipPrevious", Icon: SkipPreviousIcon },
      { name: "VolumeUp", Icon: VolumeUpIcon },
      { name: "VolumeDown", Icon: VolumeDownIcon },
      { name: "VolumeOff", Icon: VolumeOffIcon },
      { name: "MusicNote", Icon: MusicNoteIcon },
      { name: "VideoLibrary", Icon: VideoLibraryIcon },
      { name: "Image", Icon: ImageIcon },
      { name: "PhotoLibrary", Icon: PhotoLibraryIcon },
    ],
  },
  {
    label: "设备硬件",
    items: [
      { name: "Computer", Icon: ComputerIcon },
      { name: "Smartphone", Icon: SmartphoneIcon },
      { name: "Tablet", Icon: TabletIcon },
      { name: "Tv", Icon: TvIcon },
      { name: "Watch", Icon: WatchIcon },
      { name: "Headphones", Icon: HeadphonesIcon },
      { name: "Mouse", Icon: MouseIcon },
      { name: "Keyboard", Icon: KeyboardIcon },
      { name: "Camera", Icon: CameraIcon },
      { name: "Phone", Icon: PhoneIcon },
      { name: "Wifi", Icon: WifiIcon },
      { name: "Bluetooth", Icon: BluetoothIcon },
    ],
  },
  {
    label: "时间地点",
    items: [
      { name: "Schedule", Icon: ScheduleIcon },
      { name: "Event", Icon: EventIcon },
      { name: "LocationOn", Icon: LocationOnIcon },
      { name: "Work", Icon: WorkIcon },
      { name: "Business", Icon: BusinessIcon },
    ],
  },
  {
    label: "外观设置",
    items: [
      { name: "Palette", Icon: PaletteIcon },
      { name: "DarkMode", Icon: DarkModeIcon },
      { name: "LightMode", Icon: LightModeIcon },
      { name: "Brightness6", Icon: Brightness6Icon },
      { name: "Build", Icon: BuildIcon },
      { name: "Settings", Icon: SettingsIcon },
      { name: "Code", Icon: CodeIcon },
      { name: "Terminal", Icon: TerminalIcon },
    ],
  },
];

// --- IconPickerDialog ---

interface IconPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  groups: IconGroup[];
  icons: SystemIcon[];
  iconFileUrls: Record<string, string>;
}

export default function IconPickerDialog({ open, onClose, onSelectIcon, groups, icons, iconFileUrls }: IconPickerDialogProps) {
  const [tab, setTab] = React.useState(0);

  const handleClose = () => {
    setTab(0);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="menu-icon-select-dialog-title"
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle id="menu-icon-select-dialog-title">
        选择菜单图标
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "75vh" }}>
        <Tabs
          value={tab}
          onChange={(_: React.SyntheticEvent, newValue: number) => setTab(newValue)}
          sx={{ mb: 2 }}
          variant="fullWidth"
        >
          <Tab label="😀 Emoji 图标" />
          <Tab label="🎨 Material Icons" />
          <Tab label="📁 自定义图标" />
        </Tabs>

        <Box sx={{ mt: 1 }}>
          {tab === 0 && (
            <IconCategoryTabs
              categories={EMOJI_GROUPS.map((g) => ({ label: g.label, items: g.emojis }))}
              onSelect={(catIndex, itemIndex) => {
                onSelectIcon(`emoji-${catIndex}-${itemIndex}`);
                handleClose();
              }}
              renderItem={(emoji) => (
                <Typography variant="h4" sx={{ fontSize: "2.2rem" }}>
                  {emoji}
                </Typography>
              )}
            />
          )}

          {tab === 1 && (
            <IconCategoryTabs
              categories={MATERIAL_ICONS_CATEGORIES}
              onSelect={(catIndex, itemIndex) => {
                const item = MATERIAL_ICONS_CATEGORIES[catIndex]?.items[itemIndex];
                if (item) {
                  onSelectIcon(`material-${item.name}`);
                  handleClose();
                }
              }}
              renderItem={(item) => (
                <item.Icon sx={{ fontSize: 36 }} />
              )}
              showItemName
            />
          )}

          {tab === 2 && (
            <CustomIconTabs
              groups={groups}
              icons={icons}
              iconFileUrls={iconFileUrls}
              onSelectIcon={(iconId) => {
                onSelectIcon(iconId);
                handleClose();
              }}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          取消
        </Button>
      </DialogActions>
    </Dialog>
  );
}

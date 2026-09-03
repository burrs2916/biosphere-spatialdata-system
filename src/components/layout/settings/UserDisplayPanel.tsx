import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import MuiSelect from "@mui/material/Select";
import Alert from "@mui/material/Alert";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { UserDisplayConfig, UserDisplayType } from "../../../services/tauri";

interface UserDisplayPanelProps {
  expandedPanels: string[];
  onPanelChange: (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => void;
  userDisplayConfig: UserDisplayConfig[];
  onUserDisplayConfigChange: (cacheKey: string, displayType: UserDisplayType, customLabel?: string) => void;
  cachedKeys: string[];
  getCachedValue: (key: string) => string | null;
}

const DISPLAY_TYPE_LABEL: Record<UserDisplayType, string> = {
  none: "不显示",
  avatar: "头像",
  name: "显示名称",
  email: "显示邮箱",
  tenant: "租户名称",
  role: "角色",
  custom: "自定义显示",
};

export default function UserDisplayPanel({
  expandedPanels,
  onPanelChange,
  userDisplayConfig,
  onUserDisplayConfigChange,
  cachedKeys,
  getCachedValue,
}: UserDisplayPanelProps) {
  return (
    <Accordion
      expanded={expandedPanels.includes("userDisplay")}
      onChange={onPanelChange("userDisplay")}
      disableGutters
      sx={{
        mb: 1,
        "&:before": { display: "none" },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} component="div">
        <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
          👤 用户信息展示配置
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          <Typography variant="caption">
            💡 从登录响应解析出的用户信息字段中，选择要在左下角身份区展示的内容
          </Typography>
        </Alert>

        {cachedKeys.length === 0 ? (
          <Alert severity="warning" sx={{ fontSize: 12 }}>
            <Typography variant="caption">
              暂无可选字段。请先在上方「认证配置」里给登录端点配置响应映射，并把要展示的字段设为「保存到缓存」，
              这里才会出现可选字段。
            </Typography>
          </Alert>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              左侧是登录响应中解析出的字段，右侧选择它在身份区的用途。未登录时「值预览」显示为 -，
              登录后即可看到实际取值。
            </Typography>

            {cachedKeys.map((cacheKey) => {
              const config = userDisplayConfig.find((c) => c.cacheKey === cacheKey);
              const displayType = config?.displayType || "none";
              const valuePreview = getCachedValue(cacheKey);
              const customLabel = config?.customLabel || "";

              return (
                <Box key={cacheKey}>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      mb: 1,
                      alignItems: "center",
                      p: 1,
                      bgcolor: "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <TextField
                      size="small"
                      label="字段"
                      value={cacheKey}
                      disabled
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="值预览"
                      value={valuePreview ? (valuePreview.length > 20 ? `${valuePreview.slice(0, 20)}...` : valuePreview) : "-"}
                      disabled
                      sx={{ flex: 1 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 132 }}>
                      <InputLabel>用途</InputLabel>
                      <MuiSelect
                        value={displayType}
                        label="用途"
                        onChange={(e) =>
                          onUserDisplayConfigChange(
                            cacheKey,
                            e.target.value as UserDisplayType,
                            customLabel
                          )
                        }
                      >
                        {(Object.keys(DISPLAY_TYPE_LABEL) as UserDisplayType[]).map((type) => (
                          <MenuItem key={type} value={type}>
                            {DISPLAY_TYPE_LABEL[type]}
                          </MenuItem>
                        ))}
                      </MuiSelect>
                    </FormControl>
                  </Box>
                  {displayType === "custom" && (
                    <Box sx={{ ml: 1, mb: 1 }}>
                      <TextField
                        size="small"
                        label="自定义标签"
                        placeholder="例如：工号、部门"
                        value={customLabel}
                        onChange={(e) =>
                          onUserDisplayConfigChange(
                            cacheKey,
                            displayType,
                            e.target.value
                          )
                        }
                        sx={{ width: "50%" }}
                      />
                    </Box>
                  )}
                  {displayType === "avatar" && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 1, display: "block" }}>
                      头像字段需要是图片地址（http(s):// 或 data:image），否则不显示。
                    </Typography>
                  )}
                </Box>
              );
            })}
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}

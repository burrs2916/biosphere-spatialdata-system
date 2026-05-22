import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

interface CustomIconTabsProps {
  groups: Array<{ id: string; name: string; parent_id?: string | null }>;
  icons: Array<{ id: string; group_id: string; name: string }>;
  iconFileUrls: Record<string, string>;
  onSelectIcon: (iconId: string) => void;
}

export function CustomIconTabs({ groups, icons, iconFileUrls, onSelectIcon }: CustomIconTabsProps) {
  const topGroups = groups.filter((g) => !g.parent_id);
  const [expandedGroupPanels, setExpandedGroupPanels] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});
  const itemsPerPage = 18;

  if (topGroups.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        暂无图标分组，请先在"外观设置"中创建分组并上传图标
      </Typography>
    );
  }

  const handleGroupPanelChange =
    (groupId: string) =>
    (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedGroupPanels((prev) =>
        isExpanded ? [...prev, groupId] : prev.filter((p) => p !== groupId)
      );
      if (!isExpanded) {
        setCurrentPage((prev) => {
          const newPages = { ...prev };
          delete newPages[groupId];
          return newPages;
        });
      }
    };

  const getGroupCurrentPage = (groupId: string) => currentPage[groupId] || 1;

  const setGroupCurrentPage = (groupId: string, page: number) => {
    setCurrentPage((prev) => ({ ...prev, [groupId]: page }));
  };

  return (
    <Box>
      {topGroups.map((group) => {
        const groupIcons = icons.filter((i) => i.group_id === group.id);
        const subGroups = groups.filter((g) => g.parent_id === group.id);
        const isExpanded = expandedGroupPanels.includes(group.id);
        const currentGroupPage = getGroupCurrentPage(group.id);

        const totalPages = Math.ceil(groupIcons.length / itemsPerPage);
        const startIndex = (currentGroupPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedIcons = groupIcons.slice(startIndex, endIndex);

        return (
          <Paper
            key={group.id}
            sx={{
              mb: 1.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                p: 1.5,
                cursor: "pointer",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
              onClick={() => handleGroupPanelChange(group.id)(undefined as any, !isExpanded)}
            >
              <ExpandMoreIcon
                sx={{
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 500, ml: 1, flex: 1 }}>
                📁 {group.name}
              </Typography>
              <Chip
                label={`${groupIcons.length} 个图标`}
                size="small"
                variant="outlined"
              />
            </Box>
            {isExpanded && (
              <Box sx={{ p: 1.5, pt: 0 }}>
                {groupIcons.length > 0 && (
                  <>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, 1fr)",
                        gap: 1.5,
                        mb: 2,
                      }}
                    >
                      {paginatedIcons.map((icon) => (
                        <Paper
                          key={icon.id}
                          sx={{
                            p: 1.5,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.5,
                            borderRadius: 1,
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
                          onClick={() => onSelectIcon(icon.id)}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "action.hover",
                              borderRadius: 1,
                            }}
                          >
                            <img
                              src={iconFileUrls[icon.id] || ""}
                              alt={icon.name}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                              }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>
                            {icon.name}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>

                    {totalPages > 1 && (
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 2 }}>
                        <Button
                          size="small"
                          disabled={currentGroupPage === 1}
                          onClick={() => setGroupCurrentPage(group.id, Math.max(1, currentGroupPage - 1))}
                        >
                          上一页
                        </Button>
                        <Typography variant="body2" sx={{ minWidth: 80, textAlign: "center" }}>
                          {currentGroupPage} / {totalPages}
                        </Typography>
                        <Button
                          size="small"
                          disabled={currentGroupPage === totalPages}
                          onClick={() => setGroupCurrentPage(group.id, Math.min(totalPages, currentGroupPage + 1))}
                        >
                          下一页
                        </Button>
                      </Box>
                    )}
                  </>
                )}

                {subGroups.length > 0 && (
                  <Box sx={{ ml: 2, mt: 2 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    {subGroups.map((subGroup) => {
                      const subGroupIcons = icons.filter((i) => i.group_id === subGroup.id);
                      const subGroupExpanded = expandedGroupPanels.includes(subGroup.id);
                      const subGroupPage = getGroupCurrentPage(subGroup.id);
                      const subTotalPages = Math.ceil(subGroupIcons.length / itemsPerPage);
                      const subStartIndex = (subGroupPage - 1) * itemsPerPage;
                      const subEndIndex = subStartIndex + itemsPerPage;
                      const subPaginatedIcons = subGroupIcons.slice(subStartIndex, subEndIndex);

                      return (
                        <Box key={subGroup.id} sx={{ mb: 1.5 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              p: 1,
                              cursor: "pointer",
                              "&:hover": {
                                bgcolor: "action.hover",
                              },
                              border: "1px dashed",
                              borderColor: "divider",
                              borderRadius: 1,
                            }}
                            onClick={() => handleGroupPanelChange(subGroup.id)(undefined as any, !subGroupExpanded)}
                          >
                            <ExpandMoreIcon
                              sx={{
                                fontSize: 20,
                                transform: subGroupExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.2s",
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 500, ml: 1, flex: 1, fontSize: "0.9rem" }}>
                              📂 {subGroup.name}
                            </Typography>
                            <Chip
                              label={`${subGroupIcons.length} 个图标`}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: "0.7rem" }}
                            />
                          </Box>
                          {subGroupExpanded && subGroupIcons.length > 0 && (
                            <Box sx={{ p: 1, pt: 1.5 }}>
                              <Box
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(5, 1fr)",
                                  gap: 1.5,
                                  mb: 1.5,
                                }}
                              >
                                {subPaginatedIcons.map((icon) => (
                                  <Paper
                                    key={icon.id}
                                    sx={{
                                      p: 1,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: 0.5,
                                      borderRadius: 1,
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
                                    onClick={() => onSelectIcon(icon.id)}
                                  >
                                    <Box
                                      sx={{
                                        width: 36,
                                        height: 36,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        bgcolor: "action.hover",
                                        borderRadius: 1,
                                      }}
                                    >
                                      <img
                                        src={iconFileUrls[icon.id] || ""}
                                        alt={icon.name}
                                        style={{
                                          maxWidth: "100%",
                                          maxHeight: "100%",
                                        }}
                                      />
                                    </Box>
                                    <Typography variant="caption" sx={{ fontSize: "0.6rem" }}>
                                      {icon.name}
                                    </Typography>
                                  </Paper>
                                ))}
                              </Box>
                              {subTotalPages > 1 && (
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                                  <Button
                                    size="small"
                                    disabled={subGroupPage === 1}
                                    onClick={() => setGroupCurrentPage(subGroup.id, Math.max(1, subGroupPage - 1))}
                                  >
                                    上一页
                                  </Button>
                                  <Typography variant="body2" sx={{ minWidth: 80, textAlign: "center", fontSize: "0.8rem" }}>
                                    {subGroupPage} / {subTotalPages}
                                  </Typography>
                                  <Button
                                    size="small"
                                    disabled={subGroupPage === subTotalPages}
                                    onClick={() => setGroupCurrentPage(subGroup.id, Math.min(subTotalPages, subGroupPage + 1))}
                                  >
                                    下一页
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

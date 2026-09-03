/**
 * DeviceMappingPanel — 设备映射配置面板
 *
 * 配置产品级别的映射：
 * - 选择渲染组件类型
 * - 配置 Tag → 组件属性 绑定
 * - 配置 组件事件 → Tag 写入 控制绑定
 */
import { useState, useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import TextField from "@mui/material/TextField";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import TuneIcon from "@mui/icons-material/Tune";
import PublishIcon from "@mui/icons-material/Publish";
import { componentRegistry } from "../registry";
import { useDeviceMappingStore } from "../../store/deviceMappingStore";
import { useEditorStore } from "../../store/editorStore";
import { logger } from "../../utils/logger";
import { createDefaultDeviceMapping, createDefaultTagBinding, createDefaultControlBinding } from "../../types/deviceMapping";
import type { DeviceMapping, TagBinding, ControlBinding } from "../../types/deviceMapping";
import type { ProductDefinition } from "../../types/device";

interface DeviceMappingPanelProps {
  product: ProductDefinition | undefined;
  mapping: DeviceMapping | undefined;
  onClose: () => void;
}

export function DeviceMappingPanel({ product, mapping, onClose }: DeviceMappingPanelProps) {
  const setMapping = useDeviceMappingStore((s) => s.setMapping);

  const productCode = product?.productCode ?? "";

  // 本地编辑状态（基于 store 中的 mapping，或创建新的）
  const [localMapping, setLocalMapping] = useState<DeviceMapping>(() => {
    if (mapping) return { ...mapping };
    return createDefaultDeviceMapping(productCode);
  });

  // 可选组件列表（已启用的）
  const availableComponents = useMemo(() => {
    return componentRegistry.getEnabled().map((d) => ({
      type: d.type,
      name: d.name,
      icon: d.icon,
      category: d.category,
      defaultSize: d.defaultSize,
      configSchema: d.configSchema,
      events: d.events,
    }));
  }, []);

  // 当前选中组件的属性列表（从 configSchema 提取）
  const componentProperties = useMemo(() => {
    const def = componentRegistry.get(localMapping.componentType);
    if (!def?.configSchema) return [];
    return def.configSchema.map((f) => ({
      key: f.key,
      label: f.label || f.key,
      type: f.type,
    }));
  }, [localMapping.componentType]);

  // 当前选中组件的事件列表
  const componentEvents = useMemo(() => {
    const def = componentRegistry.get(localMapping.componentType);
    return def?.events ?? [];
  }, [localMapping.componentType]);

  // 产品的 Tags
  const tags = product?.tags ?? [];
  const writableTags = tags.filter((t) => t.writable);

  // 保存映射
  const handleSave = useCallback(() => {
    setMapping(localMapping);
    onClose();
  }, [localMapping, setMapping, onClose]);

  // === 增强 P3-2：把当前 mapping 应用到画布上选中的、同 productCode 的组件 ===
  // 不破坏：纯增量功能；不动现有 handleSave 行为
  const selectedBindingComponents = useEditorStore((s) => {
    if (!productCode) return [] as Array<{ id: string; productCode: string }>;
    return s.components
      .filter((c) => s.selection.selectedIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        productCode: (c.config as Record<string, unknown> | undefined)?.productCode as string ?? "",
      }))
      .filter((c) => c.productCode === productCode);
  });

  const handleApplyToSelected = useCallback(() => {
    if (!productCode || selectedBindingComponents.length === 0) return;
    const editor = useEditorStore.getState();
    let count = 0;
    for (const { id } of selectedBindingComponents) {
      const cur = editor.components.find((c) => c.id === id);
      const existingConfig = (cur?.config ?? {}) as Record<string, unknown>;
      editor.updateComponentConfig(id, {
        ...existingConfig,
        variant: localMapping.variantId,
        _deviceMapping: {
          mappingId: localMapping.id,
          productCode: localMapping.productCode,
          tagBindings: localMapping.tagBindings,
          controlBindings: localMapping.controlBindings,
        },
      });
      count++;
    }
    logger.info("DeviceMappingPanel", "Applied mapping to selected components", {
      productCode,
      count,
    });
  }, [productCode, selectedBindingComponents, localMapping]);

  // 更新映射字段
  const updateField = useCallback(<K extends keyof DeviceMapping>(key: K, value: DeviceMapping[K]) => {
    setLocalMapping((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Tag 绑定操作
  const handleAddTagBinding = useCallback(() => {
    const binding = createDefaultTagBinding();
    setLocalMapping((prev) => ({
      ...prev,
      tagBindings: [...prev.tagBindings, binding],
    }));
  }, []);

  const handleUpdateTagBinding = useCallback((index: number, patch: Partial<TagBinding>) => {
    setLocalMapping((prev) => ({
      ...prev,
      tagBindings: prev.tagBindings.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }, []);

  const handleRemoveTagBinding = useCallback((index: number) => {
    setLocalMapping((prev) => ({
      ...prev,
      tagBindings: prev.tagBindings.filter((_, i) => i !== index),
    }));
  }, []);

  // 控制绑定操作
  const handleAddControlBinding = useCallback(() => {
    const binding = createDefaultControlBinding();
    setLocalMapping((prev) => ({
      ...prev,
      controlBindings: [...prev.controlBindings, binding],
    }));
  }, []);

  const handleUpdateControlBinding = useCallback((index: number, patch: Partial<ControlBinding>) => {
    setLocalMapping((prev) => ({
      ...prev,
      controlBindings: prev.controlBindings.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }, []);

  const handleRemoveControlBinding = useCallback((index: number) => {
    setLocalMapping((prev) => ({
      ...prev,
      controlBindings: prev.controlBindings.filter((_, i) => i !== index),
    }));
  }, []);

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* 头部 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <IconButton size="small" onClick={onClose}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <TuneIcon sx={{ fontSize: 14, color: "primary.main" }} />
        <Typography sx={{ fontSize: 11, fontWeight: 600, flex: 1 }}>
          映射配置
        </Typography>
      </Box>

      {/* 产品信息 */}
      <Box sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
          {product?.productName ?? productCode}
        </Typography>
        <Typography sx={{ fontSize: 9, color: "text.secondary" }}>
          {productCode} · {tags.length} Tags · {writableTags.length} 可写
        </Typography>
      </Box>

      {/* 可滚动内容 */}
      <Box sx={{ flex: 1, overflow: "auto", px: 1, py: 1 }}>
        {/* ── 组件映射 ── */}
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary", mb: 0.5 }}>
          组件映射
        </Typography>

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel sx={{ fontSize: 11 }}>渲染组件</InputLabel>
          <Select
            value={localMapping.componentType}
            label="渲染组件"
            onChange={(e) => {
              const type = e.target.value;
              const def = componentRegistry.get(type);
              updateField("componentType", type);
              if (def) {
                updateField("defaultSize", { width: def.defaultSize.width, height: def.defaultSize.height });
              }
            }}
            sx={{ fontSize: 11 }}
          >
            <MenuItem value="" sx={{ fontSize: 11 }}>
              <em>未选择</em>
            </MenuItem>
            {availableComponents.map((c) => (
              <MenuItem key={c.type} value={c.type} sx={{ fontSize: 11 }}>
                {c.icon && <Box component="span" sx={{ mr: 0.5, fontSize: 14 }}>{c.icon}</Box>}
                {c.name}
                <Typography component="span" sx={{ fontSize: 9, color: "text.disabled", ml: 0.5 }}>
                  ({c.type})
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
          <TextField
            size="small"
            type="number"
            label="宽度"
            value={localMapping.defaultSize.width}
            onChange={(e) => updateField("defaultSize", { ...localMapping.defaultSize, width: Number(e.target.value) })}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11 } }}
            slotProps={{ inputLabel: { sx: { fontSize: 11 } } }}
          />
          <TextField
            size="small"
            type="number"
            label="高度"
            value={localMapping.defaultSize.height}
            onChange={(e) => updateField("defaultSize", { ...localMapping.defaultSize, height: Number(e.target.value) })}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 11 } }}
            slotProps={{ inputLabel: { sx: { fontSize: 11 } } }}
          />
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* ── Tag → 属性绑定 ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>
            Tag → 属性绑定
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 12 }} />}
            onClick={handleAddTagBinding}
            sx={{ fontSize: 9, textTransform: "none", minWidth: 0, p: 0.25 }}
          >
            添加
          </Button>
        </Box>

        {localMapping.tagBindings.length === 0 ? (
          <Box sx={{ p: 1, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 9, color: "text.disabled" }}>
              未配置绑定，拖拽到画布后将使用组件默认值
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1 }}>
            {localMapping.tagBindings.map((binding, index) => (
              <Box
                key={binding.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  p: 0.5,
                  borderRadius: 0.5,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "action.hover",
                }}
              >
                {/* Tag 选择 */}
                <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                  <Select
                    value={binding.tagId}
                    onChange={(e) => handleUpdateTagBinding(index, { tagId: e.target.value })}
                    sx={{ fontSize: 10, height: 24 }}
                    displayEmpty
                  >
                    <MenuItem value="" sx={{ fontSize: 10 }}><em>Tag</em></MenuItem>
                    {tags.map((tag) => (
                      <MenuItem key={tag.id} value={tag.id} sx={{ fontSize: 10 }}>
                        {tag.name}
                        <Typography component="span" sx={{ fontSize: 8, color: "text.disabled", ml: 0.5 }}>
                          ({tag.dataType}{tag.unit ? ` ${tag.unit}` : ""})
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <LinkIcon sx={{ fontSize: 12, color: "text.disabled", flexShrink: 0 }} />

                {/* 属性选择 */}
                <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                  <Select
                    value={binding.componentProperty}
                    onChange={(e) => handleUpdateTagBinding(index, { componentProperty: e.target.value })}
                    sx={{ fontSize: 10, height: 24 }}
                    displayEmpty
                  >
                    <MenuItem value="" sx={{ fontSize: 10 }}><em>属性</em></MenuItem>
                    {componentProperties.map((prop) => (
                      <MenuItem key={prop.key} value={prop.key} sx={{ fontSize: 10 }}>
                        {prop.label}
                        <Typography component="span" sx={{ fontSize: 8, color: "text.disabled", ml: 0.5 }}>
                          ({prop.type})
                        </Typography>
                      </MenuItem>
                    ))}
                    {/* 如果 configSchema 为空，允许手动输入 */}
                    {componentProperties.length === 0 && (
                      <MenuItem value="__custom" sx={{ fontSize: 10 }}>
                        <em>手动输入...</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>

                <IconButton
                  size="small"
                  onClick={() => handleRemoveTagBinding(index)}
                  sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
                >
                  <DeleteIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* ── 控制绑定（可写 Tag） ── */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: "text.secondary" }}>
            事件 → Tag 控制
          </Typography>
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 12 }} />}
            onClick={handleAddControlBinding}
            sx={{ fontSize: 9, textTransform: "none", minWidth: 0, p: 0.25 }}
          >
            添加
          </Button>
        </Box>

        {writableTags.length === 0 ? (
          <Box sx={{ p: 1, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 9, color: "text.disabled" }}>
              该产品无可写 Tag
            </Typography>
          </Box>
        ) : localMapping.controlBindings.length === 0 ? (
          <Box sx={{ p: 1, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 9, color: "text.disabled" }}>
              未配置控制绑定
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1 }}>
            {localMapping.controlBindings.map((binding, index) => (
              <Box
                key={binding.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  p: 0.5,
                  borderRadius: 0.5,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "action.hover",
                }}
              >
                {/* 事件选择 */}
                <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                  <Select
                    value={binding.event}
                    onChange={(e) => handleUpdateControlBinding(index, { event: e.target.value })}
                    sx={{ fontSize: 10, height: 24 }}
                    displayEmpty
                  >
                    <MenuItem value="" sx={{ fontSize: 10 }}><em>事件</em></MenuItem>
                    {componentEvents.map((evt) => (
                      <MenuItem key={evt.name} value={evt.name} sx={{ fontSize: 10 }}>
                        {evt.description || evt.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <LinkIcon sx={{ fontSize: 12, color: "text.disabled", flexShrink: 0, transform: "scaleX(-1)" }} />

                {/* 可写 Tag 选择 */}
                <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                  <Select
                    value={binding.tagId}
                    onChange={(e) => handleUpdateControlBinding(index, { tagId: e.target.value })}
                    sx={{ fontSize: 10, height: 24 }}
                    displayEmpty
                  >
                    <MenuItem value="" sx={{ fontSize: 10 }}><em>Tag</em></MenuItem>
                    {writableTags.map((tag) => (
                      <MenuItem key={tag.id} value={tag.id} sx={{ fontSize: 10 }}>
                        {tag.name}
                        <Typography component="span" sx={{ fontSize: 8, color: "text.disabled", ml: 0.5 }}>
                          ({tag.dataType})
                        </Typography>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* 写入值模板 */}
                <TextField
                  size="small"
                  placeholder="值"
                  value={binding.valueTemplate}
                  onChange={(e) => handleUpdateControlBinding(index, { valueTemplate: e.target.value })}
                  sx={{ width: 60, "& .MuiInputBase-input": { fontSize: 10, py: 0.25, height: 20 } }}
                />

                <IconButton
                  size="small"
                  onClick={() => handleRemoveControlBinding(index)}
                  sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
                >
                  <DeleteIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* === 增强 P3-2：应用到选中组件（仅在画布上有选中同 productCode 组件时启用） === */}
      {selectedBindingComponents.length > 0 && (
        <Tooltip title="将当前映射规则写入画布上选中的、相同 productCode 的组件">
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PublishIcon sx={{ fontSize: 12 }} />}
            onClick={handleApplyToSelected}
            disabled={!localMapping.componentType}
            sx={{ fontSize: 10, textTransform: "none", mb: 0.5 }}
            fullWidth
          >
            应用到选中组件 ({selectedBindingComponents.length})
          </Button>
        </Tooltip>
      )}

      {/* 底部操作栏 */}
      <Box sx={{ display: "flex", gap: 1, px: 1, py: 0.75, borderTop: 1, borderColor: "divider", flexShrink: 0 }}>
        <Button size="small" onClick={onClose} sx={{ fontSize: 10, textTransform: "none" }}>
          取消
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={!localMapping.componentType}
          sx={{ fontSize: 10, textTransform: "none", flex: 1 }}
        >
          应用映射
        </Button>
      </Box>
    </Box>
  );
}

/**
 * 工具原始函数名 → 中文业务名。
 * 与 Rust 侧 tools.rs tool_defs() 的函数名、AgentManager 的 AVAILABLE_TOOLS 同源，
 * 用于对话页工具卡片展示业务语言而非 query_xxx 函数名。
 */
export const TOOL_DISPLAY_LABELS: Record<string, string> = {
  query_devices: "设备查询",
  query_sensor_history: "传感器历史",
  query_operation_logs: "操作日志",
  query_device_events: "设备事件",
  query_system_events: "系统事件",
  query_dashboard_stats: "全局概览",
  query_scenes: "场景列表",
};

export function toolDisplayName(name: string): string {
  return TOOL_DISPLAY_LABELS[name] ?? name;
}

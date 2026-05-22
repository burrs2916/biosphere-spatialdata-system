import type { BaseWidgetProps } from "../../types/widget";

export interface AlertMonitorProps extends BaseWidgetProps {
  maxItems?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface LogViewerProps extends BaseWidgetProps {
  logLevel?: "debug" | "info" | "warn" | "error" | "all";
  maxLines?: number;
  autoScroll?: boolean;
}

export interface EventTimelineProps extends BaseWidgetProps {
  timeRange?: { start: string; end: string };
  eventTypes?: string[];
  maxEvents?: number;
}

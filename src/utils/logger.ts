import { invoke } from "@tauri-apps/api/core";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: string;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: number;
}

let logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 1000;
const MAX_QUEUE_SIZE = 20;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushLogs();
  }, FLUSH_INTERVAL);
}

async function flushLogs() {
  if (logQueue.length === 0) return;
  const batch = logQueue.splice(0, logQueue.length);
  try {
    await invoke("write_log_batch", { entries: batch });
  } catch (e) {
    console.error("[Logger] Failed to flush logs:", e);
  }
}

function enqueue(entry: LogEntry) {
  logQueue.push(entry);
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushLogs();
  } else {
    scheduleFlush();
  }
}

function createEntry(level: LogLevel, module: string, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    module,
    message,
    data,
    timestamp: Date.now(),
  };
}

export const logger = {
  debug(module: string, message: string, data?: Record<string, unknown>) {
    const entry = createEntry("debug", module, message, data);
    enqueue(entry);
    console.debug(`[${module}] ${message}`, data ?? "");
  },

  info(module: string, message: string, data?: Record<string, unknown>) {
    const entry = createEntry("info", module, message, data);
    enqueue(entry);
    console.info(`[${module}] ${message}`, data ?? "");
  },

  warn(module: string, message: string, data?: Record<string, unknown>) {
    const entry = createEntry("warn", module, message, data);
    enqueue(entry);
    console.warn(`[${module}] ${message}`, data ?? "");
  },

  error(module: string, message: string, data?: Record<string, unknown>) {
    const entry = createEntry("error", module, message, data);
    enqueue(entry);
    console.error(`[${module}] ${message}`, data ?? "");
  },

  async flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flushLogs();
  },

  async getLogDir(): Promise<string> {
    return invoke<string>("get_log_dir_path");
  },
};

export default logger;

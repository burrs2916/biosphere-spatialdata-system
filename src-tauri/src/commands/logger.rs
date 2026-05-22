use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::Local;
use tauri::State;

pub struct LoggerState {
    pub log_dir: Mutex<PathBuf>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub level: String,
    pub module: String,
    pub message: String,
    pub data: Option<serde_json::Value>,
    pub timestamp: Option<u64>,
}

fn get_log_dir() -> PathBuf {
    let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = project_root.parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    project_root.join("logs")
}

fn ensure_log_dir(log_dir: &PathBuf) -> Result<(), String> {
    if !log_dir.exists() {
        fs::create_dir_all(log_dir).map_err(|e| format!("Failed to create log dir: {}", e))?;
    }
    Ok(())
}

fn format_timestamp(ts: Option<u64>) -> String {
    if let Some(millis) = ts {
        chrono::DateTime::from_timestamp_millis(millis as i64)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string())
            .unwrap_or_else(|| Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string())
    } else {
        Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string()
    }
}

pub fn write_log(log_dir: &PathBuf, entry: &LogEntry) -> Result<(), String> {
    ensure_log_dir(log_dir)?;

    let date_str = Local::now().format("%Y-%m-%d").to_string();
    let level = entry.level.to_lowercase();

    let log_file = log_dir.join(format!("app-{}-{}.log", date_str, level));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    let timestamp = format_timestamp(entry.timestamp);
    let data_str = entry.data.as_ref()
        .map(|d| format!(" | data: {}", d))
        .unwrap_or_default();

    let line = format!("[{}] [{}] [{}] {}{}\n", timestamp, entry.level.to_uppercase(), entry.module, entry.message, data_str);

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn write_log_entry(entry: LogEntry, state: State<'_, LoggerState>) -> Result<(), String> {
    let log_dir = state.log_dir.lock().map_err(|e| e.to_string())?;
    write_log(&log_dir, &entry)
}

#[tauri::command]
pub fn write_log_batch(entries: Vec<LogEntry>, state: State<'_, LoggerState>) -> Result<(), String> {
    let log_dir = state.log_dir.lock().map_err(|e| e.to_string())?;
    for entry in &entries {
        write_log(&log_dir, entry)?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_log_dir_path(state: State<'_, LoggerState>) -> Result<String, String> {
    let log_dir = state.log_dir.lock().map_err(|e| e.to_string())?;
    Ok(log_dir.to_string_lossy().to_string())
}

pub fn init_logger_state() -> LoggerState {
    let log_dir = get_log_dir();
    let _ = ensure_log_dir(&log_dir);

    let boot_log = log_dir.join(format!("app-{}-info.log", Local::now().format("%Y-%m-%d")));
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&boot_log) {
        let _ = writeln!(file, "[{}] [INFO] [system] Application starting, log dir: {}", Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), log_dir.display());
    }

    LoggerState {
        log_dir: Mutex::new(log_dir),
    }
}

//! 通用文件写入命令（用于前端 save dialog → 写入流程）
//!
//! 背景：Tauri 2 WebView 默认拦截 `URL.createObjectURL` + `a.click()` 触发的
//! 浏览器原生下载（Content-Disposition header 不会触发 save dialog）。
//! 前端必须先调 `@tauri-apps/plugin-dialog` 的 `save()` 获取目标路径，
//! 再调本命令把内容写到该路径。

use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub async fn save_text_to_path(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(format!("目标目录不存在: {}", parent.display()));
        }
    }
    fs::write(&target, content.as_bytes())
        .map_err(|e| format!("写入文件失败: {} (path={})", e, target.display()))?;
    Ok(())
}

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database(pub Mutex<Connection>);

impl Database {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self, rusqlite::Error> {
        let conn = match Self::open_file_database(app_handle) {
            Ok(conn) => conn,
            Err(_e) => Connection::open_in_memory()?,
        };

        Ok(Database(Mutex::new(conn)))
    }

    fn open_file_database(_app_handle: &tauri::AppHandle) -> Result<Connection, rusqlite::Error> {
        let db_path = if cfg!(debug_assertions) {
            // 开发环境：数据库放在项目根目录下的 data 目录
            let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            let project_root = project_root
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."));

            let data_dir = project_root.join("data");
            let _ = std::fs::create_dir_all(&data_dir);

            data_dir.join("config.db")
        } else {
            // 生产环境：数据库放在可执行文件同一级目录
            let exe_path = match std::env::current_exe() {
                Ok(path) => path,
                Err(_) => PathBuf::from("config.db"),
            };

            let exe_dir = exe_path
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."));

            exe_dir.join("config.db")
        };

        Connection::open(db_path)
    }
}

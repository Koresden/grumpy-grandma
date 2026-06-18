use std::process::Child;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    LogicalPosition, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};

const PORT: u16 = 5600;
const WIDGET_W: f64 = 380.0;
const WIDGET_H: f64 = 680.0;

// Resolve the sidecar server.mjs + dist/: bundled resources in a packaged .app, else the
// dev paths next to src-tauri. (Build-machine path is baked in for dev; the .app uses resources.)
fn sidecar_paths(app: &tauri::AppHandle) -> (std::path::PathBuf, std::path::PathBuf) {
    if let Ok(res) = app.path().resource_dir() {
        let s = res.join("server").join("server.mjs");
        if s.exists() {
            return (s, res.join("dist"));
        }
    }
    let dev = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    (dev.join("server").join("server.mjs"), dev.join("dist"))
}

// Prefer the Node binary bundled alongside the app executable (externalBin → Contents/MacOS/node),
// so the app carries its own runtime. Fall back to common install paths, then bare PATH.
fn node_bin() -> String {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let n = dir.join("node");
            if n.exists() {
                return n.to_string_lossy().into_owned();
            }
        }
    }
    for p in ["/opt/homebrew/bin/node", "/usr/local/bin/node"] {
        if std::path::Path::new(p).exists() {
            return p.to_string();
        }
    }
    "node".to_string()
}

fn spawn_sidecar(app: &tauri::AppHandle) -> Option<Child> {
    let (server, dist) = sidecar_paths(app);
    std::process::Command::new(node_bin())
        .arg(server)
        .env("GRANDMA_PORT", PORT.to_string())
        .env("GRANDMA_DIST", dist)
        .spawn()
        .ok()
}

fn wait_for_port() {
    let addr = format!("127.0.0.1:{PORT}");
    for _ in 0..50 {
        if std::net::TcpStream::connect(&addr).is_ok() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
}

fn url(path: &str) -> WebviewUrl {
    WebviewUrl::External(format!("http://localhost:{PORT}{path}").parse().unwrap())
}

// Show + focus a window by label.
fn reveal(app: &tauri::AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Holds the sidecar process so we can kill it when the app exits (no orphaned node).
    let sidecar: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let sidecar_setup = sidecar.clone();

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            *sidecar_setup.lock().unwrap() = spawn_sidecar(&handle);
            wait_for_port();

            // Main hub window. The ?v= route is authoritative at startup so a WebView-restored
            // stale hash can't reopen the window on the wrong view.
            WebviewWindowBuilder::new(app, "main", url("/?v=hub"))
                .title("Grandma's Desktop")
                .inner_size(1080.0, 820.0)
                .build()?;

            // Always-on-top corner widget → Live Reaction. Transparent + no chrome = a floating
            // frosted card; macOS vibrancy provides the blur behind it.
            let widget = WebviewWindowBuilder::new(app, "widget", url("/?v=reaction&widget=1"))
                .title("Grandma")
                .inner_size(WIDGET_W, WIDGET_H)
                .resizable(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .transparent(true)
                .decorations(false)
                .build()?;
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};
                let _ = apply_vibrancy(
                    &widget,
                    NSVisualEffectMaterial::HudWindow,
                    Some(NSVisualEffectState::Active),
                    Some(20.0),
                );
            }
            if let Ok(Some(monitor)) = widget.primary_monitor() {
                let scale = monitor.scale_factor();
                let mon_w = monitor.size().width as f64 / scale;
                let x = (mon_w - WIDGET_W - 20.0).max(0.0);
                let _ = widget.set_position(LogicalPosition::new(x, 44.0));
            }

            // Menu-bar (tray) item: toggle the widget / open the hub / quit.
            let show_widget = MenuItem::with_id(app, "show_widget", "Show Grandma", true, None::<&str>)?;
            let show_main = MenuItem::with_id(app, "show_main", "Open Desktop", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Grandma", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_widget, &show_main, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Grumpy Grandma")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_widget" => reveal(app, "widget"),
                    "show_main" => reveal(app, "main"),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) = sidecar.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}

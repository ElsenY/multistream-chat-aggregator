use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};

#[tauri::command]
fn receive_youtube_message(app: AppHandle, msg: serde_json::Value) {
    let _ = app.emit("youtube-chat-message", msg);
}

#[tauri::command]
fn log_from_webview(msg: String) {
    println!("[YouTube Webview]: {}", msg);
}

#[tauri::command]
async fn spawn_youtube_webview(app: AppHandle, video_id: String) -> Result<(), String> {
    let url = format!("https://www.youtube.com/live_chat?v={}&dark_theme=1", video_id);
    let init_script = r#"
        let lastScrapedId = '';
        
        function tauriLog(msg) {
          if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
             window.__TAURI_INTERNALS__.invoke("log_from_webview", { msg: String(msg) })
               .catch(e => {});
          }
        }

        function tauriEmit(data) {
          if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
             window.__TAURI_INTERNALS__.invoke("receive_youtube_message", { msg: data })
               .catch(e => tauriLog("Emit error: " + e));
          } else {
             tauriLog("No Tauri internals found. Cannot emit data.");
          }
        }

        function scrapeChat() {
          const items = document.querySelectorAll('yt-live-chat-text-message-renderer');
          tauriLog(`Scraping... found ${items.length} items`);
          
          if (items.length === 0) return;
          
          let startIndex = 0;
          if (lastScrapedId !== '') {
             for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].id === lastScrapedId) {
                   startIndex = i + 1;
                   break;
                }
             }
          } else {
             startIndex = Math.max(0, items.length - 10);
          }

          for (let i = startIndex; i < items.length; i++) {
            const node = items[i];
            lastScrapedId = node.id;
            
            const authorNameNode = node.querySelector('#author-name');
            const messageNode = node.querySelector('#message');
            const authorName = authorNameNode ? authorNameNode.textContent.trim() : 'Unknown';
            const message = messageNode ? messageNode.textContent.trim() : '';
            
            const badges = node.querySelectorAll('.yt-live-chat-author-badge-renderer img');
            let isMod = false;
            let isOwner = false;
            let isSponsor = false;
            
            badges.forEach(img => {
               const alt = (img.alt || '').toLowerCase();
               if (alt.includes('moderator')) isMod = true;
               else if (alt.includes('owner')) isOwner = true;
               else isSponsor = true;
            });
            
            if (message !== '') {
               tauriLog(`Emitting message from ${authorName}`);
               tauriEmit({
                  authorName: authorName,
                  authorId: authorName,
                  message: message,
                  isMod: isMod,
                  isOwner: isOwner,
                  isSponsor: isSponsor,
                  timestamp: Date.now()
               });
            }
          }
        }
        setInterval(scrapeChat, 2000);
        tauriLog("YouTube Chat Scraper Initialized.");
    "#;

    if let Some(w) = app.get_webview_window("youtube-scraper") {
        let _ = w.close();
    }

    let url_parsed = tauri::Url::parse(&url).map_err(|e| e.to_string())?;

    let _webview = WebviewWindowBuilder::new(&app, "youtube-scraper", WebviewUrl::External(url_parsed))
        .title("YouTube Scraper")
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .visible(true)
        .initialization_script(init_script)
        .build()
        .map_err(|e| e.to_string())?;

    _webview.open_devtools();

    Ok(())
}

#[tauri::command]
async fn close_youtube_webview(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("youtube-scraper") {
        let _ = w.close();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            spawn_youtube_webview, 
            close_youtube_webview,
            receive_youtube_message,
            log_from_webview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

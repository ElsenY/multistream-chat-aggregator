// =============================================================================
// LEGACY — YouTube Webview Scraper Commands
// =============================================================================
// These Tauri commands were removed from active use in favour of the
// YouTube Data API v3 (gRPC) approach in lib.rs.
//
// The scraper worked by spawning a hidden Tauri WebviewWindow pointed at
// https://www.youtube.com/live_chat?v=<VIDEO_ID> and injecting a JavaScript
// init_script that polled the DOM every 2 seconds for new
// `yt-live-chat-text-message-renderer` elements, then emitted each message
// back to the frontend via the Tauri event system ("youtube-chat-message").
//
// Frontend counterpart: legacy/src/services/youtube.ts
// =============================================================================

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Spawns a hidden (or visible in debug) WebviewWindow that loads the YouTube
/// live chat iframe and scrapes messages by injecting JavaScript into the page.
#[tauri::command]
async fn spawn_youtube_webview(app: AppHandle, video_id: String) -> Result<(), String> {
    let url = format!("https://www.youtube.com/live_chat?v={}&dark_theme=1", video_id);
    let init_script = r#"
        let lastScrapedId = '';

        function tauriLog(msg) {
          console.log("[TAURI_LOG]: " + msg);
        }

        function tauriEmit(data) {
          if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
             window.__TAURI_INTERNALS__.invoke("plugin:event|emit", {
                 event: "youtube-chat-message",
                 payload: data
             }).catch(e => console.error("Emit error: ", e));
          } else {
             console.log("No Tauri internals found. Cannot emit data.");
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

    #[cfg(debug_assertions)]
    _webview.open_devtools();

    Ok(())
}

/// Closes the hidden YouTube scraper WebviewWindow if it is open.
#[tauri::command]
async fn close_youtube_webview(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("youtube-scraper") {
        let _ = w.close();
    }
    Ok(())
}

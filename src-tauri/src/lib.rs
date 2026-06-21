use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};
use std::sync::{Mutex, Arc};
use std::str::FromStr;
use tokio::sync::oneshot;
use chrono::DateTime;
use tokio::net::TcpListener;
use tokio::io::AsyncWriteExt;
use tokio::sync::broadcast;

// Include compiled protobuf code
pub mod youtube {
    pub mod api {
        pub mod v3 {
            tonic::include_proto!("youtube.api.v3");
        }
    }
}

pub struct YoutubeGrpcState {
    cancel_tx: Mutex<Option<oneshot::Sender<()>>>,
}

pub struct SseState {
    tx: broadcast::Sender<String>,
    last_settings: Arc<Mutex<Option<String>>>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ChatMessage {
    id: String,
    platform: String,
    username: String,
    #[serde(rename = "displayName")]
    display_name: String,
    message: String,
    timestamp: u64,
    color: String,
    #[serde(rename = "isMod")]
    is_mod: bool,
    #[serde(rename = "isOwner")]
    is_owner: bool,
    #[serde(rename = "isSubscriber")]
    is_subscriber: bool,
}

fn generate_color(name: &str) -> String {
    let mut hash: i32 = 0;
    for c in name.chars() {
        let val = c as i32;
        hash = val.wrapping_add(hash.wrapping_shl(5).wrapping_sub(hash));
    }
    let hue = (hash % 360).abs();
    format!("hsl({}, 80%, 65%)", hue)
}

fn parse_grpc_message(item: &youtube::api::v3::LiveChatMessage) -> Option<ChatMessage> {
    let snippet = item.snippet.as_ref()?;
    let author = item.author_details.as_ref()?;
    
    // MsgType 1 = TEXT_MESSAGE_EVENT
    let msg_type = snippet.r#type?;
    if msg_type != 1 {
        return None;
    }
    
    let id = item.id.clone().unwrap_or_default();
    let display_name = author.display_name.clone().unwrap_or_default();
    let channel_id = author.channel_id.clone().unwrap_or_default();
    
    let message_text = match snippet.displayed_content.as_ref() {
        Some(youtube::api::v3::live_chat_message_snippet::DisplayedContent::TextMessageDetails(details)) => {
            details.message_text.clone().unwrap_or_default()
        }
        _ => snippet.display_message.clone().unwrap_or_default(),
    };
        
    let timestamp = if let Some(ref pub_at) = snippet.published_at {
        if let Ok(dt) = DateTime::parse_from_rfc3339(pub_at) {
            dt.timestamp_millis() as u64
        } else {
            chrono::Utc::now().timestamp_millis() as u64
        }
    } else {
        chrono::Utc::now().timestamp_millis() as u64
    };
    
    let color = generate_color(&display_name);
    
    Some(ChatMessage {
        id,
        platform: "youtube".to_string(),
        username: channel_id,
        display_name,
        message: message_text,
        timestamp,
        color,
        is_mod: author.is_chat_moderator.unwrap_or(false),
        is_owner: author.is_chat_owner.unwrap_or(false),
        is_subscriber: author.is_chat_sponsor.unwrap_or(false),
    })
}

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

#[tauri::command]
async fn close_youtube_webview(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("youtube-scraper") {
        let _ = w.close();
    }
    Ok(())
}

#[tauri::command]
async fn start_youtube_grpc_stream(
    app: AppHandle,
    state: tauri::State<'_, YoutubeGrpcState>,
    api_key: String,
    live_chat_id: String,
) -> Result<(), String> {
    // 1. Cancel existing stream if any
    {
        let mut guard = state.cancel_tx.lock().unwrap();
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }

    // 2. Create new cancellation channel
    let (tx, mut rx) = oneshot::channel::<()>();
    {
        let mut guard = state.cancel_tx.lock().unwrap();
        *guard = Some(tx);
    }

    // 3. Spawn Tokio background task
    tokio::spawn(async move {
        println!("Starting YouTube gRPC stream for live_chat_id: {}", live_chat_id);
        
        let mut next_page_token: Option<String> = None;
        
        loop {
            // Check cancellation before connecting/reconnecting
            if rx.try_recv().is_ok() {
                println!("YouTube gRPC Stream cancelled before connection");
                break;
            }

            // Connect to Google APIs gRPC endpoint with TLS support
            let tls_config = tonic::transport::ClientTlsConfig::new()
                .domain_name("youtube.googleapis.com");

            let channel = match tonic::transport::Channel::from_static("https://youtube.googleapis.com")
                .tls_config(tls_config)
            {
                Ok(chan) => match chan.connect().await {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Failed to connect to YouTube gRPC endpoint: {:?}", e);
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                        continue;
                    }
                },
                Err(e) => {
                    eprintln!("Failed to configure TLS for Channel: {:?}", e);
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    continue;
                }
            };

            use youtube::api::v3::v3_data_live_chat_message_service_client::V3DataLiveChatMessageServiceClient;
            let mut client = V3DataLiveChatMessageServiceClient::new(channel);

            use youtube::api::v3::LiveChatMessageListRequest;
            let mut req = tonic::Request::new(LiveChatMessageListRequest {
                live_chat_id: Some(live_chat_id.clone()),
                hl: Some("en".to_string()),
                profile_image_size: Some(80),
                max_results: Some(20),
                page_token: next_page_token.clone(),
                part: vec!["snippet".to_string(), "authorDetails".to_string()],
            });

            // Set the API Key metadata
            if let Ok(val) = tonic::metadata::MetadataValue::from_str(&api_key) {
                req.metadata_mut().insert("x-goog-api-key", val);
            } else {
                eprintln!("Invalid API key format");
                break;
            }

            // Call the StreamList RPC
            let mut response_stream = match client.stream_list(req).await {
                Ok(res) => res.into_inner(),
                Err(status) => {
                    eprintln!("gRPC error status: {:?}", status);
                    if status.code() == tonic::Code::InvalidArgument {
                        // Probably bad chat ID or invalid request parameters, stop completely
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    continue;
                }
            };

            use tokio_stream::StreamExt;
            let mut stream_ended_normally = false;

            loop {
                tokio::select! {
                    _ = &mut rx => {
                        println!("YouTube gRPC Stream cancellation requested in loop");
                        return;
                    }
                    next_item = response_stream.next() => {
                        match next_item {
                            Some(Ok(response)) => {
                                next_page_token = response.next_page_token.clone();
                                
                                for item in response.items {
                                    if let Some(chat_msg) = parse_grpc_message(&item) {
                                        let _ = app.emit("youtube-grpc-message", chat_msg);
                                    }
                                }
                                
                                if response.next_page_token.is_none() {
                                    println!("YouTube Stream ended normally: next_page_token is null");
                                    stream_ended_normally = true;
                                    break;
                                }
                            }
                            Some(Err(e)) => {
                                eprintln!("Error reading YouTube gRPC stream: {:?}", e);
                                break;
                            }
                            None => {
                                println!("YouTube gRPC stream closed by server (EOF)");
                                break;
                            }
                        }
                    }
                }
            }

            if stream_ended_normally {
                break;
            }

            // Reconnection backoff
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });

    Ok(())
}

#[tauri::command]
async fn close_youtube_grpc_stream(
    state: tauri::State<'_, YoutubeGrpcState>,
) -> Result<(), String> {
    let mut guard = state.cancel_tx.lock().unwrap();
    if let Some(tx) = guard.take() {
        let _ = tx.send(());
    }
    Ok(())
}

#[tauri::command]
async fn broadcast_chat_message(
    state: tauri::State<'_, SseState>,
    msg: ChatMessage,
) -> Result<(), String> {
    if let Ok(json_str) = serde_json::to_string(&msg) {
        let _ = state.tx.send(json_str);
    }
    Ok(())
}

#[tauri::command]
async fn clear_chat_messages(
    state: tauri::State<'_, SseState>,
) -> Result<(), String> {
    let _ = state.tx.send("CLEAR".to_string());
    Ok(())
}

#[tauri::command]
async fn broadcast_settings(
    state: tauri::State<'_, SseState>,
    settings: serde_json::Value,
) -> Result<(), String> {
    if let Ok(json_str) = serde_json::to_string(&settings) {
        let msg = format!("SETTINGS:{}", json_str);
        {
            let mut guard = state.last_settings.lock().unwrap();
            *guard = Some(msg.clone());
        }
        let _ = state.tx.send(msg);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(9527).build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (tx, _rx) = broadcast::channel::<String>(100);
            let sse_tx = tx.clone();
            let last_settings = Arc::new(Mutex::new(None));
            let last_settings_for_server = last_settings.clone();
            
            app.manage(SseState { 
                tx,
                last_settings,
            });
            
            // Spawn the SSE Server on port 9528 using Tauri's async runtime
            tauri::async_runtime::spawn(async move {
                let listener = match TcpListener::bind("0.0.0.0:9528").await {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("Failed to bind SSE server to port 9528: {:?}", e);
                        return;
                    }
                };
                println!("SSE Broadcast Server listening on http://localhost:9528");
                
                loop {
                    let (mut socket, _) = match listener.accept().await {
                        Ok(s) => s,
                        Err(_) => continue,
                    };
                    
                    let sse_tx_clone = sse_tx.clone();
                    let last_settings_clone = last_settings_for_server.clone();
                    
                    tauri::async_runtime::spawn(async move {
                        let mut buf = [0u8; 1024];
                        let _ = tokio::io::AsyncReadExt::read(&mut socket, &mut buf).await;
                        
                        let headers = "HTTP/1.1 200 OK\r\n\
                                       Content-Type: text/event-stream\r\n\
                                       Cache-Control: no-cache\r\n\
                                       Connection: keep-alive\r\n\
                                       Access-Control-Allow-Origin: *\r\n\
                                       Access-Control-Allow-Headers: *\r\n\r\n";
                        if socket.write_all(headers.as_bytes()).await.is_err() {
                            return;
                        }
                        
                        // Send the last stored settings if available
                        let initial_settings = {
                            let guard = last_settings_clone.lock().unwrap();
                            guard.clone()
                        };
                        
                        if let Some(settings_msg) = initial_settings {
                            let sse_data = format!("data: {}\n\n", settings_msg);
                            if socket.write_all(sse_data.as_bytes()).await.is_err() {
                                return;
                            }
                        }
                        
                        let mut rx = sse_tx_clone.subscribe();
                        let mut keepalive_interval = tokio::time::interval(tokio::time::Duration::from_secs(15));
                        
                        loop {
                            tokio::select! {
                                msg_res = rx.recv() => {
                                    match msg_res {
                                        Ok(msg) => {
                                            let sse_data = format!("data: {}\n\n", msg);
                                            if socket.write_all(sse_data.as_bytes()).await.is_err() {
                                                break;
                                            }
                                        }
                                        Err(_) => break,
                                    }
                                }
                                _ = keepalive_interval.tick() => {
                                    if socket.write_all(b": keep-alive\n\n").await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                    });
                }
            });

            app.manage(YoutubeGrpcState {
                cancel_tx: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_youtube_webview, 
            close_youtube_webview,
            start_youtube_grpc_stream,
            close_youtube_grpc_stream,
            broadcast_chat_message,
            clear_chat_messages,
            broadcast_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

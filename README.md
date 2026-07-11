# multistream-chat-aggregator

A desktop app built with [Tauri](https://tauri.app/) (Rust + React) that aggregates live chat from **Twitch** and **YouTube** into a single unified feed — with a built-in transparent OBS overlay.

---

## What It Does

- Connects to Twitch IRC and YouTube Live Chat simultaneously
- Displays messages from both platforms in one scrollable feed with color-coded badges
- Serves a **transparent OBS Browser Source overlay** at `http://127.0.0.1:9527/#/overlay` so chat messages appear directly on your stream
- Messages in the overlay auto-fade after a configurable time

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| State | Zustand |
| Routing | React Router (HashRouter) |
| Overlay server | `tiny_http` (Rust, port `9527`) |
| SSE broadcast | Tokio async server (Rust, port `9528`) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri CLI: included via `npm run tauri`

### Install & Run (Development)

```bash
npm install
npm run tauri dev
```

> **Note:** The first build will take several minutes as Rust compiles all dependencies. Subsequent builds are much faster.

For development, the OBS overlay URL is `http://localhost:1420/#/overlay` (uses the Vite dev server with hot-reload).

### Build for Production

```bash
npm run tauri build
```

After a production build, the overlay is served from the embedded binary at `http://127.0.0.1:9527/#/overlay`.

---

## Connecting to Twitch

Twitch chat is read **anonymously** — no account, no API key, and no OAuth token is needed.

1. Open the app and go to the **Dashboard**.
2. In the Twitch section, type a channel name (e.g. `shroud`).
3. Click **Connect**.

> **Auto-Connect:** You can save your default Twitch channel name in **Settings** so that it automatically connects when the app is launched.

The app connects directly to Twitch's IRC WebSocket (`wss://irc-ws.chat.twitch.tv:443`) as an anonymous guest.

---

## Connecting to YouTube Live Chat

Connecting to YouTube Live Chat requires the official YouTube Data API v3 Key.

- ✅ More reliable long-term connection
- ✅ Works with public and unlisted live streams
- ⚠️ Requires a Google Cloud project and API key

### How to get an API key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for and enable **YouTube Data API v3**
5. Go to **APIs & Services → Credentials → Create Credentials → API Key**
6. Copy the generated key

### How to use:
1. Go to **Settings** in the app.
2. Paste your API key into the **YouTube Data API v3 Key** field.
3. (Optional) Save your default YouTube Channel tag (e.g. `@LofiGirl`) in the **Default YouTube Channel** field.
4. Click **Save Settings**.
5. On the **Dashboard**, enter a YouTube Live video ID, video URL, or `@ChannelHandle`.
6. Click **Connect**.

> **Note on Channel Handles & Auto-Connect:** Since stream links change every time you go live, entering a handle starting with `@` (e.g. `@LofiGirl`) will trigger the app to automatically find and connect to the active livestream on that channel. If configured in **Settings**, the app will automatically connect to this channel when launched. Settings are persisted in `localStorage` and survive app restarts.

---

## OBS Overlay

The app exposes a **transparent chat overlay** for use as a Browser Source in OBS Studio (or any OBS-compatible software).

### How It Works — Two Ports

The overlay system uses two separate local servers, both started automatically when the Tauri app launches:

```
┌─────────────────────────────────────────────────┐
│              Tauri App (Desktop)                │
│                                                 │
│  Chat ingestion (Twitch IRC / YouTube API)      │
│         │                                       │
│         ▼                                       │
│  Rust backend broadcasts messages via:          │
│    • BroadcastChannel (same-origin windows)     │
│    • SSE server on :9528 ◄───────────────────────────┐
│    • tiny_http server on :9527 (serves UI HTML) │    │
└─────────────────────────────────────────────────┘    │
                                                       │
┌─────────────────────────────────────────────────┐    │
│        OBS Browser Source                       │    │
│                                                 │    │
│  URL: http://127.0.0.1:9527/#/overlay           │    │
│         │                                       │    │
│         ▼                                       │    │
│  Loads the React app (served by :9527)          │    │
│         │                                       │    │
│         └── Connects to SSE on :9528 ───────────────┘
│             Receives chat messages in real-time
│             Renders with transparent background
└─────────────────────────────────────────────────┘
```

| Port | Purpose |
|------|---------|
| `9527` | HTTP file server (`tiny_http` in Rust) — serves the built React app bundle to OBS |
| `9528` | SSE (Server-Sent Events) broadcast server (Tokio async) — streams chat messages and settings to any connected browser |

**Port `9527`** serves the entire frontend as static files (the compiled `dist/` bundle embedded in the Tauri binary). When OBS loads the Browser Source, it fetches `index.html` and all assets from here.

**Port `9528`** is a persistent HTTP stream endpoint. The overlay page, once loaded in OBS, connects to `http://127.0.0.1:9528` as an `EventSource`. Every time a new chat message arrives in the Tauri app, it is broadcast over this SSE connection to all listeners — including the OBS overlay. Settings changes (fade time, max messages, etc.) are also pushed live over this same connection.

### Adding to OBS

1. In OBS, go to **Sources → Add → Browser**
2. Set the URL to `http://127.0.0.1:9527/#/overlay`
3. Set Width/Height to match your stream resolution (e.g. 1920 × 1080)
4. Enable **"Shutdown source when not visible"** if desired
5. The background is fully transparent — no chroma key needed

> The Tauri app **must be running** for the overlay to receive messages. OBS connects to the local servers at `9527`/`9528` which only exist while the app is open.

### General & Connection Settings

Configure in **Settings → General & Connection Settings**:

| Setting | Default | Description |
|---|---|---|
| Max Messages in Feed | `500` | The limit of cached messages shown in the dashboard list |
| Max Connection Retries | `5` | The number of connection retry attempts the app will make to Twitch/YouTube before failing (using exponential backoff) |

### Overlay Settings

Configure in **Settings → OBS Overlay**:

| Setting | Default | Description |
|---|---|---|
| Message Fade Time | `0` (off) | Seconds before a message fades out. Set to `0` to keep messages indefinitely |
| Max Visible Messages | `0` (unlimited) | Maximum number of messages shown at once in the overlay |

---

## Project Structure

```
├── legacy/                 # Legacy scraper files (archived)
│   ├── src/
│   │   └── services/
│   │       └── youtube.ts  # Archived frontend webview scraper client
│   └── src-tauri/
│       └── youtube_scraper.rs # Archived backend scraper Tauri commands
├── src/                    # React frontend
│   ├── pages/
│   │   ├── Dashboard.tsx   # Main chat feed + connect controls
│   │   ├── ChatPage.tsx    # Dedicated chat view
│   │   ├── Settings.tsx    # Configuration page
│   │   └── Overlay.tsx     # OBS overlay view (/#/overlay)
│   ├── components/         # Sidebar, StatusBar, etc.
│   ├── store.ts            # Zustand state + SSE client
│   └── index.css           # Design system & styles
├── src-tauri/
│   └── src/
│       └── lib.rs          # Rust backend: Twitch IRC, YouTube API,
│                           #   tiny_http server (:9527),
│                           #   SSE broadcast server (:9528)
├── vite.config.ts          # Vite dev server config (port 1420)
└── package.json
```

---

## Legacy Scraper (Archived)

The `/legacy` directory contains the deprecated YouTube Webview Scraper feature. 

This scraper worked by launching a hidden Tauri WebviewWindow loading `youtube.com/live_chat` and executing an injected JavaScript polling script to scrape chat messages directly from the DOM, bypassing Google API requirements.

Due to maintenance costs and stability concerns with YouTube DOM updates, it was deactivated in favor of the official **YouTube Data API v3** connection. If you wish to reuse or reference the DOM scraping approach, the complete client-side and server-side code is preserved inside the `/legacy` folder.
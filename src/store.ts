import { create } from 'zustand';
import type { ChatMessage, PlatformFilter, PlatformConnection, AppSettings } from './types';

interface AppState {
  // Chat messages
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage, fromSync?: boolean) => void;
  clearMessages: (fromSync?: boolean) => void;

  // Platform connections
  twitch: PlatformConnection;
  youtube: PlatformConnection;
  setTwitchConnection: (conn: Partial<PlatformConnection>) => void;
  setYoutubeConnection: (conn: Partial<PlatformConnection>) => void;

  // Filter
  filter: PlatformFilter;
  setFilter: (filter: PlatformFilter) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>, fromSync?: boolean) => void;

  // Derived
  filteredMessages: () => ChatMessage[];
  messageCount: () => { total: number; twitch: number; youtube: number };
}

const DEFAULT_SETTINGS: AppSettings = {
  maxMessages: 500,
  overlayFadeTime: 0,
  overlayMaxMessages: 0,
  obsPort: 9527,
  youtubeMode: 'scraper',
  youtubeApiKey: '',
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem('sca-settings');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

const inTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

// BroadcastChannel to sync messages across different views (e.g. OBS Docks and Browser Sources)
const syncChannel = typeof window !== 'undefined' ? new BroadcastChannel('sca-messages-sync') : null;

export const useAppStore = create<AppState>((set, get) => {
  return {
    messages: [],
    addMessage: (msg, fromSync = false) => {
      if (!fromSync) {
        if (syncChannel) {
          syncChannel.postMessage({ type: 'ADD_MESSAGE', payload: msg });
        }
        if (inTauri) {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('broadcast_chat_message', { msg }).catch((e) =>
              console.error('Failed to broadcast via Rust:', e)
            );
          });
        }
      }
      set((state) => {
        const maxMessages = state.settings.maxMessages;
        const updated = [...state.messages, msg];
        if (updated.length > maxMessages + 100) {
          return { messages: updated.slice(-maxMessages) };
        }
        return { messages: updated };
      });
    },
    clearMessages: (fromSync = false) => {
      if (!fromSync) {
        if (syncChannel) {
          syncChannel.postMessage({ type: 'CLEAR_MESSAGES' });
        }
        if (inTauri) {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('clear_chat_messages').catch((e) =>
              console.error('Failed to clear via Rust:', e)
            );
          });
        }
      }
      set({ messages: [] });
    },

    twitch: { status: 'disconnected' },
    youtube: { status: 'disconnected' },
    setTwitchConnection: (conn) =>
      set((state) => ({ twitch: { ...state.twitch, ...conn } })),
    setYoutubeConnection: (conn) =>
      set((state) => ({ youtube: { ...state.youtube, ...conn } })),

    filter: 'all',
    setFilter: (filter) => set({ filter }),

    settings: loadSettings(),
    updateSettings: (partial, fromSync = false) =>
      set((state) => {
        const updated = { ...state.settings, ...partial };
        localStorage.setItem('sca-settings', JSON.stringify(updated));
        if (!fromSync) {
          if (syncChannel) {
            syncChannel.postMessage({ type: 'UPDATE_SETTINGS', payload: partial });
          }
          if (inTauri) {
            import('@tauri-apps/api/core').then(({ invoke }) => {
              invoke('broadcast_settings', { settings: updated }).catch((e) =>
                console.error('Failed to broadcast settings:', e)
              );
            });
          }
        }
        return { settings: updated };
      }),

    filteredMessages: () => {
      const { messages, filter } = get();
      if (filter === 'all') return messages;
      return messages.filter((m) => m.platform === filter);
    },

    messageCount: () => {
      const { messages } = get();
      return {
        total: messages.length,
        twitch: messages.filter((m) => m.platform === 'twitch').length,
        youtube: messages.filter((m) => m.platform === 'youtube').length,
      };
    },
  };
});

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'ADD_MESSAGE') {
      const state = useAppStore.getState();
      if (!state.messages.some((m) => m.id === payload.id)) {
        state.addMessage(payload, true);
      }
    } else if (type === 'CLEAR_MESSAGES') {
      useAppStore.getState().clearMessages(true);
    } else if (type === 'UPDATE_SETTINGS') {
      useAppStore.getState().updateSettings(payload, true);
    }
  };
}

if (typeof window !== 'undefined' && !inTauri) {
  const connectSSE = () => {
    console.log('Connecting to Stream Chat SSE Broadcast Server on http://localhost:9528...');
    const eventSource = new EventSource('http://localhost:9528');

    eventSource.onmessage = (event) => {
      if (event.data === 'CLEAR') {
        useAppStore.getState().clearMessages(true);
        return;
      }
      if (event.data.startsWith('SETTINGS:')) {
        try {
          const settingsStr = event.data.substring(9);
          const settings = JSON.parse(settingsStr);
          useAppStore.getState().updateSettings(settings, true);
          console.log('Received settings via SSE:', settings);
        } catch (e) {
          console.error('Error parsing SSE settings:', e);
        }
        return;
      }
      try {
        const msg = JSON.parse(event.data);
        const state = useAppStore.getState();
        if (!state.messages.some((m) => m.id === msg.id)) {
          state.addMessage(msg, true);
        }
      } catch (e) {
        console.error('Error parsing SSE message:', e);
      }
    };

    eventSource.onerror = () => {
      console.log('SSE connection lost, reconnecting in 3s...');
      eventSource.close();
      setTimeout(connectSSE, 3000);
    };
  };

  connectSSE();
}

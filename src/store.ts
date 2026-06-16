import { create } from 'zustand';
import type { ChatMessage, PlatformFilter, PlatformConnection, AppSettings } from './types';

interface AppState {
  // Chat messages
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

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
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Derived
  filteredMessages: () => ChatMessage[];
  messageCount: () => { total: number; twitch: number; youtube: number };
}

const DEFAULT_SETTINGS: AppSettings = {
  maxMessages: 500,
  overlayFadeTime: 15,
  overlayMaxMessages: 20,
  obsPort: 9527,
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

export const useAppStore = create<AppState>((set, get) => {
  return {
    messages: [],
    addMessage: (msg) =>
      set((state) => {
        const maxMessages = state.settings.maxMessages;
        const updated = [...state.messages, msg];
        if (updated.length > maxMessages + 100) {
          return { messages: updated.slice(-maxMessages) };
        }
        return { messages: updated };
      }),
    clearMessages: () => set({ messages: [] }),

    twitch: { status: 'disconnected' },
    youtube: { status: 'disconnected' },
    setTwitchConnection: (conn) =>
      set((state) => ({ twitch: { ...state.twitch, ...conn } })),
    setYoutubeConnection: (conn) =>
      set((state) => ({ youtube: { ...state.youtube, ...conn } })),

    filter: 'all',
    setFilter: (filter) => set({ filter }),

    settings: loadSettings(),
    updateSettings: (partial) =>
      set((state) => {
        const updated = { ...state.settings, ...partial };
        localStorage.setItem('sca-settings', JSON.stringify(updated));
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

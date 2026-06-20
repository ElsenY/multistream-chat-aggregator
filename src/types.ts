export interface ChatMessage {
  id: string;
  platform: 'twitch' | 'youtube';
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  color?: string;
  isMod?: boolean;
  isSubscriber?: boolean;
  isOwner?: boolean;
}

export interface TwitchConfig {
  channel: string;
}

export interface AppSettings {
  maxMessages: number;
  overlayFadeTime: number;
  overlayMaxMessages: number;
  obsPort: number;
  youtubeMode: 'scraper' | 'api';
  youtubeApiKey?: string;
}

export type PlatformFilter = 'all' | 'twitch' | 'youtube';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PlatformConnection {
  status: ConnectionStatus;
  channel?: string;
  error?: string;
}

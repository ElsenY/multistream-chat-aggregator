export type ChatMessagePart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'emote';
      text: string;
      id: string;
      imageUrl: string;
    };

export interface ChatMessage {
  id: string;
  platform: 'twitch' | 'youtube';
  username: string;
  displayName: string;
  message: string;
  /** Ordered rich content. Falls back to `message` when omitted. */
  parts?: ChatMessagePart[];
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
  youtubeApiKey?: string;
  twitchChannel?: string;
  youtubeChannel?: string;
  maxRetries?: number;
}

export type PlatformFilter = 'all' | 'twitch' | 'youtube';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PlatformConnection {
  status: ConnectionStatus;
  channel?: string;
  error?: string;
}

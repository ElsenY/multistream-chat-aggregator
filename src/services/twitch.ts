import type { ChatMessage } from '../types';

/**
 * Twitch IRC WebSocket client.
 * Connects anonymously (justinfan) to read chat — no OAuth required.
 */
export class TwitchChatClient {
  private ws: WebSocket | null = null;
  private channel: string = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: string, error?: string) => void;
  private shouldReconnect = false;
  private messageId = 0;

  constructor(
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: string, error?: string) => void
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect(channel: string) {
    this.channel = channel.toLowerCase().replace(/^#/, '');
    this.shouldReconnect = true;
    this.onStatusChange('connecting');
    this.doConnect();
  }

  private doConnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      // Request capabilities for user metadata (colors, badges, etc.)
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      // Anonymous login — justinfan + random number
      ws.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
      ws.send(`JOIN #${this.channel}`);
      this.onStatusChange('connected');
    };

    ws.onmessage = (event) => {
      const lines = event.data.split('\r\n').filter(Boolean);
      for (const line of lines) {
        this.parseLine(line);
      }
    };

    ws.onerror = () => {
      this.onStatusChange('error', 'WebSocket connection error');
    };

    ws.onclose = () => {
      if (this.shouldReconnect) {
        this.onStatusChange('connecting');
        this.reconnectTimer = setTimeout(() => this.doConnect(), 3000);
      } else {
        this.onStatusChange('disconnected');
      }
    };

    this.ws = ws;
  }

  private parseLine(raw: string) {
    // Respond to PING to keep connection alive
    if (raw.startsWith('PING')) {
      this.ws?.send('PONG :tmi.twitch.tv');
      return;
    }

    // Parse PRIVMSG (chat messages)
    // Format: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const privmsgMatch = raw.match(
      /^(@\S+)\s:(\w+)!\w+@\w+\.tmi\.twitch\.tv\sPRIVMSG\s#\w+\s:(.+)$/
    );

    if (!privmsgMatch) return;

    const [, tagsStr, username, message] = privmsgMatch;

    // Parse tags
    const tags: Record<string, string> = {};
    tagsStr.slice(1).split(';').forEach((tag) => {
      const [key, val] = tag.split('=');
      tags[key] = val || '';
    });

    const chatMsg: ChatMessage = {
      id: `tw-${++this.messageId}-${Date.now()}`,
      platform: 'twitch',
      username: username,
      displayName: tags['display-name'] || username,
      message: message,
      timestamp: Date.now(),
      color: tags['color'] || this.generateColor(username),
      isMod: tags['mod'] === '1',
      isSubscriber: tags['subscriber'] === '1',
      isOwner: username.toLowerCase() === this.channel,
    };

    this.onMessage(chatMsg);
  }

  private generateColor(username: string): string {
    // Generate a consistent color from username for users without a set color
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 65%)`;
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange('disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

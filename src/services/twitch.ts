import type { ChatMessage, ChatMessagePart } from '../types';

const TWITCH_EMOTE_CDN = 'https://static-cdn.jtvnw.net/emoticons/v2';

interface EmoteOccurrence {
  id: string;
  start: number;
  end: number;
}

/**
 * Converts Twitch's `emotes` IRC tag into renderable, ordered message parts.
 * Twitch ranges are inclusive and refer to character positions in the message.
 */
export function parseTwitchEmoteParts(
  message: string,
  emotesTag: string
): ChatMessagePart[] | undefined {
  if (!emotesTag) return undefined;

  const characters = Array.from(message);
  const occurrences: EmoteOccurrence[] = [];

  for (const emoteEntry of emotesTag.split('/')) {
    const separatorIndex = emoteEntry.indexOf(':');
    if (separatorIndex <= 0) continue;

    const id = emoteEntry.slice(0, separatorIndex);
    const ranges = emoteEntry.slice(separatorIndex + 1);

    for (const range of ranges.split(',')) {
      const [startValue, endValue] = range.split('-');
      const start = Number.parseInt(startValue, 10);
      const end = Number.parseInt(endValue, 10);

      if (
        Number.isInteger(start)
        && Number.isInteger(end)
        && start >= 0
        && end >= start
        && end < characters.length
      ) {
        occurrences.push({ id, start, end });
      }
    }
  }

  if (occurrences.length === 0) return undefined;
  occurrences.sort((a, b) => a.start - b.start || a.end - b.end);

  const parts: ChatMessagePart[] = [];
  let cursor = 0;

  for (const occurrence of occurrences) {
    // Ignore malformed overlapping ranges rather than duplicating message text.
    if (occurrence.start < cursor) continue;

    if (occurrence.start > cursor) {
      parts.push({
        type: 'text',
        text: characters.slice(cursor, occurrence.start).join(''),
      });
    }

    const emoteText = characters.slice(occurrence.start, occurrence.end + 1).join('');
    parts.push({
      type: 'emote',
      id: occurrence.id,
      text: emoteText,
      imageUrl: `${TWITCH_EMOTE_CDN}/${encodeURIComponent(occurrence.id)}/static/dark/1.0`,
    });
    cursor = occurrence.end + 1;
  }

  if (cursor < characters.length) {
    parts.push({ type: 'text', text: characters.slice(cursor).join('') });
  }

  return parts.length > 0 ? parts : undefined;
}

function normalizeTwitchMessage(message: string): string {
  if (!message.startsWith('\u0001ACTION ')) return message;

  const action = message.slice('\u0001ACTION '.length);
  return action.endsWith('\u0001') ? action.slice(0, -1) : action;
}

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
  private maxRetries = 5;
  private retryCount = 0;
  private joined = false;
  private terminalError = false;

  constructor(
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: string, error?: string) => void,
    maxRetries?: number
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.maxRetries = maxRetries ?? 5;
  }

  connect(channel: string) {
    this.channel = channel.trim().toLowerCase().replace(/^#/, '');
    this.shouldReconnect = true;
    this.terminalError = false;
    this.retryCount = 0;
    this.onStatusChange('connecting');
    this.doConnect();
  }

  private doConnect() {
    this.joined = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    ws.onopen = () => {
      // Anonymous login — justinfan + random number
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(Math.random() * 99999)}`);
      // Request capabilities for user metadata (colors, badges, etc.)
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
      ws.send(`JOIN #${this.channel}`);
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
      if (this.terminalError) return;
      if (this.shouldReconnect) {
        if (this.retryCount >= this.maxRetries) {
          this.shouldReconnect = false;
          this.onStatusChange('error', `Disconnected. Max reconnection attempts (${this.maxRetries}) reached.`);
          return;
        }
        this.retryCount++;
        this.onStatusChange('connecting');
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // exponential backoff capped at 30s
        console.log(`Twitch reconnect attempt ${this.retryCount}/${this.maxRetries} in ${delay}ms`);
        this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
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

    const joinedChannel = raw.match(/\sJOIN\s#([^\s]+)/)?.[1]
      || raw.match(/\sROOMSTATE\s#([^\s]+)/)?.[1];
    if (joinedChannel?.toLowerCase() === this.channel && !this.joined) {
      this.joined = true;
      this.retryCount = 0;
      this.onStatusChange('connected');
      return;
    }

    if (
      raw.includes(' NOTICE ')
      && /msg_channel_suspended|msg_banned|msg_room_not_found|no_permission|authentication failed/i.test(raw)
    ) {
      this.shouldReconnect = false;
      this.terminalError = true;
      this.onStatusChange('error', 'Twitch rejected the channel join request.');
      this.ws?.close();
      return;
    }

    // Parse PRIVMSG (chat messages)
    // Format: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
    const privmsgMatch = raw.match(
      /^(@\S+)\s:(\w+)!\w+@\w+\.tmi\.twitch\.tv\sPRIVMSG\s#\w+\s:(.+)$/
    );

    if (!privmsgMatch) return;

    const [, tagsStr, username, rawMessage] = privmsgMatch;

    // Parse tags
    const tags: Record<string, string> = {};
    tagsStr.slice(1).split(';').forEach((tag) => {
      const [key, val] = tag.split('=');
      tags[key] = val || '';
    });

    const message = normalizeTwitchMessage(rawMessage);
    const parts = parseTwitchEmoteParts(message, tags['emotes']);

    const chatMsg: ChatMessage = {
      // Twitch supplies the same message ID to every IRC client, which lets
      // the store recognize a message received through more than one path.
      id: tags['id'] || `tw-${++this.messageId}-${Date.now()}`,
      platform: 'twitch',
      username: username,
      displayName: tags['display-name'] || username,
      message: message,
      parts,
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

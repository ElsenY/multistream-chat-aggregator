import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage } from '../types';

/**
 * YouTube Live Chat client using a hidden Tauri Webview spawned from Rust.
 * This directly embeds the YouTube chat UI and scrapes the DOM to bypass Google's bot protection.
 */
export class YouTubeChatClient {
  private videoId: string = '';
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: string, error?: string) => void;
  private shouldPoll = false;
  private messageId = 0;
  private broadcastTitle: string = '';
  private unlistenMessage: UnlistenFn | null = null;

  constructor(
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: string, error?: string) => void
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connectToVideo(urlOrId: string) {
    this.videoId = this.extractVideoId(urlOrId);
    this.shouldPoll = true;
    this.onStatusChange('connecting');
    this.broadcastTitle = `YouTube Stream`;

    try {
      // 1. Clean up any existing hidden webview
      await this.cleanupWebview();

      // 2. Set up event listener for messages BEFORE creating the webview
      this.unlistenMessage = await listen('youtube-chat-message', (event) => {
        const payload = event.payload as any;
        const chatMsg: ChatMessage = {
          id: `yt-${++this.messageId}-${Date.now()}`,
          platform: 'youtube',
          username: payload.authorId || payload.authorName,
          displayName: payload.authorName || 'Unknown',
          message: payload.message,
          timestamp: payload.timestamp > 0 ? payload.timestamp : Date.now(),
          color: this.generateColor(payload.authorName || 'Unknown'),
          isMod: payload.isMod,
          isOwner: payload.isOwner,
          isSubscriber: payload.isSponsor
        };
        this.onMessage(chatMsg);
      });

      // 3. Spawn the hidden webview using our Rust backend command
      await invoke('spawn_youtube_webview', { videoId: this.videoId });
      console.log('Hidden YouTube webview spawned via Rust');

      this.onStatusChange('connected');
    } catch (err: any) {
      console.error('YouTube connect error:', err);
      this.onStatusChange('error', `Connect Error: ${err.message || err.toString()}`);
      this.shouldPoll = false;
    }
  }

  private async cleanupWebview() {
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }
    
    try {
      await invoke('close_youtube_webview');
    } catch (e) {
      console.error("Error closing old webview", e);
    }
  }

  private extractVideoId(input: string): string {
    try {
      const url = new URL(input);
      if (url.hostname.includes('youtube.com')) {
        if (url.pathname.startsWith('/live/')) {
          return url.pathname.split('/')[2];
        }
        return url.searchParams.get('v') || input;
      }
      if (url.hostname === 'youtu.be') {
        return url.pathname.slice(1);
      }
    } catch {
      // Ignore if not a valid URL
    }
    return input.trim();
  }

  private generateColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 60%)`;
  }

  getBroadcastTitle(): string {
    return this.broadcastTitle;
  }

  disconnect() {
    this.shouldPoll = false;
    this.cleanupWebview();
    this.videoId = '';
    this.messageId = 0;
    this.broadcastTitle = '';
    this.onStatusChange('disconnected');
  }

  isConnected(): boolean {
    return this.shouldPoll && this.videoId !== '';
  }
}

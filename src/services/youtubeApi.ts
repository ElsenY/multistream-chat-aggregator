import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ChatMessage } from '../types';

export class YouTubeApiChatClient {
  private videoId: string = '';
  private liveChatId: string = '';
  private apiKey: string = '';
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: string, error?: string) => void;
  
  private unlistenMessage: UnlistenFn | null = null;
  private isConnectedFlag: boolean = false;

  constructor(
    apiKey: string,
    onMessage: (msg: ChatMessage) => void,
    onStatusChange: (status: string, error?: string) => void
  ) {
    this.apiKey = apiKey;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  private extractVideoId(urlOrId: string): string {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = urlOrId.match(regex);
    return match ? match[1] : urlOrId;
  }

  async resolveActiveLiveStream(handle: string): Promise<string> {
    const formattedHandle = handle.trim();
    // 1. Fetch Channel ID by handle
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(formattedHandle)}&key=${this.apiKey}`
    );
    const channelData = await channelRes.json();

    if (channelData.error) {
      throw new Error(channelData.error.message || 'YouTube API Error fetching channel');
    }

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`YouTube channel with handle "${formattedHandle}" not found.`);
    }

    const channelId = channelData.items[0].id;

    // 2. Search for active live stream of this channel
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&eventType=live&key=${this.apiKey}`
    );
    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(searchData.error.message || 'YouTube API Error searching live stream');
    }

    if (!searchData.items || searchData.items.length === 0) {
      throw new Error(`No active live stream found for channel "${formattedHandle}".`);
    }

    return searchData.items[0].id.videoId;
  }

  async connectToVideo(urlOrId: string) {
    this.onStatusChange('connecting');
    this.isConnectedFlag = true;

    try {
      // 1. Clean up existing stream
      await this.disconnect();
      this.isConnectedFlag = true;

      // 2. If it's a handle, resolve it to active livestream video ID
      let resolvedId = urlOrId;
      if (urlOrId.trim().startsWith('@')) {
        resolvedId = await this.resolveActiveLiveStream(urlOrId);
      }
      this.videoId = this.extractVideoId(resolvedId);

      // 3. Fetch the Live Chat ID from the video info
      const videoRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${this.videoId}&key=${this.apiKey}`);
      const videoData = await videoRes.json();

      if (videoData.error) {
        throw new Error(videoData.error.message || 'YouTube API Error');
      }

      if (!videoData.items || videoData.items.length === 0) {
        throw new Error('Video not found. Ensure it is a valid YouTube Live Video ID.');
      }

      const liveStreamingDetails = videoData.items[0].liveStreamingDetails;
      if (!liveStreamingDetails || !liveStreamingDetails.activeLiveChatId) {
        throw new Error('This video does not have an active live chat.');
      }

      this.liveChatId = liveStreamingDetails.activeLiveChatId;

      // 4. Register the Tauri event listener
      this.unlistenMessage = await listen<ChatMessage>('youtube-grpc-message', (event) => {
        this.onMessage(event.payload);
      });

      // 5. Start the gRPC stream in the Rust backend
      await invoke('start_youtube_grpc_stream', {
        apiKey: this.apiKey,
        liveChatId: this.liveChatId,
      });

      this.onStatusChange('connected');

    } catch (e: any) {
      console.error('YouTube API Connect Error:', e);
      this.isConnectedFlag = false;
      this.onStatusChange('error', e.message || 'Failed to connect via API');
    }
  }

  async disconnect() {
    this.isConnectedFlag = false;
    
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }

    try {
      await invoke('close_youtube_grpc_stream');
    } catch (e) {
      console.error('Error stopping YouTube gRPC stream:', e);
    }
    
    this.onStatusChange('disconnected');
  }

  getBroadcastTitle(): string {
    return this.videoId ? `yt:${this.videoId}` : '';
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }
}

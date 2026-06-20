import { ChatMessage } from '../types';

export class YouTubeApiChatClient {
  private videoId: string = '';
  private liveChatId: string = '';
  private apiKey: string = '';
  private onMessage: (msg: ChatMessage) => void;
  private onStatusChange: (status: string, error?: string) => void;
  
  private messageId: number = 0;
  private pollIntervalId: any = null;
  private isDisconnecting: boolean = false;
  private nextPageToken: string = '';

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

  private generateColor(username: string): string {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 80%, 65%)`;
  }

  async connectToVideo(urlOrId: string) {
    this.videoId = this.extractVideoId(urlOrId);
    this.isDisconnecting = false;
    this.onStatusChange('connecting');

    try {
      // 1. Get Live Chat ID
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
      
      this.onStatusChange('connected');
      
      // 2. Start polling messages
      this.pollMessages();

    } catch (e: any) {
      console.error('YouTube API Error:', e);
      this.onStatusChange('error', e.message || 'Failed to connect via API');
    }
  }

  private async pollMessages() {
    if (this.isDisconnecting) return;

    try {
      let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${this.liveChatId}&part=snippet,authorDetails&key=${this.apiKey}`;
      if (this.nextPageToken) {
        url += `&pageToken=${this.nextPageToken}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        if (data.error.errors && data.error.errors[0].reason === 'quotaExceeded') {
           throw new Error('YouTube API Quota Exceeded! Check your Google Cloud limits.');
        }
        throw new Error(data.error.message || 'Polling error');
      }

      // Next page token
      this.nextPageToken = data.nextPageToken;
      // The API specifies how long to wait before the next request
      const pollingIntervalMillis = data.pollingIntervalMillis || 3000;

      if (data.items) {
        for (const item of data.items) {
          const author = item.authorDetails;
          const snippet = item.snippet;

          if (snippet.type === 'textMessageEvent') {
            const chatMsg: ChatMessage = {
              id: item.id,
              platform: 'youtube',
              username: author.channelId,
              displayName: author.displayName,
              message: snippet.displayMessage,
              timestamp: new Date(snippet.publishedAt).getTime(),
              color: this.generateColor(author.displayName),
              isMod: author.isChatModerator,
              isOwner: author.isChatOwner,
              isSubscriber: author.isChatSponsor
            };
            this.onMessage(chatMsg);
          }
        }
      }

      if (!this.isDisconnecting) {
        this.pollIntervalId = setTimeout(() => this.pollMessages(), pollingIntervalMillis);
      }

    } catch (e: any) {
      console.error('YouTube API Polling Error:', e);
      // Wait before retrying or show error
      if (!this.isDisconnecting) {
        this.pollIntervalId = setTimeout(() => this.pollMessages(), 5000);
      }
    }
  }

  disconnect() {
    this.isDisconnecting = true;
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.onStatusChange('disconnected');
  }

  getBroadcastTitle(): string {
    return this.videoId ? `yt:${this.videoId}` : '';
  }
}

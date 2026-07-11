import { useAppStore } from '../store';
import type { ChatMessage, ConnectionStatus } from '../types';
import { TwitchChatClient } from './twitch';
import { YouTubeApiChatClient } from './youtubeApi';

class ConnectionManager {
  private twitchClient: TwitchChatClient | null = null;
  private youtubeClient: YouTubeApiChatClient | null = null;
  private youtubeTransition: Promise<void> = Promise.resolve();
  private twitchAttempt = 0;
  private youtubeAttempt = 0;
  private autoConnectStarted = false;

  startAutoConnect() {
    if (this.autoConnectStarted) return;
    this.autoConnectStarted = true;

    const { settings } = useAppStore.getState();
    if (settings.twitchChannel?.trim()) {
      this.connectTwitch(settings.twitchChannel);
    }
    if (settings.youtubeChannel?.trim() && settings.youtubeApiKey?.trim()) {
      void this.connectYouTube(settings.youtubeChannel);
    }
  }

  connectTwitch(channelInput: string) {
    const channel = channelInput.trim();
    if (!channel) return;

    const attempt = ++this.twitchAttempt;
    const oldClient = this.twitchClient;
    this.twitchClient = null;
    oldClient?.disconnect();

    const { addMessage, setTwitchConnection, settings } = useAppStore.getState();
    let client!: TwitchChatClient;
    const isCurrent = () => attempt === this.twitchAttempt && this.twitchClient === client;

    client = new TwitchChatClient(
      (message: ChatMessage) => {
        if (isCurrent()) addMessage(message);
      },
      (status: string, error?: string) => {
        if (!isCurrent()) return;
        setTwitchConnection({
          status: status as ConnectionStatus,
          channel,
          error,
        });
      },
      settings.maxRetries
    );

    this.twitchClient = client;
    client.connect(channel);
  }

  disconnectTwitch() {
    ++this.twitchAttempt;
    const client = this.twitchClient;
    this.twitchClient = null;
    client?.disconnect();
    useAppStore.getState().setTwitchConnection({
      status: 'disconnected',
      error: undefined,
    });
  }

  connectYouTube(inputValue: string): Promise<void> {
    const input = inputValue.trim();
    if (!input) return Promise.resolve();

    const attempt = ++this.youtubeAttempt;
    this.youtubeClient?.cancel();
    const transition = this.youtubeTransition.then(() => this.performYouTubeConnect(input, attempt));
    this.youtubeTransition = transition.catch(() => undefined);
    return transition;
  }

  private async performYouTubeConnect(input: string, attempt: number) {
    const oldClient = this.youtubeClient;
    this.youtubeClient = null;
    oldClient?.cancel();
    if (oldClient) await oldClient.disconnect({ notify: false });
    if (attempt !== this.youtubeAttempt) return;

    const { addMessage, setYoutubeConnection, settings } = useAppStore.getState();
    const apiKey = settings.youtubeApiKey?.trim() || '';
    let client!: YouTubeApiChatClient;
    const isCurrent = () => attempt === this.youtubeAttempt && this.youtubeClient === client;

    client = new YouTubeApiChatClient(
      apiKey,
      (message: ChatMessage) => {
        if (isCurrent()) addMessage(message);
      },
      (status: string, error?: string) => {
        if (!isCurrent()) return;
        setYoutubeConnection({
          status: status as ConnectionStatus,
          channel: client.getBroadcastTitle() || input,
          error,
        });
      },
      settings.maxRetries
    );

    this.youtubeClient = client;
    await client.connectToVideo(input);
  }

  disconnectYouTube(): Promise<void> {
    const attempt = ++this.youtubeAttempt;
    this.youtubeClient?.cancel();
    const transition = this.youtubeTransition.then(() => this.performYouTubeDisconnect(attempt));
    this.youtubeTransition = transition.catch(() => undefined);
    return transition;
  }

  private async performYouTubeDisconnect(attempt: number) {
    const client = this.youtubeClient;
    this.youtubeClient = null;
    client?.cancel();
    if (client) await client.disconnect({ notify: false });
    if (attempt !== this.youtubeAttempt) return;
    useAppStore.getState().setYoutubeConnection({
      status: 'disconnected',
      error: undefined,
    });
  }

  getTwitchClient() {
    return this.twitchClient;
  }

  getYoutubeClient() {
    return this.youtubeClient;
  }
}

export const connectionManager = new ConnectionManager();

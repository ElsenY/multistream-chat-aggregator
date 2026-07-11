import { useRef, useCallback } from 'react';
import { useAppStore } from '../store';
import { ConnectionCard } from '../components/ConnectionCard';
import { connectionManager } from '../services/connectionManager';

export function Dashboard() {
  const twitch = useAppStore((s) => s.twitch);
  const youtube = useAppStore((s) => s.youtube);
  const settings = useAppStore((s) => s.settings);
  const messageCount = useAppStore((s) => s.messageCount);
  const clearMessages = useAppStore((s) => s.clearMessages);

  const counts = messageCount();
  const startTimeRef = useRef<number>(Date.now());

  // --- Twitch ---
  const handleTwitchConnect = useCallback(
    (channel: string) => connectionManager.connectTwitch(channel),
    []
  );

  const handleTwitchDisconnect = useCallback(() => {
    connectionManager.disconnectTwitch();
  }, []);

  // --- YouTube ---
  const handleYoutubeConnect = useCallback(
    (input: string) => void connectionManager.connectYouTube(input),
    []
  );

  const handleYoutubeDisconnect = useCallback(() => {
    void connectionManager.disconnectYouTube();
  }, []);

  const uptime = Math.floor((Date.now() - startTimeRef.current) / 60000);

  return (
    <div className="app-content">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Connect to your stream platforms and start aggregating chat
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Twitch Card */}
        <ConnectionCard
          platform="twitch"
          status={twitch.status}
          channel={twitch.channel}
          error={twitch.error}
          onConnect={handleTwitchConnect}
          onDisconnect={handleTwitchDisconnect}
          inputLabel="Channel Name"
          inputPlaceholder="e.g. shroud, pokimane"
          defaultInputValue={settings.twitchChannel || ''}
        />

        {/* YouTube Card */}
        <ConnectionCard
          platform="youtube"
          status={youtube.status}
          channel={youtube.channel}
          error={youtube.error}
          onConnect={handleYoutubeConnect}
          onDisconnect={handleYoutubeDisconnect}
          inputLabel="Video ID, URL, or @ChannelHandle"
          inputPlaceholder="e.g. dQw4w9WgXcQ, URL, or @LofiGirl"
          requiresApiKey={true}
          apiKeyMissing={!settings.youtubeApiKey}
          defaultInputValue={settings.youtubeChannel || ''}
        />
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="glass-card stat-card">
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">Total Messages</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ background: 'linear-gradient(135deg, #9146ff, #bf97ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {counts.twitch}
          </div>
          <div className="stat-label">Twitch Messages</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value" style={{ background: 'linear-gradient(135deg, #ff0033, #ff6666)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {counts.youtube}
          </div>
          <div className="stat-label">YouTube Messages</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value">{uptime}m</div>
          <div className="stat-label">Uptime</div>
        </div>
      </div>

      {counts.total > 0 && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => clearMessages()} id="clear-messages-btn">
            🗑️ Clear all messages
          </button>
        </div>
      )}
    </div>
  );
}

export function getTwitchClient() { return connectionManager.getTwitchClient(); }
export function getYoutubeClient() { return connectionManager.getYoutubeClient(); }

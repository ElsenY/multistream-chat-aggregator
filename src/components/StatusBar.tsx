import { useAppStore } from '../store';

export function StatusBar() {
  const twitch = useAppStore((s) => s.twitch);
  const youtube = useAppStore((s) => s.youtube);
  const messageCount = useAppStore((s) => s.messageCount);
  const counts = messageCount();

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span
          className="dot"
          style={{
            background:
              twitch.status === 'connected' || youtube.status === 'connected'
                ? 'var(--status-online)'
                : 'var(--text-tertiary)',
            boxShadow:
              twitch.status === 'connected' || youtube.status === 'connected'
                ? '0 0 6px rgba(0,230,118,0.5)'
                : 'none',
          }}
        />
        <span>
          {twitch.status === 'connected' || youtube.status === 'connected'
            ? 'Connected'
            : 'Disconnected'}
        </span>
      </div>

      <div className="statusbar-divider" />

      <div className="statusbar-item">
        <span>💬 {counts.total} messages</span>
      </div>

      {counts.twitch > 0 && (
        <>
          <div className="statusbar-divider" />
          <div className="statusbar-item">
            <span style={{ color: 'var(--accent-twitch)' }}>⬤</span>
            <span>Twitch: {counts.twitch}</span>
          </div>
        </>
      )}

      {counts.youtube > 0 && (
        <>
          <div className="statusbar-divider" />
          <div className="statusbar-item">
            <span style={{ color: 'var(--accent-youtube)' }}>⬤</span>
            <span>YouTube: {counts.youtube}</span>
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div className="statusbar-item font-mono">
        <span>OBS: localhost:9527</span>
      </div>
    </div>
  );
}

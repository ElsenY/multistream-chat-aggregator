import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [maxMessages, setMaxMessages] = useState(String(settings.maxMessages));
  const [overlayFadeTime, setOverlayFadeTime] = useState(String(settings.overlayFadeTime));
  const [overlayMaxMessages, setOverlayMaxMessages] = useState(String(settings.overlayMaxMessages));
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleSave = () => {
    const fade = parseInt(overlayFadeTime);
    updateSettings({
      maxMessages: parseInt(maxMessages) || 500,
      overlayFadeTime: fade === 0 ? 0 : (fade || 15),
      overlayMaxMessages: parseInt(overlayMaxMessages) || 20,
    });
    setSaved(true);
  };


  return (
    <div className="app-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure authentication and display preferences</p>
      </div>

      <div className="settings-page">
        {/* YouTube */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="settings-section">
            <h2 className="settings-section-title" style={{ color: 'var(--accent-youtube)' }}>
              ▶ YouTube Configuration
            </h2>
            <p className="settings-section-desc">
              Choose how you want to connect to YouTube Live Chat.
            </p>

            <div className="settings-field">
              <label>Connection Mode</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="youtubeMode"
                    value="scraper"
                    checked={settings.youtubeMode === 'scraper'}
                    onChange={() => updateSettings({ youtubeMode: 'scraper' })}
                  />
                  Webview Scraper (No API Key needed)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="youtubeMode"
                    value="api"
                    checked={settings.youtubeMode === 'api'}
                    onChange={() => updateSettings({ youtubeMode: 'api' })}
                  />
                  Data API v3 (Requires API Key)
                </label>
              </div>
            </div>

            {settings.youtubeMode === 'api' && (
              <div className="settings-field" style={{ marginTop: '1rem' }}>
                <label htmlFor="youtube-api-key">YouTube Data API v3 Key</label>
                <input
                  id="youtube-api-key"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.youtubeApiKey || ''}
                  onChange={(e) => updateSettings({ youtubeApiKey: e.target.value })}
                />
                <span className="hint">
                  Required for Data API mode. Get this from the Google Cloud Console.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Twitch */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="settings-section">
            <h2 className="settings-section-title" style={{ color: 'var(--accent-twitch)' }}>
              ⬤ Twitch Configuration
            </h2>
            <p className="settings-section-desc">
              Twitch chat is read anonymously — no API key or login required!
              Just enter a channel name on the Dashboard.
            </p>
          </div>
        </div>

        {/* Chat Display */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="settings-section">
            <h2 className="settings-section-title">Chat Display</h2>
            <p className="settings-section-desc">
              Customize how messages are displayed in the chat feed.
            </p>

            <div className="settings-field">
              <label htmlFor="max-messages">Max Messages in Feed</label>
              <input
                id="max-messages"
                type="number"
                value={maxMessages}
                onChange={(e) => setMaxMessages(e.target.value)}
                min="100"
                max="5000"
              />
              <span className="hint">
                Old messages are removed when this limit is exceeded. Default: 500.
              </span>
            </div>
          </div>
        </div>

        {/* OBS Overlay */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="settings-section">
            <h2 className="settings-section-title">OBS Overlay</h2>
            <p className="settings-section-desc">
              Configure the overlay displayed in OBS browser docks.
            </p>

            <div className="settings-field">
              <label htmlFor="overlay-fade">Message Fade Time (seconds)</label>
              <input
                id="overlay-fade"
                type="number"
                value={overlayFadeTime}
                onChange={(e) => setOverlayFadeTime(e.target.value)}
                min="0"
                max="120"
              />
              <span className="hint">
                Messages will fade out after this many seconds. Set to 0 to disable fading (messages never disappear). Default: 15.
              </span>
            </div>

            <div className="settings-field">
              <label htmlFor="overlay-max">Max Visible Messages</label>
              <input
                id="overlay-max"
                type="number"
                value={overlayMaxMessages}
                onChange={(e) => setOverlayMaxMessages(e.target.value)}
                min="5"
                max="50"
              />
              <span className="hint">
                Maximum messages visible in the overlay at once. Default: 20.
              </span>
            </div>

            <div className="settings-field" style={{ marginTop: 'var(--space-md)' }}>
              <label>OBS Browser Source URL</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  readOnly
                  value={import.meta.env.DEV ? 'http://localhost:1420/#/overlay' : 'http://127.0.0.1:9527/#/overlay'}
                  style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    padding: '0.5rem',
                    background: 'var(--bg-glass-input, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  className="btn btn-secondary"
                  style={{ whiteSpace: 'nowrap', minWidth: '90px' }}
                  onClick={() => {
                    const url = import.meta.env.DEV ? 'http://localhost:1420/#/overlay' : 'http://127.0.0.1:9527/#/overlay';
                    navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy URL'}
                </button>
              </div>
              <span className="hint">
                Add this URL as a <strong>Browser Source</strong> in OBS.
                {import.meta.env.DEV && " (During development, port 1420 is used to support hot-reloading/live style changes.)"}
              </span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="settings-actions">
          <button className="btn btn-primary btn-lg" onClick={handleSave} id="save-settings-btn">
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

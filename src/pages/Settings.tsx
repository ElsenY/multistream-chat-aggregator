import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [maxMessages, setMaxMessages] = useState(String(settings.maxMessages));
  const [overlayFadeTime, setOverlayFadeTime] = useState(String(settings.overlayFadeTime));
  const [overlayMaxMessages, setOverlayMaxMessages] = useState(String(settings.overlayMaxMessages));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleSave = () => {
    updateSettings({
      maxMessages: parseInt(maxMessages) || 500,
      overlayFadeTime: parseInt(overlayFadeTime) || 15,
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
        {/* YouTube configuration is now handled via .env and Dashboard */}

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
                min="5"
                max="120"
              />
              <span className="hint">
                Messages will fade out after this many seconds. Default: 15.
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

import { useState } from 'react';
import type { ConnectionStatus } from '../types';

interface Props {
  platform: 'twitch' | 'youtube';
  status: ConnectionStatus;
  channel?: string;
  error?: string;
  onConnect: (value: string) => void;
  onDisconnect: () => void;
  inputLabel: string;
  inputPlaceholder: string;
  requiresApiKey?: boolean;
  apiKeyMissing?: boolean;
}

export function ConnectionCard({
  platform,
  status,
  channel,
  error,
  onConnect,
  onDisconnect,
  inputLabel,
  inputPlaceholder,
  requiresApiKey,
  apiKeyMissing,
}: Props) {
  const [inputValue, setInputValue] = useState('');

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isError = status === 'error';

  const handleConnect = () => {
    const val = inputValue.trim();
    if (!val) return;
    onConnect(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
  };

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
      ? 'Connecting...'
      : status === 'error'
      ? 'Error'
      : 'Disconnected';

  const statusDotClass =
    status === 'connected'
      ? 'online'
      : status === 'connecting'
      ? 'connecting'
      : 'offline';

  return (
    <div className={`glass-card connection-card ${platform}`} id={`connection-card-${platform}`}>
      <div className="connection-card-header">
        <div className="connection-card-platform">
          <div className={`platform-icon ${platform}`}>
            {platform === 'twitch' ? '⬤' : '▶'}
          </div>
          <div>
            <div className="platform-name">
              {platform === 'twitch' ? 'Twitch' : 'YouTube'}
            </div>
            <div className="platform-status">
              <span className={`connection-dot ${statusDotClass}`} />
              {statusLabel}
            </div>
          </div>
        </div>

        {isConnected && (
          <button
            className="btn btn-danger btn-sm"
            onClick={onDisconnect}
            id={`disconnect-${platform}`}
          >
            Disconnect
          </button>
        )}
      </div>

      <div className="connection-card-body">
        {isError && error && (
          <div
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'rgba(255,82,82,0.1)',
              border: '1px solid rgba(255,82,82,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--status-offline)',
            }}
          >
            {error}
          </div>
        )}

        {requiresApiKey && apiKeyMissing && (
          <div
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'rgba(255,193,7,0.1)',
              border: '1px solid rgba(255,193,7,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--status-connecting)',
            }}
          >
            ⚠️ YouTube API key required. Add it in Settings first.
          </div>
        )}

        {!isConnected && (
          <>
            <div className="connection-card-input-group">
              <label>{inputLabel}</label>
              <input
                type="text"
                placeholder={inputPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isConnecting}
                id={`input-${platform}`}
              />
            </div>

            <button
              className={`btn ${platform === 'twitch' ? 'btn-twitch' : 'btn-youtube'}`}
              onClick={handleConnect}
              disabled={isConnecting || !inputValue.trim() || (requiresApiKey && apiKeyMissing)}
              id={`connect-${platform}`}
            >
              {isConnecting ? 'Connecting...' : `Connect to ${platform === 'twitch' ? 'Twitch' : 'YouTube'}`}
            </button>
          </>
        )}

        {isConnected && channel && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Listening to: <strong style={{ color: 'var(--text-primary)' }}>{channel}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

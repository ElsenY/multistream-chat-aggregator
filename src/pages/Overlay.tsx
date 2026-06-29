import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import type { ChatMessage } from '../types';
import { isInTauri } from '../utils/environment';

interface OverlayMessage extends ChatMessage {
  fadeOut: boolean;
}

export function Overlay() {
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const [overlayMessages, setOverlayMessages] = useState<OverlayMessage[]>([]);
  const lastProcessedRef = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);

  // Add new messages to overlay
  useEffect(() => {
    if (messages.length === 0) {
      setOverlayMessages([]);
      lastProcessedRef.current = 0;
      return;
    }

    const newMessages = messages.slice(lastProcessedRef.current);
    if (newMessages.length > 0) {
      lastProcessedRef.current = messages.length;

      setOverlayMessages((prev) => {
        const updated = [
          ...prev,
          ...newMessages.map((m) => ({ ...m, fadeOut: false })),
        ];
        // Keep only max visible
        return updated.slice(-settings.overlayMaxMessages);
      });
    }
  }, [messages, settings.overlayMaxMessages]);

  // Fade out old messages
  useEffect(() => {
    if (settings.overlayFadeTime === 0) {
      // If set to 0, never fade out and keep all messages
      setOverlayMessages((prev) => prev.map((m) => ({ ...m, fadeOut: false })));
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const fadeTime = settings.overlayFadeTime * 1000;

      setOverlayMessages((prev) => {
        const updated = prev.map((m) => ({
          ...m,
          fadeOut: now - m.timestamp > fadeTime,
        }));

        // Remove fully faded messages after animation completes
        return updated.filter((m) => now - m.timestamp < fadeTime + 600);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [settings.overlayFadeTime]);

  // Auto-scroll overlay chat to bottom on new messages
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [overlayMessages]);

  const navigate = useNavigate();

  return (
    <div className="overlay-page">
      {isInTauri() && (
        <button
          className="overlay-back-btn"
          onClick={() => navigate('/')}
          title="Back to Dashboard"
        >
          ← Back
        </button>
      )}
      <div className="overlay-chat" ref={chatRef}>
        {overlayMessages.map((msg) => (
          <div
            key={msg.id}
            className={`overlay-message ${msg.fadeOut ? 'fade-out' : ''}`}
          >
            <div className={`overlay-platform-dot ${msg.platform}`} />
            <div>
              <span
                className="overlay-username"
                style={{ color: msg.color || 'var(--accent-glow)' }}
              >
                {msg.displayName}
              </span>
              <span className="overlay-text">{msg.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

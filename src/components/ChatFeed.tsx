import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { ChatMessage } from './ChatMessage';
import type { PlatformFilter } from '../types';

export function ChatFeed() {
  const messages = useAppStore((s) => s.messages);
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const messageCount = useAppStore((s) => s.messageCount);

  const feedRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const counts = messageCount();

  const filteredMessages =
    filter === 'all' ? messages : messages.filter((m) => m.platform === filter);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAutoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [filteredMessages.length, isAutoScroll]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsAutoScroll(isAtBottom);
    setShowScrollBtn(!isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
      setIsAutoScroll(true);
      setShowScrollBtn(false);
    }
  }, []);

  const filterButtons: { label: string; value: PlatformFilter; className?: string }[] = [
    { label: `All (${counts.total})`, value: 'all' },
    { label: `Twitch (${counts.twitch})`, value: 'twitch', className: 'twitch' },
    { label: `YouTube (${counts.youtube})`, value: 'youtube', className: 'youtube' },
  ];

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-filters">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              id={`filter-${btn.value}`}
              className={`chat-filter-btn ${filter === btn.value ? `active ${btn.className || ''}` : ''}`}
              onClick={() => setFilter(btn.value)}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <span className="chat-message-count">
          {filteredMessages.length} messages
        </span>
      </div>

      <div className="relative" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="chat-feed" ref={feedRef} onScroll={handleScroll}>
          {filteredMessages.length === 0 ? (
            <div className="chat-feed-empty">
              <div className="chat-feed-empty-icon">💬</div>
              <div className="chat-feed-empty-text">
                No messages yet. Connect to a Twitch channel or YouTube stream from
                the Dashboard to start seeing chat messages here.
              </div>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))
          )}
        </div>

        {showScrollBtn && (
          <button
            className="scroll-to-bottom"
            onClick={scrollToBottom}
            id="scroll-to-bottom-btn"
          >
            ↓ New messages
          </button>
        )}
      </div>
    </div>
  );
}

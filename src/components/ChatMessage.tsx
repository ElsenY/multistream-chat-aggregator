import type { ChatMessage as ChatMessageType } from '../types';
import { MessageContent } from './MessageContent';

interface Props {
  message: ChatMessageType;
  showTimestamp?: boolean;
}

export function ChatMessage({ message, showTimestamp = true }: Props) {
  const time = new Date(message.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-message" id={`msg-${message.id}`}>
      <span className={`chat-message-platform-badge ${message.platform}`}>
        {message.platform === 'twitch' ? '⬤' : '▶'}
      </span>

      <div className="chat-message-content">
        <span
          className="chat-message-username"
          style={{ color: message.color || 'var(--accent-glow)' }}
        >
          {message.isMod && '🛡️ '}
          {message.isOwner && '👑 '}
          {message.displayName}
        </span>
        <MessageContent message={message} className="chat-message-text" />
      </div>

      {showTimestamp && (
        <span className="chat-message-time">{timeStr}</span>
      )}
    </div>
  );
}

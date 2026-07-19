import { useState } from 'react';
import type { ChatMessage, ChatMessagePart } from '../types';

interface Props {
  message: ChatMessage;
  className?: string;
}

function EmoteImage({ part }: { part: Extract<ChatMessagePart, { type: 'emote' }> }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{part.text}</>;

  return (
    <img
      className="chat-emote"
      src={part.imageUrl}
      alt={part.text}
      title={part.text}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

export function MessageContent({ message, className }: Props) {
  if (!message.parts?.length) {
    return <span className={className}>{message.message}</span>;
  }

  return (
    <span className={className}>
      {message.parts.map((part, index) => (
        part.type === 'emote'
          ? <EmoteImage key={`${part.id}-${index}`} part={part} />
          : <span key={`text-${index}`}>{part.text}</span>
      ))}
    </span>
  );
}

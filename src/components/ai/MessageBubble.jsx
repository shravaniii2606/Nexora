import React from 'react';
import './MessageBubble.css';

const MessageBubble = ({ message, sender }) => {
  return (
    <div className={`message-bubble message-${sender}`}>
      <div className="message-content">
        {message}
      </div>
    </div>
  );
};

export default MessageBubble;

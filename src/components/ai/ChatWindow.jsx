import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import './ChatWindow.css';

const ChatWindow = ({ messages }) => {
  const endOfMessagesRef = useRef(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-window">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <MessageBubble 
            key={index} 
            message={msg.text} 
            sender={msg.sender}
          />
        ))}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
};

export default ChatWindow;

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import './ChatInput.css';

const ChatInput = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <div className="input-wrapper">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          className="input-field"
          disabled={isLoading}
          rows="3"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="send-button"
          title="Send message (Enter)"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;

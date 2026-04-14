import React from 'react';
import { BarChart3, TrendingUp, Lightbulb, Zap } from 'lucide-react';
import './QuickMessages.css';

const QuickMessages = ({ onSelectMessage }) => {
  const quickMessages = [
    {
      id: 1,
      text: 'Analyse my score',
      icon: <TrendingUp size={16} />,
    },
    {
      id: 2,
      text: 'Analyse my day',
      icon: <BarChart3 size={16} />,
    },
    {
      id: 3,
      text: 'Recommendations',
      icon: <Lightbulb size={16} />,
    },
    {
      id: 4,
      text: 'View insights',
      icon: <Zap size={16} />,
    },
  ];

  return (
    <div className="quick-messages">
      <p className="quick-messages-label">Quick actions:</p>
      <div className="quick-messages-grid">
        {quickMessages.map((msg) => (
          <button
            key={msg.id}
            className="quick-message-btn"
            onClick={() => onSelectMessage(msg.text)}
            title={msg.text}
          >
            {msg.icon}
            <span>{msg.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickMessages;

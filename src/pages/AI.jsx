import React, { useState, useEffect } from 'react';
import ChatWindow from '../components/ai/ChatWindow';
import ChatInput from '../components/ai/ChatInput';
import QuickMessages from '../components/ai/QuickMessages';
import { getAiConnectionStatus, sendMessage } from '../api/openRouterApi';
import { getDailyAnalyticsHistory } from '../api/analyticsApi';
import { buildDashboardSummary } from '../utils/dashboardSummary';
import './AI.css';

const AI = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const aiStatus = getAiConnectionStatus();

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage = {
      text: 'Hello, welcome to Nexora, how can I assist you?',
      sender: 'ai',
    };
    setMessages([welcomeMessage]);
  }, []);

  const handleSendMessage = async (userMessage) => {
    const conversationHistory = messages.map((message) => ({
      role: message.sender === 'ai' ? 'assistant' : 'user',
      content: message.text,
    }));

    // Add user message
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setIsLoading(true);

    try {
      const history = await getDailyAnalyticsHistory();
      const dashboardSummary = buildDashboardSummary(history);

      // Get AI response
      const response = await sendMessage(userMessage, conversationHistory, dashboardSummary);
      
      // Add AI response
      if (response.success) {
        setMessages(prev => [...prev, { text: response.message, sender: 'ai' }]);
      } else {
        setMessages(prev => [...prev, { text: 'Sorry, I encountered an error. Please try again.', sender: 'ai' }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { text: 'Sorry, I encountered an error. Please try again.', sender: 'ai' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="breadcrumb">Pages / AI</div>
        <h1 className="page-title">AI Assistant</h1>
        <p className="page-subtitle">
          {aiStatus.hasApiKey
            ? `Connected to ${aiStatus.model}.`
            : ''}
        </p>
      </div>
      <div className="ai-container">
        <QuickMessages onSelectMessage={handleSendMessage} />
        <ChatWindow messages={messages} />
        <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default AI;

// Mock AI responses for development
const mockResponses = [
  "That's a great question about your focus patterns. Based on your data, I can see you're making progress!",
  "I notice you've been building strong streaks lately. Keep up the good work!",
  "Let me help you understand your distraction patterns and how to overcome them.",
  "Your resilience score shows you're developing better habits. What area would you like to improve?",
  "I'm here to help you analyze your activity and suggest improvements.",
];

export const sendMessage = async (userMessage) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return a mock response
  const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  
  return {
    success: true,
    message: randomResponse,
  };
};

// Placeholder for real API integration with OpenRouter
export const sendMessageToOpenRouter = async (userMessage, conversationHistory) => {
  try {
    const apiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    
    if (!apiKey) {
      console.warn('OpenRouter API key not found. Using mock responses.');
      return sendMessage(userMessage);
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return {
      success: true,
      message: data.choices[0].message.content,
    };
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    // Fallback to mock response
    return sendMessage(userMessage);
  }
};

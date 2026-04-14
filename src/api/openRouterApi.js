const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Nexora';

const mockResponses = [
  "That's a great question about your focus patterns. Based on your data, I can see you're making progress!",
  "I notice you've been building strong streaks lately. Keep up the good work!",
  "Let me help you understand your distraction patterns and how to overcome them.",
  "Your resilience score shows you're developing better habits. What area would you like to improve?",
  "I'm here to help you analyze your activity and suggest improvements.",
];

const sanitizeAiMessage = (message) =>
  message
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();

const buildSystemPrompt = (dashboardSummary = '') => `
You are Nexora's AI assistant.
Help users understand focus patterns, resilience score, rabbit holes, streaks, and escape time.
Be concise, supportive, and actionable.
When the user asks for advice, give practical steps tailored to their focus and productivity habits.
Format responses so they are easy to read in a chat UI:
- use short paragraphs
- put distinct points on separate lines
- use plain text only
- do not use markdown
- do not use # headings
- do not use * bullets
- do not use - bullets
- keep the response simple and clean
Use the dashboard snapshot below as live app context when answering questions about the user's progress.

${dashboardSummary}
`;

const getMockResponse = async () => {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    success: true,
    message: mockResponses[Math.floor(Math.random() * mockResponses.length)],
  };
};

export const sendMessage = async (userMessage, conversationHistory = [], dashboardSummary = '') => {
  if (!OPENROUTER_API_KEY) {
    return getMockResponse();
  }

  try {
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(dashboardSummary).trim(),
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': APP_NAME,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      throw new Error('OpenRouter returned an empty response.');
    }

    return {
      success: true,
      message: sanitizeAiMessage(message),
    };
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    return getMockResponse();
  }
};

export const getAiConnectionStatus = () => ({
  hasApiKey: Boolean(OPENROUTER_API_KEY),
  model: OPENROUTER_MODEL,
});

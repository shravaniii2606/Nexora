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
    isMock: true,
    error: null,
    message: mockResponses[Math.floor(Math.random() * mockResponses.length)],
  };
};

const parseOpenRouterErrorBody = (errorBody) => {
  if (!errorBody) {
    return '';
  }

  try {
    const parsed = JSON.parse(errorBody);
    return (
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.error ||
      ''
    );
  } catch {
    return errorBody;
  }
};

const getFriendlyOpenRouterError = (status, details = '') => {
  const normalizedDetails = details.toLowerCase();

  switch (status) {
    case 400:
      return 'The AI request was rejected because it was malformed.';
    case 401:
      return 'The OpenRouter API key is invalid or expired.';
    case 402:
      if (
        normalizedDetails.includes('credit') ||
        normalizedDetails.includes('payment') ||
        normalizedDetails.includes('quota') ||
        normalizedDetails.includes('balance')
      ) {
        return 'The AI request could not be completed because the OpenRouter account has no available credits or quota.';
      }
      return 'The AI request could not be completed because the OpenRouter account needs billing or credits.';
    case 403:
      return 'The OpenRouter request was blocked. Check the model and account permissions.';
    case 404:
      return 'The selected AI model was not found on OpenRouter.';
    case 429:
      return 'Too many AI requests were sent too quickly. Please wait a moment and try again.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'OpenRouter is temporarily unavailable. Please try again shortly.';
    default:
      return `The AI request failed with OpenRouter HTTP ${status}.`;
  }
};

export const sendMessage = async (userMessage, conversationHistory = [], dashboardSummary = '') => {
  if (!OPENROUTER_API_KEY) {
    const mock = await getMockResponse();
    return {
      ...mock,
      error: 'missing_api_key',
    };
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
      const errorBody = await response.text();
      const details = parseOpenRouterErrorBody(errorBody);
      return {
        success: false,
        message: '',
        isMock: false,
        error: `openrouter_http_${response.status}`,
        details,
        friendlyMessage: getFriendlyOpenRouterError(response.status, details),
      };
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      throw new Error('OpenRouter returned an empty response.');
    }

    return {
      success: true,
      isMock: false,
      error: null,
      message: sanitizeAiMessage(message),
    };
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    const mock = await getMockResponse();
    return {
      ...mock,
      error: error instanceof Error ? error.message : 'unknown_error',
      friendlyMessage: 'The live AI service was unavailable, so a fallback response was used.',
    };
  }
};

export const getAiConnectionStatus = () => ({
  hasApiKey: Boolean(OPENROUTER_API_KEY),
  model: OPENROUTER_MODEL,
});

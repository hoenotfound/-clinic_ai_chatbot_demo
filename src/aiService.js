const { buildSystemPrompt } = require("./systemPrompt");
const clinic = require("./clinicConfig");

const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const SUPPORTED_PROVIDERS = new Set(["mock", "claude", "gemini"]);
if (!SUPPORTED_PROVIDERS.has(provider)) {
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

const configured = provider === "mock" ||
  (provider === "claude" && Boolean(process.env.ANTHROPIC_API_KEY)) ||
  (provider === "gemini" && Boolean(process.env.GEMINI_API_KEY));

function mockReply(messages) {
  const latest = (messages.at(-1)?.content || "").toLowerCase();
  const userMessages = messages.filter((message) => message.role === "user");
  const bookingPattern = /book|appointment|slot|come in|saturday|sunday|weekend|tomorrow/;
  const negativePattern = /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel|no thanks/;
  const latestIntent = [...userMessages]
    .reverse()
    .find((message) => bookingPattern.test(message.content.toLowerCase()) || negativePattern.test(message.content.toLowerCase()));
  const reducedInterestActive = negativePattern.test((latestIntent?.content || "").toLowerCase());

  if (negativePattern.test(latest)) {
    return "No worries at all 😊 If you need anything later, you can message us again anytime.";
  }
  if (/human|staff|doctor|consultant|complain|refund/.test(latest)) {
    return "Of course. I’ll flag this for a clinic team member to step in and help you directly. [[HANDOFF]]";
  }
  if (/weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|petaling jaya|\bpj\b|kuala lumpur|\bkl\b/.test(latest) && !/book|appointment|slot/.test(latest)) {
    return "Got it 😊 I’ve noted that preference for this demo conversation. The clinic team would use it when confirming the actual appointment.";
  }
  if (/book|appointment|saturday|sunday|weekend|come in|slot/.test(latest)) {
    return "Sure 😊 Which is more convenient for you, our Kuala Lumpur branch or Petaling Jaya branch? Once you choose, the team would confirm the actual available slot.";
  }
  if (/hifu|price|how much/.test(latest)) {
    return "Our sample HIFU offer starts from RM 888 😊 It’s commonly used for lifting, tightening and jawline definition. Which area are you more concerned about, face, jawline or double chin?";
  }
  if (/pico|pigmentation|dark spot|acne/.test(latest)) {
    return "Pico Laser starts from RM 388 in this demo. It’s commonly used for pigmentation, uneven tone and selected acne marks. What’s the main skin concern you’d like to improve?";
  }
  if (reducedInterestActive) {
    return "Of course 😊 What would you like to ask?";
  }
  return `Thanks for asking 😊 ${clinic.consultation} is available. Tell me what you’d like to improve and I can point you to the most relevant option.`;
}

async function fetchJson(url, options, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.type || `${response.status} ${response.statusText}`;
      throw new Error(`${label} request failed: ${detail}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getClaudeReply(messages, isFirstMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-5";
  const data = await fetchJson(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 650,
        // Sonnet 5 enables adaptive thinking by default. This receptionist
        // demo does not need deep reasoning, so disabling it reduces latency
        // and avoids spending the small output budget on hidden thinking.
        thinking: { type: "disabled" },
        system: buildSystemPrompt({ isFirstMessage }),
        messages,
      }),
    },
    "Claude"
  );
  const block = data.content?.find((item) => item.type === "text");
  return block?.text || "Sorry, I couldn't generate a reply. Please try again.";
}

async function getGeminiReply(messages, isFirstMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt({ isFirstMessage }) }],
        },
        contents,
        generationConfig: {
          maxOutputTokens: 650,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
    "Gemini"
  );
  const text = data.candidates?.[0]?.content?.parts
    ?.filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
  return text || "Sorry, I couldn't generate a reply. Please try again.";
}

async function getReply(messages, isFirstMessage = false) {
  if (provider === "mock") return mockReply(messages);
  if (provider === "claude") return getClaudeReply(messages, isFirstMessage);
  if (provider === "gemini") return getGeminiReply(messages, isFirstMessage);
  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

module.exports = { getReply, provider, configured };

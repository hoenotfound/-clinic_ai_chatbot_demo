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

const parsedTimeout = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || "15000", 10);
const AI_REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 15000;

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
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.type || `${response.status} ${response.statusText}`;
      const apiStatus = data?.error?.status ? ` ${data.error.status}` : "";
      const details = Array.isArray(data?.error?.details) && data.error.details.length
        ? ` | details: ${JSON.stringify(data.error.details).slice(0, 1200)}`
        : "";
      const error = new Error(`${label} request failed (${response.status}${apiStatus}): ${detail}${details}`);
      error.statusCode = response.status;
      error.apiStatus = data?.error?.status || null;
      throw error;
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

function geminiThinkingConfig(model) {
  const normalized = String(model || "").toLowerCase();

  // GenerateContent uses a numeric thinking budget for the Gemini 2.5 family.
  // 2.5 Flash and Flash-Lite support 0, which is ideal for this low-latency
  // receptionist demo. 2.5 Pro cannot fully disable thinking, so leave it at
  // the model default rather than sending an invalid zero budget.
  if (/^gemini-2\.5-flash(?:-lite)?(?:-|$)/.test(normalized)) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }

  // Gemini 3+ uses thinkingLevel instead of the legacy numeric budget. Flash
  // models support minimal thinking; Pro-family models use low as the safest
  // low-latency setting.
  if (/^gemini-3(?:[.-]|$)/.test(normalized)) {
    return {
      thinkingConfig: {
        thinkingLevel: normalized.includes("flash") ? "minimal" : "low",
      },
    };
  }

  // Unknown/older model families are safest without a thinking field.
  return {};
}

function buildGeminiRequest(messages, isFirstMessage, model, { omitThinking = false } = {}) {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: String(message.content || "") }],
  }));
  const generationConfig = {
    // A fallback request without an explicit thinking control may spend part of
    // this budget on hidden reasoning, so give it more headroom than the normal
    // short receptionist response.
    maxOutputTokens: omitThinking ? 2048 : 650,
  };
  if (!omitThinking) Object.assign(generationConfig, geminiThinkingConfig(model));

  return {
    systemInstruction: {
      parts: [{ text: buildSystemPrompt({ isFirstMessage }) }],
    },
    contents,
    generationConfig,
  };
}

async function getGeminiReply(messages, isFirstMessage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestOptions = (body) => ({
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  let data;
  const primaryBody = buildGeminiRequest(messages, isFirstMessage, model);
  try {
    data = await fetchJson(url, requestOptions(primaryBody), "Gemini");
  } catch (error) {
    const hasThinkingConfig = Boolean(primaryBody.generationConfig?.thinkingConfig);
    const isInvalidArgument = error.statusCode === 400 &&
      (error.apiStatus === "INVALID_ARGUMENT" || /invalid argument/i.test(error.message));

    // Some Gemini endpoints/model revisions reject thinking controls even when
    // a closely related model accepts them. Retry once without thinkingConfig
    // instead of dropping the whole customer conversation into degraded mode.
    if (!hasThinkingConfig || !isInvalidArgument) throw error;

    console.warn(`Gemini rejected thinkingConfig for model "${model}"; retrying once without it.`);
    const fallbackBody = buildGeminiRequest(messages, isFirstMessage, model, { omitThinking: true });
    data = await fetchJson(url, requestOptions(fallbackBody), "Gemini fallback");
  }

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

module.exports = {
  getReply,
  provider,
  configured,
  _test: { geminiThinkingConfig, buildGeminiRequest },
};

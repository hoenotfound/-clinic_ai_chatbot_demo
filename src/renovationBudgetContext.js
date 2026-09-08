const BUDGET_QUESTION_PATTERN = /(?:do you (?:already )?have|what(?:'s| is)|how much).{0,30}\bbudget\b|\bbudget\b.{0,30}(?:range|in mind|roughly|approximately|around how much)|\bbudget\s*\?|\bbajet\b.{0,24}(?:berapa|range|anggaran)|(?:berapa|anggaran).{0,24}\bbajet\b|\bbajet\s*\?|(?:\u9884\u7b97|\u9810\u7b97).{0,12}(?:\u591a\u5c11|\u51e0|\u5e7e|\u8303\u56f4|\u7bc4\u570d)|(?:\u591a\u5c11|\u51e0|\u5e7e).{0,12}(?:\u9884\u7b97|\u9810\u7b97)|(?:\u9884\u7b97|\u9810\u7b97)\s*[?\uff1f]/i;
const BUDGET_CONTEXT_PATTERN = /\bbudget\b|\bbajet\b|(?:\u9884\u7b97|\u9810\u7b97)|\b(?:maximum|max)\b|\b(?:can|could)\s+spend\b|\bspend\s+(?:up\s+to|around|about)\b|\b(?:my|our)\s+(?:limit|max)\b|\bafford\b/i;
const AMOUNT_PATTERN = /(?:rm\s*)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi;

function formatBudget(match) {
  const numeric = Number(String(match[1] || "").replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return null;
  const value = match[2] ? numeric * 1000 : numeric;
  if (value < 500) return null;
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}

function unitFollows(source, match) {
  const suffix = source.slice(match.index + match[0].length, match.index + match[0].length + 10);
  return /^\s*(?:mm|cm|m|meter|metre|ft|feet|foot)\b/i.test(suffix);
}

function parseExplicitBudget(text) {
  const source = String(text || "");
  const matches = [...source.matchAll(AMOUNT_PATTERN)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (unitFollows(source, match)) continue;
    const value = formatBudget(match);
    if (!value) continue;
    const nearby = source.slice(Math.max(0, match.index - 32), Math.min(source.length, match.index + match[0].length + 32));
    if (BUDGET_CONTEXT_PATTERN.test(nearby)) return value;
  }
  return null;
}

function parseBareBudget(text) {
  const match = String(text || "").trim().match(/^(?:rm\s*)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?$/i);
  return match ? formatBudget(match) : null;
}

function previousAssistantText(messages, beforeIndex) {
  for (let index = Math.min(beforeIndex - 1, messages.length - 1); index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return String(message.content || "");
    if (message?.role === "user") return "";
  }
  return "";
}

function detectKnownBudget(messages) {
  const items = Array.isArray(messages) ? messages : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index];
    if (message?.role !== "user") continue;
    const explicit = parseExplicitBudget(message.content || "");
    if (explicit) return explicit;
    const previousAssistant = previousAssistantText(items, index);
    if (BUDGET_QUESTION_PATTERN.test(previousAssistant)) {
      const contextual = parseBareBudget(message.content || "");
      if (contextual) return contextual;
    }
  }
  return null;
}

function hasKnownBudget(messages) {
  return Boolean(detectKnownBudget(messages));
}

module.exports = {
  BUDGET_QUESTION_PATTERN,
  parseExplicitBudget,
  parseBareBudget,
  detectKnownBudget,
  hasKnownBudget,
};

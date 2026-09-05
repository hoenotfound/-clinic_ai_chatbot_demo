const MALAY_SIGNAL = /\b(?:saya|nak|mahu|boleh|harga|berapa|sakit|cawangan|alamat|macam|sesuai|jeragat|pagi|petang|malam|hujung\s+minggu|klinik|rawatan|mahal|takut|risau|rumah|dapur|kabinet|bajet|ukur|kunci|pejabat|kedai)\b/i;
const ENGLISH_SWITCH = /\b(?:reply|answer|speak|talk|continue|respond)\s+(?:to\s+me\s+)?in\s+english\b|\bin\s+english\b|\benglish\s+(?:please|pls)\b|用英文|英文回复|英文回覆/i;
const CHINESE_SWITCH = /\b(?:reply|answer|speak|talk|continue|respond)\s+(?:to\s+me\s+)?in\s+(?:chinese|mandarin)\b|\b(?:chinese|mandarin)\s+(?:please|pls)\b|中文|华语|華語|讲华语|講華語/i;
const MALAY_SWITCH = /\b(?:reply|answer|speak|talk|continue|respond)\s+(?:to\s+me\s+)?in\s+(?:bahasa\s+(?:melayu|malaysia)|malay)\b|\b(?:bahasa\s+(?:melayu|malaysia)|malay)\s+(?:please|pls)\b/i;
const ENGLISH_MARKERS = new Set([
  "i", "i'm", "im", "you", "your", "can", "could", "want", "need", "please", "what", "which", "where", "when", "how",
  "is", "are", "am", "the", "a", "an", "to", "for", "with", "my", "me", "we", "our", "do", "does", "did", "have", "has",
  "actually", "not", "instead", "change", "reply", "english", "book", "come", "looking", "interested", "budget"
]);

function languageSignal(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  if (ENGLISH_SWITCH.test(value)) return "en";
  if (MALAY_SWITCH.test(value)) return "ms";
  if (CHINESE_SWITCH.test(value)) return "zh";
  if (/\p{Script=Han}/u.test(value)) return "zh";
  if (MALAY_SIGNAL.test(value)) return "ms";

  const words = value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  if (words.length < 3) return null;
  const markers = words.reduce((count, word) => count + (ENGLISH_MARKERS.has(word) ? 1 : 0), 0);
  if (markers >= 2 || (words.length >= 6 && markers >= 1)) return "en";
  return null;
}

function userTexts(messages) {
  return (messages || [])
    .filter((message) => message?.role === "user")
    .map((message) => String(message.content || ""));
}

function establishedConversationLanguage(messages, fallback = "en") {
  const texts = userTexts(messages);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const language = languageSignal(texts[index]);
    if (language) return language;
  }
  return fallback;
}

function applyEstablishedLanguageContext(messages) {
  if (!Array.isArray(messages) || !messages.length) return messages || [];
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return messages;

  const latest = String(messages[latestUserIndex]?.content || "");
  if (languageSignal(latest)) return messages;
  const established = establishedConversationLanguage(messages);
  if (established === "en") return messages;

  const hint = established === "zh" ? " 中文" : " saya";
  return messages.map((message, index) => index === latestUserIndex
    ? { ...message, content: `${latest}${hint}`.trim() }
    : message);
}

function languageLabel(language) {
  if (language === "zh") return "Simplified Chinese";
  if (language === "ms") return "Bahasa Malaysia";
  return "English";
}

module.exports = {
  languageSignal,
  establishedConversationLanguage,
  applyEstablishedLanguageContext,
  languageLabel,
};

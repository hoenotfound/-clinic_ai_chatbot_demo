const MEASUREMENT_OFFER_MARKER = "[[MEASUREMENT_OFFERED]]";

const MEASUREMENT_TOPIC_PATTERN = /site\s*(?:measurement|visit)|come\s+(?:and\s+)?measure|measure\s+(?:the\s+)?(?:space|site|unit|place)|measurement|上门量尺|上門量尺|量尺|现场测量|現場測量|datang\s+ukur|ukur\s+(?:site|rumah)/i;
const MEASUREMENT_OFFER_ACTION_PATTERN = /(?:arrange|schedule|set\s*up|book|pass|send|get|ask).{0,90}(?:site\s*(?:measurement|visit)|measurement|measure)|(?:site\s*(?:measurement|visit)|measurement|measure).{0,90}(?:arrange|schedule|set\s*up|book|pass|send|get|ask)|(?:安排|转给|轉給|让团队|讓團隊|交给团队|交給團隊).{0,30}(?:上门量尺|上門量尺|量尺|现场测量|現場測量)|(?:上门量尺|上門量尺|量尺|现场测量|現場測量).{0,30}(?:安排|转给|轉給|团队|團隊)|(?:arrange|atur|pass).{0,60}(?:site\s*measurement|site\s*visit|ukur)|(?:site\s*measurement|site\s*visit|ukur).{0,60}(?:arrange|atur|pass)/i;
const MEASUREMENT_OFFER_CTA_PATTERN = /would\s+you\s+like|want\s+me|shall\s+i|can\s+i|do\s+you\s+want|shall\s+we|want\s+us\s+to|要不要|需要我|要我|我帮你|我幫你|可以帮你|可以幫你|nak\s+saya|mahu\s+saya|boleh\s+saya/i;
const MEASUREMENT_EXPLANATION_PATTERN = /(?:explain|tell\s+you|show\s+you).{0,40}(?:how|what).{0,30}(?:site\s*measurement|measurement|site\s*visit)|(?:how|what).{0,30}(?:site\s*measurement|measurement|site\s*visit).{0,30}(?:works?|means?)/i;
const MEASUREMENT_ACCEPT_START_PATTERN = /^(?:yes|yeah|yep|yup|sure|okay|ok|can\b|please\s+do|go\s+ahead|let['’]?s\s+do\s+it|arrange\s+it|boleh\b|ya\b|teruskan\b|可以|好|要|行|没问题|沒問題|安排吧)/i;
const MEASUREMENT_ACCEPT_NEGATION_PATTERN = /\b(?:not\s+now|not\s+yet|maybe|later|think\s+(?:about\s+it|first)|don['’]?t|do\s+not|hold\s+on)\b|\b(?:tak|tidak|belum|nanti|fikir\s+dulu)\b|先不用|不要|考虑|考慮|再说|再說|迟点|遲點|想一下/i;
const MEASUREMENT_TIMING_ACCEPT_PATTERN = /^(?:(?:how|what)\s+about\s+)?(?:(?:this|next)\s+(?:week|weekend)|(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?|(?:morning|afternoon|evening|night)|\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:minggu|hujung\s+minggu)\s+(?:ini|depan)|(?:isnin|selasa|rabu|khamis|jumaat|sabtu|ahad)(?:\s+(?:pagi|petang|malam))?|(?:星期|周|週)[一二三四五六日天](?:\s*(?:早上|上午|下午|晚上))?|(?:这|這|下)(?:个|個)?星期(?:\s*(?:早上|上午|下午|晚上))?)(?:[\s,，]*(?:can|okay|ok|works?|boleh|可以|行))?(?:吗|嗎)?[?？.!！。]*$/i;

function lastUserText(messages) {
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return String(messages[index].content || "");
  }
  return "";
}

function previousAssistantBeforeLatestUser(messages) {
  const items = messages || [];
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return null;
  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    if (items[index]?.role === "assistant") return items[index];
    if (items[index]?.role === "user") break;
  }
  return null;
}

function isMeasurementOfferText(text) {
  const value = String(text || "").replaceAll(MEASUREMENT_OFFER_MARKER, "").trim();
  if (!value || !MEASUREMENT_TOPIC_PATTERN.test(value)) return false;
  const hasAction = MEASUREMENT_OFFER_ACTION_PATTERN.test(value);
  const hasCta = MEASUREMENT_OFFER_CTA_PATTERN.test(value);
  if (MEASUREMENT_EXPLANATION_PATTERN.test(value) && !(hasAction && hasCta)) return false;
  return hasAction && hasCta;
}

function isMeasurementOfferMessage(message) {
  if (!message || message.role !== "assistant") return false;
  if (message.measurementOffered === true) return true;
  const content = String(message.content || "");
  if (content.includes(MEASUREMENT_OFFER_MARKER)) return true;
  return isMeasurementOfferText(content);
}

function measurementOfferSent(messages) {
  return (messages || []).some(isMeasurementOfferMessage);
}

function isContextualMeasurementAcceptance(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 180 || MEASUREMENT_ACCEPT_NEGATION_PATTERN.test(value)) return false;
  return MEASUREMENT_ACCEPT_START_PATTERN.test(value) || MEASUREMENT_TIMING_ACCEPT_PATTERN.test(value);
}

function measurementOfferAccepted(messages) {
  const latest = lastUserText(messages);
  if (!isContextualMeasurementAcceptance(latest)) return false;
  return isMeasurementOfferMessage(previousAssistantBeforeLatestUser(messages));
}

function markMeasurementOffer(reply) {
  const text = String(reply || "").trim();
  if (!text || text.includes(MEASUREMENT_OFFER_MARKER)) return text;
  return `${text} ${MEASUREMENT_OFFER_MARKER}`;
}

function stripMeasurementOfferMarker(reply) {
  return String(reply || "").replaceAll(MEASUREMENT_OFFER_MARKER, "").replace(/\s{2,}/g, " ").trim();
}

module.exports = {
  MEASUREMENT_OFFER_MARKER,
  isMeasurementOfferText,
  isMeasurementOfferMessage,
  measurementOfferSent,
  measurementOfferAccepted,
  isContextualMeasurementAcceptance,
  markMeasurementOffer,
  stripMeasurementOfferMarker,
  _test: {
    MEASUREMENT_ACCEPT_START_PATTERN,
    MEASUREMENT_ACCEPT_NEGATION_PATTERN,
    MEASUREMENT_TIMING_ACCEPT_PATTERN,
    previousAssistantBeforeLatestUser,
  },
};
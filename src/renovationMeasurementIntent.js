const MEASUREMENT_OFFER_MARKER = "[[MEASUREMENT_OFFERED]]";

const MEASUREMENT_TOPIC_PATTERN = /site\s*(?:measurement|visit)|come\s+(?:and\s+)?measure|measure\s+(?:the\s+)?(?:space|site|unit|place)|measurement|上门量尺|上門量尺|量尺|现场测量|現場測量|datang\s+ukur|ukur\s+(?:site|rumah)/i;
const MEASUREMENT_OFFER_ACTION_PATTERN = /(?:arrange|schedule|set\s*up|book|pass|send|get|ask).{0,90}(?:site\s*(?:measurement|visit)|measurement|measure)|(?:site\s*(?:measurement|visit)|measurement|measure).{0,90}(?:arrange|schedule|set\s*up|book|pass|send|get|ask)|(?:安排|转给|轉給|让团队|讓團隊|交给团队|交給團隊).{0,30}(?:上门量尺|上門量尺|量尺|现场测量|現場測量)|(?:上门量尺|上門量尺|量尺|现场测量|現場測量).{0,30}(?:安排|转给|轉給|团队|團隊)|(?:arrange|atur|pass).{0,60}(?:site\s*measurement|site\s*visit|ukur)|(?:site\s*measurement|site\s*visit|ukur).{0,60}(?:arrange|atur|pass)/i;
const MEASUREMENT_OFFER_CTA_PATTERN = /would\s+you\s+like|want\s+me|shall\s+i|can\s+i|do\s+you\s+want|shall\s+we|want\s+us\s+to|要不要|需要我|要我|我帮你|我幫你|可以帮你|可以幫你|nak\s+saya|mahu\s+saya|boleh\s+saya/i;
const MEASUREMENT_EXPLANATION_PATTERN = /(?:explain|tell\s+you|show\s+you).{0,40}(?:how|what).{0,30}(?:site\s*measurement|measurement|site\s*visit)|(?:how|what).{0,30}(?:site\s*measurement|measurement|site\s*visit).{0,30}(?:works?|means?)/i;
const MEASUREMENT_EDUCATION_PATTERN = /(?:what\s+is|what\s+happens?\s+(?:during|at)|how\s+(?:does|do|will)|can\s+you\s+(?:explain|tell|clarify)|could\s+you\s+(?:explain|tell|clarify)|explain|tell\s+me\s+(?:about|how)|how\s+does\s+it\s+work).{0,70}(?:site\s*(?:measurement|visit)|measurement|measuring)|(?:site\s*(?:measurement|visit)|measurement).{0,50}(?:work|process|mean|流程|过程|過程)|(?:什么是|什麼是|怎么|怎麼|如何|流程|过程|過程|解释|解釋|告诉我|告訴我).{0,24}(?:上门量尺|上門量尺|量尺|现场测量|現場測量)|(?:上门量尺|上門量尺|量尺|现场测量|現場測量).{0,18}(?:是什么|是什麼|怎么|怎麼|如何|流程|过程|過程)|(?:apa\s+itu|macam\s+mana|bagaimana|boleh\s+(?:explain|terangkan)|terangkan).{0,50}(?:site\s*measurement|site\s*visit|datang\s+ukur|ukur\s+site)/i;
const MEASUREMENT_ACCEPT_START_PATTERN = /^(?:yes|yeah|yep|yup|sure|okay|ok|can\b|please\s+do|go\s+ahead|let['’]?s\s+do\s+it|arrange\s+it|boleh\b|ya\b|teruskan\b|可以|好|要|行|没问题|沒問題|安排吧)/i;
const MEASUREMENT_ACCEPT_NEGATION_PATTERN = /\b(?:not\s+now|not\s+yet|maybe|later|think\s+(?:about\s+it|first)|don['’]?t|do\s+not|hold\s+on)\b|\b(?:tak|tidak|belum|nanti|fikir\s+dulu)\b|先不用|不要|考虑|考慮|再说|再說|迟点|遲點|想一下/i;
const MEASUREMENT_FOLLOWUP_QUESTION_PATTERN = /^(?:can|could|would|boleh|dapat|可以|能不能|可不可以).{0,60}(?:explain|tell\s+me|clarify|know\s+how|how\s+it|what\s+happens?|process|流程|过程|過程|怎么|怎麼|如何|解释|解釋|告诉我|告訴我|terangkan|macam\s+mana|bagaimana|apa\s+itu)/i;
const MEASUREMENT_TIMING_ACCEPT_PATTERN = /^(?:(?:how|what)\s+about\s+)?(?:(?:this|next)\s+(?:week|weekend)|(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening|night))?|(?:morning|afternoon|evening|night)|\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:minggu|hujung\s+minggu)\s+(?:ini|depan)|(?:isnin|selasa|rabu|khamis|jumaat|sabtu|ahad)(?:\s+(?:pagi|petang|malam))?|(?:星期|周|週)[一二三四五六日天](?:\s*(?:早上|上午|下午|晚上))?|(?:这|這|下)(?:个|個)?星期(?:\s*(?:早上|上午|下午|晚上))?)(?:[\s,，]*(?:can|okay|ok|works?|boleh|可以|行))?(?:吗|嗎)?[?？.!！。]*$/i;
const RENEWED_BUYING_SIGNAL_PATTERN = /\b(?:ready\s+to\s+proceed|want\s+to\s+proceed|would\s+like\s+to\s+proceed|let['’]?s\s+(?:proceed|do\s+it|go\s+ahead)|go\s+ahead|move\s+forward|want\s+to\s+start|ready\s+to\s+start|changed?\s+my\s+mind)\b|(?:想做|要做|可以做|继续做|繼續做|继续吧|繼續吧|开始吧|開始吧|改变主意|改變主意)|\b(?:nak|mahu)\s+(?:proceed|teruskan|mula)\b|\bteruskan\b/i;
const EXPLICIT_MEASUREMENT_REQUEST_PATTERNS = [
  /\b(?:book|arrange|schedule|set\s*up)\b[^.!?]{0,60}\b(?:site\s+(?:measurement|visit)|measurement|measure|site\s+visit)\b/i,
  /\b(?:i|we)\s+(?:need|want|would\s+like|would\s+love)\s+(?:a\s+)?(?:site\s+(?:measurement|visit)|measurement|someone\s+to\s+measure)\b/i,
  /^(?:site\s+(?:measurement|visit)|measurement)\s*(?:please|pls)?[.!?]*$/i,
  /\b(?:can|could|would|will)\s+(?:you|your\s+team|the\s+team|designer)\s+(?:come|visit|measure)\b/i,
  /\bwhen\s+can\s+(?:you|your\s+team|the\s+team|designer)\b[^.!?]{0,40}\b(?:come|visit|measure)\b/i,
  /(?:我要|我想|需要|帮我|幫我|安排|预约|預約).{0,20}(?:上门量尺|上門量尺|量尺|现场测量|現場測量)/i,
  /(?:什么时候|什麼時候).{0,16}(?:可以|能).{0,10}(?:上门|上門|量尺|测量|測量)/i,
  /^(?:上门量尺|上門量尺|量尺|现场测量|現場測量)\s*(?:可以吗|可以嗎|吗|嗎|please)?[？?。.!]*$/i,
  /\b(?:nak|mahu|perlu|tolong)\b[^.!?]{0,40}\b(?:site\s+measurement|site\s+visit|datang\s+ukur|ukur\s+site|ukur\s+rumah)\b/i,
  /\b(?:bila)\b[^.!?]{0,40}\b(?:datang\s+ukur|ukur\s+site|site\s+measurement)\b/i,
  /\b(?:boleh)\b[^.!?]{0,25}\b(?:datang\s+ukur|ukur\s+site|ukur\s+rumah)\b/i,
];

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

function isMeasurementEducationRequest(text) {
  const value = String(text || "").trim();
  return Boolean(value && MEASUREMENT_TOPIC_PATTERN.test(value) && MEASUREMENT_EDUCATION_PATTERN.test(value));
}

function isExplicitMeasurementRequest(text) {
  const value = String(text || "").trim();
  if (!value || isMeasurementEducationRequest(value)) return false;
  return EXPLICIT_MEASUREMENT_REQUEST_PATTERNS.some((pattern) => pattern.test(value));
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

function latestMeasurementOfferIndex(messages) {
  const items = messages || [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isMeasurementOfferMessage(items[index])) return index;
  }
  return -1;
}

function latestDeclineIndexAfterOffer(messages, offerIndex) {
  const items = messages || [];
  for (let index = offerIndex + 1; index < items.length; index += 1) {
    if (items[index]?.role === "user" && MEASUREMENT_ACCEPT_NEGATION_PATTERN.test(String(items[index].content || ""))) {
      return index;
    }
  }
  return -1;
}

function renewedBuyingSignalAfterDecline(messages, declineIndex) {
  const items = messages || [];
  if (declineIndex < 0) return false;
  return items.slice(declineIndex + 1).some(
    (message) => message?.role === "user" && RENEWED_BUYING_SIGNAL_PATTERN.test(String(message.content || ""))
  );
}

function measurementOfferDeclined(messages) {
  const offerIndex = latestMeasurementOfferIndex(messages);
  if (offerIndex < 0) return false;
  return latestDeclineIndexAfterOffer(messages, offerIndex) >= 0;
}

function measurementOfferSent(messages) {
  const offerIndex = latestMeasurementOfferIndex(messages);
  if (offerIndex < 0) return false;
  const declineIndex = latestDeclineIndexAfterOffer(messages, offerIndex);
  if (declineIndex >= 0 && renewedBuyingSignalAfterDecline(messages, declineIndex)) return false;
  return true;
}

function isContextualMeasurementAcceptance(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 180 || MEASUREMENT_ACCEPT_NEGATION_PATTERN.test(value)) return false;
  if (MEASUREMENT_FOLLOWUP_QUESTION_PATTERN.test(value)) return false;
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
  isMeasurementEducationRequest,
  isExplicitMeasurementRequest,
  isMeasurementOfferText,
  isMeasurementOfferMessage,
  measurementOfferSent,
  measurementOfferAccepted,
  measurementOfferDeclined,
  isContextualMeasurementAcceptance,
  markMeasurementOffer,
  stripMeasurementOfferMarker,
  _test: {
    MEASUREMENT_ACCEPT_START_PATTERN,
    MEASUREMENT_ACCEPT_NEGATION_PATTERN,
    MEASUREMENT_FOLLOWUP_QUESTION_PATTERN,
    MEASUREMENT_TIMING_ACCEPT_PATTERN,
    RENEWED_BUYING_SIGNAL_PATTERN,
    EXPLICIT_MEASUREMENT_REQUEST_PATTERNS,
    latestMeasurementOfferIndex,
    previousAssistantBeforeLatestUser,
  },
};

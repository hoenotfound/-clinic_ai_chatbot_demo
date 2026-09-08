const { detectCorrectedService } = require("./renovationServiceDetection");

const NEGATIVE_TRIGGER_PATTERN = /not interested|no longer interested|never ?mind|don['’]?t want|do not want|cancel|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|batal|不要了|不想做|没兴趣|沒興趣|算了|取消/i;
const HARD_DECLINE_PATTERN = /not interested|no longer interested|never ?mind|no thanks|tak berminat|tidak berminat|tak jadi|tidak jadi|不要了|没兴趣|沒興趣|算了/i;
const PROJECT_DETAIL_NEGATION_PATTERN = /\b(?:handles?|handleless|knobs?|hinges?|drawers?|shelves?|doors?|hardware|finish|finishes|glossy|matte|colour|color|material|laminate|melamine|paint|painted|lacquer|glass|lighting|led|height|width|depth|size|measurement|measurements|site\s+(?:visit|measurement|measure)|appointment|booking|slot|date|time|morning|afternoon|evening|night|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|把手|拉手|无拉手|無拉手|哑光|啞光|亮面|颜色|顏色|材料|尺寸|量尺|上门|上門|预约|預約|时间|時間|星期|周末|週末|pemegang|handle|kemasan|warna|material|ukuran|temujanji|slot|masa|pagi|petang|malam|sabtu|ahad/i;
const CONTINUATION_PATTERN = /\b(?:reschedule|rebook|move|change|switch|prefer|rather|instead|still\s+want|still\s+need|can\s+do|could\s+do|can\s+you|could\s+you)\b|改期|改时间|改時間|换|換|改成|还是要|還是要|prefer|tukar|ubah|reschedule/i;

function normalize(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function correctionTargetText(text) {
  const value = normalize(text);
  if (!value || !detectCorrectedService(value)) return value;

  // Target service is on the left side of the correction.
  for (const pattern of [
    /^(.+?)\s+instead\s+of\s+(.+)$/i,
    /^(.+?)\s+rather\s+than\s+(.+)$/i,
    /^(.+?)[,;]\s*(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s+(?:not|bukan)\s+(.+)$/i,
    /^(.+?)\s*(?:而不是|而非)\s*(.+)$/i,
    /^(.+?)[,，;]\s*(?:不是|不要)\s*(.+)$/i,
  ]) {
    const match = value.match(pattern);
    if (match) return normalize(match[1]);
  }

  // Target service is on the right side of the correction.
  for (const pattern of [
    /^(?:i|we)\s+(?:don['’]?t|do\s+not)\s+want\s+(.+?)(?:[,;.!?]+\s*|\s+but\s+)(?:but\s+)?(?:i|we)\s+(?:want|need)\s+(.+?)(?:\s+instead)?[.!?]*$/i,
    /^(?:cancel|drop|remove)\s+(.+?)(?:[,;.!?]+\s*|\s+but\s+)(?:but\s+)?(?:i|we)\s+(?:want|need)\s+(.+?)(?:\s+instead)?[.!?]*$/i,
    /^(?:tak|tidak)\s+(?:nak|mahu)\s+(.+?)(?:[,;.!?]+\s*|\s+(?:tapi|tetapi)\s+)(?:(?:tapi|tetapi)\s+)?(?:saya\s+)?(?:nak|mahu)\s+(.+?)(?:\s+sebaliknya)?[.!?]*$/i,
    /^(?:not|bukan)\s+(.+?)(?:[,;.!?]+\s*|\s+(?:but|actually|instead|tapi|tetapi)\s+)(?:(?:but|actually|instead|tapi|tetapi)\s+)?(.+?)[.!?]*$/i,
    /^(?:不是|不要)\s*(.+?)[,，;。！？]\s*(?:而是|是|要|改做|改成)?\s*(.+)$/i,
  ]) {
    const match = value.match(pattern);
    if (match) return normalize(match[2]);
  }

  for (const pattern of [
    /\b(?:switch|change)\s+(?:it\s+)?to\s+([^,.;!?]+)/i,
    /(?:改成|改做|换成|換成|应该是|應該是)\s*([^，。！？,!?]+)/i,
  ]) {
    const match = value.match(pattern);
    if (match) return normalize(match[1]);
  }

  return value;
}

function isGenuineRejection(text) {
  const value = normalize(text);
  if (!value || !NEGATIVE_TRIGGER_PATTERN.test(value)) return false;

  // Explicit scope replacement is not a rejection of the overall enquiry.
  if (detectCorrectedService(value)) return false;

  // Strong standalone decline wording should still stop qualification.
  if (HARD_DECLINE_PATTERN.test(value)) return true;

  // Negating a design choice, cabinet detail, appointment slot or timing is not the
  // same as abandoning the renovation enquiry.
  if (PROJECT_DETAIL_NEGATION_PATTERN.test(value)) return false;
  if (CONTINUATION_PATTERN.test(value)) return false;

  return true;
}

module.exports = {
  correctionTargetText,
  isGenuineRejection,
};

const {
  detectCorrectedService,
  correctionTargetText: detectedCorrectionTargetText,
} = require("./renovationServiceDetection");

const NEGATIVE_TRIGGER_PATTERN = /not interested|no longer interested|never ?mind|don['’]?t want|do not want|cancel|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|batal|不要了|不想做|没兴趣|沒興趣|算了|取消/i;
const HARD_DECLINE_PATTERN = /not interested|no longer interested|never ?mind|no thanks|tak berminat|tidak berminat|tak jadi|tidak jadi|不要了|没兴趣|沒興趣|算了/i;
const PROJECT_DETAIL_NEGATION_PATTERN = /\b(?:handles?|handleless|knobs?|hinges?|drawers?|shelves?|doors?|hardware|finish|finishes|glossy|matte|colour|color|material|laminate|melamine|paint|painted|lacquer|glass|lighting|led|height|width|depth|size|measurement|measurements|site\s+(?:visit|measurement|measure)|appointment|booking|slot|date|time|morning|afternoon|evening|night|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|把手|拉手|无拉手|無拉手|哑光|啞光|亮面|颜色|顏色|材料|尺寸|量尺|上门|上門|预约|預約|时间|時間|星期|周末|週末|pemegang|handle|kemasan|warna|material|ukuran|temujanji|slot|masa|pagi|petang|malam|sabtu|ahad/i;
const CONTINUATION_PATTERN = /\b(?:reschedule|rebook|move|change|switch|prefer|rather|instead|still\s+want|still\s+need|can\s+do|could\s+do|make\s+it|works?\b)\b|改期|改时间|改時間|换|換|改成|还是要|還是要|prefer|tukar|ubah|reschedule/i;

function normalize(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function correctionTargetText(text) {
  return detectedCorrectionTargetText(text);
}

function isGenuineRejection(text) {
  const value = normalize(text);
  if (!value || !NEGATIVE_TRIGGER_PATTERN.test(value)) return false;

  // Explicit scope replacement is not a rejection of the overall enquiry.
  if (detectCorrectedService(value)) return false;

  // A negative phrase scoped to a finish, fitting, material, measurement or timing
  // choice is not the same as rejecting the renovation project itself. Check this
  // before hard-decline phrases such as "no thanks" and "never mind" because those
  // are commonly used for one option or appointment slot in WhatsApp chat.
  if (PROJECT_DETAIL_NEGATION_PATTERN.test(value)) return false;
  if (CONTINUATION_PATTERN.test(value)) return false;

  if (HARD_DECLINE_PATTERN.test(value)) return true;
  return true;
}

module.exports = {
  correctionTargetText,
  isGenuineRejection,
};

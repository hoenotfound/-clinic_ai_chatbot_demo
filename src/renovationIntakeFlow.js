const base = require("./renovationIntakeFlowBase");
const { detectCorrectedService } = require("./renovationServiceDetection");
const { correctionTargetText } = require("./renovationConversationIntent");

const EXPLICIT_HUMAN_REQUEST_PATTERN = /(?:speak|talk|chat|connect)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:can|could|may)\s+i\s+(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:want|need)\s+to\s+(?:speak|talk|chat|connect)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:want|need)\s+(?:a\s+)?(?:human|designer|salesperson|project\s+manager)\s+(?:to\s+)?(?:contact|call|reply|help)|human\s+(?:please|pls)|\u771f\u4eba|\u4eba\u5de5|\u8f6c\u4eba\u5de5|\u8f49\u4eba\u5de5|\u627e\u8bbe\u8ba1\u5e08|\u627e\u8a2d\u8a08\u5e2b|\u8054\u7cfb\u987e\u95ee|\u806f\u7e6b\u9867\u554f|nak\s+cakap\s+dengan\s+(?:staff|designer|sales)|mahu\s+cakap\s+dengan\s+(?:staff|designer|sales)/i;
const BUDGET_PATTERN = /\b(?:budget|bajet)\b.{0,30}(?:rm\s*)?\d+(?:[,.]\d+)?\s*k?\b|\b(?:rm\s*)\d+(?:[,.]\d+)?\s*k?\b|\b\d+(?:\.\d+)?\s*k\s*(?:budget|bajet)\b|(?:\u9884\u7b97|\u9810\u7b97).{0,16}(?:rm\s*)?\d+(?:[,.]\d+)?\s*k?/i;
const ALL_CLEAR_PATTERN = /no\s+(?:other\s+)?obstruction|nothing\s+(?:else|there)|all\s+clear|tiada\s+halangan|tak\s+ada\s+halangan|\u6ca1\u6709(?:\u5176\u4ed6)?\u963b\u788d|\u6c92\u6709(?:\u5176\u4ed6)?\u963b\u7919/i;

const GROUP_PATTERNS = {
  wall: /clear\s*wall|empty\s*wall|usable\s*wall|wall\s+(?:is\s+)?clear|wall\s*(?:space|length|height|width)|enough\s+wall|dinding|\u5899\u9762|\u7246\u9762|\u5899\u957f|\u7246\u9577|\u5899\u9ad8|\u7246\u9ad8/i,
  window: /window|tingkap|\u7a97/i,
  door: /door|sliding\s*door|pintu|\u95e8|\u9580/i,
  power: /switch(?:es)?|socket(?:s)?|plug(?:s)?|power\s*point|data\s*point|suis|soket|\u63d2\u5ea7|\u5f00\u5173|\u958b\u95dc|\u7535\u6e90|\u96fb\u6e90/i,
  plumbing: /sink|water\s*point|pipe|plumb(?:ing)?|paip|\u6c34\u7ba1|\u6c34\u4f4d|\u6c34\u69fd/i,
  cooking: /hob|hood|stove|cooker|\u62bd\u6cb9\u70df\u673a|\u62bd\u6cb9\u7159\u6a5f|\u7089|\u7210/i,
  fridge: /fridge|refrigerator|\u51b0\u7bb1/i,
  structure: /beam|column|\u6881|\u67f1/i,
  aircon: /air\s*con|aircon|air-conditioner|\u7a7a\u8c03|\u51b7\u6c14|\u51b7\u6c23/i,
  db: /db\s*box|distribution\s*board|\u7535\u7bb1|\u96fb\u7bb1/i,
  tv: /(?:tv\s*(?:size|around|about)?\s*[:=-]?\s*\d+\s*(?:inch(?:es)?|in\b|[\"”])|\d+\s*(?:inch(?:es)?|in\b|[\"”])\s*tv|tv\s+size\s*[:=-]?\s*(?!not\s*sure|unknown)\S+)/i,
};

const NEGATIVE_PATTERNS = {
  window: /no\s+(?:window|windows)|without\s+(?:a\s+)?window|tiada\s+tingkap|tak\s+ada\s+tingkap|\u6ca1\u6709\u7a97|\u6c92\u6709\u7a97|\u65e0\u7a97|\u7121\u7a97/i,
  structure: /no\s+(?:beam|column|beam\s*(?:or|and|\/)\s*column)|without\s+(?:a\s+)?(?:beam|column)|tiada\s+(?:beam|column)|tak\s+ada\s+(?:beam|column)|\u6ca1\u6709(?:\u6881|\u67f1)|\u6c92\u6709(?:\u6881|\u67f1)/i,
  aircon: /no\s+(?:air\s*con|aircon|air-conditioner)|without\s+(?:an?\s+)?(?:air\s*con|aircon|air-conditioner)|tiada\s+aircon|tak\s+ada\s+aircon|\u6ca1\u6709(?:\u7a7a\u8c03|\u51b7\u6c14)|\u6c92\u6709(?:\u7a7a\u8abf|\u51b7\u6c23)/i,
  db: /no\s+(?:db\s*box|distribution\s*board)|without\s+(?:a\s+)?(?:db\s*box|distribution\s*board)|tiada\s+db\s*box|tak\s+ada\s+db\s*box|\u6ca1\u6709\u7535\u7bb1|\u6c92\u6709\u96fb\u7bb1/i,
};

function lastUserText(messages) {
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return String(messages[index].content || "");
  }
  return "";
}

function sanitizeNonRequestDesignerMention(messages) {
  const latest = lastUserText(messages);
  if (!/\bdesigner\b/i.test(latest) || EXPLICIT_HUMAN_REQUEST_PATTERN.test(latest)) return messages;
  let replaced = false;
  return (messages || []).map((message, index, items) => {
    if (replaced || message?.role !== "user") return message;
    const isLatestUser = !items.slice(index + 1).some((item) => item?.role === "user");
    if (!isLatestUser) return message;
    replaced = true;
    return { ...message, content: String(message.content || "").replace(/\bdesigner\b/ig, "design consultant") };
  });
}

function scopedUserText(state) {
  let firstUser = true;
  return (state.scopedMessages || [])
    .filter((message) => message?.role === "user")
    .map((message) => {
      const text = String(message.content || "");
      if (firstUser && detectCorrectedService(text)) {
        firstUser = false;
        return correctionTargetText(text);
      }
      firstUser = false;
      return text;
    })
    .join(" \n");
}

function refinedFacts(state) {
  const text = scopedUserText(state);
  const groups = new Set();
  for (const [name, pattern] of Object.entries(GROUP_PATTERNS)) {
    if (pattern.test(text)) groups.add(name);
  }
  const allClear = ALL_CLEAR_PATTERN.test(text);
  const noWindow = NEGATIVE_PATTERNS.window.test(text);
  const noStructure = NEGATIVE_PATTERNS.structure.test(text);
  const noAircon = NEGATIVE_PATTERNS.aircon.test(text);
  const noDb = NEGATIVE_PATTERNS.db.test(text);
  return {
    ...state.facts,
    groups,
    allClear,
    noWindow,
    hasWindow: groups.has("window") && !noWindow,
    hasBeamOrColumn: groups.has("structure") && !noStructure,
    hasAircon: groups.has("aircon") && !noAircon,
    hasDbBox: groups.has("db") && !noDb,
  };
}

function requiredConstraintGroups(serviceNames) {
  const required = new Set();
  for (const name of serviceNames || []) {
    let groups;
    if (name === "Kitchen Cabinets") groups = ["wall", "window", "door", "power", "plumbing", "cooking", "fridge", "structure"];
    else if (name === "Built-in Wardrobes") groups = ["wall", "window", "door", "power", "structure", "aircon"];
    else if (name === "TV Console & Living Room Carpentry") groups = ["wall", "tv", "power", "window", "door", "aircon"];
    else if (name === "Shoe Cabinet & Entrance Storage") groups = ["wall", "door", "power", "db"];
    else groups = ["wall", "window", "door", "power"];
    for (const group of groups) required.add(group);
  }
  return [...required];
}

function missingConstraintGroups(serviceNames, facts) {
  if (facts.allClear) return [];
  return requiredConstraintGroups(serviceNames).filter((group) => !facts.groups.has(group));
}

function missingConstraintQuestion(language, missing) {
  const labels = {
    en: { wall: "usable wall space", window: "windows", door: "doors / door swing", power: "switches or plug points", plumbing: "sink/water points", cooking: "hob/hood", fridge: "fridge position", structure: "beams/columns", aircon: "aircon position", db: "DB box", tv: "TV size" },
    ms: { wall: "ruang dinding yang boleh guna", window: "tingkap", door: "pintu / arah pintu buka", power: "switch atau plug", plumbing: "sink/water point", cooking: "hob/hood", fridge: "posisi fridge", structure: "beam/column", aircon: "posisi aircon", db: "DB box", tv: "saiz TV" },
  };
  const zh = { wall: "\u5899\u9762\u662f\u4e0d\u662f\u90fd\u80fd\u7528", window: "\u7a97\u4f4d", door: "\u95e8\u4f4d / \u5f00\u95e8\u65b9\u5411", power: "switch / plug", plumbing: "\u6c34\u69fd / \u6c34\u4f4d", cooking: "hob / hood", fridge: "\u51b0\u7bb1\u4f4d\u7f6e", structure: "\u6881\u67f1", aircon: "\u51b7\u6c14\u4f4d\u7f6e", db: "DB box", tv: "TV \u5c3a\u5bf8" };
  const table = language === "zh" ? zh : (labels[language] || labels.en);
  const items = missing.map((key) => table[key] || labels.en[key] || key);
  if (language === "zh") return `\u6536\u5230\u3002\u518d\u786e\u8ba4${items.join("\u3001")}\u8fd9${items.length > 1 ? "\u51e0\u9879" : "\u4e00\u9879"}\u5c31\u53ef\u4ee5\uff0c\u7136\u540e\u6211\u53ef\u4ee5\u6309\u4f60\u7ed9\u7684\u73b0\u573a\u8d44\u6599\u5148\u7ed9\u5e03\u5c40\u548c\u6750\u6599\u65b9\u5411\u3002`;
  if (language === "ms") return `Faham. Tinggal confirm ${items.join(", ")} saja, lepas itu saya boleh bagi preliminary layout dan material direction berdasarkan detail site anda.`;
  return `Got it. I just need ${items.join(", ")} as well, then I can give preliminary layout and material direction based on the site details you've provided.`;
}

function budgetKnown(state) {
  const text = (state.projectMessages || []).filter((message) => message?.role === "user").map((message) => String(message.content || "")).join(" \n");
  return BUDGET_PATTERN.test(text);
}

function removeRepeatedBudgetQuestion(reply, language) {
  let text = String(reply || "").trim();
  if (!text) return text;
  if (language === "zh") {
    text = text.replace(/\s*\u60a8\u7684\s*Budget\s*\u5927\u6982\u60f3\u63a7\u5236\u5728\u591a\u5c11[\uff1f?]?\s*$/i, "");
    return `${text} \u63a5\u4e0b\u6765\u6211\u4f1a\u6309\u60a8\u5df2\u7ecf\u7ed9\u7684 Budget \u7ee7\u7eed\u770b quotation / design \u65b9\u5411\u3002`.trim();
  }
  if (language === "ms") {
    text = text.replace(/\s*Bajet anda lebih kurang berapa\?\s*$/i, "");
    return `${text} Saya akan guna bajet yang anda dah bagi untuk langkah quotation/design seterusnya.`.trim();
  }
  text = text.replace(/\s*What budget range are you aiming for\?\s*$/i, "");
  return `${text} I'll keep the budget you already shared in mind for the next quotation/design step.`.trim();
}

function enhancePlan(plan) {
  if (!plan?.state) return plan;
  const state = { ...plan.state, facts: refinedFacts(plan.state) };
  state.missingConstraints = state.serviceNames?.length ? missingConstraintGroups(state.serviceNames, state.facts) : [];
  state.budgetKnown = budgetKnown(state);
  const next = { ...plan, state };
  const readyForConstraints = state.sizeKnown && state.hasLocation && state.serviceNames?.length;
  if (readyForConstraints && state.missingConstraints.length) {
    const hasAnyConstraintInfo = state.facts.groups.size > 0 || state.facts.allClear;
    const question = hasAnyConstraintInfo ? missingConstraintQuestion(state.language, state.missingConstraints) : base._test.obstructionQuestion(state.language, state.serviceNames);
    next.adviceReply = null;
    if (next.answerFirst) next.appendAfterAnswer = question;
    else next.reply = question;
    return next;
  }
  if (readyForConstraints && !state.missingConstraints.length && !state.adviceSent) {
    let advice = base._test.preliminaryAdvice(state.serviceNames, state.language, state.facts);
    if (state.budgetKnown) advice = removeRepeatedBudgetQuestion(advice, state.language);
    next.reply = null;
    next.adviceReply = advice;
    return next;
  }
  if (next.adviceReply && state.budgetKnown) next.adviceReply = removeRepeatedBudgetQuestion(next.adviceReply, state.language);
  return next;
}

function buildRenovationIntakePlan(messages, options = {}) {
  const latest = lastUserText(messages);
  if (EXPLICIT_HUMAN_REQUEST_PATTERN.test(latest)) return base.buildRenovationIntakePlan(messages, options);
  const sourceMessages = sanitizeNonRequestDesignerMention(messages);
  return enhancePlan(base.buildRenovationIntakePlan(sourceMessages, options));
}

function buildRenovationIntakeReply(messages, options = {}) {
  return buildRenovationIntakePlan(messages, options).reply;
}

module.exports = {
  ...base,
  buildRenovationIntakeReply,
  buildRenovationIntakePlan,
  _test: {
    ...base._test,
    requiredConstraintGroups,
    missingConstraintGroups,
    missingConstraintQuestion,
    refinedFacts,
    budgetKnown,
    removeRepeatedBudgetQuestion,
  },
};

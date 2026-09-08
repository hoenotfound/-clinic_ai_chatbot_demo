const base = require("./renovationIntakeFlowBase");
const { detectCorrectedService } = require("./renovationServiceDetection");
const { correctionTargetText } = require("./renovationConversationIntent");
const { hasKnownBudget } = require("./renovationBudgetContext");
const {
  isStandaloneUnconfiguredCabinetRequest,
  sanitizeLegacyRoutingMessages,
} = require("./renovationRoutingIntent");
const {
  isMeasurementOfferText,
  measurementOfferSent,
  measurementOfferAccepted,
  markMeasurementOffer,
} = require("./renovationMeasurementIntent");

const OPENING_MESSAGE = "Hi 👋 What are you planning to build — kitchen cabinet, wardrobe, TV cabinet, shoe cabinet, or something else?";
const ALL_CLEAR_PATTERN = /no\s+(?:other\s+)?obstruction|nothing\s+(?:else|there)|all\s+clear|clear\s+all\s+the\s+way|tiada\s+halangan|tak\s+ada\s+halangan|dinding\s+kosong|\u6ca1\u6709(?:\u5176\u4ed6)?\u963b\u788d|\u6c92\u6709(?:\u5176\u4ed6)?\u963b\u7919|\u6574\u9762\u5899\u90fd\u53ef\u4ee5\u7528/i;

const GROUP_PATTERNS = {
  wall: /clear\s*wall|empty\s*wall|usable\s*wall|wall\s+(?:is\s+)?(?:clear|usable|available|okay|ok|fine)|wall\s*(?:space|length|height|width)|enough\s+wall|full\s+wall|whole\s+wall|entire\s+wall|can\s+use\s+(?:the\s+)?(?:full|whole|entire)?\s*wall|all\s+(?:the\s+)?wall\s+(?:can\s+be\s+used|is\s+usable)|no\s+(?:wall\s+)?obstruction|nothing\s+blocking\s+(?:the\s+)?wall|dinding(?:\s+kosong|\s+boleh\s+guna|\s+semua\s+boleh\s+guna)?|ruang\s+dinding(?:\s+boleh\s+guna)?|\u5899\u9762|\u7246\u9762|\u5899\u957f|\u7246\u9577|\u5899\u9ad8|\u7246\u9ad8|\u6574\u9762\u5899|\u5899(?:\u9762)?\u53ef\u4ee5\u7528|\u5899(?:\u9762)?\u80fd\u7528/i,
  window: /window|tingkap|\u7a97/i,
  door: /door|sliding\s*door|pintu|\u95e8|\u9580/i,
  power: /switch(?:es)?|socket(?:s)?|plug(?:s)?|power\s*point|power\s*outlet|wall\s*outlet|electrical\s*(?:point|outlet)|electric\s*(?:point|outlet)|outlet(?:s)?|13a\s*point|data\s*point|suis|soket|plug\s*point|\u63d2\u5ea7|\u5f00\u5173|\u958b\u95dc|\u7535\u6e90|\u96fb\u6e90|\u7535\u4f4d|\u96fb\u4f4d/i,
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

const SHORT_CONTEXT_ANSWER = /^(?:yes|yeah|yep|yup|can|can\s+use|usable|okay|ok|fine|all\s+good|no|none|nope|cannot|can['’]?t|not\s+usable|have|got|got\s+one|one|two|three|\d+|boleh|boleh\s+guna|ada|ada\s+satu|tak\s+ada|tiada|tak\s+boleh|ya|\u53ef\u4ee5(?:\u7684)?(?:\u554a|\u5440)?|\u53ef\u4ee5\u7528(?:\u554a|\u5440)?|\u80fd(?:\u7528)?(?:\u554a|\u5440)?|\u884c(?:\u7684)?(?:\u554a|\u5440)?|\u6709|\u6709\u7684|\u6ca1\u6709|\u6c92\u6709|\u4e0d\u53ef\u4ee5|\u4e0d\u80fd|\u6ca1\u95ee\u9898(?:\u554a|\u5440)?|\u6c92\u554f\u984c(?:\u554a|\u5440)?)[.!\uff01\u3002]?$/i;
const POSITIVE_WALL_CONTEXT = /^(?:yes|yeah|yep|yup|can|can\s+use|usable|okay|ok|fine|all\s+good|boleh|boleh\s+guna|ya|\u53ef\u4ee5(?:\u7684)?(?:\u554a|\u5440)?|\u53ef\u4ee5\u7528(?:\u554a|\u5440)?|\u80fd(?:\u7528)?(?:\u554a|\u5440)?|\u884c(?:\u7684)?(?:\u554a|\u5440)?|\u6ca1\u95ee\u9898(?:\u554a|\u5440)?|\u6c92\u554f\u984c(?:\u554a|\u5440)?)[.!\uff01\u3002]?$/i;
const STRONG_BUYING_INTENT_PATTERN = /\b(?:ready\s+to\s+proceed|want\s+to\s+proceed|would\s+like\s+to\s+proceed|let['’]?s\s+(?:proceed|do\s+it|go\s+ahead)|go\s+ahead|move\s+forward|want\s+to\s+start|ready\s+to\s+start)\b|(?:想做|要做|可以做|继续做|繼續做|继续吧|繼續吧|开始吧|開始吧)|\b(?:nak|mahu)\s+(?:proceed|teruskan|mula)\b|\bteruskan\b/i;

const SERVICE_REQUIRED_CONSTRAINTS = {
  "Kitchen Cabinets": ["wall"],
  "Built-in Wardrobes": ["wall"],
  "TV Console & Living Room Carpentry": ["wall", "power"],
  "Shoe Cabinet & Entrance Storage": ["wall"],
  "Study, Display & Storage Cabinets": ["wall"],
  "Full-Home Custom Carpentry": [],
};

function lastUserText(messages) {
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return String(messages[index].content || "");
  }
  return "";
}

function strongBuyingIntent(messages) {
  return STRONG_BUYING_INTENT_PATTERN.test(lastUserText(messages));
}

function fallbackOpening(language) {
  if (language === "zh") return "你好 👋 你想做哪一种柜子？厨房柜、衣柜、电视柜、鞋柜，还是其他？";
  if (language === "ms") return "Hi 👋 Anda nak buat cabinet apa — kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau yang lain?";
  return OPENING_MESSAGE;
}

function measurementCloseQuestion(language) {
  if (language === "zh") return "根据你目前给的资料，下一步比较实际的是安排上门量尺，这样团队可以确认实际 layout 和正式 quotation。要不要我帮你转给团队安排？";
  if (language === "ms") return "Berdasarkan detail yang anda dah bagi, next step paling useful ialah site measurement supaya team boleh confirm layout dan quotation sebenar. Nak saya pass kepada team untuk arrange?";
  return "Based on what you've shared, the next useful step is a site measurement so the team can confirm the actual layout and quotation. Want me to get the team to arrange it?";
}

function measurementHandoffReply(language) {
  if (language === "zh") return "可以 👍 我已经记下目前的项目资料，会交给团队继续跟进并确认上门量尺的实际时间。 [[HANDOFF]]";
  if (language === "ms") return "Boleh 👍 Saya dah catat detail projek yang ada dan akan pass kepada team untuk confirm masa site measurement dengan anda. [[HANDOFF]]";
  return "Sure 👍 I've noted the project details so far. I'll pass them to the team so they can confirm the actual site-measurement timing with you. [[HANDOFF]]";
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

function previousAssistantText(messages, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (messages[cursor]?.role === "assistant") return String(messages[cursor].content || "");
    if (messages[cursor]?.role === "user") break;
  }
  return "";
}

function questionTargets(text) {
  const value = String(text || "");
  const targets = new Set();
  if (/usable\s+wall|wall\s+space|wall\s+(?:is\s+)?usable|ruang\s+dinding|dinding.*boleh\s+guna|\u5899\u9762.*(?:\u80fd\u7528|\u53ef\u4ee5\u7528|\u591f\u4e0d\u591f)|\u5899\u9762\u7a7a\u95f4|\u7246\u9762|(?:\u8fd9|\u9019)?\u9762?(?:\u5899|\u7246)(?:\u7684)?\u7a7a\u95f4.*(?:\u80fd\u4e0d\u80fd|\u53ef\u4e0d\u53ef\u4ee5|\u80fd|\u53ef\u4ee5).*\u67dc\u5b50|(?:\u5899|\u7246)(?:\u7684)?\u7a7a\u95f4/i.test(value)) targets.add("wall");
  if (/switch|plug|socket|outlet|power\s*point|suis|soket|\u63d2\u5ea7|\u5f00\u5173|\u958b\u95dc|\u7535\u6e90|\u96fb\u6e90|\u7535\u4f4d|\u96fb\u4f4d/i.test(value)) targets.add("power");
  return targets;
}

function contextualConstraintFacts(state, groups) {
  const messages = state.scopedMessages || [];
  let inferredPlugCount = null;
  let inferredWallClear = false;

  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index]?.role !== "user") continue;
    const text = String(messages[index].content || "").trim();
    if (!text) continue;
    const previousQuestion = previousAssistantText(messages, index);
    const targets = questionTargets(previousQuestion);

    if (ALL_CLEAR_PATTERN.test(text) && targets.has("wall") && targets.has("power")) {
      groups.add("wall");
      groups.add("power");
      inferredWallClear = true;
      continue;
    }

    if (targets.size !== 1 || !SHORT_CONTEXT_ANSWER.test(text)) continue;
    const target = [...targets][0];
    groups.add(target);
    if (target === "wall" && POSITIVE_WALL_CONTEXT.test(text)) inferredWallClear = true;
    if (target === "power") {
      const numeric = text.match(/^\s*(\d+)\s*[.!]?\s*$/)?.[1];
      const wordCount = /^(?:one|got\s+one|ada\s+satu)[.!]?$/i.test(text) ? "1"
        : /^two[.!]?$/i.test(text) ? "2"
          : /^three[.!]?$/i.test(text) ? "3"
            : null;
      inferredPlugCount = numeric || wordCount || inferredPlugCount;
    }
  }

  return { inferredPlugCount, inferredWallClear };
}

function refinedFacts(state) {
  const text = scopedUserText(state);
  const groups = new Set();
  for (const [name, pattern] of Object.entries(GROUP_PATTERNS)) {
    if (pattern.test(text)) groups.add(name);
  }
  const allClear = ALL_CLEAR_PATTERN.test(text);
  if (allClear) groups.add("wall");
  const contextual = contextualConstraintFacts(state, groups);
  const noWindow = NEGATIVE_PATTERNS.window.test(text);
  const noStructure = NEGATIVE_PATTERNS.structure.test(text);
  const noAircon = NEGATIVE_PATTERNS.aircon.test(text);
  const noDb = NEGATIVE_PATTERNS.db.test(text);
  return {
    ...state.facts,
    groups,
    allClear,
    plugCount: state.facts?.plugCount || contextual.inferredPlugCount,
    wallClear: Boolean(state.facts?.wallClear || contextual.inferredWallClear || allClear),
    noWindow,
    hasWindow: groups.has("window") && !noWindow,
    hasBeamOrColumn: groups.has("structure") && !noStructure,
    hasAircon: groups.has("aircon") && !noAircon,
    hasDbBox: groups.has("db") && !noDb,
  };
}

function requiredConstraintGroups(serviceNames) {
  const services = [...new Set((serviceNames || []).filter(Boolean))];
  if (!services.length || services.includes("Full-Home Custom Carpentry")) return [];
  const required = new Set();
  for (const service of services) {
    for (const group of SERVICE_REQUIRED_CONSTRAINTS[service] || ["wall"]) required.add(group);
  }
  return [...required];
}

function missingConstraintGroups(serviceNames, facts) {
  return requiredConstraintGroups(serviceNames).filter((group) => !facts.groups.has(group));
}

function obstructionQuestion(language, missing = ["wall", "power"]) {
  return missingConstraintQuestion(language, missing);
}

function missingConstraintQuestion(language, missing) {
  const needsWall = missing.includes("wall");
  const needsPower = missing.includes("power");
  if (language === "zh") {
    if (needsWall && needsPower) return "好的。这个位置先确认两样就可以：墙面空间能不能用？那里有没有 switch 或 plug？";
    if (needsWall) return "收到。再确认一下，这面墙的空间能不能用来做柜子？";
    return "收到。那里有没有 switch 或 plug？";
  }
  if (language === "ms") {
    if (needsWall && needsPower) return "Baik. Dua benda saja buat masa ini: ruang dinding itu boleh guna untuk cabinet, dan ada switch atau plug point tak?";
    if (needsWall) return "Faham. Tinggal confirm ruang dinding itu boleh guna untuk cabinet atau tidak.";
    return "Faham. Ada switch atau plug point di situ tak?";
  }
  if (needsWall && needsPower) return "Got it. Just two things for now: is the wall space usable for the cabinet, and are there any switches or plug points there?";
  if (needsWall) return "Got it. Is the wall space usable for the cabinet?";
  return "Got it. Are there any switches or plug points there?";
}

function budgetKnown(state) {
  return hasKnownBudget(state.projectMessages || []);
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
  state.measurementReady = Boolean(state.serviceNames?.length && state.sizeKnown && state.hasLocation && !state.missingConstraints.length);
  state.measurementOfferSent = measurementOfferSent(state.scopedMessages);
  state.measurementOfferAccepted = measurementOfferAccepted(state.scopedMessages);
  state.strongBuyingIntent = strongBuyingIntent(state.scopedMessages);
  const next = { ...plan, state };

  if (state.measurementOfferAccepted) {
    next.adviceReply = null;
    next.appendAfterAnswer = null;
    next.reply = measurementHandoffReply(state.language);
    return next;
  }

  // Once the site-measurement close has been offered, qualification is finished.
  // Let the AI continue naturally without falling back into old intake questions.
  if (state.measurementReady && state.measurementOfferSent) {
    next.adviceReply = null;
    next.appendAfterAnswer = null;
    next.reply = null;
    return next;
  }

  const readyForConstraints = state.sizeKnown && state.hasLocation && state.serviceNames?.length;
  if (readyForConstraints && state.missingConstraints.length) {
    const question = missingConstraintQuestion(state.language, state.missingConstraints);
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
  if (state.measurementReady && state.adviceSent && (state.budgetKnown || state.strongBuyingIntent) && !state.measurementOfferSent) {
    next.adviceReply = null;
    next.appendAfterAnswer = null;
    next.reply = markMeasurementOffer(measurementCloseQuestion(state.language));
    return next;
  }
  if (next.adviceReply && state.budgetKnown) next.adviceReply = removeRepeatedBudgetQuestion(next.adviceReply, state.language);
  return next;
}

function bypassPlan() {
  return { reply: null, adviceReply: null, appendAfterAnswer: null, bypass: true, answerFirst: false };
}

function buildRenovationIntakePlan(messages, options = {}) {
  const latest = lastUserText(messages);
  if (isStandaloneUnconfiguredCabinetRequest(latest)) return bypassPlan();
  const sourceMessages = sanitizeLegacyRoutingMessages(messages);
  const plan = enhancePlan(base.buildRenovationIntakePlan(sourceMessages, options));
  if (plan?.reply === base.OPENING_MESSAGE) {
    plan.reply = fallbackOpening(plan.state?.language || "en");
  }
  return plan;
}

function buildRenovationIntakeReply(messages, options = {}) {
  return buildRenovationIntakePlan(messages, options).reply;
}

module.exports = {
  ...base,
  OPENING_MESSAGE,
  buildRenovationIntakeReply,
  buildRenovationIntakePlan,
  _test: {
    ...base._test,
    OPENING_MESSAGE,
    fallbackOpening,
    obstructionQuestion,
    requiredConstraintGroups,
    missingConstraintGroups,
    missingConstraintQuestion,
    refinedFacts,
    questionTargets,
    contextualConstraintFacts,
    budgetKnown,
    removeRepeatedBudgetQuestion,
    isMeasurementOfferText,
    measurementOfferSent,
    measurementOfferAccepted,
    strongBuyingIntent,
    measurementCloseQuestion,
    measurementHandoffReply,
  },
};
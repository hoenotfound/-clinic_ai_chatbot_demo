const { detectServices, detectCorrectedService } = require("./renovationServiceDetection");
const { correctionTargetText, isGenuineRejection } = require("./renovationConversationIntent");
const { detectKnownBudget } = require("./renovationBudgetContext");
const { isExplicitHumanRequest, isTechnicalHandoffRequest } = require("./renovationRoutingIntent");

const PRICE_PATTERN = /price|how much|cost|quotation|quote|budget|harga|berapa|kos|sebut harga|多少钱|多少錢|价格|價格|价钱|價錢|报价|報價|预算|預算/i;
const BUDGET_QUESTION_PATTERN = /(?:do you (?:already )?have|what(?:'s| is)|how much).{0,30}\bbudget\b|\bbudget\b.{0,30}(?:range|in mind|roughly|approximately|around how much)|\bbudget\s*\?|\bbajet\b.{0,24}(?:berapa|range|anggaran)|(?:berapa|anggaran).{0,24}\bbajet\b|\bbajet\s*\?|(?:预算|預算).{0,12}(?:多少|几|幾|范围|範圍)|(?:多少|几|幾).{0,12}(?:预算|預算)|(?:预算|預算)\s*[?？]/i;
const SITE_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|come\s+measure|arrange\s+(?:a\s+)?measurement|home\s+visit|datang\s+ukur|ukur\s+rumah|上门量尺|上門量尺|现场测量|現場測量|量尺/i;
const QUOTE_INTENT_PATTERN = /exact\s+(?:price|quote|quotation)|proper\s+(?:quote|quotation)|send\s+(?:me\s+)?(?:a\s+)?quote|prepare\s+(?:a\s+)?quotation|can\s+(?:you\s+)?quote|nak\s+quotation|mahu\s+quotation|buat\s+quotation|正式报价|正式報價|给我报价|給我報價|出报价|出報價/i;
const MEASUREMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|尺寸|尺|平面图|平面圖|ukuran|pelan/i;
const FLOOR_PLAN_PATTERN = /floor\s*plan|layout\s*plan|平面图|平面圖|pelan/i;
const MEASUREMENT_GROUP_PATTERN = /\b(?:both|all|each)\b|两个|兩個|全部|都|semua|kedua-dua/i;
const MEASUREMENT_CLAUSE_SPLIT_PATTERN = /\s*(?:[,;]|\+|&)\s*|\s+(?:and|dan)\s+|(?:以及|还有|還有|和)/i;
const TIMELINE_PATTERN = /move\s*in|moving|collect(?:ed|ing)?\s+keys?|get(?:ting)?\s+keys?|handover|complete\s+by|finish\s+by|next\s+(?:week|month)|this\s+(?:week|month)|within\s+\d+\s+(?:week|weeks|month|months)|baru\s+dapat\s+kunci|dapat\s+kunci|nak\s+siap|pindah|拿钥匙|拿鑰匙|交房|入住|搬家|完工/i;
const RENEWED_INTEREST_PATTERN = /\b(?:change(?:d)?\s+(?:my|our)\s+mind|let['’]?s\s+(?:proceed|continue|go ahead)|(?:i|we)\s+(?:want|would like|wanna)\s+to\s+(?:proceed|continue|go ahead)|(?:please\s+)?(?:proceed|go ahead|continue|resume)(?:\s+(?:with\s+)?(?:it|this|the project))?)\b|(?:tukar|ubah|berubah)\s+fikiran|(?:nak|mahu)\s+(?:teruskan|proceed)|\bteruskan\b|改变主意|改變主意|继续做|繼續做|继续吧|繼續吧|可以继续|可以繼續/i;

function customerMessages(session) {
  return (session.messages || []).filter((message) => message.role === "user");
}

function detectBudget(text, { allowBare = false } = {}) {
  const source = String(text || "");
  const matches = [...source.matchAll(/(?:rm\s*)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const numeric = Number(String(match[1]).replace(/,/g, ""));
    if (!Number.isFinite(numeric)) continue;
    const value = match[2] ? numeric * 1000 : numeric;
    if (value < 500) continue;
    const suffix = source.slice(match.index + match[0].length, match.index + match[0].length + 10);
    if (/^\s*(?:mm|cm|m|meter|metre|ft|feet|foot)\b/i.test(suffix)) continue;
    const nearby = source.slice(Math.max(0, match.index - 20), Math.min(source.length, match.index + match[0].length + 25));
    if (!/rm|budget|bajet|预算|預算/i.test(nearby) && !match[2] && !allowBare) continue;
    return `RM${Math.round(value).toLocaleString("en-MY")}`;
  }
  return null;
}

function previousAssistantAskedForBudget(session) {
  const messages = session.messages || [];
  const latestUserIndex = [...messages].map((message) => message.role).lastIndexOf("user");
  if (latestUserIndex <= 0) return false;
  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "assistant") return BUDGET_QUESTION_PATTERN.test(message.content || "");
    if (message.role === "user") return false;
  }
  return false;
}

function lastPatternIndex(value, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  let lastIndex = -1;
  for (const match of value.matchAll(globalPattern)) lastIndex = match.index;
  return lastIndex;
}

function latestPatternLabel(text, entries) {
  const value = String(text || "");
  let winner = null;
  let winnerIndex = -1;
  for (const [pattern, label] of entries) {
    const index = lastPatternIndex(value, pattern);
    if (index >= winnerIndex && index >= 0) {
      winner = label;
      winnerIndex = index;
    }
  }
  return winner;
}

function detectPropertyType(text) {
  return latestPatternLabel(text, [
    [/landed|terrace|semi[- ]?d|bungalow|link\s+house|rumah\s+landed|排屋|双层|雙層|独立屋|獨立屋/i, "Landed house"],
    [/commercial|office|shop|retail|办公|辦公|店面|pejabat|kedai/i, "Commercial / office"],
    [/condo(?:minium)?|apartment|service\s+residence|flat|公寓/i, "Condo / apartment"],
  ]);
}

function detectPropertyStatus(text) {
  return latestPatternLabel(text, [
    [/subsale|existing\s+home|existing\s+unit|old\s+house|rumah\s+lama|二手房|旧屋|舊屋/i, "Subsale / existing home"],
    [/new\s+(?:condo|unit|project|home|house)|newly\s+completed|just\s+(?:got|collected)\s+keys|baru\s+dapat\s+kunci|新房|新屋|新公寓/i, "New project"],
  ]);
}

function detectArea(text) {
  return latestPatternLabel(text, [
    [/puchong|cheras|kajang|蒲种|蒲種|蕉赖|蕉賴|加影/i, "Cheras / Kajang / Puchong"],
    [/petaling\s+jaya|\bpj\b|subang|shah\s+alam|ara\s+damansara|damansara|八打灵再也|八打靈再也|梳邦|莎阿南/i, "Petaling Jaya / Subang / Shah Alam"],
    [/kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+bintang|bukit\s+jalil|setapak|old\s+klang\s+road|吉隆坡/i, "Kuala Lumpur"],
  ]);
}

function latestDetected(messages, detector) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const detected = detector(messages[index]?.content || "");
    if (detected) return detected;
  }
  return null;
}

function latestBudget(messages, session) {
  const latestIndex = messages.length - 1;
  const allowBareLatest = previousAssistantAskedForBudget(session);
  for (let index = latestIndex; index >= 0; index -= 1) {
    const detected = detectBudget(messages[index]?.content || "", {
      allowBare: allowBareLatest && index === latestIndex,
    });
    if (detected) return detected;
  }
  return null;
}

function detectTiming(text, previous = null) {
  const value = String(text || "");
  let timing = previous;
  if (/weekend|saturday|sunday|sabtu|ahad|周末|週末|星期六|星期日|周六|週六|周日|週日/i.test(value)) timing = "Weekend";
  else if (/weekday|monday|tuesday|wednesday|thursday|friday|isnin|selasa|rabu|khamis|jumaat|平日|星期一|星期二|星期三|星期四|星期五/i.test(value)) timing = "Weekday";
  if (/morning|pagi|早上|上午/i.test(value)) timing = timing ? `${timing}, morning` : "Morning";
  else if (/afternoon|petang|下午/i.test(value)) timing = timing ? `${timing}, afternoon` : "Afternoon";
  else if (/evening|night|malam|晚上/i.test(value)) timing = timing ? `${timing}, evening` : "Evening";
  return timing;
}

function hasRenewedInterest(messages, negativeIndex) {
  if (negativeIndex < 0) return true;
  return messages.slice(negativeIndex + 1).some((message) => {
    const text = message.content || "";
    if (isGenuineRejection(text)) return false;
    return detectServices(text).length ||
      PRICE_PATTERN.test(text) ||
      SITE_PATTERN.test(text) ||
      QUOTE_INTENT_PATTERN.test(text) ||
      RENEWED_INTEREST_PATTERN.test(text);
  });
}

function resolveServices(messages, initialServices = []) {
  let services = new Set(initialServices || []);
  for (const message of messages || []) {
    const text = message?.content || "";
    const corrected = detectCorrectedService(text);
    if (corrected) {
      const correctedServices = detectServices(correctionTargetText(text));
      services = new Set(correctedServices.length ? correctedServices : [corrected.name]);
      continue;
    }
    for (const service of detectServices(text)) services.add(service);
  }
  return Array.from(services);
}

function latestServiceCorrectionIndex(messages) {
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    if (detectCorrectedService(messages[index]?.content || "")) return index;
  }
  return -1;
}

function currentScopeMeasurementText(messages) {
  const correctionIndex = latestServiceCorrectionIndex(messages);
  if (correctionIndex < 0) {
    return (messages || []).map((message) => message?.content || "").join(" \n");
  }

  const scopedMessages = messages.slice(correctionIndex);
  return scopedMessages.map((message, index) => {
    const text = message?.content || "";
    return index === 0 ? correctionTargetText(text) : text;
  }).join(" \n");
}

function measurementStateForServices(messages, services, { initialState = {} } = {}) {
  const serviceNames = [...new Set((services || []).filter(Boolean))];
  const state = Object.fromEntries(serviceNames.map((name) => [name, Boolean(initialState?.[name])]));
  if (!serviceNames.length) return state;

  const userMessages = (messages || []).filter((message) => !message?.role || message.role === "user");
  const correctionIndex = latestServiceCorrectionIndex(userMessages);
  const scopedMessages = correctionIndex >= 0 ? userMessages.slice(correctionIndex) : userMessages;

  if (correctionIndex >= 0) {
    for (const name of serviceNames) state[name] = false;
  }

  for (let messageIndex = 0; messageIndex < scopedMessages.length; messageIndex += 1) {
    const raw = scopedMessages[messageIndex]?.content || "";
    const text = correctionIndex >= 0 && messageIndex === 0 ? correctionTargetText(raw) : raw;

    if (FLOOR_PLAN_PATTERN.test(text)) {
      for (const name of serviceNames) state[name] = true;
      continue;
    }

    const messageMentions = detectServices(text, { allowBareScope: true })
      .filter((name) => serviceNames.includes(name));
    const groupedMeasurementForAll = serviceNames.length > 1 &&
      MEASUREMENT_GROUP_PATTERN.test(text) &&
      MEASUREMENT_PATTERN.test(text) &&
      serviceNames.every((name) => messageMentions.includes(name));
    if (groupedMeasurementForAll) {
      for (const name of serviceNames) state[name] = true;
      continue;
    }

    let lastMentioned = [];
    const clauses = String(text).split(MEASUREMENT_CLAUSE_SPLIT_PATTERN).filter(Boolean);
    for (const clause of clauses) {
      const mentioned = detectServices(clause, { allowBareScope: true })
        .filter((name) => serviceNames.includes(name));
      if (mentioned.length) lastMentioned = mentioned;
      if (!MEASUREMENT_PATTERN.test(clause)) continue;

      if (serviceNames.length > 1 && MEASUREMENT_GROUP_PATTERN.test(clause)) {
        for (const name of serviceNames) state[name] = true;
      } else if (mentioned.length) {
        for (const name of mentioned) state[name] = true;
      } else if (serviceNames.length === 1) {
        state[serviceNames[0]] = true;
      } else if (lastMentioned.length === 1) {
        state[lastMentioned[0]] = true;
      }
    }
  }

  return state;
}

function buildSummary({ services, siteMeasurementIntent, quotationIntent, humanRequest, area, propertyType, propertyStatus, budget, measurementsKnown, timing, negative }) {
  if (negative) return "The customer has paused or declined the renovation enquiry for now.";
  const parts = [];
  if (services.length) parts.push(`Interested in ${services.join(" and ")}`);
  if (propertyType) parts.push(propertyType.toLowerCase());
  if (propertyStatus) parts.push(propertyStatus.toLowerCase());
  if (area) parts.push(`project area: ${area}`);
  if (budget) parts.push(`budget around ${budget}`);
  if (measurementsKnown) parts.push("measurements/floor-plan context provided");
  if (timing) parts.push(`timing preference: ${timing}`);
  if (siteMeasurementIntent) parts.push("requested site measurement");
  else if (quotationIntent) parts.push("requested a proper quotation");
  else if (humanRequest) parts.push("asked to speak with the renovation team");
  if (!parts.length) return "Early-stage renovation enquiry. No specific carpentry scope or quotation intent detected yet.";
  return `${parts.join("; ")}.`;
}

function activeConversationForLead(session, activeMessages) {
  if (!activeMessages.length) return [];
  const startIndex = (session.messages || []).indexOf(activeMessages[0]);
  return startIndex >= 0 ? session.messages.slice(startIndex) : activeMessages;
}

function updateRenovationLead(session) {
  const messages = customerMessages(session);

  let lastNegativeIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isGenuineRejection(messages[index].content || "")) {
      lastNegativeIndex = index;
      break;
    }
  }

  const sameMessageReplacement = lastNegativeIndex >= 0
    ? detectCorrectedService(messages[lastNegativeIndex]?.content || "")
    : null;
  const renewedAfterNegative = lastNegativeIndex >= 0 && hasRenewedInterest(messages, lastNegativeIndex);
  const negative = lastNegativeIndex >= 0 && !sameMessageReplacement && !renewedAfterNegative;
  const freshAfterRenewal = lastNegativeIndex >= 0 && !sameMessageReplacement && renewedAfterNegative;

  let activeMessages;
  if (negative) activeMessages = [];
  else if (lastNegativeIndex < 0) activeMessages = messages;
  else if (sameMessageReplacement) {
    // This is a scope correction, not a true pause. Keep earlier project-level
    // property/budget/location context while resolveServices() replaces stale scope.
    activeMessages = messages;
  } else {
    // A genuinely paused lead that later renews interest starts a fresh active segment.
    activeMessages = messages.slice(lastNegativeIndex + 1);
  }

  const carryPreviousProject = !freshAfterRenewal;
  const activeText = activeMessages.map((message) => message.content || "").join(" \n");
  const activeConversation = activeConversationForLead(session, activeMessages);
  const services = resolveServices(
    activeMessages,
    carryPreviousProject ? (session.lead?.interests || []) : []
  );

  const siteMeasurementIntent = !negative && SITE_PATTERN.test(activeText);
  const quotationIntent = !negative && QUOTE_INTENT_PATTERN.test(activeText);
  const humanRequest = !negative && activeMessages.some((message) => isExplicitHumanRequest(message.content || ""));
  const technicalHandoff = !negative && activeMessages.some((message) => isTechnicalHandoffRequest(message.content || ""));
  const bookingIntent = siteMeasurementIntent || quotationIntent;
  const askedPrice = !negative && PRICE_PATTERN.test(activeText);
  const budget = !negative
    ? detectKnownBudget(activeConversation) || (carryPreviousProject ? session.lead?.budget : null) || null
    : session.lead?.budget || null;
  const propertyType = !negative
    ? latestDetected(activeMessages, detectPropertyType) || (carryPreviousProject ? session.lead?.propertyType : null) || null
    : session.lead?.propertyType || null;
  const propertyStatus = !negative
    ? latestDetected(activeMessages, detectPropertyStatus) || (carryPreviousProject ? session.lead?.propertyStatus : null) || null
    : session.lead?.propertyStatus || null;
  const area = !negative
    ? latestDetected(activeMessages, detectArea) || (carryPreviousProject ? session.lead?.preferredBranch : null) || null
    : session.lead?.preferredBranch || null;

  const previousMeasurementState = carryPreviousProject
    ? { ...(session.lead?.measurementsByService || {}) }
    : {};
  if (
    carryPreviousProject &&
    !Object.keys(previousMeasurementState).length &&
    session.lead?.measurementsKnown
  ) {
    for (const name of session.lead?.interests || []) previousMeasurementState[name] = true;
  }

  const measurementsByService = negative
    ? { ...(session.lead?.measurementsByService || {}) }
    : measurementStateForServices(activeMessages, services, { initialState: previousMeasurementState });
  const measurementsKnown = !negative && (
    services.length
      ? services.every((name) => Boolean(measurementsByService[name]))
      : MEASUREMENT_PATTERN.test(currentScopeMeasurementText(activeMessages))
  );
  const timelineMentioned = !negative && (
    TIMELINE_PATTERN.test(activeText) ||
    (carryPreviousProject && Boolean(session.lead?.timelineMentioned))
  );

  let timing = carryPreviousProject ? (session.lead?.preferredTiming || null) : null;
  for (const message of activeMessages) timing = detectTiming(message.content, timing);

  let score = 0;
  if (services.length) score += 2;
  if (askedPrice) score += 2;
  if (budget) score += 2;
  if (area) score += 1;
  if (propertyType) score += 1;
  if (propertyStatus) score += 1;
  if (measurementsKnown) score += 2;
  if (timelineMentioned) score += 1;
  if (siteMeasurementIntent) score += 5;
  if (quotationIntent) score += 4;
  if (humanRequest) score += 2;
  if (negative) score = 0;

  const highIntent = bookingIntent || (humanRequest && Boolean(services.length || budget || area));
  const temperature = highIntent || score >= 8 ? "hot" : score >= 3 ? "warm" : "cold";
  session.lead = {
    ...session.lead,
    temperature,
    score,
    interests: services,
    bookingIntent,
    reducedInterest: negative,
    preferredTiming: timing,
    preferredBranch: area,
    propertyType,
    propertyStatus,
    budget,
    measurementsKnown,
    measurementsByService,
    timelineMentioned,
    siteMeasurementIntent,
    quotationIntent,
    humanRequest,
    technicalHandoff,
    summary: buildSummary({ services, siteMeasurementIntent, quotationIntent, humanRequest, area, propertyType, propertyStatus, budget, measurementsKnown, timing, negative }),
  };
  return session.lead;
}

module.exports = {
  updateRenovationLead,
  detectServices,
  detectArea,
  detectPropertyType,
  detectPropertyStatus,
  detectBudget,
  resolveServices,
  measurementStateForServices,
};

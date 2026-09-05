const renovation = require("./renovationConfig");

const PRICE_PATTERN = /price|how much|cost|quotation|quote|budget|harga|berapa|kos|sebut harga|多少钱|多少錢|价格|價格|价钱|價錢|报价|報價|预算|預算/i;
const SITE_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|come\s+measure|arrange\s+(?:a\s+)?measurement|home\s+visit|datang\s+ukur|ukur\s+rumah|上门量尺|上門量尺|现场测量|現場測量|量尺/i;
const QUOTE_INTENT_PATTERN = /exact\s+(?:price|quote|quotation)|proper\s+(?:quote|quotation)|send\s+(?:me\s+)?(?:a\s+)?quote|prepare\s+(?:a\s+)?quotation|can\s+(?:you\s+)?quote|nak\s+quotation|mahu\s+quotation|buat\s+quotation|正式报价|正式報價|给我报价|給我報價|出报价|出報價/i;
const HUMAN_PATTERN = /speak\s+to\s+(?:a\s+)?(?:human|staff|designer|sales|contractor)|talk\s+to\s+(?:a\s+)?(?:human|staff|designer|sales|contractor)|human\s+(?:please|pls)|designer|project manager|salesperson|真人|人工|设计师|設計師|顾问|顧問|staff|orang/i;
const NEGATIVE_PATTERN = /not interested|no longer interested|never ?mind|don['’]t want|do not want|cancel|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|batal|不要了|不想做|没兴趣|沒興趣|算了|取消/i;
const MEASUREMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|尺寸|尺|平面图|平面圖|ukuran|pelan/i;
const TIMELINE_PATTERN = /move\s*in|moving|collect(?:ed|ing)?\s+keys?|get(?:ting)?\s+keys?|handover|complete\s+by|finish\s+by|next\s+(?:week|month)|this\s+(?:week|month)|within\s+\d+\s+(?:week|weeks|month|months)|baru\s+dapat\s+kunci|dapat\s+kunci|nak\s+siap|pindah|拿钥匙|拿鑰匙|交房|入住|搬家|完工/i;

function customerMessages(session) {
  return (session.messages || []).filter((message) => message.role === "user");
}

function detectServices(text) {
  const lower = String(text || "").toLowerCase();
  return renovation.services
    .filter((service) => [service.name, ...(service.aliases || [])].some((term) => lower.includes(String(term).toLowerCase())))
    .map((service) => service.name);
}

function detectBudget(text) {
  const source = String(text || "");
  const matches = [...source.matchAll(/(?:rm\s*)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi)];
  for (const match of matches) {
    const numeric = Number(String(match[1]).replace(/,/g, ""));
    if (!Number.isFinite(numeric)) continue;
    const value = match[2] ? numeric * 1000 : numeric;
    if (value < 500) continue;
    const nearby = source.slice(Math.max(0, match.index - 20), Math.min(source.length, match.index + match[0].length + 25));
    if (!/rm|budget|bajet|预算|預算/i.test(nearby) && !match[2]) continue;
    return `RM${Math.round(value).toLocaleString("en-MY")}`;
  }
  return null;
}

function detectPropertyType(text) {
  const value = String(text || "");
  if (/landed|terrace|semi[- ]?d|bungalow|link\s+house|rumah\s+landed|排屋|双层|雙層|独立屋|獨立屋/i.test(value)) return "Landed house";
  if (/commercial|office|shop|retail|办公|辦公|店面|pejabat|kedai/i.test(value)) return "Commercial / office";
  if (/subsale|existing\s+home|existing\s+unit|old\s+house|rumah\s+lama|二手房|旧屋|舊屋/i.test(value)) return "Subsale / existing home";
  if (/new\s+(?:condo|unit|project|home|house)|newly\s+completed|just\s+(?:got|collected)\s+keys|baru\s+dapat\s+kunci|新房|新屋|新公寓/i.test(value)) return "New project";
  if (/condo|minium|apartment|service\s+residence|flat|公寓|condominium/i.test(value)) return "Condo / apartment";
  return null;
}

function detectArea(text) {
  const value = String(text || "");
  if (/puchong|cheras|kajang|蒲种|蒲種|蕉赖|蕉賴|加影/i.test(value)) return "Cheras / Kajang / Puchong";
  if (/petaling\s+jaya|\bpj\b|subang|shah\s+alam|八打灵再也|八打靈再也|梳邦|莎阿南/i.test(value)) return "Petaling Jaya / Subang / Shah Alam";
  if (/kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+bintang|bukit\s+jalil|setapak|old\s+klang\s+road|吉隆坡/i.test(value)) return "Kuala Lumpur";
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
    return detectServices(text).length || PRICE_PATTERN.test(text) || SITE_PATTERN.test(text) || QUOTE_INTENT_PATTERN.test(text);
  });
}

function buildSummary({ services, bookingIntent, area, propertyType, budget, measurementsKnown, timing, negative }) {
  if (negative) return "The customer has paused or declined the renovation enquiry for now.";
  const parts = [];
  if (services.length) parts.push(`Interested in ${services.join(" and ")}`);
  if (propertyType) parts.push(propertyType.toLowerCase());
  if (area) parts.push(`project area: ${area}`);
  if (budget) parts.push(`budget around ${budget}`);
  if (measurementsKnown) parts.push("measurements/floor-plan context provided");
  if (timing) parts.push(`timing preference: ${timing}`);
  if (bookingIntent) parts.push("wants a proper quotation or site measurement and is ready for staff follow-up");
  if (!parts.length) return "Early-stage renovation enquiry. No specific carpentry scope or quotation intent detected yet.";
  return `${parts.join("; ")}.`;
}

function updateRenovationLead(session) {
  const messages = customerMessages(session);
  const allText = messages.map((message) => message.content || "").join(" \n");

  let lastNegativeIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (NEGATIVE_PATTERN.test(messages[index].content || "")) {
      lastNegativeIndex = index;
      break;
    }
  }
  const negative = lastNegativeIndex >= 0 && !hasRenewedInterest(messages, lastNegativeIndex);
  const activeMessages = negative ? [] : lastNegativeIndex >= 0 ? messages.slice(lastNegativeIndex + 1) : messages;
  const activeText = activeMessages.map((message) => message.content || "").join(" \n");

  const historical = new Set(session.lead?.interests || []);
  for (const service of detectServices(allText)) historical.add(service);
  const activeServices = detectServices(activeText);
  const services = activeServices.length ? activeServices : Array.from(historical);

  const bookingIntent = !negative && (SITE_PATTERN.test(activeText) || QUOTE_INTENT_PATTERN.test(activeText) || HUMAN_PATTERN.test(activeText));
  const askedPrice = !negative && PRICE_PATTERN.test(activeText);
  const budget = !negative ? detectBudget(activeText) || session.lead?.budget || null : session.lead?.budget || null;
  const propertyType = !negative ? detectPropertyType(activeText) || session.lead?.propertyType || null : session.lead?.propertyType || null;
  const area = !negative ? detectArea(activeText) || session.lead?.preferredBranch || null : session.lead?.preferredBranch || null;
  const measurementsKnown = !negative && (MEASUREMENT_PATTERN.test(activeText) || Boolean(session.lead?.measurementsKnown));
  const timelineMentioned = !negative && (TIMELINE_PATTERN.test(activeText) || Boolean(session.lead?.timelineMentioned));

  let timing = session.lead?.preferredTiming || null;
  for (const message of activeMessages) timing = detectTiming(message.content, timing);

  let score = 0;
  if (services.length) score += 2;
  if (askedPrice) score += 2;
  if (budget) score += 2;
  if (area) score += 1;
  if (propertyType) score += 1;
  if (measurementsKnown) score += 2;
  if (timelineMentioned) score += 1;
  if (bookingIntent) score += 5;
  if (negative) score = 0;

  const temperature = bookingIntent || score >= 8 ? "hot" : score >= 3 ? "warm" : "cold";
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
    budget,
    measurementsKnown,
    timelineMentioned,
    quotationIntent: bookingIntent,
    summary: buildSummary({ services, bookingIntent, area, propertyType, budget, measurementsKnown, timing, negative }),
  };
  return session.lead;
}

module.exports = { updateRenovationLead, detectServices, detectArea, detectPropertyType, detectBudget };

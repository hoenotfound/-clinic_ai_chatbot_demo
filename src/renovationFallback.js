const renovation = require("./renovationConfig");

const HUMAN_REQUEST_PATTERN = /(?:speak|talk|chat|connect)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project manager)|(?:can|could)\s+i\s+(?:speak|talk)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project manager)|(?:need|want)\s+(?:a\s+)?(?:human|designer|salesperson|project manager)|human\s+(?:please|pls)|真人|人工|转人工|轉人工|找设计师|找設計師|联系顾问|聯繫顧問|nak\s+cakap\s+dengan\s+(?:staff|designer|sales)|mahu\s+cakap\s+dengan\s+(?:staff|designer|sales)/i;
const SITE_VISIT_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|come\s+measure|measure\s+(?:my|the)\s+(?:house|home|unit|place)|arrange\s+(?:a\s+)?measurement|quotation\s+appointment|home\s+visit|上门量尺|上門量尺|量尺|现场测量|現場測量|datang\s+ukur|site\s+measurement|ukur\s+rumah/i;
const QUOTE_INTENT_PATTERN = /exact\s+(?:price|quote|quotation)|proper\s+(?:quote|quotation)|send\s+(?:me\s+)?(?:a\s+)?quote|prepare\s+(?:a\s+)?quotation|can\s+(?:you\s+)?quote|nak\s+quotation|mahu\s+quotation|buat\s+quotation|正式报价|正式報價|给我报价|給我報價|出报价|出報價/i;
const TECHNICAL_PATTERN = /load[- ]?bearing|structural|hack(?:ing)?\s+(?:wall|beam|column)|electrical|rewir(?:e|ing)|plumb(?:ing)?|waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority|approval|承重墙|承重牆|敲墙|敲牆|电线|電線|水管|防水|kelulusan|struktur|pendawaian|paip/i;
const COMPLAINT_PATTERN = /complaint|refund|defect|damage|poor workmanship|wrong colour|wrong color|not happy|very disappointed|投诉|投訴|退款|瑕疵|做坏|做壞|rosak|aduan/i;
const PRICE_PATTERN = /price|how much|cost|quotation|quote|budget|harga|berapa|kos|sebut harga|多少钱|多少錢|价格|價格|价钱|價錢|报价|報價|预算|預算/i;
const BUDGET_QUESTION_PATTERN = /(?:do you (?:already )?have|what(?:'s| is)|how much).{0,30}\bbudget\b|\bbudget\b.{0,30}(?:range|in mind|roughly|approximately|around how much)|\bbudget\s*\?|\bbajet\b.{0,24}(?:berapa|range|anggaran)|(?:berapa|anggaran).{0,24}\bbajet\b|\bbajet\s*\?|(?:预算|預算).{0,12}(?:多少|几|幾|范围|範圍)|(?:多少|几|幾).{0,12}(?:预算|預算)|(?:预算|預算)\s*[?？]/i;
const MEASUREMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|尺寸|平面图|平面圖|ukuran|pelan/i;
const TIMELINE_PATTERN = /move\s*in|moving|collect(?:ed|ing)?\s+keys?|handover|complete\s+by|finish\s+by|next\s+(?:week|month)|this\s+(?:week|month)|within\s+\d+\s+(?:week|weeks|month|months)|baru\s+dapat\s+kunci|dapat\s+kunci|nak\s+siap|pindah|拿钥匙|拿鑰匙|交房|入住|搬家|完工/i;
const ENGLISH_SIGNAL_WORDS = new Set([
  "i", "we", "you", "my", "our", "your", "want", "need", "can", "could", "please",
  "how", "much", "what", "where", "when", "why", "is", "are", "do", "does", "have",
  "has", "price", "quote", "quotation", "budget", "english",
]);

function userTexts(messages) {
  return (messages || []).filter((message) => message.role === "user").map((message) => String(message.content || "").trim()).filter(Boolean);
}

function latestUserText(messages) {
  return userTexts(messages).at(-1) || "";
}

function conversationText(messages) {
  return userTexts(messages).join(" \n");
}

function languageOf(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  if (/\benglish\b/i.test(value)) return "en";
  if (/(?:中文|华语|華語|mandarin)/i.test(value)) return "zh";
  if (/\b(?:bahasa malaysia|bahasa melayu|malay)\b/i.test(value)) return "ms";
  if (/[一-鿿]/.test(value)) return "zh";
  if (/\b(?:saya|nak|mahu|boleh|berapa|harga|rumah|kabinet|dapur|ukur|bajet|baru dapat kunci)\b/i.test(value)) return "ms";

  const words = value.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
  if (!words.length) return null;
  const signalCount = words.filter((word) => ENGLISH_SIGNAL_WORDS.has(word)).length;
  if (signalCount >= 2 || words.length >= 4) return "en";
  return null;
}

function conversationLanguage(messages) {
  const texts = userTexts(messages);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const language = languageOf(texts[index]);
    if (language) return language;
  }
  return "en";
}

function previousAssistantText(messages) {
  const items = messages || [];
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex <= 0) return "";
  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    if (items[index].role === "assistant") return String(items[index].content || "");
    if (items[index].role === "user") return "";
  }
  return "";
}

function parseBareBudget(text) {
  const match = String(text || "").trim().match(/^(?:rm\s*)?(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k)?$/i);
  if (!match) return null;
  const numeric = Number(String(match[1]).replace(/,/g, ""));
  if (!Number.isFinite(numeric)) return null;
  const value = match[2] ? numeric * 1000 : numeric;
  if (value < 500) return null;
  return `RM${Math.round(value).toLocaleString("en-MY")}`;
}

function detectContextualBudget(messages) {
  const previousAssistant = previousAssistantText(messages);
  if (!BUDGET_QUESTION_PATTERN.test(previousAssistant)) return null;
  return parseBareBudget(latestUserText(messages));
}

function detectService(text) {
  const lower = String(text || "").toLowerCase();
  return renovation.services.find((service) =>
    [service.name, ...(service.aliases || [])].some((term) => lower.includes(String(term).toLowerCase()))
  ) || null;
}

function detectKnownService(messages) {
  const texts = userTexts(messages);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const service = detectService(texts[index]);
    if (service) return service;
  }
  return null;
}

function hasPropertyType(text) {
  return /condo|minium|apartment|service\s+residence|flat|landed|terrace|semi[- ]?d|bungalow|commercial|office|shop|retail|公寓|排屋|独立屋|獨立屋|rumah\s+landed/i.test(String(text || ""));
}

function hasArea(text) {
  return /puchong|cheras|kajang|petaling\s+jaya|\bpj\b|subang|shah\s+alam|kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+jalil|setapak|old\s+klang\s+road|蒲种|蒲種|蕉赖|蕉賴|加影|八打灵再也|八打靈再也|吉隆坡/i.test(String(text || ""));
}

function handoffReply(language, reason = "quote") {
  if (language === "zh") {
    if (reason === "technical") return "这个需要团队看实际现场后才能给准确意见，我不应该在聊天里猜。让我转给团队继续帮你。 [[HANDOFF]]";
    if (reason === "complaint") return "明白，这种情况需要由团队直接跟进会比较合适。我帮你转给他们处理。 [[HANDOFF]]";
    if (reason === "human") return "可以，我帮你转给装修团队，让设计或销售人员直接继续跟你聊。 [[HANDOFF]]";
    return "可以，我帮你把这个询问转给装修团队，让他们继续跟进实际报价或量尺安排。 [[HANDOFF]]";
  }
  if (language === "ms") {
    if (reason === "technical") return "Yang ini team perlu tengok keadaan site sebenar dulu, jadi saya tak patut agak dari chat. Saya pass kepada team untuk sambung dengan anda. [[HANDOFF]]";
    if (reason === "complaint") return "Faham. Untuk isu macam ini lebih baik team sendiri follow up terus. Saya pass conversation ini kepada mereka. [[HANDOFF]]";
    if (reason === "human") return "Boleh. Saya pass kepada team renovation supaya designer atau sales boleh sambung terus dengan anda. [[HANDOFF]]";
    return "Boleh. Saya pass kepada team renovation untuk sambung quotation atau arrangement site measurement sebenar dengan anda. [[HANDOFF]]";
  }
  if (reason === "technical") return "That needs the team to check the actual site, so I shouldn't guess from chat. I'll pass this to them for proper advice. [[HANDOFF]]";
  if (reason === "complaint") return "Understood. This is better handled directly by the team, so I'll pass the conversation to them. [[HANDOFF]]";
  if (reason === "human") return "Sure. I'll pass this to the renovation team so a designer or salesperson can continue with you directly. [[HANDOFF]]";
  return "Sure. I'll pass this to the renovation team so they can continue with the actual quotation or site-measurement arrangement. [[HANDOFF]]";
}

function servicePriceReply(service, language, contextText) {
  const nextQuestion = hasPropertyType(contextText)
    ? hasArea(contextText)
      ? null
      : language === "zh" ? "项目在哪个地区？" : language === "ms" ? "Project ini area mana?" : "Which area is the project in?"
    : language === "zh" ? "你的房子是 condo 还是 landed？" : language === "ms" ? "Ini untuk condo atau landed house?" : "Is this for a condo or landed house?";

  if (language === "zh") return `${service.name} 的示范价格是 ${service.priceRange}。最后报价会看实际尺寸、材料、五金和设计细节。${nextQuestion || "如果你有大概尺寸或 floor plan，也可以告诉我。"}`;
  if (language === "ms") return `${service.name} dalam demo ini ${service.priceRange}. Harga akhir bergantung pada ukuran, material, hardware dan design. ${nextQuestion || "Kalau ada rough measurement atau floor plan, boleh share detail itu juga."}`;
  return `${service.name} ${service.priceRange}. The final quote depends on actual measurements, materials, hardware and design details. ${nextQuestion || "If you have rough measurements or a floor plan, that would be the next useful detail."}`;
}

function genericServiceReply(service, language, contextText) {
  if (!hasPropertyType(contextText)) {
    if (language === "zh") return `可以，${service.name} 是这个示范装修公司的项目之一。你的房子是 condo、landed 还是 commercial？`;
    if (language === "ms") return `Boleh, ${service.name} memang termasuk dalam servis demo ini. Property anda condo, landed atau commercial?`;
    return `Yes, ${service.name} is one of the configured services here. Is the property a condo, landed home, or commercial unit?`;
  }
  if (!hasArea(contextText)) {
    if (language === "zh") return `可以做 ${service.name}。项目在哪个地区？`;
    if (language === "ms") return `Boleh buat ${service.name}. Project ini area mana?`;
    return `Yes, ${service.name} is within the carpentry scope. Which area is the project in?`;
  }
  if (language === "zh") return `可以做 ${service.name}。如果有大概尺寸或 floor plan，可以告诉我，我会继续帮你整理报价需要的资料。`;
  if (language === "ms") return `Boleh buat ${service.name}. Kalau ada rough measurement atau floor plan, bagi saya detail itu dan saya boleh bantu susun maklumat untuk quotation.`;
  return `Yes, ${service.name} is within the carpentry scope. If you have rough measurements or a floor plan, that's the next useful detail for quotation planning.`;
}

function budgetReply(budget, language, contextText) {
  let nextQuestion = null;
  if (!hasPropertyType(contextText)) {
    nextQuestion = language === "zh"
      ? "你的房子是 condo、landed 还是 commercial？"
      : language === "ms"
        ? "Property anda condo, landed atau commercial?"
        : "Is the property a condo, landed home, or commercial unit?";
  } else if (!hasArea(contextText)) {
    nextQuestion = language === "zh"
      ? "项目在哪个地区？"
      : language === "ms"
        ? "Project ini area mana?"
        : "Which area is the project in?";
  } else if (!MEASUREMENT_PATTERN.test(contextText)) {
    nextQuestion = language === "zh"
      ? "你有大概尺寸或 floor plan 吗？"
      : language === "ms"
        ? "Ada rough measurement atau floor plan tak?"
        : "Do you have rough measurements or a floor plan?";
  } else if (!TIMELINE_PATTERN.test(contextText)) {
    nextQuestion = language === "zh"
      ? "你大概希望什么时候完成？"
      : language === "ms"
        ? "Target nak siap bila?"
        : "When are you hoping to have it completed?";
  }

  if (language === "zh") return `收到，我先记下预算大概 ${budget}。${nextQuestion || "这个预算会作为后面整理报价范围的参考。"}`;
  if (language === "ms") return `Okay, saya catat bajet sekitar ${budget}. ${nextQuestion || "Bajet ini akan jadi rujukan bila susun scope quotation nanti."}`;
  return `Got it, I'll note a budget of around ${budget}. ${nextQuestion || "I'll keep that as the working budget when narrowing the quotation scope."}`;
}

function genericReply(language) {
  if (language === "zh") return "可以，我可以先帮你了解木工装修需求和大概报价方向。你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？";
  if (language === "ms") return "Boleh, saya boleh bantu faham scope carpentry dan quotation dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau full-house carpentry?";
  return "Sure, I can help narrow down the carpentry scope and quotation first. Are you looking at kitchen cabinets, wardrobes, TV/living-room carpentry, shoe cabinets, or full-home carpentry?";
}

function buildFallbackReply(messages) {
  const text = latestUserText(messages);
  const contextText = conversationText(messages);
  const language = conversationLanguage(messages);

  if (!text) return genericReply(language);
  if (COMPLAINT_PATTERN.test(text)) return handoffReply(language, "complaint");
  if (TECHNICAL_PATTERN.test(text)) return handoffReply(language, "technical");
  if (SITE_VISIT_PATTERN.test(text)) return handoffReply(language, "quote");
  if (QUOTE_INTENT_PATTERN.test(text)) return handoffReply(language, "quote");
  if (HUMAN_REQUEST_PATTERN.test(text)) return handoffReply(language, "human");

  const contextualBudget = detectContextualBudget(messages);
  if (contextualBudget) return budgetReply(contextualBudget, language, contextText);

  const service = detectService(text) || detectKnownService(messages);
  if (service && PRICE_PATTERN.test(text)) return servicePriceReply(service, language, contextText);
  if (detectService(text)) return genericServiceReply(service, language, contextText);

  if (PRICE_PATTERN.test(text)) {
    if (language === "zh") return "可以先给你价格方向，不过木工最后报价需要看项目、尺寸和材料。你主要想做哪一个区域？";
    if (language === "ms") return "Boleh bagi price direction dulu, tapi quotation akhir carpentry kena tengok scope, ukuran dan material. Anda nak buat area mana dulu?";
    return "I can give you a price direction first, but the final carpentry quote depends on scope, measurements and materials. Which area are you planning first?";
  }

  return genericReply(language);
}

module.exports = { buildFallbackReply };

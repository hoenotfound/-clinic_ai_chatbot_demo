const renovation = require("./renovationConfig");
const { detectService } = require("./renovationServiceDetection");

const HUMAN_REQUEST_PATTERN = /(?:speak|talk|chat|connect)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project manager)|(?:can|could)\s+i\s+(?:speak|talk)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project manager)|(?:need|want)\s+(?:a\s+)?(?:human|designer|salesperson|project manager)|human\s+(?:please|pls)|真人|人工|转人工|轉人工|找设计师|找設計師|联系顾问|聯繫顧問|nak\s+cakap\s+dengan\s+(?:staff|designer|sales)|mahu\s+cakap\s+dengan\s+(?:staff|designer|sales)/i;
const SITE_VISIT_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|come\s+measure|measure\s+(?:my|the)\s+(?:house|home|unit|place)|arrange\s+(?:a\s+)?measurement|quotation\s+appointment|home\s+visit|上门量尺|上門量尺|量尺|现场测量|現場測量|datang\s+ukur|site\s+measurement|ukur\s+rumah/i;
const QUOTE_INTENT_PATTERN = /exact\s+(?:price|quote|quotation)|proper\s+(?:quote|quotation)|send\s+(?:me\s+)?(?:a\s+)?quote|prepare\s+(?:a\s+)?quotation|can\s+(?:you\s+)?quote|nak\s+quotation|mahu\s+quotation|buat\s+quotation|正式报价|正式報價|给我报价|給我報價|出报价|出報價/i;
const TECHNICAL_PATTERN = /load[- ]?bearing|structural|hack(?:ing)?\s+(?:wall|beam|column)|electrical|rewir(?:e|ing)|plumb(?:ing)?|waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority|approval|承重墙|承重牆|敲墙|敲牆|电线|電線|水管|防水|kelulusan|struktur|pendawaian|paip/i;
const OUT_OF_SCOPE_PATTERN = /\b(?:tiles?|tiling|floor(?:ing)?|paint(?:ing)?|ceiling|plaster(?:ing)?|wallpaper|masonry|wet\s*works?|bathroom\s+renovation|toilet\s+renovation|kitchen\s+renovation|jubin|lantai|siling|renovasi\s+(?:dapur|bilik\s+air))\b|瓷砖|瓷磚|地砖|地磚|地板|油漆|天花|墙纸|牆紙|泥水|厨房(?:装修|裝修|翻新)|廚房(?:裝修|翻新)|厕所(?:装修|裝修)|廁所裝修|浴室(?:装修|裝修)/i;
const SERVICE_FINISH_PATTERN = /\b(?:paint(?:ed)?|spray[- ]paint(?:ed)?|lacquer(?:ed)?)\s+(?:finish(?:es)?|colour|color|cabinet|door)|\b(?:finish|colour|color)\s+(?:with\s+)?(?:paint|spray[- ]paint|lacquer)|烤漆|喷漆|噴漆|油漆(?:面|柜门|櫃門|finish|颜色|顏色)/i;
const COMPLAINT_PATTERN = /complaint|refund|defect|damage|poor workmanship|wrong colour|wrong color|not happy|very disappointed|投诉|投訴|退款|瑕疵|做坏|做壞|rosak|aduan/i;
const PRICE_PATTERN = /price|how much|cost|quotation|quote|budget|harga|berapa|kos|sebut harga|多少钱|多少錢|价格|價格|价钱|價錢|报价|報價|预算|預算/i;
const BUDGET_QUESTION_PATTERN = /(?:do you (?:already )?have|what(?:'s| is)|how much).{0,30}\bbudget\b|\bbudget\b.{0,30}(?:range|in mind|roughly|approximately|around how much)|\bbudget\s*\?|\bbajet\b.{0,24}(?:berapa|range|anggaran)|(?:berapa|anggaran).{0,24}\bbajet\b|\bbajet\s*\?|(?:预算|預算).{0,12}(?:多少|几|幾|范围|範圍)|(?:多少|几|幾).{0,12}(?:预算|預算)|(?:预算|預算)\s*[?？]/i;
const MEASUREMENT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|尺寸|平面图|平面圖|ukuran|pelan/i;
const TIMELINE_PATTERN = /move\s*in|moving|collect(?:ed|ing)?\s+keys?|handover|complete\s+by|finish\s+by|next\s+(?:week|month)|this\s+(?:week|month)|within\s+\d+\s+(?:week|weeks|month|months)|baru\s+dapat\s+kunci|dapat\s+kunci|nak\s+siap|pindah|拿钥匙|拿鑰匙|交房|入住|搬家|完工/i;
const FRUSTRATION_PATTERN = /i\s+(?:already\s+)?told\s+you|i\s+said|already\s+said|repeat\s+how\s+many|how\s+many\s+times|you\s+want\s+(?:me\s+to\s+)?repeat|我不是说了吗|我不是說了嗎|不是说了吗|不是說了嗎|已经说了|已經說了|刚刚说了|剛剛說了|我说过了|我說過了|都讲了|都講了|dah\s+cakap|sudah\s+cakap|dah\s+bagitahu|sudah\s+beritahu/i;
const SERVICE_QUESTION_PATTERN = /looking\s+at\s+kitchen|kitchen\s+cabinets?.{0,80}wardrobes?|which\s+(?:area|carpentry|project)|主要想做.{0,30}(?:厨房|廚房|衣柜|衣櫃)|(?:厨房柜|廚房櫃).{0,30}(?:衣柜|衣櫃)|nak\s+buat.{0,50}(?:kitchen|wardrobe)/i;
const PROPERTY_QUESTION_PATTERN = /condo.{0,24}landed|landed.{0,24}condo|property.{0,20}(?:type|condo|landed)|房子.{0,20}(?:condo|landed)|(?:condo|landed).{0,20}房子|rumah.{0,20}(?:condo|landed)/i;
const AREA_QUESTION_PATTERN = /which\s+area|project.{0,15}area|where\s+is\s+(?:the\s+)?project|项目.{0,8}(?:哪里|哪個|哪个|地区|地區)|哪.{0,8}(?:区|區)|area\s+mana/i;
const MEASUREMENT_QUESTION_PATTERN = /rough\s+measurement|floor\s*plan|how\s+(?:long|wide|big)|尺寸|多长|多長|多少\s*(?:ft|尺)|ukuran|pelan/i;
const TIMELINE_QUESTION_PATTERN = /when.{0,20}(?:complete|finish|move)|target.{0,20}(?:complete|finish|siap)|什么时候.{0,12}(?:完成|完工)|何时.{0,12}(?:完成|完工)|bila.{0,20}siap/i;
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

function previousAssistantText(messages, beforeIndex = null) {
  const items = messages || [];
  let startIndex = beforeIndex == null ? items.length - 1 : Math.min(beforeIndex - 1, items.length - 1);
  if (beforeIndex == null) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index].role === "user") {
        startIndex = index - 1;
        break;
      }
    }
  }
  for (let index = startIndex; index >= 0; index -= 1) {
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

function parseExplicitBudget(text) {
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
    if (!/rm|budget|bajet|预算|預算/i.test(nearby) && !match[2]) continue;
    return `RM${Math.round(value).toLocaleString("en-MY")}`;
  }
  return null;
}

function detectContextualBudget(messages) {
  const previousAssistant = previousAssistantText(messages);
  if (!BUDGET_QUESTION_PATTERN.test(previousAssistant)) return null;
  return parseBareBudget(latestUserText(messages));
}

function detectKnownBudget(messages) {
  const items = messages || [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index];
    if (message.role !== "user") continue;
    const explicit = parseExplicitBudget(message.content || "");
    if (explicit) return explicit;
    const previousAssistant = previousAssistantText(items, index);
    if (BUDGET_QUESTION_PATTERN.test(previousAssistant)) {
      const contextual = parseBareBudget(message.content || "");
      if (contextual) return contextual;
    }
  }
  return null;
}

function detectKnownService(messages) {
  const items = messages || [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role !== "user") continue;
    const previousAssistant = previousAssistantText(items, index);
    const service = detectService(items[index].content || "", {
      allowBareScope: SERVICE_QUESTION_PATTERN.test(previousAssistant),
    });
    if (service) return service;
  }
  return null;
}

function hasPropertyType(text) {
  return /condo(?:minium)?|apartment|service\s+residence|flat|landed|terrace|semi[- ]?d|bungalow|commercial|office|shop|retail|公寓|排屋|独立屋|獨立屋|rumah\s+landed/i.test(String(text || ""));
}

function hasArea(text) {
  return /puchong|cheras|kajang|petaling\s+jaya|\bpj\b|subang|shah\s+alam|kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+jalil|setapak|old\s+klang\s+road|蒲种|蒲種|蕉赖|蕉賴|加影|八打灵再也|八打靈再也|吉隆坡/i.test(String(text || ""));
}

function previousQuestionKind(messages) {
  const text = previousAssistantText(messages);
  if (!text) return null;
  if (BUDGET_QUESTION_PATTERN.test(text)) return "budget";
  if (PROPERTY_QUESTION_PATTERN.test(text)) return "property";
  if (AREA_QUESTION_PATTERN.test(text)) return "area";
  if (MEASUREMENT_QUESTION_PATTERN.test(text)) return "measurement";
  if (TIMELINE_QUESTION_PATTERN.test(text)) return "timeline";
  if (SERVICE_QUESTION_PATTERN.test(text)) return "service";
  return null;
}

function serviceNameForLanguage(service, language) {
  if (!service) return "the carpentry project";
  const localized = {
    "Kitchen Cabinets": { zh: "厨房柜", ms: "kitchen cabinet" },
    "Built-in Wardrobes": { zh: "衣柜", ms: "wardrobe" },
    "TV Console & Living Room Carpentry": { zh: "电视柜 / 客厅木工", ms: "TV console / living-room carpentry" },
    "Shoe Cabinet & Entrance Storage": { zh: "鞋柜 / 玄关收纳", ms: "shoe cabinet / entrance storage" },
    "Study, Display & Storage Cabinets": { zh: "书房 / 展示 / 收纳柜", ms: "study / display / storage cabinets" },
    "Full-Home Custom Carpentry": { zh: "全屋木工", ms: "full-home carpentry" },
  };
  return localized[service.name]?.[language] || service.name;
}

function priceGuideForLanguage(service, language) {
  const raw = String(service?.price || service?.priceRange || "").trim();
  if (/custom quotation/i.test(raw)) {
    if (language === "zh") return "需要根据实际项目报价";
    if (language === "ms") return "quotation ikut scope sebenar";
    return "Custom quotation";
  }
  const amount = raw.match(/RM\s*[\d,]+/i)?.[0];
  if (!amount) return raw;
  if (language === "zh") return `从 ${amount} 起`;
  if (language === "ms") return `dari ${amount}`;
  return `From ${amount}`;
}

function questionFor(kind, language) {
  const questions = {
    property: {
      zh: "你的房子是 condo、landed 还是 commercial？",
      ms: "Property anda condo, landed atau commercial?",
      en: "Is the property a condo, landed home, or commercial unit?",
    },
    area: {
      zh: "项目在哪个地区？",
      ms: "Project ini area mana?",
      en: "Which area is the project in?",
    },
    measurement: {
      zh: "你有大概尺寸或 floor plan 吗？",
      ms: "Ada rough measurement atau floor plan tak?",
      en: "Do you have rough measurements or a floor plan?",
    },
    budget: {
      zh: "你的预算大概是多少？",
      ms: "Bajet anda lebih kurang berapa?",
      en: "What budget range do you have in mind?",
    },
    timeline: {
      zh: "你大概希望什么时候完成？",
      ms: "Target nak siap bila?",
      en: "When are you hoping to have it completed?",
    },
  };
  return questions[kind]?.[language] || questions[kind]?.en || null;
}

function nextQualificationQuestion(language, messages, contextText, { avoidKind = null } = {}) {
  const missing = [];
  if (!hasPropertyType(contextText)) missing.push("property");
  if (!hasArea(contextText)) missing.push("area");
  if (!MEASUREMENT_PATTERN.test(contextText)) missing.push("measurement");
  if (!detectKnownBudget(messages)) missing.push("budget");
  if (!TIMELINE_PATTERN.test(contextText)) missing.push("timeline");

  const kind = missing.find((item) => item !== avoidKind) || null;
  return kind ? { kind, text: questionFor(kind, language) } : null;
}

function handoffReply(language, reason = "quote") {
  if (language === "zh") {
    if (reason === "technical") return "这个需要团队看实际现场后才能给准确意见，我不应该在聊天里猜。让我转给团队继续帮你。 [[HANDOFF]]";
    if (reason === "scope") return "这个示范主要做定制木工和柜体，我不应该把瓷砖、油漆或其他装修项目当成厨房柜。这个需求需要团队确认，我帮你转给他们。 [[HANDOFF]]";
    if (reason === "complaint") return "明白，这种情况需要由团队直接跟进会比较合适。我帮你转给他们处理。 [[HANDOFF]]";
    if (reason === "human") return "可以，我帮你转给装修团队，让设计或销售人员直接继续跟你聊。 [[HANDOFF]]";
    return "可以，我帮你把这个询问转给装修团队，让他们继续跟进实际报价或量尺安排。 [[HANDOFF]]";
  }
  if (language === "ms") {
    if (reason === "technical") return "Yang ini team perlu tengok keadaan site sebenar dulu, jadi saya tak patut agak dari chat. Saya pass kepada team untuk sambung dengan anda. [[HANDOFF]]";
    if (reason === "scope") return "Demo ini fokus pada custom carpentry dan cabinet. Saya tak patut anggap kerja tile, cat atau renovation lain sebagai kitchen cabinet, jadi saya pass kepada team untuk semak scope sebenar. [[HANDOFF]]";
    if (reason === "complaint") return "Faham. Untuk isu macam ini lebih baik team sendiri follow up terus. Saya pass conversation ini kepada mereka. [[HANDOFF]]";
    if (reason === "human") return "Boleh. Saya pass kepada team renovation supaya designer atau sales boleh sambung terus dengan anda. [[HANDOFF]]";
    return "Boleh. Saya pass kepada team renovation untuk sambung quotation atau arrangement site measurement sebenar dengan anda. [[HANDOFF]]";
  }
  if (reason === "technical") return "That needs the team to check the actual site, so I shouldn't guess from chat. I'll pass this to them for proper advice. [[HANDOFF]]";
  if (reason === "scope") return "This demo focuses on custom carpentry and cabinets. I shouldn't turn tiling, painting or another renovation trade into a cabinet enquiry, so I'll pass this to the team to confirm the actual scope. [[HANDOFF]]";
  if (reason === "complaint") return "Understood. This is better handled directly by the team, so I'll pass the conversation to them. [[HANDOFF]]";
  if (reason === "human") return "Sure. I'll pass this to the renovation team so a designer or salesperson can continue with you directly. [[HANDOFF]]";
  return "Sure. I'll pass this to the renovation team so they can continue with the actual quotation or site-measurement arrangement. [[HANDOFF]]";
}

function servicePriceReply(service, language, messages, contextText) {
  const next = nextQualificationQuestion(language, messages, contextText);
  const label = serviceNameForLanguage(service, language);
  const guide = priceGuideForLanguage(service, language);
  if (language === "zh") return `${label}的参考价格${guide}。最后报价会看实际尺寸、材料、五金和设计细节。${next?.text || "如果你要拿正式报价，我可以继续帮你整理资料。"}`;
  if (language === "ms") return `${label} ${guide}. Harga akhir bergantung pada ukuran, material, hardware dan design. ${next?.text || "Kalau anda nak quotation sebenar, saya boleh terus susun detail yang team perlukan."}`;
  return `${label}: ${guide}. The final quote depends on actual measurements, materials, hardware and design details. ${next?.text || "If you want a proper quotation, I can keep narrowing the details the team needs."}`;
}

function genericServiceReply(service, language, messages, contextText) {
  const next = nextQualificationQuestion(language, messages, contextText);
  const label = serviceNameForLanguage(service, language);
  if (language === "zh") return `可以，先记下是${label}。${next?.text || "如果你要正式报价或量尺，我可以继续帮你转给团队。"}`;
  if (language === "ms") return `Boleh, saya dah catat ${label}. ${next?.text || "Kalau nak quotation atau site measurement, saya boleh terus pass kepada team."}`;
  return `Yes, I've got ${label} as the project. ${next?.text || "If you want a proper quotation or site measurement, I can pass this to the team."}`;
}

function contextualServiceReply(service, language, messages, contextText, { correction = false } = {}) {
  const avoidKind = correction ? previousQuestionKind(messages) : null;
  const next = nextQualificationQuestion(language, messages, contextText, { avoidKind });
  const label = serviceNameForLanguage(service, language);

  if (language === "zh") {
    const prefix = correction ? `对，你已经说了，是${label}。我记住了。` : `收到，我们继续看${label}。`;
    return `${prefix}${next?.text || "你要继续拿正式报价或安排量尺的话，我可以帮你转给团队。"}`;
  }
  if (language === "ms") {
    const prefix = correction ? `Betul, anda dah sebut ${label}. Saya dah catat. ` : `Boleh, kita teruskan untuk ${label}. `;
    return `${prefix}${next?.text || "Kalau nak quotation atau site measurement, saya boleh pass kepada team."}`;
  }
  const prefix = correction
    ? `You're right, you already said ${label}. I've got it. `
    : `Sure, I've got ${label} as the project. `;
  return `${prefix}${next?.text || "If you want a proper quotation or site measurement, I can pass this to the team."}`;
}

function budgetReply(budget, language, messages, contextText) {
  const next = nextQualificationQuestion(language, messages, contextText, { avoidKind: "budget" });
  if (language === "zh") return `收到，我先记下预算大概 ${budget}。${next?.text || "这个预算会作为后面整理报价范围的参考。"}`;
  if (language === "ms") return `Okay, saya catat bajet sekitar ${budget}. ${next?.text || "Bajet ini akan jadi rujukan bila susun scope quotation nanti."}`;
  return `Got it, I'll note a budget of around ${budget}. ${next?.text || "I'll keep that as the working budget when narrowing the quotation scope."}`;
}

function genericReply(language, repeated = false) {
  if (language === "zh") {
    return repeated
      ? "我刚才的问题重复了。你只要告诉我主要想做哪个木工区域，例如厨房柜、衣柜或全屋木工，我会直接从那里继续。"
      : "可以，我可以先帮你了解木工装修需求和大概报价方向。你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？";
  }
  if (language === "ms") {
    return repeated
      ? "Soalan saya tadi berulang. Beritahu saya satu scope carpentry utama sahaja, contohnya kitchen cabinet, wardrobe atau full-house carpentry, dan saya teruskan dari situ."
      : "Boleh, saya boleh bantu faham scope carpentry dan quotation dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau full-house carpentry?";
  }
  return repeated
    ? "I repeated the same question. Just tell me the main carpentry scope once, such as kitchen cabinets, wardrobes or full-home carpentry, and I'll continue from there."
    : "Sure, I can help narrow down the carpentry scope and quotation first. Are you looking at kitchen cabinets, wardrobes, TV/living-room carpentry, shoe cabinets, or full-home carpentry?";
}

function normalizeReply(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").replace(/[?？!！.,，。'"`]/g, "").trim();
}

function avoidExactRepeat(reply, messages, language, knownService, contextText) {
  const previous = previousAssistantText(messages);
  if (!previous || normalizeReply(previous) !== normalizeReply(reply)) return reply;
  if (knownService) {
    return contextualServiceReply(knownService, language, messages, contextText, { correction: true });
  }
  return genericReply(language, true);
}

function buildFallbackReply(messages) {
  const text = latestUserText(messages);
  const contextText = conversationText(messages);
  const language = conversationLanguage(messages);

  if (!text) return genericReply(language);
  if (COMPLAINT_PATTERN.test(text)) return handoffReply(language, "complaint");
  if (TECHNICAL_PATTERN.test(text)) return handoffReply(language, "technical");

  const allowBareScope = previousQuestionKind(messages) === "service";
  const directService = detectService(text, { allowBareScope });
  const serviceFinishQuestion = Boolean(directService && SERVICE_FINISH_PATTERN.test(text));

  if (OUT_OF_SCOPE_PATTERN.test(text) && !serviceFinishQuestion) return handoffReply(language, "scope");
  if (SITE_VISIT_PATTERN.test(text)) return handoffReply(language, "quote");
  if (QUOTE_INTENT_PATTERN.test(text)) return handoffReply(language, "quote");
  if (HUMAN_REQUEST_PATTERN.test(text)) return handoffReply(language, "human");

  const contextualBudget = detectContextualBudget(messages);
  if (contextualBudget) return budgetReply(contextualBudget, language, messages, contextText);

  const knownService = directService || detectKnownService(messages);

  let reply;
  if (knownService && PRICE_PATTERN.test(text)) {
    reply = servicePriceReply(knownService, language, messages, contextText);
  } else if (directService) {
    reply = genericServiceReply(directService, language, messages, contextText);
  } else if (knownService && FRUSTRATION_PATTERN.test(text)) {
    reply = contextualServiceReply(knownService, language, messages, contextText, { correction: true });
  } else if (knownService) {
    reply = contextualServiceReply(knownService, language, messages, contextText);
  } else if (PRICE_PATTERN.test(text)) {
    if (language === "zh") reply = "可以先给你价格方向，不过木工最后报价需要看项目、尺寸和材料。你主要想做哪一个木工区域？";
    else if (language === "ms") reply = "Boleh bagi price direction dulu, tapi quotation akhir carpentry kena tengok scope, ukuran dan material. Anda nak buat scope carpentry mana dulu?";
    else reply = "I can give you a price direction first, but the final carpentry quote depends on scope, measurements and materials. Which carpentry area are you planning first?";
  } else {
    reply = genericReply(language, FRUSTRATION_PATTERN.test(text) || previousQuestionKind(messages) === "service");
  }

  return avoidExactRepeat(reply, messages, language, knownService, contextText);
}

module.exports = { buildFallbackReply };

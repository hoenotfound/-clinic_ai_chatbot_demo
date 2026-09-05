const renovation = require("./renovationConfig");

const HUMAN_PATTERN = /human|person|staff|designer|sales(?:person)?|contractor|project manager|speak to someone|talk to someone|真人|人工|设计师|設計師|顾问|顧問|orang|staff|designer/i;
const SITE_VISIT_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|come\s+measure|measure\s+(?:my|the)\s+(?:house|home|unit|place)|arrange\s+(?:a\s+)?measurement|quotation\s+appointment|home\s+visit|上门量尺|上門量尺|量尺|现场测量|現場測量|datang\s+ukur|site\s+measurement|ukur\s+rumah/i;
const TECHNICAL_PATTERN = /load[- ]?bearing|structural|hack(?:ing)?\s+(?:wall|beam|column)|electrical|rewir(?:e|ing)|plumb(?:ing)?|waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority|approval|承重墙|承重牆|敲墙|敲牆|电线|電線|水管|防水|permit|kelulusan|struktur|pendawaian|paip/i;
const COMPLAINT_PATTERN = /complaint|refund|defect|damage|poor workmanship|wrong colour|wrong color|not happy|very disappointed|投诉|投訴|退款|瑕疵|做坏|做壞|rosak|aduan|refund/i;
const PRICE_PATTERN = /price|how much|cost|quotation|quote|budget|harga|berapa|kos|sebut harga|多少钱|多少錢|价格|價格|价钱|價錢|报价|報價|预算|預算/i;

function latestUserText(messages) {
  const latest = [...(messages || [])].reverse().find((message) => message.role === "user");
  return String(latest?.content || "").trim();
}

function languageOf(text) {
  if (/[一-鿿]/.test(text)) return "zh";
  if (/\b(?:saya|nak|mahu|boleh|berapa|harga|rumah|kabinet|dapur|ukur|bajet|bajet|baru dapat kunci)\b/i.test(text)) return "ms";
  return "en";
}

function detectService(text) {
  const lower = String(text || "").toLowerCase();
  return renovation.services.find((service) =>
    [service.name, ...(service.aliases || [])].some((term) => lower.includes(String(term).toLowerCase()))
  ) || null;
}

function handoffReply(language, reason = "quote") {
  if (language === "zh") {
    if (reason === "technical") return "这个需要团队看实际现场后才能给准确意见，我不应该在聊天里猜。让我转给团队继续帮你。 [[HANDOFF]]";
    if (reason === "complaint") return "明白，这种情况需要由团队直接跟进会比较合适。我帮你转给他们处理。 [[HANDOFF]]";
    return "可以，我帮你把这个询问转给装修团队，让他们继续跟进实际报价或量尺安排。 [[HANDOFF]]";
  }
  if (language === "ms") {
    if (reason === "technical") return "Yang ini team perlu tengok keadaan site sebenar dulu, jadi saya tak patut agak dari chat. Saya pass kepada team untuk sambung dengan anda. [[HANDOFF]]";
    if (reason === "complaint") return "Faham. Untuk isu macam ini lebih baik team sendiri follow up terus. Saya pass conversation ini kepada mereka. [[HANDOFF]]";
    return "Boleh. Saya pass kepada team renovation untuk sambung quotation atau arrangement site measurement sebenar dengan anda. [[HANDOFF]]";
  }
  if (reason === "technical") return "That needs the team to check the actual site, so I shouldn't guess from chat. I'll pass this to them for proper advice. [[HANDOFF]]";
  if (reason === "complaint") return "Understood. This is better handled directly by the team, so I'll pass the conversation to them. [[HANDOFF]]";
  return "Sure. I'll pass this to the renovation team so they can continue with the actual quotation or site-measurement arrangement. [[HANDOFF]]";
}

function servicePriceReply(service, language) {
  if (language === "zh") {
    return `${service.name} 的示范价格是 ${service.priceRange}。最后报价会看实际尺寸、材料、五金和设计细节。你的房子是 condo 还是 landed？`;
  }
  if (language === "ms") {
    return `${service.name} dalam demo ini ${service.priceRange}. Harga akhir bergantung pada ukuran, material, hardware dan design. Ini untuk condo atau landed house?`;
  }
  return `${service.name} ${service.priceRange}. The final quote depends on actual measurements, materials, hardware and design details. Is this for a condo or landed house?`;
}

function genericServiceReply(service, language) {
  if (language === "zh") return `可以，${service.name} 是这个示范装修公司的项目之一。你现在是新屋、subsale，还是已经住着的单位？`;
  if (language === "ms") return `Boleh, ${service.name} memang termasuk dalam servis demo ini. Rumah anda unit baru, subsale atau dah duduk?`;
  return `Yes, ${service.name} is one of the configured services here. Is the property a new unit, subsale, or an existing home?`;
}

function genericReply(language) {
  if (language === "zh") return "可以，我可以先帮你了解木工装修需求和大概报价方向。你主要想做厨房柜、衣柜、电视柜、鞋柜，还是全屋木工？";
  if (language === "ms") return "Boleh, saya boleh bantu faham scope carpentry dan quotation dulu. Anda nak buat kitchen cabinet, wardrobe, TV cabinet, shoe cabinet atau full-house carpentry?";
  return "Sure, I can help narrow down the carpentry scope and quotation first. Are you looking at kitchen cabinets, wardrobes, TV/living-room carpentry, shoe cabinets, or full-home carpentry?";
}

function buildFallbackReply(messages) {
  const text = latestUserText(messages);
  const language = languageOf(text);

  if (!text) return genericReply(language);
  if (COMPLAINT_PATTERN.test(text)) return handoffReply(language, "complaint");
  if (TECHNICAL_PATTERN.test(text)) return handoffReply(language, "technical");
  if (HUMAN_PATTERN.test(text) || SITE_VISIT_PATTERN.test(text)) return handoffReply(language, "quote");

  const service = detectService(text);
  if (service && PRICE_PATTERN.test(text)) return servicePriceReply(service, language);
  if (service) return genericServiceReply(service, language);

  if (PRICE_PATTERN.test(text)) {
    if (language === "zh") return "可以先给你价格方向，不过木工最后报价需要看项目、尺寸和材料。你主要想做哪一个区域？";
    if (language === "ms") return "Boleh bagi price direction dulu, tapi quotation akhir carpentry kena tengok scope, ukuran dan material. Anda nak buat area mana dulu?";
    return "I can give you a price direction first, but the final carpentry quote depends on scope, measurements and materials. Which area are you planning first?";
  }

  return genericReply(language);
}

module.exports = { buildFallbackReply };

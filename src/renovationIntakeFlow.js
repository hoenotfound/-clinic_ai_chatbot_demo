const renovation = require("./renovationConfig");
const {
  detectCorrectedService,
  isUnconfiguredServiceRequest,
} = require("./renovationServiceDetection");
const { resolveServices } = require("./renovationLeadState");
const { establishedConversationLanguage } = require("./conversationLanguage");
const { correctionTargetText, isGenuineRejection } = require("./renovationConversationIntent");

const OPENING_MESSAGE = "â˜€ï¸Pls let us know :\n\nSite photo: \n\nRough size: \n\nLocation: \n\nThanks ðŸ‘";
const SIZE_VALUE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|å¹³é¢å›¾|å¹³é¢åœ–|\d+(?:\.\d+)?\s*å°º|pelan/i;
const KNOWN_LOCATION_PATTERN = /puchong|cheras|kajang|petaling\s+jaya|\bpj\b|subang|shah\s+alam|kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+bintang|bukit\s+jalil|setapak|old\s+klang\s+road|ara\s+damansara|ampang|kepong|selayang|seri\s+kembangan|cyberjaya|putrajaya|è’²ç§|è’²ç¨®|è•‰èµ–|è•‰è³´|åŠ å½±|å…«æ‰“çµå†ä¹Ÿ|å…«æ‰“éˆå†ä¹Ÿ|æ¢³é‚¦|èŽŽé˜¿å—|å‰éš†å¡/i;
const LOCATION_VALUE_PATTERN = /(?:location|lokasi|area|åœ°ç‚¹|åœ°é»ž|åœ°åŒº|åœ°å€|ä½ç½®)\s*[:ï¼š-]?\s*([^\n,;.!?ï¼Ÿã€‚]{2,60})/gi;
const PROJECT_LOCATION_PATTERN = /(?:project|site|unit|rumah|é¡¹ç›®|é …ç›¦)\s*(?:is|åœ¨|kat|dekat)?\s*(?:in|at|åœ¨|kat|dekat)\s+([a-z\u4e00-\u9fff][a-z\u4e00-\u9fff .'-]{1,45})/i;
const VAGUE_VALUE_PATTERN = /^(?:not\s*sure|unsure|unknown|don['â€™]?t\s*know|dunno|no\s*idea|n\/a|na|later|tak\s*tahu|tidak\s+tahu|belum\s+tahu|ä¸çŸ¥é“|ä¸ç¡®å®š|ä¸ç¢ºå®š|è¿˜ä¸çŸ¥é“|é‚„ä¸çŸ¥é“)$/i;
const PHOTO_NEGATIVE_PATTERN = /(?:no|don['â€™]?t\s+have|do\s+not\s+have|without)\s+(?:a\s+)?(?:site\s*)?(?:photo|picture|image|pic)|(?:site\s*)?(?:photo|picture|image|pic)\s*(?:not\s+available|later)|tak\s+ada\s+(?:gambar|foto)|tiada\s+(?:gambar|foto)|æ²¡æœ‰(?:çŽ°åœº)?ç…§ç‰‡|æ²’æœ‰(?:ç¾å ´)?ç…§ç‰‡|æ²¡ç…§ç‰‡|æ²’ç…§ç‰‡/i;
const PHOTO_PATTERN = /site\s*photo|photo|picture|image|pic\b|attached|sent\s+(?:it|photo)|ç…§ç‰‡|ç›¸ç‰‡|å›¾ç‰‡|åœ–ç‰‡|gambar|foto/i;
const ADVICE_MARKER_PATTERN = /preliminary\s+advice|åˆæ­¥å»ºè®®|åˆæ­¥å»ºè­°|cadangan\s+awal/i;
const GENERIC_GREETING_PATTERN = /^(?:hi|hello|hey|halo|hai|ä½ å¥½|å—¨|æ—©å®‰|good\s+(?:morning|afternoon|evening))[!ï¼,.ï¼Œã€‚\s]*(?:(?:i|we)\s+(?:want|would\s+like)\s+to\s+(?:ask|enquire|inquire)\s+(?:about\s+)?(?:cabinet(?:s)?|renovation)[.!ï¼ã€‚]?)?$/i;
const ANSWER_FIRST_PATTERN = /[?ï¼Ÿ]|\b(?:how\s+much|price|cost|harga|berapa|do\s+you|can\s+you|could\s+you|what\s+material|which\s+material|warranty)\b|å¤šå°‘é’±|å¤šå°‘éŒ¢|ä»·æ ¼|åƒ¹æ ¼|ä»·é’±|åƒ¹éŒ¢|æœ‰åšå—|æœ‰åšå—Ž|å¯ä»¥å—|å¯ä»¥å—Ž/i;
const MATERIAL_QUESTION_PATTERN = /plywood|melamine|\bmfc\b|aluminium|aluminum|material|laminate|finish|æè´¨|æè³ª|ææ–™|æ¿æ|é“|é‹/i;
const COMPLAINT_PATTERN = /complaint|refund|defect|damage|poor workmanship|wrong colour|wrong color|not happy|very disappointed|æŠ•è¯‰|æŠ•è¨´|é€€æ¬¾|ç‘•ç–µ|åšå|åšå£ž|rosak|aduan/i;
const TECHNICAL_PATTERN = /load[- ]?bearing|structural|hack(?:ing)?\s+(?:(?:this|the|a|my|our)\s+)?(?:wall|beam|column)|electrical|rewir(?:e|ing)|plumb(?:ing)?|waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority|approval|æ‰¿é‡å¢™|æ‰¿é‡ç‰†|æ•²(?:è¿™ä¸ª|é€™å€‹|è¿™é¢|é€™é¢)?å¢™|æ•²(?:é€™å€‹|è¿™ä¸ª)?æŸ±|ç”µçº¿|é›»ç·š|é˜²æ°´|kelulusan|struktur|pendawaian/i;
const SITE_OR_QUOTE_HANDOFF_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+(?:and\s+)?measure|exact\s+(?:quote|quotation|price)|proper\s+(?:quote|quotation)|ä¸Šé—¨é‡å°º|ä¸Šé–€é‡å°º|æ­£å¼æŠ¥ä»·|æ­£å¼å ±åƒ¹|é‡å°º|quotation\s+appointment/i;
const HUMAN_REQUEST_PATTERN = /(?:speak|talk|chat|connect)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:can|could|may)\s+i\s+(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:want|need)\s+to\s+(?:speak|talk|chat|connect)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|staff|designer|sales(?:person)?|project\s+manager)|(?:want|need)\s+(?:a\s+)?(?:human|designer|salesperson|project\s+manager)\s+(?:to\s+)?(?:contact|call|reply|help)|human\s+(?:please|pls)|çœŸäºº|äººå·¥|è½¬äººå·¥|è½‰äººå·¥|æ‰¾è®¾è®¡å¸ˆ|æ‰¾è¨­è¨ˆå¸«|è”ç³»é¡¾é—®|è¯ç¹«é¡§å•|nak\s+cakap\s+dengan\s+(?:staff|designer|sales)|mahu\s+cakap\s+dengan\s+(?:staff|designer|sales)/i;
const OUT_OF_SCOPE_PATTERN = /\b(?:tiles?|tiling|floor(?:ing)?|paint(?:ing)?|ceiling|plaster(?:ing)?|wallpaper|masonry|wet\s*works?|bathroom\s+renovation|toilet\s+renovation|kitchen\s+renovation|jubin|lantai|siling|renovasi\s+(?:dapur|bilik\s+air))\b|ç“·ç –|ç“·ç£š|åœ°ç –|åœ°ç£š|åœ°æ¿|æ²¹æ¼†|å¤©èŠ±|å¢™çº¸|ç‰†ç´™|æ³¥æ°´|åŽ¨æˆ¿(?:è£…ä¿®|è£ä¿®|ç¿»æ–°)|å»šæˆ¿(?:è£ä¿®|ç¿»æ–°)|åŽ•æ‰€(?:è£…ä¿®|è£ä¿®)|å»æ‰€è£ä¿®|æµ´å®¤(?:è£…ä¿®|è£ä¿®)/i;
const SERVICE_FINISH_PATTERN = /\b(?:paint(?:ed)?|spray[- ]paint(?:ed)?|lacquer(?:ed)?)\s+(?:finish(?:es)?|colour|color|cabinet|door)|\b(?:finish|colour|color)\s+(?:with\s+)?(?:paint|spray[- ]paint|lacquer)|çƒ¤æ¼†|å–·æ¼†|å™´æ¼†|æ²¹æ¼†(?:é¢|æŸœé—¨|æ«ƒé–€|finish|é¢œè‰²|é¡è‰²)/i;
const BUDGET_PATTERN = /\b(?:budget|bajet)\b.{0,30}(?:rm\s*)?\d+(?:[,.]\d+)?\s*k?\b|\b(?:rm\s*)\d+(?:[,.]\d+)?\s*k?\b|\b\d+(?:\.\d+)?\s*k\s*(?:budget|bajet)\b|(?:é¢„ç®—|é ç®—).{0,16}(?:rm\s*)?\d+(?:[,.]\d+)?\s*k?/i;

const CONSTRAINT_PATTERNS = {
  wall: /clear\s*wall|empty\s*wall|usable\s*wall|wall\s+(?:is\s+)?clear|wall\s*(?:space|length|height|width)|enough\s+wall|dinding|å¢™é¢|ç‰†é¢|å¢™é•¿|ç‰†é•·|å¢™é«˜|ç‰†é«˜/i,
  window: /window|tingkap|çª—/i,
  door: /door|sliding\s*door|pintu|é—¨|é–€/i,
  power: /switch(?:es)?|socket(?:s)?|plug(?:s)?|power\s*point|data\s*point|suis|soket|æ’åº§|å¼€å…³|é–‹é—œ|ç”µæº|é›»æº/i,
  plumbing: /sink|water\s*point|pipe|plumb(?:ing)?|paip|æ°´ç®¡|æ°´ä½|æ°´æ§½/i,
  cooking: /hob|hood|stove|cooker|æŠ½æ²¹çƒŸæœº|æŠ½æ²¹ç…™æ©Ÿ|ç‚‰|çˆ/i,
  structure: /beam|column|æ¢|æŸ±/i,
  aircon: /air\s*con|aircon|air-conditioner|ç©ºè°ƒ|å†·æ°”|å†·æ°£/i,
  fridge: /fridge|refrigerator|å†°ç®±/i,
  db: /db\s*box|distribution\s*board|ç”µç®±|é›»ç®±/i,
  tv: /\btv\b|television|ç”µè§†|é›»è¦–/i,
};
const ALL_CLEAR_PATTERN = /no\s+(?:other\s+)?obstruction|nothing\s+(?:else|there)|all\s+clear|tiada\s+halangan|tak\s+ada\s+halangan|æ²¡æœ‰(?:å…¶ä»–)?é˜»ç¢|æ²’æœ‰(?:å…¶ä»–)?é˜»ç¤™|æ²¡æœ‰å…¶ä»–ä¸œè¥¿|æ²’æœ‰å…žä»–æ±è¥¿/i;

function userTexts(messages) {
  return (messages || []).filter((message) => message?.role === "user").map((message) => String(message.content || "").trim()).filter(Boolean);
}

function assistantTexts(messages) {
  return (messages || []).filter((message) => message?.role === "assistant").map((message) => String(message.content || "").trim()).filter(Boolean);
}

function hasOpeningMessage(messages) {
  return assistantTexts(messages).some((text) => /Site photo\s*:/i.test(text) && /Rough size\s*:/i.test(text) && /Location\s*:/i.test(text));
}

function locationKnown(text) {
  const value = String(text || "");
  if (KNOWN_LOCATION_PATTERN.test(value)) return true;
  for (const match of value.matchAll(LOCATION_VALUE_PATTERN)) {
    const candidate = String(match[1] || "").trim();
    if (candidate && !VAGUE_VALUE_PATTERN.test(candidate)) return true;
  }
  const projectMatch = value.match(PROJECT_LOCATION_PATTERN);
  if (!projectMatch) return false;
  const candidate = String(projectMatch[1] || "").trim().replace(/[.!ï¼ã€‚?ï¼Ÿ]+$/, "");
  return Boolean(candidate && !VAGUE_VALUE_PATTERN.test(candidate));
}

function photoStatus(text) {
  const value = String(text || "");
  if (PHOTO_NEGATIVE_PATTERN.test(value)) return "unavailable";
  if (PHOTO_PATTERN.test(value)) return "available";
  return "unknown";
}

function budgetKnown(text) {
  return BUDGET_PATTERN.test(String(text || ""));
}

function serviceQuestion(language) {
  if (language === "zh") return "è°¢è°¢ ðŸ‘ æ‚¨ä¸»è¦æƒ³åšå“ªä¸€ç§/ï¼šåŽ¨æˆ¿åŠæ›š + åœ°æ›šã€è¡£æš¨ã€ç”µè§†æš¨ã€éž‹æš¨ï¼Œè¿˜æ˜¯å…¶ä»–æš¨å­ï¼Ÿ";
  if (language === "ms") return "Terima kasih ðŸ‘ Anda nak buat apa: kitchen cabinet atas + bawah, wardrobe, TV cabinet, shoe cabinet, atau cabinet lain?";
  return "Thanks ðŸ‘ What are you looking to do upper + lower kitchen cabinets, wardrobe cabinet, TV cabinet, shoe cabinet, or something else?";
}

function missingIntakeQuestion(language, state) {
  const missing = [];
  if (!state.sizeKnown) missing.push("size");
  if (!state.hasLocation) missing.push("location");
  if (!missing.length) return null;

  const photoAvailable = state.photoStatus === "available";
  const photoUnavailable = state.photoStatus === "unavailable";
  if (language === "zh") {
    if (missing.length === 2) return `å…ˆè¡¥å……ä¸€å¤§æ¦‚å°ºå¯¸å’Œ Location å°±å¯ä»¥ã€‚${photoAvailable ? "Site photo æˆ‘ä¹Ÿè®°ä¸‹äº†ã€‚" : photoUnavailable ? "æ²¡æœ‰ site photo ä¹Ÿæ¶¡æ¯ã€‚" : "æœ‰àsite photo çš„è¯ä¹Ÿå¯ä»¥ä¸€èµ·å‘ã€"}`;
    if (missing[0] === "size") return `è¿˜å·®ä¸€ä¸ª Rough sizeï¼Œå¤§æ¦‚å‡  ft / å¤§æ¦‚å¤šé•¿å°±æ˜¿å¹¶ä»¥ã€‚${photoUnavailable ? "æ²¡æœ‰ site photo ä¹Ÿæ²¡å…³ç³»ã€‚" : ""}`;
    return `è¿˜å·® Locationï¼Œå‘Šè¯‰æˆ‘é¡¹ç›®åœ¨å“ªä¸ªåœ°åŒºå°±å¯ä»¥ã€‚${photoUnavailable ? "æ²¡æœ‰ site photo ä¹Ÿæ¶¡æ¯ã€‚" : ""}`;
  }
  if (language === "ms") {
    if (missing.length === 2) return `Tinggal rough size dan location saja. ${photoAvailable ? "Site photo pun saya dah catat." : photoUnavailable ? "Tak ada site photo pun tak apa." : "Kalau ada site photo, boleh bagi sekali."}`;
    if (missing[0] === "size") return `Tinggal rough size saja, anggaran berapa ft pun okay. ${photoUnavailable ? "Tak ada site photo pun tak apa." : ""}`;
    return `Tinggal location saja, beritahu project area mana. ${photoUnavailable ? "Tak ada site photo pun tak apa." : ""}`;
  }
  if (missing.length === 2) return `I just need the rough size and location first. ${photoAvailable ? "I've noted the site photo too." : photoUnavailable ? "No site photo is okay." : "If you have a site photo, you can send that as well."}`;
  if (missing[0] === "size") return `I just need the rough size next, even an approximate length in ft is fine. ${photoUnavailable ? "No site photo is okay." : ""}`;
  return `I just need the location next. Which area is the project in? ${photoUnavailable ? "No site photo is okay." : ""}`;
}

function serviceLabels(serviceNames, language) {
  const labels = {
    "Kitchen Cabinets": { en: "kitchen cabinets", ms: "kitchen cabinet", zh: "åŽ¨æˆ¿æ³•å®Ÿ" },
    "Built-in Wardrobes": { en: "wardrobe", ms: "wardrobe", zh: "è¡£æš¨" },
    "TV|½¹Í½±”€˜1¥Ù¥¹œI½½´…ÉÁ•¹ÑÉäˆèì•¸è€‰QX…‰¥¹•Ðˆ°µÌè€‰QX…‰¥¹•Ðˆ°é è€‹žR×¢žšj ˆô°(€€€€‰M¡½”…‰¥¹•Ð€˜¹ÑÉ…¹”MÑ½É…”ˆèì•¸è€‰Í¡½”…‰¥¹•Ðˆ°µÌè€‰Í¡½”…‰¥¹•Ðˆ°é è€‹¦zšj”ˆô°(€€€€‰MÑÕ‘ä°¥ÍÁ±…ä€˜MÑ½É…”…‰¥¹•ÑÌˆèì•¸è€‰ÍÑÕ‘ä€¼ÍÑ½É…”…‰¥¹•Ðˆ°µÌè€‰ÍÑÕ‘ä€¼ÍÑ½É…”…‰¥¹•Ðˆ°é è€‹’æ›š"ü€¼ƒšRÛžêÏš~0ˆô°(€€€€‰Õ±°µ!½µ”ÕÍÑ½´…ÉÁ•¹ÑÉäˆèì•¸è€‰µÕ±Ñ¥Á±”…‰¥¹•Ð…É•…Ìˆ°µÌè€‰‰•‰•É…Á„©•¹¥Ì…‰¥¹•Ðˆ°é è€‹–’k’â«šj£–¶C–2ë–~|ˆô°(€ôì(€É•ÑÕÉ¸Í•ÉÙ¥•9…µ•Ì¹µ…À ¡¹…µ”¤€ôø±…‰•±Ím¹…µ•tü¹m±…¹Õ…•tñð±…‰•±Ím}9…µ•tü¹•¸ñð¹…µ”¤¹©½¥¸¡±…¹Õ…”€ôôô€‰é ˆ€ü€‹Žˆ€è€ˆ°€ˆ¤ì)ô()™Õ¹Ñ¥½¸½‰ÍÑÉÕÑ¥½¹EÕ•ÍÑ¥½¸¡±…¹Õ…”°Í•ÉÙ¥•9…µ•Ì€ômt¤ì(€½¹ÍÐ½¹±ä€ôÍ•ÉÙ¥•9…µ•Ì¹±•¹Ñ €ôôô€Ä€üÍ•ÉÙ¥•9…µ•ÍlÁt€è¹Õ±°ì(€¥˜€¡±…¹Õ…”€ôôô€‰é ˆ¤ì(€€€¥˜€¡½¹±ä€ôôô€‰-¥Ñ¡•¸…‰¥¹•ÑÌˆ¤É•ÑÕÉ¸€‹––÷žjŽ+¢þg’â«–:£š"ÿ’ö7žö»š"G–7ž†»¢º“’â’â/¾òk–Šg¦v‹šb¿’â7šb¿¦÷¢÷žR£¾òšr'šÊ‡šr'žª_Ž¦^£ŽÍÝ¥Ñ ƒš"X€Á±ÕŸŽšÂÓšžô¿šÂÓ’ö7Ž¡¡½ˆ½¡½½“Ž–ÏžºÃŽšŠh‰nX[nK¹n™‹®z(ûÉò#°¢–b†öæÇ’ÓÓÒ$'V–ÇBÖ–âv&G&ö&W2"’&WGW&â.Z[Þy¨N8.Š>iªŽ‹ùžKŠ®KØÞ{Úîh‰XhÞzîŠêNKˆKˆ¾ûÉ®Z)ž™Ú.ZëÞ[ªbþš¹Ž[ªnZIþKˆÞZIþûÉþ™˜n‹ùiÈžk*8[ÈX[>h‰bÇV~8j(iû8Xk~k	Nh‰nX[nK¹nKÉ®hÊX‹iªŽ™zŽy¨NKØÞ{ÚîûÉò#°¢–b†öæÇ’ÓÓÒ%Eb6öç6öÆRbÆ—f–ær&ööÒ6'VçG'’"’&WGW&â.Z[Þy¨N8.yK^ŠxniªŽ‹ùžKŠ®KØÞ{Úîh‰XhÞzîŠêNKˆKˆ¾ûÉ®Z)ž™Ú.[®ZûŽZIþKˆÞZIþûÉõEbZJ~jh.ZI®ZJ~ûÈÎ™˜N‹ùiÈžk*iÈ’ÇVröFFö–çN8k*8[ÈX[>8Xk~k	Nh‰nX[nK¹n™‹®z(ûÉò#°¢–b†öæÇ’ÓÓÒ%6†öR6&–æWBbVçG&æ6R7F÷&vR"’&WGW&â.Z[Þy¨N8 ¥è.™øî{û
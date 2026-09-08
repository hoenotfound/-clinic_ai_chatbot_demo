const renovation = require("./renovationConfig");
const {
  detectServices,
  detectCorrectedService,
  isUnconfiguredServiceRequest,
} = require("./renovationServiceDetection");
const { resolveServices } = require("./renovationLeadState");
const { establishedConversationLanguage } = require("./conversationLanguage");
const { correctionTargetText, isGenuineRejection } = require("./renovationConversationIntent");

const OPENING_MESSAGE = "☀️Pls let us know :\n\nSite photo: \n\nRough size: \n\nLocation: \n\nThanks 👍";
const SIZE_VALUE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|floor\s*plan|layout\s*plan|平面图|平面圖|\d+(?:\.\d+)?\s*尺|pelan/i;
const KNOWN_LOCATION_PATTERN = /puchong|cheras|kajang|petaling\s+jaya|\bpj\b|subang|shah\s+alam|kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+bintang|bukit\s+jalil|setapak|old\s+klang\s+road|ara\s+damansara|ampang|kepong|selayang|seri\s+kembangan|cyberjaya|putrajaya|蒲种|蒲種|蕉赖|蕉賴|加影|八打灵再也|八打靈再也|梳邦|莎阿南|吉隆坡/i;
const LOCATION_VALUE_PATTERN = /(?:location|lokasi|area|地点|地點|地区|地區|位置)\s*[:：-]?\s*([^\n,;]{2,60})/gi;
const PROJECT_LOCATION_PATTERN = /(?:project|site|unit|rumah|项目|項目|地点|地點)\s*(?:is|在|kat|dekat)?\s*(?:in|at|在|kat|dekat)\s+([a-z\u4e00-\u9fff][a-z\u4e00-\u9fff .'-]{1,45})/i;
const VAGUE_VALUE_PATTERN = /^(?:not\s*sure|unsure|unknown|don['’]?t\s*know|dunno|no\s*idea|n\/a|na|later|tak\s*tahu|tidak\s*tahu|belum\s*tahu|不知道|不确定|不確定|还不知道|還不知道)$/i;
const PHOTO_NEGATIVE_PATTERN = /(?:no|don['’]?t\s+have|do\s+not\s+have|without)\s+(?:a\s+)?(?:site\s*)?(?:photo|picture|image|pic)|(?:site\s*)?(?:photo|picture|image|pic)\s*(?:not\s+available|later)|tak\s+ada\s+(?:gambar|foto)|tiada\s+(?:gambar|foto)|没有(?:现场)?照片|沒有(?:現場)?照片|没照片|沒照片/i;
const PHOTO_PATTERN = /site\s*photo|photo|picture|image|pic\b|attached|sent\s+(?:it|photo)|照片|相片|图片|圖片|gambar|foto/i;
const ADVICE_MARKER_PATTERN = /preliminary\s+advice|初步建议|初步建議|cadangan\s+awal/i;
const GENERIC_GREETING_PATTERN = /^(?:hi|hello|hey|halo|hai|你好|嗨|早安|good\s+(?:morning|afternoon|evening))[!！,.，。\s]*(?:(?:i|we)\s+(?:want|would\s+like)\s+to\s+(?:ask|enquire|inquire)\s+(?:about\s+)?(?:cabinet(?:s)?|renovation)[.!！。]?)?$/i;
const ANSWER_FIRST_PATTERN = /[?？]|\b(?:how\s+much|price|cost|harga|berapa|do\s+you|can\s+you|could\s+you|what\s+material|which\s+material|warranty)\b|多少钱|多少錢|价格|價格|价钱|價錢|有做吗|有做嗎|可以吗|可以嗎/i;
const MATERIAL_QUESTION_PATTERN = /plywood|melamine|\bmfc\b|aluminium|aluminum|material|laminate|finish|材质|材質|材料|板材|铝|鋁/i;
const COMPLAINT_PATTERN = /complaint|refund|defect|damage|poor workmanship|wrong colour|wrong color|not happy|very disappointed|投诉|投訴|退款|瑕疵|做坏|做壞|rosak|aduan/i;
const TECHNICAL_PATTERN = /load[- ]?bearing|structural|hack(?:ing)?\s+(?:wall|beam|column)|electrical|rewir(?:e|ing)|plumb(?:ing)?|waterproof(?:ing)?|gas\s+(?:pipe|line)|permit|authority|approval|承重墙|承重牆|敲墙|敲牆|电线|電線|防水|kelulusan|struktur|pendawaian/i;
const DIRECT_HANDOFF_PATTERN = /site\s*(?:visit|measurement|measure)|come\s+measure|exact\s+(?:quote|quotation|price)|proper\s+(?:quote|quotation)|human|designer|salesperson|project\s+manager|上门量尺|上門量尺|正式报价|正式報價|真人|人工|量尺|quotation\s+appointment/i;
const OUT_OF_SCOPE_PATTERN = /\b(?:tiles?|tiling|floor(?:ing)?|paint(?:ing)?|ceiling|plaster(?:ing)?|wallpaper|masonry|wet\s*works?|bathroom\s+renovation|toilet\s+renovation|kitchen\s+renovation|jubin|lantai|siling|renovasi\s+(?:dapur|bilik\s+air))\b|瓷砖|瓷磚|地砖|地磚|地板|油漆|天花|墙纸|牆紙|泥水|厨房(?:装修|裝修|翻新)|廚房(?:裝修|翻新)|厕所(?:装修|裝修)|廁所裝修|浴室(?:装修|裝修)/i;
const SERVICE_FINISH_PATTERN = /\b(?:paint(?:ed)?|spray[- ]paint(?:ed)?|lacquer(?:ed)?)\s+(?:finish(?:es)?|colour|color|cabinet|door)|\b(?:finish|colour|color)\s+(?:with\s+)?(?:paint|spray[- ]paint|lacquer)|烤漆|喷漆|噴漆|油漆(?:面|柜门|櫃門|finish|颜色|顏色)/i;

const CONSTRAINT_PATTERNS = {
  wall: /clear\s*wall|empty\s*wall|usable\s*wall|wall\s*(?:space|length|height|width)|enough\s+wall|dinding|墙面|牆面|墙长|牆長|墙高|牆高/i,
  openings: /window|door|sliding\s*door|tingkap|pintu|窗|门|門/i,
  power: /switch(?:es)?|socket(?:s)?|plug(?:s)?|power\s*point|data\s*point|suis|soket|插座|开关|開關|电源|電源/i,
  plumbing: /sink|water\s*point|pipe|plumb(?:ing)?|paip|水管|水位|水槽/i,
  cooking: /hob|hood|stove|cooker|抽油烟机|抽油煙機|炉|爐/i,
  structure: /beam|column|梁|柱/i,
  aircon: /air\s*con|aircon|air-conditioner|空调|冷气|冷氣/i,
  fridge: /fridge|refrigerator|冰箱/p,
  db: /db\s*box|distribution\s*board|电箱|電箱/i,
  tv: /\btv\b|television|电视|電視/i,
};
const ALL_CLEAR_PATTERN = /no\s+(?:other\s+)?obstruction|nothing\s+there|empty\s+wall|all\s+clear|wall\s+is\s+clear|tiada\s+halangan|tak\s+ada\s+halangan|dinding\s+kosong|没有(?:其他)?阻碍|沒有(?:其他)?阻礙|墙面(?:是)?空的|牆面(?:是)?空的/i;

function userTexts(messages) {
  return (messages || [])
    .filter((message) => message?.role === "user")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean);
}

function assistantTexts(messages) {
  return (messages || [])
    .filter((message) => message?.role === "assistant")
    .map((message) => String(message.content || "").trim())
    .filter(Boolean);
}

function hasOpeningMessage(messages) {
  return assistantTexts(messages).some((text) => /Site photo\s*:/i.test(text) && /Rough size\s*:/i.test(text) && /Location\s*:/i.test(text));
}

function locationKnown(text) {
  const value = String(text || "");
  if (KNOWN_LOCATION_PATTERN.test(value)) return true;

  for (const match of value.matchAll(LOCATION_VALUE_PATTERN)) {
    const candidate = String(match[1] || "").trim().replace(/[.!！。?？]+$/, "");
    if (candidate && !VAGUE_VALUE_PATTERN.test(candidate)) return true;
  }

  const projectMatch = value.match(PROJECT_LOCATION_PATTERN);
  if (!projectMatch) return false;
  const candidate = String(projectMatch[1] || "").trim().replace(/[.!！。?？]+$/, "");
  return Boolean(candidate && !VAGUE_VALUE_PATTERN.test(candidate));
}

function photoStatus(text) {
  const value = String(text || "");
  if (PHOTO_NEGATIVE_PATTERN.test(value)) return "unavailable";
  if (PHOTO_PATTERN.test(value)) return "available";
  return "unknown";
}

function serviceQuestion(language) {
  if (language === "zh") return "谢谢 👍 您主要想做哪一种：厨房吊柜 + 地柜、衣柜、电视柜、鞋柜，还是其他柜子？";
  if (language === "ms") return "Terima kasih 👍 Anda nak buat apa: kitchen cabinet atas + bawah, wardrobe, TV cabinet, shoe cabinet, atau cabinet lain?";
  return "Thanks 👍 What are you looking to do: upper + lower kitchen cabinets, wardrobe cabinet, TV cabinet, shoe cabinet, or something else?";
}

function missingIntakeQuestion(language, { sizeKnown, locationKnown: hasLocation, photoStatus: currentPhotoStatus }) {
  const missing = [];
  if (!sizeKnown) missing.push("size");
  if (!hasLocation) missing.push("location");

  if (!missing.length) return null;
  const photoAvailable = currentPhotoStatus === "available";
  const photoUnavailable = currentPhotoStatus === "unavailable";

  if (language === "zh") {
    if (missing.length === 2) return `先补充一下大概尺寸和 Location 就可以。${photoAvailable ? "Site photo 我也记下了。" : photoUnavailable ? "没有 site photo 也没关系。" : "有 site photo 的话也可以一起发。"}`;
    if (missing[0] === "size") return `还差一个 Rough size，大概几 ft / 大概多长就可以。${photoAvailable ? "" : photoUnavailable ? "没有 site photo 也没关系。" : "有 site photo 的话也可以一起发。"}`;
    return `还差 Location，告诉我项目在哪个地区就可以。${photoAvailable ? "" : photoUnavailable ? "没有 site photo 也没关系。" : "有 site photo 的话也可以一起发。"}`;
  }
  if (language === "ms") {
    if (missing.length === 2) return `Tinggal rough size dan location saja. ${photoAvailable ? "Site photo pun saya dah catat." : photoUnavailable ? "Tak ada site photo pun tak apa." : "Kalau ada site photo, boleh bagi sekali."}`;
    if (missing[0] === "size") return `Tinggal rough size saja, anggaran berapa ft pun okay. ${photoAvailable ? "" : photoUnavailable ? "Tak ada site photo pun tak apa." : "Kalau ada site photo, boleh bagi sekali."}`;
    return `Tinggal location saja, beritahu project area mana. ${photoAvailable ? "" : photoUnavailable ? "Tak ada site photo pun tak apa." : "Kalau ada site photo, boleh bagi sekali."}`;
  }
  if (missing.length === 2) return `I just need the rough size and location first. ${photoAvailable ? "I've noted the site photo too." : photoUnavailable ? "No site photo is okay." : "If you have a site photo, you can send that as well."}`;
  if (missing[0] === "size") return `I just need the rough size next, even an approximate length in ft is fine. ${photoAvailable ? "" : photoUnavailable ? "No site photo is okay." : "If you have a site photo, you can send that too."}`;
  return `I just need the location next. Which area is the project in? ${photoAvailable ? "" : photoUnavailable ? "No site photo is okay." : "If you have a site photo, you can send that too."}`;
}

function serviceLabels(serviceNames, language) {
  const labels = {
    "Kitchen Cabinets": { en: "kitchen cabinets", ms: "kitchen cabinet", zh: "厨房柜" },
    "Built-in Wardrobes": { en: "wardrobe", ms: "wardrobe", zh: "衣柜" },
    "TV Console & Living Room Carpentry": { en: "TV cabinet", ms: "TV cabinet", zh: "电视柜" },
    "Shoe Cabinet & Entrance Storage": { en: "shoe cabinet", ms: "shoe cabinet", zh: "鞋柜" },
    "Study, Display & Storage Cabinets": { en: "study / storage cabinet", ms: "study / storage cabinet", zh: "书房 / 收纳柜" },
    "Full-Home Custom Carpentry": { en: "multiple cabinet areas", ms: "beberapa jenis cabinet", zh: "多个柜子区域" },
  };
  return serviceNames.map((name) => labels[name]?.[language] || labels[name]?.en || name).join(language === "zh" ? "、" : ", ");
}

function obstructionQuestion(language, serviceNames = []) {
  const kitchenOnly = serviceNames.length === 1 && serviceNames[0] === "Kitchen Cabinets";
  const wardrobeOnly = serviceNames.length === 1 && serviceNames[0] === "Built-in Wardrobes";
  const tvOnly = serviceNames.length === 1 && serviceNames[0] === "TV Console & Living Room Carpentry";
  const shoeOnly = serviceNames.length === 1 && serviceNames[0] === "Shoe Cabinet & Entrance Storage";

  if (language === "zh") {
    if (kitchenOnly) return "好的。这个厨房位置我再确认一下：12ft 墙面是不是都能用？有没有窗/门、switch 或 plug、水槽/水位、hob/hood、冰箱、梁柱或其他阻碍？";
    if (wardrobeOnly) return "好的。衣柜这个位置我再确认一下：墙面宽度/高度够不够？附近有没有窗/门、switch 或 plug、梁柱、冷气或其他会挡到柜门的位置？";
    if (tvOnly) return "好的。电视柜这个位置我再确认一下：墙面尺寸够不够？TV 大概多大，附近有没有 plug/data point、窗/门、冷气或其他阻碍？";
    if (shoeOnly) return "好的。鞋柜这个位置我再确认一下：入口墙面和深度够不够？大门怎么开，附近有没有 switch/plug、DB box 或其他阻碍？";
    return "好的。接下来我会先看这个位置的实际限制：墙面够不够、有没有窗/门、switch 或 plug、水位/水管、梁柱或其他阻碍。您可以告诉我这些情况；有清楚的 site photo 也可以一起参考。";
  }
  if (language === "ms") {
    if (kitchenOnly) return "Baik. Untuk kitchen ini saya nak confirm site condition dulu: adakah semua wall length boleh guna, ada tingkap/pintu, switch atau plug, sink/water point, hob/hood, fridge, beam/column atau halangan lain?";
    if (wardrobeOnly) return "Baik. Untuk wardrobe ini saya nak confirm wall width/height, tingkap/pintu, switch atau plug, beam/column, aircon atau apa-apa yang boleh ganggu pintu cabinet.";
    if (tvOnly) return "Baik. Untuk TV cabinet ini saya nak confirm wall size, saiz TV, plug/data point, tingkap/pintu, aircon dan halangan lain.";
    if (shoeOnly) return "Baik. Untuk shoe cabinet ini saya nak confirm ruang dinding/depth di entrance, arah pintu buka, switch/plug, DB box dan halangan lain.";
    return "Baik. Seterusnya saya nak semak keadaan tempat itu dulu: ruang dinding cukup atau tidak, ada tingkap/pintu, suis atau plug, water point/paip, beam/column atau halangan lain. Boleh beritahu saya keadaan situ; kalau ada site photo yang jelas, boleh bagi sekali.";
  }
  if (kitchenOnly) return "Got it. For this kitchen, is the full wall length usable? Any windows/doors, switches or plug points, sink/water points, hob/hood, fridge, beams/columns, or other obstructions?";
  if (wardrobeOnly) return "Got it. For the wardrobe wall, is the width/height usable? Any windows/doors, switches or plug points, beams/columns, aircon, or anything that could affect the cabinet doors?";
  if (tvOnly) return "Got it. For the TV cabinet wall, what wall space and TV size are we working with? Any plug/data points, windows/doors, aircon, or other obstructions?";
  if (shoeOnly) return "Got it. For the shoe cabinet, is the entrance wall/depth usable? How does the main door open, and are there any switches/plugs, a DB box, or other obstructions?";
  return "Got it. Next I want to check the actual site conditions: whether there is enough clear wall, any windows/doors, switches or plug points, sink/water points, beams/columns, or other obstructions. Tell me what is there; a clear site photo also helps with the preliminary layout direction.";
}

function constraintFacts(text) {
  const value = String(text || "");
  const groups = new Set();
  for (const [name, pattern] of Object.entries(CONSTRAINT_PATTERNS)) {
    if (pattern.test(value)) groups.add(name);
  }

  const plugCount = value.match(/\b(\d+)\s*(?:plug(?:\s*points?)?|socket(?:s)?|power\s*points?)\b/i)?.[1] ||
    value.match(/(?:plug(?:\s*points?)?|socket(?:s)?|power\s*points?)\D{0,8}(\d+)/i)?.[1] || null;
  const sinkPosition = value.match(/sink\D{0,20}\b(middle|left|right|centre|center)\b/i)?.[1] ||
    value.match(/\b(middle|left|right|centre|center)\b\D{0,20}sink/i)?.[1] || null;
  const fridgePosition = value.match(/fridge\D{0,20}\b(left|right|middle|centre|center)\b/i)?.[1] ||
    value.match(/\b(left|right|middle|centre|center)\b\D{0,20}fridge/i)?.[1] || null;

  return {
    groups,
    allClear: ALL_CLEAR_PATTERN.test(value),
    plugCount,
    sinkPosition,
    fridgePosition,
    noWindow: /no\s+window|without\s+(?:a\s+)?window|没有窗|沒有窗|无窗|無窗|tiada\s+tingkap|tak\s+ada\s+tingkap/i.test(value),
    hasWindow: /window|tingkap|窗/i.test(value) && !/no\s+window|without\s+(?:a\s+)?window|没有窗|沒有窗|无窗|無窗|tiada\s+tingkap|tak\s+ada\s+tingkap/i.test(value),
    hasDoor: /door|pintu|门|門/i.test(value),
    wallClear: /clear\s*wall|wall\s+is\s+clear|empty\s*wall|dinding\s+kosong|墙面(?:是)?空的|牆面(?:是)?空的/i.test(value),
    hasBeamOrColumn: /beam|column|梁|柱/i.test(value),
    hasAircon: /air\s*con|aircon|air-conditioner|空调|冷气|冷氣/i.test(value),
    hasDbBox: /db\s*box|distribution\s*board|电箱|電箱/i.test(value),
    hasHobHood: /hob|hood|stove|cooker|抽油烟机|抽油煙機|炉|爐/i.test(value),
  };
}

function requiredConstraintGroups(serviceNames) {
  const required = new Set();
  for (const service of serviceNames) {
    if (service === "Kitchen Cabinets") ["wall", "openings", "power", "plumbing"].forEach((item) => required.add(item));
    else if (service === "Built-in Wardrobes") ["wall", "openings", "power"].forEach((item) => required.add(item));
    else if (service === "TV Console & Living Room Carpentry") ["wall", "openings", "power"].forEach((item) => required.add(item));
    else if (service === "Shoe Cabinet & Entrance Storage") ["wall", "openings", "power"].forEach((item) => required.add(item));
    else ["wall", "openings", "power"].forEach((item) => required.add(item));
  }
  return [...required];
}

function missingConstraintGroups(serviceNames, facts) {
  if (facts.allClear) return [];
  return requiredConstraintGroups(serviceNames).filter((group) => !facts.groups.has(group));
}

function missingConstraintQuestion(language, missing) {
  const labels = {
    en: { wall: "usable wall space", openings: "windows/doors", power: "switches or plug points", plumbing: "sink/water points" },
    ms: { wall: "ruang dinding yang boleh guna", openings: "tingkap/pintu", power: "switch atau plug", plumbing: "sink/water point" },
    zh: { wall: "墙面够不够", openings: "有没有窗/门", power: "switch 或 plug", plumbing: "水槽/水位" },
  };
  const selected = missing.map((key) => labels[language]?.[key] || labels.en[key]).filter(Boolean);
  if (language === "zh") return `收到。再确认${selected.join("、")}这${selected.length > 1 ? "几项" : "一项"}就可以，然后我可以按你给的现场资料先给布局和材料方向。`;
  if (language === "ms") return `Faham. Tinggal confirm ${selected.join(", ")} saja, lepas itu saya boleh bagi preliminary layout dan material direction berdasarkan detail site anda.`;
  return `Got it. I just need ${selected.join(", ")} as well, then I can give preliminary layout and material direction based on the site details you've provided.`;
}

function materialDirection(serviceNames, language) {
  const kitchen = serviceNames.includes("Kitchen Cabinets");
  if (language === "zh") {
    return kitchen
      ? "材料方面可以先比较 melamine/MFC、plywood，较潮湿的位置也可以再看 aluminium；要结合预算、想要的 finish 和实际使用环境，不会直接说哪一种一定最好。"
      : "材料方面通常可以从 melamine/MFC 或 plywood 的预算、finish 和使用需求去比较，最后还是要看实际设计和现场条件。";
  }
  if (language === "ms") {
    return kitchen
      ? "Untuk material, kita boleh compare melamine/MFC, plywood, dan untuk area yang lebih lembap boleh pertimbangkan aluminium juga. Pilihan kena ikut bajet, finish dan keadaan sebenar, bukan satu material yang mesti terbaik untuk semua."
      : "Untuk material, biasanya kita boleh compare melamine/MFC atau plywood ikut bajet, finish dan kegunaan sebenar sebelum confirm spec.";
  }
  return kitchen
    ? "For materials, a practical starting comparison is melamine/MFC, plywood, and aluminium for wetter areas. The right choice depends on budget, finish and actual use, so there isn't one material that is automatically best for every site."
    : "For materials, a practical starting comparison is usually melamine/MFC versus plywood based on budget, finish and actual use before the final specification is confirmed.";
}

function preliminaryAdvice(serviceNames, language, facts) {
  const labels = serviceLabels(serviceNames, language);
  const points = [];
  const kitchen = serviceNames.includes("Kitchen Cabinets");
  const wardrobe = serviceNames.includes("Built-in Wardrobes");
  const tv = serviceNames.includes("TV Console & Living Room Carpentry");
  const shoe = serviceNames.includes("Shoe Cabinet & Entrance Storage");

  if (language === "zh") {
    if (kitchen && facts.sinkPosition) points.push(`水槽在${facts.sinkPosition === "middle" ? "中间" : facts.sinkPosition}的话，地柜和台面开孔要围绕现有水位来排，不应该先假设可以移位。`);
    if (facts.plugCount) points.push(`${facts.plugCount} 个 plug 要保留在可使用的位置，不能被柜体封住。`);
    else if (facts.groups.has("power")) points.push("switch / plug 的位置要保留可使用和维修空间，柜体不能直接封死。 ");
    if (kitchen && facts.noWindow) points.push("没有窗的话，吊柜可用墙面会比较连续，不过高度还是要实际量尺确认。 ");
    else if (facts.hasWindow) points.push("有窗的位置会影响吊柜或高柜的宽度和高度，需要避开窗位和开合空间。 ");
    if (facts.wallClear) points.push("墙面大致是清的，可以先按连续柜体方向规划，再用实际量尺确认每一段。 ");
    if (kitchen && facts.fridgePosition) points.push(`冰箱在${facts.fridgePosition === "right" ? "右边" : facts.fridgePosition === "left" ? "左边" : "中间"}的话，要先保留开门和散热空间，再排旁边的高柜或地柜。`);
    if (wardrobe && facts.hasAircon) points.push("衣柜要避开冷气出风和维修位置，不能为了做满墙而挡住保养空间。 ");
    if (tv && facts.groups.has("power")) points.push("电视柜的 power / data point 最好保留在设备可接线的位置，也可以预留走线空间。 ");
    if (shoe && facts.hasDbBox) points.push("鞋柜如果靠近 DB box，电箱必须保留完整开启和检修空间。 ");
    if (facts.hasBeamOrColumn) points.push("梁柱会影响柜体高度或分段，现场尺寸要按实际突出位置调整。 ");

    const specific = points.length ? points.join("") : `${labels} 的尺寸和分段要按你提供的墙面、开口和设备位置来安排。`;
    return `初步建议：${specific}${materialDirection(serviceNames, language)} 这些先作为方向，正式尺寸和现场可行性还是要量尺后确认。您的 Budget 大概想控制在多少？`;
  }

  if (language === "ms") {
    if (kitchen && facts.sinkPosition) points.push(`Sink di bahagian ${facts.sinkPosition} bermaksud base cabinet dan worktop perlu ikut water point sedia ada; saya tak akan assume paip boleh pindah dari chat. `);
    if (facts.plugCount) points.push(`${facts.plugCount} plug point perlu kekal accessible dan jangan tertutup oleh cabinet. `);
    else if (facts.groups.has("power")) points.push("Switch/plug perlu kekal accessible untuk penggunaan dan maintenance. ");
    if (kitchen && facts.noWindow) points.push("Tiada tingkap memberi wall run yang lebih continuous untuk upper cabinet, tetapi height sebenar masih perlu ukur. ");
    else if (facts.hasWindow) points.push("Tingkap akan menghadkan width/height cabinet, jadi cabinet perlu berhenti atau adjust ikut bukaan itu. ");
    if (facts.wallClear) points.push("Wall yang mostly clear sesuai untuk kita plan satu run yang lebih continuous, subject to actual measurement. ");
    if (facts.hasBeamOrColumn) points.push("Beam/column akan affect height atau pembahagian cabinet dan perlu ikut ukuran sebenar. ");
    if (wardrobe && facts.hasAircon) points.push("Wardrobe perlu elak aircon outlet dan ruang maintenance. ");
    if (tv && facts.groups.has("power")) points.push("Untuk TV cabinet, power/data point perlu kekal senang dicapai dan cable route patut dirancang sekali. ");
    if (shoe && facts.hasDbBox) points.push("Kalau shoe cabinet dekat DB box, pintu DB box mesti boleh buka penuh untuk maintenance. ");

    const specific = points.length ? points.join("") : `Untuk ${labels}, size dan pembahagian perlu ikut wall space, opening dan point yang anda dah bagi. `;
    return `Cadangan awal: ${specific}${materialDirection(serviceNames, language)} Ini preliminary direction sahaja; ukuran dan feasibility sebenar tetap perlu confirm masa measurement. Bajet anda lebih kurang berapa?`;
  }

  if (kitchen && facts.sinkPosition) points.push(`Because the sink is in the ${facts.sinkPosition}, the base cabinets and worktop cut-out should be planned around that existing water point rather than assuming it can be relocated. `);
  if (facts.plugCount) points.push(`Keep the ${facts.plugCount} plug points accessible rather than covering them behind fixed cabinet panels. `);
  else if (facts.groups.has("power")) points.push("Keep the switches/plug points accessible for use and maintenance rather than sealing them behind fixed panels. ");
  if (kitchen && facts.noWindow) points.push("With no window restriction mentioned, the upper-cabinet wall can be more continuous, subject to actual height measurement. ");
  else if (facts.hasWindow) points.push("The window will limit cabinet width/height, so upper or tall units need to stop or adjust around the opening and clearance. ");
  if (facts.wallClear) points.push("Since the wall is otherwise clear, a more continuous cabinet run is possible as a starting layout direction, subject to measurement. ");
  if (kitchen && facts.fridgePosition) points.push(`With the fridge on the ${facts.fridgePosition}, allow door-opening and ventilation clearance before setting the adjacent tall/base units. `);
  if (wardrobe && facts.hasAircon) points.push("The wardrobe should avoid blocking the aircon outlet or maintenance access. ");
  if (tv && facts.groups.has("power")) points.push("For the TV cabinet, keep power/data points accessible and plan a practical cable route. ");
  if (shoe && facts.hasDbBox) points.push("If the shoe cabinet is near the DB box, the electrical panel must remain fully accessible for maintenance. ");
  if (facts.hasBeamOrColumn) points.push("Any beam/column will affect cabinet height or sectioning and needs to be reflected in the actual measurement. ");

  const specific = points.length ? points.join("") : `For ${labels}, cabinet sizing and sectioning should follow the wall space, openings and service points you've described. `;
  return `Preliminary advice: ${specific}${materialDirection(serviceNames, language)} This is only a preliminary direction; final dimensions and site feasibility still need measurement. What budget range are you aiming for?`;
}

function activeProjectMessages(messages) {
  const items = messages || [];
  let latestUserIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return items;

  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    if (items[index]?.role !== "user") continue;
    if (isGenuineRejection(items[index]?.content || "")) return items.slice(index + 1);
  }
  return items;
}

function scopeMessages(projectMessages) {
  const items = projectMessages || [];
  let correctionIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role !== "user") continue;
    if (detectCorrectedService(items[index]?.content || "")) {
      correctionIndex = index;
      break;
    }
  }
  return correctionIndex >= 0 ? items.slice(correctionIndex) : items;
}

function scopeUserText(messages) {
  const items = messages || [];
  let firstUser = true;
  return items
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

function shouldBypassIntake(text) {
  const value = String(text || "");
  if (isGenuineRejection(value)) return true;
  if (COMPLAINT_PATTERN.test(value) || TECHNICAL_PATTERN.test(value) || DIRECT_HANDOFF_PATTERN.test(value)) return true;
  if (OUT_OF_SCOPE_PATTERN.test(value) && !SERVICE_FINISH_PATTERN.test(value)) return true;
  if (isUnconfiguredServiceRequest(value)) return true;
  return false;
}

function isAnswerFirstIntent(text) {
  return ANSWER_FIRST_PATTERN.test(String(text || "")) || MATERIAL_QUESTION_PATTERN.test(String(text || ""));
}

function directFirstAnswer(text, serviceNames, language) {
  const value = String(text || "");
  const services = serviceNames
    .map((name) => renovation.services.find((service) => service.name === name))
    .filter(Boolean);

  if (/price|how\s+much|cost|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢/i.test(value)) {
    if (services.length === 1) {
      const service = services[0];
      const label = serviceLabels([service.name], language);
      const guide = String(service.price || service.priceRange || "").replace(/RM\s+/i, "RM ");
      if (language === "zh") return `${label}的示范参考价是 ${guide}。正式报价还是会看实际尺寸、材料、五金和设计。`;
      if (language === "ms") return `${label} punya demo price guide ialah ${guide}. Harga akhir masih ikut ukuran sebenar, material, hardware dan design.`;
      return `${label}: ${guide}. The final quotation still depends on actual dimensions, materials, hardware and design details.`;
    }
    if (language === "zh") return "可以先给您参考价，不过不同柜子的起价不一样，我先按您要做的柜子类型来对。";
    if (language === "ms") return "Boleh bagi price guide, tapi starting price berbeza ikut jenis cabinet. Saya ikut cabinet yang anda nak buat dulu.";
    return "I can give you a starting price, but it differs by cabinet type, so I'll match it to the cabinet you actually want to build.";
  }

  if (MATERIAL_QUESTION_PATTERN.test(value)) {
    if (language === "zh") return "可以。材料可以比较 melamine/MFC、plywood，厨房较潮湿的位置也可以再看 aluminium；要结合预算、finish 和实际使用环境来选。";
    if (language === "ms") return "Boleh. Kita boleh compare melamine/MFC, plywood, dan untuk kitchen area yang lebih lembap boleh pertimbangkan aluminium juga ikut bajet, finish dan penggunaan.";
    return "Yes. We can compare melamine/MFC and plywood, and for wetter kitchen areas aluminium can also be considered depending on budget, finish and actual use.";
  }

  if (services.length && /\b(?:do\s+you|can\s+you|could\s+you)\b|有做吗|有做嗎|可以做吗|可以做嗎/i.test(value)) {
    const label = serviceLabels(services.map((service) => service.name), language);
    if (language === "zh") return `可以，${label}是这个示范有配置的项目。`;
    if (language === "ms") return `Boleh, ${label} memang ada dalam demo ini.`;
    return `Yes, ${label} is included in this demo's configured services.`;
  }
  return null;
}

function ensureAdviceMarker(reply, language) {
  const text = String(reply || "").trim();
  if (!text || ADVICE_MARKER_PATTERN.test(text)) return text;
  if (language === "zh") return `初步建议：${text}`;
  if (language === "ms") return `Cadangan awal: ${text}`;
  return `Preliminary advice: ${text}`;
}

function buildState(messages) {
  const projectMessages = activeProjectMessages(messages);
  const scopedMessages = scopeMessages(projectMessages);
  const projectUserText = userTexts(projectMessages).join(" \n");
  const currentScopeText = scopeUserText(scopedMessages);
  const serviceNames = resolveServices(
    projectMessages.filter((message) => message?.role === "user"),
    []
  );
  const language = establishedConversationLanguage(projectMessages, "en");
  const sizeKnown = SIZE_VALUE_PATTERN.test(currentScopeText);
  const hasLocation = locationKnown(projectUserText);
  const currentPhotoStatus = photoStatus(projectUserText);
  const facts = constraintFacts(currentScopeText);
  const missingConstraints = serviceNames.length ? missingConstraintGroups(serviceNames, facts) : [];
  const adviceSent = assistantTexts(projectMessages).some((text) => ADVICE_MARKER_PATTERN.test(text));

  return {
    projectMessages,
    scopedMessages,
    projectUserText,
    currentScopeText,
    serviceNames,
    language,
    sizeKnown,
    hasLocation,
    photoStatus: currentPhotoStatus,
    facts,
    missingConstraints,
    adviceSent,
  };
}

function nextStage(state) {
  const missing = missingIntakeQuestion(state.language, {
    sizeKnown: state.sizeKnown,
    locationKnown: state.hasLocation,
    photoStatus: state.photoStatus,
  });
  if (missing) return { reply: missing, adviceReply: null };
  if (!state.serviceNames.length) return { reply: serviceQuestion(state.language), adviceReply: null };

  if (state.missingConstraints.length) {
    const hasAnyConstraintInfo = state.facts.groups.size > 0 || state.facts.allClear;
    return {
      reply: hasAnyConstraintInfo
        ? missingConstraintQuestion(state.language, state.missingConstraints)
        : obstructionQuestion(state.language, state.serviceNames),
      adviceReply: null,
    };
  }

  if (!state.adviceSent) {
    return {
      reply: null,
      adviceReply: preliminaryAdvice(state.serviceNames, state.language, state.facts),
    };
  }
  return { reply: null, adviceReply: null };
}

function buildRenovationIntakePlan(messages, { isFirstMessage = false } = {}) {
  const users = userTexts(messages);
  if (!users.length) return { reply: null, adviceReply: null, appendAfterAnswer: null, bypass: false };

  const latest = users.at(-1);
  if (shouldBypassIntake(latest)) {
    return { reply: null, adviceReply: null, appendAfterAnswer: null, bypass: true };
  }

  const state = buildState(messages);
  const openingShown = hasOpeningMessage(messages);
  const stage = nextStage(state);
  const firstCustomerTurn = isFirstMessage || (users.length === 1 && !assistantTexts(messages).length);
  const genericOpening = firstCustomerTurn && GENERIC_GREETING_PATTERN.test(latest);
  const answerFirst = firstCustomerTurn && isAnswerFirstIntent(latest);

  if (genericOpening && !openingShown) {
    return { reply: OPENING_MESSAGE, adviceReply: null, appendAfterAnswer: null, bypass: false, answerFirst: false, state };
  }

  if (answerFirst) {
    let appendAfterAnswer = stage.reply;
    if (!openingShown && !state.sizeKnown && !state.hasLocation) appendAfterAnswer = OPENING_MESSAGE;
    return {
      reply: null,
      adviceReply: stage.adviceReply,
      appendAfterAnswer,
      bypass: false,
      answerFirst: true,
      directFallbackAnswer: directFirstAnswer(latest, state.serviceNames, state.language),
      state,
    };
  }

  if (firstCustomerTurn && !openingShown && !state.sizeKnown && !state.hasLocation) {
    return { reply: OPENING_MESSAGE, adviceReply: null, appendAfterAnswer: null, bypass: false, answerFirst: false, state };
  }

  return {
    reply: stage.reply,
    adviceReply: stage.adviceReply,
    appendAfterAnswer: null,
    bypass: false,
    answerFirst: false,
    state,
  };
}

function buildRenovationIntakeReply(messages, options = {}) {
  return buildRenovationIntakePlan(messages, options).reply;
}

module.exports = {
  OPENING_MESSAGE,
  buildRenovationIntakeReply,
  buildRenovationIntakePlan,
  ensureAdviceMarker,
  _test: {
    hasOpeningMessage,
    locationKnown,
    photoStatus,
    serviceQuestion,
    obstructionQuestion,
    preliminaryAdvice,
    constraintFacts,
    missingConstraintGroups,
    shouldBypassIntake,
    activeProjectMessages,
    scopeMessages,
    buildState,
    directFirstAnswer,
  },
};

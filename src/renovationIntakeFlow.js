const renovation = require("./renovationConfig");
const { detectServices } = require("./renovationServiceDetection");
const { establishedConversationLanguage } = require("./conversationLanguage");
const { isGenuineRejection } = require("./renovationConversationIntent");

const OPENING_MESSAGE = "☀️Pls let us know :\n\nSite photo: \n\nRough size: \n\nLocation: \n\nThanks 👍";
const SIZE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:ft|feet|foot|mm|cm|m|meter|metre)s?\b|rough\s*size|measurement|尺寸|大概\s*\d+\s*尺|ukuran|size\s*lebih\s*kurang/i;
const KNOWN_LOCATION_PATTERN = /puchong|cheras|kajang|petaling\s+jaya|\bpj\b|subang|shah\s+alam|kuala\s+lumpur|\bkl\b|mont\s+kiara|bukit\s+bintang|bukit\s+jalil|setapak|old\s+klang\s+road|ara\s+damansara|蒲种|蒲種|蕉赖|蕉賴|加影|八打灵再也|八打靈再也|梳邦|莎阿南|吉隆坡/i;
const LOCATION_LABEL_PATTERN = /(?:location|lokasi|area|地点|地點|地区|地區|位置)\s*[:：-]?\s*\S+/i;
const PHOTO_PATTERN = /site\s*photo|photo|picture|image|pic\b|attached|sent\s+(?:it|photo)|照片|相片|图片|圖片|gambar|foto/i;
const OBSTRUCTION_PATTERN = /obstruction|clear\s*wall|empty\s*wall|wall\s*(?:space|length|height)|window|door|switch(?:es)?|socket(?:s)?|plug(?:s)?|power\s*point|sink|water\s*point|pipe|hob|hood|stove|beam|column|db\s*box|distribution\s*board|air\s*con|aircon|skirting|nothing\s+there|no\s+(?:obstruction|window|door|switch|plug|socket|pipe|beam|column)|墙|牆|窗|门|門|开关|開關|插座|水管|水槽|抽油烟机|抽油煙機|梁|柱|电箱|電箱|没有阻碍|沒有阻礙|dinding|tingkap|pintu|suis|plug|soket|paip|sink|tiada\s+halangan/i;
// Match only the actual advice response. The preceding obstruction question mentions
// "preliminary layout direction", which must not make the flow think advice was sent.
const ADVICE_MARKER_PATTERN = /preliminary\s+advice|初步建议|初步建議|cadangan\s+awal/i;
const DIRECT_HANDOFF_PATTERN = /site\s*(?:visit|measurement)|come\s+measure|exact\s+(?:quote|quotation|price)|proper\s+(?:quote|quotation)|human|designer|salesperson|project\s+manager|上门量尺|上門量尺|正式报价|正式報價|真人|人工|量尺|quotation\s+appointment/i;

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
  return KNOWN_LOCATION_PATTERN.test(text) || LOCATION_LABEL_PATTERN.test(text);
}

function serviceQuestion(language) {
  if (language === "zh") return "谢谢 👍 您主要想做哪一种：厨房吊柜 + 地柜、衣柜、电视柜、鞋柜，还是其他柜子？";
  if (language === "ms") return "Terima kasih 👍 Anda nak buat apa: kitchen cabinet atas + bawah, wardrobe, TV cabinet, shoe cabinet, atau cabinet lain?";
  return "Thanks 👍 What are you looking to do: upper + lower kitchen cabinets, wardrobe cabinet, TV cabinet, shoe cabinet, or something else?";
}

function missingIntakeQuestion(language, { sizeKnown, locationKnown: hasLocation, photoKnown }) {
  const missing = [];
  if (!sizeKnown) missing.push("size");
  if (!hasLocation) missing.push("location");

  if (!missing.length) return null;
  if (language === "zh") {
    if (missing.length === 2) return `先补充一下大概尺寸和 Location 就可以。${photoKnown ? "Site photo 我也记下了。" : "有 site photo 的话也可以一起发。"}`;
    if (missing[0] === "size") return `还差一个 Rough size，大概几 ft / 大概多长就可以。${photoKnown ? "" : "有 site photo 的话也可以一起发。"}`;
    return `还差 Location，告诉我项目在哪个地区就可以。${photoKnown ? "" : "有 site photo 的话也可以一起发。"}`;
  }
  if (language === "ms") {
    if (missing.length === 2) return `Tinggal rough size dan location saja. ${photoKnown ? "Site photo pun saya dah catat." : "Kalau ada site photo, boleh bagi sekali."}`;
    if (missing[0] === "size") return `Tinggal rough size saja, anggaran berapa ft pun okay. ${photoKnown ? "" : "Kalau ada site photo, boleh bagi sekali."}`;
    return `Tinggal location saja, beritahu project area mana. ${photoKnown ? "" : "Kalau ada site photo, boleh bagi sekali."}`;
  }
  if (missing.length === 2) return `I just need the rough size and location first. ${photoKnown ? "I've noted the site photo too." : "If you have a site photo, you can send that as well."}`;
  if (missing[0] === "size") return `I just need the rough size next, even an approximate length in ft is fine. ${photoKnown ? "" : "If you have a site photo, you can send that too."}`;
  return `I just need the location next. Which area is the project in? ${photoKnown ? "" : "If you have a site photo, you can send that too."}`;
}

function obstructionQuestion(language) {
  if (language === "zh") {
    return "好的。接下来我会先看这个位置的实际限制：墙面够不够、有没有窗/门、switch 或 plug、水位/水管、hob/hood、梁柱或其他阻碍。您可以告诉我这些情况；有清楚的 site photo 也可以一起参考。";
  }
  if (language === "ms") {
    return "Baik. Seterusnya saya nak semak keadaan tempat itu dulu: ruang dinding cukup atau tidak, ada tingkap/pintu, suis atau plug, water point/paip, hob/hood, beam/column atau halangan lain. Boleh beritahu saya keadaan situ; kalau ada site photo yang jelas, boleh bagi sekali.";
  }
  return "Got it. Next I want to check the actual site conditions: whether there is enough clear wall, any windows/doors, switches or plug points, sink/water points, hob/hood, beams/columns, or other obstructions. Tell me what is there; a clear site photo also helps with the preliminary layout direction.";
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

function preliminaryAdvice(serviceNames, language) {
  const labels = serviceLabels(serviceNames, language);
  const material = materialDirection(serviceNames, language);

  if (language === "zh") {
    return `初步建议：${labels} 的位置要先保留 switch / plug、水管和开门空间，也要确认墙面长度和高度够不够；有窗、梁柱或其他阻碍的地方，柜子尺寸和分段就要跟着调整。${material} 这些先作为方向，正式尺寸和现场可行性还是要量尺后确认。您的 Budget 大概想控制在多少？`;
  }
  if (language === "ms") {
    return `Cadangan awal: untuk ${labels}, kita kena pastikan switch/plug, paip, ruang buka pintu dan wall space tidak terhalang; kalau ada tingkap, beam/column atau halangan lain, size dan pembahagian cabinet perlu adjust ikut site. ${material} Ini preliminary direction sahaja, ukuran dan feasibility sebenar tetap perlu confirm masa measurement. Bajet anda lebih kurang berapa?`;
  }
  return `Preliminary advice: for ${labels}, keep switches/plugs, plumbing and door clearance accessible, and make sure there is enough usable wall length/height. Windows, beams/columns or other obstructions can change the cabinet width, height or sectioning. ${material} This is only a preliminary direction; final dimensions and site feasibility still need measurement. What budget range are you aiming for?`;
}

function buildRenovationIntakeReply(messages, { isFirstMessage = false } = {}) {
  const users = userTexts(messages);
  if (!users.length) return null;

  const latest = users.at(-1);
  if (isGenuineRejection(latest) || DIRECT_HANDOFF_PATTERN.test(latest)) return null;

  const assistants = assistantTexts(messages);
  const openingShown = hasOpeningMessage(messages);
  const language = establishedConversationLanguage(messages, "en");

  // For a brand-new enquiry, start with the exact site-first template requested for
  // the renovation demo instead of immediately asking about cabinet categories.
  if ((isFirstMessage || (users.length === 1 && !assistants.length)) && !openingShown) {
    return OPENING_MESSAGE;
  }

  const allUserText = users.join(" \n");
  const sizeKnown = SIZE_PATTERN.test(allUserText);
  const hasLocation = locationKnown(allUserText);
  const photoKnown = PHOTO_PATTERN.test(allUserText);
  const serviceNames = detectServices(allUserText);

  if (openingShown) {
    const missing = missingIntakeQuestion(language, { sizeKnown, locationKnown: hasLocation, photoKnown });
    if (missing) return missing;
    if (!serviceNames.length) return serviceQuestion(language);
  }

  // Once the site basics and cabinet type are known, collect practical obstruction
  // context before giving layout/material direction. This keeps the advice grounded.
  if (serviceNames.length && sizeKnown && hasLocation && !OBSTRUCTION_PATTERN.test(allUserText)) {
    return obstructionQuestion(language);
  }

  if (
    serviceNames.length &&
    sizeKnown &&
    hasLocation &&
    OBSTRUCTION_PATTERN.test(allUserText) &&
    !assistants.some((text) => ADVICE_MARKER_PATTERN.test(text))
  ) {
    return preliminaryAdvice(serviceNames, language);
  }

  return null;
}

module.exports = {
  OPENING_MESSAGE,
  buildRenovationIntakeReply,
  _test: {
    hasOpeningMessage,
    locationKnown,
    serviceQuestion,
    obstructionQuestion,
    preliminaryAdvice,
  },
};

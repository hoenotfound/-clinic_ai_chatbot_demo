const tcm = require("./tcmConfig");
const {
  BOOKING,
  BRANCH,
  TIMING,
  hasTcmBookingIntent,
  branchFromMessages,
  timingFromMessages,
  servicesForText,
  serviceForText,
  recentService,
} = require("./tcmBookingIntent");
const { extractRequestedDay, PUBLIC_HOLIDAY_PATTERN } = require("./tcmKnowledge");

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;
const HOURS_PATTERN = /opening hours?|business hours?|what time.*open|what time.*close|are you open|open\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|closing time|waktu operasi|buka|tutup|营业时间|營業時間|营业吗|營業嗎|有开|有開|开吗|開嗎|几点开|幾點開/i;
const LOCATION_PATTERN = /where are you|location|address|branch|cawangan|alamat|在哪里|在哪裡|地址|分行/i;
const NINE_D_PATTERN = /\b9d\b|9d\s*(?:逆龄抗衰|逆齡抗衰)/i;

const DISPLAY_NAMES = {
  zh: {
    "TCM Consultation": "中医问诊",
    Acupuncture: "针灸",
    Tuina: "推拿",
    Cupping: "拔罐",
    "Gua Sha": "刮痧",
    "Chinese Herbal Medicine Consultation": "中药问诊",
    "Pelvic & Posture Manual Adjustment": "骨盆与体态调理",
    "3D Facial Contour Manual Adjustment": "3D 小颜术",
  },
  ms: {
    "TCM Consultation": "Konsultasi TCM",
    Acupuncture: "Akupunktur",
    Tuina: "Tuina",
    Cupping: "Bekam / Cupping",
    "Gua Sha": "Gua Sha",
    "Chinese Herbal Medicine Consultation": "Konsultasi Herba Cina",
    "Pelvic & Posture Manual Adjustment": "Rawatan Manual Pelvis & Postur",
    "3D Facial Contour Manual Adjustment": "3D Rawatan Kontur Muka",
  },
};

function userMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function latestUserText(messages) {
  return String(userMessages(messages).at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|harga|berapa|sakit|cawangan|datang|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|cuti\s+umum|hari\s+kelepasan\s+am|postur|muka|herba|buka|tutup|pukul)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function displayName(service, lang) {
  if (!service) return "";
  return DISPLAY_NAMES[lang]?.[service.name] || service.name;
}

function pricingNote(service, lang) {
  if (!service?.pricingNote) return "";
  if (lang === "zh") return " 中药费用会由中医师根据实际处方确认。";
  if (lang === "ms") return " Kos herba akan disahkan oleh pengamal TCM berdasarkan preskripsi sebenar.";
  return " Herbal medicine cost is confirmed by the practitioner based on the actual prescription.";
}

function priceReply(service, lang) {
  if (!service) return null;
  const name = displayName(service, lang);
  const price = String(service.priceRange || "").trim();
  if (!price || /not configured/i.test(price)) {
    if (lang === "zh") return `${name} 的实际价格需要由 team 在评估后确认，我这边先不乱报。`;
    if (lang === "ms") return `Harga sebenar untuk ${name} perlu disahkan oleh team selepas assessment, jadi saya tak nak bagi angka yang belum confirm.`;
    return `The team will confirm the actual price for ${name} after assessment, so I don’t want to quote an unconfirmed amount.`;
  }
  const amount = price.replace(/^From\s+/i, "");
  const base = lang === "zh"
    ? `${name}${/^From\s+/i.test(price) ? `从 ${amount} 起` : `是 ${amount}`}。`
    : lang === "ms"
      ? `${name} ${/^From\s+/i.test(price) ? `bermula dari ${amount}` : `berharga ${amount}`}.`
      : `${name} ${/^From\s+/i.test(price) ? `starts from ${amount}` : `is ${amount}`}.`;
  return `${base}${pricingNote(service, lang)}`;
}

function schedulingInvite(lang) {
  if (lang === "zh") return "如果你想安排时间，可以告诉我比较方便的 branch 和日期/时段。";
  if (lang === "ms") return "Kalau nak arrange appointment, boleh beritahu branch dan hari/masa yang lebih sesuai.";
  return "If you'd like to arrange a visit, tell me the branch and day/time that suit you.";
}

function bookingReply(messages, service, lang) {
  const branch = branchFromMessages(messages);
  const timing = timingFromMessages(messages);
  if (!branch) {
    if (lang === "zh") return "可以。你比较方便 Kuala Lumpur 还是 Petaling Jaya branch？";
    if (lang === "ms") return "Boleh. Branch mana lebih convenient untuk anda, Kuala Lumpur atau Petaling Jaya?";
    return "Sure. Which branch is more convenient for you, Kuala Lumpur or Petaling Jaya?";
  }
  if (!timing) {
    if (lang === "zh") return `好，记下 ${branch}。你比较方便平日还是周末？`;
    if (lang === "ms") return `Okay, saya dah catat ${branch}. Hari biasa atau hujung minggu lebih sesuai?`;
    return `Got it, ${branch}. Would a weekday or weekend suit you better?`;
  }
  const summary = [service ? displayName(service, lang) : null, branch, timing].filter(Boolean).join(" · ");
  if (lang === "zh") return `好，记下了 ${summary}。我帮你转给 TCM team，由他们确认实际可用时间。 [[HANDOFF]]`;
  if (lang === "ms") return `Okay, saya dah catat ${summary}. Saya pass kepada team TCM untuk confirm masa yang available. [[HANDOFF]]`;
  return `Got it: ${summary}. I’ll pass these details to the TCM team so they can confirm the actual available time. [[HANDOFF]]`;
}

function preferenceReply(messages, service, lang) {
  const branch = branchFromMessages(messages);
  const timing = timingFromMessages(messages);
  const summary = [service ? displayName(service, lang) : null, branch, timing].filter(Boolean).join(" · ");
  if (lang === "zh") return `${summary ? `我先记下 ${summary}。` : ""}如果你之后决定预约，告诉我就可以继续安排。`;
  if (lang === "ms") return `${summary ? `Saya catat dulu ${summary}. ` : ""}Kalau anda decide nak book nanti, beritahu saya dan kita boleh sambung dari situ.`;
  return `${summary ? `I've noted ${summary}. ` : ""}If you decide to book later, tell me and we can continue from there.`;
}

function localizedServiceSummary(service, lang) {
  if (!service) return "";
  if (service.name === "Pelvic & Posture Manual Adjustment") {
    if (lang === "zh") return "会先做 1对1 体态和日常习惯评估，再根据评估结果用徒手方式处理骨盆、腰背、髋部、肩颈或头颈前倾等相关位置；不是固定模板，也不是靠机器。";
    if (lang === "ms") return "Servis ini bermula dengan assessment postur dan tabiat harian secara 1-to-1. Berdasarkan assessment, pengamal boleh fokus pada pelvis, pinggang, pinggul, bahu/leher atau postur kepala ke depan menggunakan teknik manual, bukan mesin dan bukan template tetap.";
  }
  if (service.name === "3D Facial Contour Manual Adjustment") {
    if (lang === "zh") return "会先看左右脸的肌肉紧绷、整体平衡和相关生活习惯，再用非侵入式徒手方式针对需要的位置做调整；9D 可作为后续搭配，侧重紧致、保湿、提亮和皮肤状态护理。";
    if (lang === "ms") return "Servis ini bermula dengan assessment ketegangan otot muka, keseimbangan kiri-kanan dan tabiat harian. Teknik manual digunakan secara non-invasive, manakala 9D boleh digabungkan sebagai sokongan untuk firming, hydration, brightness dan penjagaan keadaan kulit.";
  }
  return String(service.frontDeskSummary || service.description || "").trim();
}

function serviceReply(service, lang) {
  const name = displayName(service, lang);
  const price = String(service.priceRange || "").trim();
  const hasPrice = price && !/not configured/i.test(price);
  const summary = localizedServiceSummary(service, lang);

  if (service.name === "Pelvic & Posture Manual Adjustment" || service.name === "3D Facial Contour Manual Adjustment") {
    if (lang === "zh") return `${name}主要是这样做：${summary}`;
    if (lang === "ms") return `Ya, kami ada ${name}. ${summary}`;
    return `Yes, we offer ${name}. ${summary}`;
  }

  if (hasPrice) {
    const amount = price.replace(/^From\s+/i, "");
    if (lang === "zh") return `有的 😊 ${name}从 ${amount} 起。` + pricingNote(service, lang);
    if (lang === "ms") return `Ya, ada 😊 ${name} bermula dari ${amount}.` + pricingNote(service, lang);
    return `Yes, we do 😊 ${name} starts from ${amount}.` + pricingNote(service, lang);
  }

  if (lang === "zh") return `有的，${name}是这里提供的服务之一。`;
  if (lang === "ms") return `Ya, kami ada ${name}.`;
  return `Yes, we offer ${name}.`;
}

function nineDReply(lang, askedPrice) {
  if (askedPrice) {
    if (lang === "zh") return "9D 是 3D 小颜术之后可搭配的护理步骤，主要做紧致、保湿和提亮。9D 单做或配套的实际价格需要由 team 确认，我这边先不乱报。";
    if (lang === "ms") return "9D ialah langkah tambahan yang boleh digabungkan selepas 3D rawatan muka, dengan fokus pada firming, hydration dan brightness. Harga standalone atau package perlu team confirm dulu.";
    return "9D is an optional companion step after the 3D facial manual treatment, focused on firming, hydration and brightness. The team needs to confirm its standalone or package price.";
  }
  if (lang === "zh") return "9D 是 3D 小颜术之后可搭配的护理步骤，主要偏向紧致、保湿、提亮和整体肤况支持；它不是用来取代 3D 徒手调整的。";
  if (lang === "ms") return "9D ialah langkah tambahan selepas 3D rawatan muka, lebih kepada firming, hydration, brightness dan sokongan keadaan kulit; ia bukan pengganti langkah manual 3D.";
  return "9D is an optional companion step after the 3D facial manual treatment, mainly for firming, hydration, brightness and skin-condition support; it does not replace the 3D manual step.";
}

function hoursReply(latest, lang) {
  if (PUBLIC_HOLIDAY_PATTERN.test(latest)) {
    if (lang === "zh") return "公共假期休息。";
    if (lang === "ms") return "Kami tutup pada cuti umum.";
    return "We’re closed on public holidays.";
  }
  const day = extractRequestedDay(latest);
  if (day === "sunday") {
    if (lang === "zh") return "星期日休息。营业时间是星期一到星期六，10:00 AM–7:00 PM。";
    if (lang === "ms") return "Hari Ahad tutup. Waktu operasi Isnin hingga Sabtu, 10:00 AM–7:00 PM.";
    return "We’re closed on Sundays. Regular hours are Monday–Saturday, 10:00 AM–7:00 PM.";
  }
  if (day) {
    if (lang === "zh") return "有开 😊 星期一到星期六的营业时间是 10:00 AM–7:00 PM。";
    if (lang === "ms") return "Ya, buka 😊 Waktu operasi Isnin hingga Sabtu ialah 10:00 AM–7:00 PM.";
    return "Yes 😊 We’re open Monday–Saturday, 10:00 AM–7:00 PM.";
  }
  if (lang === "zh") return "营业时间是星期一到星期六，10:00 AM–7:00 PM；星期日和公共假期休息。";
  if (lang === "ms") return "Waktu operasi Isnin hingga Sabtu, 10:00 AM–7:00 PM. Ahad dan cuti umum tutup.";
  return "Our hours are Monday–Saturday, 10:00 AM–7:00 PM. We’re closed on Sundays and public holidays.";
}

function multiPriceReply(services, lang) {
  const parts = services.slice(0, 4).map((service) => priceReply(service, lang));
  return parts.join(lang === "zh" ? " " : " ");
}

function buildTcmFallbackReply(messages) {
  const latest = latestUserText(messages);
  if (!latest) return "How can I help with your TCM enquiry?";
  const lang = languageFor(latest);
  const namedServices = servicesForText(latest);
  const service = namedServices[0] || recentService(messages);

  if (HOURS_PATTERN.test(latest)) return hoursReply(latest, lang);

  if (LOCATION_PATTERN.test(latest) && !BOOKING.test(latest)) {
    if (lang === "zh") return "目前有 Kuala Lumpur 和 Petaling Jaya 两个 branch。你比较方便哪一个？";
    if (lang === "ms") return "Ada branch di Kuala Lumpur dan Petaling Jaya. Yang mana lebih convenient untuk anda?";
    return "There are branches in Kuala Lumpur and Petaling Jaya. Which is more convenient for you?";
  }

  if (NINE_D_PATTERN.test(latest) && namedServices.length <= 1) {
    const reply = nineDReply(lang, PRICE_PATTERN.test(latest));
    if (hasTcmBookingIntent(messages)) return `${reply} ${bookingReply(messages, service, lang)}`;
    return reply;
  }

  if (PRICE_PATTERN.test(latest) && namedServices.length > 1) {
    const reply = multiPriceReply(namedServices, lang);
    if (hasTcmBookingIntent(messages)) return `${reply} ${bookingReply(messages, namedServices[0], lang)}`;
    return `${reply} ${schedulingInvite(lang)}`;
  }

  if (PRICE_PATTERN.test(latest) && service) {
    const price = priceReply(service, lang);
    if (hasTcmBookingIntent(messages)) return `${price} ${bookingReply(messages, service, lang)}`;
    return `${price} ${schedulingInvite(lang)}`;
  }

  if (hasTcmBookingIntent(messages)) return bookingReply(messages, service, lang);

  if ((BRANCH.test(latest) || TIMING.test(latest)) && (branchFromMessages(messages) || timingFromMessages(messages))) {
    return preferenceReply(messages, service, lang);
  }

  if (service) return serviceReply(service, lang);

  if (lang === "zh") return "可以告诉我你主要想了解什么吗？我可以帮你看 TCM 服务、价格、branch 或预约流程。";
  if (lang === "ms") return "Boleh beritahu saya anda nak tanya tentang apa? Saya boleh bantu pasal servis TCM, harga, branch atau appointment.";
  return "What would you like to know? I can help with TCM services, prices, branches or appointment enquiries.";
}

module.exports = {
  buildTcmFallbackReply,
  _test: {
    priceReply,
    schedulingInvite,
    languageFor,
    localizedServiceSummary,
    serviceReply,
    nineDReply,
    hoursReply,
    displayName,
    multiPriceReply,
  },
};

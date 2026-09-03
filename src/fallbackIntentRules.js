const clinic = require("./clinicConfig");
const { _test: fallbackHelpers } = require("./clinicFallback");

const {
  detectBranch,
  detectTiming,
  detectServices,
  hadBookingConversation,
} = fallbackHelpers;

const BOOKING_PATTERN = /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|can\s+i\s+come|come\s+in|want\s+to\s+visit|want\s+to\s+do|arrange|nak\s+buat|mahu\s+buat|\btempah\b|\btemujanji\b|boleh\s+datang|nak\s+datang|mahu\s+datang|预约|預約|约(?:个)?时间|約(?:個)?時間|有空位|可以来|可以來|想来|想來/i;
const BRANCH_PATTERN = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|bukit bintang|八打灵再也|八打靈再也|吉隆坡/i;
const TIMING_PATTERN = /weekend|saturday|sunday|weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|night|tomorrow|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|hujung minggu|sabtu|ahad|hari biasa|isnin|selasa|rabu|khamis|jumaat|pagi|petang|malam|esok|周末|週末|周六|週六|星期六|周日|週日|星期日|平日|工作日|星期一|星期二|星期三|星期四|星期五|早上|上午|下午|晚上|明天/i;
const WALK_IN_PATTERN = /walk[- ]?in|without appointment|datang terus|tak appointment|直接来|直接來|不预约.*来|不預約.*來/i;
const PROMOTION_PATTERN = /promo|promotion|offer|special|discount|deal|promosi|优惠|優惠|折扣|配套/i;
const NERVOUS_PATTERN = /scared|afraid|nervous|worried|takut|risau|害怕|担心|擔心/i;
const TRUE_BUDGET_OBJECTION_PATTERN = /too expensive|very expensive|so expensive|pricey|over (?:my )?budget|out of (?:my )?budget|can['’]?t afford|cannot afford|mahal sangat|terlalu mahal|太贵|太貴|贵了|貴了|超出预算|超出預算/i;
const BUDGET_MENTION_PATTERN = /\bbudget\b|预算|預算/i;
const UNCONFIGURED_TREATMENT_PATTERN = /dermal filler|lip filler|nose filler|\bfiller\b|thread lift|threadlift|microneedl|chemical peel|hydrafacial|\bfacial\b|laser hair removal|hair removal|玻尿酸|填充|线雕|線雕|微针|微針|果酸|脱毛|脫毛/i;
const CONTEXT_FOLLOWUP_PATTERN = /how long|duration|is it painful|does it hurt|painful|how many sessions?|side effects?|risks?|downtime|recovery|when.*results?|see results?|berapa lama|berapa session|sakit tak|sakit ke|kesan sampingan|多久|多长时间|多長時間|痛吗|痛嗎|几次|幾次|副作用|恢复期|恢復期|效果/i;

function userMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function latestUserText(messages) {
  return String(userMessages(messages).at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(nak|boleh|harga|berapa|sakit|cawangan|saya|mahal|takut|risau|pagi|petang|malam|hujung minggu)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function replyByLanguage(lang, options) {
  return options[lang] || options.en;
}

function shortServiceName(service) {
  if (!service) return null;
  return service.key === "hifu" ? "HIFU" : service.name;
}

function configuredService(service) {
  if (!service) return null;
  return clinic.services.find((item) => item.name === service.name) || null;
}

function servicePriceSentence(service, lang) {
  const configured = configuredService(service);
  if (!configured) return "";
  const name = shortServiceName(service);
  if (service.key === "botox") {
    return replyByLanguage(lang, {
      en: `${name} pricing depends on the treatment area and units needed, so it’s confirmed after consultation.`,
      ms: `Harga ${name} bergantung pada area dan units yang diperlukan, jadi ia akan confirm selepas consultation.`,
      zh: `${name} 的价格会看部位和所需 units，所以需要 consultation 后确认。`,
    });
  }
  const price = configured.priceRange.replace(/^From\s+/i, "");
  return replyByLanguage(lang, {
    en: `${name} starts from ${price}.`,
    ms: `${name} bermula dari ${price}.`,
    zh: `${name} 从 ${price} 起。`,
  });
}

function inferUnambiguousService(messages, latest) {
  const latestServices = detectServices(latest);
  if (latestServices.length === 1) return latestServices[0];
  if (latestServices.length > 1) return null;

  const previousUsers = userMessages(messages).slice(0, -1).reverse();
  for (const message of previousUsers) {
    const services = detectServices(String(message.content || ""));
    if (services.length === 1) return services[0];
    if (services.length > 1) return null;
  }
  return null;
}

function recentAmbiguousServices(messages, latest) {
  if (detectServices(latest).length) return [];
  const previousUsers = userMessages(messages).slice(0, -1).reverse();
  for (const message of previousUsers) {
    const services = detectServices(String(message.content || ""));
    if (services.length > 1) return services;
    if (services.length === 1) return [];
  }
  return [];
}

function ambiguousFollowupReply(messages, latest, lang) {
  if (!CONTEXT_FOLLOWUP_PATTERN.test(latest)) return null;
  const services = recentAmbiguousServices(messages, latest);
  if (services.length < 2) return null;
  const names = services.slice(0, 2).map(shortServiceName);
  return replyByLanguage(lang, {
    en: `Just to make sure I answer the right one — do you mean ${names[0]} or ${names[1]}?`,
    ms: `Nak confirm supaya saya jawab treatment yang betul — you maksudkan ${names[0]} atau ${names[1]}?`,
    zh: `确认一下，避免我答错：你是指 ${names[0]} 还是 ${names[1]}？`,
  });
}

function unconfiguredTreatmentReply(latest, lang) {
  if (!UNCONFIGURED_TREATMENT_PATTERN.test(latest)) return null;
  const pricing = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢/i.test(latest);
  return replyByLanguage(lang, {
    en: `I don’t have confirmed ${pricing ? "pricing or " : ""}service details for that treatment in the current clinic configuration. I can help with HIFU, Pico Laser, Botulinum Toxin or Skin Booster, or pass the question to the clinic team.`,
    ms: `Saya tak ada confirmed ${pricing ? "harga atau " : ""}service details untuk treatment tu dalam clinic configuration sekarang. Saya boleh bantu HIFU, Pico Laser, Botulinum Toxin atau Skin Booster, atau pass soalan kepada team clinic.`,
    zh: `目前 clinic configuration 里没有这个 treatment 的确认${pricing ? "价格或" : ""}资料。我可以帮你了解 HIFU、Pico Laser、Botulinum Toxin 或 Skin Booster，也可以把问题转给 clinic team。`,
  });
}

function previousAssistantText(messages) {
  return String([...(messages || [])].reverse().find((message) => message?.role === "assistant")?.content || "");
}

function isWalkInContinuation(messages, latest) {
  if (!BRANCH_PATTERN.test(latest) && !TIMING_PATTERN.test(latest)) return false;
  const previousUsers = userMessages(messages).slice(0, -1).map((message) => String(message.content || "")).join("\n");
  const assistant = previousAssistantText(messages);
  return WALK_IN_PATTERN.test(previousUsers) && /preferred.*branch|branch.*timing|collect.*branch|team.*confirm|allocate enough time/i.test(assistant);
}

function bookingIsActive(messages, latest) {
  if (BOOKING_PATTERN.test(latest)) return true;
  if (isWalkInContinuation(messages, latest)) return true;
  return hadBookingConversation(messages, latest);
}

function bookingReply(messages, latest, lang) {
  const branch = detectBranch(messages);
  const timing = detectTiming(messages);
  const service = inferUnambiguousService(messages, latest);
  const serviceName = shortServiceName(service);

  if (!branch) {
    return replyByLanguage(lang, {
      en: `${serviceName ? `Sure — for ${serviceName}, ` : "Sure. "}Which branch is more convenient for you, Kuala Lumpur or Petaling Jaya?`,
      ms: `${serviceName ? `Boleh — untuk ${serviceName}, ` : "Boleh. "}branch mana lebih convenient untuk you, Kuala Lumpur atau Petaling Jaya?`,
      zh: `${serviceName ? `可以，${serviceName} 的话，` : "可以。"}你比较方便 Kuala Lumpur 还是 Petaling Jaya branch？`,
    });
  }

  if (!timing) {
    return replyByLanguage(lang, {
      en: `Got it${serviceName ? `: ${serviceName}, ${branch}` : `, ${branch}`}. Would weekday or weekend suit you better?`,
      ms: `Okay${serviceName ? `: ${serviceName}, ${branch}` : `, ${branch}`}. Weekday atau weekend lebih sesuai untuk you?`,
      zh: `好，记下了${serviceName ? ` ${serviceName} + ${branch}` : ` ${branch}`}。你比较方便 weekday 还是 weekend？`,
    });
  }

  return replyByLanguage(lang, {
    en: `Got it: ${[serviceName, branch, timing].filter(Boolean).join(", ")}. I’ll pass these details to the clinic team to confirm the actual available time with you. [[HANDOFF]]`,
    ms: `Okay, saya dah catat ${[serviceName, branch, timing].filter(Boolean).join(", ")}. Saya pass detail ni kepada team clinic untuk confirm masa yang betul-betul available dengan you. [[HANDOFF]]`,
    zh: `好，记下了 ${[serviceName, branch, timing].filter(Boolean).join(" + ")}。我帮你把这些资料转给 clinic team，由他们跟你确认实际 available time。 [[HANDOFF]]`,
  });
}

function promotionReply(lang) {
  return replyByLanguage(lang, {
    en: "The current HIFU Lifting Special is HIFU from RM 888 with a complimentary consultation. There isn’t a set expiry date listed at the moment.",
    ms: "Promo HIFU sekarang ialah HIFU dari RM 888 dengan complimentary consultation. Buat masa ini tiada expiry date yang ditetapkan.",
    zh: "目前的 HIFU Lifting Special 是 HIFU 从 RM 888 起，并包含免费 consultation。目前没有设定截止日期。",
  });
}

function comfortReply(service, lang) {
  const name = shortServiceName(service);
  return replyByLanguage(lang, {
    en: `${name ? `It’s understandable to feel nervous about ${name}. ` : ""}Comfort varies from person to person, and the clinic team can explain what to expect before treatment.`,
    ms: `${name ? `Kalau rasa risau pasal ${name}, memang normal. ` : ""}Rasa sakit berbeza ikut individu, dan team clinic boleh explain apa yang biasanya boleh dijangka sebelum treatment.`,
    zh: `${name ? `对 ${name} 有点担心很正常。` : ""}舒适度会因人而异，clinic team 可以在 treatment 前说明一般会有什么感觉。`,
  });
}

function budgetAmount(latest) {
  return latest.match(/RM\s*[\d,.]+/i)?.[0]?.replace(/\s+/g, " ") || null;
}

function budgetInfoReply(messages, latest, lang) {
  if (!BUDGET_MENTION_PATTERN.test(latest) || TRUE_BUDGET_OBJECTION_PATTERN.test(latest)) return null;
  const service = inferUnambiguousService(messages, latest);
  const amount = budgetAmount(latest);
  const intro = replyByLanguage(lang, {
    en: amount ? `Got it — your budget is around ${amount}.` : "Got it — I’ll keep your budget in mind.",
    ms: amount ? `Okay — budget you sekitar ${amount}.` : "Okay — saya keep budget you in mind.",
    zh: amount ? `好，你的预算大约是 ${amount}。` : "好，我会记住你的预算范围。",
  });

  if (bookingIsActive(messages, latest) && (BOOKING_PATTERN.test(latest) || TIMING_PATTERN.test(latest) || isWalkInContinuation(messages, latest))) {
    const price = service ? servicePriceSentence(service, lang) : "";
    return [intro, price, bookingReply(messages, latest, lang)].filter(Boolean).join(" ");
  }

  if (service) {
    return [intro, servicePriceSentence(service, lang)].filter(Boolean).join(" ");
  }

  return replyByLanguage(lang, {
    en: `${intro} Which treatment or concern are you looking at? I can give you the configured starting price without guessing.`,
    ms: `${intro} You tengah consider treatment atau concern apa? Saya boleh bagi configured starting price tanpa teka.`,
    zh: `${intro} 你主要在考虑哪个 treatment 或 concern？我可以直接告诉你已配置的起始价格，不会乱猜。`,
  });
}

function bookingCompoundIntentReply(messages, latest, lang) {
  const active = bookingIsActive(messages, latest);
  const progressCue = BOOKING_PATTERN.test(latest) || TIMING_PATTERN.test(latest) || isWalkInContinuation(messages, latest);
  if (!active || !progressCue) return null;

  const service = inferUnambiguousService(messages, latest);
  const direct = [];
  if (PROMOTION_PATTERN.test(latest)) direct.push(promotionReply(lang));
  if (NERVOUS_PATTERN.test(latest)) direct.push(comfortReply(service, lang));
  if (TRUE_BUDGET_OBJECTION_PATTERN.test(latest)) {
    const price = service ? servicePriceSentence(service, lang) : "";
    direct.push(replyByLanguage(lang, {
      en: `${price ? `${price} ` : ""}I understand the budget concern. There isn’t another discount I can confirm here.`,
      ms: `${price ? `${price} ` : ""}Faham pasal budget concern tu. Tak ada discount lain yang saya boleh confirm di sini.`,
      zh: `${price || ""}预算方面可以理解。目前没有其他我能确认的折扣。`,
    }));
  }
  if (!direct.length) return null;
  direct.push(bookingReply(messages, latest, lang));
  return direct.join(" ");
}

function buildFallbackIntentReply(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;
  const lang = languageFor(latest);

  const unconfigured = unconfiguredTreatmentReply(latest, lang);
  if (unconfigured) return unconfigured;

  const ambiguous = ambiguousFollowupReply(messages, latest, lang);
  if (ambiguous) return ambiguous;

  const budgetInfo = budgetInfoReply(messages, latest, lang);
  if (budgetInfo) return budgetInfo;

  const compound = bookingCompoundIntentReply(messages, latest, lang);
  if (compound) return compound;

  if (isWalkInContinuation(messages, latest)) return bookingReply(messages, latest, lang);

  if (PROMOTION_PATTERN.test(latest) && !BOOKING_PATTERN.test(latest) && !TIMING_PATTERN.test(latest)) {
    return promotionReply(lang);
  }

  return null;
}

module.exports = {
  buildFallbackIntentReply,
  _test: {
    inferUnambiguousService,
    recentAmbiguousServices,
    isWalkInContinuation,
    bookingIsActive,
    budgetInfoReply,
    bookingCompoundIntentReply,
  },
};
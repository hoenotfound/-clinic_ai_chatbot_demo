const tcm = require("./tcmConfig");

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;
const BOOKING_PATTERN = /\bbook(?:ing)?\b|appointment|slot|available|can i come|want to visit|arrange|tempah|temujanji|boleh datang|nak datang|预约|預約|有空位|可以来|可以來|想来|想來/i;
const HOURS_PATTERN = /opening hours?|business hours?|what time.*open|what time.*close|营业时间|營業時間|几点开|幾點開|waktu operasi/i;
const LOCATION_PATTERN = /where are you|location|address|branch|cawangan|alamat|在哪里|在哪裡|地址|分行/i;
const TIMING_PATTERN = /weekend|saturday|sunday|weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|night|tomorrow|sabtu|ahad|hari biasa|pagi|petang|malam|esok|周末|週末|星期[一二三四五六日]|早上|上午|下午|晚上|明天/i;
const BRANCH_PATTERN = /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|bukit bintang|八打灵再也|八打靈再也|吉隆坡/i;

function userMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function latestUserText(messages) {
  return String(userMessages(messages).at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|harga|berapa|sakit|cawangan|datang|pagi|petang|malam)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function serviceFor(text) {
  const lower = String(text || "").toLowerCase();
  return tcm.services.find((service) =>
    [service.name, ...(service.aliases || [])].some((term) => lower.includes(String(term).toLowerCase()))
  ) || null;
}

function recentService(messages) {
  for (const message of [...userMessages(messages)].reverse()) {
    const service = serviceFor(message.content);
    if (service) return service;
  }
  return null;
}

function branchFor(messages) {
  for (const message of [...userMessages(messages)].reverse()) {
    const text = String(message.content || "").toLowerCase();
    if (!BRANCH_PATTERN.test(text)) continue;
    if (/petaling jaya|\bpj\b|八打灵再也|八打靈再也/i.test(text)) return "Petaling Jaya";
    if (/kuala lumpur|\bkl\b|bukit bintang|吉隆坡/i.test(text)) return "Kuala Lumpur";
  }
  return null;
}

function timingFor(messages) {
  for (const message of [...userMessages(messages)].reverse()) {
    const text = String(message.content || "");
    if (!TIMING_PATTERN.test(text)) continue;
    const lower = text.toLowerCase();
    if (/saturday|sabtu|星期六|周六|週六/i.test(lower)) return /afternoon|petang|下午/i.test(lower) ? "Saturday afternoon" : "Saturday";
    if (/sunday|ahad|星期日|周日|週日/i.test(lower)) return "Sunday";
    if (/weekday|hari biasa|平日|工作日/i.test(lower)) return "Weekday";
    if (/weekend|周末|週末/i.test(lower)) return "Weekend";
    if (/morning|pagi|早上|上午/i.test(lower)) return "Morning";
    if (/afternoon|petang|下午/i.test(lower)) return "Afternoon";
    if (/evening|night|malam|晚上/i.test(lower)) return "Evening";
    if (/tomorrow|esok|明天/i.test(lower)) return "Tomorrow";
  }
  return null;
}

function priceText(service) {
  return String(service?.priceRange || "").trim();
}

function priceReply(service, lang) {
  if (!service) return null;
  const price = priceText(service);
  if (lang === "zh") return `${service.name} ${/^From\s+/i.test(price) ? `从 ${price.replace(/^From\s+/i, "")} 起` : `价格是 ${price}`}。`;
  if (lang === "ms") return `${service.name} ${/^From\s+/i.test(price) ? `bermula dari ${price.replace(/^From\s+/i, "")}` : `berharga ${price}`}.`;
  return `${service.name} ${/^From\s+/i.test(price) ? `starts from ${price.replace(/^From\s+/i, "")}` : `is ${price}`}.`;
}

function bookingReply(messages, service, lang) {
  const branch = branchFor(messages);
  const timing = timingFor(messages);
  if (!branch) {
    if (lang === "zh") return "可以。你比较方便 Kuala Lumpur 还是 Petaling Jaya branch？";
    if (lang === "ms") return "Boleh. Branch mana lebih convenient untuk anda, Kuala Lumpur atau Petaling Jaya?";
    return "Sure. Which branch is more convenient for you, Kuala Lumpur or Petaling Jaya?";
  }
  if (!timing) {
    if (lang === "zh") return `好，记下 ${branch}。你比较方便 weekday 还是 weekend？`;
    if (lang === "ms") return `Okay, saya dah catat ${branch}. Weekday atau weekend lebih sesuai?`;
    return `Got it, ${branch}. Would a weekday or weekend suit you better?`;
  }
  const summary = [service?.name, branch, timing].filter(Boolean).join(" · ");
  if (lang === "zh") return `好，记下了 ${summary}。我帮你转给 TCM team，由他们确认实际 available time。 [[HANDOFF]]`;
  if (lang === "ms") return `Okay, saya dah catat ${summary}. Saya pass kepada team TCM untuk confirm masa yang available. [[HANDOFF]]`;
  return `Got it: ${summary}. I’ll pass these details to the TCM team so they can confirm the actual available time. [[HANDOFF]]`;
}

function serviceReply(service, lang) {
  if (lang === "zh") return `${service.name} 是这里提供的 TCM service 之一。具体是否适合个人情况，需要由中医师进一步了解后判断。`;
  if (lang === "ms") return `${service.name} ialah salah satu service TCM yang disediakan. Pengamal TCM akan tentukan kesesuaian berdasarkan keadaan individu.`;
  return `${service.name} is one of the configured TCM services. A TCM practitioner can confirm whether it is appropriate for an individual situation.`;
}

function buildTcmFallbackReply(messages) {
  const latest = latestUserText(messages);
  if (!latest) return "How can I help with your TCM enquiry?";
  const lang = languageFor(latest);
  const service = serviceFor(latest) || recentService(messages);

  if (HOURS_PATTERN.test(latest)) {
    if (lang === "zh") return `营业时间是 ${tcm.hours.general}。${tcm.hours.closed}。`;
    if (lang === "ms") return `Waktu operasi ialah ${tcm.hours.general}. ${tcm.hours.closed}.`;
    return `Our hours are ${tcm.hours.general}. ${tcm.hours.closed}.`;
  }

  if (LOCATION_PATTERN.test(latest) && !BOOKING_PATTERN.test(latest)) {
    const names = tcm.branches.map((branch) => branch.name).join(" and ");
    if (lang === "zh") return `目前有 ${names} 两个 branch。你比较方便哪一个？`;
    if (lang === "ms") return `Ada branch di ${names}. Yang mana lebih convenient untuk anda?`;
    return `There are branches in ${names}. Which is more convenient for you?`;
  }

  if (PRICE_PATTERN.test(latest) && service) {
    const price = priceReply(service, lang);
    if (BOOKING_PATTERN.test(latest) || TIMING_PATTERN.test(latest) || BRANCH_PATTERN.test(latest)) {
      return `${price} ${bookingReply(messages, service, lang)}`;
    }
    return price;
  }

  if (BOOKING_PATTERN.test(latest) || (branchFor(messages) && TIMING_PATTERN.test(latest))) {
    return bookingReply(messages, service, lang);
  }

  if (service) return serviceReply(service, lang);

  if (lang === "zh") return "可以告诉我你主要想了解什么吗？我可以帮你看 TCM service、价格、branch 或预约流程。";
  if (lang === "ms") return "Boleh beritahu saya anda nak tanya tentang apa? Saya boleh bantu pasal service TCM, harga, branch atau appointment.";
  return "What would you like to know? I can help with TCM services, prices, branches or appointment enquiries.";
}

module.exports = { buildTcmFallbackReply };

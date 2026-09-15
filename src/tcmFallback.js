const tcm = require("./tcmConfig");
const {
  BOOKING,
  BRANCH,
  TIMING,
  hasTcmBookingIntent,
  branchFromMessages,
  timingFromMessages,
  serviceForText,
  recentService,
} = require("./tcmBookingIntent");

const PRICE_PATTERN = /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i;
const HOURS_PATTERN = /opening hours?|business hours?|what time.*open|what time.*close|营业时间|營業時間|几点开|幾點開|waktu operasi/i;
const LOCATION_PATTERN = /where are you|location|address|branch|cawangan|alamat|在哪里|在哪裡|地址|分行/i;

function userMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function latestUserText(messages) {
  return String(userMessages(messages).at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|harga|berapa|sakit|cawangan|datang|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|cuti\s+umum|hari\s+kelepasan\s+am|postur|muka|herba)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function pricingNote(service, lang) {
  if (!service?.pricingNote) return "";
  if (lang === "zh") return " 中药费用会由中医师根据实际处方确认。";
  if (lang === "ms") return " Kos herba akan disahkan oleh pengamal TCM berdasarkan preskripsi sebenar.";
  return " Herbal medicine cost is confirmed by the practitioner based on the actual prescription.";
}

function priceReply(service, lang) {
  if (!service) return null;
  const price = String(service.priceRange || "").trim();
  if (!price || /not configured/i.test(price)) {
    if (lang === "zh") return `${service.name} 的价格目前没有配置在 demo 里，需要由 team 在评估后确认实际价格。`;
    if (lang === "ms") return `Harga ${service.name} belum dikonfigurasi dalam demo ini. Team perlu confirm harga sebenar selepas assessment.`;
    return `The price for ${service.name} is not configured in this demo. The team should confirm the actual price after assessment.`;
  }
  const base = lang === "zh"
    ? `${service.name} ${/^From\s+/i.test(price) ? `从 ${price.replace(/^From\s+/i, "")} 起` : `价格是 ${price}`}。`
    : lang === "ms"
      ? `${service.name} ${/^From\s+/i.test(price) ? `bermula dari ${price.replace(/^From\s+/i, "")}` : `berharga ${price}`}.`
      : `${service.name} ${/^From\s+/i.test(price) ? `starts from ${price.replace(/^From\s+/i, "")}` : `is ${price}`}.`;
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
    if (lang === "zh") return `好，记下 ${branch}。你比较方便 weekday 还是 weekend？`;
    if (lang === "ms") return `Okay, saya dah catat ${branch}. Weekday atau weekend lebih sesuai?`;
    return `Got it, ${branch}. Would a weekday or weekend suit you better?`;
  }
  const summary = [service?.name, branch, timing].filter(Boolean).join(" · ");
  if (lang === "zh") return `好，记下了 ${summary}。我帮你转给 TCM team，由他们确认实际 available time。 [[HANDOFF]]`;
  if (lang === "ms") return `Okay, saya dah catat ${summary}. Saya pass kepada team TCM untuk confirm masa yang available. [[HANDOFF]]`;
  return `Got it: ${summary}. I’ll pass these details to the TCM team so they can confirm the actual available time. [[HANDOFF]]`;
}

function preferenceReply(messages, service, lang) {
  const branch = branchFromMessages(messages);
  const timing = timingFromMessages(messages);
  const summary = [service?.name, branch, timing].filter(Boolean).join(" · ");
  if (lang === "zh") return `${summary ? `我先记下 ${summary}。` : ""}如果你决定要预约，再告诉我，我可以继续帮你整理预约资料。`;
  if (lang === "ms") return `${summary ? `Saya catat dulu ${summary}. ` : ""}Kalau anda decide nak book nanti, beritahu saya dan saya boleh bantu sambung proses appointment.`;
  return `${summary ? `I've noted ${summary}. ` : ""}If you decide to book, tell me and I can continue the appointment flow.`;
}

function serviceReply(service, lang) {
  const summary = String(service?.frontDeskSummary || service?.description || "").trim();
  if (summary) {
    if (lang === "zh") return `${service.name} 是这里提供的 TCM service 之一。${summary} 具体是否适合个人情况，需要由中医师进一步评估。`;
    if (lang === "ms") return `${service.name} ialah salah satu service TCM yang disediakan. ${summary} Pengamal TCM akan tentukan kesesuaian berdasarkan assessment individu.`;
    return `${service.name} is one of the configured TCM services. ${summary} A TCM practitioner should still confirm personal suitability after assessment.`;
  }
  if (lang === "zh") return `${service.name} 是这里提供的 TCM service 之一。具体是否适合个人情况，需要由中医师进一步了解后判断。`;
  if (lang === "ms") return `${service.name} ialah salah satu service TCM yang disediakan. Pengamal TCM akan tentukan kesesuaian berdasarkan keadaan individu.`;
  return `${service.name} is one of the configured TCM services. A TCM practitioner can confirm whether it is appropriate for an individual situation.`;
}

function buildTcmFallbackReply(messages) {
  const latest = latestUserText(messages);
  if (!latest) return "How can I help with your TCM enquiry?";
  const lang = languageFor(latest);
  const service = serviceForText(latest) || recentService(messages);

  if (HOURS_PATTERN.test(latest)) {
    if (lang === "zh") return `营业时间是 ${tcm.hours.general}。${tcm.hours.closed}。`;
    if (lang === "ms") return `Waktu operasi ialah ${tcm.hours.general}. ${tcm.hours.closed}.`;
    return `Our hours are ${tcm.hours.general}. ${tcm.hours.closed}.`;
  }

  if (LOCATION_PATTERN.test(latest) && !BOOKING.test(latest)) {
    const names = tcm.branches.map((branch) => branch.name).join(" and ");
    if (lang === "zh") return `目前有 ${names} 两个 branch。你比较方便哪一个？`;
    if (lang === "ms") return `Ada branch di ${names}. Yang mana lebih convenient untuk anda?`;
    return `There are branches in ${names}. Which is more convenient for you?`;
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

  if (lang === "zh") return "可以告诉我你主要想了解什么吗？我可以帮你看 TCM service、价格、branch 或预约流程。";
  if (lang === "ms") return "Boleh beritahu saya anda nak tanya tentang apa? Saya boleh bantu pasal service TCM, harga, branch atau appointment.";
  return "What would you like to know? I can help with TCM services, prices, branches or appointment enquiries.";
}

module.exports = { buildTcmFallbackReply, _test: { priceReply, schedulingInvite, languageFor, serviceReply } };

const clinic = require("./clinicConfig");

const PATTERNS = {
  negative: /not interested|no longer interested|never ?mind|don['’]t want|do not want|not booking|cancel(?: it| that| my appointment)?|no thanks|tak berminat|tidak berminat|tak nak|tidak mahu|tak jadi|tidak jadi|\bbatal\b|不要了|不想做|没兴趣|沒興趣|算了|取消|不预约|不預約/i,
  renewed: /\bprice\b|how much|\bcost\b|\bbook(?:ing)?\b|appointment|slot|interested|want to|hifu|pico|botox|botulinum|skin booster|rejuran|profhilo|harga|berapa|nak buat|berminat|预约|預約|多少钱|多少錢|想做|想了解/i,
  booking: /\bbook(?:ing)?\b|\bappointment\b|\bslot\b|available\s+(?:slot|appointment|time)|can\s+i\s+come|come\s+in|visit\s+(?:the\s+)?clinic|want\s+to\s+visit|want\s+to\s+do|arrange|nak\s+buat|mahu\s+buat|想做|\btempah\b|\btemujanji\b|janji\s+temu|ada\s+slot|boleh\s+datang|nak\s+datang|mahu\s+datang|预约|預約|约(?:个)?时间|約(?:個)?時間|有空位|可以来|可以來|想来|想來|来咨询|來諮詢/i,
  branch: /petaling jaya|\bpj\b|kuala lumpur|\bkl\b|bukit bintang|八打灵再也|八打靈再也|吉隆坡/i,
  timing: /weekend|saturday|sunday|weekday|monday|tuesday|wednesday|thursday|friday|morning|afternoon|evening|night|tomorrow|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|hujung minggu|sabtu|ahad|hari biasa|isnin|selasa|rabu|khamis|jumaat|pagi|petang|malam|esok|周末|週末|周六|週六|星期六|周日|週日|星期日|平日|工作日|星期一|星期二|星期三|星期四|星期五|早上|上午|下午|晚上|明天|\d{1,2}\s*[点點时時]/i,
  price: /\bprice\b|how much|\bcost\b|harga|berapa|多少钱|多少錢|价格|價格|价钱|價錢|收费|收費/i,
  human: /\bhuman\b|\bstaff\b|\bconsultant\b|speak\s+(?:to|with)|talk\s+(?:to|with)|see\s+(?:a\s+)?doctor|want\s+(?:a\s+)?doctor|真人|人工|转人工|轉人工|找医生|找醫生|医生回复|醫生回覆/i,
  complaint: /complain|complaint|refund|bad experience|unhappy|angry|投诉|投訴|退款|不满意|不滿意|aduan|refund|tak puas hati/i,
  emergency: /difficulty breathing|can['’]?t breathe|vision changes?|blurred vision|severe pain|worsening pain|spreading rash|blanching|skin discolou?r(?:ation)?|sesak nafas|susah bernafas|penglihatan|sakit teruk|semakin sakit|ruam merebak|呼吸困难|呼吸困難|视力|視力|剧痛|劇痛|越来越痛|越來越痛|扩散.*疹|擴散.*疹/i,
  contraindication: /pregnan|breastfeed|accutane|isotretinoin|blood thinner|antibiotic|medication|medicine|allerg|skin infection|open wound|cystic acne|recent (?:chemical )?peel|recent laser|hamil|menyusu|ubat|alerg|jangkitan kulit|luka terbuka|孕|怀孕|懷孕|哺乳|药|藥|过敏|過敏|感染|伤口|傷口|刚做.*(?:激光|雷射|换肤|換膚)/i,
  personalSuitability: /am i suitable|is it safe for me|suitable for me|sesuai (?:untuk )?saya|selamat untuk saya|适合我吗|適合我嗎|我适合|我適合/i,
  postTreatment: /after (?:my )?(?:hifu|pico|botox|skin booster|treatment|laser|injection)|post[- ]?treatment|lepas (?:buat|treatment|hifu|pico|botox)|selepas (?:rawatan|treatment)|做完(?:hifu|皮秒|肉毒|水光|治疗|治療)|术后|術後/i,
  symptom: /pain|swelling|rash|red|bruis|numb|burn|itch|sakit|bengkak|ruam|merah|lebam|kebas|pedih|gatal|痛|肿|腫|红|紅|淤青|麻|灼热|灼熱|痒|癢/i,
  photoAssessment: /(?:photo|picture|image|selfie).*(?:check|see|assess|suitable|recommend)|(?:check|see|assess|recommend).*(?:photo|picture|image|selfie)|照片.*(?:看|评估|評估|适合|適合|推荐|推薦)|gambar.*(?:check|tengok|nilai|sesuai|recommend)/i,
  demoQuestion: /is this (?:a )?real clinic|are you (?:a )?real clinic|real clinic|real appointment|real payment|actual contact|real contact|betul.*clinic|klinik.*betul|真实诊所|真實診所|真的诊所|真的診所|真实预约|真實預約|付款/i,
  sideEffects: /side effects?|reaction|risks?|kesan sampingan|risiko|副作用|风险|風險/i,
  painFaq: /is it painful|does it hurt|painful|sakit tak|sakit ke|痛吗|痛嗎|会痛|會痛/i,
  sessionFaq: /how many sessions|how many session|berapa kali|berapa session|几次|幾次|多少次/i,
  duration: /how long(?: does it take| is the treatment| does .* take)?|duration|berapa lama|多久|多长时间|多長時間|需要多久/i,
  downtime: /downtime|recovery time|recover|recovery|berapa hari.*recover|休息期|恢复期|恢復期|修复期|修復期/i,
  resultTiming: /when.*results?|how long.*results?|see results?|results?.*when|bila.*hasil|berapa lama.*hasil|多久.*效果|几时.*效果|幾時.*效果|什么时候.*效果|什麼時候.*效果/i,
  hours: /opening hours?|business hours?|what time.*open|what time.*close|open today|close today|营业时间|營業時間|几点开|幾點開|几点关|幾點關|pukul berapa.*buka|waktu operasi/i,
  location: /where are you|where.*branch|location|address|cawangan|alamat|在哪里|在哪裡|地址|分行/i,
  closerBranch: /which.*(?:branch)?.*closer|nearest branch|closer branch|cawangan.*dekat|哪.*(?:branch|分行)?.*近|哪个.*近|哪個.*近/i,
  consultation: /free consult|consultation|consult|咨询|諮詢|konsultasi/i,
  comparison: /\bvs\b|versus|difference|different|compare|better|cheaper|beza|mana lagi|区别|區別|比较|比較|哪个好|哪個好|哪个便宜|哪個便宜/i,
  promotion: /promo|promotion|offer|special|discount|deal|promosi|优惠|優惠|折扣|配套/i,
  walkIn: /walk[- ]?in|without appointment|datang terus|tak appointment|直接来|直接來|不预约.*来|不預約.*來/i,
  expensive: /too expensive|expensive|pricey|mahal|贵|貴|budget|预算|預算/i,
  hesitation: /let me think|need to think|think about it|consider first|ask my partner|ask my husband|ask my wife|fikir dulu|tanya.*partner|考虑一下|考慮一下|想一想|问.*家人|問.*家人/i,
  nervous: /scared|afraid|nervous|worried|takut|risau|害怕|担心|擔心/i,
  unconfiguredTreatment: /dermal filler|lip filler|nose filler|filler|thread lift|threadlift|microneedl|chemical peel|hydrafacial|facial|laser hair removal|hair removal|玻尿酸|填充|线雕|線雕|微针|微針|果酸|脱毛|脫毛/i,
};

const SERVICE_PATTERNS = [
  {
    key: "hifu",
    name: "HIFU Skin Lifting",
    pattern: /hifu|face lift|facelift|skin lifting|v[- ]?shape|double chin|jawline|ultrasound lifting|超声刀|超聲刀|音波拉提|双下巴|雙下巴|下颌线|下顎線/i,
  },
  {
    key: "pico",
    name: "Pico Laser",
    pattern: /pico|pigmentation|dark spots?|melasma|acne marks?|jeragat|bintik hitam|parut jerawat|皮秒|色斑|黑斑|痘印/i,
  },
  {
    key: "botox",
    name: "Botulinum Toxin",
    pattern: /botox|botulinum|anti[- ]?wrinkle|jaw slimming|wrinkles?|frown lines?|crow['’]?s feet|肉毒|瘦脸针|瘦臉針|皱纹|皺紋/i,
  },
  {
    key: "skinBooster",
    name: "Skin Booster",
    pattern: /skin ?booster|skinbooster|hydration|glass skin|rejuran|profhilo|水光针|水光針|丽珠兰|麗珠蘭|补水|補水/i,
  },
];

const SERVICE_FOCUS = {
  hifu: "lifting, tightening and jawline definition",
  pico: "pigmentation, uneven tone and selected acne marks",
  botox: "selected expression lines and muscle-related facial concerns",
  skinBooster: "hydration, texture and overall skin quality",
};

function userMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function latestUserText(messages) {
  return String(userMessages(messages).at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/\b(nak|boleh|harga|berapa|sakit|cawangan|alamat|saya|macam|sesuai|jeragat|pagi|petang|malam|hujung minggu|klinik|rawatan|mahal|takut|risau)\b/i.test(text)) return "ms";
  return "en";
}

function replyByLanguage(lang, options) {
  return options[lang] || options.en;
}

function latestMatch(messages, pattern) {
  return [...userMessages(messages)].reverse().find((message) => pattern.test(String(message.content || ""))) || null;
}

function detectBranch(messages) {
  const text = String(latestMatch(messages, PATTERNS.branch)?.content || "").toLowerCase();
  if (!text) return null;
  if (/petaling jaya|\bpj\b|八打灵再也|八打靈再也/i.test(text)) return "Petaling Jaya";
  if (/kuala lumpur|\bkl\b|bukit bintang|吉隆坡/i.test(text)) return "Kuala Lumpur";
  return null;
}

function detectTiming(messages) {
  const text = String(latestMatch(messages, PATTERNS.timing)?.content || "").toLowerCase();
  if (!text) return null;
  const parts = [];

  const dayChecks = [
    [/saturday|sabtu|周六|週六|星期六/i, "Saturday"],
    [/sunday|ahad|周日|週日|星期日/i, "Sunday"],
    [/monday|isnin|星期一|周一|週一/i, "Monday"],
    [/tuesday|selasa|星期二|周二|週二/i, "Tuesday"],
    [/wednesday|rabu|星期三|周三|週三/i, "Wednesday"],
    [/thursday|khamis|星期四|周四|週四/i, "Thursday"],
    [/friday|jumaat|星期五|周五|週五/i, "Friday"],
    [/weekend|hujung minggu|周末|週末/i, "weekend"],
    [/weekday|hari biasa|平日|工作日/i, "weekday"],
    [/tomorrow|esok|明天/i, "tomorrow"],
  ];
  for (const [pattern, label] of dayChecks) {
    if (pattern.test(text)) {
      parts.push(label);
      break;
    }
  }

  const exactTime = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i)?.[0];
  if (exactTime) parts.push(exactTime.toUpperCase().replace(/\s+/g, ""));
  else if (/morning|pagi|早上|上午/i.test(text)) parts.push("morning");
  else if (/afternoon|petang|下午/i.test(text)) parts.push("afternoon");
  else if (/evening|night|malam|晚上/i.test(text)) parts.push("evening");

  return parts.join(", ") || null;
}

function detectServices(text) {
  return SERVICE_PATTERNS.filter((service) => service.pattern.test(text));
}

function inferService(messages, latest) {
  const latestServices = detectServices(latest);
  if (latestServices.length) return latestServices[0];
  for (const message of [...userMessages(messages)].reverse()) {
    const services = detectServices(String(message.content || ""));
    if (services.length) return services[0];
  }
  return null;
}

function shortServiceName(service) {
  if (!service) return null;
  if (service.key === "hifu") return "HIFU";
  return service.name;
}

function configuredService(service) {
  if (!service) return null;
  return clinic.services.find((item) => item.name === service.name) || null;
}

function hadBookingConversation(messages, latest) {
  const allUserText = userMessages(messages).map((message) => String(message.content || "")).join("\n");
  if (PATTERNS.booking.test(allUserText)) return true;
  if ((PATTERNS.branch.test(latest) || PATTERNS.timing.test(latest)) && detectServices(latest).length) return true;
  if (!PATTERNS.branch.test(latest) && !PATTERNS.timing.test(latest)) return false;
  return (messages || []).some(
    (message) => message?.role === "assistant" && /which.*branch|weekday|weekend|morning|afternoon|confirm.*availability/i.test(String(message.content || ""))
  );
}

function reducedInterestIsActive(messages) {
  const users = userMessages(messages);
  let negativeIndex = -1;
  for (let index = users.length - 1; index >= 0; index -= 1) {
    if (PATTERNS.negative.test(String(users[index].content || ""))) {
      negativeIndex = index;
      break;
    }
  }
  if (negativeIndex < 0) return false;
  return !users.slice(negativeIndex + 1).some((message) => PATTERNS.renewed.test(String(message.content || "")));
}

function handoffReply(lang, kind = "general") {
  if (kind === "urgent") {
    return replyByLanguage(lang, {
      en: "That could need urgent medical attention. Please seek medical care now rather than waiting on chat, and I’ll flag this for the clinic team too. [[HANDOFF]]",
      ms: "Ini mungkin perlukan perhatian perubatan segera. Sila dapatkan rawatan sekarang dan jangan tunggu melalui chat; saya juga akan serahkan kepada team clinic. [[HANDOFF]]",
      zh: "这种情况可能需要尽快就医，请不要只等聊天回复，先寻求医疗帮助。我也会转给 clinic team 跟进。 [[HANDOFF]]",
    });
  }
  return replyByLanguage(lang, {
    en: "For this one, it’s better for the clinic team to advise you directly rather than me guessing from chat. I’ll pass it to them here. [[HANDOFF]]",
    ms: "Yang ini lebih baik team clinic advise terus daripada saya teka melalui chat. Saya pass kepada mereka ya. [[HANDOFF]]",
    zh: "这个情况比较适合让 clinic team 直接跟你确认，我不想在 chat 里乱判断。我帮你转给他们。 [[HANDOFF]]",
  });
}

function bookingReply(messages, lang) {
  const branch = detectBranch(messages);
  const timing = detectTiming(messages);
  const service = inferService(messages, latestUserText(messages));
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
  return replyByLanguage(lang, {
    en: `${name} starts from ${configured.priceRange.replace(/^From\s+/i, "")}.`,
    ms: `${name} bermula dari ${configured.priceRange.replace(/^From\s+/i, "")}.`,
    zh: `${name} 从 ${configured.priceRange.replace(/^From\s+/i, "")} 起。`,
  });
}

function serviceDurationSentence(service, lang) {
  const configured = configuredService(service);
  if (!configured) return "";
  const name = shortServiceName(service);
  return replyByLanguage(lang, {
    en: `${name} usually takes around ${configured.duration}.`,
    ms: `${name} biasanya ambil sekitar ${configured.duration}.`,
    zh: `${name} 一般大约需要 ${configured.duration}。`,
  });
}

function comfortSentence(service, lang) {
  const name = shortServiceName(service);
  return replyByLanguage(lang, {
    en: `${name ? `For ${name}, ` : ""}comfort varies from person to person, and the clinic team can explain what to expect before treatment.`,
    ms: `${name ? `Untuk ${name}, ` : ""}rasa sakit berbeza ikut individu, dan team clinic boleh explain apa yang biasanya boleh dijangka sebelum treatment.`,
    zh: `${name ? `${name} 的` : ""}舒适度会因人而异，clinic team 可以在 treatment 前说明一般会有什么感觉。`,
  });
}

function compoundBookingReply(messages, latest, lang) {
  const bookingActive = hadBookingConversation(messages, latest);
  if (!bookingActive || !(PATTERNS.booking.test(latest) || PATTERNS.branch.test(latest) || PATTERNS.timing.test(latest))) return null;
  const service = inferService(messages, latest);
  const directAnswers = [];
  if (PATTERNS.price.test(latest) && service) directAnswers.push(servicePriceSentence(service, lang));
  if (PATTERNS.painFaq.test(latest)) directAnswers.push(comfortSentence(service, lang));
  if (PATTERNS.duration.test(latest) && service) directAnswers.push(serviceDurationSentence(service, lang));
  if (!directAnswers.length) return null;
  directAnswers.push(bookingReply(messages, lang));
  return directAnswers.filter(Boolean).join(" ");
}

function comparisonReply(latest, lang) {
  const services = detectServices(latest);
  if (services.length < 2) return null;
  const [first, second] = services;
  const priceComparison = PATTERNS.price.test(latest) || /cheaper|便宜|murah/i.test(latest);

  if (priceComparison) {
    const firstPrice = servicePriceSentence(first, lang);
    const secondPrice = servicePriceSentence(second, lang);
    return replyByLanguage(lang, {
      en: `${firstPrice} ${secondPrice} They address different concerns, so the lower price isn’t necessarily an equivalent alternative.`,
      ms: `${firstPrice} ${secondPrice} Dua treatment ni target concern yang berbeza, jadi yang lebih murah tak semestinya option yang sama.`,
      zh: `${firstPrice}${secondPrice} 两个 treatment 针对的问题不一样，所以价格较低的不一定是同类替代。`,
    });
  }

  return replyByLanguage(lang, {
    en: `${shortServiceName(first)} focuses more on ${SERVICE_FOCUS[first.key]}, while ${shortServiceName(second)} focuses more on ${SERVICE_FOCUS[second.key]}. A clinician can confirm which direction fits your goal after assessment.`,
    ms: `${shortServiceName(first)} lebih fokus pada ${SERVICE_FOCUS[first.key]}, manakala ${shortServiceName(second)} lebih kepada ${SERVICE_FOCUS[second.key]}. Clinician boleh confirm direction yang lebih sesuai lepas assessment.`,
    zh: `${shortServiceName(first)} 比较偏向 ${SERVICE_FOCUS[first.key]}，而 ${shortServiceName(second)} 比较偏向 ${SERVICE_FOCUS[second.key]}。最终适合哪个方向，需要 clinician assessment 后确认。`,
  });
}

function serviceReply(service, latest, lang) {
  const alreadySpecificConcern = /double chin|jawline|pigmentation|dark spots?|melasma|acne marks?|wrinkles?|glass skin|hydration|双下巴|雙下巴|色斑|痘印|皱纹|皺紋|jeragat|parut jerawat/i.test(latest);
  const priceAsked = PATTERNS.price.test(latest);

  const replies = {
    hifu: {
      en: `${priceAsked ? "HIFU starts from RM 888. " : "HIFU is "}commonly used for lifting, tightening and jawline definition, and usually takes around 45–75 minutes.${alreadySpecificConcern ? "" : " Which area are you looking at?"}`,
      ms: `${priceAsked ? "HIFU bermula dari RM 888. " : "HIFU "}biasanya digunakan untuk lifting, tightening dan jawline definition, sekitar 45–75 minit.${alreadySpecificConcern ? "" : " Concern area you mana?"}`,
      zh: `${priceAsked ? "HIFU 从 RM 888 起。" : "HIFU "}一般会用于提升、紧致和 jawline，时间大约 45–75 分钟。${alreadySpecificConcern ? "" : "你主要想改善哪个部位？"}`,
    },
    pico: {
      en: `${priceAsked ? "Pico Laser starts from RM 388. " : "Pico Laser is "}commonly used for pigmentation, uneven tone and selected acne marks, and usually takes around 20–40 minutes.${alreadySpecificConcern ? "" : " What’s the main skin concern you’re looking at?"}`,
      ms: `${priceAsked ? "Pico Laser bermula dari RM 388. " : "Pico Laser "}biasanya untuk pigmentation, uneven tone dan sesetengah acne marks, sekitar 20–40 minit.${alreadySpecificConcern ? "" : " Main skin concern you apa?"}`,
      zh: `${priceAsked ? "Pico Laser 从 RM 388 起。" : "Pico Laser "}一般用于色素、肤色不均和部分痘印，时间大约 20–40 分钟。${alreadySpecificConcern ? "" : "你主要在意哪一种 skin concern？"}`,
    },
    botox: {
      en: `${priceAsked ? "Botulinum Toxin pricing is confirmed after consultation because it depends on the area and units needed. " : "Botulinum Toxin is "}used for selected expression lines and muscle-related facial concerns, and usually takes around 15–30 minutes.`,
      ms: `${priceAsked ? "Harga Botulinum Toxin akan confirm selepas consultation sebab bergantung pada area dan units yang diperlukan. " : "Botulinum Toxin "}biasa digunakan untuk expression lines tertentu dan concern berkaitan muscle, sekitar 15–30 minit.`,
      zh: `${priceAsked ? "Botulinum Toxin 的价格需要 consultation 后确认，因为会看部位和所需 units。" : "Botulinum Toxin "}一般用于部分表情纹和肌肉相关的面部问题，时间大约 15–30 分钟。`,
    },
    skinBooster: {
      en: `${priceAsked ? "Skin Booster starts from RM 688. " : "Skin Booster is "}generally used to support hydration, texture and overall skin quality, and usually takes around 30–45 minutes.`,
      ms: `${priceAsked ? "Skin Booster bermula dari RM 688. " : "Skin Booster "}biasanya untuk hydration, texture dan overall skin quality, sekitar 30–45 minit.`,
      zh: `${priceAsked ? "Skin Booster 从 RM 688 起。" : "Skin Booster "}一般用于补水、肤质和整体 skin quality，时间大约 30–45 分钟。`,
    },
  };
  return replyByLanguage(lang, replies[service.key]);
}

function generalPriceReply(lang) {
  return replyByLanguage(lang, {
    en: "HIFU starts from RM 888, Pico Laser from RM 388, and Skin Booster from RM 688. Botulinum Toxin pricing depends on the treatment area and units needed.",
    ms: "HIFU bermula RM 888, Pico Laser RM 388, dan Skin Booster RM 688. Harga Botulinum Toxin bergantung pada area dan units yang diperlukan.",
    zh: "HIFU 从 RM 888 起，Pico Laser 从 RM 388 起，Skin Booster 从 RM 688 起。Botulinum Toxin 会根据部位和所需 units 来报价。",
  });
}

function promotionReply(lang) {
  return replyByLanguage(lang, {
    en: "The current HIFU Lifting Special is HIFU from RM 888 with a complimentary consultation. There isn’t a set expiry date listed at the moment.",
    ms: "Promo HIFU sekarang ialah HIFU dari RM 888 dengan complimentary consultation. Buat masa ini tiada expiry date yang ditetapkan.",
    zh: "目前的 HIFU Lifting Special 是 HIFU 从 RM 888 起，并包含免费 consultation。目前没有设定截止日期。",
  });
}

function buildFallbackReply(messages) {
  const latest = latestUserText(messages);
  const lang = languageFor(latest);
  const lower = latest.toLowerCase();

  if (!latest) {
    return replyByLanguage(lang, {
      en: "What would you like to know?",
      ms: "You nak tanya pasal apa?",
      zh: "你想了解哪一方面？",
    });
  }

  if (PATTERNS.emergency.test(latest)) return handoffReply(lang, "urgent");
  if (PATTERNS.contraindication.test(latest) || PATTERNS.personalSuitability.test(latest)) return handoffReply(lang);
  if (PATTERNS.postTreatment.test(latest) && PATTERNS.symptom.test(latest)) return handoffReply(lang);
  if (PATTERNS.photoAssessment.test(latest)) return handoffReply(lang);
  if (PATTERNS.human.test(latest) || PATTERNS.complaint.test(latest)) return handoffReply(lang);

  if (PATTERNS.demoQuestion.test(latest)) {
    return replyByLanguage(lang, {
      en: "This is a software demo using fictional clinic sample data, so it can’t take a real payment or create a real appointment.",
      ms: "Ini ialah software demo dengan data clinic rekaan, jadi ia tak boleh ambil real payment atau buat real appointment.",
      zh: "这是软件 demo，使用的是虚构 clinic sample data，所以不能收取真实付款或建立真实预约。",
    });
  }

  if (PATTERNS.negative.test(latest)) {
    return replyByLanguage(lang, {
      en: "No problem. If you want to ask anything later, just message again.",
      ms: "No problem. Kalau nanti nak tanya apa-apa, message je ya.",
      zh: "没问题，之后想再了解的话随时 message 就可以。",
    });
  }

  const service = inferService(messages, latest);

  if (PATTERNS.expensive.test(latest)) {
    const price = service ? servicePriceSentence(service, lang) : "";
    return replyByLanguage(lang, {
      en: `${price ? `${price} ` : ""}I understand the budget concern. There isn’t another discount I can confirm here, and the consultation is complimentary if you want to understand the options before deciding. No pressure.`,
      ms: `${price ? `${price} ` : ""}Faham pasal budget concern tu. Tak ada discount lain yang saya boleh confirm di sini, dan consultation adalah complimentary kalau you nak faham option dulu sebelum decide. No pressure.`,
      zh: `${price ? `${price}` : ""}预算方面可以理解。目前没有其他我能确认的折扣，不过 consultation 是免费的，你可以先了解清楚再决定，不用急。`,
    });
  }

  if (PATTERNS.hesitation.test(latest)) {
    return replyByLanguage(lang, {
      en: "Of course, no pressure. Take your time — if anything is unclear later, you can just continue from here.",
      ms: "Boleh, no pressure. Take your time dulu — kalau nanti ada apa-apa yang tak clear, sambung je chat ni.",
      zh: "当然，可以慢慢考虑，不用急。之后有哪里不清楚，直接继续这个 chat 就可以。",
    });
  }

  if (PATTERNS.nervous.test(latest)) {
    return replyByLanguage(lang, {
      en: `${service ? `It’s understandable to feel nervous about ${shortServiceName(service)}. ` : ""}${comfortSentence(service, lang)}`,
      ms: `${service ? `Kalau rasa risau pasal ${shortServiceName(service)}, memang normal. ` : ""}${comfortSentence(service, lang)}`,
      zh: `${service ? `对 ${shortServiceName(service)} 有点担心很正常。` : ""}${comfortSentence(service, lang)}`,
    });
  }

  const compound = compoundBookingReply(messages, latest, lang);
  if (compound) return compound;

  const bookingActive = hadBookingConversation(messages, latest);
  if (bookingActive && (PATTERNS.booking.test(latest) || PATTERNS.branch.test(latest) || PATTERNS.timing.test(latest))) {
    return bookingReply(messages, lang);
  }

  if (PATTERNS.comparison.test(latest)) {
    const comparison = comparisonReply(latest, lang);
    if (comparison) return comparison;
  }

  if (PATTERNS.promotion.test(latest)) return promotionReply(lang);

  if (PATTERNS.hours.test(latest)) {
    return replyByLanguage(lang, {
      en: `We’re open ${clinic.hours.general}. ${clinic.hours.closed}.`,
      ms: `Waktu operasi: ${clinic.hours.general}. ${clinic.hours.closed}.`,
      zh: `营业时间是 ${clinic.hours.general}。${clinic.hours.closed}。`,
    });
  }

  if (PATTERNS.closerBranch.test(latest)) {
    return replyByLanguage(lang, {
      en: "We have Kuala Lumpur (Bukit Bintang) and Petaling Jaya. I don’t want to guess which is nearer without knowing where you’re coming from — which area are you in?",
      ms: "Ada Kuala Lumpur (Bukit Bintang) dan Petaling Jaya. Saya tak nak teka branch mana lebih dekat tanpa tahu you datang dari area mana — you area mana?",
      zh: "我们有 Kuala Lumpur（Bukit Bintang）和 Petaling Jaya 两个 branch。我不想在不知道你从哪里出发的情况下乱猜，方便告诉我你在哪个 area 吗？",
    });
  }

  if (PATTERNS.location.test(latest)) {
    const branches = clinic.branches.map((branch) => `${branch.name}: ${branch.address}`).join(" | ");
    return replyByLanguage(lang, {
      en: `We have two locations: ${branches}.`,
      ms: `Ada dua location: ${branches}.`,
      zh: `目前有两个 location：${branches}。`,
    });
  }

  if (PATTERNS.walkIn.test(latest)) {
    return replyByLanguage(lang, {
      en: "Appointments are recommended so the team can allocate enough time for you. If you want to come in, I can help collect your preferred branch and timing for the team to confirm.",
      ms: "Appointment lebih recommended supaya team boleh allocate masa yang cukup. Kalau you nak datang, saya boleh ambil preferred branch dan timing untuk team confirm.",
      zh: "比较建议先预约，这样 team 可以预留足够时间。如果你想来，我可以先帮你记录 branch 和时间偏好，再让 team 确认。",
    });
  }

  if (PATTERNS.consultation.test(latest)) {
    return replyByLanguage(lang, {
      en: "Yes, the consultation is complimentary. The clinician can use it to understand your goals and discuss suitable options before you decide anything.",
      ms: "Ya, consultation adalah complimentary. Clinician boleh faham goal you dulu dan discuss option yang sesuai sebelum you decide apa-apa.",
      zh: "有，consultation 是免费的。Clinician 会先了解你的目标，再讨论适合的方向，你不需要马上决定做 treatment。",
    });
  }

  if (PATTERNS.duration.test(latest) && service) return serviceDurationSentence(service, lang);

  if (PATTERNS.painFaq.test(latest)) return comfortSentence(service, lang);

  if (PATTERNS.sessionFaq.test(latest)) {
    const name = shortServiceName(service);
    return replyByLanguage(lang, {
      en: `${name ? `For ${name}, ` : ""}the number of sessions depends on your goals and assessment, so I don’t want to guess a fixed number.`,
      ms: `${name ? `Untuk ${name}, ` : ""}berapa session bergantung pada goal dan assessment, jadi saya tak nak teka fixed number.`,
      zh: `${name ? `${name} 的` : ""}次数会看你的目标和 assessment，所以我不想直接猜一个固定次数。`,
    });
  }

  if (PATTERNS.sideEffects.test(latest)) {
    const name = shortServiceName(service);
    return replyByLanguage(lang, {
      en: `${name ? `For ${name}, ` : ""}reactions can vary by treatment and by person. The clinician can explain what to expect and what would need attention before you proceed.`,
      ms: `${name ? `Untuk ${name}, ` : ""}reaction boleh berbeza ikut treatment dan individu. Clinician boleh explain apa yang biasa dijangka dan apa yang perlu diberi perhatian sebelum proceed.`,
      zh: `${name ? `${name} 的` : ""}反应会因 treatment 和个人而不同。Clinician 可以在进行前说明一般会出现什么情况，以及哪些情况需要注意。`,
    });
  }

  if ((PATTERNS.downtime.test(latest) || PATTERNS.resultTiming.test(latest)) && service) {
    const name = shortServiceName(service);
    return replyByLanguage(lang, {
      en: `${name} can vary from person to person, and I don’t have a fixed ${PATTERNS.downtime.test(latest) ? "downtime" : "result-timing"} number to quote. The clinic team can explain what to expect for your case.`,
      ms: `${name} boleh berbeza ikut individu, dan saya tak ada fixed ${PATTERNS.downtime.test(latest) ? "downtime" : "result timing"} untuk quote. Team clinic boleh explain expectation ikut keadaan you.`,
      zh: `${name} 会因人而异，我这里没有一个固定的${PATTERNS.downtime.test(latest) ? "恢复期" : "见效时间"}可以直接报给你。Clinic team 可以根据你的情况说明一般预期。`,
    });
  }

  if (service && (service.pattern.test(latest) || PATTERNS.price.test(latest) || /how.*work|what.*do|for what|效果|作用|fungsi|untuk apa/i.test(latest))) {
    return serviceReply(service, latest, lang);
  }

  if (PATTERNS.price.test(latest)) return generalPriceReply(lang);

  if (PATTERNS.unconfiguredTreatment.test(latest)) {
    return replyByLanguage(lang, {
      en: "I don’t have confirmed details for that treatment here. I can help with HIFU, Pico Laser, Botulinum Toxin or Skin Booster, or pass your question to the clinic team.",
      ms: "Saya tak ada confirmed details untuk treatment tu di sini. Saya boleh bantu untuk HIFU, Pico Laser, Botulinum Toxin atau Skin Booster, atau pass soalan you kepada team clinic.",
      zh: "我这里没有这个 treatment 的确认资料。我可以帮你了解 HIFU、Pico Laser、Botulinum Toxin 或 Skin Booster，也可以把你的问题转给 clinic team。",
    });
  }

  if (reducedInterestIsActive(messages)) {
    return replyByLanguage(lang, {
      en: "Sure. What would you like to ask?",
      ms: "Boleh. You nak tanya apa?",
      zh: "可以，你想问什么？",
    });
  }

  if (/^(hi|hello|hey|你好|嗨|halo|hai)[!. ]*$/i.test(lower)) {
    return replyByLanguage(lang, {
      en: "What would you like to know about?",
      ms: "You nak tahu pasal apa?",
      zh: "你想了解什么呢？",
    });
  }

  return replyByLanguage(lang, {
    en: `Tell me what you’re looking at — a treatment, price, skin/face concern or booking question. ${clinic.consultation} is available if you need a clinician to assess it properly.`,
    ms: `You boleh bagitahu treatment, harga, concern atau booking question yang you nak tanya. ${clinic.consultation} juga available kalau perlukan clinician assess dengan betul.`,
    zh: `你可以告诉我想了解的 treatment、价格、在意的问题或预约需求。如果需要 clinician 进一步 assessment，${clinic.consultation} 也有提供。`,
  });
}

module.exports = {
  buildFallbackReply,
  _test: {
    languageFor,
    detectBranch,
    detectTiming,
    detectServices,
    inferService,
    hadBookingConversation,
    reducedInterestIsActive,
    compoundBookingReply,
  },
};

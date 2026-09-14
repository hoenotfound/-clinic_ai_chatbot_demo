const URGENT_PATTERN = /difficulty breathing|can['’]?t breathe|shortness of breath|chest pain|faint(?:ed|ing)?|severe bleeding|sudden weakness|face droop|slurred speech|severe pain|rapidly worsening|sesak nafas|susah bernafas|sakit dada|pengsan|pendarahan teruk|semakin teruk|呼吸困难|呼吸困難|胸痛|昏倒|大量出血|突然无力|突然無力|口齿不清|口齒不清|剧痛|劇痛|越来越严重|越來越嚴重/i;
const HUMAN_PATTERN = /\bhuman\b|\bstaff\b|\bpractitioner\b|\bdoctor\b|speak\s+(?:to|with)|talk\s+(?:to|with)|真人|人工|转人工|轉人工|找医师|找醫師|找医生|找醫生|中医师|中醫師/i;
const COMPLAINT_PATTERN = /complain|complaint|refund|bad experience|unhappy|angry|投诉|投訴|退款|不满意|不滿意|aduan|tak puas hati/i;
const MEDICATION_PATTERN = /medication|prescription|regular\s+medicine|current\s+medicine|my\s+medicine|taking\s+(?:a\s+)?medicine|blood thinner|anticoagul|warfarin|aspirin|ubat|ubat cair darah|处方药|處方藥|正在吃药|正在吃藥|服药|服藥|药物|藥物|抗凝|薄血/i;
const HERBAL_PATTERN = /herb|herbal|chinese medicine|中药|中藥|草药|草藥|药方|藥方|方剂|方劑/i;
const PREGNANCY_PATTERN = /pregnan|breastfeed|hamil|menyusu|怀孕|懷孕|哺乳/i;
const PERSONAL_SUITABILITY_PATTERN = /am i suitable|is it safe for me|can i do acupuncture|can i do cupping|what should i take|what herbs should i take|what do i have|what condition do i have|diagnos|can i take\s+(?:this|these|the)?\s*(?:herb|herbs|formula|medicine|medication|supplement)|sesuai (?:untuk )?saya|selamat untuk saya|boleh saya buat|ubat apa|herba apa|适合我吗|適合我嗎|我适合|我適合|我可以做针灸吗|我可以做針灸嗎|我可以拔罐吗|我可以拔罐嗎|我应该吃什么中药|我應該吃什麼中藥|我是什么病|我是什麼病/i;
const POST_TREATMENT_PATTERN = /after (?:my )?(?:acupuncture|cupping|gua sha|tuina|treatment)|after taking (?:the )?herbs|post[- ]?treatment|selepas (?:akupunktur|rawatan)|lepas (?:akupunktur|rawatan)|针灸后|針灸後|拔罐后|拔罐後|刮痧后|刮痧後|推拿后|推拿後|吃了中药|吃了中藥/i;

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|ubat|hamil|menyusu|sakit|rawatan|doktor|pengamal)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function reply(lang, options) {
  return options[lang] || options.en;
}

function urgentReply(lang) {
  return reply(lang, {
    en: "That could need urgent medical attention. Please seek appropriate medical care now rather than waiting on this chat. I’ll also flag the conversation for the team. [[HANDOFF]]",
    ms: "Keadaan ini mungkin perlukan perhatian perubatan segera. Sila dapatkan rawatan yang sesuai sekarang dan jangan tunggu melalui chat. Saya juga akan serahkan conversation ini kepada team. [[HANDOFF]]",
    zh: "这种情况可能需要尽快接受医疗评估，请不要只等聊天回复，先寻求适当的医疗帮助。我也会把对话转给团队跟进。 [[HANDOFF]]",
  });
}

function practitionerReply(lang) {
  return reply(lang, {
    en: "This needs personalised advice from the TCM practitioner rather than a guess from chat. I’ll pass the conversation to the team so they can advise you directly. [[HANDOFF]]",
    ms: "Yang ini perlukan nasihat peribadi daripada pengamal TCM, jadi saya tak patut teka melalui chat. Saya pass conversation ini kepada team untuk sambung dengan anda. [[HANDOFF]]",
    zh: "这个问题需要中医师根据你的个人情况判断，我不适合在聊天里直接下结论。我帮你把对话转给团队继续跟进。 [[HANDOFF]]",
  });
}

function humanReply(lang) {
  return reply(lang, {
    en: "Sure, I’ll pass this conversation to the TCM team so they can continue with you here. [[HANDOFF]]",
    ms: "Boleh, saya pass conversation ini kepada team TCM supaya mereka boleh sambung dengan anda di sini. [[HANDOFF]]",
    zh: "可以，我帮你把这个对话转给 TCM team，让他们直接继续跟你聊。 [[HANDOFF]]",
  });
}

function enforceTcmSafetyRules(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;
  const lang = languageFor(latest);

  if (URGENT_PATTERN.test(latest)) return urgentReply(lang);
  if (HUMAN_PATTERN.test(latest) || COMPLAINT_PATTERN.test(latest)) return humanReply(lang);

  const herbInteraction = HERBAL_PATTERN.test(latest) && MEDICATION_PATTERN.test(latest);
  if (
    herbInteraction ||
    PREGNANCY_PATTERN.test(latest) ||
    PERSONAL_SUITABILITY_PATTERN.test(latest) ||
    POST_TREATMENT_PATTERN.test(latest)
  ) {
    return practitionerReply(lang);
  }

  return null;
}

module.exports = {
  enforceTcmSafetyRules,
  _test: {
    URGENT_PATTERN,
    HUMAN_PATTERN,
    COMPLAINT_PATTERN,
    MEDICATION_PATTERN,
    HERBAL_PATTERN,
    PREGNANCY_PATTERN,
    PERSONAL_SUITABILITY_PATTERN,
    POST_TREATMENT_PATTERN,
  },
};

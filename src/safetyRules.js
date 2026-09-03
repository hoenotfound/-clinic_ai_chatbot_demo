const URGENT_PATTERN = /difficulty breathing|can['’]?t breathe|shortness of breath|vision changes?|blurred vision|severe pain|worsening pain|spreading rash|blanching|skin discolou?r(?:ation)?|sesak nafas|susah bernafas|penglihatan|sakit teruk|semakin sakit|ruam merebak|呼吸困难|呼吸困難|视力|視力|剧痛|劇痛|越来越痛|越來越痛|扩散.*疹|擴散.*疹/i;
const CONTRAINDICATION_PATTERN = /pregnan|breastfeed|accutane|isotretinoin|blood thinner|antibiotic|medication|medicine|allerg|skin infection|open wound|cystic acne|recent (?:chemical )?peel|recent laser|hamil|menyusu|ubat|alerg|jangkitan kulit|luka terbuka|孕|怀孕|懷孕|哺乳|药|藥|过敏|過敏|感染|伤口|傷口|刚做.*(?:激光|雷射|换肤|換膚)/i;
const STRONG_SUITABILITY_PATTERN = /am i suitable|is (?:this|it) safe for me|would .* suit me|suitable for me|sesuai (?:untuk )?saya|selamat untuk saya|适合我吗|適合我嗎|我适合|我適合/i;
const AMBIGUOUS_CAN_DO_PATTERN = /can i do (?:this|hifu|pico|botox|botulinum|skin booster)|boleh saya buat(?:\s+(?:hifu|pico|botox|skin booster))?|我可以做(?:hifu|pico|肉毒|皮秒|水光)?吗|我可以做(?:hifu|pico|肉毒|皮秒|水光)?嗎/i;
const SCHEDULING_CUE_PATTERN = /\bbook(?:ing)?\b|appointment|slot|available|come|visit|arrange|\bpj\b|\bkl\b|petaling jaya|kuala lumpur|today|tomorrow|weekday|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|tempah|temujanji|datang|hari ini|esok|hari biasa|hujung minggu|isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|pagi|petang|malam|预约|預約|有空位|想来|想來|今天|明天|平日|周末|週末|星期[一二三四五六日]|周[一二三四五六日]|週[一二三四五六日]|早上|上午|下午|晚上/i;
const POST_TREATMENT_PATTERN = /after (?:my )?(?:hifu|pico|botox|botulinum|skin booster|treatment|laser|injection)|post[- ]?treatment|after treatment|lepas (?:buat|treatment|hifu|pico|botox)|selepas (?:rawatan|treatment)|做完(?:hifu|皮秒|肉毒|水光|治疗|治療)|术后|術後/i;
const PHOTO_ASSESSMENT_PATTERN = /(?:photo|picture|image|selfie).*(?:check|see|assess|suitable|recommend|which treatment)|(?:check|see|assess|recommend|which treatment).*(?:photo|picture|image|selfie)|照片.*(?:看|评估|評估|适合|適合|推荐|推薦)|gambar.*(?:check|tengok|nilai|sesuai|recommend)/i;
const HUMAN_PATTERN = /\bhuman\b|\bstaff\b|\bconsultant\b|speak\s+(?:to|with)|talk\s+(?:to|with)|see\s+(?:a\s+)?doctor|want\s+(?:a\s+)?doctor|真人|人工|转人工|轉人工|找医生|找醫生|医生回复|醫生回覆/i;
const COMPLAINT_PATTERN = /complain|complaint|refund|bad experience|unhappy|angry|投诉|投訴|退款|不满意|不滿意|aduan|tak puas hati/i;

function latestUserText(messages) {
  return String((messages || []).filter((message) => message?.role === "user").at(-1)?.content || "").trim();
}

function languageFor(text) {
  if (/\p{Script=Han}/u.test(String(text || ""))) return "zh";
  if (/\b(saya|nak|boleh|klinik|ubat|hamil|menyusu|sakit|doktor|rawatan)\b/i.test(String(text || ""))) return "ms";
  return "en";
}

function replyByLanguage(lang, messages) {
  return messages[lang] || messages.en;
}

function urgentReply(lang) {
  return replyByLanguage(lang, {
    en: "That could need urgent medical attention. Please seek medical care now rather than waiting on chat, and I’ll flag this for the clinic team too. [[HANDOFF]]",
    ms: "Ini mungkin perlukan perhatian perubatan segera. Sila dapatkan rawatan sekarang dan jangan tunggu melalui chat; saya juga akan serahkan kepada team clinic. [[HANDOFF]]",
    zh: "这种情况可能需要尽快就医，请不要只等聊天回复，先寻求医疗帮助。我也会转给 clinic team 跟进。 [[HANDOFF]]",
  });
}

function clinicalHandoffReply(lang) {
  return replyByLanguage(lang, {
    en: "For this one, it’s better for the clinic team or clinician to advise you directly rather than me guessing from chat. I’ll pass it to them here. [[HANDOFF]]",
    ms: "Yang ini lebih baik team clinic atau clinician advise terus daripada saya teka melalui chat. Saya pass kepada mereka ya. [[HANDOFF]]",
    zh: "这个情况比较适合让 clinic team 或 clinician 直接跟你确认，我不想在 chat 里乱判断。我帮你转给他们。 [[HANDOFF]]",
  });
}

function humanHandoffReply(lang) {
  return replyByLanguage(lang, {
    en: "Sure, I’ll pass this conversation to the clinic team so they can continue with you here. [[HANDOFF]]",
    ms: "Boleh, saya pass conversation ini kepada team clinic supaya mereka boleh continue dengan you di sini. [[HANDOFF]]",
    zh: "可以，我帮你把这个 conversation 转给 clinic team，让他们直接继续跟你聊。 [[HANDOFF]]",
  });
}

function isPersonalSuitabilityQuestion(text) {
  if (STRONG_SUITABILITY_PATTERN.test(text)) return true;
  if (!AMBIGUOUS_CAN_DO_PATTERN.test(text)) return false;
  // "Can I do HIFU?" is a suitability question. "Can I do HIFU Saturday at PJ?"
  // is normally appointment intent and should stay in the booking flow.
  return !SCHEDULING_CUE_PATTERN.test(text);
}

function enforceSafetyRules(messages) {
  const latest = latestUserText(messages);
  if (!latest) return null;
  const lang = languageFor(latest);

  if (URGENT_PATTERN.test(latest)) return urgentReply(lang);
  if (HUMAN_PATTERN.test(latest) || COMPLAINT_PATTERN.test(latest)) return humanHandoffReply(lang);
  if (
    CONTRAINDICATION_PATTERN.test(latest) ||
    isPersonalSuitabilityQuestion(latest) ||
    POST_TREATMENT_PATTERN.test(latest) ||
    PHOTO_ASSESSMENT_PATTERN.test(latest)
  ) {
    return clinicalHandoffReply(lang);
  }
  return null;
}

module.exports = {
  enforceSafetyRules,
  _test: {
    URGENT_PATTERN,
    CONTRAINDICATION_PATTERN,
    STRONG_SUITABILITY_PATTERN,
    AMBIGUOUS_CAN_DO_PATTERN,
    SCHEDULING_CUE_PATTERN,
    POST_TREATMENT_PATTERN,
    PHOTO_ASSESSMENT_PATTERN,
    isPersonalSuitabilityQuestion,
  },
};

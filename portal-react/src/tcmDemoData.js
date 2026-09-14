export const STAGES = [
  { id: 1, key: "new", name: "New Enquiry", color: "#87968e" },
  { id: 2, key: "interested", name: "Qualified", color: "#d8a34e" },
  { id: 3, key: "appointment", name: "Appointment Requested", color: "#4f7c72" },
  { id: 4, key: "confirmed", name: "Appointment Confirmed", color: "#2f6f62" },
  { id: 5, key: "visited", name: "Visited", color: "#6a8293" },
  { id: 6, key: "won", name: "Won", color: "#2f7d4e" },
];

const now = Date.now();
const isoAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

export const SAMPLE_LEADS = [
  {
    id: 201, name: "Michelle Tan", channel: "whatsapp", phone: "+60 12-*** 2218", language: "EN",
    treatment: "Acupuncture", temperature: "hot", stage: "appointment", branch: "Kuala Lumpur", timing: "Saturday afternoon",
    value: 240, owner: "Li Wen", source: "Meta Ads", attention: true, unread: true, followUp: false, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(7),
    summary: "Asked about acupuncture for recurring shoulder and neck tightness. Prefers Kuala Lumpur on Saturday afternoon and wants to arrange a visit.",
    messages: [
      ["user", "Hi, how much is acupuncture? My shoulder and neck have been quite tight lately.", 14],
      ["assistant", "Acupuncture starts from RM80. For shoulder and neck tightness, acupuncture and Tuina are services the centre commonly discusses, but the practitioner would still need to understand your situation first.", 13],
      ["user", "KL is easier. Saturday afternoon can?", 8],
      ["assistant", "Got it: Acupuncture · Kuala Lumpur · Saturday afternoon. I’ll pass these details to the TCM team so they can confirm the actual available time.", 7],
    ],
  },
  {
    id: 202, name: "陈佳怡 Jia Yi", channel: "instagram", phone: "@jiayi.demo", language: "中文",
    treatment: "Tuina", temperature: "warm", stage: "interested", branch: "Petaling Jaya", timing: "Weekend",
    value: 180, owner: "Aina", source: "Organic", attention: false, unread: true, followUp: true, noReply: true,
    reschedule: false, cancelled: false, overdue: true, lastAt: isoAgo(35),
    summary: "询问肩颈紧绷和推拿价格，PJ 比较方便，周末有空，但还没有确定预约。",
    messages: [
      ["user", "最近肩颈很紧，请问推拿多少钱？", 43],
      ["assistant", "Tuina 从 RM90 起。肩颈紧绷这类情况，Tuina 和 Acupuncture 都是这里常见会讨论的服务方向。", 42],
      ["user", "PJ比较方便，我通常周末有空，先了解一下。", 35],
    ],
  },
  {
    id: 203, name: "Nur Aisyah", channel: "whatsapp", phone: "+60 11-*** 4102", language: "BM",
    treatment: "Acupuncture", temperature: "hot", stage: "confirmed", branch: "Petaling Jaya", timing: "Saturday morning",
    value: 260, owner: "Li Wen", source: "Referral", attention: false, unread: false, followUp: false, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(80),
    summary: "Berminat dengan akupunktur dan appointment PJ pada Sabtu pagi sudah disahkan oleh team.",
    messages: [
      ["user", "Hi, akupunktur harga berapa? Saya selalu free Sabtu pagi.", 92],
      ["assistant", "Acupuncture bermula RM80. Branch mana lebih convenient untuk anda, KL atau PJ?", 91],
      ["user", "PJ.", 88],
      ["assistant", "Okay, saya dah catat Acupuncture · Petaling Jaya · Saturday morning. Team TCM akan confirm masa yang available.", 87],
      ["staff", "Hi Aisyah, Sabtu 11:00 pagi di PJ sudah confirmed untuk demo ini.", 80],
    ],
  },
  {
    id: 204, name: "Daniel Wong", channel: "facebook", phone: "Messenger profile", language: "EN",
    treatment: "Cupping", temperature: "cold", stage: "new", branch: "Kuala Lumpur", timing: "Not specified",
    value: 120, owner: "Unassigned", source: "Organic", attention: false, unread: true, followUp: false, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(150),
    summary: "Asked about cupping price and duration. No appointment intent yet.",
    messages: [
      ["user", "Do you provide cupping? How much and how long?", 155],
      ["assistant", "Yes. Cupping starts from RM60 and the configured demo duration is around 20–30 minutes.", 154],
      ["user", "Okay, just checking first.", 150],
    ],
  },
  {
    id: 205, name: "林美玲 Mei Ling", channel: "instagram", phone: "@meiling.tcm", language: "中文",
    treatment: "TCM Consultation", temperature: "warm", stage: "interested", branch: "Kuala Lumpur", timing: "Weekday",
    value: 150, owner: "Aina", source: "Meta Ads", attention: false, unread: false, followUp: true, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(210),
    summary: "最近睡眠不稳定，想先了解中医问诊。KL 平日比较方便，目前还在考虑。",
    messages: [
      ["user", "最近睡得不太好，想先了解一下中医问诊。", 218],
      ["assistant", "TCM Consultation 从 RM50 起。睡眠方面的情况可以先让中医师了解，再决定是否需要讨论其他 TCM services。", 217],
      ["user", "KL平日方便，我先考虑一下。", 210],
    ],
  },
  {
    id: 206, name: "Farah Rahman", channel: "whatsapp", phone: "+60 17-*** 9048", language: "BM",
    treatment: "Tuina", temperature: "hot", stage: "appointment", branch: "Petaling Jaya", timing: "Needs another day",
    value: 190, owner: "Aina", source: "Referral", attention: false, unread: false, followUp: false, noReply: false,
    reschedule: true, cancelled: false, overdue: false, lastAt: isoAgo(300),
    summary: "Mahukan Tuina di PJ dan meminta hari Ahad, tetapi pusat TCM tutup pada hari Ahad. Perlu pilih hari lain.",
    messages: [
      ["user", "Saya nak buat Tuina dekat PJ. Ahad petang boleh?", 306],
      ["assistant", "Pusat TCM tutup pada hari Ahad. Sabtu atau hari biasa lebih sesuai?", 305],
      ["user", "Saya check schedule dulu.", 300],
    ],
  },
  {
    id: 207, name: "Sarah Lim", channel: "whatsapp", phone: "+60 18-*** 7741", language: "EN",
    treatment: "Chinese Herbal Medicine Consultation", temperature: "hot", stage: "interested", branch: "Kuala Lumpur", timing: "Not specified",
    value: 180, owner: "Li Wen", source: "Organic", attention: true, unread: true, followUp: false, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(410),
    summary: "Asked whether Chinese herbal medicine can be combined with current medication. Conversation requires practitioner follow-up before any personalised advice.",
    messages: [
      ["user", "I’m taking regular medication. Can I take Chinese herbs together with it?", 414],
      ["assistant", "This needs personalised advice from the TCM practitioner rather than a guess from chat. I’ll pass the conversation to the team so they can advise you directly.", 413],
      ["staff", "Hi Sarah, I’m from the TCM team. I can help collect the information the practitioner needs before advising further.", 410],
    ],
  },
  {
    id: 208, name: "王思敏 Si Min", channel: "facebook", phone: "Messenger profile", language: "中文",
    treatment: "Gua Sha", temperature: "hot", stage: "visited", branch: "Kuala Lumpur", timing: "Completed visit",
    value: 210, owner: "Li Wen", source: "Meta Ads", attention: false, unread: false, followUp: true, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(1440),
    summary: "咨询刮痧后完成了示范到店流程，目前保留为 visited sample lead。",
    messages: [
      ["user", "请问你们有刮痧吗？", 1460],
      ["assistant", "有的，Gua Sha 是 demo 里配置的 TCM service，起价 RM60。", 1459],
      ["user", "KL，星期五下午方便。", 1450],
      ["staff", "您好，团队已经确认了示范 appointment details。", 1440],
    ],
  },
  {
    id: 209, name: "Amir Hakim", channel: "whatsapp", phone: "+60 19-*** 3380", language: "BM",
    treatment: "Acupuncture", temperature: "hot", stage: "won", branch: "Petaling Jaya", timing: "Completed",
    value: 320, owner: "Aina", source: "Meta Ads", attention: false, unread: false, followUp: false, noReply: false,
    reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(2880),
    summary: "Sample closed-won TCM lead after a confirmed appointment and centre visit.",
    messages: [
      ["user", "Saya nak tahu pasal akupunktur. Kalau boleh saya nak datang PJ.", 2900],
      ["assistant", "Acupuncture bermula RM80. Saya boleh catat PJ dan masa yang sesuai untuk team follow up.", 2899],
      ["staff", "Appointment demo sudah confirmed. Terima kasih!", 2880],
    ],
  },
];

export const ANALYTICS = {
  newLeads: 94,
  appointments: 29,
  visits: 21,
  won: 14,
  conversion: 14.9,
  appointmentRate: 30.9,
  showRate: 72.4,
  closeRate: 66.7,
  leadQuality: { hot: 21, warm: 34, cold: 39 },
  channels: { whatsapp: 61, instagram: 23, facebook: 10 },
  treatments: [["Acupuncture", 31], ["Tuina", 21], ["TCM Consultation", 17], ["Cupping", 11], ["Gua Sha", 7], ["Herbal Consultation", 7]],
  aiHandled: 81,
  staffTakeover: 19,
  avgResponse: "4.0s",
};

export function portalMessages(lead) {
  return lead.messages.map(([role, text, minutes], index) => ({
    id: lead.id * 100 + index,
    role: role === "user" ? "user" : "assistant",
    source: role,
    text,
    created_at: isoAgo(minutes),
    delivery_status: role === "user" ? null : "read",
  }));
}

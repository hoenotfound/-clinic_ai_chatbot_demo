export const STAGES = [
  { id: 1, key: "new", name: "New Enquiry", color: "#87968e" },
  { id: 2, key: "interested", name: "Qualified", color: "#d8a34e" },
  { id: 3, key: "appointment", name: "Site Measurement Requested", color: "#4f7c72" },
  { id: 4, key: "confirmed", name: "Site Measurement Confirmed", color: "#2f6f62" },
  { id: 5, key: "visited", name: "Quotation / Design", color: "#6a8293" },
  { id: 6, key: "won", name: "Won", color: "#2f7d4e" },
];

const now = Date.now();
const isoAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

export const SAMPLE_LEADS = [
  {
    id: 201, name: "Jason Lim", channel: "whatsapp", phone: "+60 12-*** 4812", language: "EN",
    treatment: "Kitchen Cabinets", temperature: "hot", stage: "appointment", branch: "Kuala Lumpur",
    timing: "Saturday morning", value: 12800, owner: "Amir", source: "Meta Ads", attention: true, unread: true,
    followUp: false, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(7),
    summary: "New condo owner planning a 12ft kitchen in Setapak with around RM12k budget. Asked for Saturday site measurement and is ready for staff follow-up.",
    messages: [["user","Hi, new condo at Setapak. Kitchen cabinet around 12ft, how much roughly?",16],["assistant","Kitchen cabinets start from RM6,800 for a compact sample package. Final price depends on material, countertop and fittings. Do you have a budget range in mind?",15],["user","Around 12k. Can your team come measure this Saturday morning?",8],["assistant","Got it — new condo in Setapak, roughly 12ft kitchen and around RM12k budget. I’ll pass this to the team to arrange the actual site-measurement timing with you.",7]],
  },
  {
    id: 202, name: "Nur Izzati", channel: "instagram", phone: "@izzati.home", language: "BM",
    treatment: "Built-in Wardrobes", temperature: "warm", stage: "interested", branch: "Petaling Jaya",
    timing: "Move-in next month", value: 7200, owner: "Mei", source: "Meta Ads", attention: false, unread: true,
    followUp: true, noReply: true, reschedule: false, cancelled: false, overdue: true, lastAt: isoAgo(24),
    summary: "Baru dapat kunci condo di Ara Damansara dan mahu wardrobe master bedroom. Bajet sekitar RM7k, target siap sebelum pindah bulan depan.",
    messages: [["user","Saya baru dapat kunci condo Ara Damansara. Nak buat wardrobe master bedroom.",33],["assistant","Boleh. Built-in wardrobe dalam demo ini bermula dari RM2,800, tapi harga akhir ikut size, pintu dan internal layout. Ada rough size tak?",31],["user","Lebih kurang 10ft. Budget saya 7k, nak siap sebelum pindah bulan depan.",25],["assistant","Okay, saya dah catat Ara Damansara + wardrobe lebih kurang 10ft + budget RM7k + target sebelum pindah bulan depan. Kalau ada floor plan, itu boleh bantu team quote dengan lebih cepat.",24]],
  },
  {
    id: 203, name: "陈伟伦 Wei Lun", channel: "facebook", phone: "Messenger profile", language: "中文",
    treatment: "Full-Home Custom Carpentry", temperature: "hot", stage: "confirmed", branch: "Kuala Lumpur",
    timing: "Site measurement confirmed", value: 48000, owner: "Amir", source: "Organic", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(52),
    summary: "Mont Kiara 新公寓，全屋木工包括厨房、衣柜、电视柜和鞋柜，预算约 RM45k–50k。团队已确认量尺安排。",
    messages: [["user","Mont Kiara 新condo，想做全屋木工。厨房、衣柜、电视柜和鞋柜都有。",70],["assistant","可以。全屋木工需要看每个区域的尺寸和材料方向。你大概有预算范围吗？",68],["user","45k到50k左右，有floor plan。想安排量尺。",60],["assistant","好的，我已经记录 Mont Kiara 新公寓 + 全屋木工 + RM45k–50k + 有 floor plan。我转给团队继续安排实际量尺。",58],["staff","您好 Wei Lun，我们已经跟您确认星期四下午到现场量尺。",52]],
  },
  {
    id: 204, name: "Samantha Lee", channel: "instagram", phone: "@samantha.lee", language: "EN",
    treatment: "TV Console & Living Room Carpentry", temperature: "cold", stage: "new", branch: "Petaling Jaya",
    timing: "Not specified", value: 3500, owner: "Unassigned", source: "Organic", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(95),
    summary: "Early enquiry for a TV console and feature wall in a PJ condo. Asked for a starting price but has not shared measurements or timeline yet.",
    messages: [["user","Do you make TV console + feature wall?",101],["assistant","Yes, TV console and living-room carpentry are included. A basic sample TV console starts from RM2,200. Is this for a condo or landed house?",99],["user","Condo in PJ. Just checking price first.",95]],
  },
  {
    id: 205, name: "Hafiz Rahman", channel: "whatsapp", phone: "+60 17-*** 9530", language: "BM",
    treatment: "Kitchen Cabinets", temperature: "warm", stage: "interested", branch: "Kuala Lumpur",
    timing: "Keys in 2 weeks", value: 18500, owner: "Aina", source: "Referral", attention: false, unread: false,
    followUp: true, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(140),
    summary: "Planning wet and dry kitchen carpentry for a new Cheras condo. Keys expected in two weeks; budget around RM18k and comparing material options.",
    messages: [["user","Nak buat wet kitchen dan dry kitchen untuk condo baru Cheras. Kunci dapat 2 minggu lagi.",148],["assistant","Boleh. Untuk dua area kitchen, quotation memang bergantung pada panjang cabinet, material, countertop dan fittings. Ada budget range yang anda target?",146],["user","Dalam 18k. Tengah compare material dulu.",140]],
  },
  {
    id: 206, name: "Michelle Wong", channel: "facebook", phone: "Messenger profile", language: "EN",
    treatment: "Shoe Cabinet & Entrance Storage", temperature: "warm", stage: "interested", branch: "Petaling Jaya",
    timing: "Within 2 months", value: 4600, owner: "Mei", source: "Meta Ads", attention: false, unread: true,
    followUp: true, noReply: false, reschedule: false, cancelled: false, overdue: true, lastAt: isoAgo(210),
    summary: "Subsale home in Damansara. Wants a full-height shoe cabinet with seating and hidden storage, budget around RM4k–5k within two months.",
    messages: [["user","I want a full height shoe cabinet with a small bench and hidden storage.",218],["assistant","Can. A basic shoe cabinet starts from RM1,200, while a larger full-height design with seating and storage depends on the wall size and finish. Is this a new unit or existing home?",216],["user","Subsale in Damansara, budget maybe 4-5k. Hope can do within 2 months.",210]],
  },
  {
    id: 207, name: "李欣怡 Xin Yi", channel: "whatsapp", phone: "+60 16-*** 2381", language: "中文",
    treatment: "Built-in Wardrobes", temperature: "hot", stage: "visited", branch: "Kuala Lumpur",
    timing: "Design revision", value: 15600, owner: "Aina", source: "Meta Ads", attention: false, unread: false,
    followUp: true, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(310),
    summary: "Bukit Jalil condo 三个房间的衣柜项目，已完成量尺，目前团队在跟进内部格局和报价设计调整。",
    messages: [["user","三个房间都想做衣柜，Bukit Jalil condo。",330],["assistant","可以。三个房间一起做的话，团队会需要每个房间的尺寸和内部收纳需求。你有 floor plan 吗？",328],["user","有，budget大概15k。可以上门量吗？",325],["assistant","好的，我记录了 Bukit Jalil + 3个房间衣柜 + budget约RM15k + 有floor plan。我转给团队继续安排。",322],["staff","已经完成量尺了，我们现在根据你要的挂衣区和抽屉调整设计。",310]],
  },
  {
    id: 208, name: "Adam Tan", channel: "instagram", phone: "@adam.tan", language: "EN",
    treatment: "Study, Display & Storage Cabinets", temperature: "hot", stage: "appointment", branch: "Petaling Jaya",
    timing: "Weekday evening", value: 9800, owner: "Amir", source: "Meta Ads", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: true, cancelled: false, overdue: false, lastAt: isoAgo(410),
    summary: "Wants study cabinetry and display storage for a condo. Requested an evening measurement but needs a different day after the first timing did not work.",
    messages: [["user","Need built-in study table + display cabinet for my condo in PJ.",424],["assistant","Yes, that’s within the carpentry scope. Do you have rough wall measurements or a floor plan?",422],["user","Have floor plan. Can measure Wednesday evening?",415],["staff","Wednesday evening is not available on the sample schedule. We’re checking another weekday timing with you.",410]],
  },
  {
    id: 209, name: "Alya Sofea", channel: "whatsapp", phone: "+60 18-*** 7810", language: "BM",
    treatment: "Kitchen Cabinets", temperature: "cold", stage: "new", branch: "Kuala Lumpur",
    timing: "Not ready yet", value: 6800, owner: "Unassigned", source: "Organic", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: false, cancelled: true, overdue: false, lastAt: isoAgo(560),
    summary: "Asked about kitchen cabinet pricing for a future renovation but is not ready to proceed yet.",
    messages: [["user","Kitchen cabinet start berapa ya?",566],["assistant","Kitchen cabinet bermula dari RM6,800 untuk sample compact package. Final price ikut ukuran, material, countertop dan fittings. Condo atau landed?",565],["user","Landed. Tapi saya belum ready lagi, survey dulu.",560]],
  },
  {
    id: 210, name: "Kelvin Goh", channel: "whatsapp", phone: "+60 12-*** 1077", language: "EN",
    treatment: "Full-Home Custom Carpentry", temperature: "hot", stage: "visited", branch: "Petaling Jaya",
    timing: "Quotation sent", value: 62000, owner: "Mei", source: "Referral", attention: true, unread: true,
    followUp: true, noReply: true, reschedule: false, cancelled: false, overdue: true, lastAt: isoAgo(720),
    summary: "Landed-house full carpentry lead. Site measurement is complete and a quotation has been sent; customer is reviewing a RM60k+ scope and needs follow-up.",
    messages: [["user","I’m doing carpentry for whole landed house. Kitchen, wardrobes, TV, shoe cabinet, study.",740],["assistant","That would fall under full-home custom carpentry. The team will need the scope and measurements before a proper quotation. What area is the house in?",738],["user","Subang. Budget around 60k, can arrange site visit.",734],["staff","Measurement completed and quotation sent. Let me know if you want us to revise any of the areas.",720]],
  },
  {
    id: 211, name: "王志豪 Zhi Hao", channel: "facebook", phone: "Messenger profile", language: "中文",
    treatment: "TV Console & Living Room Carpentry", temperature: "hot", stage: "confirmed", branch: "Kuala Lumpur",
    timing: "Friday afternoon", value: 11800, owner: "Aina", source: "Meta Ads", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(1250),
    summary: "Old Klang Road condo 客厅木工项目，包括电视柜、展示柜和收纳。已确认星期五下午现场量尺。",
    messages: [["user","客厅想做电视柜、展示柜还有一些收纳，Old Klang Road condo。",1265],["assistant","可以，这些都属于 living-room carpentry。大概有预算范围吗？",1263],["user","10k到12k。星期五下午可以量尺吗？",1258],["staff","已经确认星期五下午现场量尺，我们到时会一起看墙面尺寸和收纳需求。",1250]],
  },
  {
    id: 212, name: "Farah Nabila", channel: "whatsapp", phone: "+60 19-*** 3488", language: "BM",
    treatment: "Full-Home Custom Carpentry", temperature: "hot", stage: "won", branch: "Kuala Lumpur",
    timing: "Project confirmed", value: 38500, owner: "Amir", source: "Meta Ads", attention: false, unread: false,
    followUp: false, noReply: false, reschedule: false, cancelled: false, overdue: false, lastAt: isoAgo(2880),
    summary: "Sample closed-won renovation lead for kitchen, wardrobes and TV cabinet after measurement, design discussion and quotation follow-up.",
    messages: [["user","Condo baru KL. Nak kitchen cabinet, 2 wardrobe dan TV cabinet.",2920],["assistant","Boleh. Untuk beberapa area macam ini, paling cepat kalau team faham floor plan, budget dan target pindah dulu. Ada budget range?",2918],["user","Around 35-40k. Floor plan ada.",2914],["staff","Thanks Farah. Measurement dan quotation dah selesai, dan project scope telah confirmed.",2880]],
  },
];

export const ANALYTICS = {
  newLeads: 148,
  appointments: 43,
  visits: 31,
  won: 19,
  conversion: 12.8,
  appointmentRate: 29.1,
  showRate: 72.1,
  closeRate: 61.3,
  leadQuality: { hot: 32, warm: 61, cold: 55 },
  channels: { whatsapp: 96, instagram: 35, facebook: 17 },
  treatments: [["Kitchen Cabinets",46],["Built-in Wardrobes",34],["Full-Home Carpentry",25],["Living Room",19],["Other Carpentry",24]],
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

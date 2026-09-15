const tcm = require("./tcmConfig");
const { detectConcernMappings } = require("./tcmKnowledge");
const {
  BOOKING,
  NEGATIVE,
  activeMessages,
  hasTcmBookingIntent,
  branchFromMessages,
  timingFromMessages,
  serviceForText,
  serviceSelectionFromMessages,
} = require("./tcmBookingIntent");

const RENEWED_INTEREST = /\binterested\b|want to|want\s+(?:this|that)|how much|\bprice\b|\bcost\b|harga|berapa|berminat|nak\s+(?:tahu|buat)|mahu\s+(?:tahu|buat)|想了解|有兴趣|有興趣|多少钱|多少錢|价格|價格/i;

function customerMessages(messages) {
  return (messages || []).filter((message) => message?.role === "user");
}

function concernFromMessages(messages) {
  const customers = customerMessages(messages);
  for (const message of [...customers].reverse()) {
    const mapping = detectConcernMappings(message.content)?.[0];
    if (mapping?.concern) return mapping.concern;
  }
  return null;
}

function startingValue(serviceName) {
  const service = tcm.services.find((item) => item.name === serviceName);
  const match = String(service?.priceRange || "").match(/RM\s*([0-9,.]+)/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function reducedInterestFromMessages(messages) {
  const customers = customerMessages(messages);
  let lastNegative = -1;
  for (let index = customers.length - 1; index >= 0; index -= 1) {
    if (NEGATIVE.test(String(customers[index]?.content || ""))) {
      lastNegative = index;
      break;
    }
  }
  if (lastNegative < 0) return false;
  const after = customers.slice(lastNegative + 1);
  const renewed = after.some((message) => {
    const text = String(message?.content || "");
    return Boolean(serviceForText(text)) || BOOKING.test(text) || RENEWED_INTEREST.test(text);
  });
  return !renewed;
}

function updateAppointmentLead(session) {
  const messages = session.messages || [];
  const active = activeMessages(messages);
  const serviceSelection = serviceSelectionFromMessages(messages);
  const service = serviceSelection.service;
  const reducedInterest = reducedInterestFromMessages(messages);
  const bookingIntent = !reducedInterest && hasTcmBookingIntent(messages);
  const preferredBranch = branchFromMessages(active);
  const preferredTiming = timingFromMessages(active);
  const interests = service
    ? [service.name]
    : serviceSelection.cleared
      ? []
      : (session.lead?.interests || []);
  const concern = concernFromMessages(active);
  const value = interests.length ? startingValue(interests[0]) : null;
  const context = [preferredBranch, preferredTiming].filter(Boolean).join(" · ");
  const summary = reducedInterest
    ? `${interests.length ? `Previously asked about ${interests.join(" and ")}` : "The visitor enquired about TCM services"}, but is not proceeding with an appointment right now.`
    : bookingIntent
      ? `${interests.length ? `Interested in ${interests.join(" and ")}` : "Interested in a visit"}${concern ? ` for ${concern}` : ""}${context ? ` · ${context}` : ""}. Appointment intent detected and ready for team follow-up.`
      : interests.length
        ? `Interested in ${interests.join(" and ")}${concern ? ` for ${concern}` : ""}. No appointment intent detected yet.`
        : concern
          ? `Asked about ${concern}. No service or appointment intent has been confirmed yet.`
          : "Early-stage enquiry. No specific service or appointment intent has been detected yet.";

  session.lead = {
    ...session.lead,
    interests,
    concern,
    bookingIntent,
    reducedInterest,
    preferredBranch,
    preferredTiming,
    estimatedValue: value,
    temperature: reducedInterest ? "cold" : bookingIntent ? "hot" : interests.length || concern ? "warm" : "cold",
    summary,
  };
  return session.lead;
}

module.exports = { updateAppointmentLead, _test: { concernFromMessages, startingValue, reducedInterestFromMessages } };

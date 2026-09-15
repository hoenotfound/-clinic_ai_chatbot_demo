const tcm = require("./tcmConfig");
const { detectConcernMappings } = require("./tcmKnowledge");
const {
  hasTcmBookingIntent,
  branchFromMessages,
  timingFromMessages,
  serviceSelectionFromMessages,
} = require("./tcmBookingIntent");

function concernFromMessages(messages) {
  const customers = (messages || []).filter((message) => message?.role === "user");
  for (const message of [...customers].reverse()) {
    const mapping = detectConcernMappings(message.content)?.[0];
    if (mapping?.concern) return mapping.concern;
  }
  return null;
}

function startingValue(serviceName) {
  const service = tcm.services.find((item) => item.name === serviceName);
  const match = String(service?.priceRange || "").match(/RM\s*([0-9,.]+)/i);
  return match ? Number(match[1].replace(/,/g, "")) || 0 : 0;
}

function updateAppointmentLead(session) {
  const messages = session.messages || [];
  const serviceSelection = serviceSelectionFromMessages(messages);
  const service = serviceSelection.service;
  const reducedInterest = Boolean(session.lead?.reducedInterest);
  const bookingIntent = !reducedInterest && hasTcmBookingIntent(messages);
  const preferredBranch = branchFromMessages(messages);
  const preferredTiming = timingFromMessages(messages);
  const interests = service
    ? [service.name]
    : serviceSelection.cleared
      ? []
      : (session.lead?.interests || []);
  const concern = concernFromMessages(messages) || session.lead?.concern || null;
  const value = interests.length ? startingValue(interests[0]) : 0;
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
    preferredBranch,
    preferredTiming,
    estimatedValue: value,
    temperature: reducedInterest ? "cold" : bookingIntent ? "hot" : interests.length || concern ? "warm" : "cold",
    summary,
  };
  return session.lead;
}

module.exports = { updateAppointmentLead, _test: { concernFromMessages, startingValue } };

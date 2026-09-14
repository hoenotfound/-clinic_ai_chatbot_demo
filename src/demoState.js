const base = require("./demoStateBase");
const industry = require("./industryProfile");
const { updateAppointmentLead } = require("./appointmentLeadState");

function updateLead(session) {
  if (industry.key === "tcm") return updateAppointmentLead(session);
  return base.updateLead(session);
}

function addCustomerMessage(session, rawText) {
  const message = base.addCustomerMessage(session, rawText);
  if (industry.key === "tcm") updateAppointmentLead(session);
  return message;
}

function restoreSession(session) {
  const restored = base.restoreSession(session);
  if (restored && industry.key === "tcm") updateAppointmentLead(restored);
  return restored;
}

module.exports = {
  ...base,
  addCustomerMessage,
  restoreSession,
  updateLead,
};

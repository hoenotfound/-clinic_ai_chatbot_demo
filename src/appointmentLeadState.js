const { hasTcmBookingIntent, branchFromMessages, timingFromMessages, recentService } = require("./tcmBookingIntent");

function updateAppointmentLead(session) {
  const service = recentService(session.messages || []);
  const bookingIntent = hasTcmBookingIntent(session.messages || []);
  const preferredBranch = branchFromMessages(session.messages || []);
  const preferredTiming = timingFromMessages(session.messages || []);
  const interests = service ? [service.name] : (session.lead?.interests || []);
  session.lead = {
    ...session.lead,
    interests,
    bookingIntent,
    preferredBranch,
    preferredTiming,
    temperature: bookingIntent ? "hot" : interests.length ? "warm" : "cold",
  };
  return session.lead;
}

module.exports = { updateAppointmentLead };

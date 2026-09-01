export function displayName(contact) {
  return contact?.name || contact?.whatsapp_profile_name || contact?.whatsappProfileName || (contact?.channel === "facebook" ? "Facebook user" : null) || (contact?.channel === "instagram" ? "Instagram user" : null) || contact?.whatsapp_number || "Contact";
}
export function formatMoney(value) {
  const amount = Number(value); if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(amount);
}
export function formatDateTime(value, options = {}) {
  if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", ...options });
}
export function formatRelative(value, now = Date.now()) {
  if (!value) return "No messages"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.floor((now - date.getTime()) / 1000); if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
export function isNoReply(lead, noReplyHours = 24, now = Date.now()) {
  if (!lead || lead.is_closed || lead.last_message_role !== "assistant" || !lead.last_message_at) return false;
  const sentAt = new Date(lead.last_message_at).getTime(); const hours = Number(noReplyHours);
  return Number.isFinite(sentAt) && Number.isFinite(hours) && hours > 0 && sentAt <= now - hours * 60 * 60 * 1000;
}
export function isOverdue(lead, now = Date.now()) { return !!lead.next_follow_up_at && !lead.is_closed && new Date(lead.next_follow_up_at).getTime() < now; }
export function temperatureStyle(temperature) {
  if (temperature === "hot") return "bg-[var(--color-danger-light)] text-[var(--color-danger)]";
  if (temperature === "cold") return "bg-slate-100 text-slate-600";
  return "bg-[var(--color-accent-light)] text-[#8a641f]";
}

import ContactAvatar from "../ContactAvatar";
import { displayName, formatDateTime, formatMoney, formatRelative, isNoReply, isOverdue, temperatureStyle } from "./pipelineUtils";

export default function LeadCard({ lead, now, noReplyHours, onOpen, onDragStart }) {
  const overdue = isOverdue(lead, now);
  const noReply = isNoReply(lead, noReplyHours, now);
  const live = lead.source === "Live demo";
  const liveStage = lead.stage_type === "appointment"
    ? "Appointment Requested"
    : lead.stage_type === "interested"
      ? "Qualified"
      : "New Enquiry";

  return (
    <button
      type="button"
      draggable={typeof onDragStart === "function"}
      onDragStart={onDragStart ? (event) => onDragStart(event, lead) : undefined}
      onClick={() => onOpen(lead.id)}
      className={`w-full rounded-2xl border bg-[var(--color-surface)] p-3.5 text-left shadow-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-md active:translate-y-0 ${live ? "border-[var(--color-primary)]/45 ring-2 ring-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}
    >
      {live && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[var(--color-primary-light)] px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--color-primary)]">
            <i className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-primary)]" />
            Live from Patient View
          </span>
          <span className="text-[9px] font-semibold text-[var(--color-primary)]">Auto-updating</span>
        </div>
      )}

      <div className="flex items-start gap-3">
        <ContactAvatar src={lead.photo_url} channel={lead.channel} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-semibold">{displayName(lead)}</p>{lead.estimated_value != null && <span className="shrink-0 text-[11px] font-semibold text-[var(--color-primary)]">{formatMoney(lead.estimated_value)}</span>}</div>
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{lead.treatment_interest || "Treatment not selected"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge className={temperatureStyle(lead.temperature)}>{capitalize(lead.temperature)}</Badge>
        <Badge className="bg-[var(--color-primary-light)] text-[var(--color-primary)]">{lead.branch_name || "Unassigned"}</Badge>
        {noReply && <Badge className="bg-slate-100 text-slate-600">No reply</Badge>}
        {lead.appointment_status === "reschedule" && <Badge className="bg-[var(--color-accent-light)] text-[#8a641f]">Reschedule</Badge>}
        {lead.appointment_status === "cancelled" && <Badge className="bg-[var(--color-danger-light)] text-[var(--color-danger)]">Cancelled</Badge>}
        {lead.needs_attention && <Badge className="bg-[var(--color-danger-light)] text-[var(--color-danger)]">Attention</Badge>}
      </div>

      {live && (
        <div key={`${lead.temperature}-${lead.stage_type}-${lead.treatment_interest}-${lead.branch_name}`} className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--color-primary)]/15 bg-[var(--color-bg)] p-2.5">
          <LiveField label="Lead" value={capitalize(lead.temperature) || "Cold"} />
          <LiveField label="Stage" value={liveStage} />
          <LiveField label="Treatment" value={lead.treatment_interest || "Detecting…"} />
          <LiveField label="Branch" value={lead.branch_name || "Not selected"} />
          <p className="col-span-2 mt-1 text-[9px] leading-4 text-[var(--color-text-muted)]">Watch these fields change as the prospect sends price, treatment and booking messages.</p>
        </div>
      )}

      {(lead.appointment_at || lead.next_follow_up_at) && <div className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-2.5 text-[11px]">{lead.appointment_at && <MetaRow icon="calendar" label={formatDateTime(lead.appointment_at)} />}{lead.next_follow_up_at && <MetaRow icon="clock" label={`${overdue ? "Overdue" : "Follow up"} · ${formatDateTime(lead.next_follow_up_at)}`} danger={overdue} />}</div>}
      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-[var(--color-text-muted)]"><span className="truncate">{lead.owner_username ? `Owner: ${lead.owner_username}` : "No owner"}</span><span className="shrink-0">{formatRelative(lead.last_message_at, now)}</span></div>
    </button>
  );
}

function LiveField({ label, value }) {
  return <div className="min-w-0 rounded-lg bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,.04)]"><small className="block text-[8px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</small><strong className="mt-0.5 block truncate text-[10px]">{value}</strong></div>;
}
function Badge({ children, className }) { return <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${className}`}>{children}</span>; }
function MetaRow({ icon, label, danger }) { return <div className={`flex items-center gap-1.5 ${danger ? "font-medium text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}`}>{icon === "calendar" ? <CalendarIcon /> : <ClockIcon />}<span className="truncate">{label}</span></div>; }
function capitalize(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""; }
function CalendarIcon() { return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>; }

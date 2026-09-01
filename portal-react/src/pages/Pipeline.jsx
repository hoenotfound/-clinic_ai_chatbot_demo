import { useEffect, useMemo, useState } from "react";
import LeadCard from "../components/pipeline/LeadCard";
import ContactAvatar from "../components/ContactAvatar";
import { SAMPLE_LEADS, STAGES } from "../demoData";
import { formatMoney } from "../components/pipeline/pipelineUtils";
import { CloseIcon } from "../components/InboxIcons";

const CATEGORY_OPTIONS = [
  ["all", "All leads"],
  ["hot", "Hot"],
  ["warm", "Warm"],
  ["cold", "Cold"],
  ["unassigned", "Unassigned"],
  ["no_reply", "No reply"],
  ["reschedule", "Reschedule"],
  ["cancelled", "Cancelled"],
  ["overdue", "Follow-up overdue"],
  ["attention", "Needs attention"],
];

function stageByKey(key) {
  return STAGES.find((stage) => stage.key === key) || STAGES[0];
}

function mapLead(lead) {
  const stage = stageByKey(lead.stage);
  const last = lead.messages.at(-1);
  return {
    id: lead.id,
    name: lead.name,
    whatsapp_profile_name: lead.name,
    whatsapp_number: lead.phone,
    channel: lead.channel,
    temperature: lead.temperature,
    stage_id: stage.id,
    stage_type: lead.stage,
    branch_name: lead.branch === "Unassigned" ? null : lead.branch,
    owner_username: lead.owner === "Unassigned" ? null : lead.owner,
    treatment_interest: lead.treatment,
    estimated_value: lead.value,
    source: lead.source,
    campaign_name: lead.source === "Meta Ads" ? "Demo Clinic Campaign" : null,
    appointment_status: lead.cancelled
      ? "cancelled"
      : lead.reschedule
        ? "reschedule"
        : lead.stage === "visited"
          ? "visited"
          : lead.stage === "confirmed"
            ? "confirmed"
            : lead.stage === "appointment"
              ? "requested"
              : "none",
    appointment_at: lead.stage === "confirmed" ? new Date(Date.now() + 86_400_000).toISOString() : null,
    next_follow_up_at: lead.overdue ? new Date(Date.now() - 3_600_000).toISOString() : lead.followUp ? new Date(Date.now() + 7_200_000).toISOString() : null,
    needs_attention: lead.attention,
    last_message_role: lead.noReply ? "assistant" : last?.[0] === "user" ? "user" : "assistant",
    last_message_at: lead.lastAt,
    last_message_delivery_status: "read",
    is_closed: lead.stage === "won",
    summary: lead.summary,
    language: lead.language,
  };
}

function matchesCategory(lead, category, now) {
  if (category === "all") return true;
  if (category === "hot") return lead.temperature === "hot" && !lead.is_closed;
  if (category === "warm") return lead.temperature === "warm" && !lead.is_closed;
  if (category === "cold") return lead.temperature === "cold" && !lead.is_closed;
  // Category “Unassigned” means no sales owner. The branch-card “Unassigned” separately means no branch.
  if (category === "unassigned") return !lead.owner_username && !lead.is_closed;
  if (category === "no_reply") return lead.last_message_role === "assistant" && !lead.is_closed;
  if (category === "reschedule") return lead.appointment_status === "reschedule";
  if (category === "cancelled") return lead.appointment_status === "cancelled";
  if (category === "overdue") return Boolean(lead.next_follow_up_at) && new Date(lead.next_follow_up_at).getTime() < now && !lead.is_closed;
  if (category === "attention") return lead.needs_attention;
  return false;
}

export default function Pipeline() {
  const [live, setLive] = useState(null);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [category, setCategory] = useState("all");
  const [mobileStageId, setMobileStageId] = useState(STAGES[0].id);
  const [selectedId, setSelectedId] = useState(null);
  const [now, setNow] = useState(Date.now());

  async function loadLive() {
    const id = sessionStorage.getItem("clinicDemoSessionId");
    if (!id) {
      setLive(null);
      return;
    }
    try {
      const response = await fetch(`/api/demo/sessions/${encodeURIComponent(id)}`);
      if (response.ok) setLive((await response.json()).session || null);
    } catch {}
  }

  useEffect(() => {
    loadLive();
    const liveTimer = setInterval(loadLive, 1800);
    const clockTimer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(liveTimer);
      clearInterval(clockTimer);
    };
  }, []);

  const liveLead = useMemo(() => {
    if (!live?.customerMessageCount) return null;
    const lead = live.lead || {};
    const key = lead.bookingIntent ? "appointment" : lead.temperature === "hot" || lead.temperature === "warm" ? "interested" : "new";
    const stage = stageByKey(key);
    const last = live.messages?.at(-1);
    return {
      id: 1,
      name: "Demo Patient",
      whatsapp_profile_name: "Demo Patient",
      whatsapp_number: "Live browser visitor",
      channel: live.channel || "whatsapp",
      temperature: lead.temperature || "cold",
      stage_id: stage.id,
      stage_type: key,
      branch_name: lead.preferredBranch || null,
      owner_username: live.mode === "human" ? "Demo Admin" : null,
      treatment_interest: lead.interests?.[0] || "Treatment not selected",
      estimated_value: lead.bookingIntent ? 1800 : 0,
      source: "Live demo",
      campaign_name: null,
      appointment_status: lead.bookingIntent ? "requested" : "none",
      appointment_at: null,
      next_follow_up_at: null,
      needs_attention: Boolean(live.needsAttention),
      last_message_role: last?.source === "customer" ? "user" : "assistant",
      last_message_at: last?.createdAt || new Date().toISOString(),
      last_message_delivery_status: "read",
      is_closed: false,
      summary: lead.summary || "Live prospect conversation",
      language: "LIVE",
    };
  }, [live]);

  const leads = useMemo(() => [liveLead, ...SAMPLE_LEADS.map(mapLead)].filter(Boolean), [liveLead]);
  const branches = useMemo(() => ["Kuala Lumpur", "Petaling Jaya"], []);
  const selected = leads.find((lead) => lead.id === selectedId) || null;
  const open = leads.filter((lead) => !lead.is_closed);

  const filtered = useMemo(() => leads.filter((lead) => {
    if (branch === "unassigned" && lead.branch_name) return false;
    if (branch !== "all" && branch !== "unassigned" && lead.branch_name !== branch) return false;
    if (!matchesCategory(lead, category, now)) return false;
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = [
        lead.name,
        lead.whatsapp_number,
        lead.treatment_interest,
        lead.branch_name,
        lead.owner_username,
        lead.source,
        lead.campaign_name,
        lead.language,
        lead.summary,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }), [leads, branch, category, search, now]);

  const counts = useMemo(() => Object.fromEntries(
    CATEGORY_OPTIONS.map(([key]) => [key, leads.filter((lead) => matchesCategory(lead, key, now)).length])
  ), [leads, now]);

  const branchCards = [
    { key: "all", label: "All branches", items: open },
    ...branches.map((name) => ({ key: name, label: name, items: open.filter((lead) => lead.branch_name === name) })),
    { key: "unassigned", label: "Unassigned", items: open.filter((lead) => !lead.branch_name) },
  ];

  const mobileStage = STAGES.find((stage) => stage.id === mobileStageId) || STAGES[0];
  const mobileLeads = filtered.filter((lead) => lead.stage_id === mobileStage.id);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--color-bg)]">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-[-.02em] sm:text-2xl">Lead Pipeline</h1>
              <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Live</span>
              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[9px] font-semibold text-[var(--color-text-muted)]">Sample demo data</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Track every enquiry, next action and sales outcome in one place.</p>
          </div>
          <div className="hidden gap-2 sm:flex" aria-label="Production-only pipeline controls">
            <button disabled title="Available in production" className="h-10 cursor-not-allowed rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-text-muted)] opacity-60">Manage stages · Production</button>
            <button disabled title="Available in production" className="h-10 cursor-not-allowed rounded-xl bg-[var(--color-primary)] px-3 text-xs font-semibold text-white opacity-60">+ Add lead · Production</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-2xl">
          <Metric label="Active leads" value={open.length} detail="Open journeys" />
          <Metric label="Hot leads" value={open.filter((lead) => lead.temperature === "hot").length} detail="Priority follow-up" tone="danger" />
          <Metric label="Pipeline value" value={formatMoney(open.reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0)) || "RM 0"} detail="Estimated open value" />
        </div>
      </header>

      <div className="shrink-0 overflow-x-auto border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex min-w-max gap-2">
          {branchCards.map((card) => (
            <button key={card.key} onClick={() => setBranch(card.key)} className={`w-44 rounded-2xl border px-3.5 py-3 text-left transition ${branch === card.key ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30"}`}>
              <div className="flex justify-between gap-2"><strong className="truncate text-xs">{card.label}</strong><b className="text-sm">{card.items.length}</b></div>
              <p className="mt-1 text-[9px] text-[var(--color-text-muted)]">{card.items.filter((lead) => lead.temperature === "hot").length} hot · {card.items.filter((lead) => lead.appointment_status === "confirmed").length} confirmed</p>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5 lg:px-6">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative w-full xl:w-64">
            <SearchIcon />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads…" className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-xs outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORY_OPTIONS.map(([key, label]) => (
              <button key={key} onClick={() => setCategory(key)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold ${category === key ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40"}`}>
                {label}<span className={`rounded-full px-1.5 py-0.5 text-[8px] ${category === key ? "bg-white/20" : "bg-[var(--color-bg)]"}`}>{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--color-border)] bg-white px-3 py-2 md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {STAGES.map((stage) => (
            <button key={stage.id} onClick={() => setMobileStageId(stage.id)} className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${mobileStage.id === stage.id ? "bg-[var(--color-text)] text-white" : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />{stage.name}<span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px]">{filtered.filter((lead) => lead.stage_id === stage.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 md:hidden">
        <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-3 shadow-sm">
          <div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mobileStage.color }} /><h2 className="text-sm font-bold">{mobileStage.name}</h2></div><p className="mt-1 pl-[18px] text-[10px] text-[var(--color-text-muted)]">{mobileLeads.length} leads · {formatMoney(mobileLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0)) || "RM 0"}</p></div>
          <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-text-muted)]">{filtered.length} shown</span>
        </div>
        <div className="space-y-2.5">
          {mobileLeads.map((lead) => <LeadCard key={lead.id} lead={lead} now={now} noReplyHours={1} onOpen={setSelectedId} />)}
          {!mobileLeads.length && <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white/60 px-4 py-10 text-center text-xs text-[var(--color-text-muted)]">No leads here. Try another stage or filter.</div>}
        </div>
      </main>

      <main className="hidden min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-5 md:block lg:p-6">
        <div className="flex h-full min-w-max gap-4">
          {STAGES.map((stage) => {
            const items = filtered.filter((lead) => lead.stage_id === stage.id);
            return (
              <section key={stage.id} className="flex h-full w-[19rem] flex-col rounded-2xl bg-[#f1f2ee]">
                <header className="border-b border-black/5 px-3.5 py-3">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} /><h2 className="min-w-0 flex-1 truncate text-sm font-bold">{stage.name}</h2><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">{items.length}</span></div>
                  <p className="mt-1.5 pl-[18px] text-[10px] text-[var(--color-text-muted)]">{formatMoney(items.reduce((sum, lead) => sum + (Number(lead.estimated_value) || 0), 0)) || "RM 0"}</p>
                </header>
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
                  {items.map((lead) => <LeadCard key={lead.id} lead={lead} now={now} noReplyHours={1} onOpen={setSelectedId} />)}
                  {!items.length && <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">No leads here</div>}
                </div>
              </section>
            );
          })}
        </div>
      </main>
      {selected && <LeadDrawer lead={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Metric({ label, value, detail, tone }) {
  return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3 sm:px-4"><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] sm:text-[10px]">{label}</p><div className="mt-1 flex items-end justify-between gap-3"><p className={`font-display text-xl font-bold ${tone === "danger" ? "text-[var(--color-danger)]" : ""}`}>{value}</p><p className="hidden pb-0.5 text-[10px] text-[var(--color-text-muted)] sm:block">{detail}</p></div></div>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

function LeadDrawer({ lead, onClose }) {
  return (
    <>
      <button aria-label="Close lead details" onClick={onClose} className="fixed inset-0 z-40 bg-black/20" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[min(28rem,94vw)] flex-col border-l border-[var(--color-border)] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--color-text-muted)]">Lead details</p><h2 className="mt-1 font-display text-lg font-bold">{lead.name}</h2></div><button aria-label="Close lead drawer" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--color-bg)]"><CloseIcon className="h-4 w-4" /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-3"><ContactAvatar channel={lead.channel} size={52} /><div><strong className="text-sm">{lead.name}</strong><p className="mt-1 text-xs text-[var(--color-text-muted)]">{lead.whatsapp_number}</p></div></div>
          <div className="mt-6 grid grid-cols-2 gap-3">{[["Temperature", lead.temperature], ["Treatment", lead.treatment_interest], ["Branch", lead.branch_name || "Unassigned"], ["Owner", lead.owner_username || "Unassigned"], ["Source", lead.source], ["Value", formatMoney(lead.estimated_value)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p><p className="mt-1.5 text-xs font-semibold">{value}</p></div>)}</div>
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Conversation summary</p><p className="mt-2 text-sm leading-6">{lead.summary}</p></div>
          <p className="mt-5 text-center text-[10px] text-[var(--color-text-muted)]">Sample/demo lead controls are read only.</p>
        </div>
      </aside>
    </>
  );
}

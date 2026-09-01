import { useEffect, useMemo, useState } from "react";
import ContactAvatar from "../components/ContactAvatar";
import { ArrowLeftIcon, BotIcon, ChatOutlineIcon, ChevronDownIcon, CloseIcon, FlagIcon, MailIcon, MoreIcon, SearchIcon, SendIcon, UserIcon, AlertIcon } from "../components/InboxIcons";
import { SAMPLE_LEADS, portalMessages } from "../demoData";

const STATUS_FILTERS = [
  ["all", "All"], ["unreplied", "Unreplied"], ["follow-up", "Follow-up"], ["unread", "Unread"], ["attention", "Needs attention"],
];

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value); const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function sampleConversation(lead) {
  const last = lead.messages.at(-1);
  return {
    contact_id: lead.id,
    display_name: lead.name,
    whatsapp_name: lead.name,
    whatsapp_number: lead.phone,
    channel: lead.channel,
    mode: lead.messages.some((m) => m[0] === "staff") ? "human" : "ai",
    takeover_by: lead.messages.some((m) => m[0] === "staff") ? lead.owner : null,
    needs_attention: lead.attention,
    attention_reason: lead.attention ? "Patient requested staff assistance." : null,
    needs_follow_up: lead.followUp,
    is_unread: lead.unread,
    has_unreplied: lead.noReply,
    last_message_role: last?.[0] === "user" ? "user" : "assistant",
    last_message: last?.[1] || lead.summary,
    last_message_at: lead.lastAt,
    lead,
    sample: true,
  };
}

function displayName(c) { return c?.display_name || c?.whatsapp_name || c?.whatsapp_number || "Unknown contact"; }

export default function Inbox() {
  const [live, setLive] = useState(null);
  const [selectedId, setSelectedId] = useState("live");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function loadLive() {
    const id = sessionStorage.getItem("clinicDemoSessionId");
    if (!id) { setLive(null); return; }
    try {
      const res = await fetch(`/api/demo/sessions/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const body = await res.json(); setLive(body.session || null);
    } catch {}
  }

  useEffect(() => {
    loadLive();
    const timer = setInterval(loadLive, 1800);
    const onStorage = () => loadLive();
    window.addEventListener("focus", onStorage);
    return () => { clearInterval(timer); window.removeEventListener("focus", onStorage); };
  }, []);

  const liveConversation = useMemo(() => {
    if (!live) return null;
    const last = live.messages?.at(-1);
    return {
      contact_id: "live", display_name: "Demo Patient", whatsapp_name: "Demo Patient", whatsapp_number: "Live browser visitor",
      channel: live.channel || "whatsapp", mode: live.mode || "ai", takeover_by: live.mode === "human" ? "Demo Admin" : null,
      needs_attention: !!live.needsAttention, attention_reason: live.attentionReason || "The AI flagged this conversation for staff review.",
      needs_follow_up: false, is_unread: true, has_unreplied: last?.source === "customer", last_message_role: last?.source === "customer" ? "user" : "assistant",
      last_message: last?.text || "No messages yet", last_message_at: last?.createdAt || new Date().toISOString(), sample: false,
      lead: { temperature: live.lead?.temperature || "cold", treatment: live.lead?.interests?.[0] || "Not detected", summary: live.lead?.summary || "Live prospect conversation", branch: live.lead?.preferredBranch || "Unassigned", timing: live.lead?.preferredTiming || "Not specified" },
    };
  }, [live]);

  const conversations = useMemo(() => [liveConversation, ...SAMPLE_LEADS.map(sampleConversation)].filter(Boolean), [liveConversation]);
  const selected = conversations.find((c) => c.contact_id === selectedId) || conversations[0] || null;
  const messages = useMemo(() => {
    if (!selected) return [];
    if (selected.contact_id === "live") return (live?.messages || []).map((m, i) => ({ id: m.id || `live-${i}`, role: m.source === "customer" ? "user" : "assistant", source: m.source, content: m.text, created_at: m.createdAt || new Date().toISOString() }));
    return portalMessages(selected.lead).map((m) => ({ ...m, content: m.text }));
  }, [selected, live]);

  function selectConversation(id) { setSelectedId(id); setMobileThreadOpen(true); setDetailsOpen(false); }

  async function changeMode(mode) {
    if (selected?.contact_id !== "live" || !live) return;
    const id = sessionStorage.getItem("clinicDemoSessionId"); if (!id) return;
    setSending(true);
    try { await fetch(`/api/demo/sessions/${encodeURIComponent(id)}/mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) }); await loadLive(); }
    finally { setSending(false); }
  }

  async function sendStaff(text) {
    if (!text.trim() || selected?.contact_id !== "live" || live?.mode !== "human") return;
    const id = sessionStorage.getItem("clinicDemoSessionId"); if (!id) return;
    setSending(true);
    try { await fetch(`/api/demo/sessions/${encodeURIComponent(id)}/staff-message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() }) }); await loadLive(); }
    finally { setSending(false); }
  }

  return (
    <div className="flex h-full bg-[var(--color-bg)]">
      <ConversationList conversations={conversations} selectedId={selected?.contact_id} onSelect={selectConversation} mobileThreadOpen={mobileThreadOpen} />
      <Thread contact={selected} messages={messages} live={live} sending={sending} onBack={() => setMobileThreadOpen(false)} mobileThreadOpen={mobileThreadOpen} onDetails={() => setDetailsOpen(true)} onMode={changeMode} onSend={sendStaff} />
      <Details open={detailsOpen} contact={selected} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}

function ConversationList({ conversations, selectedId, onSelect, mobileThreadOpen }) {
  const [filters, setFilters] = useState({ status: "all", channel: "all", owner: "all", query: "" });
  const counts = useMemo(() => ({
    all: conversations.length,
    unreplied: conversations.filter((c) => c.has_unreplied || c.last_message_role === "user").length,
    "follow-up": conversations.filter((c) => c.needs_follow_up).length,
    unread: conversations.filter((c) => c.is_unread).length,
    attention: conversations.filter((c) => c.needs_attention).length,
  }), [conversations]);
  const filtered = useMemo(() => conversations.filter((c) => {
    if (filters.status === "unreplied" && !(c.has_unreplied || c.last_message_role === "user")) return false;
    if (filters.status === "follow-up" && !c.needs_follow_up) return false;
    if (filters.status === "unread" && !c.is_unread) return false;
    if (filters.status === "attention" && !c.needs_attention) return false;
    if (filters.channel !== "all" && c.channel !== filters.channel) return false;
    if (filters.owner !== "all" && c.mode !== filters.owner) return false;
    const q = filters.query.trim().toLowerCase();
    return !q || [displayName(c), c.whatsapp_number, c.last_message].filter(Boolean).join(" ").toLowerCase().includes(q);
  }), [conversations, filters]);
  const active = filters.status !== "all" || filters.channel !== "all" || filters.owner !== "all" || filters.query;
  const update = (k, v) => setFilters((x) => ({ ...x, [k]: v }));
  const clear = () => setFilters({ status: "all", channel: "all", owner: "all", query: "" });

  return <aside className={`${mobileThreadOpen ? "hidden md:flex" : "flex"} h-full w-full shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:w-[21.5rem] lg:w-[23rem] xl:w-[24.5rem]`} aria-label="Conversation inbox">
    <header className="shrink-0 border-b border-[var(--color-border)] px-4 pb-4 pt-5 sm:px-5">
      <div className="flex items-start justify-between gap-3"><div><h1 className="font-display text-xl font-bold tracking-[-0.02em]">Inbox</h1><p className="mt-1 text-xs text-[var(--color-text-muted)]">{active ? `${filtered.length} shown from ${conversations.length}` : `${conversations.length} conversations`}</p></div>{active && <button onClick={clear} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]">Clear all</button>}</div>
      <div className="relative mt-4"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"/><input type="search" value={filters.query} onChange={(e)=>update("query",e.target.value)} placeholder="Search conversations" className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-2.5 pl-9 pr-9 text-xs outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-light)]"/>{filters.query && <button onClick={()=>update("query","")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-white"><CloseIcon className="h-3.5 w-3.5"/></button>}</div>
      <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">{STATUS_FILTERS.map(([key,label])=>{const is=filters.status===key;return <button key={key} onClick={()=>update("status",key)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${is?"border-[var(--color-primary)] bg-[var(--color-primary)] text-white":"border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40"}`}><span>{label}</span><span className={`rounded-full px-1.5 py-0.5 text-[9px] leading-none ${is?"bg-white/20":"bg-[var(--color-bg)]"}`}>{counts[key]}</span></button>})}</div>
      <div className="mt-2 grid grid-cols-2 gap-2"><FilterSelect value={filters.channel} onChange={(v)=>update("channel",v)} options={[["all","All channels"],["whatsapp","WhatsApp"],["facebook","Facebook"],["instagram","Instagram"]]}/><FilterSelect value={filters.owner} onChange={(v)=>update("owner",v)} options={[["all","AI + staff"],["ai","AI controlled"],["human","Staff controlled"]]}/></div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-2">{filtered.length===0?<Empty/>:filtered.map((c)=><button key={c.contact_id} onClick={()=>onSelect(c.contact_id)} className={`group relative mb-1 w-full rounded-xl px-3 py-3 text-left outline-none transition ${c.contact_id===selectedId?"bg-[var(--color-primary-light)] shadow-[inset_0_0_0_1px_rgba(47,111,98,0.12)]":c.needs_attention?"bg-[var(--color-danger-light)]/70 hover:bg-[var(--color-danger-light)]":"hover:bg-[var(--color-bg)]"}`}>{c.contact_id===selectedId&&<span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--color-primary)]"/>}<div className="flex items-start gap-3"><ContactAvatar channel={c.channel} size={44}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${c.is_unread?"font-semibold":"font-medium"}`}>{displayName(c)}</span><span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{formatTime(c.last_message_at)}</span></div><div className="mt-0.5 flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs leading-5 text-[var(--color-text-muted)]">{c.last_message_role==="assistant"?"You: ":""}{c.last_message}</p>{c.is_unread&&<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-primary)] ring-4 ring-[var(--color-primary-light)]"/>}</div><div className="mt-2 flex items-center gap-1.5"><ModeBadge mode={c.mode}/>{c.needs_follow_up&&<Tiny tone="accent">Follow-up</Tiny>}{c.needs_attention&&<Tiny tone="danger">Attention</Tiny>}</div></div></div></button>)}</div>
  </aside>;
}

function FilterSelect({ value, onChange, options }) { return <label className="relative block"><select value={value} onChange={(e)=>onChange(e.target.value)} className="w-full appearance-none rounded-lg border border-[var(--color-border)] bg-white py-2 pl-2.5 pr-7 text-[11px] font-medium outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-text-muted)]"/></label>; }
function Empty(){return <div className="px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-light)] text-[var(--color-primary)]"><ChatOutlineIcon className="h-5 w-5"/></div><p className="mt-4 text-sm font-semibold">No matching conversations</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Try changing your search or filters.</p></div>}
function Tiny({tone,children}){return <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone==="danger"?"bg-[var(--color-danger-light)] text-[var(--color-danger)]":"bg-[var(--color-accent-light)] text-[#8a5d13]"}`}>{children}</span>}
function ModeBadge({mode}){return <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${mode==="human"?"bg-[#eef1ff] text-[#5059a8]":"bg-[var(--color-primary-light)] text-[var(--color-primary)]"}`}>{mode==="human"?<UserIcon className="h-2.5 w-2.5"/>:<BotIcon className="h-2.5 w-2.5"/>}{mode==="human"?"Staff":"AI"}</span>}
function ChannelBadge({channel}){const label={whatsapp:"WhatsApp",instagram:"Instagram",facebook:"Facebook"}[channel]||"WhatsApp";return <span className="rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[9px] font-semibold text-[var(--color-text-muted)]">{label}</span>}

function Thread({ contact, messages, live, sending, onBack, mobileThreadOpen, onDetails, onMode, onSend }) {
  const [draft,setDraft]=useState("");
  if(!contact)return <div className="hidden flex-1 items-center justify-center bg-[var(--color-bg)] md:flex"><Empty/></div>;
  const isLive=contact.contact_id==="live";
  async function submit(e){e.preventDefault();if(!draft.trim())return;await onSend(draft);setDraft("")}
  return <section className={`${mobileThreadOpen?"flex":"hidden md:flex"} min-w-0 flex-1 flex-col h-full bg-[var(--color-bg)]`} aria-label={`Conversation with ${displayName(contact)}`}>
    <header className="relative z-10 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_8px_rgba(24,39,33,0.04)]"><div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><button onClick={onBack} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] md:hidden"><ArrowLeftIcon className="h-5 w-5"/></button><button onClick={onDetails} className="shrink-0 rounded-full outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"><ContactAvatar channel={contact.channel} size={44}/></button><div className="min-w-0"><h2 className="truncate font-display text-[15px] font-bold sm:text-base">{displayName(contact)}</h2><div className="mt-1 flex items-center gap-1.5"><ChannelBadge channel={contact.channel}/><ModeBadge mode={contact.mode}/><span className="truncate text-[10px] text-[var(--color-text-muted)] sm:text-[11px]">{contact.whatsapp_number}</span></div></div></div><div className="flex shrink-0 items-center gap-2">{isLive?(contact.mode==="human"?<button disabled={sending} onClick={()=>onMode("ai")} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--color-bg)]"><BotIcon className="h-4 w-4"/>Return to AI</button>:<button disabled={sending} onClick={()=>onMode("human")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]"><UserIcon className="h-4 w-4"/>Take over</button>):<span className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-[10px] font-semibold text-[var(--color-text-muted)]">Sample history · Read only</span>}<button className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"><MoreIcon className="h-5 w-5"/></button></div></div>{contact.needs_attention&&<div className="flex items-start gap-2 border-t border-[var(--color-danger)]/15 bg-[var(--color-danger-light)] px-5 py-2.5 text-[var(--color-danger)]"><AlertIcon className="mt-0.5 h-4 w-4"/><div><p className="text-xs font-semibold">Needs attention</p><p className="text-[11px] opacity-80">{contact.attention_reason}</p></div></div>}</header>
    <div className="inbox-thread-bg min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5 sm:py-6"><div className="mx-auto w-full max-w-4xl space-y-3">{messages.length===0?<div className="py-16 text-center"><ChatOutlineIcon className="mx-auto h-8 w-8 text-[var(--color-primary)]"/><p className="mt-3 text-sm font-semibold">No messages yet</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">Send a message from Patient View.</p></div>:messages.map((m)=><Message key={m.id} m={m}/>)}</div></div>
    <form onSubmit={submit} className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 shadow-[0_-4px_14px_rgba(24,39,33,0.03)] sm:px-5"><div className="mx-auto w-full max-w-4xl">{!isLive?<div className="rounded-xl bg-[var(--color-bg)] px-4 py-3 text-center text-xs text-[var(--color-text-muted)]">Historical sample conversations are read only.</div>:contact.mode!=="human"?<div className="rounded-xl bg-[var(--color-primary-light)] px-4 py-3 text-center text-xs font-medium text-[var(--color-primary)]">AI is handling this conversation. Take over to reply as clinic staff.</div>:<div className="flex items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-sm focus-within:border-[var(--color-primary)]"><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} rows="1" placeholder="Reply to patient…" className="min-h-10 max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"/><button disabled={sending||!draft.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white disabled:opacity-40"><SendIcon className="h-4 w-4"/></button></div>}</div></form>
  </section>;
}
function Message({m}){const outgoing=m.source!=="user"&&m.source!=="customer";return <div className={`flex ${outgoing?"justify-end":"justify-start"}`}><div className={`relative max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 shadow-sm sm:max-w-[72%] ${outgoing?"bubble-out rounded-br-md bg-[var(--color-primary)] text-white":"bubble-in rounded-bl-md border border-[var(--color-border)] bg-white text-[var(--color-text)]"}`}><p className="whitespace-pre-wrap">{m.content}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${outgoing?"text-white/65":"text-[var(--color-text-muted)]"}`}>{m.source==="staff"&&<span>Clinic staff · </span>}<span>{new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div></div></div>}
function Details({open,contact,onClose}){if(!open||!contact)return null;return <><button aria-label="Close details" onClick={onClose} className="fixed inset-0 z-40 bg-black/15"/><aside className="fixed right-0 top-0 z-50 h-full w-[min(24rem,92vw)] overflow-y-auto border-l border-[var(--color-border)] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--color-text-muted)]">Contact details</p><h2 className="mt-1 font-display text-lg font-bold">{displayName(contact)}</h2></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--color-bg)]"><CloseIcon className="h-4 w-4"/></button></div><div className="mt-6 flex items-center gap-3"><ContactAvatar channel={contact.channel} size={52}/><div><strong className="text-sm">{displayName(contact)}</strong><p className="mt-1 text-xs text-[var(--color-text-muted)]">{contact.whatsapp_number}</p></div></div><div className="mt-6 space-y-4">{[["Lead temperature",contact.lead?.temperature?.toUpperCase()],["Treatment",contact.lead?.treatment],["Branch",contact.lead?.branch],["Timing",contact.lead?.timing],["Conversation summary",contact.lead?.summary]].map(([k,v])=><div key={k} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--color-text-muted)]">{k}</p><p className="mt-2 text-sm leading-6">{v||"—"}</p></div>)}</div></aside></>}

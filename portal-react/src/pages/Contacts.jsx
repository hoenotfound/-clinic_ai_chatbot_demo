import { useMemo, useState } from "react";
import ContactAvatar from "../components/ContactAvatar";
import { SAMPLE_LEADS } from "../demoData";
import { industryProfile, isRenovationDemo } from "../config/industryProfile";

function normalizedLocation(contact) {
  if (!isRenovationDemo) return contact.branch;
  const text = `${contact.branch || ""} ${contact.summary || ""}`;
  if (/puchong|cheras|kajang/i.test(text)) return "Cheras / Kajang / Puchong";
  if (/petaling jaya|\bpj\b|subang|shah alam|ara damansara|damansara/i.test(text)) return "Petaling Jaya / Subang / Shah Alam";
  return "Kuala Lumpur";
}

export default function Contacts() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const contacts = useMemo(() => SAMPLE_LEADS.filter((lead) => [lead.name, lead.phone, lead.treatment, normalizedLocation(lead), lead.summary].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const selected = SAMPLE_LEADS.find((lead) => lead.id === selectedId);
  const searchPlaceholder = isRenovationDemo ? "Search by name, number, social ID or project…" : "Search by name, number or social ID…";

  return (
    <div className="flex h-full min-w-0 bg-[var(--color-bg)]">
      <div className={`${selected ? "hidden md:flex" : "flex"} h-full w-full min-w-0 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-border)] bg-white md:w-80`}>
        <div className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-white px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div><h1 className="font-display text-lg font-bold">Contacts</h1><p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{contacts.length} contacts · sample demo data</p></div>
            <button disabled title="Available in production" className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-medium text-white opacity-60">+ Add · Production</button>
          </div>
          <input className="mt-3 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {contacts.map((contact) => (
          <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`relative w-full border-b border-[var(--color-border)] px-4 py-3.5 text-left transition sm:px-5 ${contact.id === selectedId ? "bg-[var(--color-primary-light)]" : contact.attention ? "bg-[var(--color-danger-light)]" : "hover:bg-[var(--color-bg)]"}`}>
            <div className="flex items-center gap-3"><ContactAvatar channel={contact.channel} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{contact.name}</span><span className="text-[10px] text-[var(--color-text-muted)]">{contact.language}</span></div><p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{contact.phone} · {contact.treatment}</p></div></div>
          </button>
        ))}
      </div>
      <div className={`${selected ? "block" : "hidden md:block"} min-w-0 flex-1 overflow-y-auto`}>{selected ? <Profile contact={selected} back={() => setSelectedId(null)} /> : <div className="flex h-full items-center justify-center px-6 text-center"><p className="text-sm text-[var(--color-text-muted)]">Select a contact to view their profile.</p></div>}</div>
    </div>
  );
}

function Profile({ contact, back }) {
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);

  function addNote() {
    const value = note.trim();
    if (!value) return;
    setNotes((current) => [{ id: Date.now(), text: value }, ...current]);
    setNote("");
  }

  const location = normalizedLocation(contact);

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <button onClick={back} className="mb-4 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-primary)] md:hidden">← Back to contacts</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4"><ContactAvatar channel={contact.channel} size={64} /><div><h1 className="font-display text-2xl font-bold">{contact.name}</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">{contact.phone}</p><div className="mt-2 flex gap-2"><span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[9px] font-semibold text-[var(--color-primary)]">{contact.channel}</span><span className="rounded-full bg-[var(--color-accent-light)] px-2 py-1 text-[9px] font-semibold">{contact.language}</span></div></div></div>
        <button disabled title="Available in production" className="cursor-not-allowed rounded-xl border border-[var(--color-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] opacity-60">Edit contact · Production</button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm"><h2 className="font-display text-sm font-bold">Contact details</h2><Facts rows={[[industryProfile.terms.service, contact.treatment], [industryProfile.terms.location, location], [industryProfile.terms.timing, contact.timing], ["Source", contact.source], ["Owner", contact.owner], ["Language", contact.language]]} /></section>
        <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm"><h2 className="font-display text-sm font-bold">AI insights</h2><div className="mt-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${contact.temperature === "hot" ? "bg-[var(--color-danger-light)] text-[var(--color-danger)]" : contact.temperature === "warm" ? "bg-[var(--color-accent-light)] text-[#8a641f]" : "bg-slate-100 text-slate-600"}`}>{contact.temperature}</span><p className="mt-4 text-sm leading-6">{contact.summary}</p></div></section>
      </div>
      <section className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <div className="flex justify-between"><h2 className="font-display text-sm font-bold">Notes</h2><span className="text-[10px] text-[var(--color-text-muted)]">Demo workspace · local only</span></div>
        <textarea placeholder="Add an internal note…" rows="3" value={note} onChange={(event) => setNote(event.target.value)} className="mt-4 w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm outline-none focus:border-[var(--color-primary)]" />
        <button onClick={addNote} disabled={!note.trim()} className="mt-2 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Add demo note</button>
        {notes.length > 0 && <div className="mt-4 space-y-2">{notes.map((item) => <div key={item.id} className="rounded-xl bg-[var(--color-bg)] p-3 text-xs leading-5">{item.text}</div>)}</div>}
      </section>
    </div>
  );
}

function Facts({ rows }) {
  return <dl className="mt-4 divide-y divide-[var(--color-border)]">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-xs"><dt className="text-[var(--color-text-muted)]">{label}</dt><dd className="text-right font-medium">{value || "—"}</dd></div>)}</dl>;
}

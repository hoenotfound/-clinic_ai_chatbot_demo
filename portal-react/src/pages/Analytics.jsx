import { useMemo, useState } from "react";
import { ANALYTICS, SAMPLE_LEADS } from "../demoData";

const PRESETS = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom range"]];
const DEFAULT_FILTERS = { preset: "30", branch: "all", channel: "all", source: "all", campaign: "all", treatment: "all", owner: "all" };

function dateFactor(preset) {
  if (preset === "7") return 0.25;
  if (preset === "90") return 2.7;
  return 1;
}

function matchesLead(lead, filters) {
  if (filters.branch !== "all" && lead.branch !== filters.branch) return false;
  if (filters.channel !== "all" && lead.channel !== filters.channel) return false;
  if (filters.source !== "all" && lead.source !== filters.source) return false;
  if (filters.campaign !== "all" && !(filters.campaign === "Demo" && lead.source === "Meta Ads")) return false;
  if (filters.treatment !== "all" && lead.treatment !== filters.treatment) return false;
  if (filters.owner !== "all" && lead.owner !== filters.owner) return false;
  return true;
}

export default function Analytics() {
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_FILTERS);
  const [more, setMore] = useState(false);
  const [tab, setTab] = useState("Source");

  const filteredSample = useMemo(() => SAMPLE_LEADS.filter((lead) => matchesLead(lead, applied)), [applied]);
  const dimensionFilterActive = ["branch", "channel", "source", "campaign", "treatment", "owner"].some((key) => applied[key] !== "all");
  const factor = dateFactor(applied.preset);
  const sampleRatio = dimensionFilterActive ? filteredSample.length / SAMPLE_LEADS.length : 1;

  const a = useMemo(() => {
    const scale = (value) => Math.max(0, Math.round(value * factor * sampleRatio));
    const tempCount = (temperature) => SAMPLE_LEADS.filter((lead) => lead.temperature === temperature).length || 1;
    const filteredTempCount = (temperature) => filteredSample.filter((lead) => lead.temperature === temperature).length;
    const qualityScale = (value, temperature) => {
      const ratio = dimensionFilterActive ? filteredTempCount(temperature) / tempCount(temperature) : 1;
      return Math.max(0, Math.round(value * factor * ratio));
    };
    return {
      ...ANALYTICS,
      newLeads: scale(ANALYTICS.newLeads),
      appointments: scale(ANALYTICS.appointments),
      visits: scale(ANALYTICS.visits),
      won: scale(ANALYTICS.won),
      leadQuality: {
        hot: qualityScale(ANALYTICS.leadQuality.hot, "hot"),
        warm: qualityScale(ANALYTICS.leadQuality.warm, "warm"),
        cold: qualityScale(ANALYTICS.leadQuality.cold, "cold"),
      },
    };
  }, [factor, filteredSample, sampleRatio, dimensionFilterActive]);

  const funnel = useMemo(() => [
    ["New Leads", a.newLeads, 100],
    ["Appointments", a.appointments, a.newLeads ? (a.appointments / a.newLeads) * 100 : 0],
    ["Clinic Visits", a.visits, a.newLeads ? (a.visits / a.newLeads) * 100 : 0],
    ["Won", a.won, a.newLeads ? (a.won / a.newLeads) * 100 : 0],
  ], [a]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const reset = () => {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-4 sm:px-5 sm:py-5 lg:px-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2.5"><h1 className="font-display text-xl font-bold">Analytics</h1><span className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Sales</span><span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-text-muted)]">Sample demo data</span></div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--color-text-muted)] sm:text-sm">Track lead quality, conversion, response speed and sales outcomes. <span className="hidden sm:inline">Demo filters recalculate the sample metrics so prospects can explore the workspace.</span></p></div>
          <button onClick={reset} aria-label="Reset analytics filters" title="Reset demo filters" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-lg font-semibold text-[var(--color-text-muted)] shadow-sm hover:bg-[var(--color-bg)]">↻</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-end">
          <Filter label="Date range" value={draft.preset} onChange={(value) => updateDraft("preset", value)} options={PRESETS} />
          <Filter label="Branch" value={draft.branch} onChange={(value) => updateDraft("branch", value)} options={[["all", "All branches"], ["Kuala Lumpur", "Kuala Lumpur"], ["Petaling Jaya", "Petaling Jaya"]]} />
          <Filter label="Channel" value={draft.channel} onChange={(value) => updateDraft("channel", value)} options={[["all", "All channels"], ["whatsapp", "WhatsApp"], ["instagram", "Instagram"], ["facebook", "Facebook"]]} />
          <button onClick={() => setMore(!more)} className={`h-11 rounded-xl border px-3.5 text-xs font-semibold ${more ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"}`}>Filters</button>
          <button onClick={() => setApplied({ ...draft })} className="h-11 rounded-xl bg-[var(--color-primary)] px-4 text-xs font-bold text-white shadow-sm">Apply</button>
        </div>
        {more && (
          <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 sm:grid-cols-4">
            <Filter label="Source" value={draft.source} onChange={(value) => updateDraft("source", value)} options={[["all", "All sources"], ["Meta Ads", "Meta Ads"], ["Organic", "Organic"], ["Referral", "Referral"]]} />
            <Filter label="Campaign" value={draft.campaign} onChange={(value) => updateDraft("campaign", value)} options={[["all", "All campaigns"], ["Demo", "Demo Clinic Campaign"]]} />
            <Filter label="Treatment" value={draft.treatment} onChange={(value) => updateDraft("treatment", value)} options={[["all", "All treatments"], ["HIFU Skin Lifting", "HIFU"], ["Pico Laser", "Pico Laser"], ["Skin Booster", "Skin Booster"], ["Botulinum Toxin", "Botulinum Toxin"]]} />
            <Filter label="Owner" value={draft.owner} onChange={(value) => updateDraft("owner", value)} options={[["all", "All owners"], ["Mira", "Mira"], ["Sarah", "Sarah"], ["Unassigned", "Unassigned"]]} />
          </div>
        )}
      </header>

      <main className="space-y-4 px-3.5 py-4 sm:space-y-5 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-5">
          <Metric label="New Leads" value={a.newLeads} delta="Sample" detail="Lead journeys started in this filtered period" />
          <Metric label="Appointments" value={a.appointments} delta="Sample" detail="First appointment stage entered" />
          <Metric label="Clinic Visits" value={a.visits} delta="Sample" detail="First visit stage entered" />
          <Metric label="Won" value={a.won} delta="Sample" detail="Estimated closed outcomes" />
          <Metric className="col-span-2 xl:col-span-1" label="Cohort Conversion" value={`${a.newLeads ? ((a.won / a.newLeads) * 100).toFixed(1) : "0.0"}%`} delta="Sample" detail="Leads started → Won" />
        </section>
        <section className="grid grid-cols-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm"><Rate label="Appointment rate" value={`${a.newLeads ? ((a.appointments / a.newLeads) * 100).toFixed(1) : "0.0"}%`} detail="Lead → appointment" /><Rate label="Show rate" value={`${a.appointments ? ((a.visits / a.appointments) * 100).toFixed(1) : "0.0"}%`} detail="Appointment → visit" /><Rate label="Close rate" value={`${a.visits ? ((a.won / a.visits) * 100).toFixed(1) : "0.0"}%`} detail="Visit → won" /></section>
        <section className="grid gap-4 sm:gap-5 xl:grid-cols-[0.85fr_1.15fr]"><Panel title="Conversion Funnel" subtitle="How the selected sample cohort progresses through the sales journey."><div className="space-y-4">{funnel.map(([name, count, pct], index) => <div key={name}><div className="mb-1.5 flex items-end justify-between"><div><strong className="text-xs">{name}</strong>{index > 0 && <p className="text-[10px] text-[var(--color-text-muted)]">{pct.toFixed(1)}% of leads</p>}</div><b className="font-display text-lg">{count}</b></div><div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-bg)]"><div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div></div>)}</div></Panel><Panel title="Activity Over Time" subtitle="Illustrative daily activity for the selected demo period."><Trend scale={Math.max(0.2, Math.min(1, sampleRatio || 0.2))} /></Panel></section>
        <section className="grid gap-4 sm:gap-5 xl:grid-cols-2"><Panel title="Lead Quality" subtitle="Current Hot / Warm / Cold status for the selected sample cohort."><Quality a={a} /></Panel><Panel title="Response Performance" subtitle="Illustrative response performance in the demo workspace."><div className="grid grid-cols-2 gap-3"><Mini label="Average AI response" value={a.avgResponse} /><Mini label="Handled by AI" value={`${a.aiHandled}%`} /><Mini label="Staff takeover" value={`${a.staffTakeover}%`} /><Mini label="Within 10 seconds" value="96%" /></div></Panel></section>
        <Panel title="Performance Breakdown" subtitle="Compare which sources, campaigns, treatments, branches, channels and owners drive results."><div className="flex gap-1.5 overflow-x-auto pb-3">{["Source", "Campaign", "Treatment", "Branch", "Channel", "Owner"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${tab === item ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"}`}>{item}</button>)}</div><Breakdown tab={tab} /></Panel>
        <section className="grid gap-4 sm:gap-5 xl:grid-cols-3"><Panel title="Follow-up Performance" subtitle="Illustrative follow-up contribution."><StatRows rows={[["Follow-ups sent", "41"], ["Re-engaged leads", "18"], ["Converted after follow-up", "7"]]} /></Panel><Panel title="Lost Reasons" subtitle="Why sample opportunities did not progress."><StatRows rows={[["No response", "12"], ["Price / budget", "8"], ["Not ready yet", "6"], ["Other", "4"]]} /></Panel><Panel title="System Health" subtitle="Demo automation status."><StatRows rows={[["AI receptionist", "Active"], ["Lead temperature", "Active"], ["Automated follow-up", "Active"], ["Human handoff", "Ready"]]} /></Panel></section>
      </main>
    </div>
  );
}

function Filter({ label, value, onChange, options }) {
  return <label className="min-w-0"><span className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-[9rem] rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-medium outline-none focus:border-[var(--color-primary)]">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
function Metric({ label, value, delta, detail, className = "" }) { return <div className={`rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm ${className}`}><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p><div className="mt-2 flex items-end justify-between gap-2"><strong className="font-display text-2xl font-bold">{value}</strong><span className="text-[10px] font-semibold text-[var(--color-primary)]">{delta}</span></div><p className="mt-2 text-[10px] leading-4 text-[var(--color-text-muted)]">{detail}</p></div>; }
function Rate({ label, value, detail }) { return <div className="border-r border-[var(--color-border)] p-3 text-center last:border-r-0 sm:p-4"><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p><strong className="mt-1 block font-display text-lg font-bold sm:text-xl">{value}</strong><p className="mt-1 text-[9px] text-[var(--color-text-muted)]">{detail}</p></div>; }
function Panel({ title, subtitle, children }) { return <section className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm sm:p-5"><h2 className="font-display text-sm font-bold sm:text-base">{title}</h2><p className="mt-1 text-[10px] leading-4 text-[var(--color-text-muted)] sm:text-xs">{subtitle}</p><div className="mt-5">{children}</div></section>; }
function Trend({ scale }) { const pts = [42, 51, 45, 65, 58, 74, 70, 84, 77, 91, 86, 98].map((value) => value * scale); return <div className="overflow-x-auto"><svg viewBox="0 0 600 220" className="w-full min-w-[520px]" aria-label="Leads over time"><g stroke="#e6e5de" strokeWidth="1">{[40, 80, 120, 160, 200].map((y) => <line key={y} x1="20" y1={y} x2="580" y2={y} />)}</g><polyline fill="none" stroke="#2f6f62" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pts.map((value, index) => `${25 + index * 50},${200 - value * 1.55}`).join(" ")} />{pts.map((value, index) => <circle key={index} cx={25 + index * 50} cy={200 - value * 1.55} r="4" fill="#fff" stroke="#2f6f62" strokeWidth="3" />)}</svg></div>; }
function Quality({ a }) { const total = Math.max(1, a.leadQuality.hot + a.leadQuality.warm + a.leadQuality.cold); return <div className="space-y-4">{[["Hot", a.leadQuality.hot, "bg-[var(--color-danger)]"], ["Warm", a.leadQuality.warm, "bg-[var(--color-accent)]"], ["Cold", a.leadQuality.cold, "bg-slate-400"]].map(([label, value, color]) => <div key={label}><div className="mb-1.5 flex justify-between text-xs"><span>{label}</span><strong>{value}</strong></div><div className="h-2.5 rounded-full bg-[var(--color-bg)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${(value / total) * 100}%` }} /></div></div>)}</div>; }
function Mini({ label, value }) { return <div className="rounded-xl bg-[var(--color-bg)] p-3"><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p><strong className="mt-1 block font-display text-lg">{value}</strong></div>; }
function Breakdown({ tab }) { const rows = tab === "Channel" ? [["WhatsApp", "68%", "19 won"], ["Instagram", "24%", "6 won"], ["Facebook", "8%", "2 won"]] : tab === "Treatment" ? [["HIFU", "38 leads", "7 won"], ["Pico Laser", "31 leads", "4 won"], ["Skin Booster", "22 leads", "4 won"], ["Botulinum Toxin", "17 leads", "2 won"]] : tab === "Owner" ? [["Mira", "51 leads", "8 won"], ["Sarah", "49 leads", "7 won"], ["Unassigned", "26 leads", "2 won"]] : tab === "Branch" ? [["Kuala Lumpur", "69 leads", "10 won"], ["Petaling Jaya", "57 leads", "7 won"]] : [["Meta Ads", "74 leads", "12 won"], ["Organic", "31 leads", "3 won"], ["Referral", "21 leads", "2 won"]]; return <div className="divide-y divide-[var(--color-border)]">{rows.map((row) => <div key={row[0]} className="grid grid-cols-3 gap-2 py-3 text-xs"><strong>{row[0]}</strong><span className="text-[var(--color-text-muted)]">{row[1]}</span><span className="text-right font-semibold text-[var(--color-primary)]">{row[2]}</span></div>)}</div>; }
function StatRows({ rows }) { return <div className="divide-y divide-[var(--color-border)]">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3 text-xs"><span className="text-[var(--color-text-muted)]">{label}</span><strong>{value}</strong></div>)}</div>; }

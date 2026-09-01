import { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, useToasts } from "../components/Toast";

const LANGS = [
  { key: "en", label: "English" },
  { key: "ms", label: "Bahasa Malaysia" },
  { key: "zh", label: "中文" },
];

const DEFAULTS = {
  en: "Hi! Just checking in to see if you still need any help. Feel free to reply whenever you're ready 😊",
  ms: "Hai! Saya cuma ingin bertanya sama ada anda masih memerlukan bantuan. Balas sahaja apabila anda sudah bersedia 😊",
  zh: "嗨！想跟进一下，看看您是否还需要任何帮助。方便时回复我们就可以了 😊",
};

export default function Tools() {
  const [active, setActive] = useState("followUp");
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState(120);
  const [trigger, setTrigger] = useState("all");
  const [message, setMessage] = useState(DEFAULTS.en);
  const [translations, setTranslations] = useState(DEFAULTS);
  const [lang, setLang] = useState("en");
  const [scenario, setScenario] = useState("idle");
  const [scoring, setScoring] = useState({ enabled: true, inactivity: 10, maxMinutes: 60, maxMessages: 40 });
  const timers = useRef([]);
  const { toasts, showToast, dismissToast } = useToasts();

  const delayLabel = useMemo(() => {
    if (delay < 60) return `${delay} minutes`;
    return delay % 60 ? `${Math.floor(delay / 60)}h ${delay % 60}m` : `${delay / 60} hours`;
  }, [delay]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function fakeSave(text) {
    showToast(`${text} Demo settings are not connected to a real clinic.`, "info");
  }

  function runFollowUpDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScenario("waiting");
    timers.current.push(setTimeout(() => setScenario("checking"), 650));
    timers.current.push(setTimeout(() => setScenario("sent"), 1450));
  }

  function resetFollowUpDemo() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setScenario("idle");
  }

  return (
    <div className="flex h-full min-w-0 overflow-hidden bg-[var(--color-bg)]">
      <aside className="hidden h-full w-72 shrink-0 border-r border-[var(--color-border)] bg-white p-4 md:block">
        <div className="px-2 pb-4">
          <h1 className="font-display text-xl font-bold">Tools</h1>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">Configure automation that helps your team respond and follow up.</p>
        </div>
        <ToolNav active={active} setActive={setActive} />
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="border-b border-[var(--color-border)] bg-white px-4 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <div><h1 className="font-display text-xl font-bold">Tools</h1><p className="mt-1 text-xs text-[var(--color-text-muted)]">Automation workspace</p></div>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-[9px] font-semibold">Demo</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            <button onClick={() => setActive("followUp")} className={mobileClass(active === "followUp")}>Automated follow-up</button>
            <button onClick={() => setActive("scoring")} className={mobileClass(active === "scoring")}>Lead temperature</button>
          </div>
        </div>

        {active === "followUp" ? (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-7">
            <PageHead eyebrow="Automated follow-up" title="Reconnect with enquiries automatically" copy="Show prospects exactly what happens when a warm lead goes quiet — from inactivity detection to an automatic follow-up message." active={enabled} />

            <div className="mt-6 space-y-5">
              <FollowUpScenario
                scenario={scenario}
                run={runFollowUpDemo}
                reset={resetFollowUpDemo}
                delayLabel={delayLabel}
                message={translations[lang]}
                language={LANGS.find((item) => item.key === lang)?.label || "English"}
                enabled={enabled}
              />

              <div className="grid gap-5 xl:grid-cols-[1fr_21rem]">
                <div className="space-y-5">
                  <Card n="1" title="Choose when it sends" copy="The timer starts after the latest AI or staff reply.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Wait before sending">
                        <select value={delay} onChange={(event) => setDelay(Number(event.target.value))} className={inputClass()}>
                          {[[30, "30 min"], [60, "1 hour"], [120, "2 hours"], [360, "6 hours"], [720, "12 hours"], [1380, "23 hours"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </Field>
                      <Field label="Timer trigger">
                        <select value={trigger} onChange={(event) => setTrigger(event.target.value)} className={inputClass()}>
                          <option value="all">AI or staff messages</option>
                          <option value="staff">Staff messages only</option>
                        </select>
                      </Field>
                    </div>
                    <div className="mt-4 rounded-xl bg-[var(--color-primary-light)] p-3 text-xs leading-5 text-[var(--color-primary)]">The demo scenario uses <strong>{delayLabel}</strong> of inactivity before the eligibility check runs.</div>
                  </Card>

                  <Card n="2" title="Write the message" copy="A friendly, low-pressure check-in works best.">
                    <Field label="Main message"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="4" className={`${inputClass()} h-auto resize-y py-3`} /></Field>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div><strong className="text-xs">Language versions</strong><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">English, Bahasa Malaysia and Chinese are ready.</p></div>
                      <button onClick={() => { setTranslations({ ...DEFAULTS, en: message }); showToast("Language versions refreshed for the demo.", "info"); }} className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--color-bg)]">Generate translations</button>
                    </div>
                    <div className="mt-3 flex gap-1.5 overflow-x-auto">
                      {LANGS.map((item) => <button key={item.key} onClick={() => setLang(item.key)} className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${lang === item.key ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] bg-white text-[var(--color-text-muted)]"}`}>{item.label}</button>)}
                    </div>
                    <textarea value={translations[lang]} onChange={(event) => setTranslations((current) => ({ ...current, [lang]: event.target.value }))} rows="3" className={`${inputClass()} mt-3 h-auto resize-y py-3`} />
                  </Card>

                  <Card n="3" title="Add a graphic" copy="Optional. Use one clean promotional graphic together with the follow-up.">
                    <button onClick={() => showToast("Graphic upload is disabled in the public demo.", "warning")} className="flex min-h-36 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center hover:border-[var(--color-primary)]/40">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl text-[var(--color-primary)] shadow-sm">＋</span>
                      <strong className="mt-3 text-xs">Choose a JPG or PNG</strong>
                      <span className="mt-1 text-[10px] text-[var(--color-text-muted)]">Optional image · up to 5MB in production</span>
                    </button>
                  </Card>

                  <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-white/95 p-4 shadow-lg backdrop-blur">
                    <div>
                      <div className="flex items-center gap-2"><button onClick={() => setEnabled(!enabled)} className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-[var(--color-primary)]" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} /></button><strong className="text-xs">Automation {enabled ? "active" : "paused"}</strong></div>
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Sample configuration for demonstration.</p>
                    </div>
                    <button onClick={() => fakeSave("Automated follow-up saved visually.")} className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white">Save changes</button>
                  </div>
                </div>

                <aside className="self-start rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm xl:sticky xl:top-5">
                  <div className="flex items-start justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--color-text-muted)]">Customer preview</span><strong className="mt-1 block text-sm">{LANGS.find((item) => item.key === lang)?.label}</strong></div><em className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[9px] not-italic font-semibold text-[var(--color-primary)]">WhatsApp</em></div>
                  <div className="mt-4 min-h-56 rounded-2xl border border-[var(--color-border)] bg-[#f5f7f5] bg-[radial-gradient(circle_at_1px_1px,rgba(47,111,98,.055)_1px,transparent_0)] bg-[length:22px_22px] p-4">
                    <div className="ml-auto max-w-[94%] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-3.5 py-3 text-xs leading-5 text-white shadow-sm"><small className="mb-1 block text-[9px] text-white/65">Nova Demo Clinic</small>{translations[lang]}</div>
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-[var(--color-text-muted)]">Before it sends, the production system checks that the patient has not already replied and that the conversation is still eligible.</p>
                </aside>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-7">
            <PageHead eyebrow="Automatic Lead Temperature" title="Prioritise the enquiries most likely to book" copy="The AI reviews the conversation after it goes quiet and automatically labels leads Hot, Warm or Cold." active={scoring.enabled} />
            <div className="mt-6 space-y-5">
              <Card n="1" title="Choose when scoring runs" copy="Scoring waits until the conversation has been quiet long enough to understand the customer's latest intent.">
                <div className="grid gap-3 md:grid-cols-3">
                  <NumberField label="Quiet period" value={scoring.inactivity} suffix="minutes" set={(value) => setScoring((current) => ({ ...current, inactivity: value }))} />
                  <NumberField label="Conversation ceiling" value={scoring.maxMinutes} suffix="minutes" set={(value) => setScoring((current) => ({ ...current, maxMinutes: value }))} />
                  <NumberField label="Message ceiling" value={scoring.maxMessages} suffix="messages" set={(value) => setScoring((current) => ({ ...current, maxMessages: value }))} />
                </div>
              </Card>
              <Card n="2" title="How the labels work" copy="The demo uses the same sales-intent language your team sees in the production workspace.">
                <div className="grid gap-3 md:grid-cols-3"><Temp color="danger" title="Hot" copy="Strong booking intent, appointment timing, or a clear request to proceed." /><Temp color="accent" title="Warm" copy="Active treatment or pricing interest but no firm booking intent yet." /><Temp color="cold" title="Cold" copy="Early-stage enquiry, low intent, or the latest message shows reduced interest." /></div>
              </Card>
              <Card n="3" title="What happens next" copy="Temperature updates flow into Inbox filters, Pipeline priority and Analytics.">
                <div className="grid gap-3 sm:grid-cols-2"><Info title="Automatic organisation" copy="Every conversation is classified without staff manually tagging leads." /><Info title="Human override" copy="Staff can still update lead stages and take over the conversation whenever needed." /></div>
              </Card>
              <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3"><button onClick={() => setScoring((current) => ({ ...current, enabled: !current.enabled }))} className={`relative h-6 w-11 rounded-full ${scoring.enabled ? "bg-[var(--color-primary)]" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${scoring.enabled ? "left-6" : "left-1"}`} /></button><div><strong className="text-xs">Automatic lead temperature {scoring.enabled ? "active" : "paused"}</strong><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Demo-only setting.</p></div></div>
                <button onClick={() => fakeSave("Lead temperature settings saved visually.")} className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white">Save changes</button>
              </div>
            </div>
          </div>
        )}
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function FollowUpScenario({ scenario, run, reset, delayLabel, message, language, enabled }) {
  const step = scenario === "idle" ? 0 : scenario === "waiting" ? 1 : scenario === "checking" ? 2 : 3;
  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--color-primary)]/20 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-primary-light),white)] px-5 py-4 sm:px-6">
        <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--color-primary)]">LIVE AUTOMATION DEMO</p><h2 className="mt-1 font-display text-lg font-bold">Warm lead goes quiet → AI follows up</h2><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">This is a safe simulation — no real message is sent.</p></div>
        <div className="flex gap-2"><button onClick={reset} className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-semibold">Reset</button><button disabled={!enabled || scenario === "waiting" || scenario === "checking"} onClick={run} className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">Run follow-up demo</button></div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.05fr_.95fr] sm:p-6">
        <div>
          <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div><span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Sample quiet lead</span><strong className="mt-1 block text-sm">Amanda Lee · Pico Laser</strong><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Warm · Kuala Lumpur · no reply after the clinic's last message</p></div>
            <span className="rounded-full bg-[var(--color-accent-light)] px-2.5 py-1 text-[9px] font-bold text-[#8a641f]">WARM</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <ScenarioStep active={step >= 0} current={step === 0} number="1" title="Conversation quiet" copy="Customer stops replying" />
            <ScenarioStep active={step >= 1} current={step === 1} number="2" title="Wait window" copy={scenario === "waiting" ? "Timer running…" : delayLabel} />
            <ScenarioStep active={step >= 2} current={step === 2} number="3" title="Eligibility check" copy={scenario === "checking" ? "No new reply ✓" : "Still eligible"} />
            <ScenarioStep active={step >= 3} current={step === 3} number="4" title="Follow-up sent" copy={scenario === "sent" ? "Re-engagement sent ✓" : "Ready to send"} />
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between"><strong className="text-xs">What the automation checks</strong><span className="text-[9px] font-semibold text-[var(--color-text-muted)]">Demo logic</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3"><Check label="Patient has not replied" active={step >= 2} /><Check label="Conversation still open" active={step >= 2} /><Check label="Follow-up not already sent" active={step >= 2} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[#f5f7f5] p-4">
          <div className="flex items-center justify-between"><div><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--color-text-muted)]">Patient chat preview</span><strong className="mt-1 block text-xs">{language}</strong></div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-[var(--color-primary)] shadow-sm">WhatsApp</span></div>
          <div className="mt-4 space-y-2 text-xs leading-5">
            <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3 py-2.5 shadow-sm">KL is easier. I need to check my work schedule first.</div>
            <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-3 py-2.5 text-white shadow-sm">No problem 😊 Take your time. Let me know if you'd like help choosing a slot.</div>
            {scenario === "waiting" && <StatusBubble>Waiting for {delayLabel} of inactivity…</StatusBubble>}
            {scenario === "checking" && <StatusBubble>Checking for a new patient reply…</StatusBubble>}
            {scenario === "sent" && <div className="ml-auto max-w-[88%] animate-[pulse_650ms_ease-out_1] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-3 py-2.5 text-white shadow-sm"><small className="mb-1 block text-[9px] text-white/65">Automatic follow-up</small>{message}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScenarioStep({ active, current, number, title, copy }) {
  return <div className={`rounded-2xl border p-3 transition-all ${current ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-sm" : active ? "border-[var(--color-border)] bg-white" : "border-[var(--color-border)] bg-[var(--color-bg)] opacity-55"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${active ? "bg-[var(--color-primary)] text-white" : "bg-slate-200 text-slate-500"}`}>{number}</span><strong className="mt-2 block text-[10px]">{title}</strong><small className="mt-1 block text-[9px] leading-4 text-[var(--color-text-muted)]">{copy}</small></div>;
}
function Check({ label, active }) { return <div className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[9px] font-semibold ${active ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`}><span>{active ? "✓" : "○"}</span>{label}</div>; }
function StatusBubble({ children }) { return <div className="mx-auto w-fit animate-pulse rounded-full bg-white px-3 py-1.5 text-[9px] font-semibold text-[var(--color-text-muted)] shadow-sm">{children}</div>; }

function ToolNav({ active, setActive }) {
  return <div className="space-y-2"><button onClick={() => setActive("followUp")} className={navClass(active === "followUp")}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)]">↗</span><span className="min-w-0"><strong className="block text-xs">Automated follow-up</strong><small className="mt-0.5 block text-[10px] font-normal opacity-70">Reconnect quiet enquiries</small></span></button><button onClick={() => setActive("scoring")} className={navClass(active === "scoring")}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-light)] text-[#8a641f]">●</span><span><strong className="block text-xs">Automatic Lead Temperature</strong><small className="mt-0.5 block text-[10px] font-normal opacity-70">Hot / Warm / Cold</small></span></button><div className="mt-5 border-t border-[var(--color-border)] pt-4"><p className="px-3 text-[9px] font-bold uppercase tracking-[.14em] text-[var(--color-text-muted)]">Coming next</p>{["Appointment reminders", "Promotional campaigns", "Review requests"].map((item) => <div key={item} className="mt-1 rounded-xl px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{item}</div>)}</div></div>;
}
function navClass(active) { return `flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-[var(--color-primary-light)] text-[var(--color-text)] shadow-[inset_0_0_0_1px_rgba(47,111,98,.12)]" : "hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`; }
function mobileClass(active) { return `shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${active ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)] bg-white"}`; }
function PageHead({ eyebrow, title, copy, active }) { return <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--color-primary)]">{eyebrow}</p><h1 className="mt-1 font-display text-2xl font-bold tracking-[-.02em]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{copy}</p></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${active ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "bg-slate-100 text-slate-500"}`}>{active ? "Active" : "Paused"}</span></div>; }
function Card({ n, title, copy, children }) { return <section className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{n}</span><div><h2 className="font-display text-base font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{copy}</p></div></div><div className="mt-5">{children}</div></section>; }
function Field({ label, children }) { return <label><span className="mb-1.5 block text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span>{children}</label>; }
function inputClass() { return "h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-light)]"; }
function NumberField({ label, value, suffix, set }) { return <Field label={label}><div className="relative"><input type="number" value={value} onChange={(event) => set(Number(event.target.value))} className={`${inputClass()} pr-20`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-text-muted)]">{suffix}</span></div></Field>; }
function Temp({ color, title, copy }) { const cls = color === "danger" ? "bg-[var(--color-danger-light)] text-[var(--color-danger)]" : color === "accent" ? "bg-[var(--color-accent-light)] text-[#8a641f]" : "bg-slate-100 text-slate-600"; return <div className="rounded-2xl border border-[var(--color-border)] p-4"><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${cls}`}>{title}</span><p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">{copy}</p></div>; }
function Info({ title, copy }) { return <div className="rounded-2xl bg-[var(--color-bg)] p-4"><strong className="text-xs">{title}</strong><p className="mt-1 text-[10px] leading-5 text-[var(--color-text-muted)]">{copy}</p></div>; }

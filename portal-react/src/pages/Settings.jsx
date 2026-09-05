import { useState } from "react";
import { ToastContainer, useToasts } from "../components/Toast";
import { industryProfile } from "../config/industryProfile";

const profile = industryProfile.settings;

export default function Settings() {
  const { toasts, showToast, dismissToast } = useToasts();
  const [tab, setTab] = useState("profile");
  const [business, setBusiness] = useState({ ...profile.values });

  const tabs = [
    ["profile", profile.profileTab],
    ["ai", profile.aiTitle],
    ["channels", "Channels"],
    ["promotions", "Promotions"],
  ];

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-white px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{profile.intro}</p>
      </header>

      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)]">
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${tab === key ? "border-[var(--color-primary)] text-[var(--color-primary)]" : "border-transparent text-[var(--color-text-muted)]"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <Section title={profile.profileTitle} copy={profile.profileCopy}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={profile.fields.name} value={business.name} set={(value) => setBusiness((current) => ({ ...current, name: value }))} />
              <Field label={profile.fields.assistant} value={business.assistant} set={(value) => setBusiness((current) => ({ ...current, assistant: value }))} />
              <Field label={profile.fields.hours} value={business.hours} set={(value) => setBusiness((current) => ({ ...current, hours: value }))} />
              <Field label={profile.fields.locations} value={business.locations} set={(value) => setBusiness((current) => ({ ...current, locations: value }))} />
            </div>
            <Save onClick={() => showToast(`Demo ${industryProfile.terms.business} settings saved visually.`, "info")} />
          </Section>
        )}

        {tab === "ai" && (
          <Section title={profile.aiTitle} copy={profile.aiCopy}>
            <div className="space-y-4">
              {profile.aiRows.map(([title, copy]) => <Row key={title} title={title} copy={copy} active />)}
            </div>
            <Save onClick={() => showToast("AI settings are fixed for the public demo.", "warning")} />
          </Section>
        )}

        {tab === "channels" && (
          <Section title="Messaging channels" copy={profile.channelsCopy}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Channel name="WhatsApp" color="#25D366" />
              <Channel name="Instagram" color="#E1306C" />
              <Channel name="Facebook Messenger" color="#0866FF" />
            </div>
            <p className="mt-4 rounded-xl bg-[var(--color-accent-light)] p-3 text-xs leading-5 text-[#7a5a20]">Connections are intentionally disabled in this public demo. No real Meta credentials are exposed here.</p>
          </Section>
        )}

        {tab === "promotions" && (
          <Section title="Promotions" copy="Configure contextual campaign cards the AI can show when relevant.">
            {profile.promotion ? (
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Current demo promotion</span>
                <h3 className="mt-1 font-display text-base font-bold">{profile.promotion.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">{profile.promotion.copy}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-primary)]">No active demo promotion</span>
                <h3 className="mt-1 font-display text-base font-bold">Renovation profile keeps quotation guidance separate from promotions</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">Starting price guides live in the renovation service profile. A real client can add campaign-specific offers later without changing the core project qualification flow.</p>
              </div>
            )}
            <Save onClick={() => showToast("Promotion editing is disabled in the public demo.", "warning")} />
          </Section>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function Section({ title, copy, children }) {
  return <section className="mt-5 rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-6"><h2 className="font-display text-lg font-bold">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--color-text-muted)]">{copy}</p><div className="mt-5">{children}</div></section>;
}
function Field({ label, value, set }) {
  return <label><span className="mb-1.5 block text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span><input value={value} onChange={(event) => set(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm outline-none focus:border-[var(--color-primary)] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-light)]" /></label>;
}
function Save({ onClick }) {
  return <div className="mt-5 flex justify-end"><button onClick={onClick} className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white">Save changes</button></div>;
}
function Row({ title, copy, active }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] p-4"><div><strong className="text-sm">{title}</strong><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{copy}</p></div><span className={`relative h-6 w-11 shrink-0 rounded-full ${active ? "bg-[var(--color-primary)]" : "bg-slate-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${active ? "left-6" : "left-1"}`} /></span></div>;
}
function Channel({ name, color }) {
  return <div className="rounded-2xl border border-[var(--color-border)] p-4"><span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ backgroundColor: color }}>●</span><strong className="mt-3 block text-sm">{name}</strong><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Demo preview · no live account connected</p></div>;
}

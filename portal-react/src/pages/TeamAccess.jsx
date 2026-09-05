import { industryProfile } from "../config/industryProfile";

const USERS = industryProfile.teamMembers;

function initials(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

export default function TeamAccess() {
  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Team & Access</h1>
            <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">Manage who can view, reply to and organise {industryProfile.terms.business} leads.</p>
          </div>
          <button disabled title="Available in production" className="w-full cursor-not-allowed rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white opacity-60 sm:w-auto">+ Invite user · Production</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <div className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
            <h2 className="font-display text-base font-bold">Workspace members</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">Sample users are fictional and exist only for this demo.</p>
          </div>

          <section aria-label="Mobile workspace members" className="grid gap-3 p-3.5 md:hidden">
            {USERS.map((user) => (
              <article key={user.username} data-mobile-member-card className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{initials(user.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><strong className="block truncate text-sm">{user.name}</strong><p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">@{user.username}</p></div>
                      <span className="shrink-0 rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[10px] font-bold text-[var(--color-primary)]">{user.status}</span>
                    </div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[var(--color-bg)] p-3">
                  <div><dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Role</dt><dd className="mt-1 text-xs font-semibold">{user.role}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Lead access</dt><dd className="mt-1 text-xs font-semibold">{user.scope}</dd></div>
                </dl>
                <button disabled title="Available in production" className="mt-3 w-full cursor-not-allowed rounded-xl border border-[var(--color-border)] bg-white px-3 py-2.5 text-[11px] font-semibold text-[var(--color-text-muted)] opacity-60">Manage access · Production</button>
              </article>
            ))}
          </section>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-left">
              <thead><tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[9px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]"><th className="px-5 py-3">User</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Lead access</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {USERS.map((user) => (
                  <tr key={user.username} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary)]">{initials(user.name)}</span><div><strong className="text-sm">{user.name}</strong><p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">@{user.username}</p></div></div></td>
                    <td className="px-5 py-4 text-xs font-medium">{user.role}</td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-muted)]">{user.scope}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-[var(--color-primary-light)] px-2 py-1 text-[9px] font-bold text-[var(--color-primary)]">{user.status}</span></td>
                    <td className="px-5 py-4 text-right"><button disabled title="Available in production" className="cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] opacity-60">Manage · Production</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Permission title="View leads" copy="Admins can see all leads. Sales users can be restricted to assigned leads." />
          <Permission title="Reply & takeover" copy="Control who can take over AI conversations and send staff replies." />
          <Permission title="Manage settings" copy={`Keep ${industryProfile.terms.business} configuration, tools and team access limited to admins.`} />
        </div>
      </main>
    </div>
  );
}

function Permission({ title, copy }) {
  return <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm"><strong className="text-sm">{title}</strong><p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{copy}</p></div>;
}

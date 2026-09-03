const $ = (id) => document.getElementById(id);

function number(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function time(value) {
  if (!value) return "—";
  return new Date(Number(value)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function set(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function statusLabel(status) {
  if (status === "healthy") return "Healthy";
  if (status === "rate_limited") return "Rate limited";
  if (status === "error") return "Error";
  if (status === "unused") return "Unused";
  return "Unknown";
}

function statusClass(status) {
  if (status === "healthy") return "good";
  if (status === "rate_limited") return "warn";
  if (status === "error") return "bad";
  return "muted";
}

function renderKeyRow(stats) {
  const row = document.createElement("tr");
  const cells = [
    `Key ${stats.index}`,
    statusLabel(stats.health),
    number(stats.attempts),
    number(stats.successes),
    number(stats.failures),
    number(stats.quotaHits),
    number(stats.totalTokens),
    stats.lastModel || "—",
    stats.lastSuccessAt ? time(stats.lastSuccessAt) : (stats.lastErrorAt ? time(stats.lastErrorAt) : "—"),
  ];
  cells.forEach((value, index) => {
    const cell = document.createElement(index === 0 ? "th" : "td");
    cell.textContent = value;
    if (index === 1) cell.className = `status-text ${statusClass(stats.health)}`;
    row.appendChild(cell);
  });
  return row;
}

function render(data) {
  const c = data.counters || {};
  const g = data.gemini || {};
  const v = data.visitors || {};

  set("activeVisitors", number(v.active));
  set("uniqueVisitors", number(v.uniqueToday));
  set("patientViews", number(c.patient_view));
  set("dashboardViews", number(c.dashboard_view));
  set("sessionsStarted", number(c.sessions_started));
  set("customerMessages", number(c.customer_messages));
  set("channelSwitches", number(c.channel_switches));
  set("humanTakeovers", number(c.human_takeovers));
  set("staffReplies", number(c.staff_messages));
  set("ctaClicks", number(c.sales_cta_clicks));

  set("geminiAttempts", number(g.attempts));
  set("geminiSuccesses", number(g.successes));
  set("geminiFailures", number(g.failures));
  set("fallbackModel", number(g.fallbackModelSuccesses));
  set("deterministicFallback", number(g.deterministicFallbacks));
  set("promptTokens", number(g.tokens?.prompt));
  set("outputTokens", number(g.tokens?.output));
  set("thoughtTokens", number(g.tokens?.thoughts));
  set("totalTokens", number(g.tokens?.total));

  const quota = $("quotaStatus");
  if (quota) {
    const limited = g.quotaStatus === "rate_limited";
    quota.textContent = limited ? "Quota / rate limit recently hit" : "No recent quota hit detected";
    quota.className = `quota-state ${limited ? "bad" : "good"}`;
  }
  set("quotaDetail", g.lastQuotaHitAt
    ? `Last hit: ${time(g.lastQuotaHitAt)}${g.lastQuotaMessage ? ` · ${g.lastQuotaMessage}` : ""}`
    : "The demo will flag actual Gemini 429 RESOURCE_EXHAUSTED responses here.");

  const tbody = $("keyRows");
  if (tbody) {
    tbody.replaceChildren(...(g.keys || []).map(renderKeyRow));
  }

  set("todayLabel", `${data.day} · ${data.timezone}`);
  set("storageLabel", data.storage === "redis" ? "Persistent Redis stats" : "In-memory stats · reset on server restart");
  set("updatedAt", `Updated ${time(data.generatedAt)}`);
}

async function refresh() {
  try {
    const response = await fetch("./api/ops/stats", { cache: "no-store" });
    if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
    const data = await response.json();
    render(data);
    document.body.dataset.state = "ready";
  } catch (error) {
    set("updatedAt", error.message || "Could not load stats");
    document.body.dataset.state = "error";
  }
}

refresh();
setInterval(refresh, 5000);

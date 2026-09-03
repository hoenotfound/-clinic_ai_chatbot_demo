const $ = (id) => document.getElementById(id);
const SVG_NS = "http://www.w3.org/2000/svg";
let selectedRange = 30;
let latestData = null;

function number(value, digits = 0) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number(value) || 0);
}

function percent(value) {
  return `${number(value, 1)}%`;
}

function time(value) {
  if (!value) return "—";
  return new Date(Number(value)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function shortDay(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: "short", day: "numeric" });
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

function ensureHistoryUi() {
  if ($("historySection")) return;
  const sections = document.querySelectorAll(".section");
  const geminiSection = sections[1] || null;
  const section = document.createElement("section");
  section.id = "historySection";
  section.className = "section";
  section.innerHTML = `
    <div class="section-heading history-heading">
      <div><h2>Historical performance</h2><p>Daily trends collected from deployment onward. Visitor metrics are deduplicated per browser visitor ID.</p></div>
      <div class="range-picker" role="group" aria-label="History range">
        <button type="button" data-range="7">7 days</button>
        <button type="button" data-range="30" class="active">30 days</button>
        <button type="button" data-range="90">90 days</button>
      </div>
    </div>
    <div class="grid history-summary-grid">
      <article class="mini"><span>Unique visitors</span><strong id="rangeVisitors">0</strong></article>
      <article class="mini"><span>Dashboard visitors</span><strong id="rangeDashboard">0</strong><small id="rangeDashboardRate">0%</small></article>
      <article class="mini"><span>CTA visitors</span><strong id="rangeCta">0</strong><small id="rangeCtaRate">0%</small></article>
      <article class="mini"><span>Messages / visitor</span><strong id="rangeMessagesPerVisitor">0</strong></article>
      <article class="mini"><span>AI success rate</span><strong id="rangeAiSuccess">0%</strong></article>
      <article class="mini"><span>Gemini tokens</span><strong id="rangeTokens">0</strong></article>
    </div>
    <div class="chart-grid">
      <article class="chart-card"><div class="chart-title"><strong>Visitor engagement</strong><span>Unique visitors → dashboard → consultation click</span></div><div id="visitorTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Demo activity</strong><span>Sessions, patient messages and human takeovers</span></div><div id="activityTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Gemini token usage</strong><span>Total tokens used each day</span></div><div id="tokenTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Conversion rates</strong><span>Dashboard and consultation click rate by day</span></div><div id="conversionTrend" class="trend-chart"></div></article>
    </div>
    <div class="table-wrap history-table-wrap">
      <table class="history-table"><thead><tr><th>Date</th><th>Visitors</th><th>Sessions</th><th>Messages</th><th>Dashboard visitors</th><th>CTA visitors</th><th>Takeovers</th><th>AI success</th><th>Tokens</th></tr></thead><tbody id="historyRows"></tbody></table>
    </div>
    <div class="note" id="historyNote">Historical data begins when this feature is deployed. Redis is required for history to survive service restarts.</div>
  `;
  if (geminiSection) geminiSection.before(section);
  else document.querySelector("main")?.appendChild(section);
  section.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRange = Number(button.dataset.range) || 30;
      section.querySelectorAll("[data-range]").forEach((item) => item.classList.toggle("active", item === button));
      if (latestData) renderHistory(latestData.history);
    });
  });
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderLineChart(containerId, rows, series, { percentValues = false } = {}) {
  const container = $(containerId);
  if (!container) return;
  container.replaceChildren();
  if (!rows.length || !series.length) {
    container.textContent = "No historical data yet.";
    container.classList.add("empty-chart");
    return;
  }
  container.classList.remove("empty-chart");

  const width = 760;
  const height = 250;
  const pad = { left: 48, right: 18, top: 20, bottom: 36 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const rawMax = Math.max(...values, percentValues ? 100 : 1);
  const maxValue = percentValues ? 100 : Math.max(1, rawMax * 1.1);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${containerId} chart` });

  for (let index = 0; index <= 4; index += 1) {
    const y = pad.top + (plotHeight * index / 4);
    svg.appendChild(svgElement("line", { x1: pad.left, y1: y, x2: width - pad.right, y2: y, class: "chart-gridline" }));
    const label = svgElement("text", { x: pad.left - 8, y: y + 4, "text-anchor": "end", class: "chart-axis-label" });
    const axisValue = maxValue * (1 - index / 4);
    label.textContent = percentValues ? `${Math.round(axisValue)}%` : number(axisValue >= 10 ? Math.round(axisValue) : axisValue, axisValue < 10 ? 1 : 0);
    svg.appendChild(label);
  }

  const x = (index) => rows.length === 1 ? pad.left + (plotWidth / 2) : pad.left + (plotWidth * index / (rows.length - 1));
  const y = (value) => pad.top + plotHeight - ((Math.max(0, Number(value) || 0) / maxValue) * plotHeight);

  const labelIndexes = new Set([0, rows.length - 1]);
  const desiredLabels = rows.length <= 7 ? rows.length : 6;
  for (let index = 0; index < desiredLabels; index += 1) {
    labelIndexes.add(Math.round(index * (rows.length - 1) / Math.max(1, desiredLabels - 1)));
  }
  for (const index of [...labelIndexes].sort((a, b) => a - b)) {
    const label = svgElement("text", { x: x(index), y: height - 10, "text-anchor": "middle", class: "chart-axis-label" });
    label.textContent = shortDay(rows[index].day);
    svg.appendChild(label);
  }

  series.forEach((item, seriesIndex) => {
    const points = rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(" ");
    svg.appendChild(svgElement("polyline", { points, fill: "none", class: `chart-line chart-line-${seriesIndex}` }));
  });

  const legend = svgElement("g", { class: "chart-legend" });
  series.forEach((item, index) => {
    const baseX = pad.left + (index * 150);
    legend.appendChild(svgElement("line", { x1: baseX, y1: 9, x2: baseX + 18, y2: 9, class: `chart-line chart-line-${index}` }));
    const text = svgElement("text", { x: baseX + 24, y: 13, class: "chart-legend-text" });
    text.textContent = item.label;
    legend.appendChild(text);
  });
  svg.appendChild(legend);
  container.appendChild(svg);
}

function renderHistory(history) {
  ensureHistoryUi();
  const daily = Array.isArray(history?.daily) ? history.daily.slice(-selectedRange) : [];
  const summary = history?.ranges?.[String(selectedRange)] || {};

  set("rangeVisitors", number(summary.visitors));
  set("rangeDashboard", number(summary.dashboardVisitors));
  set("rangeDashboardRate", `${percent(summary.dashboardRate)} of visitors`);
  set("rangeCta", number(summary.ctaVisitors));
  set("rangeCtaRate", `${percent(summary.ctaRate)} of visitors`);
  set("rangeMessagesPerVisitor", number(summary.messagesPerVisitor, 1));
  set("rangeAiSuccess", percent(summary.aiSuccessRate));
  set("rangeTokens", number(summary.totalTokens));

  renderLineChart("visitorTrend", daily, [
    { key: "visitors", label: "Visitors" },
    { key: "dashboardVisitors", label: "Dashboard" },
    { key: "ctaVisitors", label: "CTA" },
  ]);
  renderLineChart("activityTrend", daily, [
    { key: "sessions", label: "Sessions" },
    { key: "messages", label: "Messages" },
    { key: "takeovers", label: "Takeovers" },
  ]);
  renderLineChart("tokenTrend", daily, [{ key: "totalTokens", label: "Tokens" }]);
  renderLineChart("conversionTrend", daily, [
    { key: "dashboardRate", label: "Dashboard rate" },
    { key: "ctaRate", label: "CTA rate" },
  ], { percentValues: true });

  const tbody = $("historyRows");
  if (tbody) {
    const rows = [...daily].reverse().map((item) => {
      const row = document.createElement("tr");
      const cells = [
        item.day,
        number(item.visitors),
        number(item.sessions),
        number(item.messages),
        number(item.dashboardVisitors),
        number(item.ctaVisitors),
        number(item.takeovers),
        percent(item.aiSuccessRate),
        number(item.totalTokens),
      ];
      cells.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      return row;
    });
    tbody.replaceChildren(...rows);
  }

  set("historyNote", history?.retentionDays
    ? `Historical aggregates are retained for about ${number(history.retentionDays)} days. Collection starts when this feature is deployed; earlier traffic cannot be reconstructed automatically.`
    : "Historical data begins when this feature is deployed. Redis is required for history to survive service restarts.");
}

function render(data) {
  latestData = data;
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
  if (tbody) tbody.replaceChildren(...(g.keys || []).map(renderKeyRow));

  if (data.history) renderHistory(data.history);
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

ensureHistoryUi();
refresh();
setInterval(refresh, 5000);

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

function milliseconds(value) {
  const ms = Number(value) || 0;
  if (!ms) return "—";
  if (ms < 1000) return `${number(ms)} ms`;
  return `${number(ms / 1000, 2)} s`;
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

function rate(count, total) {
  return Number(total) > 0 ? (Number(count) / Number(total)) * 100 : 0;
}

function buildDashboardShell() {
  const main = document.querySelector("main.ops-shell") || document.querySelector("main");
  if (!main) return;
  main.className = "ops-shell";
  main.innerHTML = `
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">DA</div>
        <div>
          <p class="eyebrow">PRIVATE · DEMO OPERATIONS</p>
          <h1>AI Chatbot Performance</h1>
        </div>
      </div>
      <div class="topbar-meta">
        <span id="liveStatus" class="status-pill"><i></i> Live</span>
        <span id="storageLabel" class="meta-pill">Checking storage…</span>
        <span id="updatedAt" class="meta-text">Loading…</span>
      </div>
    </header>

    <section class="overview-head">
      <div>
        <h2>Overview</h2>
        <p id="rangeCaption">Last 30 days · Malaysia time</p>
      </div>
      <div class="range-picker" role="group" aria-label="Dashboard range">
        <button type="button" data-range="7">7D</button>
        <button type="button" data-range="30" class="active">30D</button>
        <button type="button" data-range="90">90D</button>
      </div>
    </section>

    <section class="kpi-grid" aria-label="Key performance indicators">
      <article class="kpi-card">
        <div class="kpi-label"><span>Unique visitors</span><small id="activeVisitors">0 live now</small></div>
        <strong id="kpiVisitors">0</strong>
        <p id="kpiVisitorsNote">Selected period</p>
      </article>
      <article class="kpi-card">
        <div class="kpi-label"><span>Engaged visitors</span><small>Sent a message</small></div>
        <strong id="kpiEngaged">0</strong>
        <p id="kpiEngagedRate">0% of visitors</p>
      </article>
      <article class="kpi-card kpi-accent">
        <div class="kpi-label"><span>Consultations</span><small>CTA conversion</small></div>
        <strong id="kpiConsultations">0</strong>
        <p id="kpiConsultationRate">0% of visitors</p>
      </article>
      <article class="kpi-card">
        <div class="kpi-label"><span>AI response P95</span><small id="kpiAiHealth">Checking health</small></div>
        <strong id="kpiP95">—</strong>
        <p id="kpiAiSuccess">0% provider success</p>
      </article>
    </section>

    <section class="primary-grid">
      <article class="panel funnel-panel">
        <div class="panel-heading">
          <div><p class="section-kicker">CONVERSION</p><h2>Demo funnel</h2></div>
          <span class="panel-helper">Unique visitors · selected period</span>
        </div>
        <div id="funnelStages" class="funnel-list"></div>
      </article>

      <article class="panel health-panel">
        <div class="panel-heading health-heading">
          <div><p class="section-kicker">SYSTEM</p><h2>AI health</h2></div>
          <span id="healthBadge" class="health-badge" data-tone="idle">Checking</span>
        </div>
        <div class="health-metrics">
          <div><span>Average reply</span><strong id="healthAvg">—</strong></div>
          <div><span>P95 reply</span><strong id="healthP95">—</strong></div>
          <div><span>Provider error rate</span><strong id="healthErrorRate">0%</strong></div>
          <div><span>Gemini request avg</span><strong id="healthGeminiAvg">—</strong></div>
        </div>
        <div class="reliability-row" aria-label="Reliability counters">
          <div><span>Retries</span><strong id="healthRetries">0</strong></div>
          <div><span>Key failovers</span><strong id="healthFailovers">0</strong></div>
          <div><span>Timeouts</span><strong id="healthTimeouts">0</strong></div>
          <div><span>Fallbacks</span><strong id="healthFallbacks">0</strong></div>
        </div>
        <div id="healthNotice" class="health-notice" data-tone="neutral">
          <span class="notice-dot"></span><p>Waiting for live AI data.</p>
        </div>
        <div class="usage-line">
          <div><span>Gemini tokens</span><strong id="healthTokens">0</strong></div>
          <div><span>API calls</span><strong id="healthCalls">0</strong></div>
          <div><span>Slow replies</span><strong id="healthSlow">0</strong></div>
        </div>
      </article>
    </section>

    <section class="panel trends-panel">
      <div class="panel-heading">
        <div><p class="section-kicker">TRENDS</p><h2>Performance over time</h2></div>
        <span class="panel-helper">Daily aggregates</span>
      </div>
      <div class="chart-grid">
        <article class="chart-card">
          <div class="chart-title"><div><strong>Engagement</strong><span>Visitors → engaged → consultation</span></div></div>
          <div id="engagementTrend" class="trend-chart"></div>
        </article>
        <article class="chart-card">
          <div class="chart-title"><div><strong>Response speed</strong><span>Average and P95 end-to-end reply time</span></div></div>
          <div id="responseTrend" class="trend-chart"></div>
        </article>
      </div>
    </section>

    <details class="diagnostics panel">
      <summary>
        <div><p class="section-kicker">ADVANCED</p><strong>Diagnostics & daily breakdown</strong><span>API keys, errors, token split and raw daily metrics</span></div>
        <span class="summary-action">View details</span>
      </summary>
      <div class="diagnostics-body">
        <div class="diagnostic-grid">
          <section class="diagnostic-card">
            <h3>Gemini status</h3>
            <div class="diagnostic-list">
              <div><span>Quota status</span><strong id="quotaStatus">—</strong></div>
              <div><span>Last quota hit</span><strong id="quotaDetail">—</strong></div>
              <div><span>Prompt tokens</span><strong id="promptTokens">0</strong></div>
              <div><span>Output tokens</span><strong id="outputTokens">0</strong></div>
              <div><span>Thinking tokens</span><strong id="thoughtTokens">0</strong></div>
              <div><span>Deterministic fallbacks</span><strong id="deterministicFallback">0</strong></div>
            </div>
          </section>
          <section class="diagnostic-card">
            <h3>Error breakdown · today</h3>
            <div class="diagnostic-list">
              <div><span>Quota</span><strong id="errorQuota">0</strong></div>
              <div><span>Timeout</span><strong id="errorTimeout">0</strong></div>
              <div><span>Server</span><strong id="errorServer">0</strong></div>
              <div><span>Client</span><strong id="errorClient">0</strong></div>
              <div><span>Empty response</span><strong id="errorEmpty">0</strong></div>
              <div><span>Other</span><strong id="errorOther">0</strong></div>
            </div>
          </section>
        </div>

        <div class="table-section">
          <div class="table-heading"><h3>API key health</h3><span>Today</span></div>
          <div class="table-wrap compact-table-wrap">
            <table><thead><tr><th>Key</th><th>Status</th><th>Attempts</th><th>Success</th><th>Failures</th><th>Quota</th><th>Tokens</th><th>Last activity</th></tr></thead><tbody id="keyRows"></tbody></table>
          </div>
        </div>

        <div class="table-section">
          <div class="table-heading"><h3>Daily breakdown</h3><span id="historyRetention">Historical aggregates</span></div>
          <div class="table-wrap history-table-wrap">
            <table class="history-table"><thead><tr><th>Date</th><th>Visitors</th><th>Engaged</th><th>3+ msg</th><th>Dashboard</th><th>Completed</th><th>CTA</th><th>P95</th><th>Retries</th><th>Errors</th><th>Tokens</th></tr></thead><tbody id="historyRows"></tbody></table>
          </div>
        </div>
        <p class="privacy-note">Historical visitor counts are aggregated and deduplicated. No names, phone numbers or chat contents are shown here.</p>
      </div>
    </details>
  `;

  main.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedRange = Number(button.dataset.range) || 30;
      main.querySelectorAll("[data-range]").forEach((item) => item.classList.toggle("active", item === button));
      if (latestData) render(latestData);
    });
  });
}

function statusLabel(status) {
  if (status === "healthy") return "Healthy";
  if (status === "rate_limited") return "Rate limited";
  if (status === "error") return "Error";
  if (status === "unused") return "Unused";
  return "Unknown";
}

function statusTone(status) {
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
    stats.lastSuccessAt ? time(stats.lastSuccessAt) : (stats.lastErrorAt ? time(stats.lastErrorAt) : "—"),
  ];
  cells.forEach((value, index) => {
    const cell = document.createElement(index === 0 ? "th" : "td");
    cell.textContent = value;
    if (index === 1) cell.className = `status-text ${statusTone(stats.health)}`;
    row.appendChild(cell);
  });
  return row;
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function axisText(value, valueKind) {
  if (valueKind === "ms") return value >= 1000 ? `${number(value / 1000, 1)}s` : `${Math.round(value)}ms`;
  return number(value >= 10 ? Math.round(value) : value, value < 10 ? 1 : 0);
}

function renderLineChart(containerId, rows, series, { valueKind = "count" } = {}) {
  const container = $(containerId);
  if (!container) return;
  container.replaceChildren();
  const populated = rows.some((row) => series.some((item) => Number(row[item.key]) > 0));
  if (!rows.length || !populated) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.innerHTML = "<strong>No data yet</strong><span>Trend lines will appear as the demo gets used.</span>";
    container.appendChild(empty);
    return;
  }

  const legend = document.createElement("div");
  legend.className = "chart-legend-html";
  series.forEach((item, index) => {
    const badge = document.createElement("span");
    badge.innerHTML = `<i class="legend-line legend-${index}"></i>${item.label}`;
    legend.appendChild(badge);
  });

  const width = 720;
  const height = 238;
  const pad = { left: 48, right: 16, top: 12, bottom: 34 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const rawMax = Math.max(...values, 1);
  const maxValue = Math.max(1, rawMax * 1.12);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${containerId} chart` });

  for (let index = 0; index <= 3; index += 1) {
    const yPos = pad.top + (plotHeight * index / 3);
    svg.appendChild(svgElement("line", { x1: pad.left, y1: yPos, x2: width - pad.right, y2: yPos, class: "chart-gridline" }));
    const label = svgElement("text", { x: pad.left - 8, y: yPos + 4, "text-anchor": "end", class: "chart-axis-label" });
    label.textContent = axisText(maxValue * (1 - index / 3), valueKind);
    svg.appendChild(label);
  }

  const x = (index) => rows.length === 1 ? pad.left + (plotWidth / 2) : pad.left + (plotWidth * index / (rows.length - 1));
  const y = (value) => pad.top + plotHeight - ((Math.max(0, Number(value) || 0) / maxValue) * plotHeight);
  const labelIndexes = new Set([0, rows.length - 1]);
  const labelCount = rows.length <= 7 ? rows.length : 5;
  for (let index = 0; index < labelCount; index += 1) {
    labelIndexes.add(Math.round(index * (rows.length - 1) / Math.max(1, labelCount - 1)));
  }
  [...labelIndexes].sort((a, b) => a - b).forEach((index) => {
    const label = svgElement("text", { x: x(index), y: height - 9, "text-anchor": "middle", class: "chart-axis-label" });
    label.textContent = shortDay(rows[index].day);
    svg.appendChild(label);
  });

  series.forEach((item, seriesIndex) => {
    const points = rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(" ");
    svg.appendChild(svgElement("polyline", { points, fill: "none", class: `chart-line chart-line-${seriesIndex}` }));
    const last = rows.length - 1;
    svg.appendChild(svgElement("circle", { cx: x(last), cy: y(rows[last][item.key]), r: 3.5, class: `chart-dot chart-dot-${seriesIndex}` }));
  });

  container.append(legend, svg);
}

function renderFunnel(funnel) {
  const container = $("funnelStages");
  if (!container) return;
  const stages = Array.isArray(funnel?.stages) ? funnel.stages : [];
  container.replaceChildren(...stages.map((stage, index) => {
    const item = document.createElement("div");
    item.className = "funnel-row";

    const identity = document.createElement("div");
    identity.className = "funnel-identity";
    const step = document.createElement("span");
    step.className = "funnel-index";
    step.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("strong");
    label.textContent = stage.label;
    identity.append(step, label);

    const progress = document.createElement("progress");
    progress.max = 100;
    progress.value = Math.max(0, Math.min(100, Number(stage.rate) || 0));
    progress.setAttribute("aria-label", `${stage.label}: ${percent(stage.rate)}`);

    const value = document.createElement("div");
    value.className = "funnel-value";
    const count = document.createElement("strong");
    count.textContent = number(stage.count);
    const conversion = document.createElement("span");
    conversion.textContent = index === 0 ? "100%" : percent(stage.rate);
    value.append(count, conversion);

    item.append(identity, progress, value);
    return item;
  }));
}

function healthState(data, summary) {
  const p = data.performance || {};
  const g = data.gemini || {};
  const attempts = Number(summary?.geminiAttempts ?? g.attempts) || 0;
  const errorRate = Number(summary?.providerErrorRate ?? p.providerErrorRate) || 0;
  const timeouts = Number(summary?.timeouts ?? p.timeouts) || 0;
  if (!attempts) return { label: "Idle", tone: "idle", message: "No Gemini calls in this period yet." };
  if (g.quotaStatus === "rate_limited") return { label: "Attention", tone: "bad", message: "Gemini quota or rate limit was recently hit." };
  if (errorRate >= 10 || timeouts >= 3) return { label: "Attention", tone: "bad", message: "AI reliability needs attention in this period." };
  if (errorRate > 0 || timeouts > 0 || Number(summary?.retries ?? p.retries) > 0) return { label: "Watch", tone: "warn", message: "AI is working, with some retries or provider errors." };
  return { label: "Healthy", tone: "good", message: "No significant AI reliability issues detected." };
}

function renderDiagnostics(data, daily) {
  const g = data.gemini || {};
  const p = data.performance || {};
  set("quotaStatus", g.quotaStatus === "rate_limited" ? "Recently limited" : "No recent limit");
  set("quotaDetail", g.lastQuotaHitAt ? time(g.lastQuotaHitAt) : "—");
  set("promptTokens", number(g.tokens?.prompt));
  set("outputTokens", number(g.tokens?.output));
  set("thoughtTokens", number(g.tokens?.thoughts));
  set("deterministicFallback", number(g.deterministicFallbacks));
  set("errorQuota", number(p.errors?.quota));
  set("errorTimeout", number(p.errors?.timeout));
  set("errorServer", number(p.errors?.server));
  set("errorClient", number(p.errors?.client));
  set("errorEmpty", number(p.errors?.empty));
  set("errorOther", number(p.errors?.other));

  const keyRows = $("keyRows");
  if (keyRows) keyRows.replaceChildren(...(g.keys || []).map(renderKeyRow));

  const historyRows = $("historyRows");
  if (historyRows) {
    const rows = [...daily].reverse().map((item) => {
      const row = document.createElement("tr");
      const cells = [
        item.day,
        number(item.visitors),
        number(item.message1Visitors),
        number(item.message3Visitors),
        number(item.dashboardVisitors),
        number(item.completedVisitors),
        number(item.ctaVisitors),
        milliseconds(item.aiResponseP95Ms),
        number(item.retries),
        number(item.geminiFailures),
        number(item.totalTokens),
      ];
      cells.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      return row;
    });
    historyRows.replaceChildren(...rows);
  }
}

function render(data) {
  latestData = data;
  const history = data.history || {};
  const daily = Array.isArray(history.daily) ? history.daily.slice(-selectedRange) : [];
  const summary = history.ranges?.[String(selectedRange)] || {};
  const funnel = summary.funnel || data.funnel || {};
  const p = data.performance || {};
  const g = data.gemini || {};
  const v = data.visitors || {};

  set("rangeCaption", `Last ${selectedRange} days · ${data.timezone || "Asia/Kuala_Lumpur"}`);
  set("activeVisitors", `${number(v.active)} live now`);
  set("kpiVisitors", number(summary.visitors));
  set("kpiVisitorsNote", `${number(summary.demoStartedVisitors)} started a demo`);
  set("kpiEngaged", number(summary.message1Visitors));
  set("kpiEngagedRate", `${percent(rate(summary.message1Visitors, summary.visitors))} of visitors`);
  set("kpiConsultations", number(summary.ctaVisitors));
  set("kpiConsultationRate", `${percent(summary.ctaRate)} of visitors`);
  set("kpiP95", milliseconds(summary.aiResponseP95Ms));
  set("kpiAiSuccess", `${percent(summary.aiSuccessRate)} provider success`);

  renderFunnel(funnel);

  set("healthAvg", milliseconds(summary.aiResponseAvgMs));
  set("healthP95", milliseconds(summary.aiResponseP95Ms));
  set("healthErrorRate", percent(summary.providerErrorRate));
  set("healthGeminiAvg", milliseconds(summary.geminiRequestAvgMs));
  set("healthRetries", number(summary.retries));
  set("healthFailovers", number(summary.keyFailovers));
  set("healthTimeouts", number(summary.timeouts));
  set("healthFallbacks", number(summary.fallbackModelUses));
  set("healthTokens", number(summary.totalTokens));
  set("healthCalls", number(summary.geminiAttempts));
  set("healthSlow", number(summary.slowResponses));

  const health = healthState(data, summary);
  const badge = $("healthBadge");
  if (badge) {
    badge.textContent = health.label;
    badge.dataset.tone = health.tone;
  }
  set("kpiAiHealth", health.label);
  const notice = $("healthNotice");
  if (notice) {
    notice.dataset.tone = health.tone;
    const copy = notice.querySelector("p");
    if (copy) copy.textContent = health.message;
  }

  renderLineChart("engagementTrend", daily, [
    { key: "visitors", label: "Visitors" },
    { key: "message1Visitors", label: "Engaged" },
    { key: "ctaVisitors", label: "Consultation" },
  ]);
  renderLineChart("responseTrend", daily, [
    { key: "aiResponseAvgMs", label: "Average" },
    { key: "aiResponseP95Ms", label: "P95" },
  ], { valueKind: "ms" });

  renderDiagnostics(data, daily);

  const storage = data.storage === "redis" ? "History saved" : "Temporary memory";
  set("storageLabel", storage);
  set("updatedAt", `Updated ${time(data.generatedAt)}`);
  set("historyRetention", history.retentionDays ? `Up to ${number(history.retentionDays)} days retained` : "Historical aggregates");

  document.body.dataset.state = "ready";
}

async function refresh() {
  try {
    const response = await fetch("./api/ops/stats", { cache: "no-store" });
    if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
    render(await response.json());
  } catch (error) {
    document.body.dataset.state = "error";
    set("updatedAt", error.message || "Could not load stats");
    const live = $("liveStatus");
    if (live) {
      live.classList.add("is-error");
      live.innerHTML = "<i></i> Offline";
    }
  }
}

buildDashboardShell();
refresh();
setInterval(refresh, 5000);

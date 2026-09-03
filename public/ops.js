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

function ensurePerformanceUi() {
  if ($("performanceSection")) return;
  const sections = document.querySelectorAll(".section");
  const geminiSection = sections[1] || null;
  const section = document.createElement("section");
  section.id = "performanceSection";
  section.className = "section";
  section.innerHTML = `
    <div class="section-heading">
      <div><h2>Response speed & reliability</h2><p>End-to-end chatbot speed, Gemini request speed, retries, failovers and errors seen today.</p></div>
    </div>
    <div class="grid performance-grid">
      <article class="mini"><span>Chatbot average</span><strong id="perfAvg">0 ms</strong></article>
      <article class="mini"><span>Chatbot P50</span><strong id="perfP50">0 ms</strong></article>
      <article class="mini"><span>Chatbot P95</span><strong id="perfP95">0 ms</strong></article>
      <article class="mini"><span>Gemini request avg</span><strong id="geminiRequestAvg">0 ms</strong></article>
      <article class="mini"><span>Provider error rate</span><strong id="providerErrorRate">0%</strong></article>
      <article class="mini"><span>Slow responses</span><strong id="slowResponses">0</strong><small id="slowThreshold">Threshold 4 s</small></article>
    </div>
    <div class="grid reliability-grid">
      <article class="mini"><span>Retries</span><strong id="retryCount">0</strong></article>
      <article class="mini"><span>Key failovers</span><strong id="failoverCount">0</strong></article>
      <article class="mini"><span>Fallback model uses</span><strong id="fallbackUseCount">0</strong></article>
      <article class="mini"><span>Timeouts</span><strong id="timeoutCount">0</strong></article>
      <article class="mini"><span>Demo busy errors</span><strong id="busyCount">0</strong></article>
    </div>
    <div class="error-strip" aria-label="Gemini error breakdown">
      <span>Errors:</span>
      <b id="errorQuota">Quota 0</b>
      <b id="errorTimeout">Timeout 0</b>
      <b id="errorServer">Server 0</b>
      <b id="errorClient">Client 0</b>
      <b id="errorEmpty">Empty 0</b>
      <b id="errorOther">Other 0</b>
    </div>
  `;
  if (geminiSection) geminiSection.before(section);
  else document.querySelector("main")?.appendChild(section);
}

function ensureHistoryUi() {
  if ($("historySection")) return;
  const geminiSection = [...document.querySelectorAll(".section")].find((section) => section.querySelector("#geminiAttempts")) || null;
  const section = document.createElement("section");
  section.id = "historySection";
  section.className = "section";
  section.innerHTML = `
    <div class="section-heading history-heading">
      <div><h2>Historical performance</h2><p>Unique visitor funnel, response speed, reliability and Gemini usage from deployment onward.</p></div>
      <div class="range-picker" role="group" aria-label="History range">
        <button type="button" data-range="7">7 days</button>
        <button type="button" data-range="30" class="active">30 days</button>
        <button type="button" data-range="90">90 days</button>
      </div>
    </div>

    <div class="funnel-shell">
      <div class="funnel-heading"><strong>Demo conversion funnel</strong><span>Each browser visitor counts once at each stage in the selected period.</span></div>
      <div id="funnelStages" class="funnel-stages"></div>
    </div>

    <div class="grid history-summary-grid">
      <article class="mini"><span>Unique visitors</span><strong id="rangeVisitors">0</strong></article>
      <article class="mini"><span>Consultation rate</span><strong id="rangeCtaRate">0%</strong></article>
      <article class="mini"><span>Chatbot P95</span><strong id="rangeP95">0 ms</strong></article>
      <article class="mini"><span>Retries</span><strong id="rangeRetries">0</strong></article>
      <article class="mini"><span>Timeouts</span><strong id="rangeTimeouts">0</strong></article>
      <article class="mini"><span>Gemini tokens</span><strong id="rangeTokens">0</strong></article>
    </div>

    <div class="chart-grid">
      <article class="chart-card"><div class="chart-title"><strong>Visitor funnel trend</strong><span>Visitors, engaged visitors, dashboard viewers and completed guided journeys</span></div><div id="visitorTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Chatbot response speed</strong><span>Daily average, P50 and P95 end-to-end response time</span></div><div id="responseTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Reliability events</strong><span>Retries, API-key failovers, timeouts and demo-busy errors</span></div><div id="reliabilityTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Gemini token usage</strong><span>Total tokens used each day</span></div><div id="tokenTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Conversion rates</strong><span>Dashboard and consultation click rate by day</span></div><div id="conversionTrend" class="trend-chart"></div></article>
      <article class="chart-card"><div class="chart-title"><strong>Provider error rate</strong><span>Failed Gemini calls as a percentage of API attempts</span></div><div id="errorRateTrend" class="trend-chart"></div></article>
    </div>

    <div class="table-wrap history-table-wrap">
      <table class="history-table"><thead><tr><th>Date</th><th>Visitors</th><th>1+ msg</th><th>3+ msg</th><th>Dashboard</th><th>Completed</th><th>CTA</th><th>P95</th><th>Retries</th><th>Errors</th><th>Tokens</th></tr></thead><tbody id="historyRows"></tbody></table>
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

function axisText(value, valueKind) {
  if (valueKind === "percent") return `${Math.round(value)}%`;
  if (valueKind === "ms") return value >= 1000 ? `${number(value / 1000, 1)}s` : `${Math.round(value)}ms`;
  return number(value >= 10 ? Math.round(value) : value, value < 10 ? 1 : 0);
}

function renderLineChart(containerId, rows, series, { valueKind = "count" } = {}) {
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
  const pad = { left: 52, right: 18, top: 20, bottom: 36 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = rows.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
  const fixedPercent = valueKind === "percent";
  const rawMax = Math.max(...values, fixedPercent ? 100 : 1);
  const maxValue = fixedPercent ? 100 : Math.max(1, rawMax * 1.1);
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${containerId} chart` });

  for (let index = 0; index <= 4; index += 1) {
    const y = pad.top + (plotHeight * index / 4);
    svg.appendChild(svgElement("line", { x1: pad.left, y1: y, x2: width - pad.right, y2: y, class: "chart-gridline" }));
    const label = svgElement("text", { x: pad.left - 8, y: y + 4, "text-anchor": "end", class: "chart-axis-label" });
    label.textContent = axisText(maxValue * (1 - index / 4), valueKind);
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
    const baseX = pad.left + (index * 155);
    legend.appendChild(svgElement("line", { x1: baseX, y1: 9, x2: baseX + 18, y2: 9, class: `chart-line chart-line-${index}` }));
    const text = svgElement("text", { x: baseX + 24, y: 13, class: "chart-legend-text" });
    text.textContent = item.label;
    legend.appendChild(text);
  });
  svg.appendChild(legend);
  container.appendChild(svg);
}

function renderFunnel(funnel) {
  const container = $("funnelStages");
  if (!container) return;
  const stages = Array.isArray(funnel?.stages) ? funnel.stages : [];
  container.replaceChildren(...stages.map((stage, index) => {
    const card = document.createElement("article");
    card.className = "funnel-stage";
    const step = document.createElement("small");
    step.textContent = String(index + 1).padStart(2, "0");
    const label = document.createElement("span");
    label.textContent = stage.label;
    const count = document.createElement("strong");
    count.textContent = number(stage.count);
    const rate = document.createElement("em");
    rate.textContent = index === 0 ? "100%" : `${percent(stage.rate)} of visitors`;
    card.append(step, label, count, rate);
    return card;
  }));
}

function renderPerformance(performance) {
  ensurePerformanceUi();
  const p = performance || {};
  set("perfAvg", milliseconds(p.aiResponse?.avgMs));
  set("perfP50", milliseconds(p.aiResponse?.p50Ms));
  set("perfP95", milliseconds(p.aiResponse?.p95Ms));
  set("geminiRequestAvg", milliseconds(p.geminiRequest?.avgMs));
  set("providerErrorRate", percent(p.providerErrorRate));
  set("slowResponses", number(p.slowResponses));
  set("slowThreshold", `Threshold ${milliseconds(p.slowResponseMs)}`);
  set("retryCount", number(p.retries));
  set("failoverCount", number(p.keyFailovers));
  set("fallbackUseCount", number(p.fallbackModelUses));
  set("timeoutCount", number(p.timeouts));
  set("busyCount", number(p.busyErrors));
  set("errorQuota", `Quota ${number(p.errors?.quota)}`);
  set("errorTimeout", `Timeout ${number(p.errors?.timeout)}`);
  set("errorServer", `Server ${number(p.errors?.server)}`);
  set("errorClient", `Client ${number(p.errors?.client)}`);
  set("errorEmpty", `Empty ${number(p.errors?.empty)}`);
  set("errorOther", `Other ${number(p.errors?.other)}`);
}

function renderHistory(history) {
  ensureHistoryUi();
  const daily = Array.isArray(history?.daily) ? history.daily.slice(-selectedRange) : [];
  const summary = history?.ranges?.[String(selectedRange)] || {};

  renderFunnel(summary.funnel);
  set("rangeVisitors", number(summary.visitors));
  set("rangeCtaRate", percent(summary.ctaRate));
  set("rangeP95", milliseconds(summary.aiResponseP95Ms));
  set("rangeRetries", number(summary.retries));
  set("rangeTimeouts", number(summary.timeouts));
  set("rangeTokens", number(summary.totalTokens));

  renderLineChart("visitorTrend", daily, [
    { key: "visitors", label: "Visitors" },
    { key: "message1Visitors", label: "1+ message" },
    { key: "dashboardVisitors", label: "Dashboard" },
    { key: "completedVisitors", label: "Completed" },
  ]);
  renderLineChart("responseTrend", daily, [
    { key: "aiResponseAvgMs", label: "Average" },
    { key: "aiResponseP50Ms", label: "P50" },
    { key: "aiResponseP95Ms", label: "P95" },
  ], { valueKind: "ms" });
  renderLineChart("reliabilityTrend", daily, [
    { key: "retries", label: "Retries" },
    { key: "keyFailovers", label: "Key failovers" },
    { key: "timeouts", label: "Timeouts" },
    { key: "busyErrors", label: "Busy" },
  ]);
  renderLineChart("tokenTrend", daily, [{ key: "totalTokens", label: "Tokens" }]);
  renderLineChart("conversionTrend", daily, [
    { key: "dashboardRate", label: "Dashboard rate" },
    { key: "ctaRate", label: "CTA rate" },
  ], { valueKind: "percent" });
  renderLineChart("errorRateTrend", daily, [{ key: "providerErrorRate", label: "Error rate" }], { valueKind: "percent" });

  const tbody = $("historyRows");
  if (tbody) {
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
    tbody.replaceChildren(...rows);
  }

  set("historyNote", history?.retentionDays
    ? `Historical aggregates are retained for about ${number(history.retentionDays)} days. Funnel counts are unique visitors; latency P50/P95 values use lightweight timing buckets. Collection starts when this feature is deployed.`
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

  renderPerformance(data.performance);
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

ensurePerformanceUi();
ensureHistoryUi();
refresh();
setInterval(refresh, 5000);
(() => {
  let latestAudience = null;

  function ensureStyle() {
    if (document.querySelector('link[data-ops-audience]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./ops-audience.css";
    link.dataset.opsAudience = "true";
    document.head.appendChild(link);
  }

  function activeRange() {
    return Number(document.querySelector("[data-range].active")?.dataset.range) || 30;
  }

  function fmt(value, digits = 0) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(Number(value) || 0);
  }

  function pct(value) {
    return `${fmt(value, 1)}%`;
  }

  function duration(value) {
    const ms = Number(value) || 0;
    if (!ms) return "—";
    if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
    const minutes = ms / 60_000;
    if (minutes < 60) return `${fmt(minutes, 1)}m`;
    return `${fmt(minutes / 60, 1)}h`;
  }

  function relativeTime(value) {
    const timestamp = Number(value) || 0;
    if (!timestamp) return "—";
    const delta = Math.max(0, Date.now() - timestamp);
    if (delta < 60_000) return "Now";
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function buildShell() {
    if (document.getElementById("audienceAnalytics")) return true;
    const kpis = document.querySelector(".kpi-grid");
    if (!kpis) return false;

    const section = make("section", "audience-section");
    section.id = "audienceAnalytics";

    const heading = make("div", "audience-heading");
    const left = make("div");
    left.append(make("h2", "", "Visitor analytics"), make("p", "", "Anonymous audience, acquisition and engagement details."));
    heading.append(left, make("span", "", "Approximate geo · no raw IP stored"));

    const kpiGrid = make("div", "audience-kpis");
    const kpiDefs = [
      ["audienceVisits", "Total visits", "Page entries in selected period"],
      ["audienceNew", "New visitors", "First-ever visit in selected period"],
      ["audienceReturning", "Returning", "Seen before selected period"],
      ["audienceSpan", "Avg active span", "Approx. visible engagement"],
    ];
    for (const [id, label, note] of kpiDefs) {
      const card = make("article", "audience-kpi");
      card.append(make("span", "", label));
      const strong = make("strong", "", "—");
      strong.id = id;
      card.append(strong, make("small", "", note));
      kpiGrid.appendChild(card);
    }

    const grid = make("div", "audience-grid");
    for (const [id, title, subtitle] of [
      ["audienceLocations", "Top locations", "Approximate city / region / country"],
      ["audienceDevices", "Devices", "Device mix for unique visitors"],
      ["audienceBrowsers", "Browsers", "Browser mix for unique visitors"],
    ]) {
      const card = make("article", "audience-card");
      card.append(make("h3", "", title), make("p", "audience-subtitle", subtitle));
      const list = make("div", "audience-list");
      list.id = id;
      card.appendChild(list);
      grid.appendChild(card);
    }

    const sourceCard = make("article", "audience-card audience-wide");
    sourceCard.append(make("h3", "", "Acquisition & conversion"), make("p", "audience-subtitle", "UTM source or click identifier → engagement → dashboard → consultation CTA."));
    const sourceWrap = make("div", "audience-table-wrap");
    sourceWrap.innerHTML = '<table class="audience-source-table"><thead><tr><th>Source</th><th>Visitors</th><th>Engaged</th><th>Dashboard</th><th>CTA</th></tr></thead><tbody id="audienceSourceRows"></tbody></table>';
    sourceCard.appendChild(sourceWrap);
    grid.appendChild(sourceCard);

    const recentCard = make("article", "audience-card audience-wide");
    recentCard.append(make("h3", "", "Recent anonymous visitors"), make("p", "audience-subtitle", "Anonymous visitor history only — no name, phone number, raw IP or chat transcript."));
    const recentWrap = make("div", "audience-table-wrap");
    recentWrap.innerHTML = '<table class="audience-recent-table"><thead><tr><th>Visitor</th><th>Location</th><th>Source</th><th>Device</th><th>Visits</th><th>Message stage</th><th>Journey</th><th>Last seen</th></tr></thead><tbody id="audienceRecentRows"></tbody></table>';
    recentCard.appendChild(recentWrap);
    grid.appendChild(recentCard);

    section.append(heading, kpiGrid, grid, make("p", "audience-privacy", "Geo is approximate IP-based city/region/country supplied by Netlify. VPNs, mobile networks and corporate connections can make it inaccurate. Latitude, longitude and the visitor’s raw IP are not persisted."));
    kpis.insertAdjacentElement("afterend", section);

    document.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => {
      queueMicrotask(() => { if (latestAudience) render(latestAudience); });
    }));
    return true;
  }

  function renderBreakdown(id, rows = []) {
    const root = document.getElementById(id);
    if (!root) return;
    root.replaceChildren();
    if (!rows.length) {
      root.appendChild(make("div", "audience-empty", "No data yet."));
      return;
    }
    const max = Math.max(...rows.map((row) => Number(row.count) || 0), 1);
    for (const row of rows.slice(0, 6)) {
      const item = make("div", "audience-row");
      item.append(make("span", "audience-row-label", row.label || "Unknown"), make("strong", "audience-row-value", fmt(row.count)));
      const bar = make("progress", "audience-progress");
      bar.max = max;
      bar.value = Number(row.count) || 0;
      bar.setAttribute("aria-label", `${row.label || "Unknown"}: ${fmt(row.count)}`);
      item.appendChild(bar);
      root.appendChild(item);
    }
  }

  function renderSources(rows = []) {
    const tbody = document.getElementById("audienceSourceRows");
    if (!tbody) return;
    tbody.replaceChildren();
    for (const source of rows.slice(0, 8)) {
      const tr = document.createElement("tr");
      for (const value of [source.label || "Direct / unknown", fmt(source.visitors), pct(source.engagementRate), pct(source.dashboardRate), pct(source.ctaRate)]) {
        tr.appendChild(make("td", "", value));
      }
      tbody.appendChild(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = make("td", "", "No acquisition data yet.");
      td.colSpan = 5;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function renderRecent(rows = []) {
    const tbody = document.getElementById("audienceRecentRows");
    if (!tbody) return;
    tbody.replaceChildren();
    for (const visitor of rows.slice(0, 20)) {
      const tr = document.createElement("tr");
      const id = make("td", "visitor-id", `#${visitor.id || "ANON"}`);
      const location = make("td", "", visitor.location || "Unknown");
      const source = make("td", "", visitor.source || "Direct / unknown");
      if (visitor.campaign) source.title = `Campaign: ${visitor.campaign}`;
      const device = make("td", "", [visitor.device, visitor.browser].filter(Boolean).join(" · "));
      const visits = make("td", "", fmt(visitor.visits));
      const messages = make("td", "", visitor.messageStage || "0");
      const journey = make("td");
      journey.appendChild(make("span", "visitor-stage", visitor.stage || "Visited"));
      const lastSeen = make("td", "", relativeTime(visitor.lastSeenAt));
      tr.append(id, location, source, device, visits, messages, journey, lastSeen);
      tbody.appendChild(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = make("td", "", "No visitor profiles yet.");
      td.colSpan = 8;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function render(audience) {
    latestAudience = audience;
    if (!buildShell()) return;
    const range = audience?.ranges?.[String(activeRange())];
    if (!range) {
      for (const id of ["audienceVisits", "audienceNew", "audienceReturning", "audienceSpan"]) {
        const element = document.getElementById(id);
        if (element) element.textContent = "—";
      }
      renderBreakdown("audienceLocations", []);
      renderBreakdown("audienceDevices", []);
      renderBreakdown("audienceBrowsers", []);
      renderSources([]);
      renderRecent([]);
      return;
    }
    document.getElementById("audienceVisits").textContent = fmt(range.totalVisits);
    document.getElementById("audienceNew").textContent = fmt(range.newVisitors);
    document.getElementById("audienceReturning").textContent = fmt(range.returningVisitors);
    document.getElementById("audienceSpan").textContent = duration(range.avgActiveSpanMs);
    renderBreakdown("audienceLocations", range.cities?.some((item) => item.label !== "Unknown") ? range.cities : range.countries);
    renderBreakdown("audienceDevices", range.devices);
    renderBreakdown("audienceBrowsers", range.browsers);
    renderSources(range.sources);
    renderRecent(audience.recentVisitors);
  }

  ensureStyle();
  let attempts = 0;
  const shellTimer = setInterval(() => {
    attempts += 1;
    if (buildShell() || attempts > 40) clearInterval(shellTimer);
  }, 50);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const input = args[0];
      const raw = typeof input === "string" ? input : input?.url;
      const pathname = raw ? new URL(raw, window.location.href).pathname : "";
      if (response.ok && pathname.endsWith("/api/ops/stats")) {
        response.clone().json().then((data) => render(data?.audience)).catch(() => {});
      }
    } catch {}
    return response;
  };

  nativeFetch("./api/ops/stats")
    .then((response) => response.ok ? response.json() : null)
    .then((data) => render(data?.audience))
    .catch(() => { buildShell(); });
})();

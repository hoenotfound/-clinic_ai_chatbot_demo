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

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function polishExistingShell() {
    const consultationLabel = [...document.querySelectorAll(".kpi-label > span")]
      .find((node) => node.textContent.trim() === "Consultations");
    if (consultationLabel) consultationLabel.textContent = "Consultation clicks";

    const engagementSubtitle = [...document.querySelectorAll(".chart-title span")]
      .find((node) => node.textContent.includes("Visitors → engaged → consultation"));
    if (engagementSubtitle) engagementSubtitle.textContent = "Visitors → engaged → CTA clicks";
  }

  function addKpi(grid, id, label, note, noteId = null) {
    const card = make("article", "audience-kpi");
    card.append(make("span", "", label));
    const strong = make("strong", "", "—");
    strong.id = id;
    const small = make("small", "", note);
    if (noteId) small.id = noteId;
    card.append(strong, small);
    grid.appendChild(card);
  }

  function buildShell() {
    polishExistingShell();
    if (document.getElementById("audienceAnalytics")) return true;

    const kpis = document.querySelector(".kpi-grid");
    const primary = document.querySelector(".primary-grid");
    if (!kpis) return false;

    const section = make("section", "audience-section");
    section.id = "audienceAnalytics";

    const heading = make("div", "audience-heading");
    const left = make("div");
    left.append(
      make("p", "section-kicker", "AUDIENCE"),
      make("h2", "", "Visitor analytics"),
      make("p", "audience-heading-copy", "Anonymous audience, acquisition and engagement details.")
    );
    const privacyChip = make("span", "audience-privacy-chip", "ⓘ Approximate geo · no raw IP stored");
    privacyChip.title = "Geo is approximate city/region/country supplied by Netlify. VPNs, mobile networks and corporate connections can make it inaccurate.";
    heading.append(left, privacyChip);

    const kpiGrid = make("div", "audience-kpis");
    addKpi(kpiGrid, "audienceVisits", "Total visits", "Page entries in selected period");
    addKpi(kpiGrid, "audienceNew", "New visitors", "First-ever visit in selected period");
    addKpi(kpiGrid, "audienceReturning", "Returning visitors", "Seen before selected period");
    addKpi(kpiGrid, "audienceRepeat", "Repeat rate", "Returning ÷ unique visitors", "audienceRepeatNote");

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
    sourceCard.append(
      make("h3", "", "Acquisition & conversion"),
      make("p", "audience-subtitle", "UTM source or click identifier → engagement → dashboard → consultation CTA.")
    );
    const sourceWrap = make("div", "audience-table-wrap");
    sourceWrap.innerHTML = '<table class="audience-source-table"><thead><tr><th>Source</th><th>Visitors</th><th>Engage %</th><th>Dashboard %</th><th>CTA %</th></tr></thead><tbody id="audienceSourceRows"></tbody></table>';
    sourceCard.appendChild(sourceWrap);
    grid.appendChild(sourceCard);

    const recentCard = make("article", "audience-card audience-wide audience-recent-card");
    recentCard.append(
      make("h3", "", "Recent anonymous visitors"),
      make("p", "audience-subtitle", "Latest anonymous visitors in the selected period — no name, phone number, raw IP or chat transcript.")
    );
    const recentWrap = make("div", "audience-table-wrap audience-recent-wrap");
    recentWrap.innerHTML = '<table class="audience-recent-table"><thead><tr><th>Visitor</th><th>Location</th><th>Source</th><th>Device</th><th>Visits</th><th>Messages</th><th>Journey</th><th>Last seen</th></tr></thead><tbody id="audienceRecentRows"></tbody></table>';
    recentCard.appendChild(recentWrap);
    grid.appendChild(recentCard);

    section.append(
      heading,
      kpiGrid,
      grid,
      make("p", "audience-privacy", "Geo is approximate. Latitude, longitude and raw visitor IP are not persisted in audience analytics.")
    );

    if (primary) primary.insertAdjacentElement("afterend", section);
    else kpis.insertAdjacentElement("afterend", section);

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
      const values = [
        source.label || "Direct / unknown",
        fmt(source.visitors),
        pct(source.engagementRate),
        pct(source.dashboardRate),
        pct(source.ctaRate),
      ];
      values.forEach((value, index) => {
        const td = make("td", index > 1 ? "audience-rate-cell" : "", value);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = make("td", "audience-table-empty", "No acquisition data yet.");
      td.colSpan = 5;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function stageTone(stage) {
    if (stage === "Consultation click" || stage === "Journey complete") return "strong";
    if (stage === "Human takeover") return "attention";
    if (stage === "Dashboard viewed") return "dashboard";
    if (stage === "Messaged" || stage === "3+ messages") return "engaged";
    return "neutral";
  }

  function recentInSelectedRange(rows = []) {
    const cutoff = Date.now() - (activeRange() * 24 * 60 * 60_000);
    return rows.filter((visitor) => !visitor.lastSeenAt || Number(visitor.lastSeenAt) >= cutoff);
  }

  function renderRecent(rows = []) {
    const tbody = document.getElementById("audienceRecentRows");
    if (!tbody) return;
    tbody.replaceChildren();

    const filtered = recentInSelectedRange(rows).slice(0, 20);
    for (const visitor of filtered) {
      const tr = document.createElement("tr");
      tr.className = "visitor-row";

      const id = make("td", "visitor-id", `#${visitor.id || "ANON"}`);
      id.dataset.label = "Visitor";
      const location = make("td", "visitor-location", visitor.location || "Unknown");
      location.dataset.label = "Location";
      const source = make("td", "visitor-source", visitor.source || "Direct / unknown");
      source.dataset.label = "Source";
      if (visitor.campaign) source.title = `Campaign: ${visitor.campaign}`;
      const device = make("td", "visitor-device", [visitor.device, visitor.browser].filter(Boolean).join(" · "));
      device.dataset.label = "Device";
      const visits = make("td", "visitor-visits", fmt(visitor.visits));
      visits.dataset.label = "Visits";
      const messages = make("td", "visitor-messages", visitor.messageStage || "0");
      messages.dataset.label = "Messages";
      const journey = make("td", "visitor-journey");
      journey.dataset.label = "Journey";
      journey.appendChild(make("span", `visitor-stage stage-${stageTone(visitor.stage)}`, visitor.stage || "Visited"));
      const lastSeen = make("td", "visitor-last-seen", relativeTime(visitor.lastSeenAt));
      lastSeen.dataset.label = "Last seen";

      tr.append(id, location, source, device, visits, messages, journey, lastSeen);
      tbody.appendChild(tr);
    }

    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = make("td", "audience-table-empty", `No visitor profiles in the last ${activeRange()} days.`);
      td.colSpan = 8;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
  }

  function clearAudience() {
    for (const id of ["audienceVisits", "audienceNew", "audienceReturning", "audienceRepeat"]) {
      setText(id, "—");
    }
    setText("audienceRepeatNote", "Avg visit span —");
    renderBreakdown("audienceLocations", []);
    renderBreakdown("audienceDevices", []);
    renderBreakdown("audienceBrowsers", []);
    renderSources([]);
    renderRecent([]);
  }

  function render(audience) {
    latestAudience = audience;
    if (!buildShell()) return;
    const range = audience?.ranges?.[String(activeRange())];
    if (!range) {
      clearAudience();
      return;
    }

    setText("audienceVisits", fmt(range.totalVisits));
    setText("audienceNew", fmt(range.newVisitors));
    setText("audienceReturning", fmt(range.returningVisitors));
    setText("audienceRepeat", pct(range.repeatRate));
    setText("audienceRepeatNote", `Avg visit span ${duration(range.avgActiveSpanMs)}`);

    renderBreakdown("audienceLocations", range.cities?.some((item) => item.label !== "Unknown") ? range.cities : range.countries);
    renderBreakdown("audienceDevices", range.devices);
    renderBreakdown("audienceBrowsers", range.browsers);
    renderSources(range.sources);
    renderRecent(audience.recentVisitors || []);
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

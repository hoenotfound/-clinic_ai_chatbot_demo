(() => {
  const { SAMPLE_LEADS, STAGES, CHANNEL_ICONS, LANG_MESSAGES } = window.PORTAL_DEMO_DATA || {};
  if (!SAMPLE_LEADS) return;
  const pageButtons = Array.from(document.querySelectorAll("[data-portal-page]"));
  const pages = Array.from(document.querySelectorAll(".portal-page"));
  const sampleList = document.getElementById("sampleConversationList");
  const samplePane = document.getElementById("sampleConversationPane");
  const sampleInsights = document.getElementById("sampleLeadPanel");
  const livePane = document.getElementById("liveConversationPane");
  const liveInsights = document.getElementById("liveLeadPanel");
  const liveCard = document.getElementById("liveConversationCard");
  const pipelineBoard = document.getElementById("pipelineBoard");
  const branchStrip = document.getElementById("pipelineBranchStrip");
  const pipelineSearch = document.getElementById("pipelineSearch");
  let activeConversation = "live";
  let pipelineCategory = "all";
  let pipelineBranch = "all";
  let liveSnapshot = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[char]));
  }

  function portalToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(portalToast.timer);
    portalToast.timer = setTimeout(() => toast.classList.add("hidden"), 3500);
  }

  function channelIcon(channel) {
    return CHANNEL_ICONS[channel] || CHANNEL_ICONS.whatsapp;
  }

  function tempBadge(temp) {
    return `<span class="tag-${escapeHtml(temp)}">${escapeHtml(capitalize(temp))}</span>`;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(value || 0);
  }

  function renderSampleList(filter = "all") {
    if (!sampleList) return;
    const rows = SAMPLE_LEADS.filter((lead) => {
      if (filter === "hot") return lead.temperature === "hot";
      if (filter === "attention") return lead.attention;
      return true;
    });
    sampleList.innerHTML = rows.map((lead) => {
      const icon = channelIcon(lead.channel);
      const active = activeConversation === lead.id ? " active" : "";
      const last = lead.messages.at(-1)?.[1] || lead.summary;
      return `<button class="portal-conversation-card sample-conversation-card${active}" type="button" data-sample-id="${lead.id}">
        <div class="conversation-avatar ${icon.className}">${icon.short}</div>
        <div class="portal-conversation-copy">
          <div><strong>${escapeHtml(lead.name)}</strong><time>${escapeHtml(lead.relative)}</time></div>
          <p>${escapeHtml(last)}</p>
          <div class="portal-tags"><span>${escapeHtml(lead.channelLabel)}</span><span class="temperature ${lead.temperature}">${capitalize(lead.temperature)}</span><span>${escapeHtml(lead.language)}</span>${lead.attention ? '<span class="tag-attention">Attention</span>' : ""}</div>
        </div>
      </button>`;
    }).join("");

    sampleList.querySelectorAll("[data-sample-id]").forEach((button) => {
      button.addEventListener("click", () => openSampleConversation(button.dataset.sampleId));
    });
  }

  function setLiveConversation() {
    activeConversation = "live";
    liveCard?.classList.add("active");
    document.querySelectorAll(".sample-conversation-card").forEach((card) => card.classList.remove("active"));
    livePane?.classList.remove("hidden");
    liveInsights?.classList.remove("hidden");
    samplePane?.classList.add("hidden");
    sampleInsights?.classList.add("hidden");
  }

  function openSampleConversation(id) {
    const lead = SAMPLE_LEADS.find((item) => item.id === id);
    if (!lead || !samplePane || !sampleInsights) return;
    activeConversation = id;
    liveCard?.classList.remove("active");
    document.querySelectorAll(".sample-conversation-card").forEach((card) => card.classList.toggle("active", card.dataset.sampleId === id));
    livePane?.classList.add("hidden");
    liveInsights?.classList.add("hidden");
    samplePane.classList.remove("hidden");
    sampleInsights.classList.remove("hidden");
    const icon = channelIcon(lead.channel);
    samplePane.innerHTML = `
      <header class="sample-thread-header">
        <div class="sample-thread-person"><div class="sample-avatar ${icon.className}">${icon.short}</div><div><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.channelLabel)} · ${escapeHtml(lead.language)} sample lead</small></div></div>
        <span class="sample-readonly">Sample history · Read only</span>
      </header>
      <div class="sample-messages">${lead.messages.map(([source, text, time]) => `<div class="sample-message ${source}"><div class="sample-bubble">${escapeHtml(text)}<small>${source === "customer" ? lead.name : source === "staff" ? "Clinic staff" : "AI"} · ${escapeHtml(time)}</small></div></div>`).join("")}</div>
      <div class="sample-thread-footer">Fictional conversation created only to demonstrate the production inbox experience.</div>`;
    sampleInsights.innerHTML = `
      <div class="sample-insight-section"><p class="section-label">Lead temperature</p><div class="sample-temp-title"><div><strong>${capitalize(lead.temperature)}</strong><p>${lead.temperature === "hot" ? "Strong booking intent" : lead.temperature === "warm" ? "Active interest" : "Early enquiry"}</p></div><span class="sample-temp-orb ${lead.temperature}">${lead.temperature === "hot" ? "●" : lead.temperature === "warm" ? "◐" : "○"}</span></div></div>
      <div class="sample-insight-section"><p class="section-label">Conversation summary</p><p>${escapeHtml(lead.summary)}</p></div>
      <div class="sample-insight-section"><p class="section-label">Detected intent</p><dl class="sample-facts"><div><dt>Treatment</dt><dd>${escapeHtml(lead.treatment)}</dd></div><div><dt>Appointment</dt><dd>${escapeHtml(lead.appointment)}</dd></div><div><dt>Branch</dt><dd>${escapeHtml(lead.branch)}</dd></div><div><dt>Timing</dt><dd>${escapeHtml(lead.timing)}</dd></div><div><dt>Source</dt><dd>${escapeHtml(lead.source)}</dd></div><div><dt>Owner</dt><dd>${escapeHtml(lead.owner)}</dd></div></dl></div>
      <div class="sample-insight-section"><p class="section-label">Pipeline stage</p><p><strong>${escapeHtml(STAGES.find((stage) => stage.key === lead.stage)?.label || lead.stage)}</strong></p></div>`;
  }

  function showPortalPage(pageName) {
    pages.forEach((page) => page.classList.toggle("active", page.dataset.page === pageName));
    pageButtons.forEach((button) => button.classList.toggle("active", button.dataset.portalPage === pageName));
    if (pageName === "pipeline") refreshLiveSnapshot().then(renderPipeline);
  }

  async function refreshLiveSnapshot() {
    const sessionId = sessionStorage.getItem("clinicDemoSessionId");
    if (!sessionId) return null;
    try {
      const response = await fetch(`/api/demo/sessions/${encodeURIComponent(sessionId)}`, { headers: { "Content-Type": "application/json" } });
      if (!response.ok) return null;
      const data = await response.json();
      liveSnapshot = data.session || null;
      return liveSnapshot;
    } catch {
      return null;
    }
  }

  function liveAsLead() {
    if (!liveSnapshot || !liveSnapshot.customerMessageCount) return null;
    const lead = liveSnapshot.lead || {};
    const stage = lead.bookingIntent ? "appointment" : lead.temperature === "warm" || lead.temperature === "hot" ? "interested" : "new";
    return {
      id: "live",
      name: "Demo Patient",
      initials: "DP",
      language: "LIVE",
      channel: liveSnapshot.channel || "whatsapp",
      channelLabel: ({ whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Messenger" })[liveSnapshot.channel] || "WhatsApp",
      treatment: lead.interests?.[0] || "Treatment not selected",
      temperature: lead.temperature || "cold",
      branch: lead.preferredBranch || "Unassigned",
      timing: lead.preferredTiming || "Not specified",
      stage,
      value: lead.bookingIntent ? 1800 : 0,
      relative: "Now",
      source: "Live demo",
      owner: liveSnapshot.mode === "human" ? "Demo Admin" : "AI",
      attention: !!liveSnapshot.needsAttention,
      appointment: lead.bookingIntent ? "Intent detected" : "Not set",
      summary: lead.summary || "Live prospect conversation.",
    };
  }

  function pipelineLeads() {
    const live = liveAsLead();
    return live ? [live, ...SAMPLE_LEADS] : SAMPLE_LEADS.slice();
  }

  function renderBranches(leads) {
    if (!branchStrip) return;
    const branches = [
      { key: "all", label: "All branches", leads },
      { key: "Kuala Lumpur", label: "Kuala Lumpur", leads: leads.filter((lead) => lead.branch === "Kuala Lumpur") },
      { key: "Petaling Jaya", label: "Petaling Jaya", leads: leads.filter((lead) => lead.branch === "Petaling Jaya") },
      { key: "Unassigned", label: "Unassigned", leads: leads.filter((lead) => lead.branch === "Unassigned" || !lead.branch) },
    ];
    branchStrip.innerHTML = branches.map((branch) => `<button class="branch-card${pipelineBranch === branch.key ? " active" : ""}" type="button" data-branch="${escapeHtml(branch.key)}"><div><strong>${escapeHtml(branch.label)}</strong><b>${branch.leads.length}</b></div><small>${branch.leads.filter((lead) => lead.temperature === "hot").length} hot · ${branch.leads.filter((lead) => lead.stage === "appointment").length} appointments</small></button>`).join("");
    branchStrip.querySelectorAll("[data-branch]").forEach((button) => button.addEventListener("click", () => { pipelineBranch = button.dataset.branch; renderPipeline(); }));
  }

  function renderPipeline() {
    if (!pipelineBoard) return;
    const all = pipelineLeads();
    renderBranches(all);
    const search = (pipelineSearch?.value || "").trim().toLowerCase();
    const filtered = all.filter((lead) => {
      if (pipelineBranch !== "all" && lead.branch !== pipelineBranch) return false;
      if (pipelineCategory === "hot" && lead.temperature !== "hot") return false;
      if (pipelineCategory === "warm" && lead.temperature !== "warm") return false;
      if (pipelineCategory === "cold" && lead.temperature !== "cold") return false;
      if (pipelineCategory === "attention" && !lead.attention) return false;
      if (search) {
        const haystack = [lead.name, lead.treatment, lead.branch, lead.channelLabel, lead.language, lead.source].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    document.getElementById("pipelineActiveCount").textContent = all.length;
    document.getElementById("pipelineHotCount").textContent = all.filter((lead) => lead.temperature === "hot").length;
    pipelineBoard.innerHTML = STAGES.map((stage) => {
      const leads = filtered.filter((lead) => lead.stage === stage.key);
      const value = leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
      return `<section class="kanban-stage"><header class="kanban-stage-header"><div class="kanban-stage-title"><div><span class="stage-dot" style="background:${stage.color}"></span><h2>${stage.label}</h2></div><span class="kanban-stage-count">${leads.length}</span></div><p>${formatMoney(value)} estimated value</p></header><div class="kanban-cards">${leads.map(renderKanbanCard).join("") || '<div style="padding:18px;text-align:center;color:#7b847f;font-size:9px">No leads here</div>'}</div></section>`;
    }).join("");
    pipelineBoard.querySelectorAll("[data-pipeline-lead]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.pipelineLead;
      showPortalPage("inbox");
      if (id === "live") setLiveConversation(); else openSampleConversation(id);
    }));
  }

  function renderKanbanCard(lead) {
    const icon = channelIcon(lead.channel);
    return `<button class="kanban-card" type="button" data-pipeline-lead="${lead.id}"><div class="kanban-card-top"><div class="mini-avatar ${icon.className}">${icon.short}</div><div class="kanban-card-copy"><div><strong>${escapeHtml(lead.name)}</strong>${lead.value ? `<b>${formatMoney(lead.value)}</b>` : ""}</div><p>${escapeHtml(lead.treatment)}</p></div></div><div class="kanban-badges">${tempBadge(lead.temperature)}<span class="tag-branch">${escapeHtml(lead.branch || "Unassigned")}</span>${lead.attention ? '<span class="tag-attention">Attention</span>' : ""}${lead.language === "LIVE" ? '<span class="tag-branch">LIVE</span>' : `<span class="tag-branch">${escapeHtml(lead.language)}</span>`}</div><div class="kanban-card-meta"><span>${escapeHtml(lead.owner === "Unassigned" ? "No owner" : `Owner: ${lead.owner}`)}</span><span>${escapeHtml(lead.relative)}</span></div></button>`;
  }

  function renderAnalyticsFunnel() {
    const target = document.getElementById("analyticsFunnel");
    if (!target) return;
    const rows = [
      ["New Leads", 126, 100],
      ["Appointments", 34, 27],
      ["Clinic Visits", 25, 19.8],
      ["Won", 17, 13.5],
    ];
    target.innerHTML = rows.map(([label, count, percent], index) => `<div class="funnel-row"><div class="funnel-label"><div><strong>${label}</strong>${index ? `<small style="display:block;color:#69736d;font-size:7px;margin-top:2px">${percent.toFixed(1)}% of leads</small>` : ""}</div><span>${count}</span></div><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(percent, 10)}%">${count}</div></div></div>`).join("");
  }

  function initTools() {
    document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => {
      const tool = button.dataset.tool;
      document.querySelectorAll("[data-tool]").forEach((item) => item.classList.toggle("active", item.dataset.tool === tool));
      document.getElementById("toolFollowUp")?.classList.toggle("active", tool === "followUp");
      document.getElementById("toolLeadScoring")?.classList.toggle("active", tool === "leadScoring");
    }));
    document.querySelectorAll(".demo-toggle").forEach((button) => button.addEventListener("click", () => { button.classList.toggle("on"); portalToast("Demo preview only — this toggle does not change your production chatbot."); }));
    document.querySelectorAll("[data-tool-save]").forEach((button) => button.addEventListener("click", () => portalToast("Demo preview only — settings are not saved.")));
    document.querySelectorAll("[data-lang]").forEach((button) => button.addEventListener("click", () => {
      const key = button.dataset.lang;
      document.querySelectorAll("[data-lang]").forEach((item) => item.classList.toggle("active", item.dataset.lang === key));
      const box = document.getElementById("followUpLanguageText");
      if (box) box.value = LANG_MESSAGES[key] || LANG_MESSAGES.en;
    }));
  }

  function initFilters() {
    document.querySelectorAll("[data-inbox-filter]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll(".portal-list-filters button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderSampleList(button.dataset.inboxFilter || "all");
    }));
    document.querySelector(".portal-list-filters button:not([data-inbox-filter])")?.addEventListener("click", (event) => {
      document.querySelectorAll(".portal-list-filters button").forEach((item) => item.classList.remove("active"));
      event.currentTarget.classList.add("active");
      renderSampleList("all");
    });
    document.querySelectorAll("[data-pipeline-category]").forEach((button) => button.addEventListener("click", () => {
      pipelineCategory = button.dataset.pipelineCategory;
      document.querySelectorAll("[data-pipeline-category]").forEach((item) => item.classList.toggle("active", item === button));
      renderPipeline();
    }));
    pipelineSearch?.addEventListener("input", renderPipeline);
  }

  pageButtons.forEach((button) => button.addEventListener("click", () => showPortalPage(button.dataset.portalPage)));
  liveCard?.addEventListener("click", setLiveConversation);
  document.querySelector("[data-analytics-refresh]")?.addEventListener("click", () => portalToast("Sample analytics refreshed. Live deployments calculate these metrics from real lead journeys."));
  document.querySelectorAll(".analytics-filters button, .analytics-filters select").forEach((control) => control.addEventListener("change", () => portalToast("Filters are interactive placeholders in the public demo.")));
  document.querySelectorAll(".analytics-filters button").forEach((control) => control.addEventListener("click", () => { if (!control.classList.contains("production-primary-btn")) portalToast("Filters are interactive placeholders in the public demo."); }));
  document.querySelector(".analytics-filters .production-primary-btn")?.addEventListener("click", () => portalToast("Sample analytics filters applied."));

  const countEl = document.getElementById("portalConversationCount");
  if (countEl) countEl.textContent = String(SAMPLE_LEADS.length + 1);
  document.getElementById("dashboardTab")?.addEventListener("click", () => { showPortalPage("inbox"); setLiveConversation(); });
  document.getElementById("newDemoButton")?.addEventListener("click", () => setTimeout(() => { showPortalPage("inbox"); setLiveConversation(); refreshLiveSnapshot().then(renderPipeline); }, 150));

  renderSampleList();
  renderAnalyticsFunnel();
  initTools();
  initFilters();
  refreshLiveSnapshot().then(renderPipeline);
  setInterval(() => {
    if (document.getElementById("dashboardView")?.classList.contains("active")) refreshLiveSnapshot().then(() => {
      if (document.getElementById("portalPagePipeline")?.classList.contains("active")) renderPipeline();
    });
  }, 4000);
})();

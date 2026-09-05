(() => {
  function setText(selector, value, root = document) {
    const element = root.querySelector(selector);
    if (element && value != null) element.textContent = value;
    return element;
  }

  function setMeta(name, value) {
    const element = document.querySelector(`meta[name="${name}"]`);
    if (element && value) element.setAttribute("content", value);
  }

  function selectedIndustry() {
    try {
      const query = new URL(window.location.href).searchParams.get("industry");
      return query || sessionStorage.getItem("demoIndustry") || localStorage.getItem("demoIndustryPreference") || "";
    } catch {
      return "";
    }
  }

  function installHeroShowcaseLayout() {
    if (document.querySelector('link[data-hero-showcase-layout="true"]')) return;
    const currentSource = document.currentScript?.src ||
      [...document.scripts].find((script) => /industry-experience\.js(?:\?|$)/.test(script.src))?.src;
    if (!currentSource) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("hero-showcase-layout.css", currentSource).href;
    link.dataset.heroShowcaseLayout = "true";
    document.head.appendChild(link);
  }

  function renderHero(experience) {
    const badge = document.querySelector(".scaling-pill");
    if (badge) badge.innerHTML = `<span class="status-dot"></span>${experience.badge}`;

    const heading = document.querySelector(".hero-main h1");
    if (heading) {
      heading.replaceChildren(
        document.createTextNode(experience.hero.headlinePrefix),
        Object.assign(document.createElement("span"), { className: "text-gradient", textContent: experience.hero.headlineAccent })
      );
    }
    setText(".hero-copy", experience.hero.copy);

    const footnotes = document.querySelectorAll(".hero-footnote span");
    if (footnotes[1]) footnotes[1].textContent = experience.hero.footnotes[0];
    if (footnotes[2]) footnotes[2].textContent = experience.hero.footnotes[1];

    setText(".hero-product-topbar strong", experience.hero.shortBusinessName);
    setText(".hero-product-topbar span", experience.hero.assistantStatus);
    const heroMessages = document.querySelectorAll(".hero-chat-flow .hero-message");
    experience.hero.messages.forEach((message, index) => {
      if (heroMessages[index]) heroMessages[index].textContent = message;
    });
    setText(".hero-lead-card span", experience.hero.intentLabel);
    setText(".hero-lead-card strong", experience.hero.leadSummary);
  }

  function renderLiveDemo(experience) {
    setText("#demoSectionTitle", experience.section.title);
    setText(".demo-section > .section-heading > p", experience.section.copy);
    setText(".experience-status strong", experience.chat.businessName);

    setText("#patientTab strong", experience.view.customerTab);
    setText("#dashboardTab strong", experience.view.dashboardTab);
    setText("#dashboardTab small", experience.view.dashboardHint);

    setText("#tourStatus", experience.tour.startStatus);
    setText("#tourStep1 small", experience.tour.firstHint);
    setText("#tourStep2 strong", experience.tour.intentTitle);
    setText("#tourStep2 small", experience.tour.intentHint);
    setText("#tourStep3 strong", experience.tour.dashboardTitle);
    setText("#tourStep4 small", experience.tour.staffHint);

    document.querySelectorAll(".clinic-avatar, .empty-logo, .hero-product-avatar").forEach((element) => {
      element.textContent = experience.chat.businessName.charAt(0).toUpperCase();
    });
    setText(".chat-title strong", experience.chat.businessName);
    setText("#emptyChat strong", experience.chat.businessName);
    setText("#emptyChat p", experience.chat.emptyText);
    setText("#emptyChat span", experience.chat.emptyBadge);
    setText(".privacy-note", experience.chat.privacy);
    setText(".prompt-panel .guide-label strong", experience.chat.suggestionHeading);

    const chips = document.querySelectorAll(".prompt-panel .suggestion-chip");
    experience.suggestions.forEach((item, index) => {
      const chip = chips[index];
      if (!chip) return;
      chip.dataset.message = item.message;
      setText("span", item.kind, chip);
      setText("strong", item.label, chip);
    });

    const captureRows = document.querySelectorAll(".capture-preview-grid span");
    experience.capture.rows.forEach(([label, value], index) => {
      const row = captureRows[index];
      if (!row) return;
      setText("small", label, row);
      setText("strong", value, row);
    });
    setText(".capture-preview-note", experience.capture.note);
  }

  function renderWorkflow(experience) {
    const steps = document.querySelectorAll("#how-it-works article");
    experience.workflow.forEach(([title, detail], index) => {
      const step = steps[index];
      if (!step) return;
      setText("strong", title, step);
      setText("small", detail, step);
    });
  }

  function renderCapabilities(experience) {
    const cards = document.querySelectorAll(".capability-card");
    experience.capabilities.forEach(([title, copy, bullets], index) => {
      const card = cards[index];
      if (!card) return;
      setText("h3", title, card);
      setText("p", copy, card);
      const items = card.querySelectorAll("li");
      bullets.forEach((bullet, bulletIndex) => {
        if (items[bulletIndex]) items[bulletIndex].textContent = bullet;
      });
    });
  }

  function renderSales(experience) {
    const sales = experience.sales;
    setText(".sales-kicker", sales.kicker);
    const heading = document.querySelector(".sales-cta-copy h2");
    if (heading) {
      heading.replaceChildren(
        document.createTextNode(sales.headingPrefix),
        Object.assign(document.createElement("span"), { className: "sales-cta-ai-accent", textContent: sales.headingAccent }),
        document.createTextNode("?")
      );
    }
    setText(".sales-cta-copy > p:not(.sales-kicker)", sales.copy);
    const trust = document.querySelectorAll(".sales-cta-trust span");
    sales.trust.forEach((item, index) => {
      if (trust[index]) trust[index].textContent = item;
    });
    setText(".sales-cta-actions small", sales.footer);
  }

  function renderAcquisitionCopy(config) {
    const presets = Object.values(config.acquisitionPresets || {});
    const buttons = document.querySelectorAll("[data-acquisition-key]");
    buttons.forEach((button) => {
      const preset = config.acquisitionPresets?.[button.dataset.acquisitionKey];
      if (!preset) return;
      setText("span", preset.source, button);
      setText("strong", preset.label, button);
    });
    if (presets.length) {
      const helper = document.querySelector("[data-acquisition-selector] .prompt-helper");
      if (helper && config.publicExperience?.acquisitionHelper) helper.textContent = config.publicExperience.acquisitionHelper;
    }
  }

  function applyConfig(config) {
    if (!config?.industryKey || !config.publicExperience) return;
    window.demoIndustryConfig = config;
    document.documentElement.dataset.demoIndustry = config.industryKey;
    document.title = config.publicExperience.title;
    setMeta("description", config.publicExperience.metaDescription);
    renderHero(config.publicExperience);
    renderLiveDemo(config.publicExperience);
    renderWorkflow(config.publicExperience);
    renderCapabilities(config.publicExperience);
    renderSales(config.publicExperience);
    renderAcquisitionCopy(config);
    window.dispatchEvent(new CustomEvent("demo-industry-config", { detail: config }));
  }

  async function loadConfig() {
    const selected = selectedIndustry();
    if (window.demoIndustryConfig?.industryKey && (!selected || window.demoIndustryConfig.industryKey === selected)) {
      return applyConfig(window.demoIndustryConfig);
    }
    try {
      const suffix = selected ? `?industry=${encodeURIComponent(selected)}` : "";
      const response = await fetch(`/api/demo/config${suffix}`, { headers: { Accept: "application/json" } });
      if (!response.ok) return;
      applyConfig(await response.json());
    } catch {}
  }

  installHeroShowcaseLayout();
  window.applyDemoIndustryExperience = applyConfig;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadConfig, { once: true });
  else loadConfig();
})();

const state = {
  config: null,
  industryKey: null,
  industryOptions: [],
  session: null,
  loading: false,
  messagePending: false,
  transitioning: false,
  activeView: "patient",
  hasViewedDashboard: false,
  hasTakenOver: false,
  syncTimer: null,
  telemetryTimer: null,
  industrySwitcherButton: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  patientTab: $("patientTab"),
  dashboardTab: $("dashboardTab"),
  patientView: $("patientView"),
  dashboardView: $("dashboardView"),
  newDemoButton: $("newDemoButton"),
  messages: $("messages"),
  emptyChat: $("emptyChat"),
  typingIndicator: $("typingIndicator"),
  customerForm: $("customerForm"),
  customerInput: $("customerInput"),
  customerSendButton: $("customerSendButton"),
  phone: $("phone"),
  channelStatusText: $("channelStatusText"),
  channelCaption: $("channelCaption"),
  messageCounter: $("messageCounter"),
  attentionTabDot: $("attentionTabDot"),
  tourStatus: $("tourStatus"),
  tourProgress: $("tourProgress"),
  tourStep1: $("tourStep1"),
  tourStep2: $("tourStep2"),
  tourStep3: $("tourStep3"),
  tourStep4: $("tourStep4"),
  salesCta: $("salesCta"),
  salesCtaButton: $("salesCtaButton"),
  toast: $("toast"),
};

const channelMeta = {
  whatsapp: { label: "WhatsApp", theme: "whatsapp-theme", status: "online", caption: "WhatsApp customer experience" },
  instagram: { label: "Instagram", theme: "instagram-theme", status: "Active now", caption: "Instagram customer experience" },
  facebook: { label: "Messenger", theme: "facebook-theme", status: "Active now", caption: "Messenger customer experience" },
};

const VALID_INDUSTRIES = new Set(["clinic", "renovation"]);
const FALLBACK_INDUSTRIES = [
  {
    key: "clinic",
    label: "Aesthetic Clinic",
    eyebrow: "APPOINTMENTS & TREATMENTS",
    description: "Treatment enquiries, pricing, appointment intent, multilingual replies and human takeover.",
    highlights: ["Treatment enquiries", "Appointment intent", "Patient handoff"],
    icon: "clinic",
  },
  {
    key: "renovation",
    label: "Home Renovation & Carpentry",
    eyebrow: "QUOTATIONS & SITE MEASUREMENT",
    description: "Kitchen cabinets, wardrobes, renovation qualification, quotation intent and site-measurement handoff.",
    highlights: ["Cabinet enquiries", "Quotation intent", "Site measurement"],
    icon: "home",
  },
];

function normalizeIndustry(value) {
  const key = String(value || "").trim().toLowerCase();
  if (["renovation", "home-renovation", "carpentry"].includes(key)) return "renovation";
  return key === "clinic" ? "clinic" : null;
}

function queryIndustry() {
  try {
    return normalizeIndustry(new URL(window.location.href).searchParams.get("industry"));
  } catch {
    return null;
  }
}

function storedIndustry() {
  try {
    return normalizeIndustry(sessionStorage.getItem("demoIndustry") || localStorage.getItem("demoIndustryPreference"));
  } catch {
    return null;
  }
}

function saveIndustryPreference(key) {
  try {
    sessionStorage.setItem("demoIndustry", key);
    localStorage.setItem("demoIndustryPreference", key);
  } catch {}
}

function setIndustryUrl(key, { replace = true } = {}) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("industry", key);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (replace) window.history.replaceState({}, "", next);
    else window.location.assign(next);
  } catch {}
}

function profileLabels() {
  return state.config?.labels || {
    customer: "Patient",
    service: "Treatment",
    location: "Branch",
    timing: "Timing",
    appointment: "Appointment",
    dashboard: "Clinic Dashboard",
    staff: "Clinic staff",
  };
}

function publicExperience() {
  return state.config?.publicExperience || null;
}

function hasHighIntent(lead = state.session?.lead) {
  if (!lead) return false;
  const fields = state.config?.highIntentFields || ["bookingIntent"];
  return fields.some((field) => Boolean(lead[field]));
}

function createVisitorId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function getVisitorId() {
  try {
    const stored = localStorage.getItem("clinicDemoVisitorId");
    if (stored) return stored;
    const created = createVisitorId();
    localStorage.setItem("clinicDemoVisitorId", created);
    return created;
  } catch {
    return createVisitorId();
  }
}

const visitorId = getVisitorId();

function recordTelemetry(event = "heartbeat", surface = state.activeView) {
  if (document.visibilityState === "hidden" && event === "heartbeat") return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId, event, surface, industry: state.industryKey }),
    keepalive: true,
  }).catch(() => {});
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 3500);
}
window.showToast = showToast;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function ensureIndustryStyles() {
  if (document.querySelector('link[data-industry-switcher="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/industry-switcher.css";
  link.dataset.industrySwitcher = "true";
  document.head.appendChild(link);
}

async function loadIndustryOptions() {
  try {
    const data = await api("/api/demo/industries");
    const options = Array.isArray(data.industries) ? data.industries.filter((item) => VALID_INDUSTRIES.has(item.key)) : [];
    if (options.length) return options;
  } catch {}
  return FALLBACK_INDUSTRIES;
}

function industryIcon(key) {
  return key === "renovation" ? "⌂" : "+";
}

function createIndustryCard(option, currentKey, choose) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "industry-picker-card";
  button.dataset.industry = option.key;
  if (option.key === currentKey) button.classList.add("is-current");

  const icon = document.createElement("span");
  icon.className = "industry-picker-icon";
  icon.textContent = industryIcon(option.key);

  if (option.key === currentKey) {
    const current = document.createElement("span");
    current.className = "industry-picker-current";
    current.textContent = "Current";
    button.appendChild(current);
  }

  const eyebrow = document.createElement("small");
  eyebrow.textContent = option.eyebrow || "DEMO INDUSTRY";
  const title = document.createElement("strong");
  title.textContent = option.label;
  const description = document.createElement("p");
  description.textContent = option.description || "Explore this AI chatbot demo profile.";
  const tags = document.createElement("div");
  tags.className = "industry-picker-tags";
  (option.highlights || []).slice(0, 3).forEach((item) => {
    const tag = document.createElement("span");
    tag.textContent = item;
    tags.appendChild(tag);
  });
  const arrow = document.createElement("span");
  arrow.className = "industry-picker-arrow";
  arrow.textContent = option.key === currentKey ? "Continue this demo  →" : "Open this demo  →";

  button.append(icon, eyebrow, title, description, tags, arrow);
  button.addEventListener("click", () => choose(option.key));
  return button;
}

function showIndustryPicker(options, currentKey, { required = false } = {}) {
  ensureIndustryStyles();
  return new Promise((resolve) => {
    const existing = document.querySelector("[data-industry-picker]");
    existing?.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "industry-picker-backdrop";
    backdrop.dataset.industryPicker = "true";
    backdrop.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "industry-picker-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "industryPickerTitle");

    const head = document.createElement("div");
    head.className = "industry-picker-head";
    const headingCopy = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "industry-picker-kicker";
    kicker.textContent = "INTERACTIVE AI CHATBOT DEMOS";
    const title = document.createElement("h2");
    title.id = "industryPickerTitle";
    title.textContent = required ? "Choose an industry to explore" : "Switch demo industry";
    const copy = document.createElement("p");
    copy.textContent = required
      ? "Pick the business closest to what you want to see. Each demo has its own AI behaviour, lead qualification, sample data and dashboard workflow."
      : "Switching industry starts a fresh private demo session so conversations and lead data never mix between profiles.";
    headingCopy.append(kicker, title, copy);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "industry-picker-close";
    close.setAttribute("aria-label", "Close industry selector");
    close.textContent = "×";
    if (required) close.hidden = true;
    head.append(headingCopy, close);

    const grid = document.createElement("div");
    grid.className = "industry-picker-grid";

    let settled = false;
    const cleanup = (value) => {
      if (settled) return;
      settled = true;
      document.documentElement.classList.remove("industry-picker-open");
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      resolve(value);
    };
    const choose = (key) => cleanup(key);
    options.forEach((option) => grid.appendChild(createIndustryCard(option, currentKey, choose)));

    const foot = document.createElement("p");
    foot.className = "industry-picker-foot";
    foot.textContent = "You can switch industry anytime from the demo toolbar.";

    dialog.append(head, grid, foot);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    document.documentElement.classList.add("industry-picker-open");

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !required) cleanup(null);
    };
    document.addEventListener("keydown", onKeyDown);
    close.addEventListener("click", () => cleanup(null));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && !required) cleanup(null);
    });
    requestAnimationFrame(() => grid.querySelector("button")?.focus());
  });
}

function clearSessionForIndustrySwitch() {
  try {
    sessionStorage.removeItem("clinicDemoSessionId");
    sessionStorage.removeItem("demoSessionId:clinic");
    sessionStorage.removeItem("demoSessionId:renovation");
    sessionStorage.removeItem("clinicDemoAcquisition");
  } catch {}
}

async function resolveInitialIndustry() {
  state.industryOptions = await loadIndustryOptions();
  const fromQuery = queryIndustry();
  const fromStorage = storedIndustry();
  const selected = fromQuery || fromStorage;

  if (selected) {
    if (fromQuery && fromStorage && fromQuery !== fromStorage) clearSessionForIndustrySwitch();
    saveIndustryPreference(selected);
    setIndustryUrl(selected, { replace: true });
    return selected;
  }

  const chosen = await showIndustryPicker(state.industryOptions, null, { required: true });
  const key = normalizeIndustry(chosen) || "clinic";
  clearSessionForIndustrySwitch();
  saveIndustryPreference(key);
  setIndustryUrl(key, { replace: true });
  return key;
}

function currentIndustryOption() {
  return state.industryOptions.find((item) => item.key === state.industryKey) || FALLBACK_INDUSTRIES.find((item) => item.key === state.industryKey);
}

function installIndustrySwitcher() {
  const toolbar = document.querySelector(".experience-toolbar");
  if (!toolbar || toolbar.querySelector("[data-industry-switcher-button]")) return;
  ensureIndustryStyles();

  let actions = toolbar.querySelector(".industry-switcher-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "industry-switcher-actions";
    if (els.newDemoButton) {
      toolbar.insertBefore(actions, els.newDemoButton);
      actions.appendChild(els.newDemoButton);
    } else {
      toolbar.appendChild(actions);
    }
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "industry-switcher-button";
  button.dataset.industrySwitcherButton = "true";
  button.setAttribute("aria-label", "Switch demo industry");

  const icon = document.createElement("span");
  icon.className = "industry-switcher-icon";
  icon.textContent = industryIcon(state.industryKey);
  const copy = document.createElement("span");
  copy.className = "industry-switcher-copy";
  const small = document.createElement("small");
  small.textContent = "Demo industry · Switch";
  const strong = document.createElement("strong");
  strong.textContent = currentIndustryOption()?.label || "Choose industry";
  copy.append(small, strong);
  const chevron = document.createElement("span");
  chevron.className = "industry-switcher-chevron";
  chevron.textContent = "⌄";
  button.append(icon, copy, chevron);

  button.addEventListener("click", async () => {
    if (state.messagePending || state.transitioning) return;
    const selected = await showIndustryPicker(state.industryOptions, state.industryKey, { required: false });
    const next = normalizeIndustry(selected);
    if (!next || next === state.industryKey) return;
    clearSessionForIndustrySwitch();
    saveIndustryPreference(next);
    setIndustryUrl(next, { replace: false });
  });

  actions.insertBefore(button, els.newDemoButton || null);
  state.industrySwitcherButton = button;
}

function configureDashboardFrame() {
  const frame = document.getElementById("reactDashboardFrame");
  if (!frame || !state.industryKey) return;
  const raw = frame.getAttribute("src") || "./dashboard/inbox";
  const base = raw.split("?")[0];
  frame.setAttribute("src", `${base}?industry=${encodeURIComponent(state.industryKey)}`);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function waitForPaint() {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function paintOutgoingMessageBeforeRequest() {
  await waitForPaint();
  if (els.messages) els.messages.scrollTop = els.messages.scrollHeight;
  await waitForPaint();
}

function refreshInteractionState() {
  const blocked = state.messagePending || state.transitioning;
  if (els.customerInput) els.customerInput.disabled = blocked;
  if (els.customerSendButton) els.customerSendButton.disabled = blocked;
  if (els.newDemoButton) els.newDemoButton.disabled = blocked;
  if (state.industrySwitcherButton) state.industrySwitcherButton.disabled = blocked;
  document.querySelectorAll(".channel-button, .suggestion-chip").forEach((button) => {
    button.disabled = blocked;
  });
}

function setTransitioning(transitioning) {
  state.transitioning = transitioning;
  refreshInteractionState();
}

function setActiveView(view) {
  const changed = state.activeView !== view;
  state.activeView = view;
  if (view === "dashboard") state.hasViewedDashboard = true;
  const patient = view === "patient";
  els.patientTab?.classList.toggle("active", patient);
  els.dashboardTab?.classList.toggle("active", !patient);
  els.patientTab?.setAttribute("aria-selected", String(patient));
  els.dashboardTab?.setAttribute("aria-selected", String(!patient));
  els.patientView?.classList.toggle("active", patient);
  els.dashboardView?.classList.toggle("active", !patient);
  if (changed) recordTelemetry(`${view}_view`, view);
  renderTour();
}

function channelFromUi() {
  return document.querySelector(".channel-button.active")?.dataset.channel || "whatsapp";
}

function renderChannel() {
  const channel = state.session?.channel || "whatsapp";
  const meta = channelMeta[channel] || channelMeta.whatsapp;
  document.querySelectorAll(".channel-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === channel);
  });
  if (els.phone) {
    els.phone.classList.remove("whatsapp-theme", "instagram-theme", "facebook-theme");
    els.phone.classList.add(meta.theme);
  }
  if (els.channelStatusText) els.channelStatusText.textContent = meta.status;
  if (els.channelCaption) els.channelCaption.textContent = meta.caption;
}

function buildMessageBubble(message) {
  const row = document.createElement("div");
  row.className = `message-row ${message.role === "user" ? "user" : "assistant"}`;
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const text = document.createElement("div");
  text.textContent = message.content;
  bubble.appendChild(text);
  if (message.source === "staff") {
    const source = document.createElement("div");
    source.className = "message-source";
    source.textContent = profileLabels().staff;
    bubble.appendChild(source);
  }
  const time = document.createElement("small");
  time.textContent = formatTime(message.createdAt);
  bubble.appendChild(time);
  row.appendChild(bubble);
  return row;
}

function buildPromoCard() {
  if (!state.config?.promotion) return null;
  const card = document.createElement("div");
  card.className = "message-row assistant";
  const content = document.createElement("div");
  content.className = "promo-card";
  const image = document.createElement("img");
  image.src = state.config.promotion.assetPath;
  image.alt = state.config.promotion.title;
  const caption = document.createElement("p");
  caption.textContent = state.config.promotion.description;
  content.append(image, caption);
  card.appendChild(content);
  return card;
}

function renderPatientMessages() {
  if (!els.messages) return;
  const messages = state.session?.messages || [];
  els.messages.innerHTML = "";
  if (!messages.length) {
    if (els.emptyChat) {
      els.messages.appendChild(els.emptyChat);
      els.emptyChat.classList.remove("hidden");
    }
    return;
  }
  for (const message of messages) {
    els.messages.appendChild(buildMessageBubble(message));
    const promoAnchor = state.session?.promotionAfterMessageId;
    if (promoAnchor && promoAnchor === message.id) {
      const promo = buildPromoCard();
      if (promo) els.messages.appendChild(promo);
    }
  }
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderCounters() {
  const count = state.session?.customerMessageCount || 0;
  const max = state.session?.maxMessages || state.config?.limits?.maxMessages || 30;
  if (els.messageCounter) els.messageCounter.textContent = `${count} / ${max} demo messages`;
}

function renderAttention() {
  const attention = Boolean(state.session?.needsAttention);
  els.attentionTabDot?.classList.toggle("hidden", !attention);
}

function renderTour() {
  if (!state.session || !els.tourStatus) return;
  const experience = publicExperience();
  const asked = state.session.customerMessageCount > 0;
  const intent = hasHighIntent();
  const dashboard = state.hasViewedDashboard;
  const takeover = state.hasTakenOver || state.session.mode === "human" || state.session.messages.some((message) => message.source === "staff");
  const steps = [asked, intent, dashboard, takeover];
  [els.tourStep1, els.tourStep2, els.tourStep3, els.tourStep4].forEach((element, index) => {
    element?.classList.toggle("complete", steps[index]);
    element?.classList.toggle("current", !steps[index] && steps.slice(0, index).every(Boolean));
  });
  const completed = steps.filter(Boolean).length;
  if (els.tourProgress) els.tourProgress.textContent = `${completed} / 4`;
  if (!asked) els.tourStatus.textContent = experience?.tour?.startStatus || "Tap a sample question below";
  else if (!intent) els.tourStatus.textContent = experience?.tour?.afterQuestion || "Continue the enquiry";
  else if (!dashboard) els.tourStatus.textContent = experience?.tour?.intentDetected || `High intent detected — open ${profileLabels().dashboard}`;
  else if (!takeover) els.tourStatus.textContent = "Open the live conversation and try Take over";
  else els.tourStatus.textContent = "Full customer journey completed ✓";

  const shouldHighlightDashboard = intent && !dashboard && state.activeView === "patient";
  els.dashboardTab?.classList.toggle("guide-highlight", shouldHighlightDashboard);
  els.salesCta?.classList.toggle("guide-highlight-soft", takeover);
}

function configureSalesCta() {
  if (!els.salesCtaButton || !state.config?.salesCta) return;
  els.salesCtaButton.textContent = state.config.salesCta.label || "Set up my AI chatbot";
  const url = state.config.salesCta.url || "";
  if (url) {
    els.salesCtaButton.href = url;
    els.salesCtaButton.target = "_blank";
    els.salesCtaButton.rel = "noopener noreferrer";
    els.salesCtaButton.removeAttribute("data-cta-unconfigured");
  } else {
    els.salesCtaButton.href = "#";
    els.salesCtaButton.dataset.ctaUnconfigured = "true";
  }
}

function renderAll() {
  if (!state.session) return;
  renderChannel();
  renderPatientMessages();
  renderCounters();
  renderAttention();
  renderTour();
}

function setLoading(loading) {
  state.loading = loading;
  els.typingIndicator?.classList.toggle("hidden", !loading);
  refreshInteractionState();
  if (loading && els.messages) setTimeout(() => { els.messages.scrollTop = els.messages.scrollHeight; }, 0);
}

function activeSessionStorageKey() {
  return `demoSessionId:${state.industryKey || "clinic"}`;
}

async function createSession(channel = "whatsapp") {
  const data = await api("/api/demo/sessions", {
    method: "POST",
    body: JSON.stringify({ channel, industry: state.industryKey }),
  });
  state.session = data.session;
  state.hasViewedDashboard = false;
  state.hasTakenOver = false;
  sessionStorage.setItem(activeSessionStorageKey(), state.session.id);
  sessionStorage.setItem("clinicDemoSessionId", state.session.id);
  renderAll();
}

async function restoreOrCreateSession() {
  const saved = sessionStorage.getItem(activeSessionStorageKey());
  if (saved) {
    try {
      const data = await api(`/api/demo/sessions/${encodeURIComponent(saved)}`);
      state.session = data.session;
      sessionStorage.setItem("clinicDemoSessionId", state.session.id);
      state.hasTakenOver = state.session.mode === "human" || state.session.messages.some((message) => message.source === "staff");
      renderAll();
      return;
    } catch {
      sessionStorage.removeItem(activeSessionStorageKey());
      sessionStorage.removeItem("clinicDemoSessionId");
    }
  }
  await createSession("whatsapp");
}

async function syncSession() {
  if (state.messagePending || state.transitioning || !state.session?.id) return;
  const sessionId = state.session.id;
  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(sessionId)}`);
    if (state.transitioning || state.messagePending || state.session?.id !== sessionId) return;
    state.session = data.session;
    state.hasTakenOver = state.hasTakenOver || state.session.mode === "human" || state.session.messages.some((message) => message.source === "staff");
    renderAll();
  } catch (error) {
    if (state.session?.id !== sessionId) return;
    if (/expired/i.test(error.message)) {
      sessionStorage.removeItem(activeSessionStorageKey());
      sessionStorage.removeItem("clinicDemoSessionId");
    }
  }
}

async function sendCustomerMessage(rawMessage) {
  if (state.messagePending || state.transitioning || !state.session) return;
  const message = rawMessage.trim();
  if (!message) return;

  const sessionId = state.session.id;
  const shouldShowTyping = state.session.mode === "ai";
  const optimistic = {
    id: `optimistic-${Date.now()}`,
    role: "user",
    content: message,
    source: "customer",
    createdAt: Date.now(),
  };

  state.messagePending = true;
  state.session.messages.push(optimistic);
  if (els.customerInput) els.customerInput.value = "";
  renderAll();
  setLoading(shouldShowTyping);
  await paintOutgoingMessageBeforeRequest();

  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(sessionId)}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    if (state.session?.id !== sessionId) return;
    state.session = data.session;
    renderAll();
    if (data.degraded) {
      showToast("The live AI provider had a temporary issue. The conversation was kept so you can try again.");
    } else if (state.session.needsAttention) {
      showToast(`The AI requested staff assistance. Open ${profileLabels().dashboard} to see the handoff.`);
    } else if (hasHighIntent(state.session.lead) && !state.hasViewedDashboard) {
      const prefix = state.config?.industryKey === "clinic" ? "Booking intent detected." : "High-intent renovation enquiry detected.";
      showToast(`${prefix} Open ${profileLabels().dashboard} to see what your team would see.`);
    }
  } catch (error) {
    if (state.session?.id === sessionId) {
      state.session.messages = state.session.messages.filter((item) => item.id !== optimistic.id);
      renderAll();
      showToast(error.message);
    }
  } finally {
    state.messagePending = false;
    setLoading(false);
    if (state.session?.id === sessionId) renderPatientMessages();
  }
}

async function changeChannel(channel) {
  if (!state.session || state.messagePending || state.transitioning || state.session.channel === channel) return;
  const sessionId = state.session.id;
  setTransitioning(true);
  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(sessionId)}/channel`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
    if (state.session?.id !== sessionId) return;
    state.session = data.session;
    renderAll();
  } catch (error) {
    if (state.session?.id === sessionId) showToast(error.message);
  } finally {
    setTransitioning(false);
  }
}

async function startNewDemo() {
  if (state.messagePending || state.transitioning) return;
  setTransitioning(true);
  try {
    const currentChannel = state.session?.channel || channelFromUi();
    sessionStorage.removeItem(activeSessionStorageKey());
    sessionStorage.removeItem("clinicDemoSessionId");
    sessionStorage.removeItem("clinicDemoAcquisition");
    await createSession(currentChannel);
    setActiveView("patient");
    showToast(`New ${currentIndustryOption()?.label || "private"} demo session started.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setTransitioning(false);
  }
}

function bindEvents() {
  els.patientTab?.addEventListener("click", () => {
    setActiveView("patient");
    syncSession();
  });
  els.dashboardTab?.addEventListener("click", () => {
    setActiveView("dashboard");
    syncSession();
  });
  els.newDemoButton?.addEventListener("click", startNewDemo);
  els.customerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendCustomerMessage(els.customerInput.value);
  });
  document.querySelectorAll(".channel-button").forEach((button) => {
    button.addEventListener("click", () => changeChannel(button.dataset.channel));
  });
  document.querySelectorAll(".suggestion-chip").forEach((button) => {
    button.addEventListener("click", () => sendCustomerMessage(button.dataset.message || ""));
  });
  els.salesCtaButton?.addEventListener("click", (event) => {
    recordTelemetry("sales_cta_clicks", state.activeView);
    if (els.salesCtaButton.dataset.ctaUnconfigured === "true") {
      event.preventDefault();
      showToast("This demo setup button is not connected yet. Please contact us to continue.");
    }
  });
  document.querySelectorAll("[data-demo-only]").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.demoOnly || "This control is visual only in the demo."));
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "clinic-demo-session-updated") syncSession();
  });
  window.addEventListener("focus", () => {
    syncSession();
    recordTelemetry("heartbeat", state.activeView);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recordTelemetry("heartbeat", state.activeView);
  });
}

function loadChannelExperienceLayer() {
  if (!document.querySelector('link[data-channel-experience="styles"]')) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/channel-experience.css";
    stylesheet.dataset.channelExperience = "styles";
    document.head.appendChild(stylesheet);
  }

  if (!document.querySelector('script[data-channel-experience="script"]')) {
    const script = document.createElement("script");
    script.src = "/channel-experience.js";
    script.dataset.channelExperience = "script";
    script.async = false;
    document.head.appendChild(script);
  }
}

async function init() {
  bindEvents();
  try {
    state.industryKey = await resolveInitialIndustry();
    saveIndustryPreference(state.industryKey);
    sessionStorage.setItem("demoIndustry", state.industryKey);

    const preloaded = window.demoIndustryConfig?.industryKey === state.industryKey ? window.demoIndustryConfig : null;
    state.config = preloaded || await api(`/api/demo/config?industry=${encodeURIComponent(state.industryKey)}`);
    state.industryOptions = state.config.availableIndustries?.length ? state.config.availableIndustries : state.industryOptions;
    window.demoIndustryConfig = state.config;
    window.applyDemoIndustryExperience?.(state.config);
    configureSalesCta();
    configureDashboardFrame();
    installIndustrySwitcher();
    loadChannelExperienceLayer();
    await restoreOrCreateSession();
    refreshInteractionState();
    recordTelemetry("patient_view", "patient");
    state.syncTimer = setInterval(syncSession, 1800);
    state.telemetryTimer = setInterval(() => recordTelemetry("heartbeat", state.activeView), 30_000);
  } catch (error) {
    showToast(error.message);
  }
}

init();

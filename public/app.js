const state = {
  config: null,
  session: null,
  loading: false,
  messagePending: false,
  transitioning: false,
  activeView: "patient",
  hasViewedDashboard: false,
  hasTakenOver: false,
  syncTimer: null,
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

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
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
  document.querySelectorAll(".channel-button, .suggestion-chip").forEach((button) => {
    button.disabled = blocked;
  });
}

function setTransitioning(transitioning) {
  state.transitioning = transitioning;
  refreshInteractionState();
}

function setActiveView(view) {
  state.activeView = view;
  if (view === "dashboard") state.hasViewedDashboard = true;
  const patient = view === "patient";
  els.patientTab?.classList.toggle("active", patient);
  els.dashboardTab?.classList.toggle("active", !patient);
  els.patientTab?.setAttribute("aria-selected", String(patient));
  els.dashboardTab?.setAttribute("aria-selected", String(!patient));
  els.patientView?.classList.toggle("active", patient);
  els.dashboardView?.classList.toggle("active", !patient);
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
    source.textContent = "Clinic staff";
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
  const asked = state.session.customerMessageCount > 0;
  const booking = Boolean(state.session.lead?.bookingIntent);
  const dashboard = state.hasViewedDashboard;
  const takeover = state.hasTakenOver || state.session.mode === "human" || state.session.messages.some((message) => message.source === "staff");
  const steps = [asked, booking, dashboard, takeover];
  [els.tourStep1, els.tourStep2, els.tourStep3, els.tourStep4].forEach((element, index) => {
    element?.classList.toggle("complete", steps[index]);
    element?.classList.toggle("current", !steps[index] && steps.slice(0, index).every(Boolean));
  });
  const completed = steps.filter(Boolean).length;
  if (els.tourProgress) els.tourProgress.textContent = `${completed} / 4`;
  if (!asked) els.tourStatus.textContent = "Tap a sample question below";
  else if (!booking) els.tourStatus.textContent = "Now try “Can I come Saturday?”";
  else if (!dashboard) els.tourStatus.textContent = "Booking intent detected — open Clinic Dashboard";
  else if (!takeover) els.tourStatus.textContent = "Open the live conversation and try Take over";
  else els.tourStatus.textContent = "Full customer journey completed ✓";

  const shouldHighlightDashboard = booking && !dashboard && state.activeView === "patient";
  els.dashboardTab?.classList.toggle("guide-highlight", shouldHighlightDashboard);
  els.salesCta?.classList.toggle("guide-highlight-soft", takeover);
}

function configureSalesCta() {
  if (!els.salesCtaButton || !state.config?.salesCta) return;
  els.salesCtaButton.textContent = state.config.salesCta.label || "Set up my clinic";
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

async function createSession(channel = "whatsapp") {
  const data = await api("/api/demo/sessions", {
    method: "POST",
    body: JSON.stringify({ channel }),
  });
  state.session = data.session;
  state.hasViewedDashboard = false;
  state.hasTakenOver = false;
  sessionStorage.setItem("clinicDemoSessionId", state.session.id);
  renderAll();
}

async function restoreOrCreateSession() {
  const saved = sessionStorage.getItem("clinicDemoSessionId");
  if (saved) {
    try {
      const data = await api(`/api/demo/sessions/${encodeURIComponent(saved)}`);
      state.session = data.session;
      state.hasTakenOver = state.session.mode === "human" || state.session.messages.some((message) => message.source === "staff");
      renderAll();
      return;
    } catch {
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
      showToast("The AI requested staff assistance. Open Clinic Dashboard to see the handoff.");
    } else if (state.session.lead?.bookingIntent && !state.hasViewedDashboard) {
      showToast("Booking intent detected. Open Clinic Dashboard to see what your team would see.");
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
    await createSession(currentChannel);
    setActiveView("patient");
    showToast("New private demo session started.");
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
  window.addEventListener("focus", syncSession);
}

async function init() {
  bindEvents();
  try {
    state.config = await api("/api/demo/config");
    configureSalesCta();
    await restoreOrCreateSession();
    refreshInteractionState();
    state.syncTimer = setInterval(syncSession, 1800);
  } catch (error) {
    showToast(error.message);
  }
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

init();
loadChannelExperienceLayer();

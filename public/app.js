const state = {
  config: null,
  session: null,
  loading: false,
  activeView: "patient",
  hasViewedDashboard: false,
  hasTakenOver: false,
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
  dashboardChannelAvatar: $("dashboardChannelAvatar"),
  conversationTime: $("conversationTime"),
  conversationPreview: $("conversationPreview"),
  conversationChannelTag: $("conversationChannelTag"),
  conversationTempTag: $("conversationTempTag"),
  staffChannelLabel: $("staffChannelLabel"),
  modePill: $("modePill"),
  takeoverButton: $("takeoverButton"),
  attentionBanner: $("attentionBanner"),
  attentionReason: $("attentionReason"),
  staffMessages: $("staffMessages"),
  staffEmptyState: $("staffEmptyState"),
  staffForm: $("staffForm"),
  staffInput: $("staffInput"),
  staffSendButton: $("staffSendButton"),
  staffComposerNotice: $("staffComposerNotice"),
  leadTemperature: $("leadTemperature"),
  leadScore: $("leadScore"),
  temperatureBadge: $("temperatureBadge"),
  leadSummary: $("leadSummary"),
  leadTreatment: $("leadTreatment"),
  leadBooking: $("leadBooking"),
  leadBranch: $("leadBranch"),
  leadTiming: $("leadTiming"),
  pipelineNew: $("pipelineNew"),
  pipelineWarm: $("pipelineWarm"),
  pipelineHot: $("pipelineHot"),
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
  whatsapp: { label: "WhatsApp", short: "W", theme: "whatsapp-theme", icon: "whatsapp-icon", status: "online", caption: "WhatsApp customer experience" },
  instagram: { label: "Instagram", short: "◎", theme: "instagram-theme", icon: "instagram-icon", status: "Active now", caption: "Instagram customer experience" },
  facebook: { label: "Messenger", short: "M", theme: "facebook-theme", icon: "facebook-icon", status: "Active now", caption: "Messenger customer experience" },
};

function showToast(message) {
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

function formatRelative(timestamp) {
  if (!timestamp) return "Now";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return formatTime(timestamp);
}

function setActiveView(view) {
  state.activeView = view;
  if (view === "dashboard") state.hasViewedDashboard = true;
  const patient = view === "patient";
  els.patientTab.classList.toggle("active", patient);
  els.dashboardTab.classList.toggle("active", !patient);
  els.patientTab.setAttribute("aria-selected", String(patient));
  els.dashboardTab.setAttribute("aria-selected", String(!patient));
  els.patientView.classList.toggle("active", patient);
  els.dashboardView.classList.toggle("active", !patient);
  renderTour();
}

function channelFromUi() {
  return document.querySelector(".channel-button.active")?.dataset.channel || "whatsapp";
}

function renderChannel() {
  const channel = state.session?.channel || "whatsapp";
  const meta = channelMeta[channel];
  document.querySelectorAll(".channel-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === channel);
  });
  els.phone.classList.remove("whatsapp-theme", "instagram-theme", "facebook-theme");
  els.phone.classList.add(meta.theme);
  els.channelStatusText.textContent = meta.status;
  els.channelCaption.textContent = meta.caption;
  els.dashboardChannelAvatar.className = `conversation-avatar ${meta.icon}`;
  els.dashboardChannelAvatar.textContent = meta.short;
  els.conversationChannelTag.textContent = meta.label;
  els.staffChannelLabel.textContent = `${meta.label} · Demo visitor`;
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
  const messages = state.session?.messages || [];
  els.messages.innerHTML = "";
  if (!messages.length) {
    els.messages.appendChild(els.emptyChat);
    els.emptyChat.classList.remove("hidden");
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

function buildStaffMessage(message) {
  const row = document.createElement("div");
  row.className = `staff-message-row ${message.role === "user" ? "customer" : "assistant"}`;
  const bubble = document.createElement("div");
  bubble.className = "staff-message-bubble";
  const text = document.createElement("div");
  text.textContent = message.content;
  const meta = document.createElement("small");
  meta.textContent = message.role === "user"
    ? `Demo Patient · ${formatTime(message.createdAt)}`
    : `${message.source === "staff" ? "Staff" : "AI"} · ${formatTime(message.createdAt)}`;
  bubble.append(text, meta);
  row.appendChild(bubble);
  return row;
}

function renderStaffMessages() {
  const messages = state.session?.messages || [];
  els.staffMessages.innerHTML = "";
  if (!messages.length) {
    els.staffMessages.appendChild(els.staffEmptyState);
    els.staffEmptyState.classList.remove("hidden");
    return;
  }
  for (const message of messages) els.staffMessages.appendChild(buildStaffMessage(message));
  els.staffMessages.scrollTop = els.staffMessages.scrollHeight;
}

function renderLead() {
  const lead = state.session?.lead || { temperature: "cold", interests: [], bookingIntent: false, summary: "No conversation yet." };
  const temp = lead.temperature || "cold";
  els.leadTemperature.textContent = temp[0].toUpperCase() + temp.slice(1);
  els.leadScore.textContent = temp === "hot" ? "Strong booking intent" : temp === "warm" ? "Active interest" : "Early enquiry";
  els.temperatureBadge.className = `temperature-orb ${temp}`;
  els.temperatureBadge.textContent = temp === "hot" ? "●" : temp === "warm" ? "◐" : "○";
  const scale = document.querySelector(".temperature-scale");
  scale.className = `temperature-scale ${temp}`;
  els.leadSummary.textContent = lead.summary || "No conversation yet.";
  els.leadTreatment.textContent = lead.interests?.length ? lead.interests.join(", ") : "Not detected";
  els.leadBooking.textContent = lead.bookingIntent ? "Yes" : "Not yet";
  els.leadBranch.textContent = lead.preferredBranch || "Not specified";
  els.leadTiming.textContent = lead.preferredTiming || "Not specified";
  els.conversationTempTag.textContent = temp[0].toUpperCase() + temp.slice(1);
  els.conversationTempTag.className = `temperature ${temp}`;

  els.pipelineNew.classList.add("active");
  els.pipelineWarm.classList.toggle("active", temp === "warm" || temp === "hot");
  els.pipelineHot.classList.toggle("active", temp === "hot" || lead.bookingIntent);
}

function renderModeAndAttention() {
  const human = state.session?.mode === "human";
  els.modePill.className = `mode-pill ${human ? "human" : "ai"}`;
  els.modePill.innerHTML = `<span></span>${human ? "Human handling" : "AI handling"}`;
  els.takeoverButton.textContent = human ? "Return to AI" : "Take over";
  els.staffInput.disabled = !human;
  els.staffSendButton.disabled = !human;
  els.staffComposerNotice.textContent = human
    ? "You are replying as clinic staff. Messages appear instantly in Patient View."
    : "Take over the conversation to send a staff reply.";

  const attention = Boolean(state.session?.needsAttention);
  els.attentionBanner.classList.toggle("hidden", !attention);
  els.attentionTabDot.classList.toggle("hidden", !attention);
  els.attentionReason.textContent = state.session?.attentionReason || "The AI flagged this conversation for staff review.";
}

function renderConversationCard() {
  const messages = state.session?.messages || [];
  const latest = messages.at(-1);
  els.conversationPreview.textContent = latest?.content || "No messages yet";
  els.conversationTime.textContent = formatRelative(latest?.createdAt);
}

function renderCounters() {
  const count = state.session?.customerMessageCount || 0;
  const max = state.session?.maxMessages || state.config?.limits?.maxMessages || 30;
  els.messageCounter.textContent = `${count} / ${max} demo messages`;
}

function renderTour() {
  if (!state.session || !els.tourStatus) return;
  const asked = state.session.customerMessageCount > 0;
  const booking = Boolean(state.session.lead?.bookingIntent);
  const dashboard = state.hasViewedDashboard;
  const takeover = state.hasTakenOver || state.session.mode === "human" || state.session.messages.some((m) => m.source === "staff");
  const steps = [asked, booking, dashboard, takeover];
  [els.tourStep1, els.tourStep2, els.tourStep3, els.tourStep4].forEach((el, index) => {
    el?.classList.toggle("complete", steps[index]);
    el?.classList.toggle("current", !steps[index] && steps.slice(0, index).every(Boolean));
  });
  const completed = steps.filter(Boolean).length;
  els.tourProgress.textContent = `${completed} / 4`;
  if (!asked) els.tourStatus.textContent = "Tap a sample question below";
  else if (!booking) els.tourStatus.textContent = "Now try “Can I come Saturday?”";
  else if (!dashboard) els.tourStatus.textContent = "Hot lead detected — open Clinic Dashboard";
  else if (!takeover) els.tourStatus.textContent = "See the staff view, then try Take over";
  else els.tourStatus.textContent = "Full customer journey completed ✓";

  const shouldHighlightDashboard = booking && !dashboard && state.activeView === "patient";
  els.dashboardTab.classList.toggle("guide-highlight", shouldHighlightDashboard);
  els.takeoverButton.classList.toggle("guide-highlight", dashboard && !takeover && state.activeView === "dashboard");
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
  renderStaffMessages();
  renderLead();
  renderModeAndAttention();
  renderConversationCard();
  renderCounters();
  renderTour();
}

function setLoading(loading) {
  state.loading = loading;
  els.customerInput.disabled = loading;
  els.customerSendButton.disabled = loading;
  els.typingIndicator.classList.toggle("hidden", !loading);
  if (loading) setTimeout(() => { els.messages.scrollTop = els.messages.scrollHeight; }, 0);
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
      state.hasTakenOver = state.session.mode === "human" || state.session.messages.some((m) => m.source === "staff");
      renderAll();
      return;
    } catch {
      sessionStorage.removeItem("clinicDemoSessionId");
    }
  }
  await createSession("whatsapp");
}

async function sendCustomerMessage(rawMessage) {
  if (state.loading || !state.session) return;
  const message = rawMessage.trim();
  if (!message) return;

  const optimistic = {
    id: `optimistic-${Date.now()}`,
    role: "user",
    content: message,
    source: "customer",
    createdAt: Date.now(),
  };
  state.session.messages.push(optimistic);
  els.customerInput.value = "";
  renderAll();
  setLoading(state.session.mode === "ai");

  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(state.session.id)}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    state.session = data.session;
    renderAll();
    if (data.degraded) {
      showToast("The live AI provider had a temporary issue. The conversation was kept so you can try again.");
    } else if (state.session.needsAttention) {
      showToast("The AI requested staff assistance. Open Clinic Dashboard to see the handoff.");
    } else if (state.session.lead?.bookingIntent && !state.hasViewedDashboard) {
      showToast("Hot lead detected. Open Clinic Dashboard to see what your team would see.");
    }
  } catch (error) {
    state.session.messages = state.session.messages.filter((m) => m.id !== optimistic.id);
    renderAll();
    showToast(error.message);
  } finally {
    setLoading(false);
    renderPatientMessages();
  }
}

async function changeChannel(channel) {
  if (!state.session || state.loading || state.session.channel === channel) return;
  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(state.session.id)}/channel`, {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
    state.session = data.session;
    renderAll();
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleTakeover() {
  if (!state.session) return;
  const newMode = state.session.mode === "human" ? "ai" : "human";
  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(state.session.id)}/mode`, {
      method: "POST",
      body: JSON.stringify({ mode: newMode }),
    });
    state.session = data.session;
    if (newMode === "human") state.hasTakenOver = true;
    renderAll();
    if (newMode === "human") {
      els.staffInput.focus();
      showToast("Human takeover is active. Try sending a staff reply to the patient.");
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function sendStaffMessage(rawMessage) {
  if (!state.session || state.session.mode !== "human") return;
  const message = rawMessage.trim();
  if (!message) return;
  els.staffSendButton.disabled = true;
  try {
    const data = await api(`/api/demo/sessions/${encodeURIComponent(state.session.id)}/staff-message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    state.session = data.session;
    els.staffInput.value = "";
    renderAll();
    showToast("Staff reply sent. Full demo journey complete — see the setup option below.");
  } catch (error) {
    showToast(error.message);
  } finally {
    els.staffSendButton.disabled = false;
  }
}

async function startNewDemo() {
  if (state.loading) return;
  try {
    const currentChannel = state.session?.channel || channelFromUi();
    await createSession(currentChannel);
    setActiveView("patient");
    showToast("New private demo session started.");
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  els.patientTab.addEventListener("click", () => setActiveView("patient"));
  els.dashboardTab.addEventListener("click", () => setActiveView("dashboard"));
  els.newDemoButton.addEventListener("click", startNewDemo);
  els.customerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendCustomerMessage(els.customerInput.value);
  });
  els.staffForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendStaffMessage(els.staffInput.value);
  });
  els.takeoverButton.addEventListener("click", toggleTakeover);
  document.querySelectorAll(".channel-button").forEach((button) => {
    button.addEventListener("click", () => changeChannel(button.dataset.channel));
  });
  document.querySelectorAll(".suggestion-chip").forEach((button) => {
    button.addEventListener("click", () => sendCustomerMessage(button.dataset.message || ""));
  });
  els.salesCtaButton?.addEventListener("click", (event) => {
    if (els.salesCtaButton.dataset.ctaUnconfigured === "true") {
      event.preventDefault();
      showToast("Add SALES_CTA_URL in Render to connect this button to your WhatsApp or sales page.");
    }
  });
  document.querySelectorAll("[data-demo-only]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(button.dataset.demoOnly || "This control is visual only in the minimal demo.");
    });
  });
}

async function init() {
  bindEvents();
  try {
    state.config = await api("/api/demo/config");
    configureSalesCta();
    await restoreOrCreateSession();
  } catch (error) {
    showToast(error.message);
  }
}

init();

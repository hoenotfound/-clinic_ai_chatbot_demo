(() => {
  if (!document.querySelector('link[data-section-rhythm="styles"]')) {
    const sectionRhythm = document.createElement("link");
    sectionRhythm.rel = "stylesheet";
    sectionRhythm.href = "/section-rhythm.css";
    sectionRhythm.dataset.sectionRhythm = "styles";
    document.head.appendChild(sectionRhythm);
  }

  const phone = document.getElementById("phone");
  const messages = document.getElementById("messages");
  const composer = document.getElementById("customerForm");
  const input = document.getElementById("customerInput");
  const sendButton = document.getElementById("customerSendButton");

  if (!phone || !messages || !composer || !input || !sendButton) return;

  const demoConfig = window.demoIndustryConfig || {};
  const defaultAcquisitionPresets = [
    { key: "hifu-facebook", label: "HIFU Facebook Ad", source: "Meta Ads", campaign: "HIFU Demo Campaign", treatment: "HIFU Skin Lifting", channel: "facebook" },
    { key: "pico-instagram", label: "Pico Instagram Ad", source: "Meta Ads", campaign: "Pico Demo Campaign", treatment: "Pico Laser", channel: "instagram" },
    { key: "organic-whatsapp", label: "Organic WhatsApp", source: "Organic", campaign: null, treatment: null, channel: "whatsapp" },
    { key: "referral", label: "Referral", source: "Referral", campaign: null, treatment: null, channel: "whatsapp" },
  ];
  const configuredPresets = Object.values(demoConfig.acquisitionPresets || {});
  const acquisitionPresets = configuredPresets.length ? configuredPresets : defaultAcquisitionPresets;
  const customerLabel = demoConfig.labels?.customer || "Patient";
  const acquisitionHelper = demoConfig.publicExperience?.acquisitionHelper || "This source follows the live visitor into the Clinic Dashboard.";
  const businessInitial = String(demoConfig.businessName || demoConfig.clinicName || "Nova").charAt(0).toUpperCase();

  const svg = {
    video: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"></rect><path d="m16 10 5-3v10l-5-3z"></path></svg>`,
    phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7A2 2 0 0 1 22 16.9z"></path></svg>`,
    info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6"></path><path d="M12 7h.01"></path></svg>`,
    more: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"></circle></svg>`,
    plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>`,
    camera: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h3l1.3-2h7.4l1.3 2h3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>`,
    mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"></path></svg>`,
    image: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="m5 17 4.2-4 3.2 3 2.2-2 4.4 3"></path></svg>`,
    smile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9h.01M15 9h.01"></path></svg>`,
    sticker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10a4 4 0 0 1 4 4v7l-6 7H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M13 21v-5a2 2 0 0 1 2-2h4"></path></svg>`,
    send: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8z"></path><path d="M7 12h14"></path></svg>`,
    heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6z"></path></svg>`,
    thumbsUp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4zM7 19c3 1.5 6.2 2 9.5 2a2 2 0 0 0 1.9-1.4l2.2-7A2 2 0 0 0 18.7 10H14l.8-3.2A3 3 0 0 0 12 3L7 10z"></path></svg>`,
  };

  const channelConfig = {
    whatsapp: {
      label: "WhatsApp",
      placeholder: "Message",
      headerActions: [["video", "Video call"], ["phone", "Voice call"], ["more", "More options"]],
      leading: ["plus", "Add attachment"],
      inline: [["smile", "Emoji"], ["camera", "Camera"]],
      emptyAction: "mic",
      emptyBadge: "WhatsApp-style customer chat",
    },
    instagram: {
      label: "Instagram",
      placeholder: "Message...",
      headerActions: [["phone", "Audio call"], ["video", "Video call"], ["info", "Conversation details"]],
      leading: ["camera", "Camera"],
      inline: [["mic", "Voice message"], ["image", "Photo"], ["sticker", "Sticker"]],
      emptyAction: "heart",
      emptyBadge: "Instagram DM-style preview",
    },
    facebook: {
      label: "Messenger",
      placeholder: "Aa",
      headerActions: [["phone", "Audio call"], ["video", "Video call"], ["info", "Conversation details"]],
      leading: ["plus", "More actions"],
      inline: [["image", "Photo"], ["smile", "Emoji"]],
      emptyAction: "thumbsUp",
      emptyBadge: "Messenger-style customer chat",
    },
  };

  let decorating = false;
  let appliedChannel = null;

  function currentChannel() {
    if (phone.classList.contains("instagram-theme")) return "instagram";
    if (phone.classList.contains("facebook-theme")) return "facebook";
    return "whatsapp";
  }

  function storedAcquisition() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem("clinicDemoAcquisition") || "null");
      return parsed && acquisitionPresets.some((item) => item.key === parsed.key) ? parsed : acquisitionPresets.find((item) => item.key === "organic-whatsapp") || acquisitionPresets[0];
    } catch {
      return acquisitionPresets.find((item) => item.key === "organic-whatsapp") || acquisitionPresets[0];
    }
  }

  function renderAcquisitionSelection(container) {
    const selected = storedAcquisition()?.key;
    container.querySelectorAll("[data-acquisition-key]").forEach((button) => {
      const active = button.dataset.acquisitionKey === selected;
      button.setAttribute("aria-pressed", String(active));
      button.style.borderColor = active ? "var(--color-primary, #2f6f62)" : "";
      button.style.background = active ? "rgba(47,111,98,.08)" : "";
    });
  }

  function selectAcquisition(preset, container) {
    const hasConversation = messages.querySelector(".message-row");
    if (hasConversation) {
      if (typeof window.showToast === "function") window.showToast("Restart the demo to change the acquisition source after a conversation has started.");
      return;
    }
    sessionStorage.setItem("clinicDemoAcquisition", JSON.stringify(preset));
    renderAcquisitionSelection(container);
    const channelButton = document.querySelector(`.channel-button[data-channel="${preset.channel}"]`);
    if (channelButton && !channelButton.classList.contains("active")) channelButton.click();
    window.postMessage({ type: "clinic-demo-acquisition-updated" }, window.location.origin);
  }

  function ensureAcquisitionSelector() {
    const panel = document.querySelector(".patient-guide.channel-panel");
    if (!panel || panel.querySelector("[data-acquisition-selector]")) return;
    const section = document.createElement("div");
    section.className = "guide-section";
    section.dataset.acquisitionSelector = "true";

    const label = document.createElement("div");
    label.className = "guide-label";
    label.innerHTML = "<span>A</span><strong>Choose where the lead came from</strong>";

    const helper = document.createElement("p");
    helper.className = "prompt-helper";
    helper.textContent = acquisitionHelper;

    const list = document.createElement("div");
    list.className = "suggestion-list";
    acquisitionPresets.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-chip";
      button.dataset.acquisitionKey = preset.key;
      const kicker = preset.source === "Meta Ads" ? "Meta Ads" : preset.source;
      button.innerHTML = `<span>${kicker}</span><strong>${preset.label}</strong><b>→</b>`;
      button.addEventListener("click", () => selectAcquisition(preset, list));
      list.appendChild(button);
    });

    section.append(label, helper, list);
    panel.appendChild(section);
    if (!sessionStorage.getItem("clinicDemoAcquisition")) {
      sessionStorage.setItem("clinicDemoAcquisition", JSON.stringify(storedAcquisition()));
    }
    renderAcquisitionSelection(list);
  }

  function demoOnly(button, label) {
    button.dataset.nativeDemoOnly = "true";
    button.addEventListener("click", () => {
      if (typeof window.showToast === "function") window.showToast(`${label} is visual only in this demo.`);
    });
  }

  function makeAction(icon, label, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.innerHTML = svg[icon] || "";
    demoOnly(button, label);
    return button;
  }

  function ensureHeader(config) {
    const header = phone.querySelector(".chat-header");
    const legacyMore = phone.querySelector(".header-glyph");
    if (!header) return;
    let actions = header.querySelector(".channel-header-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "channel-header-actions";
      if (legacyMore) header.insertBefore(actions, legacyMore);
      else header.appendChild(actions);
    }
    actions.innerHTML = "";
    config.headerActions.forEach(([icon, label]) => actions.appendChild(makeAction(icon, label, "channel-header-action")));
  }

  function ensureComposer(config) {
    const leading = composer.querySelector(".composer-glyph");
    if (leading) {
      leading.innerHTML = svg[config.leading[0]];
      leading.setAttribute("aria-label", config.leading[1]);
    }
    let shell = composer.querySelector(".composer-input-shell");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "composer-input-shell";
      composer.insertBefore(shell, input);
      shell.appendChild(input);
    }
    let inlineActions = shell.querySelector(".composer-inline-actions");
    if (!inlineActions) {
      inlineActions = document.createElement("div");
      inlineActions.className = "composer-inline-actions";
      shell.appendChild(inlineActions);
    }
    inlineActions.innerHTML = "";
    config.inline.forEach(([icon, label]) => inlineActions.appendChild(makeAction(icon, label, "composer-inline-action")));
    input.placeholder = config.placeholder;
    updateSendButton(config);
  }

  function updateSendButton(config = channelConfig[currentChannel()]) {
    const hasText = Boolean(input.value.trim());
    sendButton.classList.toggle("is-empty", !hasText);
    sendButton.innerHTML = svg[hasText ? "send" : config.emptyAction];
    sendButton.setAttribute("aria-label", hasText ? "Send message" : `${config.label} quick action`);
  }

  function ensureSeenRow(channel, latestUserRow) {
    let seenRow = messages.querySelector(".channel-seen-row");
    if (!latestUserRow || channel === "whatsapp") {
      seenRow?.remove();
      return;
    }
    if (!seenRow) {
      seenRow = document.createElement("div");
      seenRow.className = "message-row user channel-seen-row";
    }
    if (seenRow.dataset.channel !== channel) {
      seenRow.replaceChildren();
      if (channel === "instagram") {
        const seen = document.createElement("span");
        seen.className = "channel-seen";
        seen.textContent = "Seen";
        seenRow.appendChild(seen);
      } else if (channel === "facebook") {
        const seenAvatar = document.createElement("span");
        seenAvatar.className = "channel-seen-avatar";
        seenAvatar.textContent = businessInitial;
        seenAvatar.setAttribute("aria-label", "Seen");
        seenRow.appendChild(seenAvatar);
      }
      seenRow.dataset.channel = channel;
    }
    if (latestUserRow.nextElementSibling !== seenRow) latestUserRow.insertAdjacentElement("afterend", seenRow);
  }

  function decorateMessages(channel) {
    if (decorating) return;
    decorating = true;
    try {
      const userRows = Array.from(messages.querySelectorAll(".message-row.user:not(.channel-seen-row)"));
      messages.querySelectorAll(".message-row").forEach((row) => row.classList.remove("is-last-outgoing"));
      userRows.forEach((row) => {
        const bubble = row.querySelector(".message-bubble");
        if (!bubble) return;
        let receipt = bubble.querySelector(".message-receipt");
        if (!receipt) {
          receipt = document.createElement("span");
          receipt.className = "message-receipt";
          receipt.setAttribute("aria-hidden", "true");
          bubble.appendChild(receipt);
        }
        receipt.textContent = "✓✓";
        row.querySelector(".channel-seen")?.remove();
        row.querySelector(".channel-seen-avatar")?.remove();
      });
      const latestUserRow = userRows[userRows.length - 1];
      if (latestUserRow) latestUserRow.classList.add("is-last-outgoing");
      ensureSeenRow(channel, latestUserRow);
    } finally {
      decorating = false;
    }
  }

  function ensureEmptyState(config) {
    const empty = phone.querySelector("#emptyChat");
    if (!empty) return;
    let badge = empty.querySelector(".empty-channel-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "empty-channel-badge";
      empty.appendChild(badge);
    }
    badge.textContent = config.emptyBadge;
  }

  function applyChannelExperience({ force = false } = {}) {
    const channel = currentChannel();
    if (!force && appliedChannel === channel && phone.classList.contains("native-channel-ui")) return;
    const config = channelConfig[channel];
    if (!phone.classList.contains("native-channel-ui")) phone.classList.add("native-channel-ui");
    phone.dataset.channelExperience = channel;
    phone.setAttribute("aria-label", `${config.label} ${customerLabel.toLowerCase()} messaging preview`);
    ensureHeader(config);
    ensureComposer(config);
    ensureEmptyState(config);
    decorateMessages(channel);
    appliedChannel = channel;
  }

  if (!input.dataset.channelExperienceBound) {
    input.dataset.channelExperienceBound = "true";
    input.addEventListener("input", () => updateSendButton());
  }

  const phoneClassObserver = new MutationObserver((records) => {
    if (!records.some((record) => record.attributeName === "class")) return;
    const channel = currentChannel();
    if (channel !== appliedChannel || !phone.classList.contains("native-channel-ui")) applyChannelExperience();
  });
  phoneClassObserver.observe(phone, { attributes: true, attributeFilter: ["class"] });

  const messagesObserver = new MutationObserver(() => decorateMessages(currentChannel()));
  messagesObserver.observe(messages, { childList: true });

  ensureAcquisitionSelector();
  applyChannelExperience({ force: true });
})();
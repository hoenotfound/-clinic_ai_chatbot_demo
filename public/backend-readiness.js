(() => {
  const CONFIG_PATH = "/api/demo/config";
  const ATTEMPT_TIMEOUT_MS = 22000;
  const RETRY_DELAY_MS = 1800;
  const baseFetch = window.fetch.bind(window);

  const statusLabel = document.getElementById("backendStatusLabel");
  const statusDot = document.getElementById("backendStatusDot");
  const channelStatus = document.getElementById("channelStatusText");
  const controls = [
    document.getElementById("customerInput"),
    document.getElementById("customerSendButton"),
    document.getElementById("newDemoButton"),
    ...document.querySelectorAll(".channel-button, .suggestion-chip"),
  ].filter(Boolean);

  let ready = false;
  let attempt = 0;

  function setStartingCopy() {
    if (statusLabel) {
      statusLabel.textContent = attempt >= 2
        ? "AI IS WAKING UP — EXPLORE THE DASHBOARD"
        : "STARTING LIVE AI RECEPTIONIST…";
    }
    statusDot?.classList.add("backend-starting");
    if (channelStatus) channelStatus.textContent = "starting AI…";
    controls.forEach((control) => {
      control.disabled = true;
    });
  }

  function setReadyCopy() {
    ready = true;
    if (statusLabel) statusLabel.textContent = "AI RECEPTIONIST ONLINE";
    statusDot?.classList.remove("backend-starting");
    statusDot?.classList.add("backend-ready");
    if (channelStatus) channelStatus.textContent = "online";
    // Do not re-enable the controls here. app.js does that only after the
    // private demo session has been restored or created successfully.
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isConfigRequest(input) {
    const value = typeof input === "string" ? input : input?.url;
    if (!value) return false;
    try {
      const url = new URL(value, window.location.origin);
      return url.pathname.endsWith(CONFIG_PATH);
    } catch {
      return String(value).includes(CONFIG_PATH);
    }
  }

  async function fetchWithAttemptTimeout(input, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function wakeBackend(input, init) {
    if (ready) return baseFetch(input, init);
    setStartingCopy();

    for (;;) {
      attempt += 1;
      try {
        const response = await fetchWithAttemptTimeout(input, init);
        if (response.ok) {
          setReadyCopy();
          return response;
        }
      } catch {
        // A sleeping Render service can outlive Netlify's proxy request. The
        // request still wakes it, so retry until the backend answers normally.
      }
      setStartingCopy();
      await sleep(RETRY_DELAY_MS);
    }
  }

  window.fetch = (input, init) => {
    if (isConfigRequest(input)) return wakeBackend(input, init);
    return baseFetch(input, init);
  };

  setStartingCopy();
})();

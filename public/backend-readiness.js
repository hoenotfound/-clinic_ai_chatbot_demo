(() => {
  const CONFIG_PATH = "/api/demo/config";
  const ATTEMPT_TIMEOUT_MS = 22000;
  const RETRY_DELAYS_MS = [1800, 3000, 5000, 10000];
  const MAX_AUTOMATIC_ATTEMPTS = 5;
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

  function selectedIndustry() {
    try {
      const locationValue = window.location?.href || window.location?.origin || "http://localhost";
      const query = new URL(locationValue, window.location?.origin || "http://localhost").searchParams.get("industry");
      if (String(query || "").toLowerCase() === "renovation") return "renovation";
    } catch {}
    try {
      const stored = window.sessionStorage?.getItem("demoIndustry") || window.localStorage?.getItem("demoIndustryPreference");
      if (String(stored || "").toLowerCase() === "renovation") return "renovation";
    } catch {}
    return "clinic";
  }

  function assistantRole() {
    return selectedIndustry() === "renovation" ? "AI RENOVATION ASSISTANT" : "AI RECEPTIONIST";
  }

  const retryButton = (() => {
    const parent = statusLabel?.parentElement;
    if (!parent) return null;
    const existing = document.getElementById("backendRetryButton");
    if (existing) return existing;
    const button = document.createElement("button");
    button.id = "backendRetryButton";
    button.type = "button";
    button.className = "backend-retry-button";
    button.textContent = "Retry AI";
    button.hidden = true;
    parent.appendChild(button);
    return button;
  })();

  let ready = false;
  let attempt = 0;
  let retryResolver = null;
  let wakePromise = null;

  function disableBackendControls() {
    controls.forEach((control) => {
      control.disabled = true;
    });
  }

  function setStartingCopy() {
    if (statusLabel) {
      statusLabel.textContent = attempt >= 2
        ? "AI IS WAKING UP — EXPLORE THE DASHBOARD"
        : `STARTING LIVE ${assistantRole()}…`;
    }
    statusDot?.classList.remove("backend-ready", "backend-unavailable");
    statusDot?.classList.add("backend-starting");
    if (channelStatus) channelStatus.textContent = "starting AI…";
    if (retryButton) retryButton.hidden = true;
    disableBackendControls();
  }

  function setUnavailableCopy() {
    if (statusLabel) statusLabel.textContent = "AI IS TEMPORARILY UNAVAILABLE — EXPLORE THE DASHBOARD";
    statusDot?.classList.remove("backend-starting", "backend-ready");
    statusDot?.classList.add("backend-unavailable");
    if (channelStatus) channelStatus.textContent = "temporarily unavailable";
    if (retryButton) retryButton.hidden = false;
    disableBackendControls();
  }

  function setReadyCopy() {
    ready = true;
    if (statusLabel) statusLabel.textContent = `${assistantRole()} ONLINE`;
    statusDot?.classList.remove("backend-starting", "backend-unavailable");
    statusDot?.classList.add("backend-ready");
    if (channelStatus) channelStatus.textContent = "online";
    if (retryButton) retryButton.hidden = true;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function retryDelayForAttempt(number) {
    const index = Math.min(Math.max(number - 1, 0), RETRY_DELAYS_MS.length - 1);
    return RETRY_DELAYS_MS[index];
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

  async function isExpectedConfigResponse(response) {
    if (!response?.ok) return false;
    const contentType = String(response.headers?.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) return false;
    try {
      const payload = await response.clone().json();
      return typeof payload?.clinicName === "string"
        && Array.isArray(payload?.services)
        && payload?.limits
        && Number.isFinite(Number(payload.limits.maxMessages));
    } catch {
      return false;
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

  function waitForManualRetry() {
    setUnavailableCopy();
    return new Promise((resolve) => {
      retryResolver = resolve;
    });
  }

  retryButton?.addEventListener("click", () => {
    if (!retryResolver) return;
    const resolve = retryResolver;
    retryResolver = null;
    attempt = 0;
    setStartingCopy();
    resolve();
  });

  async function wakeBackend(input, init) {
    if (ready) return baseFetch(input, init);
    setStartingCopy();

    for (;;) {
      while (attempt < MAX_AUTOMATIC_ATTEMPTS) {
        attempt += 1;
        try {
          const response = await fetchWithAttemptTimeout(input, init);
          if (await isExpectedConfigResponse(response)) {
            setReadyCopy();
            return response;
          }
        } catch {}

        if (attempt < MAX_AUTOMATIC_ATTEMPTS) {
          setStartingCopy();
          await sleep(retryDelayForAttempt(attempt));
        }
      }

      await waitForManualRetry();
    }
  }

  window.fetch = (input, init) => {
    if (!isConfigRequest(input)) return baseFetch(input, init);
    if (ready) return baseFetch(input, init);
    if (!wakePromise) {
      wakePromise = wakeBackend(input, init).finally(() => {
        wakePromise = null;
      });
    }
    return wakePromise.then((response) => response.clone());
  };

  setStartingCopy();
})();

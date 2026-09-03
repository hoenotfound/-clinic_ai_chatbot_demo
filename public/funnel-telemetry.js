(() => {
  const VISITOR_KEY = "clinicDemoVisitorId";
  const nativeFetch = window.fetch.bind(window);
  const sent = new Set();
  const journey = {
    demoStarted: false,
    message1: false,
    message3: false,
    booking: false,
    dashboard: false,
    takeover: false,
    completed: false,
  };

  function createVisitorId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `visitor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  function visitorId() {
    try {
      const existing = localStorage.getItem(VISITOR_KEY);
      if (existing) return existing;
      const created = createVisitorId();
      localStorage.setItem(VISITOR_KEY, created);
      return created;
    } catch {
      return createVisitorId();
    }
  }

  const id = visitorId();

  function telemetryUrl() {
    if (typeof window.clinicDemoUrl === "function") return window.clinicDemoUrl("/api/telemetry");
    return "/api/telemetry";
  }

  function emit(event, surface = "patient") {
    if (sent.has(event)) return;
    sent.add(event);
    nativeFetch(telemetryUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: id, event, surface }),
      keepalive: true,
    }).catch(() => {
      // Telemetry is intentionally best-effort and must never affect the demo.
    });
  }

  function maybeCompleteJourney() {
    if (journey.completed) return;
    if (journey.message1 && journey.booking && journey.dashboard && journey.takeover) {
      journey.completed = true;
      emit("journey_complete", "dashboard");
    }
  }

  function observeSession(session) {
    if (!session?.id) return;
    journey.demoStarted = true;
    emit("demo_started", "patient");

    const count = Number(session.customerMessageCount) || 0;
    if (count >= 1) {
      journey.message1 = true;
      emit("message_1", "patient");
    }
    if (count >= 3) {
      journey.message3 = true;
      emit("message_3", "patient");
    }

    journey.booking = journey.booking || Boolean(session.lead?.bookingIntent);
    const hasStaffMessage = Array.isArray(session.messages) && session.messages.some((message) => message?.source === "staff");
    if (session.mode === "human" || hasStaffMessage) {
      journey.takeover = true;
      emit("human_takeover", "dashboard");
    }
    maybeCompleteJourney();
  }

  function requestPath(input) {
    try {
      if (typeof input === "string") return new URL(input, window.location.href).pathname;
      if (input instanceof URL) return input.pathname;
      if (input?.url) return new URL(input.url, window.location.href).pathname;
    } catch {
      return "";
    }
    return "";
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || "GET").toUpperCase();
  }

  function observeOutgoingTelemetry(pathname, method, init) {
    if (method !== "POST" || !pathname.endsWith("/api/telemetry")) return;
    try {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (body?.event === "dashboard_view") {
        journey.dashboard = true;
        maybeCompleteJourney();
      }
    } catch {
      // Ignore malformed/non-string bodies; the real request still proceeds.
    }
  }

  function isSessionApi(pathname) {
    return /\/api\/demo\/sessions(?:\/[^/]+(?:\/(?:channel|mode|staff-message|message))?)?$/.test(pathname);
  }

  window.fetch = async (input, init) => {
    const pathname = requestPath(input);
    const method = requestMethod(input, init);
    observeOutgoingTelemetry(pathname, method, init);

    const response = await nativeFetch(input, init);
    if (response.ok && isSessionApi(pathname)) {
      response.clone().json()
        .then((data) => observeSession(data?.session))
        .catch(() => {});
    }
    return response;
  };
})();
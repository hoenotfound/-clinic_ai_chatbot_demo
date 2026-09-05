(() => {
  const MOUNT_PATH = "/ai-chatbot";
  const pathname = window.location.pathname;
  const mounted = pathname === MOUNT_PATH || pathname.startsWith(`${MOUNT_PATH}/`);
  const basePath = mounted ? MOUNT_PATH : "";

  function withBase(value) {
    if (!basePath || typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return value;
    if (value === basePath || value.startsWith(`${basePath}/`)) return value;
    return `${basePath}${value}`;
  }

  function loadIndustrySwitcherStyles() {
    if (document.querySelector('link[data-industry-switcher="true"]')) return;
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = withBase("/industry-switcher.css");
    stylesheet.dataset.industrySwitcher = "true";
    document.head.appendChild(stylesheet);
  }

  function loadIndustryExperience() {
    if (document.querySelector('script[data-industry-experience="true"]')) return;
    const script = document.createElement("script");
    script.src = withBase("/industry-experience.js");
    script.dataset.industryExperience = "true";
    script.async = false;
    document.head.appendChild(script);
  }

  function installMobileDashboardViewportGuard() {
    const mobileDashboard = window.matchMedia("(max-width: 767px)");
    let frameDocument = null;

    const dashboardIsActive = () => document.getElementById("dashboardView")?.classList.contains("active");

    const alignDashboard = () => {
      if (!mobileDashboard.matches || !dashboardIsActive()) return;
      const frame = document.getElementById("reactDashboardFrame");
      if (!frame) return;

      const headerHeight = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
      const desiredTop = headerHeight + 4;
      const rect = frame.getBoundingClientRect();
      const delta = rect.top - desiredTop;
      if (Math.abs(delta) <= 2) return;

      window.scrollTo({
        top: Math.max(0, window.scrollY + delta),
        behavior: "auto",
      });
    };

    const scheduleAlignment = () => {
      if (!mobileDashboard.matches) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(alignDashboard);
      });
      setTimeout(alignDashboard, 80);
    };

    const bindFrameInteractions = () => {
      const frame = document.getElementById("reactDashboardFrame");
      if (!frame) return;
      try {
        const doc = frame.contentDocument;
        if (!doc || doc === frameDocument) return;
        frameDocument = doc;
        doc.addEventListener("click", scheduleAlignment, true);
        doc.addEventListener("focusin", scheduleAlignment, true);
      } catch {}
    };

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("#dashboardTab")) {
        scheduleAlignment();
        setTimeout(bindFrameInteractions, 0);
        return;
      }
      if (event.target.closest("#patientTab")) return;
      if (dashboardIsActive()) scheduleAlignment();
    });

    window.addEventListener("resize", scheduleAlignment, { passive: true });
    window.addEventListener("scroll", () => {
      if (!dashboardIsActive()) return;
      clearTimeout(installMobileDashboardViewportGuard.scrollTimer);
      installMobileDashboardViewportGuard.scrollTimer = setTimeout(alignDashboard, 60);
    }, { passive: true });

    const bindFrame = () => {
      const frame = document.getElementById("reactDashboardFrame");
      if (!frame || frame.dataset.mobileViewportGuard === "true") return;
      frame.dataset.mobileViewportGuard = "true";
      frame.addEventListener("load", () => {
        bindFrameInteractions();
        scheduleAlignment();
      });
      bindFrameInteractions();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindFrame, { once: true });
    } else {
      bindFrame();
    }
  }

  window.clinicDemoBasePath = basePath;
  window.clinicDemoUrl = withBase;
  loadIndustrySwitcherStyles();
  installMobileDashboardViewportGuard();

  if (!basePath) {
    loadIndustryExperience();
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string") input = withBase(input);
    return nativeFetch(input, init);
  };

  function patchUrlProperty(prototype, property) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) return;
    Object.defineProperty(prototype, property, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        return descriptor.set.call(this, withBase(value));
      },
    });
  }

  patchUrlProperty(HTMLImageElement.prototype, "src");
  patchUrlProperty(HTMLScriptElement.prototype, "src");
  patchUrlProperty(HTMLLinkElement.prototype, "href");
  patchUrlProperty(HTMLIFrameElement.prototype, "src");
  loadIndustryExperience();
})();

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

    const alignDashboard = () => {
      if (!mobileDashboard.matches) return;
      const dashboard = document.getElementById("dashboardView");
      const frame = document.getElementById("reactDashboardFrame");
      if (!dashboard?.classList.contains("active") || !frame) return;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const headerHeight = document.querySelector(".topbar")?.getBoundingClientRect().height || 0;
          const rect = frame.getBoundingClientRect();
          const desiredTop = headerHeight + 4;
          const needsAlignment = rect.top < desiredTop - 2 || rect.bottom > window.innerHeight;
          if (!needsAlignment) return;
          window.scrollTo({
            top: Math.max(0, window.scrollY + rect.top - desiredTop),
            behavior: "auto",
          });
        });
      });
    };

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element) || !event.target.closest("#dashboardTab")) return;
      alignDashboard();
    });
    window.addEventListener("resize", alignDashboard, { passive: true });
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

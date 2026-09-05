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

  function loadIndustryExperience() {
    if (document.querySelector('script[data-industry-experience="true"]')) return;
    const script = document.createElement("script");
    script.src = withBase("/industry-experience.js");
    script.dataset.industryExperience = "true";
    script.async = false;
    document.head.appendChild(script);
  }

  window.clinicDemoBasePath = basePath;
  window.clinicDemoUrl = withBase;

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

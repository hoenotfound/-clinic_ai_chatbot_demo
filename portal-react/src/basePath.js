const DASHBOARD_MARKER = "/dashboard";

export function getAppBasePath(pathname = window.location.pathname) {
  const markerIndex = pathname.indexOf(DASHBOARD_MARKER);
  if (markerIndex <= 0) return "";
  return pathname.slice(0, markerIndex).replace(/\/+$/, "");
}

export function getDashboardBasePath(pathname = window.location.pathname) {
  return `${getAppBasePath(pathname)}/dashboard`;
}

export function getApiBasePath(pathname = window.location.pathname) {
  return `${getAppBasePath(pathname)}/api`;
}

export function withAppBase(url, pathname = window.location.pathname) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return url;
  const base = getAppBasePath(pathname);
  if (!base || url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

function installAbsoluteApiFetchGuard() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const base = getAppBasePath();
  if (!base || window.__clinicDemoApiFetchGuardInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      input = `${base}${input}`;
    }
    return nativeFetch(input, init);
  };
  window.__clinicDemoApiFetchGuardInstalled = true;
}

installAbsoluteApiFetchGuard();

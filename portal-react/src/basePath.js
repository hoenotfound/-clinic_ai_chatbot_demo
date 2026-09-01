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

function sessionIdFromApiUrl(url, base) {
  if (typeof url !== "string") return null;
  const relative = base && url.startsWith(`${base}/api/`) ? url.slice(base.length) : url;
  const match = relative.match(/^\/api\/demo\/sessions\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function staleSessionResponse() {
  return new Response(JSON.stringify({ error: "Demo session changed while this request was in flight." }), {
    status: 409,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function installAbsoluteApiFetchGuard() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window.__clinicDemoApiFetchGuardInstalled) return;

  const base = getAppBasePath();
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    let requestInput = input;
    if (typeof requestInput === "string" && base && requestInput.startsWith("/api/")) {
      requestInput = `${base}${requestInput}`;
    }

    const requestedSessionId = sessionIdFromApiUrl(requestInput, base);
    const response = await nativeFetch(requestInput, init);

    if (requestedSessionId) {
      const currentSessionId = sessionStorage.getItem("clinicDemoSessionId");
      if (currentSessionId !== requestedSessionId) return staleSessionResponse();
    }

    return response;
  };
  window.__clinicDemoApiFetchGuardInstalled = true;
}

installAbsoluteApiFetchGuard();

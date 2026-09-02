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

function requestUrl(input) {
  if (typeof input === "string") return input;
  return typeof input?.url === "string" ? input.url : null;
}

function requestMethod(input, init) {
  if (init?.method) return String(init.method).toUpperCase();
  if (typeof input?.method === "string") return input.method.toUpperCase();
  return "GET";
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

function isExactSessionRead(url, base) {
  if (typeof url !== "string") return false;
  const relative = base && url.startsWith(`${base}/api/`) ? url.slice(base.length) : url;
  return /^\/api\/demo\/sessions\/[^/?#]+(?:\?[^#]*)?(?:#.*)?$/.test(relative);
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
  const inFlightSessionGets = new Map();

  window.fetch = async (input, init) => {
    let requestInput = input;
    if (typeof requestInput === "string" && base && requestInput.startsWith("/api/")) {
      requestInput = `${base}${requestInput}`;
    }

    const url = requestUrl(requestInput);
    const requestedSessionId = sessionIdFromApiUrl(url, base);
    const shouldShareRequest = requestMethod(requestInput, init) === "GET" && isExactSessionRead(url, base);

    let response;
    if (shouldShareRequest && url) {
      let pending = inFlightSessionGets.get(url);
      if (!pending) {
        pending = nativeFetch(requestInput, init).finally(() => {
          inFlightSessionGets.delete(url);
        });
        inFlightSessionGets.set(url, pending);
      }
      response = (await pending).clone();
    } else {
      response = await nativeFetch(requestInput, init);
    }

    if (requestedSessionId) {
      const currentSessionId = sessionStorage.getItem("clinicDemoSessionId");
      if (currentSessionId !== requestedSessionId) return staleSessionResponse();
    }

    return response;
  };
  window.__clinicDemoApiFetchGuardInstalled = true;
}

installAbsoluteApiFetchGuard();

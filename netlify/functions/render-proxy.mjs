const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST"]);

function renderOrigin() {
  const raw = String(process.env.DEMO_RENDER_ORIGIN || "").trim();
  if (!raw) throw new Error("DEMO_RENDER_ORIGIN is not configured for this Netlify site.");
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("DEMO_RENDER_ORIGIN must use http or https.");
  return url.origin;
}

function safeGeoHeader(value, max = 160) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\r\n]/g, " ")
    .trim()
    .slice(0, max);
}

function forwardedHeaders(req, context = {}) {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "user-agent", "authorization", "referer"]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-nf-client-connection-ip") || context.ip;
  if (clientIp) headers.set("x-forwarded-for", clientIp);

  const geo = context.geo || {};
  const geoHeaders = {
    "x-demo-geo-country-code": geo.country?.code,
    "x-demo-geo-country-name": geo.country?.name,
    "x-demo-geo-region": geo.subdivision?.name,
    "x-demo-geo-city": geo.city,
    "x-demo-geo-timezone": geo.timezone,
  };
  for (const [name, value] of Object.entries(geoHeaders)) {
    const safe = safeGeoHeader(value);
    if (safe) headers.set(name, safe);
  }
  return headers;
}

export default async (req, context = {}) => {
  if (!ALLOWED_METHODS.has(req.method)) {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  let origin;
  try {
    origin = renderOrigin();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Demo backend is not configured." }, { status: 503 });
  }

  const incoming = new URL(req.url);
  if (incoming.pathname === "/ai-chatbot/ops/") {
    return Response.redirect(new URL("/ai-chatbot/ops", incoming.origin), 308);
  }

  const apiPath = incoming.pathname.replace(/^\/ai-chatbot/, "");
  if (!apiPath.startsWith("/api/") && apiPath !== "/health" && apiPath !== "/ops") {
    return Response.json({ error: "API route not found." }, { status: 404 });
  }

  const target = new URL(`${apiPath}${incoming.search}`, `${origin}/`);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardedHeaders(req, context),
      body,
      redirect: "manual",
    });
    const headers = new Headers();
    for (const name of [
      "content-type",
      "www-authenticate",
      "content-security-policy",
      "x-content-type-options",
      "x-robots-tag",
      "referrer-policy",
      "permissions-policy",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("cache-control", "no-store");
    return new Response(req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Render demo proxy failed:", error);
    return Response.json({ error: "Demo backend is waking up." }, { status: 503 });
  }
};

export const config = {
  path: ["/ai-chatbot/api/*", "/ai-chatbot/health", "/ai-chatbot/ops", "/ai-chatbot/ops/"],
};

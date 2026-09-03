const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

const proxyModuleUrl = pathToFileURL(path.join(__dirname, "..", "netlify", "functions", "render-proxy.mjs")).href;

async function loadProxy() {
  return import(`${proxyModuleUrl}?test=${Date.now()}-${Math.random()}`);
}

test("Netlify proxy forwards demo API method, path, query, body and coarse geo to Render", async (t) => {
  const previousOrigin = process.env.DEMO_RENDER_ORIGIN;
  const previousFetch = global.fetch;
  process.env.DEMO_RENDER_ORIGIN = "https://demo-backend.example.com";

  let captured;
  global.fetch = async (target, options) => {
    captured = {
      target: String(target),
      method: options.method,
      body: options.body ? Buffer.from(options.body).toString("utf8") : null,
      contentType: options.headers.get("content-type"),
      forwardedFor: options.headers.get("x-forwarded-for"),
      referer: options.headers.get("referer"),
      countryCode: options.headers.get("x-demo-geo-country-code"),
      countryName: options.headers.get("x-demo-geo-country-name"),
      region: options.headers.get("x-demo-geo-region"),
      city: options.headers.get("x-demo-geo-city"),
      timezone: options.headers.get("x-demo-geo-timezone"),
    };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.DEMO_RENDER_ORIGIN;
    else process.env.DEMO_RENDER_ORIGIN = previousOrigin;
  });

  const { default: proxy } = await loadProxy();
  const request = new Request(
    "https://demo-frontend.netlify.app/ai-chatbot/api/demo/sessions/session-1/message?source=preview",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nf-client-connection-ip": "203.0.113.8",
        "referer": "https://dasmarketingsolution.com/ai-chatbot/?utm_source=Facebook&utm_campaign=demo-september",
      },
      body: JSON.stringify({ message: "How much is HIFU?" }),
    }
  );

  const response = await proxy(request, {
    ip: "203.0.113.8",
    geo: {
      city: "Petaling Jaya",
      country: { code: "MY", name: "Malaysia" },
      subdivision: { code: "10", name: "Selangor" },
      timezone: "Asia/Kuala_Lumpur",
    },
  });
  assert.equal(response.status, 200);
  assert.equal(captured.target, "https://demo-backend.example.com/api/demo/sessions/session-1/message?source=preview");
  assert.equal(captured.method, "POST");
  assert.equal(captured.body, JSON.stringify({ message: "How much is HIFU?" }));
  assert.equal(captured.contentType, "application/json");
  assert.equal(captured.forwardedFor, "203.0.113.8");
  assert.match(captured.referer, /utm_source=Facebook/);
  assert.equal(captured.countryCode, "MY");
  assert.equal(captured.countryName, "Malaysia");
  assert.equal(captured.region, "Selangor");
  assert.equal(captured.city, "Petaling Jaya");
  assert.equal(captured.timezone, "Asia/Kuala_Lumpur");
});

test("Netlify proxy fails closed when the Render origin is not configured", async (t) => {
  const previousOrigin = process.env.DEMO_RENDER_ORIGIN;
  delete process.env.DEMO_RENDER_ORIGIN;
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.DEMO_RENDER_ORIGIN;
    else process.env.DEMO_RENDER_ORIGIN = previousOrigin;
  });

  const { default: proxy } = await loadProxy();
  const response = await proxy(new Request("https://demo-frontend.netlify.app/ai-chatbot/api/demo/config"));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /not configured/i);
});

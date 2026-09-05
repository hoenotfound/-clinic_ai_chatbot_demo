const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const proxyUrl = pathToFileURL(path.join(__dirname, "..", "netlify", "functions", "render-proxy.mjs")).href;

test("Netlify proxy prefers the trusted Netlify client IP over a spoofed forwarded header", async (t) => {
  const previousOrigin = process.env.DEMO_RENDER_ORIGIN;
  const previousFetch = global.fetch;
  process.env.DEMO_RENDER_ORIGIN = "https://demo-backend.example.com";
  let forwardedFor = null;

  global.fetch = async (_target, options) => {
    forwardedFor = options.headers.get("x-forwarded-for");
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

  const { default: proxy } = await import(`${proxyUrl}?trusted-ip=${Date.now()}`);
  const request = new Request("https://demo.example.com/ai-chatbot/api/demo/config", {
    headers: {
      "x-forwarded-for": "198.51.100.99",
      "x-nf-client-connection-ip": "203.0.113.8",
    },
  });
  const response = await proxy(request, { ip: "203.0.113.9" });
  assert.equal(response.status, 200);
  assert.equal(forwardedFor, "203.0.113.8");
});

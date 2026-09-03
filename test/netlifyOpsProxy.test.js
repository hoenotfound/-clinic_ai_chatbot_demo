const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const moduleUrl = pathToFileURL(path.join(__dirname, "..", "netlify", "functions", "render-proxy.mjs")).href;

async function loadProxy() {
  return import(`${moduleUrl}?test=${Date.now()}-${Math.random()}`);
}

test("Netlify ops proxy forwards Basic auth and WWW-Authenticate", async () => {
  const previousOrigin = process.env.DEMO_RENDER_ORIGIN;
  const previousFetch = global.fetch;
  process.env.DEMO_RENDER_ORIGIN = "https://render.example";
  let upstreamRequest;

  global.fetch = async (target, options) => {
    upstreamRequest = { target: String(target), options };
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "www-authenticate": 'Basic realm="Demo Operations", charset="UTF-8"',
      },
    });
  };

  try {
    const { default: proxy } = await loadProxy();
    const authorization = `Basic ${Buffer.from("admin:secret").toString("base64")}`;
    const response = await proxy(new Request("https://demo.example/ai-chatbot/ops", {
      headers: { authorization },
    }));

    assert.equal(response.status, 401);
    assert.equal(upstreamRequest.target, "https://render.example/ops");
    assert.equal(upstreamRequest.options.headers.get("authorization"), authorization);
    assert.match(response.headers.get("www-authenticate") || "", /Demo Operations/);
  } finally {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.DEMO_RENDER_ORIGIN;
    else process.env.DEMO_RENDER_ORIGIN = previousOrigin;
  }
});

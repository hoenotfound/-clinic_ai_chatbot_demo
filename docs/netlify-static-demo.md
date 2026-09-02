# Netlify static frontend + Render API

This deployment keeps the customer-facing demo UI on Netlify so `/ai-chatbot/` loads immediately even when the free Render web service is asleep.

## 1. Deploy this repository as a Netlify preview/static frontend

Connect this repository to a Netlify site. `netlify.toml` will run:

```bash
npm run build:netlify
```

and publish `netlify-dist`.

Set this Netlify environment variable:

```text
DEMO_RENDER_ORIGIN=https://YOUR-RENDER-SERVICE.onrender.com
```

The preview will then work at:

```text
https://YOUR-DEMO-FRONTEND.netlify.app/ai-chatbot/
```

The Netlify function is for the standalone preview. It forwards `/ai-chatbot/api/*` to the Render backend while the frontend files stay on Netlify.

## 2. Production rules on dasmarketingsolution.com

On the Netlify site that owns `dasmarketingsolution.com`, put the API rule **before** the static frontend rule:

```text
/ai-chatbot/api/*  https://YOUR-RENDER-SERVICE.onrender.com/api/:splat  200!
/ai-chatbot/health https://YOUR-RENDER-SERVICE.onrender.com/health       200!
/ai-chatbot/*      https://YOUR-DEMO-FRONTEND.netlify.app/ai-chatbot/:splat 200!
```

Why the API rule is first: production API calls should go directly from the main Netlify site to Render. The catch-all rule only proxies static frontend/dashboard assets from the demo Netlify site. This avoids relying on a chained Netlify-to-Netlify-to-Render proxy.

Netlify keeps the visitor URL as:

```text
https://dasmarketingsolution.com/ai-chatbot/
```

## Cold-start experience

The static page renders immediately. Before the backend is reachable, the demo shows:

```text
STARTING LIVE AI RECEPTIONIST…
```

Patient send controls, channel switching and Restart Demo remain disabled until the private session can be created. The Patient/Clinic Dashboard tabs stay usable so a prospect can browse the product while Render wakes.

The readiness controller retries `/api/demo/config`. Each attempt is capped below Netlify's external proxy timeout, so a sleeping Render instance can wake even when the first proxied request times out. Once the backend responds, the UI changes to:

```text
AI RECEPTIONIST ONLINE
```

and the normal existing Patient View/session flow continues.

## Render remains unchanged

Render continues to run:

```bash
npm start
```

No Render server routes need to change for this architecture. The static Netlify build is generated from the same `public/` files and React dashboard used by the Render version.

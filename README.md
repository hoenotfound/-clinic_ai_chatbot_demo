# Clinic AI Chatbot Demo

A standalone public sales demo for a multi-channel AI clinic receptionist.

The demo recreates WhatsApp, Instagram and Messenger customer experiences in the browser while sending messages to a standalone demo backend. The staff-facing Clinic Dashboard is a React + Tailwind portal that mirrors the production product design without connecting to production data or Meta credentials.

## What the demo includes

- WhatsApp-style patient chat
- Instagram-style patient chat
- Messenger-style patient chat
- One shared AI conversation engine
- Fictional sample brand: `Nova Demo Aesthetic Clinic`
- Gemini, Claude or deterministic mock mode
- Temporary isolated browser sessions
- Cold / Warm / Hot lead scoring
- Treatment-interest detection
- Appointment-intent detection
- Branch and timing detection
- AI-to-human handoff
- Staff takeover and staff replies
- React Clinic Dashboard with Inbox, Contacts, Pipeline, Analytics, Tools, Settings and Team & Access
- Mixed English / Bahasa Malaysia / Chinese sample history
- Guided customer journey
- Configurable end-of-demo sales CTA
- Context-aware HIFU promotion shown only after HIFU interest is detected
- Per-session, per-IP and global daily demo limits
- Global AI concurrency cap and staff-reply abuse protection
- Optional Redis-backed shared session/rate-limit state
- Browser-level Playwright regression tests
- No production chatbot data
- No WhatsApp, Facebook or Instagram credentials

## Architecture

```text
Prospect browser
     |
     +--> Patient channel preview (HTML/CSS/JS)
     |
     +--> React Clinic Dashboard
     |
     v
Demo HTTP API (Node.js)
     |
     +--> in-memory session state
     |       or optional Redis shared state
     +--> lead scoring / handoff logic
     +--> abuse / concurrency guards
     |
     v
Gemini / Claude / Mock
```

The public demo intentionally bypasses Meta because the channels are simulated in-browser. A real deployment still connects the production chatbot to the clinic's actual WhatsApp, Instagram and Facebook accounts through the appropriate Meta APIs and webhooks.

## Privacy behavior

The public UI tells visitors not to enter real patient information or sensitive personal data.

Messages are not written to the production chatbot database. When Gemini or Claude is selected, customer messages are sent to that configured AI provider to generate the reply. When `REDIS_URL` is configured, temporary demo-session data can be stored in the demo's Redis/Render Key Value instance for the configured session lifetime.

## Requirements

- Node.js 20 or newer
- A Gemini API key or Anthropic API key for live AI replies

The Node server uses the `ioredis` runtime dependency when optional shared state is configured. The React dashboard has its own frontend dependencies under `portal-react/`.

## Local setup

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Choose a provider.

Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Claude:

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-sonnet-5
```

Mock mode for development/testing:

```env
AI_PROVIDER=mock
```

3. Install and build:

```bash
npm install
```

The root `postinstall` script installs the React dashboard dependencies and builds `portal-react/dist` automatically.

4. Start the app:

```bash
npm start
```

5. Open:

```text
http://localhost:3000
```

## Render deployment

The included `render.yaml` targets an always-on `0.5c-512mb` web service. If your existing Render service uses another plan, the actual service setting takes precedence until you recreate/apply the Blueprint.

Blueprint build/start configuration:

```text
Build command: npm ci --omit=dev
Start command: npm start
Health check: /health
```

`npm ci --omit=dev` still runs the root `postinstall`, which builds the React dashboard.

Set the appropriate provider secret directly in Render:

```text
GEMINI_API_KEY
```

or:

```text
ANTHROPIC_API_KEY
```

Optional shared state:

```text
REDIS_URL
```

For the final sales CTA:

```env
SALES_CTA_LABEL=Set up my clinic
SALES_CTA_URL=https://your-sales-link.example
```

No Meta environment variables are needed for the public browser demo.

## Demo limits

Defaults:

```env
DEMO_SESSION_MINUTES=60
DEMO_MAX_MESSAGES=30
DEMO_MAX_SESSIONS_PER_IP_DAY=20
DEMO_MAX_TOTAL_MESSAGES_PER_DAY=500
DEMO_MIN_MESSAGE_INTERVAL_MS=900
DEMO_MAX_TOTAL_MESSAGES_PER_SESSION=60
DEMO_MAX_STAFF_MESSAGES_PER_SESSION=20
DEMO_MIN_STAFF_MESSAGE_INTERVAL_MS=700
DEMO_MAX_CONCURRENT_AI_REQUESTS=8
```

These reduce casual abuse and limit bursts of AI calls. Provider-side spend/quota limits are still recommended for a widely advertised public URL.

## Session behavior

- Each visitor gets a UUID session.
- Active use extends the session expiry window.
- Without `REDIS_URL`, sessions and major counters are held in the Node process and reset on restart/redeploy.
- With `REDIS_URL`, session state and major daily counters can survive web-service restarts for their configured TTL.
- The demo never writes prospect conversations to the production chatbot database.
- The current AI concurrency cap is per Node process.

For a multi-instance deployment, keep Redis enabled and reassess the process-level concurrency limit because each app instance has its own AI request semaphore.

## Human takeover demo

When the AI outputs the hidden marker:

```text
[[HANDOFF]]
```

the backend removes the marker before the prospect sees it and marks the conversation as requiring staff attention.

Typical handoff situations include:

- explicit request for a human
- complaints or refund requests
- reported adverse reactions
- questions requiring clinician judgement

The prospect can switch to **Clinic Dashboard**, choose the live `Demo Patient`, click **Take over**, send a staff reply, and then return to Patient View to see that reply in the same conversation.

## Fictional clinic

All sample clinic information lives in:

```text
src/clinicConfig.js
```

Keep the public demo fictional. Do not place a paying client's private production information into this repository.

## Tests

Backend/static regression tests:

```bash
npm test
```

Browser journey tests:

```bash
npx playwright install chromium
npm run test:e2e
```

GitHub Actions builds the React dashboard, runs the Node regression suite, checks JavaScript syntax and runs Playwright against the visible React portal. E2E coverage includes patient chat, booking intent, mixed-language history, Inbox search/filtering, Pipeline filters, Analytics, Tools, staff takeover, staff reply, mobile list-to-thread navigation and browser/CSP errors.

## Recommended public-demo safeguards

For normal prospect sharing, the current application limits are a solid baseline. For broad advertising or high-volume public traffic, also use:

- Redis/Render Key Value shared state
- provider-side spend/quota caps
- an always-on Render service
- a managed bot challenge such as Cloudflare Turnstile if abuse becomes material
- monitoring for 429s, AI-provider failures and unusual session creation volume

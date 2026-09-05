# Clinic AI Chatbot Demo

A standalone public sales demo for a multi-channel AI receptionist / sales assistant.

The default profile recreates an aesthetic clinic experience. The same demo stack can also run the Home Renovation & Custom Carpentry profile by setting `DEMO_INDUSTRY=renovation` before build/start. This keeps one maintained demo codebase while allowing industry-specific AI behaviour, sample leads, pipeline language and branding.

The demo recreates WhatsApp, Instagram and Messenger customer experiences in the browser while sending messages to a standalone demo backend. The staff-facing dashboard is a React + Tailwind portal that mirrors the production product design without connecting to production data or Meta credentials.

## Demo industry profiles

Default aesthetic clinic:

```env
DEMO_INDUSTRY=clinic
```

Home renovation / custom carpentry:

```env
DEMO_INDUSTRY=renovation
```

The renovation profile uses fictional `Oakline Demo Renovation & Carpentry` data and includes kitchen cabinets, built-in wardrobes, TV/living-room carpentry, shoe cabinets, storage and full-home custom carpentry. It qualifies enquiries using project scope, property type, area, measurements/floor-plan context, budget, timeline, quotation intent and site-measurement intent. Structural, electrical, plumbing, waterproofing, gas and permit questions are handed to staff rather than guessed.

Keep each deployment on one profile. `DEMO_INDUSTRY` must be available during the React dashboard build as well as server startup so the dashboard sample data and branding match the backend profile.

## What the demo includes

- WhatsApp-style customer chat
- Instagram-style customer chat
- Messenger-style customer chat
- One shared AI conversation engine
- Fictional sample business data
- Gemini, Claude or deterministic mock mode
- Temporary isolated browser sessions
- Cold / Warm / Hot lead scoring
- Industry-specific service/project-interest detection
- Appointment or site-measurement intent detection depending on profile
- Branch/service-area and timing detection
- AI-to-human handoff
- Staff takeover and staff replies
- React dashboard with Inbox, Contacts, Pipeline, Analytics, Tools, Settings and Team & Access
- Mixed English / Bahasa Malaysia / Chinese sample history
- Guided customer journey
- Configurable end-of-demo sales CTA
- Context-aware clinic promotion when the clinic profile is active
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
     +--> Customer channel preview (HTML/CSS/JS)
     |
     +--> React Staff Dashboard
     |
     v
Demo HTTP API (Node.js)
     |
     +--> selected industry profile
     +--> in-memory session state
     |       or optional Redis shared state
     +--> lead scoring / handoff logic
     +--> abuse / concurrency guards
     |
     v
Gemini / Claude / Mock
```

The public demo intentionally bypasses Meta because the channels are simulated in-browser. A real deployment still connects the production chatbot to the business's actual WhatsApp, Instagram and Facebook accounts through the appropriate Meta APIs and webhooks.

## Privacy behavior

The public UI tells visitors not to enter real personal or sensitive information.

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

2. Select the demo profile:

```env
DEMO_INDUSTRY=clinic
```

or:

```env
DEMO_INDUSTRY=renovation
```

3. Choose a provider.

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

4. Install and build:

```bash
npm install
```

The root `postinstall` script installs the React dashboard dependencies and builds `portal-react/dist` automatically. Set `DEMO_INDUSTRY` before this build so the correct dashboard profile is compiled.

5. Start the app:

```bash
npm start
```

6. Open:

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

Set the industry profile in Render before the build:

```env
DEMO_INDUSTRY=renovation
```

or leave it as `clinic` for the existing aesthetic-clinic demo.

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

When the renovation profile is active and the CTA label is left at the clinic default, startup changes the label to `Set up my renovation chatbot`.

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

Typical clinic handoff situations include:

- explicit request for a human
- complaints or refund requests
- reported adverse reactions
- questions requiring clinician judgement

Typical renovation handoff situations include:

- site-measurement requests
- detailed quotation / real project follow-up
- requests for a designer, salesperson or project manager
- structural, electrical, plumbing, gas, waterproofing or permit questions
- complaints, defects or payment disputes

The prospect can switch to the staff dashboard, choose the live demo customer, click **Take over**, send a staff reply, and then return to Customer View to see that reply in the same conversation.

## Fictional business data

Clinic sample information lives in:

```text
src/clinicConfig.js
```

Renovation sample information lives in:

```text
src/renovationConfig.js
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

GitHub Actions builds the React dashboard, runs the Node regression suite, checks JavaScript syntax and runs Playwright against the visible React portal. The renovation profile also has dedicated regression coverage for quotation behaviour, site-measurement handoff, technical escalation, multilingual fallback and live project/budget/area qualification.

## Recommended public-demo safeguards

For normal prospect sharing, the current application limits are a solid baseline. For broad advertising or high-volume public traffic, also use:

- Redis/Render Key Value shared state
- provider-side spend/quota caps
- an always-on Render service
- a managed bot challenge such as Cloudflare Turnstile if abuse becomes material
- monitoring for 429s, AI-provider failures and unusual session creation volume

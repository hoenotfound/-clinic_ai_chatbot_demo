# Clinic AI Chatbot Demo

A standalone public sales demo for a multi-channel AI clinic receptionist.

The demo recreates WhatsApp, Instagram and Messenger customer experiences in the browser while sending messages to the same standalone demo engine. Real client deployments connect the production chatbot to the clinic’s actual messaging accounts.

## What the demo includes

- WhatsApp-style patient chat
- Instagram-style patient chat
- Messenger-style patient chat
- One shared AI conversation engine
- Explicitly fictional sample brand: `Nova Demo Aesthetic Clinic`
- Gemini or Claude support
- Temporary private browser sessions
- Cold / Warm / Hot lead scoring
- Treatment-interest detection
- Appointment-intent detection
- Branch and timing detection
- AI-to-human handoff
- Staff takeover and staff replies
- Production-style Clinic Dashboard
- Mixed English / Bahasa Malaysia / Chinese sample conversation history
- Production-style Inbox, Pipeline, Analytics and Tools demo pages
- Conversation summaries and detected intent
- Guided 60-second customer journey
- One-tap sample questions on desktop and mobile
- Configurable end-of-demo sales CTA
- Context-aware HIFU promotion shown only after HIFU interest is detected
- Per-session, per-IP and global daily demo limits
- Global AI concurrency cap and staff-reply abuse protection
- Strict CSP with CSP-safe dashboard/chart markup
- Browser-level Playwright regression tests
- No database
- No WhatsApp, Facebook or Instagram credentials
- No production chatbot data

## Architecture

```text
Prospect browser
     |
     | browser customer-channel experience
     v
Demo HTTP API
     |
     +--> temporary session memory
     +--> lead scoring
     +--> handoff logic
     +--> abuse/concurrency guards
     |
     v
Gemini or Claude
     |
     v
Browser chat + production-style Clinic Dashboard
```

The channel selector changes the customer interface and channel label. The public demo itself does not need Meta credentials. For convenience, the demo keeps one conversation when a visitor switches channel previews; real platform identities remain separate unless a production deployment explicitly links them.

## Privacy behavior

The public UI tells visitors not to enter real patient information or sensitive personal data. Sessions remain in server memory only and are not written to a database, but customer messages are sent to the configured AI provider to generate a reply.

## Requirements

- Node.js 20 or newer
- A Gemini API key or Anthropic API key for real AI replies

There are no runtime npm dependencies. Node's built-in HTTP server and `fetch()` are used directly. Playwright is a development-only dependency for browser regression testing.

## Local setup

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Choose an AI provider in `.env`.

For Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

For Claude:

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-sonnet-5
```

3. Install development dependencies and start the app:

```bash
npm install
npm start
```

4. Open:

```text
http://localhost:3000
```

## Mock mode

For UI testing without spending API credits:

```env
AI_PROVIDER=mock
```

Mock mode uses deterministic sample replies. Public customer-facing demos should use Gemini or Claude.

## Render deployment

A `render.yaml` is included. It requests Render's paid `0.5c-512mb` web-service compute plan so the prospect-facing demo does not use Free-service idle spin-down behavior.

Recommended settings:

```text
Build command: npm install
Start command: npm start
Health check: /health
```

Set the appropriate secret directly in Render:

```text
GEMINI_API_KEY
```

or:

```text
ANTHROPIC_API_KEY
```

No Meta environment variables are needed.

To connect the final **Set up my clinic** button to your WhatsApp or sales page, set:

```env
SALES_CTA_LABEL=Set up my clinic
SALES_CTA_URL=https://your-sales-link.example
```

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

These reduce casual abuse and prevent a burst of visitors from creating unlimited simultaneous AI calls. The counters are intentionally process-memory controls for this lightweight demo, not a provider billing guarantee. For a heavily advertised public endpoint, add provider-side spend/quota protection and consider a persistent shared rate-limit store.

## Session behavior

Sessions are stored only in server memory.

- Each visitor gets a UUID session.
- Active use extends the configured session expiry window.
- A server restart clears all demo conversations and in-memory counters.
- No prospect data is written to the production chatbot or a database.
- A single-instance deployment keeps each visitor isolated by session ID.

This is intentional for a sales demo. If the service is later scaled to multiple app instances, move session/rate-limit state to a shared store before enabling horizontal scaling.

## Human takeover demo

When the AI outputs the hidden marker:

```text
[[HANDOFF]]
```

the server removes it before the prospect sees the message and marks the conversation as needing staff attention.

The marker is requested for situations such as:

- explicit request for a human
- complaints or refund requests
- reported adverse reactions
- questions requiring clinician judgement

The prospect can then switch to **Clinic Dashboard**, click **Take over**, send a staff reply, and see that reply appear immediately in Patient View. Staff replies are also rate- and volume-limited in the public demo.

## Fictional clinic

All sample clinic information lives in:

```text
src/clinicConfig.js
```

The brand is deliberately named `Nova Demo Aesthetic Clinic` to make its fictional/demo status explicit. Do not replace it with a paying client's production information in this public demo.

## Important production distinction

This project bypasses Meta only because the channels are simulated.

For a real customer to message a real WhatsApp number, Instagram account or Facebook Page, the production chatbot still needs the appropriate Meta APIs, webhooks and credentials.

## Tests

Run backend/static regression tests:

```bash
npm test
```

Run the browser journey locally after installing Playwright Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs both suites. Browser tests cover the live patient flow, Hot lead detection for the guided booking example, mixed-language history, Pipeline, Analytics, Tools, human takeover, staff reply, mobile thread navigation and CSP/browser console errors.

# Clinic AI Chatbot Demo

A standalone public demo for selling a multi-channel AI clinic receptionist.

The public demo recreates WhatsApp, Instagram and Messenger customer experiences in the browser while sending messages to the same standalone demo engine. Real client deployments connect the production chatbot to the clinic’s actual messaging accounts.

## What the demo includes

- WhatsApp-style patient chat
- Instagram-style patient chat
- Messenger-style patient chat
- One shared AI conversation engine
- Fictional sample clinic, `Nova Aesthetic Clinic`
- Gemini or Claude support
- Temporary private browser sessions
- Cold / Warm / Hot lead scoring
- Treatment-interest detection
- Appointment-intent detection
- Branch and timing detection
- AI-to-human handoff
- Staff takeover and staff replies
- Clinic-side inbox view
- Conversation summary
- Simple pipeline view
- Guided 60-second customer journey
- One-tap sample questions on desktop and mobile
- Configurable end-of-demo sales CTA
- Context-aware HIFU promotion shown only after HIFU interest is detected
- Per-session, per-IP and global daily demo limits
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
     |
     v
Gemini or Claude
     |
     v
Browser chat + Clinic Dashboard
```

The channel selector changes the customer interface and channel label. The public demo itself does not need Meta credentials.

## Requirements

- Node.js 20 or newer
- A Gemini API key or Anthropic API key for real AI replies

There are no npm runtime dependencies. Node's built-in HTTP server and `fetch()` are used directly.

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

3. Start the app:

```bash
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

Mock mode uses a few deterministic sample replies. Public production demos should use Gemini or Claude.

## Render deployment

A `render.yaml` is included.

Recommended Render settings:

```text
Build command: npm install
Start command: npm start
Health check: /health
```

Then set the appropriate secret environment variable in Render:

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
```

These are intended to reduce casual abuse of a public AI endpoint. The global daily ceiling also limits total exposure if someone bypasses the per-IP session limit. They can be adjusted in Render without changing code.

## Session behavior

Sessions are stored only in server memory.

- Each visitor gets a UUID session.
- Conversation data expires after the configured session duration.
- A server restart clears all demo conversations.
- No prospect data is written to the production chatbot or a database.

This is intentional for a sales demo.

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

The prospect can then switch to **Clinic Dashboard**, click **Take over**, send a staff reply, and see that reply appear immediately in Patient View.

## Fictional clinic

All sample clinic information lives in:

```text
src/clinicConfig.js
```

Change this file if you want a different generic clinic persona. The current data is intentionally fictional and should not be replaced with a paying client's production information in this public demo.

## Important production distinction

This project bypasses Meta only because the channels are simulated.

For a real customer to message a real WhatsApp number, Instagram account or Facebook Page, the production chatbot still needs the appropriate Meta APIs, webhooks and credentials.

## Tests

Run:

```bash
npm test
```

The included tests cover session isolation, hot-lead detection, preference updates, reduced-interest handling, hidden handoff markers, human takeover, context-aware promotion behavior, customer-friendly summaries and hiding internal lead scores from the browser.

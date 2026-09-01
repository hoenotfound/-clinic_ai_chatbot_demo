# Demo product notes

## Recommended customer journey

1. Prospect lands on the demo page.
2. Prospect chooses a WhatsApp, Instagram or Messenger channel preview.
3. Prospect chats with `Nova Demo Aesthetic Clinic`, an explicitly fictional sample brand.
4. Lead signals update automatically.
5. Prospect switches to Clinic Dashboard.
6. Prospect sees the same live conversation alongside clearly labelled sample EN / BM / Chinese history.
7. Prospect can inspect Inbox, Pipeline, Analytics and Tools using production-style layouts.
8. Prospect can trigger or test a human handoff.
9. Prospect clicks Take over and replies as clinic staff.
10. The staff reply appears immediately in the patient chat.
11. Prospect can return the conversation to AI mode.
12. Prospect reaches the configurable sales CTA.

## Why the demo does not use Meta

The purpose is to demonstrate the product's conversation and staff workflow before a clinic connects its real messaging accounts. Removing Meta from the public demo avoids account setup, tokens, webhooks, app review and channel-specific onboarding.

The channel selector is only a UI preview. The demo intentionally retains one conversation when switching channels for convenience; production platform identities remain separate unless identity linking is explicitly implemented.

## Privacy and technical boundaries

The public UI tells prospects not to enter real patient information or sensitive personal data.

Do not expose:

- production Render services
- production databases
- AI provider choice in public API/config responses
- API keys
- Meta access tokens
- webhook payloads
- system prompts
- source code
- production customer conversations

The Clinic Dashboard is a product demonstration, not a server administration console.

## Reliability / abuse controls

The demo includes:

- UUID-isolated in-memory sessions
- per-IP session limits
- per-session customer-message limits
- global daily customer-message limits
- total-message and staff-reply limits
- minimum customer/staff message intervals
- global AI concurrency cap
- strict CSP
- no-cache revalidation for frequently updated public assets
- Node/static regression tests
- Playwright browser journey + mobile/CSP checks

The included Render Blueprint targets an always-on paid web-service compute plan. In-memory limits still reset on process restart/redeploy and should not be treated as an AI-provider billing guarantee.

## Suggested future additions only if sales feedback justifies them

- Demo appointment calendar simulation
- Voice-note simulation
- Photo-message simulation
- Telegram-alert simulation panel
- Prospect-specific demo links with company name prefilled
- Lightweight admin analytics for demo usage
- Persistent distributed session/rate-limit storage if horizontal scaling is introduced
- Managed bot challenge such as Turnstile if the URL is advertised broadly

# Demo product notes

## Recommended customer journey

1. Prospect lands on the demo page.
2. Prospect chooses WhatsApp, Instagram or Messenger.
3. Prospect chats with the fictional clinic AI.
4. Lead signals update automatically.
5. Prospect switches to Clinic Dashboard.
6. Prospect sees the same conversation, lead temperature and summary.
7. Prospect can trigger or test a human handoff.
8. Prospect clicks Take over and replies as clinic staff.
9. The staff reply appears immediately in the simulated patient chat.
10. Prospect can return the conversation to AI mode.

## Why the demo does not use Meta

The purpose is to demonstrate the product's conversation and staff workflow before a clinic connects its real messaging accounts. Removing Meta from the public demo avoids account setup, tokens, webhooks, app review and channel-specific onboarding.

## What should remain hidden from prospects

Do not expose:

- production Render services
- production databases
- API keys
- Meta access tokens
- webhook payloads
- system prompts
- source code
- production customer conversations

The Clinic Dashboard is a product demonstration, not a server administration console.

## Suggested future additions

- Demo appointment calendar simulation
- Voice-note simulation
- Photo-message simulation
- Automatic conversation-end summary card
- Telegram-alert simulation panel
- Before/after analytics simulation
- Prospect-specific demo links with company name prefilled
- Lightweight admin analytics for demo usage
- CAPTCHA or managed rate limiter if public traffic becomes high

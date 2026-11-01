# Sandbox accounts

1. developer.paypal.com → Sandbox → Accounts.
2. Create **1 business** account (the circle) and **8 personal** accounts (members), each with a sandbox balance.
3. Apps & Credentials → create a dedicated app for Turnwise → enable **Payouts** and **Vault** features.
4. Add a webhook pointing at `https://<render-url>/api/paypal/webhooks` with the events in `src/paypal/webhooks.ts`.
5. Copy the client ID, secret and webhook ID into `.env`, and the 8 personal emails into `SANDBOX_MEMBER_EMAILS`.

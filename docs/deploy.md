# Deploying to Render

Blueprint: `render.yaml` (web service, worker, Postgres). Migrations run on every web start (`pnpm db:deploy`).
Keep paid instances running until **15 Dec 2026** (end of judging) so judges never hit a cold start.

## Environment variables (set values in the Render dashboard; paste each on one line)

| Variable | Web | Worker | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | yes | From the Render database |
| `PAYPAL_ENV` | yes | yes | `sandbox` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | yes | yes | The **US** sandbox app (turnwise-us) |
| `PAYPAL_WEBHOOK_ID` | yes | | From the app's webhook settings |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | yes | yes | `openai/gpt-6-luna` |
| `NEXT_PUBLIC_AG_GRID_LICENSE_KEY` | yes | | Build-time: redeploy after changing it |
| `MCP_TOKEN_SECRET` | yes | | Same value as local if you want local tokens to work |
| `SANDBOX_MEMBER_EMAILS` | yes | | The members of live judge circles |
| `SANDBOX_VAULTS` | yes | | Output of `pnpm vaults:export` (treat like a password) |
| `APP_BASE_URL` | yes | yes | `https://turnwise-web.onrender.com` |
| `WORKER_TICK_MS` | | yes | `2000` |
| `DEMO_SECONDS_PER_DAY` | | yes | `0` (live circles keep their own clock) |

Remove any `AZURE_OPENAI_*` variables and the old `pending` AG Grid value.

## After each deploy

1. Open `/judge` → **Load the demo circle**; ask the ledger "Who has paid late twice?".
2. **Start a live circle**; it should reach "Finished" in about 3 minutes with every payout confirmed.
3. `pnpm mcp:smoke https://turnwise-web.onrender.com/api/mcp <circleId>` from your machine.
4. PayPal Developer Dashboard → your app → Webhooks → Event logs: recent deliveries show 200.

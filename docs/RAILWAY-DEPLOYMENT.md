# Deploy Econia on Railway

Prepared 11 November 2026. The app and task worker run on Railway. Your computer is only needed to manage the deployment or open the site.

## Create the service

1. Create a Railway project from `Sanni-onX/Econia`, branch `main`. Keep the repository root as the service root. Railway uses the root Dockerfile and `railway.json` automatically.
2. Attach a persistent volume at **`/app/.data`**. The service intentionally refuses to start on Railway without a volume, or when its database path is outside that volume. This preserves tasks, owner briefs and reserved inference allowances across redeployments.
3. Set the service variables below. Enter the existing API key directly in Railway's Variables panel; never put it in Git or chat.
4. Generate a public Railway domain. The app accepts that domain through `RAILWAY_PUBLIC_DOMAIN`. If using a custom domain, set `APP_ORIGIN` to its exact HTTPS origin. For several origins, use a comma-separated `ALLOWED_ORIGINS` value.
5. Deploy **one replica**. Leave any start-command override empty: the Docker image starts the mainnet web process and its request-driven task worker. The healthcheck is `/api/health`. The app listens on `0.0.0.0` and Railway's injected `PORT`.

| Variable | Value |
| --- | --- |
| `NEAR_AI_API_KEY` | Existing funded NEAR AI Cloud key; secret |
| `NEAR_AI_MODEL` | `z-ai/glm-5.3-flash`, verified with the current service examples |
| `SERVICE_DATABASE_PATH` | `/app/.data/econia-services.sqlite` (also the image default) |
| `SERVICE_DAILY_AI_CALL_LIMIT` | `12` initially; `0` disables new AI-assisted task admission |
| `SERVICE_DAILY_TASK_LIMIT` | `24` initially, including CSV tasks |
| `SERVICE_ACCOUNT_TASK_LIMIT` | `3` initially, per wallet per UTC day |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `15`, allowing aborted in-flight work to be recorded |
| `APP_ORIGIN` | Optional exact custom origin, such as `https://econia.example` |
| `NEAR_MAINNET_RPC_URL` | Optional alternative mainnet RPC; defaults to the documented public FastNEAR endpoint |

Do not add wallet recovery phrases, project private keys, or a full-access mainnet signer to Railway. This trial worker verifies ownership and wallet signatures; it does not sign transactions or move NEAR.

## Verify the deployment

- `/api/health` should return HTTP 200 with mainnet verification time. A failed chain read blocks fresh financial transaction preparation.
- The landing page should show 64 NFTs, 7 activated service capabilities, and zero agent treasuries unless users have subsequently funded them. Web3 services work without an AI key; document generation still requires the NEAR AI configuration.
- Connect Nightly or another NEAR mainnet wallet, then use **Sign in with wallet** in the service workspace. This second step signs a NEP-413 authentication message; it costs no gas. A wallet that cannot sign messages can still connect for transaction features, but cannot use signed workspace login yet.
- Submit a CSV task. It should reach `REVIEW_READY`, show parser/statistics/checker steps and offer a Markdown download. This task uses no AI credits.
- Submit a short document task to verify the API key. The evidence analyst and editor each reserve at most one inference request per task. Copy editing is limited to 4000 UTF-8 bytes; other inputs are limited to 16000 characters. Failed or interrupted requests do not retry automatically.
- Redeploy and sign in again. The prior tasks and spending reservations must remain. Session tokens are intentionally short-lived and held in process memory; signing in again after a restart is expected.

## Current commercial status

This is a **project-funded service trial**. Tasks cost the customer 0 NEAR. Deliverable acceptance records customer approval; it does not release onchain payment. Mainnet economic settlement remains paused. Agent treasuries still start at zero. Real paid escrow binding, delivery settlement and owner earnings withdrawals need their own verified release before charging customers.

The application has durable queue claims, duplicate-request protection and interrupted-work recovery. It does not silently repeat uncertain paid inference. Check and resolve interrupted tasks before requesting a replacement. Limits bound calls and input/output sizes, rather than guaranteeing a particular dollar cost. Enable a provider-side spending cap too if your NEAR AI account offers one.

Enable Railway volume backups and test restoration before a public rollout. Keep one app replica with this SQLite volume; scaling to several replicas requires a shared database/queue design. A volume-backed Railway service can have brief redeployment downtime.

Railway references: [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [persistent volumes](https://docs.railway.com/volumes), [healthchecks and PORT](https://docs.railway.com/deployments/healthchecks), [provided variables](https://docs.railway.com/variables/reference).

# Linear Agents — Setup Reference

## Managed Agent IDs (created 2026-04-09)

```
Environment:      env_01Seeqvszf8jmJQyKjdrKeDs
Planner:          agent_011CZsoJmU1ZNnRPXtKoSRME
Triager:          agent_011CZsoJoHePK3aifHAkoM9W
Story Writer:     agent_011CZsoJput7hC6FxsPYGKUU
Code Reviewer:    agent_011CZsoJrNgnHEmra7JYpZyA
Security Auditor: agent_011CZsoJt3QRt9xiD7tyFyHq
Implementer:      agent_011CZsoJuibxnqrtNKEN3k9Y
```

## Cloudflare Worker Secrets

Run these in the `linear-agents` repo:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ANTHROPIC_ENVIRONMENT_ID       # env_01Seeqvszf8jmJQyKjdrKeDs
wrangler secret put PLANNER_AGENT_ID               # agent_011CZsoJmU1ZNnRPXtKoSRME
wrangler secret put TRIAGER_AGENT_ID               # agent_011CZsoJoHePK3aifHAkoM9W
wrangler secret put STORY_WRITER_AGENT_ID          # agent_011CZsoJput7hC6FxsPYGKUU
wrangler secret put REVIEWER_AGENT_ID              # agent_011CZsoJrNgnHEmra7JYpZyA
wrangler secret put SECURITY_AGENT_ID              # agent_011CZsoJt3QRt9xiD7tyFyHq
wrangler secret put IMPLEMENTER_AGENT_ID           # agent_011CZsoJuibxnqrtNKEN3k9Y
wrangler secret put LINEAR_WEBHOOK_SECRET
wrangler secret put GITHUB_TOKEN
wrangler secret put LINEAR_VAULT_ID                # after creating vault
wrangler secret put GITHUB_VAULT_ID                # after creating vault
```

## Deploy

```bash
cd /Users/yauhenshvab/Work/linear-agents

# Copy the new source files from stowe-io/linear-agents-src/
# (or manually replace src/, package.json, tsconfig.json, wrangler.toml)

npm install
npx tsc --noEmit       # typecheck
wrangler deploy        # deploy to Cloudflare
```

## Linear OAuth Apps to Register

Go to Linear → Settings → API → Applications → New Application:

| Agent            | Webhook URL                                                          |
|------------------|----------------------------------------------------------------------|
| Planner          | `https://linear-agents.<subdomain>.workers.dev/webhooks/planner`     |
| Triager          | `https://linear-agents.<subdomain>.workers.dev/webhooks/triager`     |
| Story Writer     | `https://linear-agents.<subdomain>.workers.dev/webhooks/story-writer`|
| Code Reviewer    | `https://linear-agents.<subdomain>.workers.dev/webhooks/reviewer`    |
| Security Auditor | `https://linear-agents.<subdomain>.workers.dev/webhooks/security`    |
| Implementer      | `https://linear-agents.<subdomain>.workers.dev/webhooks/implementer` |

For each: enable webhooks → "Agent session events", authorize with `actor=app`, request scopes: `app:assignable`, `app:mentionable`.

## Quick Test (before Cloudflare integration)

```bash
export ANTHROPIC_API_KEY="your-key"
# Test planner directly via ant CLI:
ant beta:sessions create --agent "agent_011CZsoJmU1ZNnRPXtKoSRME" --environment "env_01Seeqvszf8jmJQyKjdrKeDs"
```

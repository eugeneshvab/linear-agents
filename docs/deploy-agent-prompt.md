# Linear Agents — Complete Deployment Prompt

You are deploying a Cloudflare Worker that connects Linear (project management) to Anthropic Managed Agents. The infrastructure is already created — your job is to wire everything together, deploy, and verify.

## Context

When a Linear issue is assigned to an agent (e.g., "Planner"), Linear sends an `AgentSessionEvent` webhook → the Cloudflare Worker receives it → dispatches to an Anthropic Managed Agent → the agent clones the repo, analyzes code, produces a plan/review/implementation → posts the result back to Linear.

**Repo:** `eugeneshvab/linear-agents` at `/Users/yauhenshvab/Work/linear-agents`
**Worker URL:** `https://linear-agents.eugene-shvab.workers.dev`
**Source code:** New source files are at `<stowe-io-repo>/linear-agents-src/`

## Already completed

- 6 Managed Agents created on Anthropic's platform
- 6 Linear OAuth apps registered with webhook URLs
- Worker TypeScript source code written and ready

## Credentials you have

```
ANTHROPIC_API_KEY=sk-ant-api03-REDACTED

GITHUB_TOKEN=ghp_REDACTED

ANTHROPIC_ENVIRONMENT_ID=env_01Seeqvszf8jmJQyKjdrKeDs
PLANNER_AGENT_ID=agent_011CZsoJmU1ZNnRPXtKoSRME
TRIAGER_AGENT_ID=agent_011CZsoJoHePK3aifHAkoM9W
STORY_WRITER_AGENT_ID=agent_011CZsoJput7hC6FxsPYGKUU
REVIEWER_AGENT_ID=agent_011CZsoJrNgnHEmra7JYpZyA
SECURITY_AGENT_ID=agent_011CZsoJt3QRt9xiD7tyFyHq
IMPLEMENTER_AGENT_ID=agent_011CZsoJuibxnqrtNKEN3k9Y
```

## Credentials you need to collect first

Before running any commands, you need 3 values from Linear. Ask the user for these:

### 1. LINEAR_WEBHOOK_SECRET (Planner's webhook signing secret)
- Go to: https://linear.app/stowe-io/settings/api/applications/5087f8ae-6d9b-490c-9529-59b4ab16478c
- Under "Webhooks" → "Signing secret" → click the copy button
- Starts with `lin_wh_...`

### 2. LINEAR_APP_TOKEN (Planner's developer token)
- Same page → "OAuth credentials" → "Developer token" → "Create & copy token" → choose "App"
- Starts with `lin_api_...`
- This token is what the Worker uses to post responses back to Linear

### 3. LINEAR_ORG_ID (organization UUID)
- Once you have the app token, fetch it:
```bash
curl -s 'https://api.linear.app/graphql' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: <LINEAR_APP_TOKEN>' \
  -d '{"query":"{ organization { id name } }"}' | jq -r '.data.organization.id'
```
- This is a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## Step-by-step deployment

### Step 1: Copy source files

```bash
cd /Users/yauhenshvab/Work/linear-agents

# Back up existing src
[ -d src ] && mv src src.backup.$(date +%s)

# Find the stowe-io repo path (likely ~/Work/stowe-io or similar)
# Copy the new source files:
cp -r <stowe-io-path>/linear-agents-src/src ./src
cp <stowe-io-path>/linear-agents-src/package.json ./package.json
cp <stowe-io-path>/linear-agents-src/tsconfig.json ./tsconfig.json
```

Do NOT overwrite wrangler.toml if it already has a valid KV namespace ID. Instead, verify it matches this structure:

```toml
name = "linear-agents"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "OAUTH_TOKENS"
id = "<existing-kv-namespace-id>"

[vars]
GITHUB_REPO_OWNER = "stowe-io"
GITHUB_REPO_NAME = "stowe-io"
```

If there's no KV namespace yet:
```bash
wrangler kv namespace create OAUTH_TOKENS
# Take the returned ID and put it in wrangler.toml
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Typecheck

```bash
npx tsc --noEmit
```

If there are errors, fix them before proceeding. Common issues:
- `KVNamespace` not found → ensure `@cloudflare/workers-types` is installed and in tsconfig `types`
- `ExecutionContext` not found → same fix
- Import resolution → ensure `"moduleResolution": "bundler"` in tsconfig

### Step 4: Set Cloudflare Worker secrets

Run each command and paste the value when prompted:

```bash
# Anthropic API key
echo "sk-ant-api03-REDACTED" | wrangler secret put ANTHROPIC_API_KEY

# Environment ID
echo "env_01Seeqvszf8jmJQyKjdrKeDs" | wrangler secret put ANTHROPIC_ENVIRONMENT_ID

# Agent IDs
echo "agent_011CZsoJmU1ZNnRPXtKoSRME" | wrangler secret put PLANNER_AGENT_ID
echo "agent_011CZsoJoHePK3aifHAkoM9W" | wrangler secret put TRIAGER_AGENT_ID
echo "agent_011CZsoJput7hC6FxsPYGKUU" | wrangler secret put STORY_WRITER_AGENT_ID
echo "agent_011CZsoJrNgnHEmra7JYpZyA" | wrangler secret put REVIEWER_AGENT_ID
echo "agent_011CZsoJt3QRt9xiD7tyFyHq" | wrangler secret put SECURITY_AGENT_ID
echo "agent_011CZsoJuibxnqrtNKEN3k9Y" | wrangler secret put IMPLEMENTER_AGENT_ID

# GitHub token for repo cloning inside agent containers
echo "ghp_REDACTED" | wrangler secret put GITHUB_TOKEN

# Linear webhook signing secret (from Planner app — see "Credentials you need to collect")
echo "<LINEAR_WEBHOOK_SECRET>" | wrangler secret put LINEAR_WEBHOOK_SECRET

# MCP Vault IDs (empty for now — MCP OAuth vault setup is a separate step)
echo "" | wrangler secret put LINEAR_VAULT_ID
echo "" | wrangler secret put GITHUB_VAULT_ID
```

### Step 5: Store the OAuth access token in KV

The Worker needs an OAuth token to post responses back to Linear. Store it keyed by org ID:

```bash
# Get your KV namespace ID from wrangler.toml
KV_ID="<kv-namespace-id-from-wrangler.toml>"

# Get the org ID (see "Credentials you need to collect" step 3)
ORG_ID="<LINEAR_ORG_ID>"

# Store the app token
wrangler kv key put --namespace-id="$KV_ID" "$ORG_ID" "<LINEAR_APP_TOKEN>"
```

### Step 6: Deploy

```bash
wrangler deploy
```

### Step 7: Verify deployment

```bash
# Check the Worker is live
curl -s -o /dev/null -w "%{http_code}" https://linear-agents.eugene-shvab.workers.dev/webhooks/planner
# Should return 405 (Method Not Allowed) because it only accepts POST

# Monitor logs
wrangler tail
```

### Step 8: Test with a real Linear issue

1. Go to Linear → Engineering team → Create new issue
2. Title: `Plan: Add CSV export for merchant transaction history`
3. Assign to: **Planner**
4. Watch `wrangler tail` for the webhook delivery and agent dispatch
5. The Planner agent should respond in the Linear issue with a structured plan

## Architecture

```
Linear issue → assign to agent
  ↓
Linear sends AgentSessionEvent webhook (5s ack deadline)
  ↓
Cloudflare Worker (/webhooks/<agent-name>)
  ├── Verify HMAC signature
  ├── Acknowledge session ("Analyzing issue...")
  ├── Extract agent name from URL path
  └── ctx.waitUntil() → async dispatch:
        ↓
      Anthropic Managed Agent
        ├── Create session (agent ID + environment ID)
        ├── Send issue as user message
        ├── Stream SSE events until idle
        └── Collect final text
        ↓
      Post result back to Linear as agent Response
```

## File structure

```
linear-agents/
├── src/
│   ├── index.ts                 # Entry: webhook routing → 6 agent paths
│   ├── types.ts                 # Env, AgentName, AgentContext, LinearClient
│   ├── agents/
│   │   └── managed.ts           # Unified handler: prompt builder + dispatch + result posting
│   └── shared/
│       ├── webhook.ts           # Path extraction, HMAC verification, payload parsing
│       ├── linear.ts            # GraphQL: acknowledge, postResponse, postError
│       └── managed-agent.ts     # Anthropic: create session, send message, SSE stream, archive
├── package.json
├── tsconfig.json
└── wrangler.toml
```

## Known limitation: per-app webhook secrets

Each Linear OAuth app has its own unique webhook signing secret. The Worker currently uses a single `LINEAR_WEBHOOK_SECRET`. This means:

- **For the POC**: Only use the Planner's signing secret. Only the Planner webhook will pass signature verification. The other 5 agents will get "Invalid signature" errors.
- **To fix for production**: Modify `src/shared/webhook.ts` to look up the correct secret per agent name from KV, or modify the Worker to accept a secret-per-route in the Env.

A quick fix if you want all 6 agents working immediately: disable signature verification temporarily (remove the HMAC check in `src/index.ts`) for testing. Re-enable with per-agent secrets before production.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `405 Method Not Allowed` on GET | Normal — Worker only accepts POST | Use POST or assign via Linear |
| `401 Missing signature` | Webhook doesn't include `linear-signature` header | Check Linear app webhook config |
| `401 Invalid signature` | Wrong `LINEAR_WEBHOOK_SECRET` for this app | Use the matching app's signing secret |
| `500 No access token` | Org ID mismatch in KV | Verify `ORG_ID` matches what Linear sends |
| Agent never responds | `waitUntil` timed out (free plan = 30s limit) | Upgrade to paid Workers plan ($5/mo) |
| `Anthropic API error 401` | Bad API key | Re-check `ANTHROPIC_API_KEY` |
| `Anthropic API error 404` | Wrong agent or environment ID | Verify IDs match what was created |

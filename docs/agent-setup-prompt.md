# Linear Agents — Deployment Prompt

You are setting up a Cloudflare Worker that connects Linear (project management) to Anthropic's Managed Agents. When a Linear issue is assigned to an agent, a webhook fires → the Worker dispatches to a Managed Agent on Anthropic's infrastructure → the agent does deep autonomous work (cloning repos, reading code, planning, implementing) → posts results back to Linear.

## What's already done

1. **6 Managed Agents created on Anthropic** (via API):

   | Agent            | ID                                      | Model  |
   |------------------|-----------------------------------------|--------|
   | Planner          | `agent_011CZsoJmU1ZNnRPXtKoSRME`       | Sonnet |
   | Triager          | `agent_011CZsoJoHePK3aifHAkoM9W`       | Sonnet |
   | Story Writer     | `agent_011CZsoJput7hC6FxsPYGKUU`       | Sonnet |
   | Code Reviewer    | `agent_011CZsoJrNgnHEmra7JYpZyA`       | Sonnet |
   | Security Auditor | `agent_011CZsoJt3QRt9xiD7tyFyHq`       | Opus   |
   | Implementer      | `agent_011CZsoJuibxnqrtNKEN3k9Y`       | Sonnet |

   Environment: `env_01Seeqvszf8jmJQyKjdrKeDs`

2. **6 Linear OAuth apps registered** with webhooks:

   | App              | Webhook URL                                                              |
   |------------------|--------------------------------------------------------------------------|
   | Planner          | `https://linear-agents.eugene-shvab.workers.dev/webhooks/planner`        |
   | Triager          | `https://linear-agents.eugene-shvab.workers.dev/webhooks/triager`        |
   | Story Writer     | `https://linear-agents.eugene-shvab.workers.dev/webhooks/story-writer`   |
   | Code Reviewer    | `https://linear-agents.eugene-shvab.workers.dev/webhooks/reviewer`       |
   | Security Auditor | `https://linear-agents.eugene-shvab.workers.dev/webhooks/security`       |
   | Implementer      | `https://linear-agents.eugene-shvab.workers.dev/webhooks/implementer`    |

   All apps subscribe to: "Agent session events" and "Permission changes".

3. **Worker source code written** — ready to deploy. Located in `stowe-io/linear-agents-src/`.

## What you need to do

### Step 1: Copy source files to the linear-agents repo

The Worker code lives at: `/Users/yauhenshvab/Work/linear-agents`
The new source files are at: `<stowe-io-repo>/linear-agents-src/`

```bash
cd /Users/yauhenshvab/Work/linear-agents

# Back up current src if it exists
[ -d src ] && mv src src.backup.$(date +%s)

# Copy new source files
cp -r <stowe-io-path>/linear-agents-src/src ./src
cp <stowe-io-path>/linear-agents-src/package.json ./package.json
cp <stowe-io-path>/linear-agents-src/tsconfig.json ./tsconfig.json
# Only copy wrangler.toml if you don't already have one with your KV namespace ID
# cp <stowe-io-path>/linear-agents-src/wrangler.toml ./wrangler.toml
```

### Step 2: Update wrangler.toml

Your `wrangler.toml` must have:
```toml
name = "linear-agents"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "OAUTH_TOKENS"
id = "<your-actual-kv-namespace-id>"

[vars]
GITHUB_REPO_OWNER = "stowe-io"
GITHUB_REPO_NAME = "stowe-io"
```

If you don't have a KV namespace yet, create one:
```bash
wrangler kv namespace create OAUTH_TOKENS
# Save the returned ID and put it in wrangler.toml
```

### Step 3: Install dependencies

```bash
npm install
```

### Step 4: Typecheck

```bash
npx tsc --noEmit
```

Fix any type errors. The source is written for `@cloudflare/workers-types`. Common issues:
- If `KVNamespace` is not found, ensure `@cloudflare/workers-types` is in devDependencies and `tsconfig.json` includes it in `types`.
- If `ExecutionContext` is not found, same fix.

### Step 5: Set Cloudflare Worker secrets

Run each of these and paste the value when prompted:

```bash
# Anthropic
wrangler secret put ANTHROPIC_API_KEY
# paste your Anthropic API key

wrangler secret put ANTHROPIC_ENVIRONMENT_ID
# paste: env_01Seeqvszf8jmJQyKjdrKeDs

# Agent IDs
wrangler secret put PLANNER_AGENT_ID
# paste: agent_011CZsoJmU1ZNnRPXtKoSRME

wrangler secret put TRIAGER_AGENT_ID
# paste: agent_011CZsoJoHePK3aifHAkoM9W

wrangler secret put STORY_WRITER_AGENT_ID
# paste: agent_011CZsoJput7hC6FxsPYGKUU

wrangler secret put REVIEWER_AGENT_ID
# paste: agent_011CZsoJrNgnHEmra7JYpZyA

wrangler secret put SECURITY_AGENT_ID
# paste: agent_011CZsoJt3QRt9xiD7tyFyHq

wrangler secret put IMPLEMENTER_AGENT_ID
# paste: agent_011CZsoJuibxnqrtNKEN3k9Y

# Linear webhook signature verification
wrangler secret put LINEAR_WEBHOOK_SECRET
# paste the signing secret from one of the Linear OAuth apps
# IMPORTANT: All 6 apps have different signing secrets. The Worker currently
# uses a single LINEAR_WEBHOOK_SECRET. For the POC, use the Planner's signing
# secret. For production, you'll need per-app secrets or a shared one.

# GitHub token for repo cloning inside agent containers
wrangler secret put GITHUB_TOKEN
# paste a GitHub PAT with `repo` scope for stowe-io/stowe-io

# MCP Vault IDs (can be empty strings for now — MCP auth setup is separate)
wrangler secret put LINEAR_VAULT_ID
wrangler secret put GITHUB_VAULT_ID
```

### Step 6: Authorize the OAuth apps and store tokens

Each Linear OAuth app needs an access token stored in KV so the Worker can post back to Linear.

For each app, go to its settings page in Linear:
  Settings → API → [App name] → "Create & copy token" (under Developer token)

Then store it in KV. You need your organization ID and KV namespace ID:

```bash
# Get your org ID from Linear (Settings → Workspace → look at URL or use API)
# It looks like a UUID: e.g., "abc12345-6789-..."

# Store the token — all apps share the same org, so one token should work
# But each app gets its own token. Use the one from the app that will be
# invoked first (e.g., Planner) for testing:
wrangler kv key put --namespace-id="<kv-namespace-id>" "<org-id>" "<access-token>"
```

**IMPORTANT about webhook secrets**: Each OAuth app in Linear gets its own webhook signing secret. The current Worker uses a single `LINEAR_WEBHOOK_SECRET` env var. This means signature verification will only work for whichever app's secret you store. 

For the POC, you have two options:
1. Use one app's secret and only test that agent
2. Modify the Worker to look up the correct secret per agent (requires code change)

For production, you should either:
- Store per-agent secrets in KV and look them up by path
- Or configure all apps to use the same custom secret (if Linear supports it)

### Step 7: Deploy

```bash
wrangler deploy
```

### Step 8: Test

Create a test issue in Linear and assign it to the Planner agent:
1. Go to Linear → Engineering → New Issue
2. Title: "Plan: Add CSV export for merchant transaction history"
3. Assign to: Planner
4. Watch for the agent's response in the issue activity

Monitor logs:
```bash
wrangler tail
```

---

## Architecture overview

```
Linear issue assigned to agent
  → Linear sends AgentSessionEvent webhook (5s ack deadline)
  → Cloudflare Worker receives at /webhooks/<agent-name>
  → Worker verifies HMAC signature
  → Worker acknowledges session (posts "Analyzing issue..." thought)
  → Worker dispatches to Anthropic Managed Agent:
    1. Creates a session with the agent's ID + environment ID
    2. Sends the issue title/description as a user message
    3. Streams SSE events until the agent finishes
    4. Collects the final text output
  → Worker posts result back to Linear as agent Response
```

## File structure

```
linear-agents/
├── src/
│   ├── index.ts                 # Worker entry: route webhooks → agents
│   ├── types.ts                 # Env, AgentName, AgentContext, etc.
│   ├── agents/
│   │   └── managed.ts           # Unified handler: builds prompt, calls Managed Agent, posts result
│   └── shared/
│       ├── webhook.ts           # Extract agent from URL path, verify HMAC signature, parse payload
│       ├── linear.ts            # Linear GraphQL client: acknowledge, postResponse, postError
│       └── managed-agent.ts     # Anthropic API: create session, send message, stream events, archive
├── package.json
├── tsconfig.json
├── wrangler.toml
└── SETUP.md
```

## Known issues & limitations

1. **Webhook secret mismatch**: Single `LINEAR_WEBHOOK_SECRET` won't match all 6 apps. Fix: store per-app secrets in KV or use a shared secret.

2. **`ctx.waitUntil()` timeout**: Free Cloudflare plans cap at 30 seconds. Managed Agent sessions for deep work (Implementer, Security) can take 5-15 minutes. **You need a paid Workers plan** ($5/mo) for the 15-minute limit. Or switch to Durable Objects for unbounded async.

3. **MCP Vault auth**: The agents have MCP server configs for Linear and GitHub, but OAuth vault setup isn't complete yet. The agents can still work by cloning repos via GITHUB_TOKEN and posting results through the Worker (not MCP). MCP gives them *direct* access to Linear/GitHub APIs, which is better but not blocking for the POC.

4. **OAuth token sharing**: The Worker stores one OAuth token per organization. If different agents need different scopes, you'd need per-app tokens in KV (keyed by `<org-id>:<agent-name>`).

## Troubleshooting

- **"No access token" error**: The org ID in the webhook payload doesn't match what you stored in KV. Check your org ID.
- **"Invalid signature" error**: The webhook signing secret doesn't match the app that sent the webhook. See the note about per-app secrets above.
- **Agent session hangs**: Check `wrangler tail` for errors. Common: Anthropic API key invalid, agent ID wrong, environment ID wrong.
- **"Managed Agent session terminated unexpectedly"**: The agent hit an error during execution. Check the Anthropic console for session logs.
- **Linear says "Agent didn't respond"**: The Worker didn't acknowledge within 5 seconds. Check if the Worker is deployed and the webhook URL is correct.

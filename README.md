# Linear Agents

Three dedicated Linear Agents (Planner, Triager, Compliance Reviewer) running as a single Cloudflare Worker.

## Architecture

Each agent is a separate OAuth app in Linear, routing to a single Worker via different webhook paths. Agents receive issue assignments, analyze using Claude API + GitHub repo context, and post results back as Linear agent activities.

## Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)
- GitHub personal access token with `repo` scope
- Anthropic API key
- Linear workspace admin access

## POC Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create KV namespace

```bash
wrangler kv namespace create OAUTH_TOKENS
```

Copy the returned `id` into `wrangler.toml` replacing `PLACEHOLDER_REPLACE_AFTER_KV_CREATE`.

### 3. Set secrets

```bash
wrangler secret put LINEAR_CLIENT_SECRET
wrangler secret put LINEAR_WEBHOOK_SECRET
wrangler secret put CLAUDE_API_KEY
wrangler secret put GITHUB_TOKEN
```

### 4. Configure target repo

Edit `wrangler.toml` vars:

```toml
[vars]
GITHUB_REPO_OWNER = "your-org"
GITHUB_REPO_NAME = "your-repo"
```

### 5. Deploy

```bash
wrangler deploy
```

Note the URL: `https://linear-agents.<subdomain>.workers.dev`

### 6. Register agents in Linear

Go to Linear > Settings > API > Applications > New Application.

Create three apps:

| Agent | Webhook URL |
|-------|------------|
| Planner | `https://linear-agents.<subdomain>.workers.dev/webhooks/planner` |
| Triager | `https://linear-agents.<subdomain>.workers.dev/webhooks/triager` |
| Compliance Reviewer | `https://linear-agents.<subdomain>.workers.dev/webhooks/compliance` |

For each:
1. Set name and icon
2. Enable webhooks > select "Agent session events"
3. Authorize with `actor=app` appended to the OAuth URL
4. Request scopes: `app:assignable`, `app:mentionable`

### 7. Store OAuth tokens

After authorizing each app, store the access token in KV:

```bash
wrangler kv key put --namespace-id=<your-kv-id> "<organization-id>" "<access-token>"
```

### 8. Test

Create an issue in Linear, assign to the Planner agent. You should see a "thinking..." activity followed by the plan.

## Local Development

```bash
cat > .dev.vars << 'EOF'
LINEAR_WEBHOOK_SECRET=your-secret
LINEAR_CLIENT_SECRET=your-secret
CLAUDE_API_KEY=your-key
GITHUB_TOKEN=your-token
EOF

wrangler dev
```

## Devops Handoff

When ready for production:

- **Secrets:** Move from `wrangler secret put` to Vault / 1Password CI
- **CI/CD:** Add `wrangler deploy` to CI on push to main
- **Monitoring:** Alert on Worker errors via Cloudflare dashboard
- **Custom domain:** Route through custom domain instead of `workers.dev`
- **Environments:** Use `wrangler.toml` `[env.production]` / `[env.staging]`

## Agent Prompts

System prompts live in `prompts/` as Markdown files. Edit them to change agent behavior. Prompts are bundled at deploy time — redeploy after changes.

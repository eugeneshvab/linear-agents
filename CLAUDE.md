# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Local dev server (wrangler dev)
npm run deploy       # Deploy to Cloudflare Workers
npm run typecheck    # TypeScript type checking (tsc --noEmit)
```

No test framework is configured. There are no lint or format commands.

Local development requires a `.dev.vars` file with secrets (see SETUP.md for the full list).

## Architecture

This is a **Cloudflare Worker** that bridges **Linear** (issue tracker) with **Anthropic Managed Agents**. When a Linear issue is assigned to an AI agent, a webhook fires, and this worker dispatches the task to an Anthropic Managed Agent that analyzes the issue and posts results back to Linear.

### Request Flow

```
Linear webhook POST /webhooks/{agent-name}
  -> index.ts: route, parse payload, acknowledge session, dispatch async
    -> agents/managed.ts: build task message from issue data, call runManagedAgent()
      -> shared/managed-agent.ts: create Anthropic session, stream SSE events, collect response
    -> shared/linear.ts: post response back, mark session complete
```

The Worker returns 200 immediately after acknowledging; agent execution happens via `executionCtx.waitUntil()`.

### Key Modules

- **`src/index.ts`** — Worker entry point. Routes `/webhooks/{agent-name}` to the correct Managed Agent ID. Has a `/debug` endpoint for raw payload inspection.
- **`src/types.ts`** — All type definitions. `AgentName` union, `Env` (Cloudflare bindings), `WebhookPayload`, `AgentContext`.
- **`src/agents/managed.ts`** — Agent dispatcher. Constructs the task message from Linear issue fields (title, description, comments, context) and handles the response/error lifecycle.
- **`src/shared/managed-agent.ts`** — Anthropic Managed Agents API wrapper. Manages full session lifecycle: create -> stream -> collect text -> delete. Uses separate beta headers for API calls (`managed-agents-2026-04-01`) vs SSE stream (`agent-api-2026-03-01`).
- **`src/shared/linear.ts`** — Linear GraphQL client. Four operations: acknowledge (thought), post response, complete session, post error.
- **`src/shared/webhook.ts`** — Webhook parsing with resilient field extraction (Linear nests data differently across webhook types). HMAC-SHA256 signature verification (currently logging-only, not enforced).

### Agent Types

Six agents, each with its own Managed Agent ID and webhook path: `planner`, `triager`, `reviewer`, `security`, `story-writer`, `implementer`. Agent IDs are stored as Cloudflare secrets (e.g., `PLANNER_AGENT_ID`). The actual agent logic/prompts live in Anthropic's Managed Agent system, not in this repo.

### OAuth Token Resolution

Per-agent tokens are checked first (`{orgId}:{agentName}`), falling back to org-level tokens (`{orgId}`) in the `OAUTH_TOKENS` KV namespace.

## Important Context

- The Anthropic Managed Agents API requires opening the SSE stream *before* sending the user message (stream, then POST events).
- Webhook signature verification is temporarily disabled for debugging — re-enabling is a TODO.
- The GitHub token is injected into the agent's task message (not via API auth) so the Managed Agent can clone the repo.
- `GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` are set in `wrangler.toml` vars but the repo URL is currently hardcoded in `managed-agent.ts`.

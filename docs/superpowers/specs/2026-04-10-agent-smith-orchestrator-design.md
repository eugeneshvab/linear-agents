# Agent Smith: Orchestration Agent Design

**Date:** 2026-04-10
**Status:** Approved

## Overview

Agent Smith is a new Anthropic Managed Agent that serves as the orchestration layer for the Stowe multi-agent delivery system. When a Linear issue is assigned to Agent Smith, it analyzes the work, decides which specialist agents to involve, delegates via Linear issue assignments, reviews each phase's output, and delivers a final summary.

## Goals

- Single entry point for issue delivery — assign to Agent Smith, it handles the rest
- Dynamic routing — Agent Smith chooses the right workflow based on issue content
- Visible coordination — all handoffs happen via Linear comments, so humans can observe and intervene
- Superpowers-style discipline — all agents gain structured workflows (brainstorming, TDD, verification) via uploaded skills

## Architecture

### Orchestration Pattern: Linear-Native Ping-Pong

```
User assigns issue to Agent Smith
  -> Agent Smith analyzes issue, posts workflow plan
  -> Assigns to first specialist (e.g., stowe-planner)
  -> Specialist completes work, posts output, reassigns to Agent Smith
  -> Agent Smith reviews output, decides next step
  -> Assigns to next specialist (e.g., stowe-implementer)
  -> ... repeat until all phases complete ...
  -> Agent Smith posts final summary, marks session done
```

All coordination happens through Linear issue comments and assignments. The existing webhook system (`POST /webhooks/{agent-name}`) handles each handoff. No Anthropic multi-agent API required.

### Agent Smith Configuration

| Field | Value |
|-------|-------|
| **Name** | Agent Smith |
| **Model** | claude-sonnet-4-6 (standard speed) |
| **Environment** | stowe-analysis (`env_01Bu5NEkmtHtF2n77Fy4AZHD`) |
| **MCP Servers** | Linear (`https://mcp.linear.app/mcp`), GitHub (`https://api.githubcopilot.com/mcp/`) |
| **Tools** | `agent_toolset_20260401` + MCP toolsets |
| **Skills** | brainstorming, writing-plans, verification-before-completion |
| **Webhook path** | `/webhooks/agent-smith` |

### Available Specialist Agents

| Agent | Role | Skills to Add |
|-------|------|---------------|
| stowe-planner | Requirements breakdown, implementation plans | writing-plans |
| stowe-implementer | Code implementation, PRs | executing-plans, TDD, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review |
| stowe-code-reviewer | Code quality and correctness review | verification-before-completion |
| stowe-security-auditor | Security analysis and vulnerability review | verification-before-completion |
| stowe-researcher | Research questions, architecture investigation | writing-plans |
| stowe-triager | Issue categorization and prioritization | (none) |

## Dynamic Routing Rules

Agent Smith reads the issue (title, description, labels, comments) and selects a workflow:

| Issue Type | Workflow |
|------------|----------|
| Feature request | Planner -> Implementer -> Code Reviewer |
| Bug fix | Implementer -> Code Reviewer |
| Security concern | Security Auditor -> Implementer -> Code Reviewer |
| Research / question | Researcher (single step) |
| Needs triage | Triager (single step) |
| Complex feature | Planner -> Implementer -> Security Auditor -> Code Reviewer |

Agent Smith infers the issue type from content, labels, and context. It posts its chosen workflow in the first comment so humans can override before it proceeds.

## Handoff Protocol

### Agent Smith -> Specialist Agent

Agent Smith posts a structured comment before reassigning:

```markdown
## Workflow Assignment
**Phase:** [phase name] ([N] of [total])
**Workflow:** [full workflow sequence]
**Instructions:** [specific guidance for this phase]

## Context from Previous Phases
[cumulative output from prior specialists, or "None — this is the first phase"]
```

Then assigns the issue to the specialist agent via Linear MCP.

### Specialist Agent -> Agent Smith (handback)

The specialist posts its output and reassigns back to Agent Smith:

```markdown
## Phase Complete: [phase name]
**Status:** Done | Blocked
**Summary:** [1-2 sentence summary]
**Output:** [detailed output — plan, PR link, review findings, etc.]
**Blockers:** [any blockers, or "None"]
```

### Agent Smith on Receiving Handback

1. Read the specialist's output comment
2. Evaluate: was the phase successful?
3. If blocked: post the blocker context, leave issue for human intervention
4. If successful: carry forward cumulative context, assign to next agent
5. If all phases complete: post final summary, mark session done

### Termination Conditions

- All planned phases complete -> final summary posted
- Specialist reports a blocker -> Agent Smith surfaces it, waits for human
- Agent Smith determines no further phases needed (e.g., trivial fix after implementer)

## Skills Integration

### Skills to Upload via Anthropic Skills API

Upload 8 superpowers skills using `ant beta:skills create --file <dir>`:

| Skill | Files to Include | Files to Exclude |
|-------|-----------------|-----------------|
| brainstorming | SKILL.md, spec-document-reviewer-prompt.md, visual-companion.md | scripts/ (local HTTP server, won't work in container) |
| writing-plans | SKILL.md, plan-document-reviewer-prompt.md | (none) |
| executing-plans | SKILL.md | (none) |
| systematic-debugging | SKILL.md, condition-based-waiting.md, defense-in-depth.md, root-cause-tracing.md | find-polluter.sh, condition-based-waiting-example.ts, test-*.md, CREATION-LOG.md |
| test-driven-development | SKILL.md, testing-anti-patterns.md | (none) |
| verification-before-completion | SKILL.md | (none) |
| requesting-code-review | SKILL.md, code-reviewer.md | (none) |
| receiving-code-review | SKILL.md | (none) |

### Skills Not Uploaded

| Skill | Reason |
|-------|--------|
| dispatching-parallel-agents | Relies on Claude Code subagent dispatch |
| subagent-driven-development | Relies on Claude Code subagent dispatch |
| using-git-worktrees | No git worktree support in container |
| finishing-a-development-branch | Container doesn't have persistent branches |
| using-superpowers | Meta-skill for Claude Code skill dispatch mechanism |
| writing-skills | Meta-skill for authoring skills |

### Skill Assignment to Agents

After upload, update each agent via `ant beta:agents update` to reference skill IDs:

- **Agent Smith:** brainstorming, writing-plans, verification-before-completion
- **stowe-planner:** writing-plans, verification-before-completion
- **stowe-implementer:** executing-plans, systematic-debugging, test-driven-development, verification-before-completion, requesting-code-review, receiving-code-review
- **stowe-code-reviewer:** verification-before-completion
- **stowe-security-auditor:** verification-before-completion
- **stowe-researcher:** writing-plans, verification-before-completion
- **stowe-triager:** (none)

## Agent Smith System Prompt

```
You are Agent Smith, the orchestration agent for the Stowe business banking platform.

## Your Role

You coordinate issue delivery by analyzing incoming Linear issues, planning workflows,
and delegating to specialist agents via Linear issue assignments. You never write code
yourself — you analyze, plan, delegate, review, and summarize.

## Available Specialist Agents

- stowe-planner: Breaks down requirements into detailed implementation plans
- stowe-implementer: Writes code, runs tests, creates pull requests
- stowe-code-reviewer: Reviews code for quality, correctness, and maintainability
- stowe-security-auditor: Security analysis, vulnerability detection, compliance review
- stowe-researcher (webhook name: story-writer): Research questions, architecture investigation, technical analysis
- stowe-triager: Issue categorization, prioritization, and initial assessment

## Workflow Decision Rules

Analyze the issue content (title, description, labels, comments) and select a workflow:

- **Feature request:** Planner -> Implementer -> Code Reviewer
- **Bug fix:** Implementer -> Code Reviewer
- **Security concern:** Security Auditor -> Implementer -> Code Reviewer
- **Research / question:** Researcher (single step)
- **Needs triage / unclear:** Triager (single step)
- **Complex feature (large scope, security-sensitive):** Planner -> Implementer -> Security Auditor -> Code Reviewer

If the issue type is ambiguous, default to: Planner -> Implementer -> Code Reviewer.

## On First Assignment (New Issue)

1. Read the issue thoroughly — title, description, all comments, labels
2. Decide the issue type and appropriate workflow
3. Post a comment with your analysis and chosen workflow:

   ## Issue Analysis
   **Type:** [feature / bug / security / research / triage]
   **Workflow:** [Agent1] -> [Agent2] -> [Agent3]
   **Rationale:** [why this workflow fits]

4. Assign the issue to the first specialist agent

## On Handback (Reassigned Back to You)

1. Read the specialist's latest comment for their output
2. Evaluate: was the phase successful?
3. If the specialist reported a blocker:
   - Post a comment surfacing the blocker with context
   - Leave the issue unassigned for human intervention
4. If successful and more phases remain:
   - Carry forward cumulative context from all prior phases
   - Post a Workflow Assignment comment (see protocol below)
   - Assign to the next specialist
5. If all phases are complete:
   - Post a final summary of everything delivered
   - Mark the session complete

## Handoff Comment Format (When Assigning to Specialist)

   ## Workflow Assignment
   **Phase:** [phase name] ([N] of [total])
   **Workflow:** [full sequence]
   **Instructions:** [specific guidance for this phase]

   ## Context from Previous Phases
   [cumulative output from prior specialists]

## Completion Summary Format

   ## Delivery Complete
   **Issue:** [title]
   **Workflow Executed:** [agents involved]
   **Phases:**
   1. [Phase 1]: [summary]
   2. [Phase 2]: [summary]
   ...
   **Result:** [what was delivered — PR link, findings, plan, etc.]

## Important Rules

- Never write code yourself — always delegate to the appropriate specialist
- Always post your workflow plan before starting delegation
- Carry forward ALL context between phases — specialists need prior output
- If a human comments mid-workflow, read their input and adjust the plan
- If you're unsure which workflow fits, ask in a comment before proceeding
- Keep your comments concise but complete — they are the coordination record
```

## Worker Code Changes

### src/types.ts

Add to `AgentName` union:
```typescript
export type AgentName = "planner" | "triager" | "reviewer" | "security" | "story-writer" | "implementer" | "agent-smith";
```

Add to `Env` interface:
```typescript
AGENT_SMITH_AGENT_ID: string;
```

### src/index.ts

Add to `getAgentId()` map:
```typescript
"agent-smith": env.AGENT_SMITH_AGENT_ID,
```

### src/shared/webhook.ts

Add to `VALID_AGENTS` set:
```typescript
const VALID_AGENTS = new Set<string>([
  "planner", "triager", "reviewer", "security", "story-writer", "implementer", "agent-smith",
]);
```

### Cloudflare Secret

```bash
wrangler secret put AGENT_SMITH_AGENT_ID
```

## Linear Setup

Register a new Linear OAuth application:
- **Name:** Agent Smith
- **Webhook URL:** `https://linear-agents.<subdomain>.workers.dev/webhooks/agent-smith`
- **Webhook events:** Agent session events
- **OAuth scopes:** `app:assignable`, `app:mentionable`
- **Store OAuth token** in `OAUTH_TOKENS` KV: key `{organizationId}:agent-smith`
- **Store webhook secret** in `OAUTH_TOKENS` KV: key `webhook_secret:agent-smith`

## Implementation Order

1. Upload superpowers skills via Skills API
2. Create Agent Smith via `ant beta:agents create`
3. Update existing stowe-* agents to add skills
4. Update worker code (types, routing, valid agents)
5. Deploy worker
6. Register Linear OAuth app and store tokens
7. Test end-to-end: assign an issue to Agent Smith, verify the full loop

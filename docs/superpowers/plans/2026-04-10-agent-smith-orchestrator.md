# Agent Smith Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an orchestrator Managed Agent ("Agent Smith") that coordinates issue delivery across specialist agents via Linear, with superpowers skills uploaded and distributed to all agents.

**Architecture:** Agent Smith receives Linear issues, dynamically routes them through specialist agents (planner, implementer, reviewer, etc.) via Linear assignments, reviews each phase's output, and delivers final summaries. All agents gain superpowers-style discipline via uploaded skills.

**Tech Stack:** Cloudflare Workers (TypeScript), Anthropic Managed Agents API, Anthropic Skills API, Linear MCP, ant CLI

---

### Task 1: Stage Superpowers Skills for Upload

Prepare clean copies of the 8 skills to upload, excluding files that won't work in a Managed Agent container (shell scripts, TypeScript files, creation logs).

**Files:**
- Create: `scripts/stage-skills.sh`

- [ ] **Step 1: Create the staging script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SKILLS_SRC="$HOME/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills"
STAGING="/tmp/superpowers-skills-staging"

rm -rf "$STAGING"
mkdir -p "$STAGING"

# 1. brainstorming — skip scripts/ directory
mkdir -p "$STAGING/brainstorming/brainstorming"
cp "$SKILLS_SRC/brainstorming/SKILL.md" "$STAGING/brainstorming/brainstorming/"
cp "$SKILLS_SRC/brainstorming/spec-document-reviewer-prompt.md" "$STAGING/brainstorming/brainstorming/"
cp "$SKILLS_SRC/brainstorming/visual-companion.md" "$STAGING/brainstorming/brainstorming/"

# 2. writing-plans
mkdir -p "$STAGING/writing-plans/writing-plans"
cp "$SKILLS_SRC/writing-plans/SKILL.md" "$STAGING/writing-plans/writing-plans/"
cp "$SKILLS_SRC/writing-plans/plan-document-reviewer-prompt.md" "$STAGING/writing-plans/writing-plans/"

# 3. executing-plans
mkdir -p "$STAGING/executing-plans/executing-plans"
cp "$SKILLS_SRC/executing-plans/SKILL.md" "$STAGING/executing-plans/executing-plans/"

# 4. systematic-debugging — skip .sh, .ts, test-*, CREATION-LOG.md
mkdir -p "$STAGING/systematic-debugging/systematic-debugging"
cp "$SKILLS_SRC/systematic-debugging/SKILL.md" "$STAGING/systematic-debugging/systematic-debugging/"
cp "$SKILLS_SRC/systematic-debugging/condition-based-waiting.md" "$STAGING/systematic-debugging/systematic-debugging/"
cp "$SKILLS_SRC/systematic-debugging/defense-in-depth.md" "$STAGING/systematic-debugging/systematic-debugging/"
cp "$SKILLS_SRC/systematic-debugging/root-cause-tracing.md" "$STAGING/systematic-debugging/systematic-debugging/"

# 5. test-driven-development
mkdir -p "$STAGING/test-driven-development/test-driven-development"
cp "$SKILLS_SRC/test-driven-development/SKILL.md" "$STAGING/test-driven-development/test-driven-development/"
cp "$SKILLS_SRC/test-driven-development/testing-anti-patterns.md" "$STAGING/test-driven-development/test-driven-development/"

# 6. verification-before-completion
mkdir -p "$STAGING/verification-before-completion/verification-before-completion"
cp "$SKILLS_SRC/verification-before-completion/SKILL.md" "$STAGING/verification-before-completion/verification-before-completion/"

# 7. requesting-code-review
mkdir -p "$STAGING/requesting-code-review/requesting-code-review"
cp "$SKILLS_SRC/requesting-code-review/SKILL.md" "$STAGING/requesting-code-review/requesting-code-review/"
cp "$SKILLS_SRC/requesting-code-review/code-reviewer.md" "$STAGING/requesting-code-review/requesting-code-review/"

# 8. receiving-code-review
mkdir -p "$STAGING/receiving-code-review/receiving-code-review"
cp "$SKILLS_SRC/receiving-code-review/SKILL.md" "$STAGING/receiving-code-review/receiving-code-review/"

echo "Staged 8 skills to $STAGING"
ls -la "$STAGING"/
```

- [ ] **Step 2: Run the staging script**

Run: `bash scripts/stage-skills.sh`

Expected: 8 directories under `/tmp/superpowers-skills-staging/`, each containing a subdirectory with SKILL.md and any supporting .md files.

- [ ] **Step 3: Verify each staged skill has SKILL.md with valid frontmatter**

Run: `for d in /tmp/superpowers-skills-staging/*/; do name=$(basename "$d"); echo "=== $name ==="; head -5 "$d/$name/SKILL.md"; echo; done`

Expected: Each skill shows `---` / `name:` / `description:` / `---` frontmatter.

- [ ] **Step 4: Commit**

```bash
git add scripts/stage-skills.sh
git commit -m "feat: add skill staging script for superpowers upload"
```

---

### Task 2: Upload Skills to Anthropic Skills API

Upload all 8 skills using curl with the `skills-2025-10-02` beta header. Save the returned skill IDs.

**Files:**
- Create: `scripts/upload-skills.sh`

- [ ] **Step 1: Create the upload script**

```bash
#!/usr/bin/env bash
set -euo pipefail

STAGING="/tmp/superpowers-skills-staging"
SKILL_IDS_FILE="/tmp/superpowers-skill-ids.json"

echo "{}" > "$SKILL_IDS_FILE"

upload_skill() {
  local name="$1"
  local dir="$STAGING/$name/$name"
  local display_title="$name"

  echo "Uploading: $name"

  # Build -F arguments for all files in the skill directory
  local file_args=()
  for f in "$dir"/*; do
    local filename="$name/$(basename "$f")"
    file_args+=(-F "files[]=@$f;filename=$filename")
  done

  local response
  response=$(curl -sS "https://api.anthropic.com/v1/skills" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: skills-2025-10-02" \
    -F "display_title=$display_title" \
    "${file_args[@]}")

  local skill_id
  skill_id=$(echo "$response" | jq -r '.id')

  if [[ "$skill_id" == "null" ]] || [[ -z "$skill_id" ]]; then
    echo "ERROR uploading $name: $response"
    return 1
  fi

  echo "  -> $skill_id"

  # Append to JSON file
  local tmp
  tmp=$(jq --arg k "$name" --arg v "$skill_id" '. + {($k): $v}' "$SKILL_IDS_FILE")
  echo "$tmp" > "$SKILL_IDS_FILE"
}

upload_skill "brainstorming"
upload_skill "writing-plans"
upload_skill "executing-plans"
upload_skill "systematic-debugging"
upload_skill "test-driven-development"
upload_skill "verification-before-completion"
upload_skill "requesting-code-review"
upload_skill "receiving-code-review"

echo ""
echo "All skills uploaded. IDs saved to $SKILL_IDS_FILE:"
cat "$SKILL_IDS_FILE"
```

- [ ] **Step 2: Run the upload script**

Run: `bash scripts/upload-skills.sh`

Expected: 8 skills uploaded, each returning a `skill_*` ID. The IDs are saved to `/tmp/superpowers-skill-ids.json`.

- [ ] **Step 3: Verify all skills appear in the API**

Run: `ant beta:skills list --format jsonl | jq -r 'select(.source == "custom") | "\(.display_title) | \(.id)"'`

Expected: 8 custom skills listed with their IDs.

- [ ] **Step 4: Commit**

```bash
git add scripts/upload-skills.sh
git commit -m "feat: add skill upload script for Anthropic Skills API"
```

---

### Task 3: Create Agent Smith Managed Agent

Create the Agent Smith agent via the API with the system prompt, MCP servers, tools, and skills.

**Files:**
- Create: `scripts/create-agent-smith.sh`

- [ ] **Step 1: Create the agent creation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SKILL_IDS_FILE="/tmp/superpowers-skill-ids.json"

# Read skill IDs
BRAINSTORMING_ID=$(jq -r '.brainstorming' "$SKILL_IDS_FILE")
WRITING_PLANS_ID=$(jq -r '.["writing-plans"]' "$SKILL_IDS_FILE")
VERIFICATION_ID=$(jq -r '.["verification-before-completion"]' "$SKILL_IDS_FILE")

SYSTEM_PROMPT='You are Agent Smith, the orchestration agent for the Stowe business banking platform.

## Your Role

You coordinate issue delivery by analyzing incoming Linear issues, planning workflows, and delegating to specialist agents via Linear issue assignments. You never write code yourself — you analyze, plan, delegate, review, and summarize.

## Available Specialist Agents

- stowe-planner: Breaks down requirements into detailed implementation plans
- stowe-implementer: Writes code, runs tests, creates pull requests
- stowe-code-reviewer: Reviews code for quality, correctness, and maintainability
- stowe-security-auditor: Security analysis, vulnerability detection, compliance review
- stowe-researcher (Linear name: story-writer): Research questions, architecture investigation, technical analysis
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
2. Use the Linear MCP tools to fetch full issue details if needed
3. Decide the issue type and appropriate workflow
4. Post a comment with your analysis and chosen workflow:

   ## Issue Analysis
   **Type:** [feature / bug / security / research / triage]
   **Workflow:** [Agent1] -> [Agent2] -> [Agent3]
   **Rationale:** [why this workflow fits]

5. Assign the issue to the first specialist agent using Linear MCP

## On Handback (Reassigned Back to You)

1. Read the specialist'\''s latest comment for their output
2. Evaluate: was the phase successful?
3. If the specialist reported a blocker:
   - Post a comment surfacing the blocker with context
   - Leave the issue unassigned for human intervention
4. If successful and more phases remain:
   - Carry forward cumulative context from all prior phases
   - Post a Workflow Assignment comment (see protocol below)
   - Assign to the next specialist using Linear MCP
5. If all phases are complete:
   - Post a final summary of everything delivered
   - Mark the session complete

## Handoff Comment Format (When Assigning to Specialist)

   ## Workflow Assignment
   **Phase:** [phase name] ([N] of [total])
   **Workflow:** [full sequence]
   **Instructions:** [specific guidance for this phase]

   ## Context from Previous Phases
   [cumulative output from prior specialists, or "None — this is the first phase"]

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
- If a human comments mid-workflow, read their input and adjust the plan accordingly
- If you are unsure which workflow fits, ask in a comment before proceeding
- Keep your comments concise but complete — they are the coordination record'

agent=$(curl -sS --fail-with-body https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d @- <<AGENTEOF
{
  "name": "Agent Smith",
  "model": "claude-sonnet-4-6",
  "system": $(jq -Rs '.' <<< "$SYSTEM_PROMPT"),
  "tools": [
    {"type": "agent_toolset_20260401"},
    {
      "type": "mcp_toolset",
      "mcp_server_name": "linear",
      "permission_policy": {"type": "always_allow"}
    },
    {
      "type": "mcp_toolset",
      "mcp_server_name": "github",
      "permission_policy": {"type": "always_allow"}
    }
  ],
  "mcp_servers": [
    {"name": "linear", "type": "url", "url": "https://mcp.linear.app/mcp"},
    {"name": "github", "type": "url", "url": "https://api.githubcopilot.com/mcp/"}
  ],
  "skills": [
    {"type": "custom", "skill_id": "$BRAINSTORMING_ID", "version": "latest"},
    {"type": "custom", "skill_id": "$WRITING_PLANS_ID", "version": "latest"},
    {"type": "custom", "skill_id": "$VERIFICATION_ID", "version": "latest"}
  ]
}
AGENTEOF
)

AGENT_ID=$(echo "$agent" | jq -r '.id')
AGENT_VERSION=$(echo "$agent" | jq -r '.version')

echo "Agent Smith created!"
echo "  ID:      $AGENT_ID"
echo "  Version: $AGENT_VERSION"
echo ""
echo "Save this ID — you need it for wrangler secret and webhook setup."
echo "  wrangler secret put AGENT_SMITH_AGENT_ID"
echo "  (paste: $AGENT_ID)"
```

- [ ] **Step 2: Run the creation script**

Run: `bash scripts/create-agent-smith.sh`

Expected: Agent created with an `agent_*` ID. Note the ID for later steps.

- [ ] **Step 3: Verify Agent Smith exists**

Run: `ant beta:agents list --format jsonl | jq -r 'select(.name == "Agent Smith") | "\(.name) | \(.id) | v\(.version)"'`

Expected: `Agent Smith | agent_<id> | v1`

- [ ] **Step 4: Commit**

```bash
git add scripts/create-agent-smith.sh
git commit -m "feat: add Agent Smith creation script"
```

---

### Task 4: Update Existing Agents with Skills

Add the appropriate skills to each existing stowe-* agent via `ant beta:agents update`.

**Files:**
- Create: `scripts/update-agents-skills.sh`

- [ ] **Step 1: Create the update script**

```bash
#!/usr/bin/env bash
set -euo pipefail

SKILL_IDS_FILE="/tmp/superpowers-skill-ids.json"

# Read all skill IDs
WRITING_PLANS=$(jq -r '.["writing-plans"]' "$SKILL_IDS_FILE")
EXECUTING_PLANS=$(jq -r '.["executing-plans"]' "$SKILL_IDS_FILE")
SYSTEMATIC_DEBUGGING=$(jq -r '.["systematic-debugging"]' "$SKILL_IDS_FILE")
TDD=$(jq -r '.["test-driven-development"]' "$SKILL_IDS_FILE")
VERIFICATION=$(jq -r '.["verification-before-completion"]' "$SKILL_IDS_FILE")
REQUESTING_CR=$(jq -r '.["requesting-code-review"]' "$SKILL_IDS_FILE")
RECEIVING_CR=$(jq -r '.["receiving-code-review"]' "$SKILL_IDS_FILE")

update_agent() {
  local agent_id="$1"
  local agent_name="$2"
  local skills_json="$3"

  echo "Updating $agent_name ($agent_id)..."

  # Get current version
  local current_version
  current_version=$(curl -sS "https://api.anthropic.com/v1/agents/$agent_id" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" | jq -r '.version')

  local response
  response=$(curl -sS --fail-with-body "https://api.anthropic.com/v1/agents/$agent_id" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d "{\"version\": $current_version, \"skills\": $skills_json}")

  local new_version
  new_version=$(echo "$response" | jq -r '.version')
  echo "  -> v$new_version"
}

# stowe-planner: writing-plans, verification
update_agent "agent_011CZsoJmU1ZNnRPXtKoSRME" "stowe-planner" "[
  {\"type\": \"custom\", \"skill_id\": \"$WRITING_PLANS\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$VERIFICATION\", \"version\": \"latest\"}
]"

# stowe-implementer: executing-plans, systematic-debugging, TDD, verification, requesting-cr, receiving-cr
update_agent "agent_011CZsoJuibxnqrtNKEN3k9Y" "stowe-implementer" "[
  {\"type\": \"custom\", \"skill_id\": \"$EXECUTING_PLANS\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$SYSTEMATIC_DEBUGGING\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$TDD\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$VERIFICATION\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$REQUESTING_CR\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$RECEIVING_CR\", \"version\": \"latest\"}
]"

# stowe-code-reviewer: verification
update_agent "agent_011CZsoJrNgnHEmra7JYpZyA" "stowe-code-reviewer" "[
  {\"type\": \"custom\", \"skill_id\": \"$VERIFICATION\", \"version\": \"latest\"}
]"

# stowe-security-auditor: verification
update_agent "agent_011CZsoJt3QRt9xiD7tyFyHq" "stowe-security-auditor" "[
  {\"type\": \"custom\", \"skill_id\": \"$VERIFICATION\", \"version\": \"latest\"}
]"

# stowe-researcher: writing-plans, verification
update_agent "agent_011CZsoJput7hC6FxsPYGKUU" "stowe-researcher" "[
  {\"type\": \"custom\", \"skill_id\": \"$WRITING_PLANS\", \"version\": \"latest\"},
  {\"type\": \"custom\", \"skill_id\": \"$VERIFICATION\", \"version\": \"latest\"}
]"

# stowe-triager: no skills
echo ""
echo "stowe-triager: no skills to add (skipped)"

echo ""
echo "All agents updated."
```

- [ ] **Step 2: Run the update script**

Run: `bash scripts/update-agents-skills.sh`

Expected: Each agent reports a new version number. The triager is skipped.

- [ ] **Step 3: Verify skills are attached**

Run: `ant beta:agents list --format jsonl | jq -r '"\(.name): \([.skills[]? | .skill_id] | join(", "))"'`

Expected: Each agent shows its assigned skill IDs (except triager which shows empty).

- [ ] **Step 4: Commit**

```bash
git add scripts/update-agents-skills.sh
git commit -m "feat: add script to update existing agents with superpowers skills"
```

---

### Task 5: Update Worker — Add Agent Smith to Types

Add `"agent-smith"` to the `AgentName` union and `AGENT_SMITH_AGENT_ID` to the `Env` interface.

**Files:**
- Modify: `src/types.ts:1` (AgentName union)
- Modify: `src/types.ts:25` (Env interface, after IMPLEMENTER_AGENT_ID)

- [ ] **Step 1: Add agent-smith to AgentName union**

In `src/types.ts` line 1, change:

```typescript
export type AgentName = "planner" | "triager" | "reviewer" | "security" | "story-writer" | "implementer";
```

To:

```typescript
export type AgentName = "planner" | "triager" | "reviewer" | "security" | "story-writer" | "implementer" | "agent-smith";
```

- [ ] **Step 2: Add AGENT_SMITH_AGENT_ID to Env**

In `src/types.ts`, after line 25 (`IMPLEMENTER_AGENT_ID: string;`), add:

```typescript
  AGENT_SMITH_AGENT_ID: string;
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors (the new env field is used in the next task).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add agent-smith to AgentName type and Env interface"
```

---

### Task 6: Update Worker — Add Routing and Valid Agents

Add Agent Smith to the routing map in `index.ts` and the valid agents set in `webhook.ts`.

**Files:**
- Modify: `src/index.ts:13` (getAgentId map, before closing brace)
- Modify: `src/shared/webhook.ts:4` (VALID_AGENTS set)

- [ ] **Step 1: Add agent-smith to getAgentId map**

In `src/index.ts`, inside the `getAgentId()` function's map object, after the `implementer` entry (line 13), add:

```typescript
    "agent-smith": env.AGENT_SMITH_AGENT_ID,
```

The full map should now be:

```typescript
  const map: Record<AgentName, string> = {
    planner: env.PLANNER_AGENT_ID,
    triager: env.TRIAGER_AGENT_ID,
    reviewer: env.REVIEWER_AGENT_ID,
    security: env.SECURITY_AGENT_ID,
    "story-writer": env.STORY_WRITER_AGENT_ID,
    implementer: env.IMPLEMENTER_AGENT_ID,
    "agent-smith": env.AGENT_SMITH_AGENT_ID,
  };
```

- [ ] **Step 2: Add agent-smith to VALID_AGENTS**

In `src/shared/webhook.ts` line 3-5, change:

```typescript
const VALID_AGENTS = new Set<string>([
  "planner", "triager", "reviewer", "security", "story-writer", "implementer",
]);
```

To:

```typescript
const VALID_AGENTS = new Set<string>([
  "planner", "triager", "reviewer", "security", "story-writer", "implementer", "agent-smith",
]);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: No errors. TypeScript enforces that all `AgentName` values are present in the `Record<AgentName, string>` map, so this will fail if the map is incomplete.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/shared/webhook.ts
git commit -m "feat: add agent-smith to webhook routing and valid agents set"
```

---

### Task 7: Deploy Worker and Set Cloudflare Secret

Deploy the updated worker and configure the Agent Smith agent ID as a Cloudflare secret.

**Files:**
- No file changes — deployment and secret configuration only

- [ ] **Step 1: Set the Cloudflare secret**

Run: `wrangler secret put AGENT_SMITH_AGENT_ID`

When prompted, paste the Agent Smith agent ID from Task 3 (e.g., `agent_011CZxx...`).

Expected: `Success! Uploaded secret AGENT_SMITH_AGENT_ID`

- [ ] **Step 2: Deploy the worker**

Run: `npm run deploy`

Expected: Successful deployment to Cloudflare Workers. Output shows the worker URL.

- [ ] **Step 3: Verify the deploy**

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST https://linear-agents.<subdomain>.workers.dev/webhooks/agent-smith`

Expected: `200` (the worker accepts the POST but ignores it because no valid payload). Any non-404 response confirms the route exists.

---

### Task 8: Register Linear OAuth Application for Agent Smith

Register a new Linear application so Agent Smith can receive webhooks and interact via Linear.

**Files:**
- No file changes — Linear console configuration only

- [ ] **Step 1: Create Linear Application**

In Linear Settings > API > Applications > New Application:
- **Name:** Agent Smith
- **Description:** Orchestration agent that coordinates issue delivery across specialist agents
- **Webhook URL:** `https://linear-agents.<subdomain>.workers.dev/webhooks/agent-smith`
- **Webhook events:** Agent session events
- **OAuth scopes:** `app:assignable`, `app:mentionable`

- [ ] **Step 2: Store OAuth token in KV**

After OAuth flow completes, store the token:

```bash
# Per-agent token (replace ORG_ID and TOKEN with actual values)
wrangler kv:key put --namespace-id=4bb06ee7c76447f7b6c688a294500828 \
  "{ORG_ID}:agent-smith" "{OAUTH_TOKEN}"
```

- [ ] **Step 3: Store webhook secret in KV**

```bash
# Webhook secret from Linear app settings (replace SECRET with actual value)
wrangler kv:key put --namespace-id=4bb06ee7c76447f7b6c688a294500828 \
  "webhook_secret:agent-smith" "{WEBHOOK_SECRET}"
```

- [ ] **Step 4: Verify the application appears in Linear**

Go to Linear Settings > API > Applications. Confirm "Agent Smith" appears with status "Active" and the correct webhook URL.

---

### Task 9: End-to-End Test

Create a test issue in Linear, assign it to Agent Smith, and verify the full orchestration loop.

**Files:**
- No file changes — manual testing

- [ ] **Step 1: Create a test issue in Linear**

Create a new issue in the Stowe project:
- **Title:** `[Test] Agent Smith E2E: Add health check endpoint`
- **Description:** `Add a GET /health endpoint to the API that returns {"status": "ok"}. This is a test issue for the Agent Smith orchestrator.`

- [ ] **Step 2: Assign to Agent Smith**

Assign the issue to "Agent Smith" in Linear.

- [ ] **Step 3: Verify Agent Smith's analysis comment**

Expected: Within 30-60 seconds, Agent Smith posts a comment with:
- Issue type analysis (should identify as a small feature/bug fix)
- Chosen workflow (likely: Implementer -> Code Reviewer)
- Rationale

- [ ] **Step 4: Verify handoff to first specialist**

Expected: Agent Smith assigns the issue to the first specialist agent (e.g., stowe-implementer). The specialist's webhook fires and it begins working.

- [ ] **Step 5: Verify handback loop**

Expected: After the specialist completes, it posts output and the issue comes back to Agent Smith. Agent Smith reviews and either assigns to the next agent or posts a final summary.

- [ ] **Step 6: Verify completion**

Expected: Agent Smith posts a "Delivery Complete" summary and the session is marked complete in Linear.

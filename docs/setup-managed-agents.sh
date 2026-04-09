#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Stowe Managed Agents — One-shot setup script
# Run from anywhere. Requires: ANTHROPIC_API_KEY env var, curl, jq
# =============================================================================

API="https://api.anthropic.com/v1"
HEADERS=(
  -H "x-api-key: $ANTHROPIC_API_KEY"
  -H "anthropic-version: 2023-06-01"
  -H "anthropic-beta: managed-agents-2026-04-01"
  -H "content-type: application/json"
)

echo "=== Phase 1: Create Environment ==="

ENV_RESPONSE=$(curl -fsSL "$API/environments" "${HEADERS[@]}" -d '{
  "name": "stowe-dev",
  "config": {
    "type": "cloud",
    "packages": {
      "apt": ["git", "curl", "jq"],
      "npm": ["typescript"],
      "pip": ["anthropic"]
    },
    "networking": {"type": "unrestricted"}
  }
}')

ENVIRONMENT_ID=$(echo "$ENV_RESPONSE" | jq -r '.id')
echo "Environment ID: $ENVIRONMENT_ID"

echo ""
echo "=== Phase 2: Create Agents ==="

# --- Planner ---
echo "Creating Planner..."
PLANNER_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-planner",
  "model": "claude-sonnet-4-6",
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"},
    {"type": "url", "name": "github", "url": "https://api.githubcopilot.com/mcp/"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401"},
    {"type": "mcp_toolset", "mcp_server_name": "linear"},
    {"type": "mcp_toolset", "mcp_server_name": "github"}
  ],
  "system": "You are a technical planner for Stowe, a business banking platform (Platform → Partner → Merchant).\n\nStack: Java 24, Spring Boot 3.4, Spring Data JDBC, PostgreSQL with RLS, React 19 + React Router 7 SSR frontend.\n\nWhen given a Linear issue:\n1. Clone the repo: git clone the stowe-io/stowe-io repo and cd into it\n2. Read AGENTS.md for full architecture context\n3. Explore relevant files — grep for related code, read implementations\n4. Use the brainstorming pattern: explore 2-3 approaches with tradeoffs before recommending one\n5. Produce a structured plan:\n\n### Scope\n[1-2 sentences — what exactly needs to change]\n\n### Affected Areas\n- [file/module]: [what changes and why]\n\n### Approach\n[Step-by-step implementation strategy, ordered by dependency]\n\n### Risks & Considerations\n- [Data migration risks, auth changes, compliance implications]\n\n### Open Questions\n- [Anything unclear that blocks planning]\n\nRules:\n- Reference actual file paths and function names from the codebase\n- Keep plans minimal — YAGNI\n- If the issue is too vague, list what you need clarified\n- For banking/fintech: always flag data migration risks, auth changes, PCI/compliance implications\n- Do NOT write code — only plan\n- After producing the plan, use the Linear MCP to update the issue with the plan and add relevant labels"
}
AGENT
)
PLANNER_ID=$(echo "$PLANNER_RESPONSE" | jq -r '.id')
echo "  Planner ID: $PLANNER_ID"

# --- Triager ---
echo "Creating Triager..."
TRIAGER_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-triager",
  "model": "claude-sonnet-4-6",
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401", "configs": [{"name": "web_fetch", "enabled": false}, {"name": "web_search", "enabled": false}]},
    {"type": "mcp_toolset", "mcp_server_name": "linear"}
  ],
  "system": "You are a technical triager for Stowe, a business banking platform.\n\nStack: Java 24, Spring Boot 3.4, Spring Data JDBC, PostgreSQL, React 19 SSR.\n\nWhen given a Linear issue:\n1. Clone the repo and read AGENTS.md for architecture context\n2. Identify the affected areas by grepping the codebase\n3. Produce a classification:\n\n### Classification\n- **Type:** [bug | feature | enhancement | chore | question]\n- **Severity:** [critical | high | medium | low]\n- **Confidence:** [high | medium | low]\n\n### Affected Modules\n- [module path]: [why it's affected]\n\n### Suggested Labels\n- [label1], [label2]\n\n### Recommended Next Step\n[Who should handle this — e.g., \"Assign to Planner for spec\" or \"Needs product clarification\"]\n\n### Summary\n[2-3 sentences for quick scanning]\n\nRules:\n- Anything touching money, auth, or user data → minimum severity \"high\"\n- If there's an error/stack trace, identify the root module\n- If unclear, classify as \"question\" and recommend clarification\n- After classification, use the Linear MCP to apply labels and update the issue status\n- If routing to another agent, use Linear MCP to reassign the issue"
}
AGENT
)
TRIAGER_ID=$(echo "$TRIAGER_RESPONSE" | jq -r '.id')
echo "  Triager ID: $TRIAGER_ID"

# --- Story Writer ---
echo "Creating Story Writer..."
STORY_WRITER_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-story-writer",
  "model": "claude-sonnet-4-6",
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401"},
    {"type": "mcp_toolset", "mcp_server_name": "linear"}
  ],
  "system": "You are a story writer for Stowe, a business banking platform. You turn rough ideas into well-structured Linear issues that AI coding agents can pick up and implement.\n\nWhen given a rough idea or one-liner:\n1. Clone the repo and read AGENTS.md for architecture context\n2. Explore relevant code areas to understand current state\n3. Research any external concepts if needed (web search)\n4. Produce a complete, implementation-ready story:\n\n### Title\n[Clear, specific title]\n\n### Description\n[2-3 paragraphs explaining what, why, and how it fits]\n\n### Acceptance Criteria\n- [ ] [Specific, testable criterion — happy path and edge cases]\n\n### Technical Notes\n- [Affected files/modules with actual file paths]\n- [Existing patterns to follow]\n- [DB/API/frontend changes needed]\n\n### Edge Cases\n- [What could go wrong, boundary conditions, multi-tenant considerations]\n\n### Out of Scope\n- [What this story does NOT cover]\n\n### Testing Requirements\n- [Backend, frontend, E2E tests needed]\n\nRules:\n- Stories must be specific enough for an AI agent to implement without asking questions\n- Reference actual file paths, component names, and existing patterns\n- Always consider multi-tenancy (Platform/Partner/Merchant)\n- Flag any compliance or security implications\n- After writing the story, use Linear MCP to update the issue with the full content\n- Use Linear MCP to add appropriate labels\n- If the story should be broken into sub-issues, create them via Linear MCP"
}
AGENT
)
STORY_WRITER_ID=$(echo "$STORY_WRITER_RESPONSE" | jq -r '.id')
echo "  Story Writer ID: $STORY_WRITER_ID"

# --- Code Reviewer ---
echo "Creating Code Reviewer..."
REVIEWER_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-code-reviewer",
  "model": "claude-sonnet-4-6",
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"},
    {"type": "url", "name": "github", "url": "https://api.githubcopilot.com/mcp/"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401"},
    {"type": "mcp_toolset", "mcp_server_name": "linear"},
    {"type": "mcp_toolset", "mcp_server_name": "github"}
  ],
  "system": "You are a senior code reviewer for Stowe, a business banking platform.\n\nStack: Java 24, Spring Boot 3.4, Spring Data JDBC, PostgreSQL with RLS, React 19 SSR, Tailwind, Shadcn/ui.\n\nWhen given a PR or issue to review:\n1. Clone the repo and read AGENTS.md for architecture patterns\n2. Use GitHub MCP to read the PR diff if a PR number is provided\n3. If a branch is mentioned, check it out and run git diff main...HEAD\n4. For EACH changed file: read full context, check callers/callees, verify DTO boundaries, check test coverage\n5. Try to compile: cd be && mvn -B compile (backend) or cd fe && npx tsc --noEmit (frontend)\n\nProduce:\n\n### Summary\n[What this PR does in 2-3 sentences]\n\n### Issues Found\n- **[SEVERITY]** `file:line` — description, why it's a problem, suggested fix\n\n### Architecture Compliance\n- [ ] DTO boundary respected\n- [ ] Repository layer correct\n- [ ] Transactions on service methods\n- [ ] Audit events published\n- [ ] RLS considerations\n\n### Test Coverage\n- [Assessment + specific tests to add]\n\n### Verdict\n[APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION]\n\nRules:\n- Be specific — file paths, line numbers, actual code\n- Distinguish blocking issues from nits\n- Check: null safety, error handling, SQL injection, missing validation, snake_case responses\n- Flag auth, RLS, or money calculation changes as high-scrutiny\n- Use GitHub MCP to post review comments directly on the PR\n- Use Linear MCP to update the issue with review findings"
}
AGENT
)
REVIEWER_ID=$(echo "$REVIEWER_RESPONSE" | jq -r '.id')
echo "  Code Reviewer ID: $REVIEWER_ID"

# --- Security Auditor ---
echo "Creating Security Auditor..."
SECURITY_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-security-auditor",
  "model": {"id": "claude-opus-4-6", "speed": "standard"},
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"},
    {"type": "url", "name": "github", "url": "https://api.githubcopilot.com/mcp/"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401"},
    {"type": "mcp_toolset", "mcp_server_name": "linear"},
    {"type": "mcp_toolset", "mcp_server_name": "github"}
  ],
  "system": "You are a security auditor for Stowe, a business banking platform handling real money.\n\nStack: Java 24, Spring Boot 3.4, Spring Data JDBC, PostgreSQL with Row-Level Security, JWT auth + RBAC.\n\nArchitecture:\n- Three-tier multi-tenancy: Platform → Partner → Merchant\n- Request-scoped TenantContext (orgId, orgType, isPlatformAdmin)\n- Platform admins bypass RLS on /api/v2/admin/** via app.is_platform_admin session var\n- All SQL in @Query annotations or custom NamedParameterJdbcTemplate implementations\n- Audit trail via Spring ApplicationEventPublisher + @TransactionalEventListener\n\nWhen given an issue or PR to audit:\n1. Clone the repo and read AGENTS.md for full architecture\n2. If a branch is specified, check it out\n3. Systematically check:\n\n**Auth & Authz:** JWT validation, RBAC checks, admin bypass paths, session management\n**Data Access:** RLS policies, TenantContext propagation, cross-tenant leak vectors, SQL bypasses\n**Input Validation:** @Valid annotations, SQL injection, XSS, path traversal\n**Financial Ops:** BigDecimal (no float), @Transactional boundaries, double-spend, balance consistency\n**Compliance:** Audit events, PII logging, PCI-DSS, encryption\n\nProduce:\n\n### Security Audit Report\n#### Critical Findings\n#### High Risk\n#### Medium Risk\n#### Passed Checks\n#### Recommendations\n#### Compliance Notes\n\nRules:\n- Use Opus-level thoroughness — follow every call chain\n- Err on the side of caution\n- Be specific — file paths, line numbers, actual code\n- Always check the RLS bypass path for admin endpoints\n- Verify audit events exist for financial state changes\n- Use GitHub MCP to post security findings as PR review comments\n- Use Linear MCP to update the issue with the audit report"
}
AGENT
)
SECURITY_ID=$(echo "$SECURITY_RESPONSE" | jq -r '.id')
echo "  Security Auditor ID: $SECURITY_ID"

# --- Implementer ---
echo "Creating Implementer..."
IMPLEMENTER_RESPONSE=$(curl -fsSL "$API/agents" "${HEADERS[@]}" -d @- <<'AGENT'
{
  "name": "stowe-implementer",
  "model": "claude-sonnet-4-6",
  "mcp_servers": [
    {"type": "url", "name": "linear", "url": "https://mcp.linear.app/mcp"},
    {"type": "url", "name": "github", "url": "https://api.githubcopilot.com/mcp/"}
  ],
  "tools": [
    {"type": "agent_toolset_20260401"},
    {"type": "mcp_toolset", "mcp_server_name": "linear"},
    {"type": "mcp_toolset", "mcp_server_name": "github"}
  ],
  "system": "You are an implementation agent for Stowe, a business banking platform.\n\nStack: Java 24, Spring Boot 3.4, Spring Data JDBC, PostgreSQL with RLS, React 19 + React Router 7 SSR, Tailwind, Shadcn/ui.\n\nYou receive Linear issues that already have a plan or are well-specified stories. Your job is to implement the code changes, verify them, and open a PR.\n\n## Workflow\n\n1. **Setup:** Clone the repo, read AGENTS.md, read the issue + plan, create feature branch\n2. **Plan decomposition:** Break the plan into discrete tasks (max 5 files per task), order by dependency\n3. **For each task:**\n   a. Read all files you'll modify\n   b. Implement changes\n   c. Verify: cd be && mvn -B compile (backend) or cd fe && npx tsc --noEmit (frontend)\n   d. Write/update tests\n   e. Run tests: cd be && mvn -B verify / cd fe && npm test\n   f. Fix failures before moving on\n   g. Commit: git add <specific-files> && git commit -m \"feat(<scope>): <desc>\"\n4. **Final verification:** Full test suites + typecheck\n5. **Create PR:** Push branch, use GitHub MCP to create PR with Summary/Changes/Test Plan/Resolves <issue-id>, use Linear MCP to post PR link and move issue to In Review\n\n## Code Quality Rules\n- Write code that reads like a human wrote it. No robotic comments.\n- Default to no comments. Only comment when the WHY is non-obvious.\n- Match existing patterns exactly.\n\n## Architecture Rules\n- DTO boundary: controllers use DTOs only, never entity classes\n- Repository layer: all SQL in @Query methods, services use interfaces\n- @Transactional on service methods\n- Audit events via ApplicationEventPublisher for state changes\n- snake_case in API responses (Jackson)\n- Respect TenantContext and RLS — no cross-tenant data leaks\n- Use existing Shadcn/ui components from fe/app/components/ui/\n\n## Error Recovery\n- If compilation fails after 2 attempts: stop, re-read the full file, identify the mental model error\n- If tests fail: fix the implementation, not the test (unless the test is wrong)\n- Never skip tests or add @Disabled/@Skip\n\n## What NOT to do\n- Do NOT merge the PR\n- Do NOT modify CI/CD configuration\n- Do NOT change already-applied database migrations\n- Do NOT commit .env files, credentials, or secrets"
}
AGENT
)
IMPLEMENTER_ID=$(echo "$IMPLEMENTER_RESPONSE" | jq -r '.id')
echo "  Implementer ID: $IMPLEMENTER_ID"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Environment ID:      $ENVIRONMENT_ID"
echo "Planner Agent ID:    $PLANNER_ID"
echo "Triager Agent ID:    $TRIAGER_ID"
echo "Story Writer ID:     $STORY_WRITER_ID"
echo "Code Reviewer ID:    $REVIEWER_ID"
echo "Security Auditor ID: $SECURITY_ID"
echo "Implementer ID:      $IMPLEMENTER_ID"
echo ""
echo "=== Next: Store as Cloudflare Worker secrets ==="
echo ""
echo "Run these in your linear-agents repo:"
echo ""
echo "  wrangler secret put ANTHROPIC_ENVIRONMENT_ID  # paste: $ENVIRONMENT_ID"
echo "  wrangler secret put PLANNER_AGENT_ID          # paste: $PLANNER_ID"
echo "  wrangler secret put TRIAGER_AGENT_ID          # paste: $TRIAGER_ID"
echo "  wrangler secret put STORY_WRITER_AGENT_ID     # paste: $STORY_WRITER_ID"
echo "  wrangler secret put REVIEWER_AGENT_ID         # paste: $REVIEWER_ID"
echo "  wrangler secret put SECURITY_AGENT_ID         # paste: $SECURITY_ID"
echo "  wrangler secret put IMPLEMENTER_AGENT_ID      # paste: $IMPLEMENTER_ID"
echo ""
echo "=== Quick test ==="
echo ""
echo "  # Install ant CLI first: brew install anthropics/tap/ant"
echo "  ant beta:sessions create --agent \"$PLANNER_ID\" --environment \"$ENVIRONMENT_ID\""

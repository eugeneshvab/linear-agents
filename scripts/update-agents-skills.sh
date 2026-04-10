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

echo "Skill IDs loaded:"
cat "$SKILL_IDS_FILE"
echo ""

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
  response=$(curl -sS "https://api.anthropic.com/v1/agents/$agent_id" \
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

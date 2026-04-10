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

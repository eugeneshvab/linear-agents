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

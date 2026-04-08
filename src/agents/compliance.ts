import type { AgentContext } from "../types.js";
import { fetchRepoTree, selectRelevantFiles, fetchMultipleFiles } from "../shared/github.js";
import { callClaude } from "../shared/claude.js";
import { postResponse, postError } from "../shared/linear.js";

const SECURITY_KEYWORDS = [
  "auth", "login", "session", "token", "password", "secret",
  "middleware", "guard", "policy", "permission", "role",
  "api", "route", "endpoint", "handler", "controller",
  "database", "migration", "schema", "model", "query",
  "payment", "transaction", "balance", "transfer", "account",
  "encrypt", "decrypt", "hash", "crypto", "cert",
  "validate", "sanitize", "escape", "input",
  "log", "audit", "monitor",
];

export async function handleCompliance(ctx: AgentContext, compliancePrompt: string): Promise<void> {
  const { agentSessionId, promptContext, issueTitle, issueDescription, linearClient, env } = ctx;

  try {
    const tree = await fetchRepoTree(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      env.GITHUB_TOKEN,
    );

    const issueWords = `${issueTitle} ${issueDescription}`
      .toLowerCase()
      .split(/[\s/\-_.,:;()[\]{}]+/)
      .filter((w) => w.length >= 3);
    const allKeywords = [...new Set([...issueWords, ...SECURITY_KEYWORDS])];

    const relevantPaths = selectRelevantFiles(tree, allKeywords);

    const files = await fetchMultipleFiles(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      relevantPaths,
      env.GITHUB_TOKEN,
    );

    const repoContext = files
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");

    const userMessage = `${promptContext}\n\n## Codebase Context (Security-Relevant Files)\n\n${repoContext}`;

    const response = await callClaude(env.CLAUDE_API_KEY, compliancePrompt, userMessage, 8192);

    await postResponse(linearClient, agentSessionId, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    await postError(linearClient, agentSessionId, `Compliance review failed: ${message}`);
  }
}

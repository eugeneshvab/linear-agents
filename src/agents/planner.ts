import type { AgentContext } from "../types.js";
import { fetchRepoTree, selectRelevantFiles, fetchMultipleFiles } from "../shared/github.js";
import { callClaude } from "../shared/claude.js";
import { postResponse, postElicitation, postError } from "../shared/linear.js";

function extractKeywords(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const stopWords = new Set(["the", "and", "for", "that", "this", "with", "from", "are", "was", "will", "should", "could", "would", "have", "has", "been", "being", "not", "but", "can"]);
  return text
    .split(/[\s/\-_.,:;()[\]{}]+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .slice(0, 20);
}

export async function handlePlanner(ctx: AgentContext, plannerPrompt: string): Promise<void> {
  const { agentSessionId, promptContext, issueTitle, issueDescription, linearClient, env } = ctx;

  try {
    const tree = await fetchRepoTree(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      env.GITHUB_TOKEN,
    );

    const keywords = extractKeywords(issueTitle, issueDescription);
    const relevantPaths = selectRelevantFiles(tree, keywords);

    const files = await fetchMultipleFiles(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      relevantPaths,
      env.GITHUB_TOKEN,
    );

    const repoContext = files
      .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n\n");

    const userMessage = `${promptContext}\n\n## Codebase Context\n\n${repoContext}`;

    const response = await callClaude(env.CLAUDE_API_KEY, plannerPrompt, userMessage);

    if (response.toLowerCase().includes("open questions") && response.toLowerCase().includes("need clarif")) {
      await postElicitation(linearClient, agentSessionId, response);
    } else {
      await postResponse(linearClient, agentSessionId, response);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    await postError(linearClient, agentSessionId, `Planner failed: ${message}`);
  }
}

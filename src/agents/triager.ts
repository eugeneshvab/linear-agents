import type { AgentContext } from "../types.js";
import { fetchRepoTree } from "../shared/github.js";
import { callClaude } from "../shared/claude.js";
import { postResponse, postError } from "../shared/linear.js";

export async function handleTriager(ctx: AgentContext, triagerPrompt: string): Promise<void> {
  const { agentSessionId, promptContext, linearClient, env } = ctx;

  try {
    const tree = await fetchRepoTree(
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      env.GITHUB_TOKEN,
    );

    const treeOverview = tree
      .filter((item) => !item.path.includes("node_modules"))
      .map((item) => item.path)
      .join("\n");

    const userMessage = `${promptContext}\n\n## Repository Structure\n\n\`\`\`\n${treeOverview}\n\`\`\``;

    const response = await callClaude(env.CLAUDE_API_KEY, triagerPrompt, userMessage);

    await postResponse(linearClient, agentSessionId, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error occurred";
    await postError(linearClient, agentSessionId, `Triager failed: ${message}`);
  }
}

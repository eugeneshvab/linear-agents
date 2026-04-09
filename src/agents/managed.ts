import type { AgentContext } from "../types.js";
import { runManagedAgent } from "../shared/managed-agent.js";
import { postResponse, postError } from "../shared/linear.js";

export async function handleManagedAgent(
  ctx: AgentContext,
  managedAgentId: string,
): Promise<void> {
  const { agentSessionId, promptContext, issueTitle, issueDescription, commentBody, linearClient, env } = ctx;

  try {
    const taskParts: string[] = [
      `## Linear Issue: ${issueTitle}`,
      "",
      issueDescription || "(no description)",
    ];

    if (commentBody) {
      taskParts.push("", "## Latest Comment", commentBody);
    }

    if (promptContext) {
      taskParts.push("", "## Additional Context", promptContext);
    }

    const taskMessage = taskParts.join("\n");

    const vaultIds = [env.LINEAR_VAULT_ID, env.GITHUB_VAULT_ID].filter(Boolean);
    console.log(`[managed] Starting agent ${managedAgentId}, message length: ${taskMessage.length}`);
    const result = await runManagedAgent(
      env.ANTHROPIC_API_KEY,
      managedAgentId,
      env.ANTHROPIC_ENVIRONMENT_ID,
      taskMessage,
      env.GITHUB_TOKEN,
      vaultIds,
    );

    console.log(`[managed] Agent completed. Response length: ${result.text.length}, sessionId: ${result.sessionId}`);
    await postResponse(linearClient, agentSessionId, result.text);
    console.log(`[managed] Response posted to Linear`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[managed] Agent failed for session ${agentSessionId}:`, message);
    await postError(linearClient, agentSessionId, `Agent failed: ${message}`).catch((e) =>
      console.error(`[managed] Failed to post error to Linear:`, e),
    );
  }
}

import type { AgentContext, AgentName, ProgressCallback, SessionState } from "../types.js";
import { createManagedSession, runManagedSession, sendFollowUpMessage } from "../shared/managed-agent.js";
import { postResponse, completeSession, postError, postThought } from "../shared/linear.js";

const SESSION_TTL_SECONDS = 600; // 10 minutes

async function writeSessionState(
  kv: KVNamespace,
  linearSessionId: string,
  state: SessionState,
): Promise<void> {
  await kv.put(`session:${linearSessionId}`, JSON.stringify(state), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function handleManagedAgent(
  ctx: AgentContext,
  managedAgentId: string,
  agentName: AgentName,
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

    // Create session first, then write KV so follow-ups can find it immediately
    const anthropicSessionId = await createManagedSession(
      env.ANTHROPIC_API_KEY,
      managedAgentId,
      env.ANTHROPIC_ENVIRONMENT_ID,
      vaultIds,
    );

    await writeSessionState(env.AGENT_SESSIONS, agentSessionId, {
      anthropicSessionId,
      agentName,
      status: "running",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    const onProgress: ProgressCallback = async (message: string) => {
      await postThought(linearClient, agentSessionId, message);
    };

    console.log(`[managed] Starting agent ${managedAgentId}, message length: ${taskMessage.length}`);
    const resultText = await runManagedSession(
      env.ANTHROPIC_API_KEY,
      anthropicSessionId,
      taskMessage,
      env.GITHUB_TOKEN,
      onProgress,
    );

    console.log(`[managed] Agent completed. Response length: ${resultText.length}`);

    // Update session state to idle for follow-ups
    await writeSessionState(env.AGENT_SESSIONS, agentSessionId, {
      anthropicSessionId,
      agentName,
      status: "idle",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    // Post the response if the agent produced text output
    if (resultText.length > 0) {
      await postResponse(linearClient, agentSessionId, resultText);
      console.log(`[managed] Response posted to Linear`);
    }
    // Mark the session as complete so Linear stops showing "Analyzing..."
    await completeSession(linearClient, agentSessionId);
    console.log(`[managed] Session marked complete`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[managed] Agent failed for session ${agentSessionId}:`, message);
    await postError(linearClient, agentSessionId, `Agent failed: ${message}`).catch((e) =>
      console.error(`[managed] Failed to post error to Linear:`, e),
    );
  }
}

export async function handleFollowUp(
  ctx: AgentContext,
  sessionState: SessionState,
): Promise<void> {
  const { agentSessionId, commentBody, promptContext, linearClient, env } = ctx;

  try {
    await postThought(linearClient, agentSessionId, "Processing your follow-up...");

    const followUpText = commentBody || promptContext || "(empty follow-up)";

    const onProgress: ProgressCallback = async (message: string) => {
      await postThought(linearClient, agentSessionId, message);
    };

    const resultText = await sendFollowUpMessage(
      env.ANTHROPIC_API_KEY,
      sessionState.anthropicSessionId,
      followUpText,
      onProgress,
    );

    // Update session state: back to idle, refresh TTL
    await writeSessionState(env.AGENT_SESSIONS, agentSessionId, {
      ...sessionState,
      status: "idle",
      lastActivityAt: Date.now(),
    });

    if (resultText.length > 0) {
      await postResponse(linearClient, agentSessionId, resultText);
      console.log(`[managed] Follow-up response posted to Linear`);
    }
    await completeSession(linearClient, agentSessionId);
    console.log(`[managed] Follow-up session marked complete`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[managed] Follow-up failed for session ${agentSessionId}:`, message);
    await postError(linearClient, agentSessionId, `Follow-up failed: ${message}`).catch(() => {});
  }
}

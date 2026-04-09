interface ManagedAgentResult {
  text: string;
  sessionId: string;
}

const API_BASE = "https://api.anthropic.com/v1";
const BETA_MANAGED = "managed-agents-2026-04-01";
const BETA_STREAM = "agent-api-2026-03-01";

async function apiRequest(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": BETA_MANAGED,
    "content-type": "application/json",
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  if (method === "DELETE") return {};
  return res.json();
}

export async function runManagedAgent(
  apiKey: string,
  agentId: string,
  environmentId: string,
  taskMessage: string,
  githubToken: string,
  vaultIds: string[],
): Promise<ManagedAgentResult> {
  // 1. Create session
  const sessionBody: Record<string, unknown> = {
    agent: agentId,
    environment_id: environmentId,
  };
  if (vaultIds.length > 0) {
    sessionBody.vault_ids = vaultIds;
  }
  console.log(`[anthropic] Creating session for agent ${agentId}`);
  const session = (await apiRequest(apiKey, "/sessions", "POST", sessionBody)) as { id: string; status: string };
  console.log(`[anthropic] Session created: ${session.id}, status: ${session.status}`);

  // 2. Build the full message with git clone instructions
  const fullMessage = [
    taskMessage,
    "",
    "## Environment Setup",
    `When cloning the repo, use: git clone https://${githubToken}@github.com/stowe-io/stowe-io.git`,
    "Then cd into stowe-io and read AGENTS.md first.",
  ].join("\n");

  // 3. Open the SSE stream FIRST (per docs: stream before sending message)
  console.log(`[anthropic] Opening SSE stream for session ${session.id}`);
  const streamPromise = streamSessionEvents(apiKey, session.id);

  // 4. Then send the user message — this triggers the agent to start working
  console.log(`[anthropic] Sending user message (${fullMessage.length} chars)`);
  await apiRequest(apiKey, `/sessions/${session.id}/events`, "POST", {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: fullMessage }],
      },
    ],
  });
  console.log(`[anthropic] Message sent, waiting for agent to finish`);

  // 5. Wait for the stream to complete
  const resultText = await streamPromise;
  console.log(`[anthropic] Agent finished, result length: ${resultText.length}`);

  // 6. Archive session (best effort cleanup)
  try {
    await apiRequest(apiKey, `/sessions/${session.id}`, "DELETE");
  } catch {
    // Non-critical
  }

  return { text: resultText, sessionId: session.id };
}

async function streamSessionEvents(apiKey: string, sessionId: string): Promise<string> {
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": BETA_STREAM,
    Accept: "text/event-stream",
  };

  // Use /stream endpoint (not /events which returns history)
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/stream`, {
    method: "GET",
    headers,
  });

  if (!res.ok || !res.body) {
    const errorText = res.body ? await res.text() : "(no body)";
    throw new Error(`Failed to open stream: ${res.status} ${errorText}`);
  }

  let resultText = "";
  let sawAgentActivity = false;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log(`[stream] Stream ended. sawActivity: ${sawAgentActivity}, resultLength: ${resultText.length}`);
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        console.log(`[stream] Got [DONE]`);
        return resultText;
      }

      try {
        const event = JSON.parse(data);
        console.log(`[stream] Event: ${event.type}`);

        // Collect text from agent messages
        if (event.type === "agent.message") {
          sawAgentActivity = true;
          for (const block of event.content ?? []) {
            if (block.type === "text") {
              resultText += block.text;
            }
          }
        }

        // Track tool usage as activity
        if (event.type === "agent.tool_use") {
          sawAgentActivity = true;
          console.log(`[stream] Tool use: ${event.name}`);
        }

        // Mark activity on any agent-related event
        if (event.type?.startsWith("agent.") || event.type?.startsWith("tool.")) {
          sawAgentActivity = true;
        }

        // Only treat idle as "done" if the agent actually ran
        if (event.type === "session.status_idle" && sawAgentActivity) {
          console.log(`[stream] Agent finished (idle after activity)`);
          return resultText;
        }

        if (event.type === "session.status_idle" && !sawAgentActivity) {
          console.log(`[stream] Ignoring initial idle (no agent activity yet)`);
          continue;
        }

        if (event.type === "session.status_terminated") {
          throw new Error("Managed Agent session terminated unexpectedly");
        }

        // Log errors from the session
        if (event.type === "session.error") {
          console.error(`[stream] Session error: ${JSON.stringify(event.error)}`);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return resultText;
}

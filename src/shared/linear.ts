import { LinearClient } from "@linear/sdk";

export function createLinearClient(accessToken: string): LinearClient {
  return new LinearClient({ accessToken });
}

export async function acknowledgeSession(
  client: LinearClient,
  agentSessionId: string,
): Promise<void> {
  await client.createAgentActivity({
    agentSessionId,
    content: { type: "thought", body: "Analyzing issue..." },
  });
}

export async function postResponse(
  client: LinearClient,
  agentSessionId: string,
  body: string,
): Promise<void> {
  await client.createAgentActivity({
    agentSessionId,
    content: { type: "response", body },
  });
}

export async function postElicitation(
  client: LinearClient,
  agentSessionId: string,
  body: string,
): Promise<void> {
  await client.createAgentActivity({
    agentSessionId,
    content: { type: "elicitation", body },
  });
}

export async function postError(
  client: LinearClient,
  agentSessionId: string,
  body: string,
): Promise<void> {
  await client.createAgentActivity({
    agentSessionId,
    content: { type: "error", body },
  });
}

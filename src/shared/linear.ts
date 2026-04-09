import type { LinearClient } from "../types.js";

const LINEAR_API = "https://api.linear.app/graphql";

async function graphql(client: LinearClient, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: client.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Linear API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function createLinearClient(accessToken: string): LinearClient {
  return { accessToken };
}

export async function acknowledgeSession(client: LinearClient, agentSessionId: string): Promise<void> {
  await graphql(client, `
    mutation AcknowledgeAgent($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      type: "thought",
      content: "Analyzing issue...",
    },
  });
}

export async function postResponse(client: LinearClient, agentSessionId: string, text: string): Promise<void> {
  await graphql(client, `
    mutation PostAgentResponse($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      type: "response",
      content: text,
    },
  });
}

export async function postError(client: LinearClient, agentSessionId: string, message: string): Promise<void> {
  await graphql(client, `
    mutation PostAgentError($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      type: "error",
      content: message,
    },
  });
}

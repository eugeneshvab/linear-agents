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
  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Linear API error: ${res.status} ${responseText}`);
  }
  const json = JSON.parse(responseText);
  if (json.errors) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

export function createLinearClient(accessToken: string): LinearClient {
  return { accessToken };
}

export async function acknowledgeSession(client: LinearClient, agentSessionId: string): Promise<void> {
  console.log(`[linear] Acknowledging session ${agentSessionId}`);
  await graphql(client, `
    mutation AcknowledgeAgent($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      content: { type: "thought", body: "Analyzing issue..." },
    },
  });
  console.log(`[linear] Acknowledged`);
}

export async function postResponse(client: LinearClient, agentSessionId: string, text: string): Promise<void> {
  console.log(`[linear] Posting response to session ${agentSessionId}, length: ${text.length}`);
  await graphql(client, `
    mutation PostAgentResponse($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      content: { type: "response", body: text },
    },
  });
  console.log(`[linear] Response posted`);
}

export async function postError(client: LinearClient, agentSessionId: string, message: string): Promise<void> {
  console.log(`[linear] Posting error to session ${agentSessionId}: ${message}`);
  await graphql(client, `
    mutation PostAgentError($input: AgentActivityCreateInput!) {
      agentActivityCreate(input: $input) {
        success
      }
    }
  `, {
    input: {
      agentSessionId,
      content: { type: "error", body: message },
    },
  });
}

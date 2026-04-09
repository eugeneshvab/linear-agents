import type { Env, AgentName, AgentContext } from "./types.js";
import { extractAgentFromPath, verifySignature, parseWebhookPayload } from "./shared/webhook.js";
import { createLinearClient, acknowledgeSession } from "./shared/linear.js";
import { handleManagedAgent } from "./agents/managed.js";

function getAgentId(agentName: AgentName, env: Env): string {
  const map: Record<AgentName, string> = {
    planner: env.PLANNER_AGENT_ID,
    triager: env.TRIAGER_AGENT_ID,
    reviewer: env.REVIEWER_AGENT_ID,
    security: env.SECURITY_AGENT_ID,
    "story-writer": env.STORY_WRITER_AGENT_ID,
    implementer: env.IMPLEMENTER_AGENT_ID,
  };
  return map[agentName];
}

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const agentName = extractAgentFromPath(request.url);
    if (!agentName) {
      return new Response("Not found", { status: 404 });
    }

    const body = await request.text();
    const signature = request.headers.get("linear-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const valid = await verifySignature(body, signature, env.LINEAR_WEBHOOK_SECRET);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body);
    const parsed = parseWebhookPayload(payload);

    if (parsed.action !== "created" && parsed.action !== "prompted") {
      return new Response("OK", { status: 200 });
    }

    const accessToken = await env.OAUTH_TOKENS.get(parsed.organizationId);
    if (!accessToken) {
      console.error(`No OAuth token for org ${parsed.organizationId}`);
      return new Response("No access token for this organization", { status: 500 });
    }

    const linearClient = createLinearClient(accessToken);

    // Acknowledge within Linear's 5-second deadline
    await acknowledgeSession(linearClient, parsed.agentSessionId);

    const managedAgentId = getAgentId(agentName, env);

    const agentCtx: AgentContext = {
      agentSessionId: parsed.agentSessionId,
      promptContext: parsed.promptContext,
      issueTitle: parsed.issueTitle,
      issueDescription: parsed.issueDescription,
      commentBody: parsed.commentBody,
      linearClient,
      env,
    };

    // Dispatch to Managed Agent async — Worker returns 200 immediately
    executionCtx.waitUntil(handleManagedAgent(agentCtx, managedAgentId));

    return new Response("OK", { status: 200 });
  },
};

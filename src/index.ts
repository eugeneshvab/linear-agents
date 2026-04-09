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

    const url = new URL(request.url);

    // Debug endpoint — logs raw payload, no signature check
    if (url.pathname === "/debug") {
      const debugBody = await request.text();
      console.log("[debug] Headers:", JSON.stringify(Object.fromEntries(request.headers.entries())));
      console.log("[debug] Body:", debugBody);
      return new Response("OK (debug logged)", { status: 200 });
    }

    const agentName = extractAgentFromPath(request.url);
    if (!agentName) {
      return new Response("Not found", { status: 404 });
    }

    const body = await request.text();

    const signature = request.headers.get("linear-signature");
    console.log(`[worker] Signature present: ${!!signature}, agent: ${agentName}`);
    if (signature) {
      const webhookSecret =
        await env.OAUTH_TOKENS.get(`webhook_secret:${agentName}`) ??
        env.LINEAR_WEBHOOK_SECRET;
      if (webhookSecret) {
        const valid = await verifySignature(body, signature, webhookSecret);
        if (!valid) {
          console.error(`[worker] Signature verification failed for ${agentName}`);
          return new Response("Invalid signature", { status: 401 });
        }
        console.log(`[worker] Signature verified for ${agentName}`);
      } else {
        console.warn(`[worker] No webhook secret configured for ${agentName}, skipping verification`);
      }
    }

    const payload = JSON.parse(body);
    console.log(`[worker] Webhook received for agent: ${agentName}`);
    const parsed = parseWebhookPayload(payload);

    if (parsed.action !== "create" && parsed.action !== "created" && parsed.action !== "prompted") {
      console.log(`[worker] Ignoring action: ${parsed.action}`);
      return new Response("OK", { status: 200 });
    }

    console.log(`[worker] Processing action: ${parsed.action}, sessionId: ${parsed.agentSessionId}, orgId: ${parsed.organizationId}`);

    // Look up per-agent token first, fall back to org-level token
    const accessToken =
      await env.OAUTH_TOKENS.get(`${parsed.organizationId}:${agentName}`) ??
      await env.OAUTH_TOKENS.get(parsed.organizationId);
    if (!accessToken) {
      console.error(`[worker] No OAuth token for org ${parsed.organizationId}, agent ${agentName}`);
      return new Response("No access token for this organization", { status: 500 });
    }
    console.log(`[worker] Using token for: ${await env.OAUTH_TOKENS.get(`${parsed.organizationId}:${agentName}`) ? `${agentName}` : "org-default"}`);

    const linearClient = createLinearClient(accessToken);

    console.log(`[worker] Acknowledging session ${parsed.agentSessionId}`);
    await acknowledgeSession(linearClient, parsed.agentSessionId);
    console.log(`[worker] Acknowledged`);

    const managedAgentId = getAgentId(agentName, env);
    console.log(`[worker] Dispatching to managed agent: ${managedAgentId}`);

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

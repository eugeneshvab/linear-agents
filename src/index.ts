import type { Env, AgentName, AgentContext } from "./types.js";
import { extractAgentFromPath, parseWebhookPayload } from "./shared/webhook.js";
import { createLinearClient, acknowledgeSession } from "./shared/linear.js";
import { handlePlanner } from "./agents/planner.js";
import { handleTriager } from "./agents/triager.js";
import { handleCompliance } from "./agents/compliance.js";

import plannerPrompt from "../prompts/planner.md";
import triagerPrompt from "../prompts/triager.md";
import compliancePrompt from "../prompts/compliance.md";

const agentHandlers: Record<AgentName, (ctx: AgentContext, prompt: string) => Promise<void>> = {
  planner: handlePlanner,
  triager: handleTriager,
  compliance: handleCompliance,
};

const agentPrompts: Record<AgentName, string> = {
  planner: plannerPrompt,
  triager: triagerPrompt,
  compliance: compliancePrompt,
};

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

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.LINEAR_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSignature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body);
    const parsed = parseWebhookPayload(payload);

    if (parsed.action !== "created" && parsed.action !== "prompted") {
      return new Response("OK", { status: 200 });
    }

    const accessToken = await env.OAUTH_TOKENS.get(parsed.organizationId);
    if (!accessToken) {
      return new Response("No access token for organization", { status: 500 });
    }

    const linearClient = createLinearClient(accessToken);

    await acknowledgeSession(linearClient, parsed.agentSessionId);

    const agentCtx: AgentContext = {
      agentSessionId: parsed.agentSessionId,
      promptContext: parsed.promptContext,
      issueTitle: parsed.issueTitle,
      issueDescription: parsed.issueDescription,
      commentBody: parsed.commentBody,
      linearClient,
      env,
    };

    const handler = agentHandlers[agentName];
    const prompt = agentPrompts[agentName];
    executionCtx.waitUntil(handler(agentCtx, prompt));

    return new Response("OK", { status: 200 });
  },
};

import type { AgentName, WebhookPayload } from "../types.js";

const VALID_AGENTS = new Set<string>([
  "planner", "triager", "reviewer", "security", "story-writer", "implementer", "agent-smith", "qa-expert",
]);

export function extractAgentFromPath(url: string): AgentName | null {
  const path = new URL(url).pathname;
  const match = path.match(/^\/webhooks\/([\w-]+)$/);
  if (!match || !VALID_AGENTS.has(match[1])) return null;
  return match[1] as AgentName;
}

export async function verifySignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expected;
}

export function parseWebhookPayload(payload: Record<string, unknown>): WebhookPayload {
  // Log the raw payload so we can see exactly what Linear sends
  console.log("[webhook] Raw payload:", JSON.stringify(payload, null, 2));

  const data = (payload.data ?? payload) as Record<string, unknown>;

  // Linear may nest the session ID in different places
  const agentSessionId = (
    data.agentSessionId ??
    data.id ??
    (data.agentSession as Record<string, unknown> | undefined)?.id ??
    payload.agentSessionId ??
    payload.id ??
    ""
  ) as string;

  // Issue may be nested under data or data.agentSession
  const agentSession = (data.agentSession ?? {}) as Record<string, unknown>;
  const issue = (data.issue ?? agentSession.issue ?? {}) as Record<string, unknown>;

  const organizationId = (
    data.organizationId ??
    payload.organizationId ??
    ""
  ) as string;

  // Linear sends action at root level for webhooks
  const action = (payload.action ?? data.action ?? "unknown") as string;

  const parsed: WebhookPayload = {
    action,
    organizationId,
    agentSessionId,
    issueTitle: (issue.title ?? "") as string,
    issueDescription: (issue.description ?? null) as string | null,
    commentBody: (data.commentBody ?? agentSession.commentBody ?? null) as string | null,
    promptContext: (data.promptContext ?? agentSession.promptContext ?? null) as string | null,
  };

  console.log("[webhook] Parsed:", JSON.stringify(parsed));
  return parsed;
}

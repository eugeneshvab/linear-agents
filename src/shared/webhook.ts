import type { AgentName, WebhookPayload } from "../types.js";

const VALID_AGENTS = new Set<string>([
  "planner", "triager", "reviewer", "security", "story-writer", "implementer",
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
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const issue = (data.issue ?? {}) as Record<string, unknown>;

  return {
    action: (data.action ?? payload.action ?? "unknown") as string,
    organizationId: (data.organizationId ?? payload.organizationId ?? "") as string,
    agentSessionId: (data.agentSessionId ?? "") as string,
    issueTitle: (issue.title ?? "") as string,
    issueDescription: (issue.description ?? null) as string | null,
    commentBody: (data.commentBody ?? null) as string | null,
    promptContext: (data.promptContext ?? null) as string | null,
  };
}

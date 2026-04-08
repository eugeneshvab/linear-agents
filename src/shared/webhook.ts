import type { AgentName } from "../types.js";

export function extractAgentFromPath(url: string): AgentName | null {
  const path = new URL(url).pathname;
  const match = path.match(/^\/webhooks\/(planner|triager|compliance)$/);
  return match ? (match[1] as AgentName) : null;
}

export interface ParsedWebhookPayload {
  action: "created" | "prompted" | "stopped";
  agentSessionId: string;
  promptContext: string;
  issueTitle: string;
  issueDescription: string;
  commentBody: string | null;
  organizationId: string;
}

export function parseWebhookPayload(payload: any): ParsedWebhookPayload {
  return {
    action: payload.action,
    agentSessionId: payload.agentSession?.id ?? "",
    promptContext: payload.promptContext ?? "",
    issueTitle: payload.agentSession?.issue?.title ?? "",
    issueDescription: payload.agentSession?.issue?.description ?? "",
    commentBody: payload.agentSession?.comment?.body ?? null,
    organizationId: payload.organizationId ?? "",
  };
}

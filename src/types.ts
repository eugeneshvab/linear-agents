export type AgentName = "planner" | "triager" | "reviewer" | "security" | "story-writer" | "implementer";

export interface Env {
  // Linear
  OAUTH_TOKENS: KVNamespace;
  LINEAR_WEBHOOK_SECRET: string;

  // Anthropic Managed Agents
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_ENVIRONMENT_ID: string;
  PLANNER_AGENT_ID: string;
  TRIAGER_AGENT_ID: string;
  REVIEWER_AGENT_ID: string;
  SECURITY_AGENT_ID: string;
  STORY_WRITER_AGENT_ID: string;
  IMPLEMENTER_AGENT_ID: string;

  // Vault IDs for MCP OAuth (Linear + GitHub)
  LINEAR_VAULT_ID: string;
  GITHUB_VAULT_ID: string;

  // GitHub (injected into agent via user message for git clone)
  GITHUB_TOKEN: string;
}

export interface WebhookPayload {
  action: string;
  organizationId: string;
  agentSessionId: string;
  issueTitle: string;
  issueDescription: string | null;
  commentBody: string | null;
  promptContext: string | null;
}

export interface AgentContext {
  agentSessionId: string;
  promptContext: string | null;
  issueTitle: string;
  issueDescription: string | null;
  commentBody: string | null;
  linearClient: LinearClient;
  env: Env;
}

export interface LinearClient {
  accessToken: string;
}

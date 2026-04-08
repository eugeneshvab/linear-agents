import type { LinearClient } from "@linear/sdk";

export type AgentName = "planner" | "triager" | "compliance";

export interface Env {
  OAUTH_TOKENS: KVNamespace;
  LINEAR_WEBHOOK_SECRET: string;
  LINEAR_CLIENT_SECRET: string;
  CLAUDE_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
}

export interface AgentContext {
  agentSessionId: string;
  promptContext: string;
  issueTitle: string;
  issueDescription: string;
  commentBody: string | null;
  linearClient: LinearClient;
  env: Env;
}

export type AgentHandler = (ctx: AgentContext) => Promise<void>;

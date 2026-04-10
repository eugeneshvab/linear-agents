export class ProgressTracker {
  private lastPostTime = 0;
  private latestMessage = "";
  private throttleMs: number;
  private postFn: (message: string) => Promise<void>;

  constructor(postFn: (message: string) => Promise<void>, throttleMs = 10_000) {
    this.postFn = postFn;
    this.throttleMs = throttleMs;
  }

  async onEvent(event: { type: string; name?: string; input?: Record<string, unknown>; content?: unknown[] }): Promise<void> {
    const message = this.formatEvent(event);
    if (!message) return;
    this.latestMessage = message;

    const now = Date.now();
    if (now - this.lastPostTime >= this.throttleMs) {
      this.lastPostTime = now;
      try {
        await this.postFn(this.latestMessage);
      } catch (e) {
        console.error(`[progress] Post failed:`, e);
      }
    }
  }

  private formatEvent(event: { type: string; name?: string; input?: Record<string, unknown> }): string | null {
    if (event.type === "agent.tool_use" && event.name) {
      return this.formatToolUse(event.name, event.input);
    }
    if (event.type === "agent.mcp_tool_use" && event.name) {
      return `Using ${event.name}`;
    }
    if (event.type === "agent.thinking") {
      return "Analyzing...";
    }
    if (event.type === "agent.message") {
      return "Composing response...";
    }
    return null;
  }

  private formatToolUse(name: string, input?: Record<string, unknown>): string {
    const arg = (key: string): string | null => {
      const val = input?.[key];
      if (typeof val === "string") return val.length > 100 ? val.slice(0, 100) + "..." : val;
      return null;
    };

    switch (name) {
      case "bash": return `Running command: ${arg("command") ?? "..."}`;
      case "file_read": return `Reading ${arg("path") ?? "file"}`;
      case "file_write": case "file_edit": return `Writing ${arg("path") ?? "file"}`;
      case "search": case "grep": return `Searching for: ${arg("query") ?? arg("pattern") ?? "..."}`;
      default: return `Using tool: ${name}`;
    }
  }
}

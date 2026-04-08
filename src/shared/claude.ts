import Anthropic from "@anthropic-ai/sdk";

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "No response generated.";
}

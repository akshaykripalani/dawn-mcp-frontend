import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, convertToCoreMessages } from "ai";
import { z } from "zod";

export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Schema for validation if needed in future expansions
const mcpToolSchema = z.object({
  toolName: z.string(),
  server: z.enum(["perplexity", "budget"]).optional(),
  arguments: z.record(z.unknown()).default({}),
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // System prompt to enforce TOOL_CALL format when tools are needed
  const system = {
    role: "system" as const,
    content:
      "You are an assistant orchestrator. Protocol: (1) If a tool is needed, reply ONLY with one line starting with 'TOOL_CALL:' followed by JSON {toolName, server: 'perplexity'|'budget', arguments}. (2) After the client sends TOOL_RESULT:{...}, reply with the final user-facing answer unless another tool is strictly required, in which case send another TOOL_CALL. Never include extra commentary around TOOL_CALL or TOOL_RESULT.",
  };

  const result = await streamText({
    model: google("gemini-2.5-flash"),
    messages: [system, ...convertToCoreMessages(messages)],
  });

  return result.toAIStreamResponse();
}

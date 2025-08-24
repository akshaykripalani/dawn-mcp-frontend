import { google } from "@ai-sdk/google";
import { generateText, experimental_createMCPClient } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

export const maxDuration = 30;

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
  
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!mcpUrl) {
    return new Response(
      JSON.stringify({ error: "Missing MCP_SERVER_URL environment variable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const perplexityClient = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(
      new URL(`${mcpUrl}/perplexity/mcp`)
    ),
  });

  const budgetClient = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(
      new URL(`${mcpUrl}/budget/mcp`)
    ),
  });

  let allTools;
  try {
    const perplexityTools = await perplexityClient.tools();
    const budgetTools = await budgetClient.tools();
    allTools = { ...perplexityTools, ...budgetTools };
  } finally {
    await perplexityClient.close();
    await budgetClient.close();
  }

  const { text, toolCalls } = await generateText({
    model: google("gemini-2.5-flash"),
    system: "You are a helpful assistant named DawnAI.",
    messages: messages,
    tools: allTools,
  });

  return new Response(JSON.stringify({ text, toolCalls }), {
    headers: { "Content-Type": "application/json" },
  });
}

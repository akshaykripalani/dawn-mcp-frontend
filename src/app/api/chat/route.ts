import { google } from "@ai-sdk/google";
import {
  generateText,
  experimental_createMCPClient,
  CoreMessage,
} from "ai";
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
  const { messages }: { messages: CoreMessage[] } = await req.json();

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

  try {
    const perplexityTools = await perplexityClient.tools();
    const budgetTools = await budgetClient.tools();
    const allTools = { ...perplexityTools, ...budgetTools };

    const result = await generateText({
      model: google("gemini-2.5-pro"),
      system: "You are a helpful assistant named DawnAI. You will be communicating with users using voice, so your responses should be concise and to the point. Additionally, avoid using special symbols like emojis, markdown, or currency symbols. Respond with full words, not abbreviations. Speak naturally in a conversational tone, rather than speaking pointwise. Keep your responses short and concise, and to the point. Also, if a user asks you if you can hear them, simply agree. You as an AI process the text, but for the user it is Voice (TTS). You have access to search the web, and to help budget for the user. Your response MUST ABSOLUTELY ALWAYS BE UNDER 50 WORDS. NEVER SPEAK MORE THAN 50 WORDS. IF A USER ASKS YOU TO TRACK A BUDGET, DO NOT ASK FOR CONFIRMATION, JUST SAY YOU DID IT. NEVER EVER ASK FOR MORE INFORMATION. WHEN YOU RECEIVE TOOL RESULTS, USE THEM AS THE PRIMARY SOURCE OF INFORMATION FOR YOUR RESPONSE. ALWAYS BASE YOUR ANSWER ON THE ACTUAL TOOL RESULTS PROVIDED, NOT ON GENERAL KNOWLEDGE OR ASSUMPTIONS.",
      messages: messages,
      tools: allTools,
    });

    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolResults = await Promise.all(
        result.toolCalls.map(async (toolCall) => {
          const { toolName, args } = toolCall as any;
          const tool = allTools[toolName];
          if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
          }
          const result = await (tool as any).execute(args);
          return {
            toolName,
            result
          };
        })
      );

      // Create clear, structured tool result message
      const toolResultContent = toolResults.map((toolResult, index) =>
        `${toolResult.toolName} result: ${JSON.stringify(toolResult.result)}`
      ).join('\n\n');

      const newMessages: CoreMessage[] = [
        ...messages,
        {
          role: "assistant",
          content: result.text || "I used some tools to help answer your question."
        },
        {
          role: "user",
          content: `Here are the results from the tools I called:\n\n${toolResultContent}\n\nPlease provide a final answer based on these results, keeping it under 50 words for voice output.`
        }
      ];

      const finalResult = await generateText({
        model: google("gemini-2.5-pro"),
        system: "You are a helpful assistant named DawnAI. You will be communicating with users using voice, so your responses should be concise and to the point. Additionally, avoid using special symbols like emojis, markdown, or currency symbols. Respond with full words, not abbreviations. Speak naturally in a conversational tone, rather than speaking pointwise. Keep your responses short and concise, and to the point. Also, if a user asks you if you can hear them, simply agree. You as an AI process the text, but for the user it is Voice (TTS). You have access to search the web, and to help budget for the user. Your response MUST ABSOLUTELY ALWAYS BE UNDER 50 WORDS. NEVER SPEAK MORE THAN 50 WORDS. IF A USER ASKS YOU TO TRACK A BUDGET, DO NOT ASK FOR CONFIRMATION, JUST SAY YOU DID IT. NEVER EVER ASK FOR MORE INFORMATION. WHEN YOU RECEIVE TOOL RESULTS, USE THEM AS THE PRIMARY SOURCE OF INFORMATION FOR YOUR RESPONSE. ALWAYS BASE YOUR ANSWER ON THE ACTUAL TOOL RESULTS PROVIDED, NOT ON GENERAL KNOWLEDGE OR ASSUMPTIONS.",
        messages: newMessages,
        tools: allTools,
      });

      return new Response(
        JSON.stringify({
          text: finalResult.text,
          toolCalls: finalResult.toolCalls,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ text: result.text, toolCalls: result.toolCalls }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } finally {
    await perplexityClient.close();
    await budgetClient.close();
  }
}

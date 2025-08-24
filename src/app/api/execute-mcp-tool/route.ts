import { experimental_createMCPClient } from "ai";
import { MCPClientError } from "ai/mcp";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { toolName, server, arguments: toolArguments } = await req.json();

  if (!toolName || !toolArguments) {
    return new Response("Missing tool name or arguments", { status: 400 });
  }

  let mcpClient;
  try {
    const serverUrl = (() => {
      const base = process.env.MCP_SERVER_BASE_URL || process.env.MCP_SERVER_URL;
      if (server === "perplexity") return `${base}/perplexity/mcp`;
      if (server === "budget") return `${base}/budget/mcp`;
      return base!;
    })();

    if (!serverUrl) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing MCP server URL" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    mcpClient = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: serverUrl,
      },
    });

    const tools = await mcpClient.tools();
    const toolToCall = tools[toolName];

    if (!toolToCall) {
      throw new Error(`Tool "${toolName}" not found on MCP server.`);
    }

    const result = await toolToCall.execute(toolArguments);

    // Normalize response
    const body = JSON.stringify({ status: "ok", toolName, server, data: result });
    return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("MCP Tool Execution Error:", error);
    let errorMessage = "An unknown error occurred.";
    if (error instanceof MCPClientError) {
      errorMessage = `MCP Client Error: ${error.message}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new Response(
      JSON.stringify({ status: "error", toolName, server, message: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}


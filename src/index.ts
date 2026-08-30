#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ApiError } from "./client";
import {
  cancelEmailTool,
  getEmailTool,
  listEmailsTool,
  sendEmailTool,
} from "./tools/emails";
import { addDomainTool, listDomainsTool, verifyDomainTool } from "./tools/domains";
import {
  addSuppressionTool,
  listSuppressionsTool,
  removeSuppressionTool,
} from "./tools/suppressions";
import {
  listBroadcastsTool,
  previewBroadcastTool,
  sendBroadcastTool,
} from "./tools/broadcasts";

/**
 * The MCP SDK bundles its own copy of zod, so a schema built against our
 * dependency is structurally identical but nominally different. Describing the
 * shape loosely here keeps the tool definitions readable and colocated with
 * their handlers, at the cost of one cast at registration.
 */
interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const TOOLS: ToolDef[] = [
  sendEmailTool,
  listEmailsTool,
  getEmailTool,
  cancelEmailTool,
  listDomainsTool,
  addDomainTool,
  verifyDomainTool,
  listSuppressionsTool,
  addSuppressionTool,
  removeSuppressionTool,
  listBroadcastsTool,
  previewBroadcastTool,
  sendBroadcastTool,
];

const server = new McpServer({ name: "cn-emails", version: "0.1.0" });

for (const tool of TOOLS) {
  server.tool(
    tool.name,
    tool.description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool.schema as any,
    async (args: Record<string, unknown>) => {
      try {
        const result = await tool.handler(args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        // Surface the API's own message rather than a stack trace — an agent
        // can usually act on "domain not verified" but not on a bare 403.
        const message =
          e instanceof ApiError ? `${e.message} (HTTP ${e.status})` : (e as Error).message;
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error("cn-emails MCP server failed to start:", e);
  process.exit(1);
});

#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { withApiKey } from "./context";
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
import { getThreadTool, listThreadsTool, replyToMessageTool } from "./tools/threads";
import { listTemplatesTool, renderTemplateTool, sendTemplateTool } from "./tools/templates";
import { decideApprovalTool, listApprovalsTool } from "./tools/approvals";
import { emitEventTool, enrollTool, listAutomationsTool } from "./tools/automations";
import { getPreferencesTool, listTopicsTool, setPreferencesTool } from "./tools/topics";
import {
  addContactTool,
  countSegmentTool,
  getContactTool,
  listAudiencesTool,
  listSegmentsTool,
  updateContactTool,
} from "./tools/audiences";
import {
  batchSuppressTool,
  broadcastRecipientsTool,
  listApiKeysTool,
  listScheduledTool,
  listWebhookEventsTool,
  metricsTool,
} from "./tools/operations";

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
  listThreadsTool,
  getThreadTool,
  replyToMessageTool,
  listTemplatesTool,
  renderTemplateTool,
  sendTemplateTool,
  listApprovalsTool,
  decideApprovalTool,
  listAutomationsTool,
  enrollTool,
  emitEventTool,
  listTopicsTool,
  getPreferencesTool,
  setPreferencesTool,
  listAudiencesTool,
  addContactTool,
  getContactTool,
  updateContactTool,
  listSegmentsTool,
  countSegmentTool,
  metricsTool,
  listScheduledTool,
  batchSuppressTool,
  listWebhookEventsTool,
  broadcastRecipientsTool,
  listApiKeysTool,
];

/**
 * A server instance for one caller.
 *
 * Built per request rather than once at startup: over HTTP the tools act on
 * whichever workspace the request's key belongs to, so a shared instance would
 * be a shared identity.
 */
function buildServer(): McpServer {
  const server = new McpServer({
    name: "sendraven",
    title: "SendRaven",
    version: "0.1.0",
  });

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
  return server;
}

/* ---------------------------------------------------------------- stdio --- */

async function runStdio(): Promise<void> {
  const server = buildServer();
  await server.connect(new StdioServerTransport());
}

/* ----------------------------------------------------------------- http --- */

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "https://mcp.sendraven.ai";
const APP_URL = process.env.APP_URL || "https://sendraven.ai";

/**
 * Does this request need a key?
 *
 * Only `tools/call` does. `initialize` and `tools/list` are answered
 * anonymously on purpose: MCP registries and client directories probe with an
 * unauthenticated `tools/list`, and a blanket 401 makes a server look like it
 * exposes nothing at all. Every tool here still reaches the REST API, which
 * rejects an absent or invalid key on its own — the check below only decides
 * when to send the challenge.
 */
function requiresAuth(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((m) => (m as { method?: unknown } | null)?.method === "tools/call");
}

async function handleMcp(req: Request, res: Response, token: string): Promise<void> {
  const server = buildServer();
  // Stateless: one transport per request, no session to resume.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await withApiKey(token, async () => {
    await transport.handleRequest(req, res, req.body);
  });
}

function runHttp(): void {
  const port = Number(process.env.PORT || 5100);
  const app = express();
  app.use(express.json({ limit: "5mb" }));

  app.post("/mcp", async (req: Request, res: Response) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    if (!token && requiresAuth(req.body)) {
      // WWW-Authenticate tells a client how to fix this rather than just that
      // it failed. We have no OAuth server, so it points at the page where a
      // key is created — emitting OAuth discovery metadata for endpoints that
      // do not exist would send clients chasing 404s.
      res
        .status(401)
        .set("WWW-Authenticate", `Bearer realm="SendRaven", error="invalid_token"`)
        .json({
          error: "Unauthorized",
          message: `Send an API key as 'Authorization: Bearer sk_live_...'. Create one at ${APP_URL}/developers.`,
        });
      return;
    }

    await handleMcp(req, res, token);
  });

  // Streamable HTTP says a server with no SSE stream on GET, and no session to
  // DELETE, answers 405 — not 404. Registry health checks probe with GET, and
  // Express's default 404 reads as the server being down.
  const methodNotAllowed = (_req: Request, res: Response) =>
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.get("/healthz", (_req: Request, res: Response) => res.json({ ok: true }));

  app.listen(port, () => {
    console.error(`SendRaven MCP server listening on :${port} (${MCP_SERVER_URL})`);
  });
}

/* ----------------------------------------------------------------- main --- */

// stdio when asked for explicitly or when there is no PORT to bind, which is
// what an MCP client launching this as a subprocess looks like.
const useStdio = process.argv.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio";

if (useStdio) {
  runStdio().catch((e) => {
    console.error("SendRaven MCP server failed to start:", e);
    process.exit(1);
  });
} else {
  runHttp();
}

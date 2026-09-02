#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { withApiKey } from "./context";
import { ApiError } from "./client";
import { TOOLS } from "./tools";

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
const PUBLIC_API_URL =
  process.env.SENDRAVEN_API_URL || process.env.PUBLIC_API_URL || "https://api.sendraven.ai";

/** Kept in step with api-server/src/oauth/scopes.ts. */
const OAUTH_SCOPES = [
  "emails:send",
  "emails:read",
  "domains:read",
  "domains:write",
  "contacts:read",
  "contacts:write",
  "broadcasts:read",
  "broadcasts:write",
  "webhooks:read",
  "webhooks:write",
  "threads:read",
  "templates:read",
  "templates:write",
];

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

  // RFC 9728. After a 401 an MCP client reads this to find out where to send
  // the user to authorize.
  app.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
    res.json({
      resource: MCP_SERVER_URL,
      authorization_servers: [PUBLIC_API_URL],
      scopes_supported: OAUTH_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "SendRaven",
      resource_documentation: `${APP_URL}/docs`,
    });
  });

  // RFC 8414. Some clients probe the resource host for this before following
  // authorization_servers, so it is answered here as well as on the API.
  app.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
    res.json({
      issuer: PUBLIC_API_URL,
      authorization_endpoint: `${APP_URL}/oauth/authorize`,
      token_endpoint: `${PUBLIC_API_URL}/oauth/token`,
      registration_endpoint: `${PUBLIC_API_URL}/oauth/register`,
      revocation_endpoint: `${PUBLIC_API_URL}/oauth/revoke`,
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      scopes_supported: OAUTH_SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      // S256 only. "plain" offers no protection against an intercepted code,
      // which is the entire reason PKCE exists.
      code_challenge_methods_supported: ["S256"],
    });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    if (!token && requiresAuth(req.body)) {
      // Pointing at the protected-resource document is what starts the OAuth
      // flow in an MCP client: it reads this header, fetches the metadata, and
      // sends the user to the consent screen. A plain API key also works for
      // anyone who would rather paste one.
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${MCP_SERVER_URL}/.well-known/oauth-protected-resource"`,
        )
        .json({
          error: "Unauthorized",
          message: `Authorize this client, or send an API key as 'Authorization: Bearer sk_live_...' from ${APP_URL}/developers.`,
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
const useStdio =
  process.argv.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio" || !process.env.PORT;

if (useStdio) {
  runStdio().catch((e) => {
    console.error("SendRaven MCP server failed to start:", e);
    process.exit(1);
  });
} else {
  runHttp();
}

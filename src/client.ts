/**
 * Thin wrapper over the public REST API. The MCP server is a proxy, not a
 * second implementation — every tool here goes through the same endpoints,
 * auth and rate limits a customer's own integration would.
 */
import { currentApiKey } from "./context";

const BASE_URL =
  process.env.SENDRAVEN_API_URL || process.env.EMAILS_API_URL || "https://api.sendraven.ai";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = currentApiKey();
  if (!key) {
    throw new Error(
      "No API key. Over HTTP, send it as 'Authorization: Bearer sk_live_...'; " +
        "over stdio, set SENDRAVEN_API_KEY. Create one at /developers in the dashboard.",
    );
  }
  return key;
}

export async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = parsed?.error?.message ?? `${method} ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return parsed as T;
}

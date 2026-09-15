/**
 * Thin wrapper over the public REST API. The MCP server is a proxy, not a
 * second implementation — every tool here goes through the same endpoints,
 * auth and rate limits a customer's own integration would.
 */
import { currentApiKey } from "./context";

const BASE_URL =
  process.env.SENDRAVEN_API_URL || process.env.EMAILS_API_URL || "https://api.sendraven.ai";

/**
 * A refusal from the API, carrying its error `type` as well as its message.
 *
 * The tool descriptions tell a model what to do per type (`missing_variables`,
 * `invalid_state`, `idempotency_key_reused`...). Passing on only the message
 * and status left it to guess the type from the wording, and a 409 or a 422
 * each stand for several conditions that call for different next steps.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly type?: string,
    /** `missing` on missing_variables; `details` (zod issues) on invalid_request. */
    readonly extra: { missing?: string[]; details?: unknown } = {},
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
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let parsed: { error?: { type?: string; message?: string; missing?: unknown; details?: unknown } } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // A proxy or load balancer error page is not JSON; report the status instead.
    if (res.ok) throw new ApiError(`${method} ${path} returned a body that is not JSON`, res.status);
  }

  if (!res.ok) {
    const err = parsed?.error;
    const message = err?.message ?? `${method} ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status, err?.type, {
      ...(Array.isArray(err?.missing) ? { missing: err.missing.map(String) } : {}),
      ...(err?.details !== undefined ? { details: err.details } : {}),
    });
  }

  return parsed as unknown as T;
}

/** The Idempotency-Key header for a send, when the caller gave one. */
export function idempotencyHeader(key: unknown): Record<string, string> {
  return typeof key === "string" && key.length > 0 ? { "Idempotency-Key": key } : {};
}

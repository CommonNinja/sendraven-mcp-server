import { z } from "zod";
import { request } from "../client";

export const listSuppressionsTool = {
  name: "list_suppressions",
  description:
    "List addresses we refuse to mail and why (hard_bounce, complaint, unsubscribe, manual, " +
    "list_hygiene), newest first, each with its scope. When someone reports not receiving " +
    "email, this shows whether the address is suppressed. email returns one address's suppressions directly; scanning pages " +
    "instead is how the wrong suppression gets cleared. At most 100 per call; while has_more is " +
    "true, next_cursor passed back as cursor returns the next page.",
  schema: {
    email: z.string().optional().describe("One address: every scope it is suppressed for"),
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    for (const k of ["email", "limit", "cursor"]) {
      if (args[k] !== undefined) qs.set(k, String(args[k]));
    }
    return request("GET", `/v1/suppressions?${qs}`);
  },
};

export const addSuppressionTool = {
  name: "add_suppression",
  description:
    "Stop sending to an address. Scope 'marketing' leaves transactional mail working; the " +
    "default is 'all'. Reason 'unsubscribe' is a real opt-out: it also cancels the person's " +
    "queued scheduled sends and ends their automation enrolments, which is what a person who " +
    "asked to stop expects and 'manual' does not do. A hard bounce or complaint already on file is never replaced; the " +
    "response is the stored suppression (id, email, reason, scope, detail, created_at), so its " +
    "reason says which one stands.",
  schema: {
    email: z.string().email(),
    scope: z.enum(["all", "transactional", "marketing"]).optional().describe("Defaults to all"),
    reason: z
      .enum(["manual", "list_hygiene", "unsubscribe"])
      .optional()
      .describe("Defaults to manual. unsubscribe also cancels queued mail and ends enrolments"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/suppressions", args),
};

export const removeSuppressionTool = {
  name: "remove_suppression",
  description:
    "Remove a suppression so the address can be mailed again. A hard bounce means the address " +
    "was rejected by the receiving server, and re-sending raises the bounce rate that AWS " +
    "enforces on. The scope must match the stored one: removed: false means nothing " +
    "was suppressed in that scope (an address suppressed for 'marketing' is not lifted by " +
    "'all'); list_suppressions with email shows the scope that is stored.",
  schema: {
    email: z.string().email(),
    scope: z.enum(["all", "transactional", "marketing"]).optional().describe("Defaults to all"),
  },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/suppressions/${encodeURIComponent(String(args.email))}?scope=${args.scope ?? "all"}`),
};

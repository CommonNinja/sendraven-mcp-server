import { z } from "zod";
import { request } from "../client";

export const listSuppressionsTool = {
  name: "list_suppressions",
  description:
    "List addresses we refuse to mail and why (hard_bounce, complaint, unsubscribe, manual). " +
    "Check here first when someone reports not receiving email.",
  schema: { limit: z.number().int().min(1).max(500).optional() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/suppressions?limit=${args.limit ?? 100}`),
};

export const addSuppressionTool = {
  name: "add_suppression",
  description: "Stop sending to an address. Scope 'marketing' leaves transactional mail working.",
  schema: {
    email: z.string().email(),
    scope: z.enum(["all", "transactional", "marketing"]).optional(),
    reason: z.enum(["manual", "list_hygiene", "unsubscribe"]).optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/suppressions", args),
};

export const removeSuppressionTool = {
  name: "remove_suppression",
  description:
    "Remove a suppression so the address can be mailed again. Be careful with hard bounces — " +
    "the address was rejected by the receiving server, and re-sending raises the bounce rate " +
    "that AWS enforces on.",
  schema: {
    email: z.string().email(),
    scope: z.enum(["all", "transactional", "marketing"]).optional(),
  },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/suppressions/${encodeURIComponent(String(args.email))}?scope=${args.scope ?? "all"}`),
};

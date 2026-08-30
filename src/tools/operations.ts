import { z } from "zod";
import { request } from "../client";

export const metricsTool = {
  name: "get_email_metrics",
  description:
    "Delivery and engagement over a window. Open and click rates are over delivered, not " +
    "sent — a low open rate with a high bounce rate is a deliverability problem, not an " +
    "engagement one.",
  schema: { days: z.number().int().min(1).max(365).optional().describe("Defaults to 30") },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/emails/metrics?days=${args.days ?? 30}`),
};

export const listScheduledTool = {
  name: "list_scheduled_emails",
  description:
    "Messages queued to send later but not yet sent. Cancel one with cancel_scheduled_email.",
  schema: { limit: z.number().int().min(1).max(200).optional() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/emails?status=scheduled&limit=${args.limit ?? 50}`),
};

export const batchSuppressTool = {
  name: "suppress_many",
  description:
    "Stop sending to many addresses at once — the path for importing another provider's " +
    "unsubscribe list before a first campaign. Without it, everyone who already opted out " +
    "there gets mailed again here.",
  schema: {
    emails: z.array(z.string().email()).max(10000),
    scope: z.enum(["all", "transactional", "marketing"]).optional(),
    reason: z.enum(["manual", "list_hygiene", "unsubscribe"]).optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/suppressions/batch", args),
};

export const listWebhookEventsTool = {
  name: "list_webhook_deliveries",
  description:
    "Recent delivery attempts for a webhook endpoint, with status codes and errors. This " +
    "is how to tell 'we never sent it' from 'your endpoint returned 500'.",
  schema: { endpoint_id: z.string(), limit: z.number().int().min(1).max(200).optional() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/webhook-endpoints/${args.endpoint_id}/events?limit=${args.limit ?? 50}`),
};

export const broadcastRecipientsTool = {
  name: "list_broadcast_recipients",
  description: "Who a campaign reached and what happened to each message.",
  schema: { id: z.string(), limit: z.number().int().min(1).max(1000).optional() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/broadcasts/${args.id}/recipients?limit=${args.limit ?? 200}`),
};

export const listApiKeysTool = {
  name: "list_api_keys",
  description:
    "List this workspace's API keys with their scopes and limits. Never returns key values.",
  schema: {},
  handler: async () => request("GET", "/v1/api-keys"),
};

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
    "Messages queued to send later but not yet sent, newest first. Cancel one with " +
    "cancel_scheduled_email. At most 100 per call; while has_more is true, pass next_cursor back " +
    "as cursor.",
  schema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams({ status: "scheduled", limit: String(args.limit ?? 50) });
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    return request("GET", `/v1/emails?${qs}`);
  },
};

export const batchSuppressTool = {
  name: "suppress_many",
  description:
    "Stop sending to many addresses at once — the path for importing another provider's " +
    "unsubscribe list before a first campaign. Without it, everyone who already opted out " +
    "there gets mailed again here. Note the defaults differ from add_suppression: scope " +
    "'marketing' and reason 'list_hygiene'. Pass reason 'unsubscribe' for a list of opt-outs; " +
    "that also cancels their queued scheduled sends and ends their automation enrolments. " +
    "Addresses are de-duplicated; the response counts suppressed and duplicates.",
  schema: {
    emails: z.array(z.string().email()).min(1).max(10000),
    scope: z.enum(["all", "transactional", "marketing"]).optional().describe("Defaults to marketing"),
    reason: z
      .enum(["manual", "list_hygiene", "unsubscribe"])
      .optional()
      .describe("Defaults to list_hygiene. unsubscribe also cancels queued mail and ends enrolments"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/suppressions/batch", args),
};

export const listWebhookEventsTool = {
  name: "list_webhook_deliveries",
  description:
    "Recent delivery attempts for a webhook endpoint: each with event, status, attempts, " +
    "last_status_code, last_error and delivered_at (null until it succeeds). This " +
    "is how to tell 'we never sent it' from 'your endpoint returned 500'. Newest first, the most " +
    "recent `limit` only; not paged.",
  schema: {
    endpoint_id: z.string(),
    limit: z.number().int().min(1).max(200).optional().describe("1 to 200; defaults to 50"),
  },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/webhook-endpoints/${args.endpoint_id}/events?limit=${args.limit ?? 50}`),
};

export const broadcastRecipientsTool = {
  name: "list_broadcast_recipients",
  description:
    "Who a campaign reached and what happened to each message, with the A/B variant when there " +
    "is one. At most 200 per call; while has_more is true, pass next_cursor (a message id) back " +
    "as cursor.",
  schema: {
    id: z.string().describe("The campaign's id from create_broadcast or list_broadcasts (a UUID), not its name"),
    limit: z.number().int().min(1).max(200).optional().describe("Page size, 1 to 200; defaults to 200"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams({ limit: String(args.limit ?? 200) });
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    return request("GET", `/v1/broadcasts/${args.id}/recipients?${qs}`);
  },
};

export const getUsageTool = {
  name: "get_usage",
  description:
    "This workspace's plan, what it has sent this billing period, what the period costs so far, " +
    "and — the fields worth branching on — sending_locked and lock_reason, which name the exact " +
    "402 a send would be refused with right now. Check it before a large batch or campaign: on " +
    "Free a send that would cross the 3,000 included emails is refused whole, and a workspace " +
    "with no verified payment method cannot send at all, on any plan. lock_reason " +
    "payment_method_required is the one no tool can fix — say so and stop, because only a person " +
    "can add a payment method in the dashboard. Pricing is one meter, outbound emails sent: " +
    "contacts and inbound replies are never counted, and estimated_cents is what the period " +
    "costs on exactly the curve the invoice uses.",
  schema: {},
  handler: async () => request("GET", "/v1/usage"),
};

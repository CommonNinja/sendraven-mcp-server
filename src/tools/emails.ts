import { z } from "zod";
import { request } from "../client";

export const sendEmailTool = {
  name: "send_email",
  description:
    "Send a transactional email, immediately or scheduled. Use scheduled_at with a relative " +
    "phrase like 'in 3 days' or an ISO timestamp. The From domain must already be verified.",
  schema: {
    from: z.string().describe("Sender address on a verified domain, e.g. 'Team <team@mail.example.com>'"),
    to: z
      .string()
      .describe(
        "Recipient address, or 'Ana Lima <ana@example.com>' to show their name in the To line. " +
          "Suppressions and opt-outs match the address either way",
      ),
    subject: z.string(),
    html: z.string().optional().describe("HTML body; provide html, text, or both"),
    text: z.string().optional(),
    scheduled_at: z.string().optional().describe("'in 3 days' or an ISO 8601 timestamp"),
  },
  handler: async (args: Record<string, unknown>) =>
    request("POST", "/v1/emails", args),
};

const MESSAGE_STATUSES = [
  "queued",
  "scheduled",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "rejected",
  "canceled",
  "failed",
] as const;

export const listEmailsTool = {
  name: "list_emails",
  description:
    "List messages newest first with their delivery status, including held, scheduled, skipped " +
    "and failed ones and the mail campaigns and automations sent. Filter by status or recipient. " +
    "Paged: at most 100 per call; while has_more is true, pass next_cursor back as cursor with " +
    "the same filters. An unknown status is refused with 422 rather than answering an empty log.",
  schema: {
    status: z
      .enum(MESSAGE_STATUSES)
      .optional()
      .describe(
        "rejected: every recipient was suppressed or opted out, so nothing was sent. canceled: a " +
          "scheduled send was cancelled. failed: the provider refused it, or a scheduled send could not go out",
      ),
    to: z.string().optional().describe("Filter to one recipient address"),
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams(
      Object.entries(args)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)] as [string, string]),
    );
    return request("GET", `/v1/emails?${qs}`);
  },
};

export const getEmailTool = {
  name: "get_email",
  description:
    "Fetch one message with its full event timeline (send, delivery, bounce, complaint, " +
    "open, click). This is the tool to reach for when asked why an email didn't arrive.",
  schema: { id: z.string().describe("Message id") },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/emails/${args.id}`),
};

export const cancelEmailTool = {
  name: "cancel_scheduled_email",
  description:
    "Cancel a scheduled email before it sends. Only works while status is 'scheduled': a message " +
    "that has already started sending, or is in any other state, answers 409 not_cancelable.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("DELETE", `/v1/emails/${args.id}`),
};

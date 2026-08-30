import { z } from "zod";
import { request } from "../client";

export const sendEmailTool = {
  name: "send_email",
  description:
    "Send a transactional email, immediately or scheduled. Use scheduled_at with a relative " +
    "phrase like 'in 3 days' or an ISO timestamp. The From domain must already be verified.",
  schema: {
    from: z.string().describe("Sender address on a verified domain, e.g. 'Team <team@mail.example.com>'"),
    to: z.string().email().describe("Recipient address"),
    subject: z.string(),
    html: z.string().optional().describe("HTML body; provide html, text, or both"),
    text: z.string().optional(),
    scheduled_at: z.string().optional().describe("'in 3 days' or an ISO 8601 timestamp"),
  },
  handler: async (args: Record<string, unknown>) =>
    request("POST", "/v1/emails", args),
};

export const listEmailsTool = {
  name: "list_emails",
  description:
    "List recent messages with their delivery status. Filter by status " +
    "(queued, scheduled, sent, delivered, bounced, complained, rejected) or recipient.",
  schema: {
    status: z.string().optional(),
    to: z.string().optional().describe("Filter to one recipient address"),
    limit: z.number().int().min(1).max(200).optional(),
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
  description: "Cancel a scheduled email before it sends. Only works while status is 'scheduled'.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("DELETE", `/v1/emails/${args.id}`),
};

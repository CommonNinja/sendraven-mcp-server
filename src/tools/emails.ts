import { z } from "zod";
import { idempotencyHeader, request } from "../client";

/**
 * The Idempotency-Key for a send, shared by every tool that posts to /v1/emails.
 * A retry after a timeout is the commonest way an agent mails someone twice.
 */
export const IDEMPOTENCY_KEY = z
  .string()
  .min(1)
  .max(255)
  .optional()
  .describe(
    "Optional. Any unique string for this one message, e.g. 'welcome-ana-2026-09-15'. Retrying " +
      "with the same key and the identical arguments returns the first answer instead of " +
      "sending again. Never reuse a key for a different message: that is refused with 422 " +
      "idempotency_key_reused and nothing is sent. 409 idempotency_in_progress means the first " +
      "attempt is still running; wait a few seconds and retry with the same key",
  );

/**
 * The refusals every send can hit, named once so the three send tools agree.
 * Keep in step with the error vocabulary in CLAUDE.md.
 */
export const SEND_ERRORS =
  "Refusals, by type: 422 no_verified_identity (the From domain has no verified sending domain; " +
  "add and verify it, retrying will not help); 422 invalid_request (a bad field, or more than " +
  "50 recipients across to, cc and bcc: split it into separate messages or use a campaign); " +
  "422 unknown_topic; 422 invalid_schedule; 403 recipient_not_allowed (this key's allowlist); " +
  "429 daily_limit (this key's daily cap; wait for tomorrow, do not retry now); four billing " +
  "refusals, all 402 and none retryable — plan_limit_reached (the Free plan's 3,000 emails a " +
  "month are spent; a person has to activate paid sending), payment_method_required (the " +
  "workspace has never had a payment method verified, so no outbound email leaves it at all, " +
  "including on Free; only a person can add one in the dashboard), billing_past_due (the " +
  "payment failed for good) and budget_exceeded (the workspace's own spend ceiling; by default " +
  "it stops marketing and lets transactional through); 422 " +
  "workspace_suspended and 422 no_postal_address (a person has to act). 502 ses_error is the " +
  "provider; retrying later with the same idempotency_key is safe. Call get_usage to see which " +
  "of these applies before sending, and stop rather than looping on any of them.";

export const sendEmailTool = {
  name: "send_email",
  description:
    "Send a transactional email, immediately or scheduled. Use scheduled_at with a relative " +
    "phrase like 'in 3 days' or an ISO timestamp. The From domain must already be verified. " +
    "Every accepted send answers with the same fields: id, status, thread_id, scheduled_at, " +
    "skipped, reason and approval_id. skipped: true (status 'rejected', with reason) means every " +
    "recipient was suppressed or opted out and nothing was sent; do not retry. status " +
    "'pending_approval' (with approval_id) means a person must release it; do not retry. " +
    "Otherwise skipped is false and reason and approval_id are null. Pass idempotency_key " +
    "whenever you might retry, and reuse it only for the identical message. " +
    SEND_ERRORS,
  schema: {
    from: z.string().describe("Sender address on a verified domain, e.g. 'Team <team@mail.example.com>'"),
    to: z
      .string()
      .describe(
        "Recipient address, or 'Ana Lima <ana@example.com>' to show their name in the To line. " +
          "Suppressions and opt-outs match the address either way",
      ),
    cc: z
      .array(z.string())
      .max(49)
      .optional()
      .describe("Cc addresses, each an address or 'Name <address>'. to, cc and bcc together hold at most 50"),
    bcc: z
      .array(z.string())
      .max(49)
      .optional()
      .describe("Bcc addresses. Each is a recipient: it counts toward the 50, the key's allowlist and its daily limit"),
    subject: z.string(),
    html: z.string().optional().describe("HTML body; provide html, text, or both"),
    text: z.string().optional(),
    scheduled_at: z.string().optional().describe("'in 3 days' or an ISO 8601 timestamp"),
    idempotency_key: IDEMPOTENCY_KEY,
  },
  handler: async (args: Record<string, unknown>) => {
    const { idempotency_key, ...body } = args;
    return request("POST", "/v1/emails", body, idempotencyHeader(idempotency_key));
  },
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
    "the same filters. An unknown status is refused with 422 invalid_request rather than answering an empty log.",
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
    "that has already started sending, or is in any other state, answers 409 invalid_state " +
    "naming its status; do not retry, read it with get_email instead. An unknown id answers 404 " +
    "not_found.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("DELETE", `/v1/emails/${args.id}`),
};

import { z } from "zod";
import { request } from "../client";

export const listApprovalsTool = {
  name: "list_pending_approvals",
  description:
    "List messages held for human approval, with their full content. A key configured to " +
    "require approval drafts rather than sends; a person releases it. A send that returned " +
    "status 'pending_approval' is waiting here, and retrying the send does not release it. Oldest first, each " +
    "with its expires_at; an expired approval drops out of the list and can no longer be decided.",
  schema: {},
  handler: async () => request("GET", "/v1/approvals"),
};

export const decideApprovalTool = {
  name: "decide_approval",
  description:
    "Approve or reject a held message. Approving releases it: it sends now, or at its " +
    "scheduled_at when the draft was scheduled for later. If every recipient unsubscribed or was " +
    "suppressed while it waited, nothing is sent and the answer says skipped: true with a reason " +
    "(both always present: false and null otherwise, beside scheduled_at). The approval hold " +
    "exists so that a person, not an agent, makes this decision; decided_by records the person " +
    "who authorised it. The API enforces that with 403 forbidden for: a client " +
    "connected by signing in (an OAuth access token, which is how a remote MCP connection " +
    "usually authenticates), the key that drafted the message, and any key with guardrails " +
    "(requires_approval, allowed_recipients or a daily_send_limit). Approvals are decided by a " +
    "person in the dashboard or by an API key without guardrails, so after a 403 the decision " +
    "can only be made in the dashboard; retrying or switching tools does not get past it. 409 " +
    "invalid_state means it was already decided or has expired; list_pending_approvals shows " +
    "what is still pending, and a retry answers the same. 409 approval_in_progress means it is " +
    "being released right now, and its outcome is known a moment later. A release the send path refuses (402 plan_limit_reached or another 402 billing " +
    "refusal, 422 warmup_limit, 422 " +
    "no_verified_identity when its sending domain was removed) leaves the approval pending with " +
    "that error, so it can be approved again once fixed. A held marketing message naming more " +
    "than one recipient is refused with 422 invalid_request and stays pending: marketing mail " +
    "carries each recipient's own unsubscribe link, so it can never be released, and rejecting " +
    "it is the only decision that succeeds.",
  schema: {
    id: z.string().describe("The approval's id from list_pending_approvals, not the message_id"),
    decision: z.enum(["approve", "reject"]),
    decided_by: z.string().min(1).max(200).describe("Who authorised this decision"),
    reason: z.string().max(500).optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/approvals/${id}`, body);
  },
};

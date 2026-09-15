import { z } from "zod";
import { request } from "../client";

export const listApprovalsTool = {
  name: "list_pending_approvals",
  description:
    "List messages held for human approval, with their full content. A key configured to " +
    "require approval drafts rather than sends; a person releases it. If your send returned " +
    "status 'pending_approval', it is waiting here — do not retry the send. Oldest first, each " +
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
    "(both always present: false and null otherwise, beside scheduled_at). Only use this when a " +
    "human has explicitly told you which decision to make — the hold exists precisely so that " +
    "an agent is not the one deciding. The API enforces that: the key that drafted the message, " +
    "or any key that itself requires approval, gets 403 forbidden. An approval already decided " +
    "or expired answers 409. A release the send path refuses (plan allowance, warm-up limit) " +
    "leaves the approval pending with that error.",
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

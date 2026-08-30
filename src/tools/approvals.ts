import { z } from "zod";
import { request } from "../client";

export const listApprovalsTool = {
  name: "list_pending_approvals",
  description:
    "List messages held for human approval, with their full content. A key configured to " +
    "require approval drafts rather than sends; a person releases it. If your send returned " +
    "status 'pending_approval', it is waiting here — do not retry the send.",
  schema: {},
  handler: async () => request("GET", "/v1/approvals"),
};

export const decideApprovalTool = {
  name: "decide_approval",
  description:
    "Approve or reject a held message. Approving sends it immediately. Only use this when a " +
    "human has explicitly told you which decision to make — the hold exists precisely so that " +
    "an agent is not the one deciding.",
  schema: {
    id: z.string(),
    decision: z.enum(["approve", "reject"]),
    decided_by: z.string().describe("Who authorised this decision"),
    reason: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/approvals/${id}`, body);
  },
};

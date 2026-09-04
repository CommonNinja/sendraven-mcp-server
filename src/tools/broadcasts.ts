import { z } from "zod";
import { request } from "../client";

export const listBroadcastsTool = {
  name: "list_broadcasts",
  description:
    "List campaigns with their status and send progress. A campaign showing 'paused' is not " +
    "broken: it ran out of the day's sending quota part way and is waiting to continue. Use " +
    "get_broadcast to see how much is left, and resume_broadcast to continue it now.",
  schema: {},
  handler: async () => request("GET", "/v1/broadcasts"),
};

export const previewBroadcastTool = {
  name: "preview_broadcast",
  description:
    "How many contacts a campaign would reach, and whether the reputation gate would allow it. " +
    "Always run this before sending — it is the only way to see the size of a campaign without " +
    "starting it.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/broadcasts/${args.id}/preview`),
};

export const getBroadcastTool = {
  name: "get_broadcast",
  description:
    "One campaign, with a 'progress' object while it is sending or paused: how many addresses " +
    "are still pending, sent, failed, or skipped because the person opted out after the " +
    "campaign started. This is how you tell a paused campaign that is still making progress " +
    "from one waiting on quota.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/broadcasts/${args.id}`),
};

export const resumeBroadcastTool = {
  name: "resume_broadcast",
  description:
    "Continue a campaign left 'paused' by the daily sending quota. It mails only the addresses " +
    "still pending — the audience was frozen when the campaign started and everyone already " +
    "reached is marked — so calling this twice cannot double-send. Only works on a paused " +
    "campaign; anything else answers 409. A background worker also resumes paused campaigns on " +
    "its own once quota frees up, so use this only when waiting is not acceptable.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/broadcasts/${args.id}/resume`),
};

export const sendBroadcastTool = {
  name: "send_broadcast",
  description:
    "Send a campaign now, or schedule it with scheduled_at. This mails every contact in the " +
    "segment and cannot be undone once started — run preview_broadcast first. A campaign bigger " +
    "than the day's remaining quota is not rejected: it sends what it can and stops as 'paused', " +
    "then continues later. That is expected, not an error to retry.",
  schema: {
    id: z.string(),
    scheduled_at: z.string().optional().describe("ISO 8601 timestamp; omit to send now"),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/broadcasts/${id}/send`, body);
  },
};

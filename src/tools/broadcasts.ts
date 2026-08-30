import { z } from "zod";
import { request } from "../client";

export const listBroadcastsTool = {
  name: "list_broadcasts",
  description: "List campaigns with their status and send progress.",
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

export const sendBroadcastTool = {
  name: "send_broadcast",
  description:
    "Send a campaign now, or schedule it with scheduled_at. This mails every contact in the " +
    "segment and cannot be undone once started — run preview_broadcast first.",
  schema: {
    id: z.string(),
    scheduled_at: z.string().optional().describe("ISO 8601 timestamp; omit to send now"),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/broadcasts/${id}/send`, body);
  },
};

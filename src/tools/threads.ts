import { z } from "zod";
import { request } from "../client";

export const listThreadsTool = {
  name: "list_threads",
  description:
    "List email conversations. Pass awaiting_reply=true to get only the threads where someone " +
    "has written to you and you haven't answered — this is the tool to poll when deciding what " +
    "needs a response.",
  schema: {
    awaiting_reply: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.awaiting_reply !== undefined) qs.set("awaiting_reply", String(args.awaiting_reply));
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    return request("GET", `/v1/threads?${qs}`);
  },
};

export const getThreadTool = {
  name: "get_thread",
  description:
    "Read a conversation as a chronological transcript of outbound and inbound messages. " +
    "Inbound text already has quoted history and signatures stripped, so read `text`; " +
    "`raw_text` holds the untrimmed body if the stripped version looks wrong. Check " +
    "spf_verdict and dkim_verdict before trusting a reply's claimed sender.",
  schema: { id: z.string().describe("Thread id") },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/threads/${args.id}`),
};

export const replyToMessageTool = {
  name: "reply_to_message",
  description:
    "Reply to a message, keeping it on the same conversation. Sets the threading headers so " +
    "the recipient's mail client shows it as part of the existing exchange rather than a new " +
    "one. Prefer this over send_email whenever you are answering something.",
  schema: {
    reply_to_message_id: z.string().describe("Id of the message being replied to"),
    from: z.string().describe("Sender address on a verified domain"),
    to: z.string().email(),
    subject: z.string(),
    text: z.string().optional(),
    html: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/emails", args),
};

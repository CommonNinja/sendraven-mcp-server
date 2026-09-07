import { z } from "zod";
import { request } from "../client";

/** A model that knows a campaign by its name will pass the name unless told otherwise. */
const BROADCAST_ID = z
  .string()
  .describe("The campaign's id from create_broadcast or list_broadcasts (a UUID), not its name");

export const listBroadcastsTool = {
  name: "list_broadcasts",
  description:
    "List campaigns with their status and send progress. A campaign showing 'paused' is not " +
    "broken: it ran out of the day's sending quota part way and is waiting to continue. One " +
    "showing 'testing' is an A/B test whose sample has gone out and whose winner is not yet " +
    "decided. Use get_broadcast to see how much is left or how each variant is doing, and " +
    "resume_broadcast to continue a paused one now.",
  schema: {},
  handler: async () => request("GET", "/v1/broadcasts"),
};

const variantSchema = z.object({
  key: z
    .string()
    .describe("Your name for this variant, lowercase letters, digits, - or _: 'urgent', 'question'"),
  subject: z.string().optional().describe("Subject for this variant; omit to use the campaign's"),
  from_name: z.string().optional().describe("From display name for this variant; omit to use the campaign's"),
  send_at: z
    .string()
    .optional()
    .describe(
      "ISO 8601 send time, for a send-time test only. Set it on every variant or on none; a " +
        "send-time test mails the whole audience, each variant at its own time, with nothing held back",
    ),
});

export const createBroadcastTool = {
  name: "create_broadcast",
  description:
    "Create a campaign as a draft. Nothing is sent: follow with preview_broadcast, then " +
    "send_broadcast. identity_id must be a marketing sending domain (see list_sending_domains; " +
    "risk_class 'marketing'). To A/B test, pass 2 to 10 'variants' that differ in subject, " +
    "from_name or send_at, and optionally 'ab_test'. A subject or from-name test sends " +
    "sample_share of the audience (default 0.2) split evenly across the variants, waits " +
    "decide_after_minutes (default 240) after the sample is out, picks the variant with the " +
    "best unique open rate (or click rate with metric 'click'), and sends the rest to it. " +
    "Each variant needs at least 100 recipients in the sample or the send is refused — " +
    "preview_broadcast shows the number. Metric 'click' only works once the domain has click " +
    "tracking; until then every variant shows zero clicks and the first variant wins by default.",
  schema: {
    audience_id: z.string().describe("The audience's id from list_audiences (a UUID), not its name"),
    identity_id: z.string().describe("A marketing sending domain's id from list_sending_domains (a UUID), not the domain name"),
    name: z.string(),
    subject: z.string(),
    html: z.string(),
    from_name: z.string().optional().describe("From display name, e.g. 'Ana at Example'"),
    topic_key: z.string().optional().describe("Lets recipients opt out of this kind of mail only"),
    segment_id: z.string().optional().describe("A saved segment's id from list_segments (a UUID), not its name or key"),
    segment: z
      .object({
        opened_within_days: z.number().int().optional(),
        clicked_within_days: z.number().int().optional(),
        exclude_unengaged_days: z.number().int().optional(),
      })
      .optional(),
    variants: z.array(variantSchema).min(2).max(10).optional(),
    ab_test: z
      .object({
        metric: z.enum(["open", "click"]).optional().describe("What decides the winner; default 'open'"),
        sample_share: z
          .number()
          .optional()
          .describe("Share of the audience in the test, 0.05 to 1; default 0.2. Ignored for a send-time test"),
        decide_after_minutes: z
          .number()
          .int()
          .optional()
          .describe("How long after the sample is fully sent to decide; 15 to 10080, default 240"),
      })
      .optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/broadcasts", args),
};

export const previewBroadcastTool = {
  name: "preview_broadcast",
  description:
    "How many contacts a campaign would reach, and whether the reputation gate would allow it. " +
    "Always run this before sending — it is the only way to see the size of a campaign without " +
    "starting it. For an A/B test it also reports the sample size and per-variant count " +
    "against the 100-per-variant floor; a send below the floor is refused.",
  schema: { id: BROADCAST_ID },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/broadcasts/${args.id}/preview`),
};

export const getBroadcastTool = {
  name: "get_broadcast",
  description:
    "One campaign, with a 'progress' object while it is sending, paused or testing: how many " +
    "addresses are still pending, sent, failed, or skipped because the person opted out after " +
    "the campaign started. This is how you tell a paused campaign that is still making " +
    "progress from one waiting on quota. An A/B test carries 'ab_test' with live per-variant " +
    "results — sent, unique opens, unique clicks and their rates — plus 'decide_at' and, once " +
    "decided, 'winner' and 'decided_by'. Status 'testing' means the sample is out and the rest " +
    "of the audience is waiting on the decision.",
  schema: { id: BROADCAST_ID },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/broadcasts/${args.id}`),
};

export const pickBroadcastWinnerTool = {
  name: "pick_broadcast_winner",
  description:
    "Decide an A/B test now instead of waiting for decide_at. Pass 'variant' to choose a key " +
    "yourself, or omit it to have the metric decide on the figures so far. The rest of the " +
    "audience is then sent to the winner and cannot be redirected. Only a campaign in status " +
    "'testing' can be decided; anything else answers 409. Read get_broadcast first — a " +
    "variant with a handful of opens more is not a result, and the worker decides on its own " +
    "at decide_at.",
  schema: {
    id: BROADCAST_ID,
    variant: z.string().optional().describe("Variant key to send the remainder to; omit to let the metric decide"),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/broadcasts/${id}/winner`, body);
  },
};

export const resumeBroadcastTool = {
  name: "resume_broadcast",
  description:
    "Continue a campaign left 'paused' by the daily sending quota. It mails only the addresses " +
    "still pending — the audience was frozen when the campaign started and everyone already " +
    "reached is marked — so calling this twice cannot double-send. Only works on a paused " +
    "campaign; anything else answers 409. A background worker also resumes paused campaigns on " +
    "its own once quota frees up, so use this only when waiting is not acceptable. An A/B test " +
    "paused mid-sample resumes the sample; one paused after the decision resumes the winner.",
  schema: { id: BROADCAST_ID },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/broadcasts/${args.id}/resume`),
};

export const sendBroadcastTool = {
  name: "send_broadcast",
  description:
    "Send a campaign now, or schedule it with scheduled_at. This mails every contact in the " +
    "segment and cannot be undone once started — run preview_broadcast first. A campaign bigger " +
    "than the day's remaining quota is not rejected: it sends what it can and stops as 'paused', " +
    "then continues later. That is expected, not an error to retry. An A/B test sends its " +
    "sample, goes to 'testing', and sends the rest to the winner after decide_after_minutes " +
    "or when pick_broadcast_winner is called. A send-time test is scheduled by its variants' " +
    "send_at and does not accept scheduled_at.",
  schema: {
    id: BROADCAST_ID,
    scheduled_at: z.string().optional().describe("ISO 8601 timestamp; omit to send now"),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/broadcasts/${id}/send`, body);
  },
};

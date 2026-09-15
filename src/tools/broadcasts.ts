import { z } from "zod";
import { request } from "../client";

/** A model that knows a campaign by its name will pass the name unless told otherwise. */
const BROADCAST_ID = z
  .string()
  .describe("The campaign's id from create_broadcast or list_broadcasts (a UUID), not its name");

export const listBroadcastsTool = {
  name: "list_broadcasts",
  description:
    "List campaigns, newest first, with their status. Paged: at most 100 per call; while " +
    "has_more is true, pass next_cursor back as cursor. List rows carry no html and progress is " +
    "always null in them: use get_broadcast to read a campaign's html or how far it has got. " +
    "Every field is snake_case and always present, null when unset. A campaign showing " +
    "'paused' is not broken; read its pause_reason. A quota or interrupted pause continues on its " +
    "own. A warm-up pause is the sending domain's daily allowance protecting its reputation: it " +
    "resumes on its own at resume_after and cannot be resumed before then. A pause for no postal " +
    "address needs a person to add one in Settings, and one for a suspended workspace needs " +
    "sending restored; either way the campaign then continues on its own. One showing 'testing' " +
    "is an A/B test whose sample has gone out and whose winner is not yet decided.",
  schema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    const q = qs.toString();
    return request("GET", `/v1/broadcasts${q ? `?${q}` : ""}`);
  },
};

/**
 * What the calling key's guardrails do to a campaign. An audience cannot be
 * held for approval or held to an allowlist, so those keys cannot start one.
 */
const CAMPAIGN_KEY_GUARDRAILS =
  "The calling API key's guardrails apply: a key that holds its sends for approval " +
  "(requires_approval) or has allowed_recipients gets 403 forbidden, because a campaign cannot " +
  "be held for approval or kept to an allowlist. Retrying will not help; a person sends it from " +
  "the dashboard, or uses a key without those guardrails.";

const variantSchema = z.object({
  key: z
    .string()
    .max(32)
    .describe("Your name for this variant, lowercase letters, digits, - or _: 'urgent', 'question'"),
  subject: z.string().min(1).max(998).optional().describe("Subject for this variant; omit to use the campaign's"),
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
    "risk_class 'marketing'). topic_key must name an existing topic (list_topics); an unknown one " +
    "is refused with 422 unknown_topic, since it would count everyone as opted out. A segment_id " +
    "must filter the same audience as audience_id. To A/B test, pass 2 to 10 'variants' that differ in subject, " +
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
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(998),
    html: z.string().min(1),
    from_name: z.string().optional().describe("From display name, e.g. 'Ana at Example'"),
    topic_key: z
      .string()
      .optional()
      .describe("An existing topic's key from list_topics. Lets recipients opt out of this kind of mail only"),
    segment_id: z.string().optional().describe("A saved segment's id from list_segments (a UUID), not its name or key"),
    segment: z
      .object({
        opened_within_days: z.number().int().min(1).max(3650).optional(),
        clicked_within_days: z.number().int().min(1).max(3650).optional(),
        exclude_unengaged_days: z.number().int().min(1).max(3650).optional(),
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
    "progress from one that is waiting; pause_reason says on what, and resume_after when a " +
    "warm-up pause renews. progress is null for a campaign not in flight. For an A/B test, " +
    "progress.by_variant is a list of { key, pending, sent, failed, skipped } in variant order, " +
    "ending with a row whose key is null: the addresses still waiting for the winner. An A/B " +
    "test also carries 'ab_test' with live per-variant " +
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
    "'testing' can be decided; anything else, or a campaign that is not an A/B test, answers " +
    "409 invalid_state. A variant key the campaign does not have answers 422 invalid_request. " +
    "Read get_broadcast first — a variant with a handful of opens more is not a result, and the " +
    "worker decides on its own at decide_at. " +
    CAMPAIGN_KEY_GUARDRAILS,
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
    "Continue a paused campaign now. It mails only the addresses " +
    "still pending — the audience was frozen when the campaign started and everyone already " +
    "reached is marked — so calling this twice cannot double-send. Only works on a paused " +
    "campaign; anything else answers 409 invalid_state. Read pause_reason first. A background " +
    "worker resumes quota, interrupted and suspension pauses on its own, so use this only when " +
    "waiting is not acceptable. A warm-up pause cannot be resumed before its resume_after (409 " +
    "invalid_state naming the time) and resumes on its own then; do not retry, the allowance is " +
    "protecting the domain. While the workspace has no postal address or is suspended the call " +
    "answers 422 no_postal_address or workspace_suspended: those need a person, and the campaign " +
    "continues on its own once they are fixed. An A/B test paused mid-sample resumes the sample; " +
    "one paused after the decision resumes the winner. " +
    CAMPAIGN_KEY_GUARDRAILS,
  schema: { id: BROADCAST_ID },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/broadcasts/${args.id}/resume`),
};

export const sendBroadcastTool = {
  name: "send_broadcast",
  description:
    "Send a draft or scheduled campaign now, or schedule it with scheduled_at. This mails every " +
    "contact in the segment and cannot be undone once started — run preview_broadcast first. " +
    "Marketing mail must carry a postal address: a workspace without one is refused with 422 " +
    "no_postal_address (a person adds it in Settings), and a suspended workspace with 422 " +
    "workspace_suspended, whether sending now or scheduling. Calling this on an already-scheduled " +
    "campaign with a new scheduled_at moves it (rescheduled: true); with no scheduled_at it starts " +
    "now. Any other status answers 409 invalid_state, and a malformed scheduled_at 422 " +
    "invalid_request. " +
    CAMPAIGN_KEY_GUARDRAILS +
    " A key with a daily_send_limit can start a draft (now or scheduled) only when the " +
    "campaign's recipient count, as the audience resolves now, fits what is left of that limit " +
    "today; otherwise it answers 429 daily_limit and nothing is sent. Those recipients then " +
    "count against the key's limit. Run preview_broadcast to see the count, and do not retry " +
    "the same day. The campaign's topic_key was checked against existing " +
    "topics when it was created. A campaign bigger than the day's remaining quota or its domain's " +
    "warm-up allowance is not rejected: it sends what it can and stops as 'paused', then " +
    "continues later. That is expected, not an error to retry. An A/B test sends its " +
    "sample, goes to 'testing', and sends the rest to the winner after decide_after_minutes " +
    "or when pick_broadcast_winner is called. A send-time test is scheduled by its variants' " +
    "send_at and does not accept scheduled_at.",
  schema: {
    id: BROADCAST_ID,
    scheduled_at: z
      .string()
      .optional()
      .describe(
        "UTC ISO 8601 timestamp with a Z suffix, e.g. 2026-09-16T09:00:00.000Z; offsets and phrases " +
          "like 'in 2 hours' are refused. Omit to send now",
      ),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("POST", `/v1/broadcasts/${id}/send`, body);
  },
};

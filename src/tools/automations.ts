import { z } from "zod";
import { request } from "../client";

export const listAutomationsTool = {
  name: "list_automations",
  description:
    "List multi-step email sequences and how many people are currently in each. Use this " +
    "to find the right automation before enrolling someone.",
  schema: {},
  handler: async () => request("GET", "/v1/automations"),
};

export const enrollTool = {
  name: "enroll_in_automation",
  description:
    "Put someone into a multi-step sequence. Prefer this over scheduling several emails " +
    "yourself: the sequence stops on its own if they unsubscribe (from everything or from the " +
    "automation's topic), reply, hard bounce, gain one of its exit tags, or lose one of its " +
    "required tags, which you would " +
    "otherwise have to track and cancel by hand. To stop a sequence for someone who converted, " +
    "tag the contact rather than cancelling anything. Enrolling the same person twice is a " +
    "no-op, so it is safe to retry. enrolled: false with reason suppressed, " +
    "unsubscribed_from_topic, exit_tag or required_tag_missing means they are deliberately " +
    "excluded; do not work around it.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
    email: z.string().email(),
    variables: z
      .record(z.string())
      .optional()
      .describe("Values for any templated steps in the sequence"),
  },
  handler: async (args: Record<string, unknown>) => {
    const { automation_id, ...body } = args;
    return request("POST", `/v1/automations/${automation_id}/enroll`, body);
  },
};

const REPLY_TO = z
  .string()
  .describe(
    "Where replies go instead of from, e.g. the founder's own inbox. Only set it when asked: " +
      "SendRaven receives mail for its own domains only, so with a reply-to elsewhere a reply " +
      "cannot stop the sequence, however exit_on_reply is set",
  );

const exitRuleSchema = {
  topic_key: z
    .string()
    .optional()
    .describe(
      "Send every step under this topic (see list_topics). Its unsubscribe link then opts the " +
        "person out of this kind of mail only, and opting out ends the sequence",
    ),
  exit_tags: z
    .array(z.string())
    .max(20)
    .optional()
    .describe(
      "Contact tags that end the sequence: nobody carrying one is enrolled, and adding one ends " +
        "the enrolment. Tag someone 'customer' when they upgrade and a trial sequence stops",
    ),
  required_tags: z
    .array(z.string())
    .max(20)
    .optional()
    .describe(
      "Tags a person must keep: only people carrying all of them are enrolled, and removing one " +
        "ends the enrolment. Someone with no contact record has no tags, so is never enrolled",
    ),
  exit_on_reply: z
    .boolean()
    .optional()
    .describe("End the enrolment when the person replies. Defaults to true; turn off for dunning"),
};

export const createAutomationTool = {
  name: "create_automation",
  description:
    "Define a multi-step sequence as a draft; nothing is sent until it is activated, from the " +
    "dashboard or with POST /v1/automations/{id}/status. Prefer this over scheduling several emails yourself: it ends on its own when the " +
    "person unsubscribes, replies, bounces, opts out of its topic, or their tags say so. " +
    "identity_id must be a marketing sending domain (see list_sending_domains; risk_class " +
    "'marketing') and from must sit on it; both are checked here rather than at the first send. " +
    "Set reply_to only when replies should go somewhere other than from, and know that it " +
    "disables the reply exit: SendRaven never sees mail sent to another domain.",
  schema: {
    name: z.string(),
    slug: z.string().regex(/^[a-z0-9-]+$/).describe("Lowercase letters, digits and hyphens"),
    identity_id: z
      .string()
      .describe("A marketing sending domain's id from list_sending_domains (a UUID), not the domain name"),
    from: z.string().describe("On the identity's domain, e.g. 'Ana <ana@news.example.com>'"),
    reply_to: REPLY_TO.optional(),
    trigger: z.object({
      kind: z
        .enum(["api", "contact_added", "event"])
        .describe(
          "api: enrol with enroll_in_automation. contact_added: starts when someone joins " +
            "audience_id. event: starts on emit_event with event_name",
        ),
      audience_id: z.string().optional().describe("Required for contact_added; the audience's id, not its name"),
      event_name: z.string().optional().describe("Required for event, e.g. trial_started"),
    }),
    steps: z
      .array(
        z.object({
          delay_minutes: z
            .number()
            .int()
            .min(0)
            .describe("From enrolment for the first step, from the previous step for the rest"),
          subject: z.string(),
          html: z.string().optional().describe("Inline body; or pass template_slug instead"),
          template_slug: z
            .string()
            .optional()
            .describe("A template from list_templates, rendered with the enrolment's variables"),
        }),
      )
      .min(1)
      .max(20),
    ...exitRuleSchema,
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/automations", args),
};

export const updateAutomationTool = {
  name: "update_automation",
  description:
    "Change the rules that take someone out of a sequence (topic_key, exit_tags, required_tags, " +
    "exit_on_reply) or its reply_to. Steps and the trigger are fixed once created. Fields left " +
    "out keep their value; a null topic_key or reply_to, or an empty tag list, clears it. People " +
    "already enrolled see the change from their next step, so a mistaken edit can be put back " +
    "before it has ended anyone's sequence. Clear reply_to to have replies threaded in " +
    "SendRaven again and stop the drip on their own.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
    ...exitRuleSchema,
    topic_key: exitRuleSchema.topic_key.nullable(),
    reply_to: REPLY_TO.nullable().optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { automation_id, ...body } = args;
    return request("PATCH", `/v1/automations/${automation_id}`, body);
  },
};

export const emitEventTool = {
  name: "emit_event",
  description:
    "Emit a named event, starting every automation that waits on it — for example " +
    "'trial_started' or 'invoice_overdue'. Use this when you want the configured sequences " +
    "to decide what happens, rather than naming an automation yourself.",
  schema: {
    name: z.string().describe("Event name, e.g. trial_started"),
    email: z.string().email(),
    variables: z.record(z.string()).optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/events", args),
};

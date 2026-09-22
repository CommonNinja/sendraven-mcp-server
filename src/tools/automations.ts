import { z } from "zod";
import { request } from "../client";

export const listAutomationsTool = {
  name: "list_automations",
  description:
    "List multi-step email sequences and how many people are currently in each. Use this " +
    "to find the right automation before enrolling someone. Newest first, at most 100 per call; " +
    "while has_more is true, pass next_cursor back as cursor. A 'paused' automation holds its " +
    "people on their current step rather than ending their sequence: they stay 'active' and " +
    "continue from that step once it is active again. To see who is on one, or who left and why, " +
    "use list_automation_enrollments.",
  schema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    const q = qs.toString();
    return request("GET", `/v1/automations${q ? `?${q}` : ""}`);
  },
};

export const getAutomationTool = {
  name: "get_automation",
  description:
    "Fetch one automation: its status, trigger, steps, exit rules and how many people are in each " +
    "state. The same object list_automations returns, for when you already hold the id. People " +
    "themselves are listed by list_automation_enrollments. An unknown automation_id answers 404 " +
    "not_found; a name or slug passed instead is answered with the matching id.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
  },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/automations/${args.automation_id}`),
};

export const setAutomationStatusTool = {
  name: "set_automation_status",
  description:
    "Activate, pause or return an automation to draft. A new automation is a draft and sends " +
    "nothing until it is set to 'active'. Pausing ('paused' or 'draft') holds everyone on their " +
    "current step: nobody is sent a step and nobody new is enrolled, but nobody's sequence ends, " +
    "and setting 'active' again continues each person from where they were, with steps that came " +
    "due meanwhile going out from the next worker run at the usual pace. So pause, rather than " +
    "delete, to fix a step: a step's content is read when it is sent. Activating does not " +
    "re-check the sending domain; if it is no longer verified each enrolment fails at its next " +
    "step. Returns the automation. Only ask for this when a person wants the sequence started " +
    "or stopped: activating starts mail to everyone it enrols.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
    status: z.enum(["active", "paused", "draft"]),
  },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/automations/${args.automation_id}/status`, { status: args.status }),
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
    "no-op, so it is safe to retry. The answer always carries enrolled, reason and enrollment: " +
    "enrolled: true with reason null and the enrollment, or enrolled: false with enrollment null. " +
    "enrolled: false with reason already_enrolled is that no-op. reason previously_enrolled " +
    "means they have already been through it and the automation's reenrollment is 'never': " +
    "that is the automation doing what it was told, not an error, so do not retry or look for " +
    "another way in. reason suppressed, unsubscribed_from_topic, exit_tag or " +
    "required_tag_missing means they are deliberately excluded; do not work around it. Those " +
    "are all 200s. A 409 invalid_state means the automation cannot take anyone (not " +
    "active, no steps, or its topic was deleted): tell a person rather than retrying. A paused " +
    "automation is not_active, but the people already in it are held, not dropped. The calling " +
    "key's guardrails apply: a key that holds its sends for approval cannot enrol anyone (403 " +
    "forbidden), because the steps later go out with no approval, and a key with a recipient " +
    "allowlist can enrol only addresses on it (403 recipient_not_allowed).",
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

const TAG = z.string().min(1).max(60);

const REENROLLMENT = z
  .enum(["after_completion", "never"])
  .describe(
    "after_completion (the default): someone whose enrolment completed or was cancelled can be " +
      "enrolled again. never: each person goes through it once, and a later enrolment answers " +
      "enrolled: false with reason previously_enrolled. Use never for onboarding or a one-time " +
      "offer, where a second run would mail someone the same sequence twice",
  );

const DEFAULT_VARIABLES = z
  .record(z.string())
  .describe(
    "Template values every enrolment gets, under the variables an enrolment passes (which win). " +
      "Required for contact_added and tag_added, which enrol with no values: every placeholder in " +
      "the steps' subjects, html and templates needs one here, or the call answers 422 " +
      "missing_variables naming the missing ones. Read at each step, so a fix reaches people " +
      "already enrolled",
  );

const exitRuleSchema = {
  topic_key: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Send every step under this topic (see list_topics). Its unsubscribe link then opts the " +
        "person out of this kind of mail only, and opting out ends the sequence. Must be an " +
        "existing topic's key; an unknown one is refused with 422 unknown_topic",
    ),
  exit_tags: z
    .array(TAG)
    .max(20)
    .optional()
    .describe(
      "Contact tags that end the sequence: nobody carrying one is enrolled, and adding one ends " +
        "the enrolment. Tag someone 'customer' when they upgrade and a trial sequence stops",
    ),
  required_tags: z
    .array(TAG)
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
    "dashboard or with set_automation_status. Prefer this over scheduling several emails yourself: it ends on its own when the " +
    "person unsubscribes, replies, bounces, opts out of its topic, or their tags say so. " +
    "identity_id must be a marketing sending domain (see list_sending_domains; risk_class " +
    "'marketing') and from must sit on it; both are checked here rather than at the first send. " +
    "Set reply_to only when replies should go somewhere other than from, and know that it " +
    "disables the reply exit: SendRaven never sees mail sent to another domain. Every reference is " +
    "checked now rather than at the first enrolment: an unknown topic_key (422 unknown_topic), a " +
    "template_slug that does not exist, or a step with neither html nor template_slug is refused " +
    "with 422 invalid_request, a from with no verified marketing domain answers 422 " +
    "no_verified_identity, and a slug already in use in this workspace answers 409 conflict: " +
    "pick another slug, or find the existing one with list_automations rather than creating a " +
    "second. reenrollment decides whether someone whose enrolment ended can be enrolled again: " +
    "'after_completion' (the default) allows it, 'never' enrols each person once. When one " +
    "audience holds everyone, start a product-specific sequence with a tag_added trigger on " +
    "that product's tag, not contact_added, which would mail every new contact.",
  schema: {
    name: z.string().min(1).max(200),
    slug: z.string().regex(/^[a-z0-9-]+$/).describe("Lowercase letters, digits and hyphens"),
    identity_id: z
      .string()
      .describe("A marketing sending domain's id from list_sending_domains (a UUID), not the domain name"),
    from: z.string().min(3).describe("On the identity's domain, e.g. 'Ana <ana@news.example.com>'"),
    reply_to: REPLY_TO.optional(),
    trigger: z.object({
      kind: z
        .enum(["api", "contact_added", "event", "tag_added"])
        .describe(
          "api: enrol with enroll_in_automation. contact_added: starts when someone joins " +
            "audience_id. event: starts on emit_event with event_name. tag_added: starts when a " +
            "contact gains tag (tag_contact, or a contact added carrying it); a contact that " +
            "already had the tag starts nothing, so turning it on does not mail everyone tagged",
        ),
      audience_id: z.string().optional().describe("Required for contact_added; the audience's id, not its name"),
      event_name: z.string().min(1).max(120).optional().describe("Required for event, e.g. trial_started. Up to 120 characters, matched exactly"),
      tag: z.string().min(1).max(60).optional().describe("Required for tag_added, e.g. audio-player. Normalised like contact tags"),
    }),
    steps: z
      .array(
        z.object({
          delay_minutes: z
            .number()
            .int()
            .min(0)
            .max(525600)
            .describe(
              "From enrolment for the first step, from the previous step for the rest. At most 525600 (one year)",
            ),
          subject: z.string().min(1).max(998),
          html: z.string().optional().describe("Inline body; or pass template_slug instead. One of the two is required"),
          template_slug: z
            .string()
            .min(1)
            .optional()
            .describe(
              "A template from list_templates, rendered with the enrolment's variables. Must already exist",
            ),
        }),
      )
      .min(1)
      .max(20),
    ...exitRuleSchema,
    reenrollment: REENROLLMENT.optional(),
    default_variables: DEFAULT_VARIABLES.optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/automations", args),
};

export const updateAutomationTool = {
  name: "update_automation",
  description:
    "Change the rules that take someone out of a sequence (topic_key, exit_tags, required_tags, " +
    "exit_on_reply), its reply_to, its reenrollment, or its default_variables (replaces the whole " +
    "set; {} clears it). Steps and the trigger are fixed once " +
    "created. A reenrollment change applies from the next enrolment; nobody already enrolled is " +
    "touched. Fields left " +
    "out keep their value; a null topic_key or reply_to, or an empty tag list, clears it. People " +
    "already enrolled see the change from their next step, so a mistaken edit can be put back " +
    "before it has ended anyone's sequence. Clear reply_to to have replies threaded in " +
    "SendRaven again and stop the drip on their own. A topic_key that names no existing topic is " +
    "refused with 422 unknown_topic, any field other than these is refused with 422 " +
    "invalid_request, and an unknown automation_id answers 404 not_found.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
    ...exitRuleSchema,
    topic_key: exitRuleSchema.topic_key.nullable(),
    reply_to: REPLY_TO.nullable().optional(),
    reenrollment: REENROLLMENT.optional(),
    default_variables: DEFAULT_VARIABLES.optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { automation_id, ...body } = args;
    return request("PATCH", `/v1/automations/${automation_id}`, body);
  },
};

const ENROLLMENT_STATUSES = ["active", "completed", "canceled", "failed"] as const;

export const listAutomationEnrollmentsTool = {
  name: "list_automation_enrollments",
  description:
    "The people in one automation, newest enrolment first: each row has the email, status, " +
    "current_step, next_due_at and, for a cancelled one, cancel_reason. Reach for this, not " +
    "find_contact or list_emails, to answer 'is this person still on the sequence?', 'who is " +
    "waiting on step 2?' or 'why did this sequence stop for them?'. status narrows to one state: " +
    "'active' (still going, including people held while the automation is paused), 'completed', " +
    "'failed', or 'canceled' for everyone who left early, where cancel_reason says why " +
    "(unsubscribed, unsubscribed_from_topic, replied, suppressed, exit_tag, required_tag_missing, " +
    "manual). For the counts alone, list_automations already carries them per status. Any other " +
    "status is refused with 422 invalid_request, and an unknown automation_id answers 404 " +
    "not_found. At most 100 per call; while has_more is true, pass next_cursor back as cursor " +
    "with the same status.",
  schema: {
    automation_id: z.string().describe("The automation's id from list_automations (a UUID), not its name or slug"),
    status: z.enum(ENROLLMENT_STATUSES).optional().describe("Only enrolments in this state; omit for all"),
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.status !== undefined) qs.set("status", String(args.status));
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    const q = qs.toString();
    return request("GET", `/v1/automations/${args.automation_id}/enrollments${q ? `?${q}` : ""}`);
  },
};

export const emitEventTool = {
  name: "emit_event",
  description:
    "Emit a named event, starting every automation that waits on it — for example " +
    "'trial_started' or 'invoice_overdue'. Use this when you want the configured sequences " +
    "to decide what happens, rather than naming an automation yourself. Returns " +
    "automations_started; 0 means nothing was waiting on that name or the person was excluded. " +
    "The calling key's guardrails apply as for enroll_in_automation, before anything is looked " +
    "up: a key that holds its sends for approval gets 403 forbidden, and a key with a recipient " +
    "allowlist gets 403 recipient_not_allowed for an address not on it.",
  schema: {
    name: z.string().min(1).max(120).describe("Event name, e.g. trial_started"),
    email: z.string().email(),
    variables: z.record(z.string()).optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/events", args),
};

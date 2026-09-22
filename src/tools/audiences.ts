import { z } from "zod";
import { request } from "../client";

export const listAudiencesTool = {
  name: "list_audiences",
  description:
    "List contact lists, newest first, with each one's id and contact_count. Paged: at most 100 " +
    "per call; while has_more is true, pass next_cursor back as cursor, or a list you are looking " +
    "for may be on a later page.",
  schema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    const q = qs.toString();
    return request("GET", `/v1/audiences${q ? `?${q}` : ""}`);
  },
};

/**
 * Every tool that takes an audience says the same thing, because the failure
 * is the same: a model asked to "add Ana to Newsletter" passes the name, the
 * API answers 404, and the person never lands on the list.
 */
const AUDIENCE_ID = z
  .string()
  .describe("The audience's id from list_audiences (a UUID), not its name. Call list_audiences first if you only know the name.");

/** Same reason: a model that knows the person by address will pass the address. */
const CONTACT_ID = z
  .string()
  .describe("The contact's id (a UUID) from find_contact, add_contact or get_contact — not the email address. Call find_contact with the address first if that is all you have.");

const CONTACT_STATUS = z.enum(["subscribed", "unsubscribed", "bounced", "complained"]);

const contactFields = {
  email: z.string().email(),
  first_name: z.string().max(120).optional(),
  last_name: z.string().max(120).optional(),
  tags: z
    .array(z.string().min(1).max(60))
    .max(50)
    .optional()
    .describe("Flat labels; lower-cased, spaces become hyphens"),
  attributes: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Custom properties by key. An unknown key creates a string property."),
  status: CONTACT_STATUS.optional().describe(
    "Standing with the previous sender. unsubscribed suppresses for marketing; bounced and " +
      "complained suppress for everything. Defaults to subscribed.",
  ),
  last_active_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(
      "ISO 8601 time the person was last active in your product (a login, a session). Counted by a " +
        "segment's engaged_within_days. Kept only if later than the stored value.",
    ),
};

export const addContactTool = {
  name: "add_contact",
  description:
    "Add someone to an audience. A contact exists once per workspace and can be on any number " +
    "of audiences, so adding an address that already exists joins them to this list rather than " +
    "creating a second copy. Pass status when the person has opted out elsewhere — it writes the " +
    "suppression as well as the flag, and an add never resubscribes someone who opted out here. " +
    "Someone new to the audience starts any automation triggered by joining it; re-adding an " +
    "existing member starts nothing. Safe to retry. For more than a handful of people use import_contacts.",
  schema: {
    audience_id: AUDIENCE_ID,
    ...contactFields,
  },
  handler: async (args: Record<string, unknown>) => {
    const { audience_id, ...body } = args;
    return request("POST", `/v1/audiences/${audience_id}/contacts`, body);
  },
};

export const importContactsTool = {
  name: "import_contacts",
  description:
    "Import up to 5,000 contacts into an audience in one call, with names, tags, custom " +
    "properties and subscription status. This is the migration tool: send the previous " +
    "provider's unsubscribed, bounced and complained lists with the matching status *before* " +
    "the first campaign, or the new domain mails people who opted out and loses its reputation " +
    "in a day. Existing contacts are updated rather than duplicated, and nobody who opted out " +
    "here is resubscribed, so re-running an import is safe. Returns counts: inserted, updated, " +
    "skipped, unsubscribed, bounced, complained, suppressed, properties_created, automations_started.",
  schema: {
    audience_id: AUDIENCE_ID,
    contacts: z.array(z.object(contactFields)).min(1).max(5000),
    source: z
      .string()
      .optional()
      .describe("Where the list came from, e.g. \"Mailchimp\" — recorded on each suppression"),
    trigger_automations: z
      .boolean()
      .optional()
      .describe(
        "Start automations triggered by joining this audience for everyone new to it. Off by " +
          "default: a migrated list is not new signups, and a welcome sequence to all of it at " +
          "once is a cold blast that burns the sending domain. Only set it for genuinely new people.",
      ),
  },
  handler: async (args: Record<string, unknown>) => {
    const params = new URLSearchParams();
    if (args.source) params.set("source", String(args.source));
    if (args.trigger_automations) params.set("trigger_automations", "true");
    const qs = params.toString();
    const q = qs ? `?${qs}` : "";
    return request("POST", `/v1/audiences/${args.audience_id}/contacts${q}`, args.contacts);
  },
};

export const getContactTool = {
  name: "get_contact",
  description:
    "Fetch one contact by id, with their audience memberships, custom properties and " +
    "engagement dates.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/contacts/${args.id}`),
};

export const updateContactTool = {
  name: "update_contact",
  description:
    "Update a contact. Attributes are merged, so sending one field does not clear the rest. " +
    "unsubscribed: true is a real opt-out: it suppresses the address for marketing, cancels " +
    "their pending sends and ends their automation enrolments. unsubscribed: false lifts a " +
    "marketing unsubscribe — only do it when the person asked. Resubscribing someone who hard " +
    "bounced or complained is refused with 409 invalid_state before anything in the request is written.",
  schema: {
    id: CONTACT_ID,
    first_name: z.string().max(120).optional(),
    last_name: z.string().max(120).optional(),
    unsubscribed: z.boolean().optional().describe("true to opt them out of marketing, false to undo an unsubscribe"),
    attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    last_active_at: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .describe("ISO 8601 time of their last activity in your product. Only moves forward; null clears it."),
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("PATCH", `/v1/contacts/${id}`, body);
  },
};

export const listSegmentsTool = {
  name: "list_segments",
  description:
    "List saved audience filters. Use a segment id when creating a campaign rather than " +
    "describing the filter inline, so the same definition can be reused and counted.",
  schema: {},
  handler: async () => request("GET", "/v1/segments"),
};

export const countSegmentTool = {
  name: "count_segment",
  description:
    "How many contacts a segment currently matches. Run this before building a campaign " +
    "around it — a filter that matches nobody is easier to spot here than after a send.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) => request("GET", `/v1/segments/${args.id}/metrics`),
};

export const findContactTool = {
  name: "find_contact",
  description:
    "Find a contact by address across every audience, without knowing which list they are on, " +
    "or list the workspace's contacts by tag or subscription. Use email for an exact match, or q " +
    "for an address prefix. A person exists once per workspace, so each row is one contact with " +
    "audience_ids listing every list they are on, first_name, last_name, tags, attributes and " +
    "whether they are unsubscribed. Newest first, at most 100 per call; while has_more is true, " +
    "pass next_cursor back as cursor with the same filters.",
  schema: {
    email: z.string().optional().describe("Exact address"),
    q: z.string().optional().describe("Address prefix, for a partial match. Ignored when email is given"),
    tag: z
      .array(z.string())
      .optional()
      .describe("Only contacts carrying every one of these tags (see list_tags)"),
    unsubscribed: z.boolean().optional().describe("Filter to only opted-in or only opted-out"),
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous call, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const k of ["email", "q", "limit", "cursor"]) {
      if (args[k] !== undefined) q.set(k, String(args[k]));
    }
    if (Array.isArray(args.tag)) for (const t of args.tag) q.append("tag", String(t));
    if (args.unsubscribed !== undefined) q.set("unsubscribed", String(args.unsubscribed));
    return request("GET", `/v1/contacts?${q.toString()}`);
  },
};

export const removeFromAudienceTool = {
  name: "remove_from_audience",
  description:
    "Take a contact off one audience. They stay in the workspace and keep every other audience, " +
    "their suppression and their engagement history. To remove the person entirely use " +
    "delete_contact — leaving a list and being forgotten are different things.",
  schema: {
    audience_id: AUDIENCE_ID,
    contact_id: CONTACT_ID,
  },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/audiences/${args.audience_id}/contacts/${args.contact_id}`),
};

export const deleteContactTool = {
  name: "delete_contact",
  description:
    "Remove a person from the workspace entirely, along with every audience membership. Their " +
    "suppression and topic preferences are kept on purpose — an opt-out has to outlive the " +
    "contact record, or the next import silently puts them back on the list. To take someone " +
    "off a single audience use remove_from_audience instead.",
  schema: { contact_id: CONTACT_ID },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/contacts/${args.contact_id}`),
};

export const tagContactTool = {
  name: "tag_contact",
  description:
    "Add or remove tags on a contact. Tags are flat labels — vip, beta, churned — as opposed to " +
    "custom properties, which are declared fields with a value. They are lower-cased and spaces " +
    "become hyphens, so VIP and vip are the same tag. Tagging reaches the person across every " +
    "audience they are on. Call list_tags first to see what the workspace already uses, rather " +
    "than inventing a synonym for an existing tag. Adding a tag an automation exits on (e.g. " +
    "customer), or removing one it requires (e.g. trial), ends the person's enrolment in it at " +
    "once. Adding a tag the contact did not already carry starts every active automation with a " +
    "tag_added trigger on it, so a tag can put someone on a sequence: check list_automations " +
    "before tagging on a whim. Returns the contact, as get_contact does, with its tags after the change. To see which " +
    "enrolments a tag change ended, call list_automation_enrollments with status 'canceled' and " +
    "read each row's cancel_reason (exit_tag or required_tag_missing).",
  schema: {
    contact_id: CONTACT_ID,
    add: z.array(z.string().min(1)).max(50).optional(),
    remove: z.array(z.string().min(1)).max(50).optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { contact_id, ...body } = args;
    return request("POST", `/v1/contacts/${contact_id}/tags`, body);
  },
};

export const listTagsTool = {
  name: "list_tags",
  description:
    "Every tag in use in the workspace, with how many contacts carry each. Tags are free-form, " +
    "so this is the only way to know what exists before applying one.",
  schema: {},
  handler: async () => request("GET", "/v1/contacts/tags"),
};

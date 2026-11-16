import { z } from "zod";
import { request } from "../client";

export const listTopicsTool = {
  name: "list_topics",
  description:
    "List subscription topics — the categories a person can opt out of individually. " +
    "Marketing mail sent under a topic lets recipients unsubscribe from that kind alone " +
    "rather than from everything.",
  schema: {},
  handler: async () => request("GET", "/v1/topics"),
};

export const getPreferencesTool = {
  name: "get_email_preferences",
  description:
    "What one person has chosen to receive. It shows whether someone who isn't getting a " +
    "particular kind of email opted out of it — an opt-out looks identical to a delivery " +
    "failure from the outside.",
  schema: { email: z.string().email() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/topics/preferences?email=${encodeURIComponent(String(args.email))}`),
};

export const setPreferencesTool = {
  name: "set_email_preferences",
  description:
    "Set which topics a person receives, recording what they asked for — silently re-subscribing someone who opted out is what generates spam complaints. Every " +
    "key must be an existing topic from list_topics: one unknown key refuses the whole call " +
    "with 422 unknown_topic and nothing is saved. Setting a topic to false also ends any " +
    "automation enrolment sent under that topic.",
  schema: {
    email: z.string().email(),
    topics: z.record(z.boolean()).describe("Topic key to subscribed, e.g. {\"newsletter\": false}"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/topics/preferences", args),
};

export const saveTopicTool = {
  name: "save_topic",
  description:
    "Create a subscription topic, or rename an existing one by its key: a kind of marketing mail " +
    "people can opt out of on its own (product updates, promotions) while staying on the rest. " +
    "Another provider's groups or interests that subscribers chose for themselves become topics; a " +
    "label they never chose is a tag, not a topic. default_subscribed decides who gets the topic's " +
    "mail before they choose, and changing it on an existing topic moves everyone who never chose.",
  schema: {
    key: z.string().regex(/^[a-z0-9-]+$/).describe("Lower-case letters, digits and hyphens, e.g. \"product-updates\""),
    name: z.string().min(1).max(120),
    description: z.string().max(300).optional().describe("Shown on the preference page"),
    default_subscribed: z.boolean().optional().describe("Defaults to true when the topic is created"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/topics", args),
};

export const importTopicPreferencesTool = {
  name: "import_topic_preferences",
  description:
    "Record many people's choice on one topic at once, for carrying over who was in or out of " +
    "another provider's group or interest. subscribed false opts them out of this topic only; it " +
    "never resubscribes someone who unsubscribed from everything. Up to 50,000 addresses per call.",
  schema: {
    key: z.string().describe("The topic's key from list_topics or save_topic"),
    emails: z.array(z.string().email()).min(1).max(50_000),
    subscribed: z.boolean(),
  },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/topics/${encodeURIComponent(String(args.key))}/import`, {
      emails: args.emails,
      subscribed: args.subscribed,
    }),
};

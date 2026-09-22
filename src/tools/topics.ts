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

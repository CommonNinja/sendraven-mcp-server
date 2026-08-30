import { z } from "zod";
import { request } from "../client";

export const listTopicsTool = {
  name: "list_topics",
  description:
    "List subscription topics — the categories a person can opt out of individually. " +
    "Pass a topic when sending marketing mail so recipients can unsubscribe from that " +
    "kind alone rather than from everything.",
  schema: {},
  handler: async () => request("GET", "/v1/topics"),
};

export const getPreferencesTool = {
  name: "get_email_preferences",
  description:
    "What one person has chosen to receive. Check this before asking a human why someone " +
    "isn't getting a particular kind of email — an opt-out looks identical to a delivery " +
    "failure from the outside.",
  schema: { email: z.string().email() },
  handler: async (args: Record<string, unknown>) =>
    request("GET", `/v1/topics/preferences?email=${encodeURIComponent(String(args.email))}`),
};

export const setPreferencesTool = {
  name: "set_email_preferences",
  description:
    "Set which topics a person receives. Only do this when they have actually asked — " +
    "silently re-subscribing someone who opted out is what generates spam complaints.",
  schema: {
    email: z.string().email(),
    topics: z.record(z.boolean()).describe("Topic key to subscribed, e.g. {\"newsletter\": false}"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/topics/preferences", args),
};

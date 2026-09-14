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

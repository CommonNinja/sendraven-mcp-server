import { z } from "zod";
import { request } from "../client";

export const listConversionGoalsTool = {
  name: "list_conversion_goals",
  description:
    "List conversion goals: the event names counted as a conversion, each with its credit " +
    "window in days. An emit_event call with one of these names is credited to the last email " +
    "the person clicked inside that window; any other name is an ordinary event.",
  schema: {},
  handler: async () => request("GET", "/v1/conversion-goals"),
};

export const createConversionGoalTool = {
  name: "create_conversion_goal",
  description:
    "Start counting an event as a conversion, such as 'subscription_started' or 'purchase'. " +
    "Counts only events emitted after this call; it does not go back over earlier ones. " +
    "Use the exact name the app already passes to emit_event. A name that is already a goal " +
    "answers 409 conflict, and list_conversion_goals has its id.",
  schema: {
    event_name: z.string().min(1).max(120).describe("Exact event name, as sent to emit_event"),
    window_days: z
      .number().int().min(1).max(30).optional()
      .describe("How many days after a click a conversion still counts for that email; defaults to 7"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/conversion-goals", args),
};

export const getConversionMetricsTool = {
  name: "get_conversion_metrics",
  description:
    "Attributed conversions, converters and revenue per currency. Pass broadcast_id for a " +
    "campaign, broken down per A/B variant with its sent count and rate, or automation_id for " +
    "a sequence, broken down per step. The figures are attributed, not causal: each conversion " +
    "counts for the last email its person clicked, and scanner clicks and opens never count. " +
    "The rate is people over messages sent. A conversion appears about a minute after its " +
    "event, once the clicks before it are classified.",
  schema: {
    broadcast_id: z.string().optional().describe("A campaign's id from list_broadcasts"),
    automation_id: z.string().optional().describe("An automation's id from list_automations"),
    goal_id: z.string().optional().describe("Only this goal's conversions; every goal when omitted"),
    from: z.string().datetime({ offset: true }).optional().describe("ISO 8601; conversions at or after"),
    to: z.string().datetime({ offset: true }).optional().describe("ISO 8601; conversions before"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    for (const k of ["broadcast_id", "automation_id", "goal_id", "from", "to"]) {
      if (args[k] !== undefined) qs.set(k, String(args[k]));
    }
    const q = qs.toString();
    return request("GET", `/v1/conversions/metrics${q ? `?${q}` : ""}`);
  },
};

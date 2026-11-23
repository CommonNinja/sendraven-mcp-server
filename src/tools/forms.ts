import { z } from "zod";
import { request } from "../client";

const fieldSchema = z.object({
  kind: z.enum(["first_name", "last_name", "attribute"]),
  property: z.string().optional().describe("For kind attribute: a declared contact property key"),
  label: z.string().max(80).optional(),
  required: z.boolean().optional(),
});

const formSettings = {
  fields: z.array(fieldSchema).max(10).optional().describe("Inputs after the email address, which every form has"),
  tags: z.array(z.string()).max(20).optional().describe("Applied to everyone who signs up"),
  topic_keys: z.array(z.string()).max(20).optional().describe("Topic keys from list_topics the person opts in to"),
  double_opt_in: z
    .boolean()
    .optional()
    .describe("Defaults to true. Leave it on unless the user asks otherwise: false adds unverified addresses"),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  button_text: z.string().max(40).optional(),
  success_message: z.string().max(500).optional(),
  consent_text: z.string().max(500).optional().describe("Shown under the button and stored as the consent record"),
  sender_name: z.string().max(80).optional().describe("Who the confirmation email says the list belongs to"),
  accent_color: z.string().optional().describe("#rrggbb button colour"),
  redirect_url: z.string().optional().describe("https page to go to after a signup"),
  design: z
    .object({
      layout: z.enum(["card", "plain"]).optional().describe("card draws a bordered card; plain blends into the page"),
      align: z.enum(["left", "center"]).optional(),
      font: z.enum(["sans", "serif", "rounded", "mono"]).optional(),
      corners: z.enum(["square", "rounded", "pill"]).optional(),
      background_color: z
        .string()
        .optional()
        .describe("#rrggbb: the card, or with layout plain the page behind the form. Text colour follows it"),
    })
    .optional()
    .describe("How the form looks, to match the user's site. Only the keys passed change"),
  logo_url: z
    .string()
    .nullable()
    .optional()
    .describe(
      "A public https URL of the user's logo (PNG, JPEG, GIF or WebP, under 2 MB). It is fetched once and a copy " +
        "is kept, shown above the heading; null removes it. Read the logo off the user's own site, never invent one",
    ),
};

export const listFormsTool = {
  name: "list_forms",
  description:
    "List the workspace's signup forms, each with its embed_code. Use this before create_form to reuse a form " +
    "rather than create a duplicate for the same list.",
  schema: { limit: z.number().int().min(1).max(100).optional(), cursor: z.string().optional() },
  handler: async (args: Record<string, unknown>) => {
    const q = new URLSearchParams();
    if (args.limit) q.set("limit", String(args.limit));
    if (args.cursor) q.set("cursor", String(args.cursor));
    return request("GET", `/v1/forms${q.size ? `?${q}` : ""}`);
  },
};

export const createFormTool = {
  name: "create_form",
  description:
    "Create a signup form that adds the people who fill it in to an audience, and get back embed_code to paste " +
    "into the user's site (iframe_code for builders that strip scripts). With double opt-in (the default) people " +
    "are added only after clicking a confirmation email, which is sent from the workspace's verified transactional " +
    "domain and counts as one email each. audience_id must be an id from list_audiences, not the list's name; an " +
    "attribute field must name an existing contact property. Refused for a key with guardrails.",
  schema: {
    name: z.string().min(1).max(120).describe("For the dashboard; never shown to people signing up"),
    audience_id: z.string().describe("Audience id from list_audiences"),
    ...formSettings,
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/forms", args),
};

export const updateFormTool = {
  name: "update_form",
  description:
    "Change a signup form's wording, fields, tags, topics, logo or design, or pause it (status paused stops it taking signups " +
    "wherever it is embedded; active turns it back on). Only the fields passed change. The embed code stays the same.",
  schema: {
    id: z.string().describe("Form id from list_forms"),
    name: z.string().min(1).max(120).optional(),
    status: z.enum(["active", "paused"]).optional(),
    audience_id: z.string().optional(),
    ...formSettings,
  },
  handler: async (args: Record<string, unknown>) => {
    const { id, ...body } = args;
    return request("PATCH", `/v1/forms/${encodeURIComponent(String(id))}`, body);
  },
};

export const listFormSubmissionsTool = {
  name: "list_form_submissions",
  description:
    "Who submitted a signup form and what happened: pending (confirmation sent, not clicked), subscribed, " +
    "rejected (with the reason, such as payment_method_required when no card is on file, or suppressed) or " +
    "expired. Use it to answer \"why didn't my signup arrive?\" and to read the consent record.",
  schema: {
    id: z.string().describe("Form id from list_forms"),
    status: z.enum(["pending", "subscribed", "rejected", "expired"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const q = new URLSearchParams();
    if (args.status) q.set("status", String(args.status));
    if (args.limit) q.set("limit", String(args.limit));
    if (args.cursor) q.set("cursor", String(args.cursor));
    return request("GET", `/v1/forms/${encodeURIComponent(String(args.id))}/submissions${q.size ? `?${q}` : ""}`);
  },
};

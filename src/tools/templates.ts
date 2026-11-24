import { z } from "zod";
import { idempotencyHeader, request } from "../client";
import { IDEMPOTENCY_KEY, SEND_ERRORS, TRACK } from "./emails";

export const listTemplatesTool = {
  name: "list_templates",
  description:
    "List stored email templates and the variables each one needs. Unlike HTML composed at " +
    "send time, templates carry the workspace's reviewed subject, " +
    "copy and styling. They do not carry the unsubscribe footer: that is added at send time to " +
    "marketing mail, whether or not it came from a template.",
  schema: {},
  handler: async () => request("GET", "/v1/templates"),
};

export const renderTemplateTool = {
  name: "render_template",
  description:
    "Render a template with values, without sending, showing how the copy reads before it " +
    "mails a real person. A missing variable answers 422 missing_variables " +
    "with the list in `missing`; an unknown slug answers 404. Returns subject, html and text; " +
    "text is null when the template has no plain-text part.",
  schema: {
    slug: z.string(),
    variables: z.record(z.string()),
  },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/templates/${args.slug}/render`, { variables: args.variables }),
};

export const sendTemplateTool = {
  name: "send_template_email",
  description:
    "Send an email built from a stored template. Variable values are HTML-escaped on " +
    "substitution, so they are safe to fill from user-supplied text. Nothing is sent when a " +
    "value is missing: 422 missing_variables lists the names in `missing`, and a call with " +
    "those filled in goes through (render_template checks this without sending). An unknown slug answers 422 " +
    "invalid_request. The response has the same fields as send_email: id, status, thread_id, " +
    "scheduled_at, skipped, reason and approval_id. " +
    SEND_ERRORS,
  schema: {
    template: z.string().describe("Template slug"),
    variables: z.record(z.string()),
    from: z.string(),
    to: z.string().describe("Recipient address, or 'Name <address>' to show their name"),
    reply_to: z
      .string()
      .optional()
      .describe("Where replies go instead of from; outside SendRaven's domains they never reach a thread"),
    subject: z.string().optional().describe("Overrides the template's subject"),
    scheduled_at: z.string().optional(),
    track: TRACK,
    idempotency_key: IDEMPOTENCY_KEY,
  },
  handler: async (args: Record<string, unknown>) => {
    const { idempotency_key, ...body } = args;
    return request("POST", "/v1/emails", body, idempotencyHeader(idempotency_key));
  },
};

export const saveTemplateTool = {
  name: "save_template",
  description:
    "Create a stored template, or replace the one with this slug. For bringing templates over from " +
    "another provider: replace its merge tags with {{variable}} names (Mailchimp's *|FNAME|*, Kit's " +
    "{{ subscriber.first_name }} and the like become {{first_name}}), and remove its unsubscribe link " +
    "and footer, because SendRaven adds both to every marketing send. Values are HTML-escaped when " +
    "the template renders. An existing slug is overwritten, so list_templates first when the slug " +
    "might be taken.",
  schema: {
    slug: z.string().regex(/^[a-z0-9-]+$/).describe("Lower-case letters, digits and hyphens; how sends refer to it"),
    name: z.string().min(1).max(200),
    subject: z.string().min(1).max(998).describe("May use {{variables}} too"),
    html: z.string().min(1),
    text: z.string().min(1).optional().describe("A plain-text body; left out, one is derived from the HTML"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/templates", args),
};

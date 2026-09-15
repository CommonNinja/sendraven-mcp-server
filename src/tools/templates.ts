import { z } from "zod";
import { request } from "../client";

export const listTemplatesTool = {
  name: "list_templates",
  description:
    "List stored email templates and the variables each one needs. Prefer sending via a " +
    "template over composing HTML yourself — templates carry the workspace's reviewed subject, " +
    "copy and styling. They do not carry the unsubscribe footer: that is added at send time to " +
    "marketing mail, whether or not it came from a template.",
  schema: {},
  handler: async () => request("GET", "/v1/templates"),
};

export const renderTemplateTool = {
  name: "render_template",
  description:
    "Render a template with values, without sending. Use this to check your copy reads " +
    "correctly before mailing a real person. A missing variable answers 422 missing_variables " +
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
    "substitution, so they are safe to fill from user-supplied text. An unknown slug or a missing " +
    "variable is refused with 422 and nothing is sent. The response has the same fields as " +
    "send_email: id, status, thread_id, scheduled_at, skipped, reason and approval_id.",
  schema: {
    template: z.string().describe("Template slug"),
    variables: z.record(z.string()),
    from: z.string(),
    to: z.string().describe("Recipient address, or 'Name <address>' to show their name"),
    subject: z.string().optional().describe("Overrides the template's subject"),
    scheduled_at: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/emails", args),
};

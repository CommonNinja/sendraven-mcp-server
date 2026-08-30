import { z } from "zod";
import { request } from "../client";

export const listTemplatesTool = {
  name: "list_templates",
  description:
    "List stored email templates and the variables each one needs. Prefer sending via a " +
    "template over composing HTML yourself — templates carry the brand styling and the " +
    "unsubscribe footer.",
  schema: {},
  handler: async () => request("GET", "/v1/templates"),
};

export const renderTemplateTool = {
  name: "render_template",
  description:
    "Render a template with values, without sending. Use this to check your copy reads " +
    "correctly before mailing a real person. Returns an error listing any missing variables.",
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
    "substitution, so they are safe to fill from user-supplied text.",
  schema: {
    template: z.string().describe("Template slug"),
    variables: z.record(z.string()),
    from: z.string(),
    to: z.string().email(),
    subject: z.string().optional().describe("Overrides the template's subject"),
    scheduled_at: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/emails", args),
};

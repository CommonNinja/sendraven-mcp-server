import { z } from "zod";
import { request } from "../client";

export const listAudiencesTool = {
  name: "list_audiences",
  description: "List contact lists and how many contacts each holds.",
  schema: {},
  handler: async () => request("GET", "/v1/audiences"),
};

export const addContactTool = {
  name: "add_contact",
  description:
    "Add someone to an audience. A contact exists once per workspace and can be on any number " +
    "of audiences, so adding an address that already exists joins them to this list rather than " +
    "creating a second copy. Safe to retry.",
  schema: {
    audience_id: z.string(),
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  },
  handler: async (args: Record<string, unknown>) => {
    const { audience_id, ...body } = args;
    return request("POST", `/v1/audiences/${audience_id}/contacts`, body);
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
    "Update a contact. Attributes are merged, so sending one field does not clear the rest.",
  schema: {
    id: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    attributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
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
    "Find a contact by address across every audience, without knowing which list they are on. " +
    "Use email for an exact match, or q for a prefix. Returns each audience membership " +
    "separately — the same address on three lists is three rows — and whether each is " +
    "unsubscribed.",
  schema: {
    email: z.string().optional().describe("Exact address"),
    q: z.string().optional().describe("Address prefix, for a partial match"),
    unsubscribed: z.boolean().optional().describe("Filter to only opted-in or only opted-out"),
    limit: z.number().optional(),
    cursor: z.string().optional().describe("An address, from a previous call's next_cursor"),
  },
  handler: async (args: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const k of ["email", "q", "limit", "cursor"]) {
      if (args[k] !== undefined) q.set(k, String(args[k]));
    }
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
    audience_id: z.string(),
    contact_id: z.string(),
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
  schema: { contact_id: z.string() },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/contacts/${args.contact_id}`),
};

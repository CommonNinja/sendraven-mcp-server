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
    "Add or update a contact in an audience. Re-adding the same address updates it rather " +
    "than duplicating, so this is safe to retry.",
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
  description: "Fetch one contact by id, with their custom properties and engagement dates.",
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

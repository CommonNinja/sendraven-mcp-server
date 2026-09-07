import { z } from "zod";
import { request } from "../client";

export const listDomainsTool = {
  name: "list_sending_domains",
  description:
    "List sending domains with their verification status and the DNS records each one needs. " +
    "Each record shows what is currently published, so this diagnoses a stuck verification.",
  schema: {},
  handler: async () => request("GET", "/v1/domains"),
};

export const addDomainTool = {
  name: "add_sending_domain",
  description:
    "Register a sending domain and get back the DNS records to publish. Give the domain you " +
    "send from — mail.<domain> and news.<domain> are provisioned beneath it and the right one " +
    "is chosen per message, so a marketing complaint spike can never affect password reset " +
    "delivery. Pass risk_class only to provision one of the two on its own.",
  schema: {
    domain: z.string().describe("The domain you send from, e.g. example.com"),
    risk_class: z
      .enum(["transactional", "marketing"])
      .optional()
      .describe("Omit to provision both, which is almost always what you want"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/domains", args),
};

export const verifyDomainTool = {
  name: "verify_sending_domain",
  description: "Re-check a domain's DNS records now instead of waiting for the background monitor.",
  schema: { id: z.string().describe("The sending domain's id from list_sending_domains (a UUID), not the domain name") },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/domains/${args.id}/verify`),
};

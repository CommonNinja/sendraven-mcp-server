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
    "Register a sending domain and get back the DNS records to publish. Use a subdomain per " +
    "risk class — mail.example.com for transactional, news.example.com for marketing — so a " +
    "marketing complaint spike can never affect password reset delivery.",
  schema: {
    domain: z.string().describe("Bare domain, e.g. mail.example.com"),
    risk_class: z.enum(["transactional", "marketing"]),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/domains", args),
};

export const verifyDomainTool = {
  name: "verify_sending_domain",
  description: "Re-check a domain's DNS records now instead of waiting for the background monitor.",
  schema: { id: z.string() },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/domains/${args.id}/verify`),
};

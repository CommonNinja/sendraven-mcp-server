import { z } from "zod";
import { request } from "../client";

export const listDomainsTool = {
  name: "list_sending_domains",
  description:
    "List sending domains with their verification status and the DNS records each one needs. " +
    "Each record shows what is currently published, so this diagnoses a stuck verification. " +
    "mail_from says whether SES has adopted the bounce. subdomain as the Return-Path: pending " +
    "while SES polls for its MX record, then active. SES polls for 72 hours from when the domain " +
    "was added, not from when the MX appears, and then marks it failed; publishing the MX later " +
    "and calling verify_sending_domain restarts it. A verified domain sends fine meanwhile; only " +
    "SPF alignment waits.",
  schema: {},
  handler: async () => request("GET", "/v1/domains"),
};

export const addDomainTool = {
  name: "add_sending_domain",
  description:
    "Register a sending domain and get back the DNS records to publish. It takes the domain " +
    "mail is sent from — mail.<domain> and news.<domain> are provisioned beneath it and the right one " +
    "is chosen per message, so a marketing complaint spike can never affect password reset " +
    "delivery. risk_class provisions one of the two on its own. Two records come " +
    "back marked optional: an inbound MX so replies land in threads, and a link. CNAME that " +
    "turns on click tracking on the customer's own name once its certificate is issued. " +
    "Adding a domain that already exists returns it rather than a duplicate. A public suffix " +
    "such as co.uk or github.io is not a domain anyone can send from and is refused with 422 " +
    "invalid_request; the domain registered under it, e.g. example.co.uk, is accepted. Passing " +
    "mail.example.co.uk or news.example.co.uk is read as example.co.uk. A plan with no room " +
    "for another domain answers 402 plan_limit_reached; a retry answers the same until a person " +
    "upgrades or removes a domain.",
  schema: {
    domain: z
      .string()
      .min(3)
      .describe("The bare domain mail is sent from, e.g. example.com: no scheme, path or @, and not a public suffix"),
    risk_class: z
      .enum(["transactional", "marketing"])
      .optional()
      .describe("Omitted, both are provisioned, which almost every sender needs"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/domains", args),
};

export const verifyDomainTool = {
  name: "verify_sending_domain",
  description:
    "Re-check a domain's DNS records now instead of waiting for the background monitor. Also " +
    "restarts bounce-path (mail_from) verification when SES gave up before the MX record existed.",
  schema: { id: z.string().describe("The sending domain's id from list_sending_domains (a UUID), not the domain name") },
  handler: async (args: Record<string, unknown>) =>
    request("POST", `/v1/domains/${args.id}/verify`),
};

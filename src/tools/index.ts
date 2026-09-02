/**
 * The registry: every tool the server exposes, in the order they are listed
 * to clients.
 *
 * Kept in its own module so it can be read without starting a server —
 * `scripts/export-tools.ts` writes the names and descriptions to
 * `web/lib/content/mcp-tools.json`, which is what the marketing site renders.
 * The site used to state the count by hand and was wrong within a month.
 */
import {
  cancelEmailTool,
  getEmailTool,
  listEmailsTool,
  sendEmailTool,
} from "./emails";
import { addDomainTool, listDomainsTool, verifyDomainTool } from "./domains";
import {
  addSuppressionTool,
  listSuppressionsTool,
  removeSuppressionTool,
} from "./suppressions";
import {
  listBroadcastsTool,
  previewBroadcastTool,
  sendBroadcastTool,
} from "./broadcasts";
import { getThreadTool, listThreadsTool, replyToMessageTool } from "./threads";
import { listTemplatesTool, renderTemplateTool, sendTemplateTool } from "./templates";
import { decideApprovalTool, listApprovalsTool } from "./approvals";
import { emitEventTool, enrollTool, listAutomationsTool } from "./automations";
import { getPreferencesTool, listTopicsTool, setPreferencesTool } from "./topics";
import {
  addContactTool,
  countSegmentTool,
  deleteContactTool,
  findContactTool,
  getContactTool,
  listAudiencesTool,
  listSegmentsTool,
  listTagsTool,
  removeFromAudienceTool,
  tagContactTool,
  updateContactTool,
} from "./audiences";
import {
  batchSuppressTool,
  broadcastRecipientsTool,
  listApiKeysTool,
  getUsageTool,
  listScheduledTool,
  listWebhookEventsTool,
  metricsTool,
} from "./operations";

/**
 * The MCP SDK bundles its own copy of zod, so a schema built against our
 * dependency is structurally identical but nominally different. Describing the
 * shape loosely here keeps the tool definitions readable and colocated with
 * their handlers, at the cost of one cast at registration.
 */
export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export const TOOLS: ToolDef[] = [
  sendEmailTool,
  listEmailsTool,
  getEmailTool,
  cancelEmailTool,
  listDomainsTool,
  addDomainTool,
  verifyDomainTool,
  listSuppressionsTool,
  addSuppressionTool,
  removeSuppressionTool,
  listBroadcastsTool,
  previewBroadcastTool,
  sendBroadcastTool,
  listThreadsTool,
  getThreadTool,
  replyToMessageTool,
  listTemplatesTool,
  renderTemplateTool,
  sendTemplateTool,
  listApprovalsTool,
  decideApprovalTool,
  listAutomationsTool,
  enrollTool,
  emitEventTool,
  listTopicsTool,
  getPreferencesTool,
  setPreferencesTool,
  listAudiencesTool,
  addContactTool,
  getContactTool,
  updateContactTool,
  listSegmentsTool,
  listTagsTool,
  countSegmentTool,
  metricsTool,
  listScheduledTool,
  batchSuppressTool,
  listWebhookEventsTool,
  broadcastRecipientsTool,
  listApiKeysTool,
  getUsageTool,
  findContactTool,
  removeFromAudienceTool,
  deleteContactTool,
  tagContactTool,
];

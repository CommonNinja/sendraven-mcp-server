/**
 * MCP tool annotations: a human title and the behaviour hints a client uses to
 * decide what needs the user's confirmation.
 *
 * Claude's Connectors Directory requires every tool to carry a `title` and the
 * applicable `readOnlyHint` or `destructiveHint`, and clients such as Claude
 * and Cursor ask before running a tool that is not read-only. Kept in one
 * table, keyed by tool name, so the classification can be read and reviewed
 * as a whole; `annotationsFor()` throws for a tool that has none, so a new tool
 * cannot ship unclassified.
 *
 * The hints follow the MCP spec: `destructiveHint` defaults to true for a tool
 * that is not read-only, so every additive write says `false` explicitly.
 * Anything that puts mail on its way to another person is `openWorldHint`:
 * it reaches outside the workspace and cannot be taken back. Removing,
 * deleting, cancelling or overwriting is destructive; so is deciding an
 * approval, because a rejection discards the draft and an approval sends it.
 */

export interface ToolAnnotations {
  title: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

const read = (title: string): ToolAnnotations => ({ title, readOnlyHint: true, openWorldHint: false });
const write = (title: string, extra: Partial<ToolAnnotations> = {}): ToolAnnotations => ({
  title,
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  ...extra,
});
const destroy = (title: string, extra: Partial<ToolAnnotations> = {}): ToolAnnotations => ({
  title,
  readOnlyHint: false,
  destructiveHint: true,
  openWorldHint: false,
  ...extra,
});
/** Puts email on its way to people outside the workspace. */
const send = (title: string): ToolAnnotations => write(title, { openWorldHint: true });

export const TOOL_ANNOTATIONS: Record<string, ToolAnnotations> = {
  // Email
  send_email: send("Send email"),
  list_emails: read("List sent emails"),
  get_email: read("Get email"),
  cancel_scheduled_email: destroy("Cancel scheduled email", { idempotentHint: true }),
  list_scheduled_emails: read("List scheduled emails"),
  get_email_metrics: read("Get email metrics"),

  // Inbox and threads
  list_threads: read("List conversation threads"),
  get_thread: read("Get conversation thread"),
  reply_to_message: send("Reply in thread"),
  mark_thread_handled: write("Mark thread handled", { idempotentHint: true }),

  // Templates
  list_templates: read("List templates"),
  render_template: read("Preview template"),
  send_template_email: send("Send template email"),

  // Approvals
  list_pending_approvals: read("List pending approvals"),
  decide_approval: destroy("Approve or reject held email", { openWorldHint: true }),

  // Sending domains
  list_sending_domains: read("List sending domains"),
  add_sending_domain: write("Add sending domain"),
  verify_sending_domain: write("Check sending domain DNS", { idempotentHint: true }),

  // Suppressions
  list_suppressions: read("List suppressions"),
  add_suppression: write("Suppress address", { idempotentHint: true }),
  suppress_many: write("Suppress addresses in bulk", { idempotentHint: true }),
  remove_suppression: destroy("Remove suppression", { idempotentHint: true }),

  // Campaigns
  list_broadcasts: read("List campaigns"),
  get_broadcast: read("Get campaign"),
  preview_broadcast: read("Preview campaign"),
  list_broadcast_recipients: read("List campaign recipients"),
  create_broadcast: write("Create campaign draft"),
  send_broadcast: send("Send or schedule campaign"),
  resume_broadcast: send("Resume paused campaign"),
  pick_broadcast_winner: send("Pick A/B test winner"),

  // Automations
  list_automations: read("List automations"),
  get_automation: read("Get automation"),
  list_automation_enrollments: read("List automation enrollments"),
  create_automation: write("Create automation"),
  update_automation: destroy("Update automation"),
  set_automation_status: write("Activate or pause automation", { idempotentHint: true }),
  enroll_in_automation: send("Enroll contact in automation"),
  emit_event: send("Emit automation event"),

  // Topics and preferences
  list_topics: read("List topics"),
  get_email_preferences: read("Get email preferences"),
  set_email_preferences: write("Set email preferences", { idempotentHint: true }),

  // Contacts and audiences
  list_audiences: read("List audiences"),
  add_contact: write("Add contact"),
  import_contacts: write("Import contacts"),
  get_contact: read("Get contact"),
  find_contact: read("Find contact"),
  update_contact: destroy("Update contact", { idempotentHint: true }),
  tag_contact: write("Tag contact", { idempotentHint: true }),
  remove_from_audience: destroy("Remove contact from audience", { idempotentHint: true }),
  delete_contact: destroy("Delete contact", { idempotentHint: true }),
  list_segments: read("List segments"),
  count_segment: read("Count segment"),
  list_tags: read("List tags"),

  // Operations
  list_webhook_deliveries: read("List webhook deliveries"),
  get_usage: read("Get usage and sending status"),
};

export function annotationsFor(toolName: string): ToolAnnotations {
  const a = TOOL_ANNOTATIONS[toolName];
  if (!a) throw new Error(`Tool ${toolName} has no annotations in src/tools/annotations.ts`);
  return a;
}

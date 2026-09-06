# @sendraven/mcp

The [SendRaven](https://sendraven.ai) MCP server. Send email, read replies as
threads, run campaigns and automations, and decide approvals, from any client
that speaks the Model Context Protocol.

SendRaven is email infrastructure for AI agents: one API for transactional
mail, campaigns, automations and inbound, priced per email sent and never per
contact, with limits that live on the API key so an agent can run it and a
person can stop it.

## Install

**Claude Code**, remote server, signs in with OAuth on first use:

```bash
claude mcp add --transport http sendraven https://mcp.sendraven.ai/mcp
```

**Cursor, Claude Desktop, and other clients with a JSON config:**

```json
{
  "mcpServers": {
    "sendraven": {
      "url": "https://mcp.sendraven.ai/mcp"
    }
  }
}
```

**Any client, as a local process.** Create an API key under Developers in the
dashboard, then:

```bash
claude mcp add sendraven -e SENDRAVEN_API_KEY=sk_live_… -- npx -y @sendraven/mcp
```

```json
{
  "mcpServers": {
    "sendraven": {
      "command": "npx",
      "args": ["-y", "@sendraven/mcp"],
      "env": { "SENDRAVEN_API_KEY": "sk_live_…" }
    }
  }
}
```

**Remote server with a key instead of OAuth**, for an agent running
unattended:

```json
{
  "mcpServers": {
    "sendraven": {
      "url": "https://mcp.sendraven.ai/mcp",
      "headers": { "Authorization": "Bearer sk_live_…" }
    }
  }
}
```

Give an agent's key a daily send limit, a recipient allowlist, or an approval
hold. The tools respect all three. See
[Limits for agents](https://sendraven.ai/docs/agents).

## Behaviour worth knowing

- **A held send is not a failure.** When a key requires approval,
  `send_email` returns `pending_approval` with an id. Report that it awaits a
  person; do not retry.
- **Out of plan is 402, not 429.** `get_usage` reports plan, usage and
  remaining, so an agent can say "you are near your limit" before a batch.
- **Two calls cannot be undone.** `send_broadcast` mails an audience; run
  `preview_broadcast` first. `remove_suppression` lets us mail an address that
  bounced or complained. Neither is a way to fix a failed send.
- A failed call returns the API's own message, so "domain not verified" comes
  back as those words rather than a bare 403.

## Tools

<!-- tools:start -->
49 tools, generated from the server's registry.

| Tool | What it does |
| --- | --- |
| `send_email` | Send a transactional email, immediately or scheduled. Use scheduled_at with a relative phrase like 'in 3 days' or an ISO timestamp. The From domain must already be verified. |
| `list_emails` | List recent messages with their delivery status. Filter by status (queued, scheduled, sent, delivered, bounced, complained, rejected) or recipient. |
| `get_email` | Fetch one message with its full event timeline (send, delivery, bounce, complaint, open, click). This is the tool to reach for when asked why an email didn't arrive. |
| `cancel_scheduled_email` | Cancel a scheduled email before it sends. Only works while status is 'scheduled'. |
| `list_sending_domains` | List sending domains with their verification status and the DNS records each one needs. Each record shows what is currently published, so this diagnoses a stuck verification. |
| `add_sending_domain` | Register a sending domain and get back the DNS records to publish. Give the domain you send from — mail.<domain> and news.<domain> are provisioned beneath it and the right one is chosen per message, so a marketing complaint spike can never affect password reset delivery. Pass risk_class only to provision one of the two on its own. |
| `verify_sending_domain` | Re-check a domain's DNS records now instead of waiting for the background monitor. |
| `list_suppressions` | List addresses we refuse to mail and why (hard_bounce, complaint, unsubscribe, manual). Check here first when someone reports not receiving email. |
| `add_suppression` | Stop sending to an address. Scope 'marketing' leaves transactional mail working. |
| `remove_suppression` | Remove a suppression so the address can be mailed again. Be careful with hard bounces — the address was rejected by the receiving server, and re-sending raises the bounce rate that AWS enforces on. |
| `create_broadcast` | Create a campaign as a draft. Nothing is sent: follow with preview_broadcast, then send_broadcast. identity_id must be a marketing sending domain (see list_sending_domains; risk_class 'marketing'). To A/B test, pass 2 to 10 'variants' that differ in subject, from_name or send_at, and optionally 'ab_test'. A subject or from-name test sends sample_share of the audience (default 0.2) split evenly across the variants, waits decide_after_minutes (default 240) after the sample is out, picks the variant with the best unique open rate (or click rate with metric 'click'), and sends the rest to it. Each variant needs at least 100 recipients in the sample or the send is refused — preview_broadcast shows the number. Metric 'click' only works once the domain has click tracking; until then every variant shows zero clicks and the first variant wins by default. |
| `get_broadcast` | One campaign, with a 'progress' object while it is sending, paused or testing: how many addresses are still pending, sent, failed, or skipped because the person opted out after the campaign started. This is how you tell a paused campaign that is still making progress from one waiting on quota. An A/B test carries 'ab_test' with live per-variant results — sent, unique opens, unique clicks and their rates — plus 'decide_at' and, once decided, 'winner' and 'decided_by'. Status 'testing' means the sample is out and the rest of the audience is waiting on the decision. |
| `list_broadcasts` | List campaigns with their status and send progress. A campaign showing 'paused' is not broken: it ran out of the day's sending quota part way and is waiting to continue. One showing 'testing' is an A/B test whose sample has gone out and whose winner is not yet decided. Use get_broadcast to see how much is left or how each variant is doing, and resume_broadcast to continue a paused one now. |
| `preview_broadcast` | How many contacts a campaign would reach, and whether the reputation gate would allow it. Always run this before sending — it is the only way to see the size of a campaign without starting it. For an A/B test it also reports the sample size and per-variant count against the 100-per-variant floor; a send below the floor is refused. |
| `send_broadcast` | Send a campaign now, or schedule it with scheduled_at. This mails every contact in the segment and cannot be undone once started — run preview_broadcast first. A campaign bigger than the day's remaining quota is not rejected: it sends what it can and stops as 'paused', then continues later. That is expected, not an error to retry. An A/B test sends its sample, goes to 'testing', and sends the rest to the winner after decide_after_minutes or when pick_broadcast_winner is called. A send-time test is scheduled by its variants' send_at and does not accept scheduled_at. |
| `pick_broadcast_winner` | Decide an A/B test now instead of waiting for decide_at. Pass 'variant' to choose a key yourself, or omit it to have the metric decide on the figures so far. The rest of the audience is then sent to the winner and cannot be redirected. Only a campaign in status 'testing' can be decided; anything else answers 409. Read get_broadcast first — a variant with a handful of opens more is not a result, and the worker decides on its own at decide_at. |
| `resume_broadcast` | Continue a campaign left 'paused' by the daily sending quota. It mails only the addresses still pending — the audience was frozen when the campaign started and everyone already reached is marked — so calling this twice cannot double-send. Only works on a paused campaign; anything else answers 409. A background worker also resumes paused campaigns on its own once quota frees up, so use this only when waiting is not acceptable. An A/B test paused mid-sample resumes the sample; one paused after the decision resumes the winner. |
| `list_threads` | List email conversations. Pass awaiting_reply=true to get only the threads where someone has written to you and you haven't answered — this is the tool to poll when deciding what needs a response. |
| `get_thread` | Read a conversation as a chronological transcript of outbound and inbound messages. Inbound text already has quoted history and signatures stripped, so read `text`; `raw_text` holds the untrimmed body if the stripped version looks wrong. Check spf_verdict and dkim_verdict before trusting a reply's claimed sender. |
| `reply_to_message` | Reply to a message, keeping it on the same conversation. Sets the threading headers so the recipient's mail client shows it as part of the existing exchange rather than a new one. Prefer this over send_email whenever you are answering something. |
| `list_templates` | List stored email templates and the variables each one needs. Prefer sending via a template over composing HTML yourself — templates carry the brand styling and the unsubscribe footer. |
| `render_template` | Render a template with values, without sending. Use this to check your copy reads correctly before mailing a real person. Returns an error listing any missing variables. |
| `send_template_email` | Send an email built from a stored template. Variable values are HTML-escaped on substitution, so they are safe to fill from user-supplied text. |
| `list_pending_approvals` | List messages held for human approval, with their full content. A key configured to require approval drafts rather than sends; a person releases it. If your send returned status 'pending_approval', it is waiting here — do not retry the send. |
| `decide_approval` | Approve or reject a held message. Approving sends it immediately. Only use this when a human has explicitly told you which decision to make — the hold exists precisely so that an agent is not the one deciding. |
| `list_automations` | List multi-step email sequences and how many people are currently in each. Use this to find the right automation before enrolling someone. |
| `enroll_in_automation` | Put someone into a multi-step sequence. Prefer this over scheduling several emails yourself: the sequence stops on its own if they unsubscribe, reply, or hard bounce, which you would otherwise have to track and cancel by hand. Enrolling the same person twice is a no-op, so it is safe to retry a call you are unsure about. |
| `emit_event` | Emit a named event, starting every automation that waits on it — for example 'trial_started' or 'invoice_overdue'. Use this when you want the configured sequences to decide what happens, rather than naming an automation yourself. |
| `list_topics` | List subscription topics — the categories a person can opt out of individually. Pass a topic when sending marketing mail so recipients can unsubscribe from that kind alone rather than from everything. |
| `get_email_preferences` | What one person has chosen to receive. Check this before asking a human why someone isn't getting a particular kind of email — an opt-out looks identical to a delivery failure from the outside. |
| `set_email_preferences` | Set which topics a person receives. Only do this when they have actually asked — silently re-subscribing someone who opted out is what generates spam complaints. |
| `list_audiences` | List contact lists and how many contacts each holds. |
| `add_contact` | Add someone to an audience. A contact exists once per workspace and can be on any number of audiences, so adding an address that already exists joins them to this list rather than creating a second copy. Safe to retry. |
| `get_contact` | Fetch one contact by id, with their audience memberships, custom properties and engagement dates. |
| `update_contact` | Update a contact. Attributes are merged, so sending one field does not clear the rest. |
| `list_segments` | List saved audience filters. Use a segment id when creating a campaign rather than describing the filter inline, so the same definition can be reused and counted. |
| `list_tags` | Every tag in use in the workspace, with how many contacts carry each. Tags are free-form, so this is the only way to know what exists before applying one. |
| `count_segment` | How many contacts a segment currently matches. Run this before building a campaign around it — a filter that matches nobody is easier to spot here than after a send. |
| `get_email_metrics` | Delivery and engagement over a window. Open and click rates are over delivered, not sent — a low open rate with a high bounce rate is a deliverability problem, not an engagement one. |
| `list_scheduled_emails` | Messages queued to send later but not yet sent. Cancel one with cancel_scheduled_email. |
| `suppress_many` | Stop sending to many addresses at once — the path for importing another provider's unsubscribe list before a first campaign. Without it, everyone who already opted out there gets mailed again here. |
| `list_webhook_deliveries` | Recent delivery attempts for a webhook endpoint, with status codes and errors. This is how to tell 'we never sent it' from 'your endpoint returned 500'. |
| `list_broadcast_recipients` | Who a campaign reached and what happened to each message. |
| `list_api_keys` | List this workspace's API keys with their scopes and limits. Never returns key values. |
| `get_usage` | This workspace's plan, how many emails it has sent this month, and how many are left. Check before a large batch: a send that would cross the included allowance on a plan without overage is refused whole, so it is better to know first than to discover it halfway through a campaign. |
| `find_contact` | Find a contact by address across every audience, without knowing which list they are on. Use email for an exact match, or q for a prefix. Returns each audience membership separately — the same address on three lists is three rows — and whether each is unsubscribed. |
| `remove_from_audience` | Take a contact off one audience. They stay in the workspace and keep every other audience, their suppression and their engagement history. To remove the person entirely use delete_contact — leaving a list and being forgotten are different things. |
| `delete_contact` | Remove a person from the workspace entirely, along with every audience membership. Their suppression and topic preferences are kept on purpose — an opt-out has to outlive the contact record, or the next import silently puts them back on the list. To take someone off a single audience use remove_from_audience instead. |
| `tag_contact` | Add or remove tags on a contact. Tags are flat labels — vip, beta, churned — as opposed to custom properties, which are declared fields with a value. They are lower-cased and spaces become hyphens, so VIP and vip are the same tag. Tagging reaches the person across every audience they are on. Call list_tags first to see what the workspace already uses, rather than inventing a synonym for an existing tag. |
<!-- tools:end -->

## Environment

| Variable | Purpose |
| --- | --- |
| `SENDRAVEN_API_KEY` | Bearer key for the local process. Not needed for the remote server with OAuth. |
| `SENDRAVEN_API_URL` | Defaults to `https://api.sendraven.ai`. |
| `PORT` | When set, the server listens over Streamable HTTP instead of stdio. |

The server holds no database or provider credentials of its own. It is a
proxy over the public REST API and can reach exactly what the caller's key
can reach.

## Links

- [Documentation](https://sendraven.ai/docs/mcp)
- [OpenAPI](https://sendraven.ai/openapi.json) and [llms.txt](https://sendraven.ai/llms.txt)
- [Pricing](https://sendraven.ai/pricing)

## License

MIT. Copyright Common Ninja Ltd.

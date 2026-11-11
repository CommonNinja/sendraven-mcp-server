import { z } from "zod";
import { request } from "../client";

export const uploadMediaTool = {
  name: "upload_media",
  description:
    "Host an image for use in email HTML: a logo or photo in a template, a campaign or an automation step. " +
    "Returns a media object whose url goes in an <img src>; it is served from the workspace's own tracking " +
    "domain (https://link.<sending domain>/media/...), and the url is public to anyone who has it. Images only: " +
    "PNG, JPEG, GIF or WebP up to 5 MB, judged by the file's bytes. A PDF, document, video or SVG is refused with " +
    "422 invalid_request; a file for a recipient is an attachment on the email, not media. Prefer source_url, a " +
    "public http(s) address the image is fetched from (no redirects, no private addresses); content is the " +
    "base64 bytes and is only practical for small images. The image is re-encoded, so content_type, size, width " +
    "and height describe the stored image and WebP comes back as PNG, JPEG or GIF. The same image uploaded again " +
    "returns the one already stored. 409 invalid_state means no sending domain has a live tracking record yet " +
    "(list_sending_domains shows the record to publish); 402 payment_method_required needs a person to add a " +
    "card in the dashboard; 402 plan_limit_reached means the workspace holds its maximum (delete_media frees room). " +
    "Call it rather than predicting the outcome: many workspaces need no card (get_usage shows " +
    "payment_method.required false), so a missing card in get_usage is not a reason to skip the upload.",
  schema: {
    source_url: z
      .string()
      .optional()
      .describe("Public http(s) URL of the image. Exactly one of source_url and content"),
    content: z
      .string()
      .optional()
      .describe("The image as base64, or a data: URL. Exactly one of source_url and content"),
    filename: z.string().optional().describe("A label for the image, e.g. logo.png. Not part of its URL"),
  },
  handler: async (args: Record<string, unknown>) => request("POST", "/v1/media", args),
};

export const listMediaTool = {
  name: "list_media",
  description:
    "The workspace's hosted images, newest first, each with id, filename, content_type, size, width, height " +
    "and the url to use in an <img src>. Look here before uploading a logo the workspace probably already " +
    "has. At most 100 per call; while has_more is true, next_cursor passed back as cursor returns the next " +
    "page. url is null when the workspace has no live tracking domain.",
  schema: {
    limit: z.number().int().min(1).max(100).optional().describe("Page size, 1 to 100; defaults to 50"),
    cursor: z.string().optional().describe("next_cursor from the previous page, passed back unchanged"),
  },
  handler: async (args: Record<string, unknown>) => {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set("limit", String(args.limit));
    if (args.cursor !== undefined) qs.set("cursor", String(args.cursor));
    const q = qs.toString();
    return request("GET", `/v1/media${q ? `?${q}` : ""}`);
  },
};

export const deleteMediaTool = {
  name: "delete_media",
  description:
    "Delete a hosted image by id (from list_media). Its url stops working within minutes everywhere it is " +
    "used: in email already delivered, and in any template, campaign or automation step that still references " +
    "it, where it shows as a broken image. Nothing checks for references, and it cannot be undone, so delete " +
    "only an image no message uses. Answers 404 not_found for an id that is not an image in this workspace.",
  schema: {
    id: z.string().describe("The image's id from list_media, not its filename or URL"),
  },
  handler: async (args: Record<string, unknown>) =>
    request("DELETE", `/v1/media/${encodeURIComponent(String(args.id))}`),
};

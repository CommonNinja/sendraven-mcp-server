/**
 * Write the tool registry to web/lib/content/mcp-tools.json.
 *
 * The marketing site, /mcp and llms.txt all state how many tools the server
 * has and what they are called. Typed by hand, that number was wrong within a
 * month. This runs as part of `npm run build` here, and a unit test in web/
 * fails if the JSON and the registry ever disagree.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "../src/tools";

const out = join(__dirname, "..", "..", "web", "lib", "content", "mcp-tools.json");

const tools = TOOLS.map((t) => ({ name: t.name, description: t.description }));

writeFileSync(out, JSON.stringify(tools, null, 2) + "\n");
console.log(`wrote ${tools.length} tools to ${out}`);

/**
 * Write the tool registry where the things that describe it can read it.
 *
 * Two outputs. `web/lib/content/mcp-tools.json` feeds the marketing site and
 * llms.txt, and is only written when the web package is present (this code
 * is also published on its own, where it is not). `README.md` gets its tool
 * section rewritten between two markers, so the public package never lists
 * a tool the server does not have. Typed by hand, the count was wrong within
 * a month.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "../src/tools";

const root = join(__dirname, "..");
const tools = TOOLS.map((t) => ({ name: t.name, description: t.description }));

const webOut = join(root, "..", "web", "lib", "content", "mcp-tools.json");
if (existsSync(join(root, "..", "web", "lib", "content"))) {
  writeFileSync(webOut, JSON.stringify(tools, null, 2) + "\n");
  console.log(`wrote ${tools.length} tools to ${webOut}`);
}

const readme = join(root, "README.md");
if (existsSync(readme)) {
  const start = "<!-- tools:start -->";
  const end = "<!-- tools:end -->";
  const src = readFileSync(readme, "utf8");
  const a = src.indexOf(start);
  const b = src.indexOf(end);
  if (a !== -1 && b !== -1) {
    const table = [
      `${tools.length} tools, generated from the server's registry.`,
      "",
      "| Tool | What it does |",
      "| --- | --- |",
      ...tools.map((t) => `| \`${t.name}\` | ${t.description.replace(/\|/g, "\\|")} |`),
    ].join("\n");
    writeFileSync(readme, `${src.slice(0, a + start.length)}\n${table}\n${src.slice(b)}`);
    console.log(`rewrote the tool table in README.md (${tools.length} tools)`);
  }
}

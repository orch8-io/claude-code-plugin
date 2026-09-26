#!/usr/bin/env node
// Dependency-free checks for the plugin + marketplace manifests and skill frontmatter.
// Run: node scripts/validate.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (rel) => {
  try {
    return JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch (e) {
    fail(`${rel}: ${e.message}`);
    return null;
  }
};
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const plugin = readJson(".claude-plugin/plugin.json");
if (plugin) {
  if (!KEBAB.test(plugin.name ?? "")) fail(`plugin.json: name must be kebab-case, got ${plugin.name}`);
  if (!SEMVER.test(plugin.version ?? "")) fail(`plugin.json: version must be semver, got ${plugin.version}`);
  if (!plugin.description) fail("plugin.json: description is required");
  for (const [key, cfg] of Object.entries(plugin.userConfig ?? {})) {
    if (!cfg.type || !cfg.title) fail(`plugin.json: userConfig.${key} needs type and title`);
  }
}

const market = readJson(".claude-plugin/marketplace.json");
if (market) {
  if (!KEBAB.test(market.name ?? "")) fail(`marketplace.json: name must be kebab-case, got ${market.name}`);
  if (!market.owner?.name) fail("marketplace.json: owner.name is required");
  if (!Array.isArray(market.plugins) || market.plugins.length === 0) fail("marketplace.json: plugins[] is empty");
  for (const p of market.plugins ?? []) {
    if (!p.name || !p.source) fail(`marketplace.json: plugin entry needs name and source: ${JSON.stringify(p)}`);
    if (typeof p.source === "string" && !existsSync(join(root, p.source, ".claude-plugin/plugin.json")))
      fail(`marketplace.json: source ${p.source} has no .claude-plugin/plugin.json`);
    if (p.source === "./" && plugin && p.name !== plugin.name)
      fail(`marketplace.json: entry name ${p.name} != plugin.json name ${plugin.name}`);
  }
}

const mcp = readJson(".mcp.json");
if (mcp) {
  const servers = Object.entries(mcp.mcpServers ?? {});
  if (servers.length === 0) fail(".mcp.json: mcpServers is empty");
  const declared = new Set(Object.keys(plugin?.userConfig ?? {}));
  const text = JSON.stringify(mcp);
  for (const m of text.matchAll(/\$\{user_config\.([A-Za-z0-9_]+)\}/g)) {
    if (!declared.has(m[1])) fail(`.mcp.json: \${user_config.${m[1]}} is not declared in plugin.json userConfig`);
  }
  for (const [name, s] of servers) {
    if (s.type === "http" && !/\/api\/v1\/mcp$/.test(s.url ?? "")) fail(`.mcp.json: ${name}.url must end in /api/v1/mcp`);
  }
}

// Skills: skills/<dir>/SKILL.md with YAML frontmatter holding name (== dir) and description.
const skillsDir = join(root, "skills");
const dirs = existsSync(skillsDir) ? readdirSync(skillsDir).filter((d) => statSync(join(skillsDir, d)).isDirectory()) : [];
if (dirs.length === 0) fail("skills/: no skills found");
for (const d of dirs) {
  const rel = `skills/${d}/SKILL.md`;
  if (!existsSync(join(root, rel))) { fail(`${rel}: missing`); continue; }
  const text = readFileSync(join(root, rel), "utf8");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) { fail(`${rel}: no YAML frontmatter`); continue; }
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  if (fm.name !== d) fail(`${rel}: frontmatter name "${fm.name}" must equal directory "${d}"`);
  if (!KEBAB.test(fm.name ?? "") || fm.name.length > 64) fail(`${rel}: name must be kebab-case, max 64 chars`);
  if (!fm.description) fail(`${rel}: description is required`);
  else if (fm.description.length > 1024) fail(`${rel}: description longer than 1024 chars`);
  if (text.slice(m[0].length).trim().length === 0) fail(`${rel}: body is empty`);
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ plugin.json, marketplace.json, .mcp.json and ${dirs.length} skills are valid`);

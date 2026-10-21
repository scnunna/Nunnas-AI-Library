#!/usr/bin/env node
/**
 * Validate library/*.json and regenerate everything derived from it:
 *   dist/library.json   bundle served by both MCP servers
 *   dist/apis.csv       API catalog for Excel
 *   dist/graph.json     nodes/edges (collection -> category -> item, item -> tag)
 *   INDEX.md            human index (all curated items, API categories)
 *   MINDMAP.md          Mermaid mind map (renders on GitHub)
 *   docs/apis/*.md      one page per API category
 * Deterministic: output only changes when library content changes.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { loadLibrary, slug, VERDICTS, REQUIRED } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/scnunna/Public-AI-Library";
const lib = loadLibrary(ROOT);

// Display order: curated collections first, bulk API catalog after.
const ORDER = ["content-tools", "mcp-servers", "skills", "agent-tools", "directories", "web-tools", "design-resources",
  "assessments", "skill-capabilities", "api-recipes", "compliance", "notes", "apis", "api-test-endpoints"];
const names = [...ORDER.filter((n) => lib[n]), ...Object.keys(lib).filter((n) => !ORDER.includes(n)).sort()];

// ---------- validate ----------
const errors = [], warnings = [], seen = new Map();
const SECRET = [/sk-[A-Za-z0-9_-]{20,}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /AKIA[0-9A-Z]{16}/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, /xox[baprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY/];
const denyFile = join(ROOT, "private", "denylist.txt"); // local-only list of private terms that must never be published
const DENY = existsSync(denyFile) ? readFileSync(denyFile, "utf8").split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
for (const n of names) {
  for (const it of lib[n].items) {
    for (const f of REQUIRED) if (!it[f]) errors.push(`${n}/${it.id || it.name}: missing ${f}`);
    if (seen.has(it.id)) errors.push(`duplicate id ${it.id} (${seen.get(it.id)} & ${n})`); else seen.set(it.id, n);
    if (it.verdict && !VERDICTS.includes(it.verdict)) errors.push(`${it.id}: bad verdict '${it.verdict}'`);
    if (it.url && !/^https?:\/\//.test(it.url)) warnings.push(`${it.id}: url not http(s): ${it.url}`);
    const blob = JSON.stringify(it);
    for (const re of SECRET) if (re.test(blob)) errors.push(`${it.id}: looks like a secret (${re})`);
    for (const d of DENY) if (blob.toLowerCase().includes(d)) errors.push(`${it.id}: contains private term from denylist`);
  }
}
if (errors.length) { console.error("BUILD FAILED\n" + errors.join("\n")); process.exit(1); }

// ---------- bundle ----------
const all = names.flatMap((n) => lib[n].items.map((i) => ({ ...i, collection: n })));
const hash = createHash("sha256").update(JSON.stringify(names.map((n) => lib[n]))).digest("hex").slice(0, 12);
const updatedAt = all.reduce((m, i) => (String(i.asOf || "") > m ? String(i.asOf) : m), "");
const meta = { name: "Public AI Library", repo: REPO, version: `${updatedAt.replaceAll("-", ".")}+${hash}`, updatedAt, builtAt: updatedAt, hash, total: all.length };
const bundle = { meta, collections: Object.fromEntries(names.map((n) => [n, lib[n]])) };
mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", "library.json"), JSON.stringify(bundle));

// ---------- csv ----------
const csvq = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const apis = lib.apis?.items || [];
writeFileSync(join(ROOT, "dist", "apis.csv"), "﻿name,category,url,description,auth,https,cors,testUrl\n" +
  apis.map((a) => [a.name, a.category, a.url, a.description, a.extra?.auth, a.extra?.https, a.extra?.cors, a.extra?.testUrl].map(csvq).join(",")).join("\n") + "\n");

// ---------- graph ----------
const nodes = [], edges = [], tagSet = new Set();
for (const n of names) {
  nodes.push({ id: `c:${n}`, type: "collection", label: lib[n].title });
  const cats = new Set(lib[n].items.map((i) => i.category));
  for (const c of cats) { nodes.push({ id: `k:${n}:${c}`, type: "category", label: c }); edges.push([`c:${n}`, `k:${n}:${c}`, "has"]); }
  if (n === "apis") continue; // keep the graph readable; APIs are reachable via categories
  for (const i of lib[n].items) {
    nodes.push({ id: i.id, type: "item", label: i.name, verdict: i.verdict, url: i.url });
    edges.push([`k:${n}:${i.category}`, i.id, "contains"]);
    for (const t of i.tags || []) { tagSet.add(t); edges.push([i.id, `t:${t}`, "tagged"]); }
    for (const r of i.relevance || []) { tagSet.add(`for:${r}`); edges.push([i.id, `t:for:${r}`, "relevant-to"]); }
  }
}
for (const t of tagSet) nodes.push({ id: `t:${t}`, type: "tag", label: t });
writeFileSync(join(ROOT, "dist", "graph.json"), JSON.stringify({ meta, nodes, edges }));

// ---------- markdown helpers ----------
const md = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const cut = (s, n = 140) => { s = md(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const V = { adopt: "🟢 adopt", have: "✅ have", trial: "🔵 trial", assess: "🟡 assess", reference: "📚 ref", skip: "⛔ skip" };
const link = (i) => (i.url ? `[${md(i.name)}](${i.url})` : md(i.name));
const counts = (items, key) => items.reduce((m, i) => ((m[i[key] ?? "—"] = (m[i[key] ?? "—"] || 0) + 1), m), {});

// ---------- INDEX.md ----------
let idx = `# Public AI Library — Index\n\n> Auto-generated by \`scripts/build.mjs\` — do not edit by hand. Version \`${meta.version}\` · ${all.length} items · last content update ${updatedAt}.\n>\n> Search it from Claude via the **public-ai-library** MCP (\`search\`, \`why\`, \`graphql\`), browse the [web view](https://scnunna.github.io/Public-AI-Library/), or see the [mind map](MINDMAP.md).\n\n`;
idx += `## At a glance\n\n| Collection | Items | 🟢 adopt | ✅ have | 🔵 trial | 🟡 assess | ⛔ skip |\n|---|---:|---:|---:|---:|---:|---:|\n`;
for (const n of names) { const v = counts(lib[n].items, "verdict"); idx += `| [${lib[n].title}](#${slug(lib[n].title)}) | ${lib[n].items.length} | ${v.adopt || ""} | ${v.have || ""} | ${v.trial || ""} | ${v.assess || ""} | ${v.skip || ""} |\n`; }
idx += `\nVerdicts: **adopt** use it · **have** already in our stack · **trial** worth a pilot · **assess** watch/verify first · **reference** learn from, don't deploy · **skip** rejected (see *why*).\n`;
for (const n of names) {
  const c = lib[n];
  idx += `\n## ${c.title}\n\n${c.description}\n\n`;
  if (n === "apis") {
    const cats = Object.entries(counts(c.items, "category")).sort((a, b) => b[1] - a[1]);
    idx += `${c.items.length} APIs, ${c.items.filter((i) => i.tags?.includes("no-key")).length} need no key. Full list: [dist/apis.csv](dist/apis.csv).\n\n| Category | APIs | No key |\n|---|---:|---:|\n`;
    idx += cats.map(([k, v]) => `| [${md(k)}](docs/apis/${slug(k)}.md) | ${v} | ${c.items.filter((i) => i.category === k && i.tags?.includes("no-key")).length} |`).join("\n") + "\n";
    continue;
  }
  const byCat = {};
  for (const i of c.items) (byCat[i.category] ||= []).push(i);
  for (const [cat, items] of Object.entries(byCat).sort((a, b) => a[0].localeCompare(b[0]))) {
    idx += `**${md(cat)}**\n\n| Name | Verdict | What / why |\n|---|---|---|\n`;
    const rank = (i) => VERDICTS.indexOf(i.verdict ?? "assess");
    for (const i of items.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)))
      idx += `| ${link(i)}${i.stars ? ` ⭐${i.stars >= 1000 ? Math.round(i.stars / 100) / 10 + "k" : i.stars}` : ""} | ${V[i.verdict] || ""} | ${cut(i.description, 120)}${i.why ? ` — *${cut(i.why, 120)}*` : ""} |\n`;
    idx += "\n";
  }
}
writeFileSync(join(ROOT, "INDEX.md"), idx);

// ---------- docs/apis ----------
rmSync(join(ROOT, "docs", "apis"), { recursive: true, force: true });
mkdirSync(join(ROOT, "docs", "apis"), { recursive: true });
const apiCats = {};
for (const a of apis) (apiCats[a.category] ||= []).push(a);
for (const [cat, items] of Object.entries(apiCats))
  writeFileSync(join(ROOT, "docs", "apis", `${slug(cat)}.md`), `# APIs — ${cat}\n\n[← Index](../../INDEX.md)\n\n| API | Auth | HTTPS | CORS | Description |\n|---|---|---|---|---|\n` +
    items.sort((a, b) => a.name.localeCompare(b.name)).map((a) => `| ${link(a)} | ${md(a.extra?.auth)} | ${a.extra?.https ? "yes" : "no"} | ${md(a.extra?.cors)} | ${cut(a.description, 160)}${a.extra?.testUrl ? ` ([test](${a.extra.testUrl}))` : ""} |`).join("\n") + "\n");

// ---------- MINDMAP.md ----------
const mm = (s) => String(s).replace(/[()[\]{}"`]/g, "").replace(/\s+/g, " ").trim().slice(0, 48);
let map = "```mermaid\nmindmap\n  root((Public AI Library))\n";
for (const n of names) {
  const c = lib[n];
  map += `    ${slug(n)}[${mm(c.title)} · ${c.items.length}]\n`;
  const cats = Object.entries(counts(c.items, "category")).sort((a, b) => b[1] - a[1]).slice(0, n === "apis" ? 20 : 14);
  for (const [cat, cnt] of cats) {
    map += `      ${mm(cat)} · ${cnt}\n`;
    if (n !== "apis" && n !== "notes") for (const i of c.items.filter((i) => i.category === cat && ["adopt", "have"].includes(i.verdict)).slice(0, 5)) map += `        ${mm(i.name)}\n`;
  }
}
map += "```\n";
writeFileSync(join(ROOT, "MINDMAP.md"), `# Public AI Library — Mind map\n\n> Auto-generated. Collections → categories (item count) → adopted items. Full detail in [INDEX.md](INDEX.md).\n\n${map}`);

// ---------- MINDMAP.graphql ----------
// GraphQL-style mind map: one runnable named query per collection/category (paste into the MCP `graphql` tool),
// with the curated items listed underneath as comments grouped by verdict.
const gqlName = (s) => slug(s).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/[^A-Za-z0-9_]/g, "").replace(/^(\d)/, "_$1") || "x";
const VORDER = ["adopt", "have", "trial", "assess", "reference", "skip"];
let gql = `# Public AI Library — GraphQL-style mind map\n# Auto-generated by scripts/build.mjs (v${meta.version}). Do not edit by hand.\n#\n# Read it top-down: collection → category → items by verdict.\n# Every block is a runnable query for the MCP \`graphql\` tool (see schema.graphql).\n# Verdicts: adopt > have > trial > assess > reference > skip\n\n`;
for (const n of names) {
  const c = lib[n];
  gql += `# ═══ ${c.title} (${n}) · ${c.items.length} items\n`;
  const cats = Object.entries(counts(c.items, "category")).sort((a, b) => b[1] - a[1]);
  for (const [cat, cnt] of cats) {
    gql += `query ${gqlName(n)}_${gqlName(cat)} { items(collection: "${n}", category: ${JSON.stringify(cat)}, limit: ${Math.min(cnt, 100)}) { name verdict why url } }  # ${cnt}\n`;
    if (n === "apis" || n === "notes") continue;
    const inCat = c.items.filter((i) => i.category === cat);
    for (const v of VORDER) {
      const ns = inCat.filter((i) => i.verdict === v).map((i) => i.name);
      if (ns.length) gql += `#   ${v.padEnd(9)} ${ns.join(" · ")}\n`;
    }
  }
  gql += "\n";
}
writeFileSync(join(ROOT, "MINDMAP.graphql"), gql);

// ---------- llms.txt ----------
// Plain-text entry point for AI assistants (llms.txt convention).
const adoptedTop = all.filter((i) => i.collection !== "apis" && i.verdict === "adopt");
let llms = `# Public AI Library\n\n> Curated catalog of public APIs, MCP servers, Claude skills, agent frameworks and AI content tools. Every curated entry has a verdict (adopt | have | trial | assess | reference | skip) and a one-line why. Version ${meta.version}, ${all.length} items, updated ${updatedAt}.\n\n`;
llms += `How to use this repo as an AI assistant:\n- Before recommending or researching a tool, look it up here first (MCP tool \`why\`, or search dist/library.json).\n- Source of truth: library/*.json. Generated views: INDEX.md (human), MINDMAP.md (Mermaid), MINDMAP.graphql (query map), dist/library.json (full bundle).\n- Raw bundle URL: ${REPO.replace("https://github.com/", "https://raw.githubusercontent.com/")}/main/dist/library.json\n- Query language: schema.graphql (run through the MCP \`graphql\` tool).\n\n## Files\n\n- [README.md](README.md): what this is and how to connect\n- [CONNECT.md](CONNECT.md): step-by-step setup for Claude (web, desktop, Claude Code)\n- [INDEX.md](INDEX.md): every curated item by collection and category\n- [MINDMAP.graphql](MINDMAP.graphql): runnable query per category with items by verdict\n- [schema.graphql](schema.graphql): item shape and query fields\n- [CHANGELOG.md](CHANGELOG.md): what was added when\n\n## Collections\n\n`;
for (const n of names) llms += `- ${n}: ${lib[n].title} (${lib[n].items.length})${lib[n].description ? ` — ${lib[n].description}` : ""}\n`;
llms += `\n## Adopted (recommended) items\n\n` + adoptedTop.map((i) => `- ${i.name} [${i.collection}/${i.category}]${i.url ? ` ${i.url}` : ""}`).join("\n") + "\n";
writeFileSync(join(ROOT, "llms.txt"), llms);

console.log(`built ${meta.version}: ${all.length} items in ${names.length} collections${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
if (warnings.length && process.argv.includes("-v")) console.log(warnings.join("\n"));

#!/usr/bin/env node
/**
 * Add or update library items, rebuild, and (optionally) sync to GitHub.
 *
 *   node scripts/add.mjs <items.json> [--collection <name>|auto] [--source <label>] [--push] [-m "message"]
 *
 * items.json = array of items (see schema.graphql `Item`). Existing items are matched by id,
 * then URL, then case-insensitive name, and updated in place (fields merged, id kept).
 * --collection auto routes by `kind` (see routeCollection).
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { slug, normVerdict, loadLibrary } from "./lib.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function routeCollection(it) {
  const k = String(it.kind || "").toLowerCase();
  if (["skill", "plugin", "marketplace"].includes(k)) return "skills";
  if (k === "mcp") return "mcp-servers";
  if (["registry", "list", "directory"].includes(k)) return "directories";
  if (k === "api") return "apis";
  if (["model", "node-pack"].includes(k) || (it.relevance || []).includes("content-studio") && !/agent|mcp|llm|observability/.test(it.category || "")) return "content-tools";
  return "agent-tools";
}

const PREFIX = { apis: "api", "mcp-servers": "mcp", skills: "skill", "agent-tools": "tool", "content-tools": "content",
  directories: "dir", "web-tools": "web", "design-resources": "design", assessments: "assess", compliance: "rule", notes: "note" };
const nameOverlap = (a, b) => { const t = (x) => new Set(slug(x).split("-").filter((w) => w.length > 2)); const A = t(a); return [...t(b)].some((w) => A.has(w)); };
const normUrl = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").replace(/\.git$/, "");

export function addItems(items, { collection = "auto", source = "manual", today = new Date().toISOString().slice(0, 10) } = {}) {
  const lib = loadLibrary(ROOT);
  const allIds = new Set(Object.values(lib).flatMap((c) => c.items.map((i) => i.id)));
  const touched = new Set(), log = [];
  for (const raw of items) {
    if (!raw?.name) throw new Error("every item needs a name");
    const cname = collection === "auto" ? routeCollection(raw) : collection;
    if (!lib[cname]) lib[cname] = { collection: cname, title: cname, description: "", items: [] };
    // find existing anywhere in the library (dedupe across collections)
    let found = null;
    for (const c of Object.values(lib)) {
      // URL alone is not identity (monorepos host many tools): require the names to overlap too
      found = c.items.find((i) => (raw.id && i.id === raw.id) || i.name.toLowerCase() === raw.name.toLowerCase() && i.kind !== "api"
        || (raw.url && i.url && normUrl(i.url) === normUrl(raw.url) && nameOverlap(i.name, raw.name)));
      if (found) { touched.add(c.collection); break; }
    }
    const verdict = raw.verdict ? normVerdict(raw.verdict) : undefined;
    const clean = Object.fromEntries(Object.entries({ ...raw, verdict, verdictNote: raw.verdictNote ?? (raw.verdict && raw.verdict !== verdict ? raw.verdict : undefined) })
      .filter(([, v]) => v !== undefined));
    if (found) {
      const { id, ...rest } = clean;
      Object.assign(found, rest, { asOf: raw.asOf || today });
      log.push(`updated ${found.id}`);
    } else {
      let id = raw.id || `${PREFIX[cname] || "item"}-${slug(raw.name)}`.slice(0, 80), n = 2;
      const base = id; while (allIds.has(id)) id = `${base}-${n++}`;
      allIds.add(id);
      lib[cname].items.push({
        id, name: raw.name, kind: raw.kind || "tool", category: raw.category || "uncategorized", url: raw.url ?? null,
        description: raw.description || "", verdict: verdict ?? null, verdictNote: clean.verdictNote ?? null, why: raw.why ?? null,
        tags: raw.tags || [], license: raw.license ?? null, stars: raw.stars ?? null, cost: raw.cost ?? null,
        relevance: raw.relevance || [], verified: !!raw.verified, asOf: raw.asOf || today, source: raw.source || source,
        ...(raw.extra ? { extra: raw.extra } : {}),
      });
      touched.add(cname);
      log.push(`added ${id} -> ${cname}`);
    }
  }
  for (const c of touched) writeFileSync(join(ROOT, "library", `${c}.json`), JSON.stringify(lib[c], null, 1) + "\n");
  appendFileSync(join(ROOT, "CHANGELOG.md"), `\n## ${today} — ${source}\n` + log.map((l) => `- ${l}`).join("\n") + "\n");
  return log;
}

export function build() {
  return execFileSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { cwd: ROOT, encoding: "utf8" });
}

/** Commit everything under the repo and push. Pulls with rebase first so other devices' updates merge. */
export function sync(message) {
  const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
  git("add", "-A");
  const staged = git("diff", "--cached", "--name-only").trim();
  if (staged) git("commit", "-m", `${message || "library: update"}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`);
  try { git("pull", "--rebase", "--autostash", "origin", "main"); } catch (e) { /* first push / offline */ }
  git("push", "origin", "HEAD:main");
  return staged ? `pushed: ${staged.split("\n").length} files` : "nothing new to commit; pushed";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const file = args[0];
  if (!file || !existsSync(file)) { console.error("usage: node scripts/add.mjs <items.json> [--collection auto] [--source label] [--push] [-m msg]"); process.exit(1); }
  const items = JSON.parse(readFileSync(file, "utf8"));
  const log = addItems(Array.isArray(items) ? items : [items], { collection: opt("--collection", "auto"), source: opt("--source", "manual") });
  console.log(log.join("\n"));
  console.log(build());
  if (args.includes("--push")) console.log(sync(opt("-m", `library: ${log.length} items from ${opt("--source", "manual")}`)));
}

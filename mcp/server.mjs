#!/usr/bin/env node
/**
 * Public AI Library — MCP server over stdio (Node 18+, zero dependencies).
 *
 * Data source, in order:
 *   1. Running inside a git checkout of the repo -> ../dist/library.json, after a quick
 *      `git pull --ff-only` so every session starts on the latest library.
 *   2. Otherwise (copied the single file somewhere / another device) -> GitHub raw URL,
 *      cached in the OS temp dir for offline use.
 *
 * Extra tools in a git checkout: add_items + sync_library (write, rebuild, push to GitHub).
 * Extra tool when private/private-brain.json exists (owner's laptop only): private_search.
 *
 * Register:  claude mcp add -s user public-ai-library -- node "<path>/mcp/server.mjs"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { indexBundle, handleRpc, RAW_URL } from "./core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const LOCAL = join(ROOT, "dist", "library.json");
const CACHE = join(tmpdir(), "public-ai-library.json");
const PRIVATE = process.env.PAL_PRIVATE_PATH || join(ROOT, "private", "private-brain.json");
const IS_CHECKOUT = existsSync(join(ROOT, ".git")) && existsSync(join(ROOT, "scripts", "build.mjs"));
const log = (...a) => console.error("[public-ai-library]", ...a);

let ix = null, loadedAt = 0, source = "";
const TTL = 10 * 60 * 1000;

function gitPull() {
  return new Promise((res) => execFile("git", ["pull", "--ff-only", "--quiet", "origin", "main"], { cwd: ROOT, timeout: 15000 },
    (e) => { if (e) log("git pull skipped:", e.message.split("\n")[0]); res(); }));
}

async function load(force = false) {
  if (ix && !force && Date.now() - loadedAt < TTL) return ix;
  if (IS_CHECKOUT && existsSync(LOCAL) && process.env.PAL_SOURCE !== "remote") {
    ix = indexBundle(JSON.parse(readFileSync(LOCAL, "utf8"))); source = LOCAL;
  } else {
    try {
      const r = await fetch(RAW_URL, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      ix = indexBundle(JSON.parse(text)); source = RAW_URL;
      try { writeFileSync(CACHE, text); } catch {}
    } catch (e) {
      if (!existsSync(CACHE)) throw new Error(`Cannot reach ${RAW_URL} (${e.message}) and no offline cache yet.`);
      ix = indexBundle(JSON.parse(readFileSync(CACHE, "utf8"))); source = `${CACHE} (offline cache)`;
    }
  }
  loadedAt = Date.now();
  return ix;
}

// ---------- local-only tools ----------
const extraTools = [];
const handlers = {};

if (IS_CHECKOUT) {
  const add = await import(pathToFileURL(join(ROOT, "scripts", "add.mjs")).href);
  extraTools.push({
    name: "add_items",
    description: "Add or update items in the Public AI Library, rebuild the Index/Mindmap/bundle and push to GitHub (scnunna/Public-AI-Library). Dedupes by id, name, or URL+name. Always include a verdict (adopt|have|trial|assess|reference|skip) and a one-line `why`.",
    inputSchema: { type: "object", required: ["items"], properties: {
      items: { type: "array", items: { type: "object", required: ["name", "kind", "category"], properties: {
        name: { type: "string" }, kind: { type: "string", description: "api|mcp|skill|plugin|repo|framework|model|tool|node-pack|registry|list|web-tool" },
        category: { type: "string", description: "short-kebab, reuse existing categories (see `categories`)" }, url: { type: "string" },
        description: { type: "string" }, verdict: { type: "string" }, why: { type: "string" }, tags: { type: "array", items: { type: "string" } },
        license: { type: "string" }, stars: { type: "integer" }, cost: { type: "string" }, relevance: { type: "array", items: { type: "string" } },
        verified: { type: "boolean" } } } },
      collection: { type: "string", description: "Target collection, or 'auto' (default) to route by kind" },
      source: { type: "string", description: "Short label for the changelog, e.g. 'research 2026-10-20: TTS models'" },
      push: { type: "boolean", description: "Commit + push to GitHub (default true)" },
    } },
  });
  handlers.add_items = async (a) => {
    await gitPull();
    const changes = add.addItems(a.items || [], { collection: a.collection || "auto", source: a.source || "claude session" });
    const built = add.build().trim();
    const pushed = a.push === false ? "not pushed (push=false)" : add.sync(`library: ${changes.length} change(s) — ${a.source || "claude session"}`);
    await load(true);
    return { changes, built, pushed };
  };
  extraTools.push({ name: "sync_library", description: "Pull the latest library from GitHub, rebuild, and push any local edits to library/*.json.", inputSchema: { type: "object", properties: {} } });
  handlers.sync_library = async () => { await gitPull(); const built = add.build().trim(); const pushed = add.sync("library: sync"); await load(true); return { built, pushed }; };
}

if (existsSync(PRIVATE)) {
  extraTools.push({ name: "private_search", description: "LOCAL ONLY: search the owner's private research sections (company plans, money ideas, decisions, backlog, infrastructure). Never published.", inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" }, section: { type: "string" } } } });
  handlers.private_search = async ({ query, section }) => {
    const D = JSON.parse(readFileSync(PRIVATE, "utf8")).data, q = String(query).toLowerCase(), hits = [];
    for (const [k, v] of Object.entries(D)) {
      if (section && k !== section) continue;
      const rows = Array.isArray(v) ? v : [v];
      rows.forEach((r, i) => { if (JSON.stringify(r).toLowerCase().includes(q)) hits.push({ section: k, index: i, item: r }); });
    }
    return { sections: Object.keys(D), total: hits.length, results: hits.slice(0, 20) };
  };
}

// ---------- stdio loop ----------
if (IS_CHECKOUT) gitPull().then(() => load(true).catch(() => {}));
const opts = { extraTools, extraCall: (n, a) => handlers[n](a), canWrite: IS_CHECKOUT, info: { get source() { return source; } } };
const send = (o) => process.stdout.write(JSON.stringify(o) + "\n");
createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
  const res = await handleRpc(msg, () => load(), { ...opts, info: { source, mode: IS_CHECKOUT ? "local checkout (read/write)" : "remote bundle (read-only)" } });
  if (res) send(res);
});

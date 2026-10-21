#!/usr/bin/env node
/**
 * Weekly maintenance (run by .github/workflows/maintain.yml, or locally):
 *   - refresh GitHub stars / archived status / license for every curated item that links to a GitHub repo
 *   - flag archived repos in tags and demote their verdict note
 * Then build.mjs regenerates the Index/Mindmap. Uses GITHUB_TOKEN when present (5,000 req/h).
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = loadLibrary(ROOT);
const headers = { "user-agent": "public-ai-library-maintainer", accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
const today = new Date().toISOString().slice(0, 10);

let checked = 0, changed = 0, failed = 0;
for (const c of Object.values(lib)) {
  if (c.collection === "apis") continue;
  let dirty = false;
  for (const it of c.items) {
    const m = String(it.url || "").match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/);
    if (!m) continue;
    checked++;
    try {
      const r = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers });
      if (r.status === 404) { if (!it.tags.includes("repo-missing")) { it.tags.push("repo-missing"); dirty = true; } continue; }
      if (!r.ok) { failed++; if (r.status === 403) break; continue; }
      const g = await r.json();
      const before = JSON.stringify([it.stars, it.license, it.tags]);
      it.stars = g.stargazers_count;
      if (!it.license && g.license?.spdx_id && g.license.spdx_id !== "NOASSERTION") it.license = g.license.spdx_id;
      it.tags = it.tags.filter((t) => t !== "archived" && t !== "repo-missing");
      if (g.archived) it.tags.push("archived");
      it.extra = { ...(it.extra || {}), pushedAt: g.pushed_at?.slice(0, 10), checkedAt: today };
      if (JSON.stringify([it.stars, it.license, it.tags]) !== before) { changed++; }
      dirty = true;
    } catch { failed++; }
  }
  if (dirty) writeFileSync(join(ROOT, "library", `${c.collection}.json`), JSON.stringify(c, null, 1) + "\n");
}
console.log(`maintain: checked ${checked} GitHub repos, ${changed} changed, ${failed} failed`);

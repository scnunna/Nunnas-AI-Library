#!/usr/bin/env node
/**
 * Refresh docs/data/trending.json — Top 20 trending GitHub repos for the website's Weekly / Monthly / All-time tabs.
 *
 *   node scripts/trending.mjs
 *
 * weekly / monthly = github.com/trending?since=… (all languages + python/typescript/jupyter pages, merged,
 * ranked by stars gained in the period). all-time = GitHub search API, most-starred AI repos
 * (unauthenticated, 4 calls). Each repo is cross-linked to a library item when the URL matches.
 * No token, no account — safe to run locally; keep it to ~once a day.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "data", "trending.json");
const UA = { "User-Agent": "Mozilla/5.0 (Public-AI-Library trending refresh)", Accept: "text/html,application/json" };
const N = 20;

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
const num = (s) => Number(String(s || "0").replace(/[^0-9]/g, "")) || 0;

function parseTrending(html) {
  const rows = html.split('<article class="Box-row').slice(1);
  return rows.map((r) => {
    const full = (r.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"/) || [])[1];
    if (!full) return null;
    const desc = (r.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/) || [])[1];
    const lang = (r.match(/itemprop="programmingLanguage">([^<]+)</) || [])[1];
    const stars = (r.match(new RegExp(`href="/${full}/stargazers"[^>]*>[\\s\\S]*?</svg>\\s*([\\d,]+)`)) || [])[1];
    const forks = (r.match(new RegExp(`href="/${full}/forks"[^>]*>[\\s\\S]*?</svg>\\s*([\\d,]+)`)) || [])[1];
    const gained = (r.match(/([\d,]+) stars? (today|this week|this month)/) || [])[1];
    return {
      repo: full, url: `https://github.com/${full}`, description: desc ? decode(desc.replace(/<[^>]+>/g, "").trim()) : "",
      language: lang ? lang.trim() : null, stars: num(stars), forks: num(forks), gained: num(gained),
    };
  }).filter(Boolean);
}

async function trending(since) {
  const pages = ["", "python", "typescript", "jupyter-notebook", "rust"];
  const seen = new Map();
  for (const lang of pages) {
    const url = `https://github.com/trending${lang ? "/" + lang : ""}?since=${since}`;
    try {
      const html = await (await fetch(url, { headers: UA })).text();
      for (const r of parseTrending(html)) if (!seen.has(r.repo) || seen.get(r.repo).gained < r.gained) seen.set(r.repo, r);
    } catch (e) { console.warn(`  ${url}: ${e.message}`); }
  }
  return [...seen.values()].sort((a, b) => b.gained - a.gained).slice(0, N);
}

async function allTime() {
  const topics = ["llm", "ai-agents", "generative-ai", "machine-learning"];
  const seen = new Map();
  for (const t of topics) {
    const url = `https://api.github.com/search/repositories?q=topic:${t}&sort=stars&order=desc&per_page=30`;
    try {
      const j = await (await fetch(url, { headers: { ...UA, Accept: "application/vnd.github+json" } })).json();
      for (const r of j.items || []) seen.set(r.full_name, {
        repo: r.full_name, url: r.html_url, description: r.description || "", language: r.language,
        stars: r.stargazers_count, forks: r.forks_count, gained: null, topics: (r.topics || []).slice(0, 6),
        createdAt: r.created_at?.slice(0, 10),
      });
    } catch (e) { console.warn(`  ${url}: ${e.message}`); }
  }
  return [...seen.values()].sort((a, b) => b.stars - a.stars).slice(0, N);
}

const normUrl = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").replace(/\.git$/, "");
const NOTES_FILE = join(ROOT, "site", "trending-notes.json");
const notes = existsSync(NOTES_FILE) ? JSON.parse(readFileSync(NOTES_FILE, "utf8")) : {};
function crossLink(list, libIndex) {
  return list.map((r, i) => ({ rank: i + 1, ...r, libraryId: libIndex.get(normUrl(r.url)) || null,
    useCase: notes[r.repo]?.useCase || null, idea: notes[r.repo]?.idea || null }));
}

const lib = JSON.parse(readFileSync(join(ROOT, "dist", "library.json"), "utf8"));
const libIndex = new Map();
for (const [, c] of Object.entries(lib.collections)) for (const it of c.items) if (it.url) libIndex.set(normUrl(it.url), it.id);

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const [weekly, monthly, alltime] = [await trending("weekly"), await trending("monthly"), await allTime()];
const pick = (fresh, key) => (fresh.length >= 5 ? fresh : prev[key] || fresh); // keep last good data on a bad fetch
const out = {
  updatedAt: new Date().toISOString(),
  source: "github.com/trending (weekly, monthly) + GitHub search API most-starred AI topics (all-time)",
  weekly: crossLink(pick(weekly, "weekly"), libIndex),
  monthly: crossLink(pick(monthly, "monthly"), libIndex),
  alltime: crossLink(pick(alltime, "alltime"), libIndex),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`trending: weekly ${out.weekly.length} · monthly ${out.monthly.length} · all-time ${out.alltime.length} -> ${OUT}`);

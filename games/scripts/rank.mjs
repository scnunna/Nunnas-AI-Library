// Merges research/*.json sightings into one record per game, scores virality, writes top100.json + top100.csv + TOP100.md.
// Usage: node games/scripts/rank.mjs <research-dir>
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
const rows = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));

// Per-metric "ceiling" = what counts as maximum viral reach for that signal.
const CAP = { views: 1e7, likes: 1e5, upvotes: 2e4, points: 2000, comments: 2000, players: 1e6, plays: 1e6, revenue: 1e6, ratings: 1e4 };
const reachOf = (t, v) => (v > 0 && CAP[t] ? Math.min(1, Math.log10(1 + v) / Math.log10(1 + CAP[t])) : 0);
const host = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname.replace(/\/$/, "")).toLowerCase(); } catch { return null; } };
const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|[^a-z0-9]/g, "");

const games = new Map();
for (const r of rows) {
  if (!r?.name) continue;
  const keys = [norm(r.name), host(r.playUrl)].filter(Boolean);
  let g = keys.map((k) => games.get(k)).find(Boolean);
  if (!g) g = { name: r.name, playUrl: null, genre: r.genre, aiTools: new Set(), creator: r.creator, platforms: new Set(), sightings: [], signals: [], date: r.date };
  for (const k of keys) games.set(k, g);
  g.playUrl ||= r.playUrl; g.creator ||= r.creator; g.genre ||= r.genre;
  if (r.date && (!g.date || r.date < g.date)) g.date = r.date;
  (r.aiTools || []).forEach((t) => g.aiTools.add(t));
  g.platforms.add(r.platform);
  g.sightings.push({ platform: r.platform, url: r.evidenceUrl, metric: r.metricType, value: r.metricValue, verified: !!r.verified });
  if (r.otherSignals) g.signals.push(r.otherSignals);
}

const PRESS = /verge|techcrunch|wired|insider|forbes|pc ?gamer|kotaku|polygon|404 ?media|guardian|bbc|cnbc|new york times|nyt|fortune|axios|venturebeat|gamesradar|ign|eurogamer|rock paper|press|article|coverage/i;
const AWARD = /winner|gold|silver|bronze|1st|2nd|3rd|first place|grand prize|finalist|top \d+|award|staff pick|featured|#1/i;
const list = [...new Set(games.values())].map((g) => {
  const sig = g.signals.join(" | ");
  const best = Math.max(0, ...g.sightings.map((s) => reachOf(s.metric, s.value)));
  const second = g.sightings.map((s) => reachOf(s.metric, s.value)).sort((a, b) => b - a)[1] || 0;
  const rankHit = g.sightings.some((s) => s.metric === "rank" && s.value && s.value <= 3);
  const reach = 40 * best + 5 * second;                                        // 45: engagement on the strongest + 2nd signal
  const spread = [0, 6, 12, 16, 20][Math.min(4, g.platforms.size)];          // 20: shows up on several channels
  const cred = Math.min(20, (PRESS.test(sig) || g.platforms.has("press") ? 10 : 0) + (AWARD.test(sig) || rankHit ? 7 : 0) + (/\$|revenue|mrr|arr/i.test(sig) ? 5 : 0)); // 20
  const playable = g.playUrl ? 10 : 0;                                          // 10: free link to play
  const recent = g.date && g.date >= "2025-11" ? 5 : g.date ? 3 : 2;            // 5
  return { ...g, aiTools: [...g.aiTools], platforms: [...g.platforms], signals: [...new Set(g.signals)],
    viralScore: Math.round(reach + spread + cred + playable + recent), breakdown: { reach: Math.round(reach), spread, cred, playable, recent } };
}).sort((a, b) => b.viralScore - a.viralScore);

const top = list.slice(0, 100).map((g, i) => ({ rank: i + 1, ...g }));
writeFileSync(join(OUT, "top100.json"), JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), method: "see METHODOLOGY.md", candidates: list.length, games: top }, null, 2));
const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(join(OUT, "top100.csv"), "rank,name,url,genre,aiTools,creator,platforms,viralScore,evidence\n" +
  top.map((g) => [g.rank, g.name, g.playUrl, g.genre, g.aiTools.join("; "), g.creator, g.platforms.join("; "), g.viralScore, g.sightings[0]?.url].map(q).join(",")).join("\n") + "\n");
const fmt = (s) => s.value ? `${Number(s.value).toLocaleString("en-US")} ${s.metric}` : s.metric || "";
let md = `# Top 100 AI-built free browser games\n\nRanked by Viral Score (0–100). ${list.length} candidates researched, as of ${new Date().toISOString().slice(0, 10)}. How the score works: [METHODOLOGY.md](METHODOLOGY.md).\n\n| # | Game | Genre | Built with | Score | Strongest signal |\n|---|---|---|---|---|---|\n`;
md += top.map((g) => { const s = [...g.sightings].sort((a, b) => reachOf(b.metric, b.value) - reachOf(a.metric, a.value))[0];
  return `| ${g.rank} | ${g.playUrl ? `[${g.name}](${g.playUrl})` : g.name} | ${g.genre} | ${g.aiTools.slice(0, 3).join(", ")} | ${g.viralScore} | ${s?.url ? `[${fmt(s)} on ${s.platform}](${s.url})` : fmt(s)} |`; }).join("\n") + "\n";
writeFileSync(join(OUT, "TOP100.md"), md.replace(/\|(?=[^|\n]*\n)/g, "|"));
console.log(`candidates ${list.length}, ranked ${top.length}`);
const genres = {}; top.forEach((g) => (genres[g.genre] = (genres[g.genre] || 0) + 1)); console.log(genres);

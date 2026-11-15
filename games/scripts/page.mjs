// Builds games/index.html (the browsable library page) from games/top100.json.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(readFileSync(join(OUT, "top100.json"), "utf8"));
const CAP = { views: 1e7, likes: 1e5, upvotes: 2e4, points: 2000, comments: 2000, players: 1e6, plays: 1e6, revenue: 1e6, ratings: 1e4 };
const r = (s) => (s.value > 0 && CAP[s.metric] ? Math.log10(1 + s.value) / Math.log10(1 + CAP[s.metric]) : 0);
const fam = (t) => [/claude|anthropic|opus|fable|sonnet/i.test(t) && "Claude", /cursor/i.test(t) && "Cursor", /gpt|codex|openai|chatgpt/i.test(t) && "OpenAI",
  /gemini|google ai/i.test(t) && "Gemini", /grok/i.test(t) && "Grok", /lovable|bolt|replit|rosebud|websim|v0|verse8/i.test(t) && "App builders"].filter(Boolean);
const games = d.games.map((g) => { const s = [...g.sightings].sort((a, b) => r(b) - r(a))[0] || {};
  return { n: g.rank, name: g.name, url: g.playUrl, genre: g.genre, tools: g.aiTools.filter((t) => !/three\.js|colyseus|figma|suno|elevenlabs|tripo/i.test(t)).slice(0, 3).map((t) => t.replace(/\s*\(.*$/, "").slice(0, 26)),
    fam: [...new Set(g.aiTools.flatMap(fam))], score: g.viralScore, b: g.breakdown, ch: g.platforms,
    sig: s.value ? (s.metric === "revenue" ? `$${Number(s.value).toLocaleString("en-US")} revenue` : `${Number(s.value).toLocaleString("en-US")} ${s.metric}`) : (g.signals[0] || "").slice(0, 70), src: s.url, ver: !!s.verified,
    note: (g.signals[0] || "").slice(0, 160) }; });
const data = JSON.stringify({ asOf: d.asOf, candidates: d.candidates, games }).replace(/</g, "\\u003c");
const tpl = readFileSync(join(OUT, "scripts", "page.template.html"), "utf8");
writeFileSync(join(OUT, "index.html"), tpl.replace("/*DATA*/null", data));
console.log("index.html written", games.length);

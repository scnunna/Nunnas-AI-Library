// Checks every candidate play link responds (follows redirects). Writes games/link-check.json {url: true|false}.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2];
const urls = [...new Set(readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8"))).map((r) => r.playUrl).filter(Boolean))];
const res = {};
await Promise.all(urls.map(async (u) => {
  try { const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": "Mozilla/5.0 (link check)" } });
    res[u] = ![404, 410].includes(r.status); if (r.status >= 400) console.log(r.status, u);   // only 404/410/DNS failure count as dead; 403/429/5xx may be bot-blocking
  } catch (e) { res[u] = false; console.log("ERR", e.cause?.code || e.name, u); }
}));
writeFileSync(join(OUT, "link-check.json"), JSON.stringify(res, null, 1));
console.log(`${Object.values(res).filter(Boolean).length}/${urls.length} live`);

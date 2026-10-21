#!/usr/bin/env node
/**
 * One-off importer: splits the Sept-2026 "Money Swarm" brain dump into
 *   library/*.json            -> public catalog (committed to GitHub)
 *   private/private-brain.json -> owner/company/business-plan sections (gitignored, local only)
 *
 * Usage: node scripts/import-brain.mjs <path-to-brain.json>
 * Kept in the repo for provenance; normal updates go through scripts/add.mjs or editing library/*.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slug, normVerdict } from "./lib.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2];
if (!SRC) { console.error("usage: node scripts/import-brain.mjs <brain.json>"); process.exit(1); }
const BRAIN = JSON.parse(readFileSync(SRC, "utf8"));
const D = BRAIN.data;
const AS_OF = BRAIN.meta?.asOf || "2026-09-17";

const PRIVATE_KEYS = ["owner", "decisions", "jurisdictions", "infrastructure", "companies", "portfolioOverview",
  "moneyIdeas", "openQuestions", "buildBacklog", "curiositySites50", "curiositySiteNotes", "publicDomainArtOpportunity"];

const ghUrl = (s) => {
  if (!s) return null;
  s = String(s).trim();
  if (s.includes("…") || s.includes("(truncated)")) return null;
  if (/^https?:\/\//.test(s)) return s;
  if (/^github\.com\//.test(s)) return "https://" + s;
  return null;
};
const yes = (v) => String(v).replace(/`/g, "") === "Yes";

function item(o) {
  const out = {
    id: o.id, name: o.name, kind: o.kind, category: o.category || "uncategorized",
    url: o.url ?? null, description: o.description || "",
    verdict: o.verdict ?? null, verdictNote: o.verdictNote ?? null, why: o.why ?? null,
    tags: o.tags || [], license: o.license ?? null, stars: o.stars ?? null, cost: o.cost ?? null,
    relevance: o.relevance || [], verified: o.verified ?? false, asOf: o.asOf || AS_OF, source: o.source || "money-swarm-brain-2026-09",
  };
  if (o.extra && Object.keys(o.extra).length) out.extra = o.extra;
  return out;
}
const coll = (name, title, description, items) => ({ collection: name, title, description, items });

const ids = new Set();
const uid = (prefix, name) => {
  let base = `${prefix}-${slug(name)}`.slice(0, 80), id = base, i = 2;
  while (ids.has(id)) id = `${base}-${i++}`;
  ids.add(id); return id;
};

// ---- APIs ----
const apis = D.apiCatalog.map((a) => item({
  id: uid("api", a.n), name: a.n, kind: "api", category: a.c === "Recommended additions" ? "Recommended" : a.c,
  url: a.u, description: a.d,
  tags: [a.a === "No" ? "no-key" : `auth:${a.a}`, yes(a.h) ? "https" : "http-only", a.o === "Yes" ? "cors" : a.o === "No" ? "no-cors" : "cors-unknown"],
  cost: "free", verified: false,
  source: a.c === "Recommended additions" ? "money-swarm-brain-2026-09" : "public-apis/public-apis",
  extra: { auth: a.a, https: yes(a.h), cors: a.o },
}));
// attach test endpoints to their API where we can match by name
for (const t of D.testEndpoints) {
  const hit = apis.find((a) => a.name.toLowerCase() === String(t.api).toLowerCase());
  if (hit) { hit.extra.testUrl = t.url; hit.verified = true; }
}
const testEndpoints = D.testEndpoints.map((t) => item({
  id: uid("test", t.id), name: t.api, kind: "api-test", category: "smoke-test", url: t.url,
  description: `Known-good no-secret request for ${t.api}`, verified: true, extra: { testId: t.id, needsSecret: !!t.secret },
}));

const combos = D.apiCombos.map((c) => item({
  id: uid("combo", c.id), name: c.title, kind: "recipe", category: c.tag, description: c.what,
  tags: c.apis, cost: c.cost, extra: { apis: c.apis, monetization: c.money, speed: c.speed },
}));

// ---- MCP servers ----
const mcp = D.mcpStack.map((m) => item({
  id: uid("mcp", m.n), name: m.n, kind: "mcp", category: m.job, url: ghUrl(m.src) || (m.src?.startsWith("http") ? m.src : null),
  description: m.job, why: m.why, cost: m.cost, verdict: "adopt", verdictNote: "in recommended MCP stack", extra: { src: m.src },
}));

// ---- Skills ----
const skills = D.agentSkills.map((s) => item({
  id: uid("skill", s.name), name: s.name, kind: "skill", category: s.category, url: ghUrl(s.repo),
  description: s.claim, verdict: normVerdict(s.verdict), verdictNote: s.verdict, stars: s.stars, verified: !!s.verified,
  extra: { overlaps: s.overlaps, repo: s.repo },
}));
const skillCaps = D.agentSkillCapabilities.map((c) => item({
  id: uid("cap", c.capability), name: c.capability, kind: "capability", category: "skill-capability",
  description: `${c.capability} (from ${c.source}); removes: ${c.removes}`, tags: [c.source], extra: c,
}));

// ---- Agent toolkit + frameworks ----
const agentTools = [
  ...D.agentToolkit40.map((t) => item({ id: uid("tool", t.name), name: t.name, kind: "repo", category: t.group,
    description: t.ourStatus, verdict: normVerdict(t.verdict), verdictNote: t.verdict, extra: { list: "agentToolkit40", n: t.n } })),
  ...D.agentFrameworks20.map((t) => item({ id: uid("fw", t.name), name: t.name, kind: "framework", category: t.group,
    description: t.ourStatus, verdict: normVerdict(t.verdict), verdictNote: t.verdict, extra: { list: "agentFrameworks20", n: t.n } })),
];

// ---- Media / content tooling ----
const content = D.mediaTooling.map((m) => item({
  id: uid("content", m.name), name: m.name, kind: "repo", category: "media", url: /^https?:/.test(m.repo) ? m.repo : null, description: m.what,
  license: m.license, stars: m.stars, verified: !!m.verified, verdict: normVerdict(m.verdict), verdictNote: m.verdict,
  why: m.caveats ? [].concat(m.caveats).join(" ") : null, relevance: ["content-studio"], extra: { replaces: m.replaces, usedBy: m.usedBy },
}));

// ---- Web tools ----
const webTools = [
  ...D.webTools.map((w) => item({ id: uid("web", w.n), name: w.n, kind: "web-tool", category: w.v,
    url: /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(w.n) ? "https://" + w.n : null, description: w.note,
    verdict: normVerdict(w.v), verdictNote: w.v, why: w.how, extra: { alternative: w.alt, src: w.src } })),
  ...D.webToolExtras.map((w) => item({ id: uid("web", w.n), name: w.n, kind: "web-tool", category: w.t, description: w.d, verdict: "adopt" })),
];

const design = D.designResources.map((d) => item({
  id: uid("design", d.name), name: d.name, kind: "design-resource", category: d.platform, url: d.url, description: d.why,
  cost: d.cost, verdict: normVerdict(d.verdict), verdictNote: d.verdict, why: d.why, extra: { blockers: d.blockers, useFor: d.useFor },
}));

const s1 = D.systemOneLayer;
const assessments = [
  ...D.batch3Assessments.map((b) => item({ id: uid("assess", b.name), name: b.name, kind: "repo", category: "deep-assessment",
    url: b.repo, description: b.what, stars: b.stars, verified: !!b.verified, verdict: normVerdict(b.verdict), verdictNote: b.verdict,
    why: b.take, extra: { warnings: b.warnings, unblockedAlternative: b.unblockedAlternative } })),
  ...D.hardwareResources.map((h) => item({ id: uid("assess", h.name), name: h.name, kind: "repo", category: "hardware",
    url: h.repo, description: h.what, stars: h.stars, license: h.license, verified: !!h.verified, verdict: "reference", verdictNote: h.verdict,
    why: h.whyNotBuild, extra: { legalBlockers: h.legalBlockers, patternsToSteal: h.patternsToSteal, shippableAlternative: h.shippableAlternative } })),
  item({ id: uid("assess", "jev-system-one"), name: s1.model, kind: "model", category: "decision-model", url: "https://api.typesafe.ai",
    description: s1.category, verdict: "assess", why: [].concat(s1.caveats).join(" "), extra: s1 }),
];

const compliance = D.compliance.map((c) => item({
  id: uid("rule", `${c.area}-${c.rule}`), name: c.rule, kind: "rule", category: c.area, description: c.rule, why: c.guardrail,
}));

const notes = [];
for (const [k, v] of Object.entries(D)) {
  if (k.endsWith("Notes") && !PRIVATE_KEYS.includes(k)) v.forEach((t, i) => notes.push(item({
    id: uid("note", `${k}-${i + 1}`), name: `${k.replace(/Notes$/, "")} note ${i + 1}`, kind: "note", category: k.replace(/Notes$/, ""), description: t })));
}

const out = {
  "apis": coll("apis", "Public APIs", "Free/public REST APIs (public-apis/public-apis + curated additions). Tags: no-key, https, cors.", apis),
  "api-test-endpoints": coll("api-test-endpoints", "API smoke-test endpoints", "Known-good, no-secret requests for quickly checking an API is alive.", testEndpoints),
  "api-recipes": coll("api-recipes", "API recipes", "Combinations of public APIs that make a content product.", combos),
  "mcp-servers": coll("mcp-servers", "MCP servers", "Model Context Protocol servers worth connecting to Claude.", mcp),
  "skills": coll("skills", "Agent skills & plugins", "Claude/agent skills, plugins and marketplaces, with verdicts.", skills),
  "skill-capabilities": coll("skill-capabilities", "Skill capabilities", "What specific skills unlock and what manual work they remove.", skillCaps),
  "agent-tools": coll("agent-tools", "Agent tools & frameworks", "Agent frameworks, coding-agent tooling, memory layers, observability, local LLM runners.", agentTools),
  "content-tools": coll("content-tools", "AI content-creation tools", "Video/image/voice/music/caption/publishing tools for Content Studio AI.", content),
  "web-tools": coll("web-tools", "Web research tools", "Research/scrape/archive tools with keep/avoid verdicts.", webTools),
  "design-resources": coll("design-resources", "Design resources", "Template libraries, UI kits and design references.", design),
  "assessments": coll("assessments", "Deep assessments", "Repos and models evaluated in depth, with warnings and what to steal.", assessments),
  "compliance": coll("compliance", "Compliance rules", "Platform/legal rules that constrain content and monetization.", compliance),
  "notes": coll("notes", "Research notes", "Free-text findings from past research batches.", notes),
};
mkdirSync(join(ROOT, "library"), { recursive: true });
for (const [k, v] of Object.entries(out)) writeFileSync(join(ROOT, "library", `${k}.json`), JSON.stringify(v, null, 1) + "\n");

const priv = { meta: { ...BRAIN.meta, note: "PRIVATE sections of the Money Swarm brain. Never commit." }, data: {} };
for (const k of PRIVATE_KEYS) if (k in D) priv.data[k] = D[k];
mkdirSync(join(ROOT, "private"), { recursive: true });
writeFileSync(join(ROOT, "private", "private-brain.json"), JSON.stringify(priv, null, 1));
console.log(Object.entries(out).map(([k, v]) => `${k}: ${v.items.length}`).join("\n"));
console.log("private sections:", Object.keys(priv.data).join(", "));

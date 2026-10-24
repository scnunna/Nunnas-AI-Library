/**
 * Nunna's AI Library — query engine shared by the stdio server (Node) and the remote
 * HTTP server (Supabase Edge / Deno). Pure functions over the built bundle
 * (dist/library.json). Zero dependencies.
 */

export const REPO = "scnunna/Nunnas-AI-Library";
export const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/dist/library.json`;
export const LINKS = {
  repo: `https://github.com/${REPO}`,
  index: `https://github.com/${REPO}/blob/main/INDEX.md`,
  mindmap: `https://github.com/${REPO}/blob/main/MINDMAP.md`,
  schema: `https://github.com/${REPO}/blob/main/schema.graphql`,
  mindmapGraphql: `https://github.com/${REPO}/blob/main/MINDMAP.graphql`,
  llms: `https://raw.githubusercontent.com/${REPO}/main/llms.txt`,
  connect: `https://github.com/${REPO}/blob/main/CONNECT.md`,
  browse: `https://scnunna.github.io/Nunnas-AI-Library/`,
};

const low = (s) => String(s ?? "").toLowerCase();
const short = (s, n = 180) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

/** Index a bundle once: flat item list with collection + lowercase search blobs. */
export function indexBundle(bundle) {
  const items = [];
  for (const [cname, c] of Object.entries(bundle.collections)) {
    for (const it of c.items) {
      const tags = (it.tags || []).map(low);
      items.push({
        ...it, collection: cname,
        _name: low(it.name), _tags: tags, _cat: low(it.category),
        _blob: low([it.name, it.category, it.description, it.why, it.verdictNote, it.url, tags.join(" "),
          (it.relevance || []).join(" "), it.extra ? JSON.stringify(it.extra) : ""].join(" ")),
      });
    }
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  return { bundle, items, byId };
}

export const row = (i) => ({
  id: i.id, name: i.name, collection: i.collection, kind: i.kind, category: i.category,
  verdict: i.verdict, url: i.url, stars: i.stars ?? undefined, description: short(i.description),
});
export const full = (i) => Object.fromEntries(Object.entries(i).filter(([k]) => !k.startsWith("_")));

function matchFilters(i, f) {
  if (f.collection && i.collection !== f.collection) return false;
  if (f.kind && low(i.kind) !== low(f.kind)) return false;
  if (f.category && !i._cat.includes(low(f.category))) return false;
  if (f.verdict && low(i.verdict) !== low(f.verdict)) return false;
  if (f.tag && !i._tags.includes(low(f.tag))) return false;
  if (f.relevance && !(i.relevance || []).map(low).includes(low(f.relevance))) return false;
  if (f.since && String(i.asOf || "") < f.since) return false;
  return true;
}

/** Ranked AND-search over every token. Empty query = filter-only browse. */
export function search(ix, f = {}) {
  const toks = low(f.query || f.search || "").split(/\s+/).filter(Boolean);
  const out = [];
  for (const i of ix.items) {
    if (!matchFilters(i, f)) continue;
    let score = 0;
    if (toks.length) {
      let ok = true;
      for (const t of toks) {
        if (!i._blob.includes(t)) { ok = false; break; }
        if (i._name === t) score += 100;
        else if (i._name.includes(t)) score += 40;
        if (i._tags.includes(t)) score += 20;
        if (i._cat.includes(t)) score += 15;
        score += 5;
      }
      if (!ok) continue;
      if (i._name === toks.join(" ")) score += 200;
    }
    // light priors: curated beats bulk, adopt/have beats skip, stars break ties
    if (i.collection !== "apis") score += 3;
    if (i.verdict === "adopt" || i.verdict === "have") score += 2;
    score += Math.min(3, Math.log10((i.stars || 0) + 1) / 2);
    out.push([score, i]);
  }
  out.sort((a, b) => b[0] - a[0]);
  const offset = f.offset || 0, limit = Math.min(f.limit || 20, 200);
  return { total: out.length, results: out.slice(offset, offset + limit).map(([, i]) => i) };
}

export function categories(ix, collection) {
  const m = new Map();
  for (const i of ix.items) if (!collection || i.collection === collection) m.set(i.category, (m.get(i.category) || 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function stats(ix) {
  const byVerdict = {}, byKind = {};
  for (const i of ix.items) { byVerdict[i.verdict ?? "none"] = (byVerdict[i.verdict ?? "none"] || 0) + 1; byKind[i.kind] = (byKind[i.kind] || 0) + 1; }
  return { total: ix.items.length, version: ix.bundle.meta?.version, builtAt: ix.bundle.meta?.builtAt, byVerdict, byKind };
}

export function collections(ix) {
  return Object.entries(ix.bundle.collections).map(([name, c]) => ({ name, title: c.title, description: c.description, count: c.items.length }));
}

/** "Did we already evaluate X?" — curated verdicts only, fuzzy on name. */
export function why(ix, topic) {
  const q = low(topic).trim();
  const hits = ix.items.filter((i) => i.verdict && (i._name.includes(q) || (q.includes(i._name) && i._name.length > 3)));
  return hits.slice(0, 15).map((i) => ({ id: i.id, name: i.name, collection: i.collection, verdict: i.verdict,
    verdictNote: i.verdictNote, why: i.why, description: i.description, url: i.url, asOf: i.asOf, extra: i.extra }));
}

export function searchApis(ix, f = {}) {
  const r = search(ix, { ...f, collection: "apis", limit: 500 });
  let res = r.results;
  if (f.noKey) res = res.filter((i) => i._tags.includes("no-key"));
  if (f.https) res = res.filter((i) => i._tags.includes("https"));
  if (f.cors) res = res.filter((i) => i._tags.includes("cors"));
  return { total: res.length, results: res.slice(0, Math.min(f.limit || 25, 200)) };
}

// ---------------------------------------------------------------------------
// Minimal GraphQL executor (subset): root fields with literal args and a flat
// or nested selection set. Enough for quick, typed lookups; see schema.graphql.
// ---------------------------------------------------------------------------
function lex(src) {
  const re = /\s*(?:(#[^\n]*)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?)|([A-Za-z_][\w]*)|([{}():,!=$\[\]]|\.\.\.))/y;
  const toks = []; let m; re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const at = re.lastIndex; m = re.exec(src);
    if (!m) { if (/^\s*$/.test(src.slice(at))) break; throw new Error(`GraphQL syntax error near: ${src.slice(at, at + 20)}`); }
    if (m[1]) continue;
    if (m[2]) toks.push({ t: "str", v: JSON.parse(m[2]) });
    else if (m[3]) toks.push({ t: "num", v: Number(m[3]) });
    else if (m[4]) toks.push({ t: "name", v: m[4] });
    else toks.push({ t: "p", v: m[5] });
  }
  return toks;
}
function parse(src) {
  const T = lex(src); let p = 0;
  const peek = () => T[p], eat = (v) => { const t = T[p++]; if (v && (!t || t.v !== v)) throw new Error(`GraphQL: expected '${v}'`); return t; };
  const value = () => {
    const t = eat();
    if (t.t === "str" || t.t === "num") return t.v;
    if (t.t === "name") return t.v === "true" ? true : t.v === "false" ? false : t.v === "null" ? null : t.v;
    if (t.v === "[") { const a = []; while (peek() && peek().v !== "]") { a.push(value()); if (peek()?.v === ",") eat(); } eat("]"); return a; }
    throw new Error("GraphQL: bad value");
  };
  const selection = () => {
    eat("{"); const fields = [];
    while (peek() && peek().v !== "}") {
      let name = eat().v, alias = name;
      if (peek()?.v === ":") { eat(":"); name = eat().v; }
      const args = {};
      if (peek()?.v === "(") { eat("("); while (peek().v !== ")") { const k = eat().v; eat(":"); args[k] = value(); if (peek()?.v === ",") eat(); } eat(")"); }
      const sel = peek()?.v === "{" ? selection() : null;
      fields.push({ alias, name, args, sel });
      if (peek()?.v === ",") eat();
    }
    eat("}"); return fields;
  };
  if (peek()?.t === "name" && peek().v === "query") { eat(); if (peek()?.t === "name") eat(); }
  return selection();
}
function project(v, sel) {
  if (!sel || v == null) return v;
  if (Array.isArray(v)) return v.map((x) => project(x, sel));
  const o = {};
  for (const f of sel) o[f.alias] = project(f.name === "collection" || f.name in v ? v[f.name] : null, f.sel);
  return o;
}
export function graphql(ix, query) {
  const roots = parse(query), data = {};
  for (const f of roots) {
    const a = f.args; let v;
    switch (f.name) {
      case "collections": v = collections(ix); break;
      case "stats": v = stats(ix); break;
      case "categories": v = categories(ix, a.collection); break;
      case "item": v = ix.byId.has(a.id) ? full(ix.byId.get(a.id)) : null; break;
      case "items": v = search(ix, { ...a, query: a.search }).results.map(full); break;
      case "apis": v = searchApis(ix, { query: a.search, category: a.category, noKey: a.noKey, https: a.https, cors: a.cors, limit: a.limit }).results.map(full); break;
      case "why": v = why(ix, a.name || ""); break;
      case "__schema": case "__type": throw new Error("Introspection not supported; read schema.graphql via library_info.links.schema");
      default: throw new Error(`Unknown root field '${f.name}'. Roots: collections, stats, categories, item, items, apis, why`);
    }
    data[f.alias] = project(v, f.sel);
  }
  return { data };
}

// ---------------------------------------------------------------------------
// MCP tool definitions + dispatcher (transport-agnostic)
// ---------------------------------------------------------------------------
const S = (props, required = []) => ({ type: "object", properties: props, required });
const str = (d) => ({ type: "string", description: d });
const int = (d) => ({ type: "integer", description: d });
const bool = (d) => ({ type: "boolean", description: d });
const FILTERS = {
  collection: str("Restrict to one collection (see library_info), e.g. skills, mcp-servers, content-tools, agent-tools, apis"),
  kind: str("api | mcp | skill | plugin | repo | framework | model | tool | web-tool | ..."),
  category: str("Substring match on category, e.g. video-gen, mcp-browser, Finance"),
  verdict: str("adopt | have | trial | assess | reference | skip"),
  tag: str("Exact tag, e.g. no-key, self-host, claude-code"),
  relevance: str("content-studio | finance-content | games | general"),
};

export const TOOLS = [
  { name: "library_info", description: "Start here. What the Nunna's AI Library holds (collections, counts, version, build date), links to the Index/Mindmap/GraphQL schema, and how to add items.", inputSchema: S({}) },
  { name: "search", description: "Ranked full-text search across every collection (APIs, MCP servers, skills, agent tools, AI content tools, web tools, design resources, notes). All words must match. Combine with filters.", inputSchema: S({ query: str("Words to search"), ...FILTERS, limit: int("Max results (default 20)"), offset: int("Paging offset") }) },
  { name: "browse", description: "List a collection (optionally filtered) without a search query — e.g. all 'adopt' MCP servers or all video-gen tools.", inputSchema: S({ ...FILTERS, limit: int("default 50"), offset: int("paging offset") }, ["collection"]) },
  { name: "get_item", description: "Full record for one item by id (includes verdict reasoning and extra fields).", inputSchema: S({ id: str("Item id from search/browse") }, ["id"]) },
  { name: "why", description: "Did we already evaluate this tool/repo/service, and what was decided? Returns verdict + reasoning. Use before researching anything new.", inputSchema: S({ name: str("Tool/repo/service name") }, ["name"]) },
  { name: "categories", description: "Category counts for a collection (or all) — the quick map of what exists.", inputSchema: S({ collection: str("Collection name; omit for all") }) },
  { name: "search_apis", description: "Search the 1,800+ public API catalog with API-specific filters.", inputSchema: S({ query: str("Keyword"), category: str("e.g. Finance, Video, Weather"), noKey: bool("Only APIs needing no key"), https: bool("Only HTTPS"), cors: bool("Only CORS-enabled"), limit: int("default 25") }) },
  { name: "recent", description: "Items added or re-verified on/after a date — what's new in the library.", inputSchema: S({ since: str("YYYY-MM-DD (default: 30 days ago)"), collection: str("optional"), limit: int("default 50") }) },
  { name: "graphql", description: "Run a GraphQL query against the library. Roots: collections, stats, categories(collection), item(id), items(collection,kind,category,verdict,tag,relevance,search,limit,offset,since), apis(search,category,noKey,https,cors,limit), why(name). Example: { items(collection:\"mcp-servers\", verdict:\"adopt\", limit:5) { name url why } }", inputSchema: S({ query: str("GraphQL query") }, ["query"]) },
];

export function callTool(ix, name, a = {}, extras = {}) {
  switch (name) {
    case "library_info": return {
      name: "Nunna's AI Library", ...stats(ix), collections: collections(ix), links: LINKS,
      howToAdd: extras.canWrite
        ? "Use add_items (writes library/*.json, rebuilds the index and pushes to GitHub)."
        : "This remote endpoint is read-only. To add items, use the local stdio server's add_items tool on a machine with the repo cloned, or edit library/<collection>.json, run `node scripts/build.mjs`, commit and push.",
      tips: ["Use `why` before researching a tool — it may already have a verdict.", "verdict enum: adopt > have > trial > assess > reference > skip"],
      ...(extras.info || {}),
    };
    case "search": { const r = search(ix, a); return { total: r.total, results: r.results.map(row) }; }
    case "browse": { const r = search(ix, { ...a, query: "", limit: a.limit || 50 }); return { total: r.total, results: r.results.map(row) }; }
    case "get_item": { const i = ix.byId.get(a.id); if (!i) throw new Error(`No item with id '${a.id}'. Use search to find ids.`); return full(i); }
    case "why": { const r = why(ix, a.name || ""); return r.length ? r : { found: false, note: `No recorded verdict for '${a.name}'. Try search, or research it and add it with a verdict.` }; }
    case "categories": return categories(ix, a.collection);
    case "search_apis": { const r = searchApis(ix, a); return { total: r.total, results: r.results.map((i) => ({ ...row(i), auth: i.extra?.auth, https: i.extra?.https, cors: i.extra?.cors, testUrl: i.extra?.testUrl })) }; }
    case "recent": {
      const since = a.since || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const r = search(ix, { since, collection: a.collection, limit: a.limit || 50 });
      return { since, total: r.total, results: r.results.sort((x, y) => String(y.asOf).localeCompare(String(x.asOf))).map((i) => ({ ...row(i), asOf: i.asOf })) };
    }
    case "graphql": return graphql(ix, a.query || "");
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

/** JSON-RPC handler shared by both transports. Returns a response object or null for notifications. */
export async function handleRpc(msg, getIx, { extraTools = [], extraCall, serverName = "public-ai-library", version = "1.0.0", canWrite = false, info } = {}) {
  const { id, method, params } = msg || {};
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (id === undefined || id === null) return null; // notification
  try {
    switch (method) {
      case "initialize":
        return ok({ protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} },
          serverInfo: { name: serverName, version },
          instructions: "Nunna's AI Library: curated, regularly maintained catalog of public APIs, MCP servers, Claude skills/plugins, agent frameworks and AI content tools, each with a verdict. Call library_info first; use `why` before researching any tool." });
      case "ping": return ok({});
      case "tools/list": return ok({ tools: [...TOOLS, ...extraTools] });
      case "tools/call": {
        const name = params?.name, args = params?.arguments || {};
        let result;
        if (extraTools.some((t) => t.name === name)) result = await extraCall(name, args);
        else result = callTool(await getIx(), name, args, { canWrite, info });
        return ok({ content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 1) }] });
      }
      case "resources/list": return ok({ resources: [] });
      case "prompts/list": return ok({ prompts: [] });
      default: return err(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (method === "tools/call") return ok({ isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] });
    return err(-32603, e.message);
  }
}

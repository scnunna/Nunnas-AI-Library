// Public AI Library — remote MCP endpoint (Streamable HTTP, JSON responses), read-only.
// Runs as a Supabase Edge Function; reads the latest bundle from GitHub raw (cached 5 min),
// so pushing to the repo updates every device without redeploying.
// Deploy: upload this file as index.ts plus ../core.mjs as core.mjs, verify_jwt=false.
import { indexBundle, handleRpc, RAW_URL } from "./core.mjs";

let ix: any = null, at = 0;
async function getIx() {
  if (ix && Date.now() - at < 5 * 60 * 1000) return ix;
  try {
    const r = await fetch(RAW_URL, { headers: { "cache-control": "no-cache" } });
    if (!r.ok) throw new Error(`GitHub raw HTTP ${r.status}`);
    ix = indexBundle(await r.json()); at = Date.now();
  } catch (e) {
    if (!ix) throw e; // keep serving the last good copy
  }
  return ix;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS, DELETE",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, accept",
  "access-control-expose-headers": "mcp-session-id",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") {
    // Plain GET (browser / health check): no SSE stream offered, just a status page.
    if ((req.headers.get("accept") || "").includes("text/event-stream")) return new Response(null, { status: 405, headers: CORS });
    const i = await getIx();
    return json({ name: "Public AI Library MCP", transport: "streamable-http (POST JSON-RPC)", items: i.items.length, version: i.bundle.meta?.version, repo: "https://github.com/scnunna/Public-AI-Library" });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const opts = { serverName: "public-ai-library", canWrite: false, info: { mode: "remote (read-only)" } };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, getIx, opts)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handleRpc(body, getIx, opts);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
});

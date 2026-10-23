#!/usr/bin/env node
/**
 * Build the GitHub Pages site into docs/ (Pages source = main /docs).
 *
 *   node scripts/site.mjs            (also run at the end of scripts/build.mjs)
 *
 *   site/index.html          -> docs/index.html        (the app; a body fragment, wrapped here)
 *   site/blog/*.md           -> docs/blog/<slug>.html  (one standalone article page each) + docs/blog/index.html
 *                            -> docs/data/blog.json    (index + rendered HTML for the in-app reader)
 *   dist/library.json        -> docs/data/library.json
 *   docs/data/trending.json  is written by scripts/trending.mjs
 *
 * Blog front matter: title, date, tags, usecases, summary, video (YouTube URL/id or an .mp4 URL; optional),
 * cover (image URL; optional), draft (true hides it).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "site"), DOCS = join(ROOT, "docs");
const BASE = "https://scnunna.github.io/Public-AI-Library/";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- tiny markdown (headings, paragraphs, lists, tables, quotes, code, links, emphasis) ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const ext = /^https?:/.test(u);
      return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    });
}
export function markdown(md) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = Math.min(m[1].length + 1, 5); out.push(`<h${n} id="${slugify(m[2])}">${inline(m[2])}</h${n}>`); i++; continue; }
    if (l.startsWith("```")) { const buf = []; i++; while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    if (/^\s*\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]), body = rows.slice(2).map(cells);
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l); const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    if (l.startsWith(">")) { const buf = []; while (i < lines.length && lines[i].startsWith(">")) buf.push(lines[i++].replace(/^>\s?/, "")); out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`); continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*\||\s*([-*]|\d+\.)\s|>)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}
function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) { const k = line.indexOf(":"); if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim(); }
  return { meta, body: m ? src.slice(m[0].length) : src };
}
const list = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

function videoEmbed(v) {
  if (!v) return "";
  const yt = v.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/) || (/^[\w-]{11}$/.test(v) ? [0, v] : null);
  if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  return `<div class="video"><video src="${esc(v)}" controls playsinline preload="metadata"></video></div>`;
}

// ---------- article page shell ----------
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap">`;
const ARTICLE_CSS = `
:root{--bg:#F4F6FA;--surface:#FFFFFF;--ink:#0F1630;--mute:#58617E;--line:#DCE1ED;--accent:#3348E8;--accent2:#00876F;--display:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif;--body:"Instrument Sans","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#090D1C;--surface:#111731;--ink:#E8ECFA;--mute:#949DC0;--line:#232C50;--accent:#8C9AFF;--accent2:#3FD8BE;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#090D1C;--surface:#111731;--ink:#E8ECFA;--mute:#949DC0;--line:#232C50;--accent:#8C9AFF;--accent2:#3FD8BE;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 var(--body)}
.wrap{max-width:740px;margin:auto;padding-block:32px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
nav{display:flex;gap:16px;flex-wrap:wrap;font:600 14px var(--body);margin-bottom:40px}nav a{color:var(--mute);text-decoration:none}nav a:hover{color:var(--accent)}
.eyebrow{font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent2)}
h1{font:800 clamp(32px,6vw,52px)/1.05 var(--display);letter-spacing:-.02em;margin:10px 0 14px;text-wrap:balance}
.lede{font-size:20px;color:var(--mute);margin:0 0 24px}
h2,h3{font-family:var(--display);line-height:1.2;text-wrap:balance}h2{font-size:28px;margin:44px 0 10px}h3{font-size:21px;margin:30px 0 8px}
a{color:var(--accent)}p,li{max-width:68ch}li{margin:6px 0}
code{font:14px var(--mono);background:var(--surface);border:1px solid var(--line);padding:1px 5px;border-radius:5px}
pre{background:var(--surface);border:1px solid var(--line);padding:14px;border-radius:10px;overflow-x:auto}
blockquote{margin:20px 0;padding:4px 18px;border-left:3px solid var(--accent);color:var(--mute)}
.table{overflow-x:auto;margin:18px 0}table{border-collapse:collapse;width:100%;font-size:15px}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{font:600 12px var(--mono);text-transform:uppercase;letter-spacing:.06em;color:var(--mute)}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 30px}.tags span{font:600 12px var(--mono);border:1px solid var(--line);border-radius:99px;padding:3px 10px;color:var(--mute)}
.video{position:relative;aspect-ratio:16/9;max-width:100%;margin:0 0 30px;border-radius:14px;overflow:hidden;background:#000}.video iframe,.video video{position:absolute;inset:0;width:100%;height:100%;border:0}
.cover{width:100%;border-radius:14px;margin:0 0 28px}
.post-list{display:grid;gap:14px}.post-list a{display:block;padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--surface);text-decoration:none;color:var(--ink)}.post-list a:hover{border-color:var(--accent)}.post-list b{font:700 22px/1.2 var(--display);display:block;margin:6px 0}.post-list p{margin:0;color:var(--mute)}
footer{margin-top:60px;color:var(--mute);font-size:14px}`;
const page = (title, desc, body, extraHead = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article">
${FONTS}${extraHead}<style>${ARTICLE_CSS}</style></head><body><div class="wrap">
<nav><a href="../">← Public AI Library</a><a href="../#explore">Explore</a><a href="../#trending">Trending</a><a href="./">All articles</a></nav>
${body}
<footer>Public AI Library · <a href="https://github.com/scnunna/Public-AI-Library">GitHub</a></footer></div></body></html>`;

// ---------- build ----------
mkdirSync(join(DOCS, "data"), { recursive: true });
copyFileSync(join(ROOT, "dist", "library.json"), join(DOCS, "data", "library.json"));

const posts = [];
const bdir = join(SITE, "blog");
rmSync(join(DOCS, "blog"), { recursive: true, force: true });
mkdirSync(join(DOCS, "blog"), { recursive: true });
if (existsSync(bdir)) for (const f of readdirSync(bdir).filter((x) => x.endsWith(".md")).sort()) {
  const { meta, body } = frontMatter(readFileSync(join(bdir, f), "utf8"));
  if (meta.draft === "true") continue;
  const slug = slugify(meta.slug || f.replace(/^\d+-/, "").replace(/\.md$/, ""));
  const html = markdown(body);
  const words = body.split(/\s+/).length;
  const post = { slug, title: meta.title || slug, date: meta.date || "", summary: meta.summary || "", tags: list(meta.tags),
    usecases: list(meta.usecases), video: meta.video || null, cover: meta.cover || null, minutes: Math.max(1, Math.round(words / 230)), html };
  posts.push(post);
  const head = `<link rel="canonical" href="${BASE}blog/${slug}.html">`;
  writeFileSync(join(DOCS, "blog", `${slug}.html`), page(`${post.title} · Public AI Library`, post.summary,
    `<div class="eyebrow">${esc(post.date)} · ${post.minutes} min read</div><h1>${esc(post.title)}</h1><p class="lede">${esc(post.summary)}</p>
<div class="tags">${post.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
${post.cover ? `<img class="cover" src="${esc(post.cover)}" alt="">` : ""}${videoEmbed(post.video)}
${html}`, head));
}
posts.sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.slug.localeCompare(b.slug));
writeFileSync(join(DOCS, "blog", "index.html"), page("Articles · Public AI Library", "Use cases, combinations and cross-industry lessons from the Public AI Library.",
  `<div class="eyebrow">Field notes</div><h1>Articles</h1><p class="lede">Use cases, tool combinations and cross-industry lessons from the library.</p>
<div class="post-list">${posts.map((p) => `<a href="${p.slug}.html"><span class="eyebrow">${esc(p.date)} · ${p.minutes} min${p.video ? " · video" : ""}</span><b>${esc(p.title)}</b><p>${esc(p.summary)}</p></a>`).join("")}</div>`));
writeFileSync(join(DOCS, "data", "blog.json"), JSON.stringify({ posts }, null, 1));

// ---------- app ----------
const app = readFileSync(join(SITE, "index.html"), "utf8");
writeFileSync(join(DOCS, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta property="og:title" content="Public AI Library"><meta property="og:description" content="Search 2,400+ AI tools, MCP servers, skills and public APIs, each with a verdict, plus the top trending GitHub repos.">
<link rel="canonical" href="${BASE}">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>
${app}
</body></html>`);
writeFileSync(join(DOCS, ".nojekyll"), "");
console.log(`site: docs/index.html + ${posts.length} articles + data/library.json`);

# Nunna's AI Library

A curated, regularly maintained catalog of **public APIs, MCP servers, Claude skills & plugins, agent frameworks, and AI content-creation tools** — every curated entry carries a verdict (adopt / have / trial / assess / reference / skip) and the reasoning behind it, so no tool gets researched twice.

| | |
|---|---|
| 🔎 **Browse** | https://scnunna.github.io/Public-AI-Library/ |
| 📇 **Index** | [INDEX.md](INDEX.md) — every curated item by collection and category |
| 🔌 **Connect your Claude** | [CONNECT.md](CONNECT.md) — web, desktop, mobile and Claude Code |
| 🧠 **Mind map** | [MINDMAP.md](MINDMAP.md) (visual) · [MINDMAP.graphql](MINDMAP.graphql) (runnable queries) |
| 🤖 **For AI assistants** | [llms.txt](llms.txt) — one-file overview for Claude and other LLMs |
| 🧬 **GraphQL** | [schema.graphql](schema.graphql) — run queries through the MCP `graphql` tool |
| 📦 **Raw data** | [dist/library.json](dist/library.json) · [dist/apis.csv](dist/apis.csv) · [dist/graph.json](dist/graph.json) |
| 📝 **Changes** | [CHANGELOG.md](CHANGELOG.md) |

## Collections

| Collection | What's in it |
|---|---|
| `content-tools` | Video/image/voice/music/caption/lip-sync/publishing tools and ComfyUI node packs (8 GB VRAM fit noted) |
| `mcp-servers` | MCP servers worth connecting to Claude |
| `skills` | Claude Agent Skills, plugins, marketplaces |
| `agent-tools` | Agent frameworks, coding agents, memory, observability, local LLM runners |
| `directories` | Registries and awesome-lists for discovering more |
| `web-tools` | Research / scraping / archiving tools |
| `design-resources` | Template libraries and UI kits |
| `assessments` | Repos/models evaluated in depth |
| `apis` | 1,800+ public APIs (from public-apis/public-apis + additions); `no-key`, `https`, `cors` tags |
| `api-recipes`, `api-test-endpoints`, `skill-capabilities`, `compliance`, `notes` | Supporting data |

## Use it from Claude (any device)

See **[CONNECT.md](CONNECT.md)** for step-by-step setup. In short:

- **Zero setup:** ask Claude to read `https://raw.githubusercontent.com/scnunna/Public-AI-Library/main/llms.txt`.
- **Remote connector (claude.ai, Desktop, Code):** *Settings → Connectors → Add custom connector* with URL `https://xbinbulvanscbmfbvcio.supabase.co/functions/v1/public-ai-library` (read-only, serves the latest `main`).
- **Local MCP server:** `git clone https://github.com/scnunna/Public-AI-Library.git` then `claude mcp add -s user public-ai-library -- node "<path>/Public-AI-Library/mcp/server.mjs"`. It `git pull`s on start; the maintainer's checkout also gets the write tools `add_items` / `sync_library`.

### Tools
`library_info` · `search` · `browse` · `get_item` · `why` · `categories` · `search_apis` · `recent` · `graphql` — plus `add_items` / `sync_library` in a local checkout.

## Adding to the library

1. Ask Claude: *"Add X to the Nunna's AI Library"* (uses `add_items`), **or**
2. Put items in a JSON file and run `node scripts/add.mjs items.json --source "research YYYY-MM-DD: topic" --push`, **or**
3. Edit `library/<collection>.json`, then `node scripts/build.mjs` and push.

Item shape: see `Item` in [schema.graphql](schema.graphql). Only `name`, `kind`, `category` are required; always add `verdict` + `why`.

## Maintenance

- Every push touching `library/` re-validates and regenerates the Index, Mind map and bundle (GitHub Action).
- Every Monday the Action refreshes GitHub stars, licences and archived status for all linked repos.
- `scripts/build.mjs` fails on duplicate ids, bad verdicts, and anything that looks like a secret.

Zero dependencies — Node 18+ only. Library data: descriptions are summaries; check each project's own licence before use.

# Connect your Claude to the Nunna's AI Library

Three ways, from easiest to most powerful. All of them are **read-only** for you: you can search the library, but only the maintainer can change it.

| Option | Works in | Setup time | Needs |
|---|---|---|---|
| A. Just ask Claude to read it | claude.ai chat (web, desktop, mobile) | 0 min | Web search/fetch turned on |
| B. Remote connector | claude.ai, Claude Desktop, Claude Code | 2 min | A plan that allows custom connectors |
| C. Local MCP server | Claude Code, Claude Desktop | 5 min | Node.js 18+ (and Git, optional) |

---

## A. Just ask Claude (no setup)

Paste this into a chat:

> Read https://raw.githubusercontent.com/scnunna/Nunnas-AI-Library/main/llms.txt and use the Nunna's AI Library as your reference. Before you recommend any AI tool, API or MCP server, check its verdict there.

For a specific tool, Claude can look it up in the full bundle:
`https://raw.githubusercontent.com/scnunna/Nunnas-AI-Library/main/dist/library.json`

Good for quick questions. For repeated use, set up B or C so Claude can search properly.

---

## B. Remote connector (claude.ai, Desktop, Code)

1. In Claude, open **Settings → Connectors → Add custom connector**.
2. Name: `Nunna's AI Library`
3. URL: `https://xbinbulvanscbmfbvcio.supabase.co/functions/v1/public-ai-library`
4. Save, then enable it in a chat from the tools menu.

It always serves the latest version of this repo. If the connector ever fails, use option C or A; both read straight from GitHub.

**Claude Code users** can add the same connector from a terminal:

```bash
claude mcp add --transport http public-ai-library https://xbinbulvanscbmfbvcio.supabase.co/functions/v1/public-ai-library
```

---

## C. Local MCP server (Claude Code or Claude Desktop)

### With Git (recommended: updates itself)

```bash
git clone https://github.com/scnunna/Nunnas-AI-Library.git
claude mcp add -s user public-ai-library -- node "/full/path/to/Nunnas-AI-Library/mcp/server.mjs"
```

The server runs `git pull` every time it starts, so you always get the latest library.

### Without Git

Download these two files into one folder:

- https://raw.githubusercontent.com/scnunna/Nunnas-AI-Library/main/mcp/server.mjs
- https://raw.githubusercontent.com/scnunna/Nunnas-AI-Library/main/mcp/core.mjs

Then register it:

```bash
claude mcp add -s user public-ai-library -- node "/full/path/to/folder/server.mjs"
```

It downloads the latest library from GitHub on start and keeps an offline copy.

### Claude Desktop (no terminal)

Open **Settings → Developer → Edit Config** and add this inside `"mcpServers"`:

```json
"public-ai-library": {
  "command": "node",
  "args": ["C:\\full\\path\\to\\Nunnas-AI-Library\\mcp\\server.mjs"]
}
```

Restart Claude Desktop.

---

## What to ask once connected

| Ask Claude | Tool it uses |
|---|---|
| "Have we already reviewed ComfyUI? What was the verdict?" | `why` |
| "Find free text-to-speech tools that fit an 8 GB GPU" | `search` |
| "List the adopted video-generation tools" | `graphql` |
| "Free weather APIs with no key and CORS" | `search_apis` |
| "What was added to the library this month?" | `recent` |

Copy any query from [MINDMAP.graphql](MINDMAP.graphql) and ask Claude to run it with the `graphql` tool.

## Verdicts

| Verdict | Meaning |
|---|---|
| adopt | Recommended; use it |
| have | Already in use |
| trial | Worth a test before committing |
| assess | Interesting; check fit and terms first |
| reference | Learn from it; don't install |
| skip | Not recommended (reason given) |

Descriptions are summaries. Always check a project's own licence before commercial use.

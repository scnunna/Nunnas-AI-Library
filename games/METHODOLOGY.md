# How the Top 100 is ranked

**Scope:** free games you can play in a web browser, where there is public evidence they were built mostly with AI tools (Claude, ChatGPT/Codex, Cursor, Gemini, Grok, Lovable, Replit, Rosebud and others). Covers 2025–2026, researched 2026-11-15.

**Sources (205 sightings, 173 unique games):**
- Reddit (r/vibecoding, r/ClaudeAI, r/aigamedev, r/WebGames and others) and Hacker News "Show HN" posts
- X/Twitter, YouTube and press coverage (404 Media, Sportico, Fast Company, Simon Willison's blog and others)
- Game jams (Vibe Coding Game Jam 2025 and 2026, Colyseus, AI Browser Game Jam), plus AI game directories (vibecode.games, AIGameShare, Rosebud)

## Viral Score (0–100)

| Part | Points | What it measures |
|---|---|---|
| Reach | 45 | Engagement on the strongest signal (40) plus the second strongest (5). Log-scaled against a ceiling per metric: 10M views, 100k likes, 20k upvotes, 2k HN points, 1M players or plays, $1M revenue. |
| Spread | 20 | Number of different channels it showed up on (1 → 6, 2 → 12, 3 → 16, 4+ → 20). Cross-platform buzz is the best sign of real virality. |
| Credibility | 20 | Press coverage (+10), a jam award or top-3 placement (+7), public revenue figures (+5). |
| Playable | 10 | A working free play link. |
| Recency | 5 | Released in the last 12 months. |

Log scaling means a post with 10× the upvotes gets a higher score, not a 10× higher score, so one mega-viral post can't drown out everything else.

## Rules
- **Left out:** clones or ports of commercial games (RuneScape, GTA: Vice City, Mario, SimCity and similar), games taken down, and entries without a play link. Those without a play link are kept in `watchlist` in `top100.json`.
- **Dead links:** every play link was checked on 2026-11-15. Links that returned 404 or had no DNS record were dropped. Sites that blocked the checker were kept.
- **Honesty:** most player and play counts are **self-reported by creators**. `verified: true` on a sighting means the page was loaded and the number seen, not that the number is audited. Reddit scores mostly come from a third-party snapshot, because Reddit blocks automated access.

## Re-run it
```
node games/scripts/check-links.mjs games/research
node games/scripts/rank.mjs games/research
```

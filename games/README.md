# AI Game Library

A curated library of free, AI-built ("vibe coded") browser games, ranked by how viral they went.

- **[TOP100.md](TOP100.md)**: the ranked list. Also available as [top100.csv](top100.csv) for Google Sheets and [top100.json](top100.json).
- **[METHODOLOGY.md](METHODOLOGY.md)**: how the Viral Score works.
- **[n8n/](n8n/)**: the weekly newsletter workflow (see the steps below).
- `research/` holds the raw sightings and `scripts/` the ranking and link-check scripts.

## Weekly newsletter with n8n (no coding)
1. In n8n, go to **Workflows → Import from file** and choose `n8n/ai-games-newsletter.workflow.json`.
2. Create a Google Sheet with a tab named **Games**. Import `top100.csv` into it to seed the library.
3. Paste the sheet URL into the two Google Sheets nodes and connect your Google account.
4. Connect Gmail and set the recipients in the last node. You can swap that node for Beehiiv, Buttondown, Discord or Telegram.
5. Click **Execute workflow** once to test it, then switch it to **Active**. It runs every Monday at 9am.

**What it does each week:** it pulls the week's top posts from Reddit and Hacker News and keeps only AI-built games. It then scores them (upvotes, comments, freshness), skips games already in your sheet, adds the new ones, and emails a newsletter.

Reddit sometimes blocks cloud servers. If that node fails, the workflow carries on with Hacker News alone. You can also switch that node to n8n's Reddit node and sign in with a Reddit account.

To change the newsletter's code steps, edit `score.js` or `newsletter.js`, then run `node n8n/build-workflow.mjs`.

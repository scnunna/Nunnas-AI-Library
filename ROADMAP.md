# Nunna's AI Library: roadmap (Now / Next / Later)

Updated 2026-10-26. Nunna's AI Library (NAIL) is a curated, ever-updated catalog of public APIs, MCP servers, Claude skills, agent frameworks and AI content tools, each with a verdict and a one-line reason. It is part of Nunna AI Consulting's APM Suite (the ContentStudioAI and Developer & MCP groups) and is the free front door of the consultancy. This roadmap contains no private plans; no numbers are claimed that the repo cannot show.

## Now
- Keep it ever-updated: every research session adds or updates items with a verdict and a `why`; `verified` only when the page was actually seen. The weekly refresh keeps the generated files in sync.
- Keep the three entry points consistent: the GitHub Pages browser, the connector (`CONNECT.md`) and the read-only mirror at https://nunnaconsulting.com/NAIC/NAIL/ (use the trailing slash on `/NAIC/NAIL/mcp/`). The mirror is a snapshot and can lag the repo until it is rebuilt.
- Fix any stale link or verdict when an item is touched; do not hand-edit generated files (`node scripts/build.mjs`).

## Next
- A clear note in `CONNECT.md` on how to get a free key (email-validated, rate-limited tiers already exist on the mirror).
- Better verdict hygiene: a visible "last checked" date per item and a sweep of items older than 90 days.
- Collections with the thinnest coverage (named in `INDEX.md`) get a research pass each month.
- More runnable GraphQL examples in `MINDMAP.graphql`.

## Later
- A paid tier with extra workflow content, only when it exists and is announced on the mirror; nothing paid is promised here.
- Public changelog digest (weekly) from `CHANGELOG.md`.
- Optional notifications when a followed tool changes verdict.

## Rules
- This repo is public: no private plans, emails, keys, project refs or infrastructure details. Private research stays in the gitignored `private/` folder.
- Every curated item needs a verdict and a one-line reason.

---
title: Free endpoints, gateways and local models: cost discipline for small teams
date: 2026-10-23
tags: llm, cost, infrastructure
usecases: llm, agents
summary: Most AI bills are paying a frontier model to do work a small model could do. A tiered setup with gateways, free endpoints and local models cuts cost without lowering quality where it counts.
video:
---

Small teams usually start by sending every request to the best model available. That works until the invoice arrives. The fix is to route each task to the cheapest model that does it well.

## Three tiers

| Tier | Use it for | Examples in the library |
|---|---|---|
| Local | tagging, summarising, drafts, private data | [Ollama](../?q=ollama#explore), [Open WebUI](https://github.com/open-webui/open-webui) |
| Free or cheap hosted | prototypes, batch jobs, fallbacks | [freellmapi](https://github.com/tashfeenahmed/freellmapi), [gateways](../?q=gateway#explore) |
| Frontier | reasoning, customer-facing writing, code changes | paid APIs |

A **gateway** sits in front of all three. Your code calls one endpoint; the gateway picks the model, retries on failure and records the cost.

## Cut tokens before you cut models

- **Shrink tool output.** Agents waste most of their context reading logs and tool results. Tools like [context-mode](https://github.com/mksglu/context-mode) sandbox that output and pass only what matters.
- **Cache repeated prompts.** System prompts and reference documents rarely change, and caching them is often the single biggest saving ([search: caching](../?q=caching#explore)).
- **Run fewer agents.** A swarm of ten agents is rarely ten times better than one good agent with a clear plan. Start with one and add more only when you can measure the gain.

## Watch the hidden costs

Free endpoints change limits without notice, and some log your prompts. Keep private data on the local tier, keep a paid fallback for anything customer-facing, and track spend per feature, not just per month.

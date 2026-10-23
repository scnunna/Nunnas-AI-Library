---
title: Reverse engineering with agents: lessons for security, repair and legacy software
date: 2026-10-23
tags: trending, security, legacy, cross-functional
usecases: security, coding, agents
summary: The top trending repository this week points agents at binaries and app behaviour. The same technique solves very different problems in security teams, repair shops and companies stuck on old software.
video:
---

This week's top trending repository, [rea](https://github.com/morluto/rea), gained over 100,000 stars by doing something that used to need a specialist: pointing agents at an application, from its visible behaviour down to native binaries, and explaining how it works. Combined with mature tools like [Ghidra](https://github.com/NationalSecurityAgency/ghidra), this moves reverse engineering from a rare skill to a routine task.

## Who has this problem

**Security teams** need to know what third-party software and firmware actually do, not what the vendor says they do. Agents can triage binaries, flag suspicious network calls and summarise findings for a human analyst.

**Repair and hardware shops** deal with devices whose makers no longer publish documentation. Understanding a firmware protocol is often the difference between repairing a device and scrapping it.

**Companies on legacy software** often run critical systems whose source code or original developers are gone. Before any rewrite, an agent can map the business rules hidden in the old binary, which is the part that usually gets lost in migrations.

## A safe workflow

1. **Get permission first.** Only analyse software you own or are licensed to inspect, and respect the licence terms. Reverse engineering law varies by country.
2. **Sandbox everything.** Run unknown binaries inside an isolated runtime ([search: sandbox](../?q=sandbox#explore)), never on a workstation.
3. **Agent proposes, human confirms.** Treat agent findings as leads, then verify them with a debugger or a test.
4. **Write it down.** The real output is documentation: the rules, protocols and data formats you recovered.

## The cross-functional lesson

The same "explain this black box" pattern applies far beyond binaries: undocumented spreadsheets, old database schemas and supplier file formats. Any team that inherits a system nobody understands can use the same loop: inspect, hypothesise, verify, document.

---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read `rules.md`, in this folder. It holds the rules and the output format.
2. Read the specified files (or ask the user which files to review).
3. Check the files against the rules, with the adaptations below.
4. Output findings in the terse `file:line` format that `rules.md` defines.

Do not fetch anything from the network. The rules are a local copy on purpose. Ignore the `$ARGUMENTS` placeholder in `rules.md`: it is a leftover of the command format, and the files to review come from step 2.

## Origin of rules.md

`rules.md` is `command.md` from `vercel-labs/web-interface-guidelines`, commit `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05), copied unchanged and reviewed on 2026-10-15. The original skill fetched the file from the `main` branch on every run. That made the rules change without review, so the project pinned a reviewed copy.

Updating the rules is a deliberate change: read the new `command.md` in full, replace `rules.md`, update the commit above and send it in a PR. `npx skills update` rewrites this folder from upstream and removes this adaptation, so do not run it for this skill without redoing the section above.

## Adaptation for STRONILEAD

- The app is a Vite single-page app in Brazilian Portuguese, with no server rendering. Skip the "Hydration Safety" rules.
- Title Case, curly quotes and `&` in the "Typography" and "Content & Copy" rules are English conventions. Do not flag Portuguese interface text for them.
- The project rules win where they differ: `AGENTS.md`, `CLAUDE.md` and `docs/design.md`. For example, filters live in the address and opening a lead is always a link.
- Report only. Do not edit files unless the user asks.

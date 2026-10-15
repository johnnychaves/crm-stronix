---
name: writing-guidelines
description: Review docs/prose for Writing Guidelines compliance. Use when asked to "review my docs", "check writing style", "audit prose", "review docs voice and tone", or "check this page against the writing handbook".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Writing Guidelines

Review files for compliance with Writing Guidelines.

## How It Works

1. Read `rules.md`, in this folder. It holds the rules and the output format.
2. Read the specified files (or ask the user which files to review).
3. Check the files against the rules, with the adaptations below.
4. Output findings in the terse `file:line` format that `rules.md` defines.

Do not fetch anything from the network. The rules are a local copy on purpose. Ignore the `$ARGUMENTS` placeholder in `rules.md`: it is a leftover of the command format, and the files to review come from step 2.

## Origin of rules.md

`rules.md` is `command.md` from `vercel-labs/writing-guidelines`, commit `83e2316b034cf572400513538e4e4da01c4cc742` (2026-06-01), copied unchanged and reviewed on 2026-10-15. The original skill fetched the file from the `main` branch on every run. That made the rules change without review, so the project pinned a reviewed copy.

Updating the rules is a deliberate change: read the new `command.md` in full, replace `rules.md`, update the commit above and send it in a PR. `npx skills update` rewrites this folder from upstream and removes this adaptation, so do not run it for this skill without redoing the section above.

## Adaptation for STRONILEAD

- The project documents are in Brazilian Portuguese. Apply the voice, concision and structure rules to Portuguese text. Skip the rules that only make sense for English.
- Skip the Vercel-only rules: `meta.contentType`, `<Steps/>`, AI Gateway and model strings, `vercel.com` links, the "TypeScript is the default" rule and the pricing-page rules. The project code is JavaScript.
- The project writing rule wins where it differs: direct language, no dash in the middle of a sentence, no jargon, no slogans (`AGENTS.md`, humanizer).
- Report only. Do not edit files unless the user asks.

---
name: kbee-audit
description: Find and check a project's existing knowledge base (KB) - a kbee KB, a hand-written kb/ or docs folder in any format, or knowledge scattered across READMEs and agent files - report what's missing or wrong, and after one yes fix it so every kbee command works on it. Use when the user says "kbee audit", "check our KB", "use our existing docs", "is our KB up to date", or kbee finds a KB it didn't build.
---

# kbee-audit

Makes kbee plug and play on a project that already has knowledge written down. You find it, check it against the code, show **one report**, and after a yes leave a KB that every kbee skill can use.

The rules in [references/accuracy-rules.md](references/accuracy-rules.md) and [references/approval-rules.md](references/approval-rules.md) apply to every step. The KB layout, including in-repo KBs and `teamDocs`, is in [references/kb-layout.md](references/kb-layout.md). Read them first.

The helper is `<skill-dir>/scripts/kbee-tool.mjs`, where `<skill-dir>` is the folder containing this SKILL.md. If Node is not available, use the manual fallbacks in `references/accuracy-rules.md`.

Work the project out yourself. Don't ask the user what format their docs are in or where they live.

## 1. Find

Run `node <skill-dir>/scripts/kbee-tool.mjs find` from the project, then look further yourself. You're looking for one of three things:

- **A kbee KB:** `find` returns `kbDir` (a valid `manifest.json`, in its own repo or in-repo at `kb/`). If it also reports `"skeleton": true` (a manifest with no fact files yet, as a project scaffolder writes), there's nothing to audit: say so in one line and hand over to **kbee-init**, which builds the KB in place from the manifest's entries. Don't report the missing files one by one.
- **A foreign KB:** a hand-written knowledge base without a kbee manifest. `find` lists likely folders under `foreign`, but judge by content, not only by name: pages per table, route, screen or service, architecture notes, end-to-end walkthroughs. It can sit at the root of a monorepo, in `docs/`, or in its own repo next to the code.
- **Scattered knowledge:** no KB folder, only `CLAUDE.md`, `AGENTS.md`, READMEs per package, ADRs, or a `docs/` folder.

Also work out the code it describes: a single repo, a monorepo (workspaces, `apps/*`, `packages/*`; each package or app becomes its own manifest entry), or several repos.

- **Nothing found:** say so, and offer **kbee-init**.
- **Only scattered knowledge:** report what you found in a few lines, then hand over to **kbee-init**, telling it which docs to read as sources. Init asks where the KB should live.

## 2. Check it against the code

Read the code at each repo's default-branch SHA. For an in-repo KB, do this on the **default branch** (switch first; if the tree is dirty, stop and ask), so the fixes you commit sit next to the code they cite. For the KB you found, work out:

- **Coverage:** which repos or packages, routes, tables, screens, events and cross-boundary contracts it covers, and which it misses.
- **Accuracy:** claims that don't match the code. Spot-check widely, weighted toward what other code depends on (contracts, data models). **Verify every claim you report as wrong** by rereading the code. Never report a guess.
- **Sources:** claims with no file reference at all, and file references that point at files that no longer exist.
- **What kbee needs that's missing:** `manifest.json`, `system-map.md` with `## Common changes`, per-repo `overview.md` and `conventions.md`, field-level `contracts/` with producer and consumers, citations, `gaps.md`, `features/`.

For a **kbee KB**, run the gap check instead of starting from scratch:

- `node <skill-dir>/scripts/kbee-tool.mjs stale <kb>`: stale repos and team docs go to **kbee-sync** merge mode (separate KB) or get re-verified here (in-repo KB).
- `node <skill-dir>/scripts/kbee-tool.mjs rules <kb>`: outdated rules go to **kbee-sync** upgrade mode.
- `node <skill-dir>/scripts/kbee-tool.mjs validate <kb>`: broken citations.
- Coverage and accuracy as above. Fixes become proposed fact changes.

## 3. One report

Show the user **one report**, worst problems first:

- what you found and where, and which code it describes
- what's wrong (each claim with what the code actually says, cited)
- what's missing
- exactly what you propose to change

Keep it short. Offer the full list if it's long.

## 4. One question about the format

Only for a **foreign** KB, ask once: **rewrite** it into kbee's layout, or **keep** the team's files as they are and add kbee's structure **alongside** them? Say in one line what each means for their files. Ask this in the same message as the report, together with the yes to go ahead.

## 5. Fix, after a yes

### Keep alongside (the default if the user doesn't want a rewrite)

- Put kbee's files in the **same folder** as the team's KB (`kb/manifest.json`, `kb/system-map.md`, `kb/contracts/…`). If the team already uses one of kbee's names (`contracts/`, `decisions/`, `repos/`, `system-map.md`), put kbee's structure in a **`kbee/ subfolder`** of it instead, so the helper never treats the team's files as kbee facts.
- If the team has a `README.md`, keep it and don't write kbee's template over it. Add a short kbee section to it instead (what kbee is and the editing rules from [templates/kb/README.md](templates/kb/README.md)), as one of the approved changes below.
- The team's files stay **byte-for-byte** unchanged, except for:
  - one link from their index or README to `system-map.md`, shown and approved like a fact change;
  - fixes to their docs that the user approves (below).
- List the team's docs that describe the code in `manifest.json` `teamDocs`. kbee keeps looking after them from now on: they're read by ask and spec, flagged as stale when the files they mention change, and fixed with the user's yes.
- Build kbee's files using the team's docs as a source, but **cite the code** for every fact, as **kbee-init** steps 3–5 describe. Link kbee files to the team pages they draw on.
- Where a team doc and the code disagree, **the code wins** in kbee's files, and the disagreement goes in `gaps.md`. Offer the fix to the team's doc as a separate change in the report.

### Rewrite

- Build the kbee KB in the same folder, from the team's docs and the code, as **kbee-init** steps 3–5 describe.
- Replace the old files as part of the one approved change. Keep content kbee's layout has no slot for, such as end-to-end walkthroughs, under `flows/`, listed in `teamDocs` and linked from `system-map.md`. Drop nothing silently.
- If other files point at the old paths (for example a rule in `CLAUDE.md` or `AGENTS.md`), list them in the report and update them with the user's yes.

### Either way

- **Location:** if the KB folder is inside the code repo and every entry lives in that git repo, set `"location": "in-repo"` and use citations without a commit (`[repo:path:line]`). Otherwise it's a separate KB with `repo@sha` citations and `syncedSha` per repo.
- Set `rulesVersion` with `node <skill-dir>/scripts/kbee-tool.mjs rules <kb>` (`currentRulesVersion`), then `node <skill-dir>/scripts/kbee-tool.mjs set-rules <kb> <version>`.
- Run the verify pass from `references/accuracy-rules.md`, then `node <skill-dir>/scripts/kbee-tool.mjs validate <kb>`. Fix or drop everything it reports, and rerun until it's clean.
- Uncertain claims go to `gaps.md` as questions, not into the facts.

## 6. Commit, then ask before pushing

Commit (`kb: audit and adopt`). For an in-repo KB, commit on the default branch in its own commit, or, in `"pr"` mode, on a branch `kbee/kb-audit` with a PR after asking (see `references/approval-rules.md`). Ask **before pushing**.

Offer the pointer block ([templates/pointer-snippet.md](templates/pointer-snippet.md)) where a code repo doesn't point at the KB yet, only with permission.

## Finish

Tell the user what changed and that the KB is ready. `/kbee build` now works on it.

---
name: kbee-init
description: Set up kbee - build a shared, cited knowledge base (KB) for one or more code repos, or join an existing KB. Use when the user says "set up kbee", "create a knowledge base", "connect my repos", "kbee init", or "join our team's KB".
---

# kbee-init

Builds the shared knowledge base (KB) that every other kbee skill reads. The KB is plain Markdown, either in a folder inside the code repo or in its own git repo, described in [references/kb-layout.md](references/kb-layout.md).

The rules in [references/accuracy-rules.md](references/accuracy-rules.md) and [references/approval-rules.md](references/approval-rules.md) apply to every step. Read them first.

The helper is `<skill-dir>/scripts/kbee-tool.mjs`, where `<skill-dir>` is the folder containing this SKILL.md. If Node is not available, use the manual fallbacks in `references/accuracy-rules.md`.

## 1. New KB or existing KB?

First run `node <skill-dir>/scripts/kbee-tool.mjs find`. If it reports `"skeleton": true` (a `manifest.json` with no `system-map.md` and no other fact files yet, as a project scaffolder writes), go to [Building a skeleton KB](#building-a-skeleton-kb) **without asking new or join**.

If it lists a **foreign** KB (a hand-written knowledge base without a kbee manifest), or you see one yourself, say so and hand over to **kbee-audit**, which adopts it instead of building a second KB.

Otherwise ask the user one question: create a new KB, or join an **existing KB**?

- **Existing KB:** ask for its git URL or local path. Then go to [Joining an existing KB](#joining-an-existing-kb).
- **New KB:** continue. You'll ask where it goes once you know the repos (step 2b).

## 2. Collect the repo links

Ask for the **repo links**: git URLs or local paths, any number. One repo is fine.

- For each URL that isn't already on disk, clone it into the folder the user is working in, next to the other repos. Ask first if that folder already has unrelated content.
- Name each repo after its folder, lowercased, matching `^[a-z0-9][a-z0-9._-]*$`.
- Detect each repo's default branch: `git -C <repo> symbolic-ref --short refs/remotes/origin/HEAD`, falling back to `main`, then `master`. Read the KB facts from that branch. If the working copy is on another branch, read files with `git show <sha>:<path>` rather than checking out.
- **Monorepos:** if a repo holds several packages or apps (workspaces, `packages/*`, `apps/*`), ask whether to treat each one as its own entry. Each entry's `pathHint` then points at the package folder.
- **Limits:** v1 is built for up to about 10 repos of up to about 100k lines each. If the user goes past that, say so and offer to scope down to the key repos or packages.

## 2b. Where the KB lives

**Always ask**, with a default:

- **One git repo** (a single repo or a monorepo): default **inside the repo**, in `kb/` at the git root, with `"location": "in-repo"` in the manifest. Say the alternative in one line: a **separate KB repo** next to the code.
- **Several separate repos:** default a **separate KB repo**, `<name>-kb` next to the code repos (for example `../shop-kb`), run `git init` there. An in-repo KB isn't offered here, because one repo's PRs would carry the other repos' facts.

If `kb/` already exists and isn't a kbee KB, hand over to **kbee-audit**.

For an in-repo KB, work on the **default branch** (switch to it first; if the tree is dirty, stop and ask), so you read and commit the same code. Use citations without a commit (`[repo:path:line]`, path from the git root), leave `syncedSha` as `null`, and skip `set-synced`. Freshness comes from git history (see `references/kb-layout.md`).

## 3. Scan each repo

For each repo, at its default-branch SHA, extract raw facts with a citation for each one:

- purpose (README) and stack (manifests such as `package.json`, `pyproject.toml`, `go.mod`, `pom.xml`)
- entry points, and how to run, test, and build (scripts, Makefile, CI config)
- what it exposes: HTTP routes, events and topics, exported types, database tables, and CLI commands, **including every file under `scripts/`, `bin/` or `tools/`** (one line each: purpose, and how to run it)
- what it consumes: outbound HTTP calls, imports of other listed repos, shared packages, env/config that points at other services
- **Data flow and domain model:** for each datastore the repo owns, trace source → transforms → stored shape (collection or table, key or `_id` format, key fields) → readers. For each derived or cached store, record how it's rebuilt or backfilled when its shape changes
- **Mirrored code:** files with the same name or near-identical content in more than one repo, and comments like "mirrors the backend". Diff the copies. Each mirrored constant, list or business rule is a contract
- **Runtime model:** background jobs and schedulers, in-memory state or caches (and so whether it can run more than one instance), health checks, and what CI actually gates (build, tests, typecheck)
- conventions you see repeated at least twice: error format, naming, test layout

Also read any `docs/`, ADR, RCA, design or plan files in each repo **and in the folder that contains the repos** (a workspace Makefile, docker-compose, or architecture docs). They're the main source for decisions. Where a doc and the code disagree, the code wins in the facts, and the disagreement goes in `gaps.md`.

**Use subagents if your agent has them.** Give each repo (or each large folder) to its own subagent, on the fastest and cheapest model available. Each one returns a list of facts with citations. If your agent has no subagents or can't choose a model, scan one repo after another on the current model. The result is the same, only slower.

## 4. Write the KB

On the strongest model available, turn the facts into the files in `references/kb-layout.md`:

- `README.md` from [templates/kb/README.md](templates/kb/README.md), with `{{KB_NAME}}` replaced
- `gaps.md` from [templates/kb/gaps.md](templates/kb/gaps.md)
- `.gitignore` containing `.kbee.local.json`
- `system-map.md`, with a table of repos, a Mermaid diagram of how they connect, links to the contracts, and a `## Common changes` section: for the 1–3 most likely cross-repo changes (for example, adding a field to the main API), the files to touch in producer → consumer order, each cited, plus known traps
- `repos/<repo>/overview.md` (including `## Data flow and domain model` for repos that own data, `## Scripts`, and `## Runtime model`) and `repos/<repo>/conventions.md`
- `contracts/<topic>.md` for each thing that crosses a repo boundary, naming its producer and consumers, with **field-level shapes** as defined in `references/kb-layout.md`. Put mirrored code in `contracts/shared-logic.md`, with every copy cited and any drift noted
- `decisions/NNNN-*.md` for decisions the code or docs actually state, cited with `[source: <doc>]`. Don't invent reasons. Create `decisions/` only if there's at least one
- `features/.gitkeep`, always
- `manifest.json` with each repo's `syncedSha` set to the SHA you read (`null` for an in-repo KB, with `"location": "in-repo"`), and `rulesVersion` set to the current rules version. Get it from `node <skill-dir>/scripts/kbee-tool.mjs rules <kb>` (`currentRulesVersion`), then record it with `node <skill-dir>/scripts/kbee-tool.mjs set-rules <kb> <version>`

**Summary-level means** no per-function detail. It does **not** mean leaving out the path data takes from source to screen, the fields of a contract, or the traps someone changing the system would hit. The test: could a developer add a field end to end across the repos from the KB, without rediscovering the code?

Match a cross-repo call to its producer (for example, `fetch('/orders')` in the web app matched to the `/orders` route in the API) only when the code supports the match.

Also add to `gaps.md`:
- doc-vs-code contradictions
- code that looks like a cross-repo bug
- endpoints or exports nothing consumes
- operational unknowns (where prod runs, scaling, CI)

Every surprising thing you noticed should end up in a fact file or in `gaps.md`.

## 5. Verify

Run the verify pass from `references/accuracy-rules.md` on every fact file, including its **Cross-check contracts** step,, then run:

```
node <skill-dir>/scripts/kbee-tool.mjs validate <kb>
```

Fix or remove every reported citation, and rerun until it reports no errors. Drop any claim you can't confirm, or move it to `gaps.md` as a question.

## 6. One summary, one approval

Show **one summary**:

- the repos and what each owns
- the cross-repo connections found, and the contracts written
- anything you were unsure about (the `gaps.md` entries)

Ask for a single yes to keep the KB as a whole. Apply any corrections the user gives, re-verifying them, before committing.

## 7. Commit, then ask before pushing

Commit the KB (`kb: initial knowledge base`). For an in-repo KB, the commit goes in the code repo on the default branch and contains only `kb/` (and `.gitignore` for `.kbee.local.json`). If that's the default branch and the manifest is in `"pr"` mode, put it on a branch `kbee/kb-init` instead. Ask **before pushing**, and if there's a remote, ask which one.

## 8. Offer the pointer

For each code repo, offer to add the **pointer** block from [templates/pointer-snippet.md](templates/pointer-snippet.md) to its `AGENTS.md` (create the file if needed), with `{{KB_PATH}}` set to the KB's path relative to that repo. Do this **only with permission**, per repo, and commit nothing in a code repo without asking. Agents opened in that repo will then find the KB.

## Building a skeleton KB

A skeleton is a KB folder that holds `manifest.json` (and perhaps a `README.md` or `.gitignore`) but no fact files. A scaffolder usually pre-fills it with one entry per package. Don't ask whether to create or join, where the KB goes, or for repo links: the manifest already answers those. Build it in place:

1. Run `node <skill-dir>/scripts/kbee-tool.mjs validate <kb>` to check the manifest. For each entry, `node <skill-dir>/scripts/kbee-tool.mjs resolve <kb> <repo>` must find the folder; if one is missing, say which and ask whether to fix its `pathHint` or drop the entry.
2. The entries keep their name, pathHint, `url` and `defaultBranch`, and their order. Don't rename, merge or add entries without asking. If you spot a package the manifest left out, mention it in the summary as an offer.
3. Fill in everything else as a new KB would: keep `location` and `mode` if set (if `location` is missing and every entry is in the KB's git repo, set `"location": "in-repo"`), set `syncedSha` per step 4, and set `rulesVersion` with `set-rules`. Keep any `README.md` the scaffolder wrote if it already follows [templates/kb/README.md](templates/kb/README.md); otherwise write the template.
4. Run steps 3 to 8 as for a new KB: scan, write, verify, one summary, commit, pointer. For an in-repo KB, work on the default branch as step 2b says, and write the commit-less citations yourself.

## Joining an existing KB

1. Clone or locate the KB. Check that its `manifest.json` is valid (`node <skill-dir>/scripts/kbee-tool.mjs validate <kb>` also checks this).
2. For each repo in the manifest, find it locally (`node <skill-dir>/scripts/kbee-tool.mjs resolve <kb> <repo>`), or offer to clone it from its `url` next to the KB. If a repo lives somewhere other than its `pathHint`, write `.kbee.local.json` in the KB with the real path. That file is git-ignored.
3. Don't rebuild the KB. Run `node <skill-dir>/scripts/kbee-tool.mjs stale <kb>` and report what's fresh, stale, or missing. Offer the **kbee-sync** skill for anything stale.
4. Offer the pointer, as in step 8.

## Finish

Tell the user the KB is ready, where it lives, and the next commands: **kbee-feature** to build something, and **kbee-kb** to ask the KB questions or grow it.

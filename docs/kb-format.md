# Knowledge base format

A kbee KB is a folder of Markdown plus one JSON file, either its own git repo or `kb/` inside the code repo (see [In-repo KBs](#in-repo-kbs)). You can read it on GitHub and edit it by hand. A full example is in [examples/expected-kb](../examples/expected-kb).

```
shop-kb/
  README.md              # what this is, and the rules for editing it
  manifest.json          # the repos, and the commit each was last synced at
  system-map.md          # every repo, what it owns, how they connect (Mermaid)
  repos/<repo>/
    overview.md          # purpose, stack, entry points, run/test/deploy
    conventions.md       # patterns the code actually follows
  contracts/<topic>.md   # an API, event, shared type, or table: producer -> consumers
  decisions/NNNN-*.md    # architecture decisions and why
  features/<slug>/       # spec.md, plan.md, status.json, review.md, pending.md
  gaps.md                # open questions, and declined proposals
  .kbee.local.json       # your local repo paths (git-ignored)
```

**Fact files** are `system-map.md`, `repos/`, `contracts/`, and `decisions/`. They describe each repo's **default branch** only, and stay summary-level.

## Citations

Every fact in a fact file ends with where it came from.

| Kind | Format | Example |
|------|--------|---------|
| Code, one line | `[repo@sha:path:line]` | `[shop-api@4b9f895:src/server.ts:8]` |
| Code, range | `[repo@sha:path:start-end]` | `[shop-api@4b9f895:src/orders.ts:7-11]` |
| Something a person said | `[source: user, YYYY-MM-DD]` | `[source: user, 2026-10-18]` |
| A doc, PR, or ticket | `[source: <url>]` | `[source: https://github.com/acme/shop-api/pull/12]` |

- `repo` is the name in `manifest.json`.
- `sha` is 7–40 lowercase hex characters, from the default branch.
- `path` is relative to the **git root**, even in a monorepo: `packages/api/src/x.ts`.
- Non-code sources are for decisions and the "why" only. Facts about code need code citations.

Check every citation with:

```bash
node <skill-dir>/scripts/kbee-tool.mjs validate shop-kb
```

It reports missing commits, missing files, out-of-range lines, and anything shaped like a citation that breaks the format.

In an **in-repo KB**, code citations drop the commit: `[repo:path:line]` or `[repo:path:start-end]`, for example `[shop-api:apps/api/src/orders.ts:7-11]`. The KB and the code share history, so a citation means "the code in this same commit". A citation without a commit in a separate KB is reported as `NEEDS_SHA`.

## manifest.json

```json
{
  "kbeeVersion": 1,
  "mode": "direct",
  "rulesVersion": 2,
  "repos": [
    {
      "name": "shop-api",
      "url": "https://github.com/acme/shop-api.git",
      "defaultBranch": "main",
      "pathHint": "../shop-api",
      "syncedSha": "4b9f895e2c…",
      "syncedAt": "2026-10-18T09:12:00.000Z"
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `mode` | `direct` commits KB changes to the default branch. `pr` sends them through PRs ([Working as a team](teams.md#pr-mode)). |
| `name` | Lowercase, matching `^[a-z0-9][a-z0-9._-]*$`. Used in citations. |
| `pathHint` | Where the repo usually is, relative to the KB folder. In a monorepo, this points at the package folder. |
| `rulesVersion` | The kbee rules version the KB was built or last upgraded to. A missing value means 1. When kbee's rules improve, **kbee-sync** upgrade mode brings the KB up to date. |
| `syncedSha` | The default-branch commit the facts were last verified against. kbee only moves it forward, never backwards. |

## .kbee.local.json

```json
{ "repos": { "shop-api": "/Users/me/work/shop-api" } }
```

This file is personal and git-ignored. It overrides `pathHint` when your folders are laid out differently.

## features/<slug>/status.json

```json
{
  "slug": "order-cancellation",
  "title": "Order cancellation",
  "stage": "build",
  "approved": { "spec": true, "plan": true },
  "repos": ["shop-types", "shop-api", "shop-web"],
  "branches": { "shop-api": "kbee/order-cancellation" },
  "prs": {},
  "pending": ["contracts/orders-api.md: add POST /orders/:id/cancel"]
}
```

`stage` moves through `spec`, `plan`, `build`, `review`, `ship`, and then `done`. A feature only reaches `done` once its PRs have merged and the KB has been synced.

## Editing by hand

Hand edits are fine. Follow the same rules the agents follow (they're in the KB's own `README.md`): cite every fact, describe the default branch only, and run `validate` before you commit.

## In-repo KBs

Set `"location": "in-repo"` in `manifest.json`, with the KB in `kb/` at the git root. Every entry must live in that git repo (`validate` reports `IN_REPO_SPLIT` otherwise). `pathHint` is relative to `kb/`, for example `../apps/api`. `syncedSha` stays `null`: a page is stale when a file it cites changed in a commit after the page's own last commit.

## Pre-filling a KB from a scaffolder

A tool that generates projects (a monorepo scaffolder, for example) can set kbee up ahead of time by writing just `kb/manifest.json`. That's a **skeleton** KB: a valid manifest with no fact files yet. `find` reports it as `"skeleton": true`, and the next `/kbee` or `/kbee init` builds the KB in place from your entries, without asking new-or-join, where the KB goes, or for repo links. `/kbee audit` hands a skeleton to init rather than listing everything that's missing.

Write this at `<git root>/kb/manifest.json`, one entry per package or app:

```json
{
  "kbeeVersion": 1,
  "mode": "direct",
  "location": "in-repo",
  "rulesVersion": 2,
  "repos": [
    { "name": "shop-types", "url": null, "defaultBranch": "main", "pathHint": "../packages/types", "syncedSha": null },
    { "name": "shop-api", "url": null, "defaultBranch": "main", "pathHint": "../apps/api", "syncedSha": null },
    { "name": "shop-web", "url": null, "defaultBranch": "main", "pathHint": "../apps/web", "syncedSha": null }
  ]
}
```

- **Required per entry:** `name` (matching `^[a-z0-9][a-z0-9._-]*$`, unique), `defaultBranch`, and `pathHint`, relative to `kb/`. Keep `syncedSha` `null`: an in-repo KB never sets it. `url` is optional.
- **Entry order:** kbee keeps your entries, their names and `pathHint`s, and their order. List producers before consumers (shared packages and types, then services and APIs, then apps), the order kbee plans changes in.
- **`rulesVersion`:** optional. If you set it, use the current version: `node <skill-dir>/scripts/kbee-tool.mjs rules` with no KB prints `{"currentRulesVersion": 2}`. Without Node, it's the highest `## vN` in `references/rules-changelog.md`. kbee-init records it either way.
- **Leave the rest to kbee.** Don't write `system-map.md`, `repos/`, `contracts/` or `decisions/`: any of them makes the KB count as built, not a skeleton. kbee writes them, with in-repo citations without a commit (`[repo:path:line]`) that it verifies against the code. A `README.md` from [templates/kb/README.md](../shared/templates/kb/README.md), a `.gitignore` with `.kbee.local.json`, and `features/.gitkeep` are fine to include.
- Check your output with `node <skill-dir>/scripts/kbee-tool.mjs validate kb` (manifest errors) and `node <skill-dir>/scripts/kbee-tool.mjs find` (`"skeleton": true`).

## Team docs

`"teamDocs"` in `manifest.json` lists your own docs that kbee looks after, relative to the KB folder, for example `["use-cases/place-an-order.md"]`. `/kbee audit` adds them when you keep an existing KB alongside kbee's files. They don't need kbee citations. kbee watches the file paths they mention in backticks or relative links, flags them when those files change, and proposes fixes for your yes.

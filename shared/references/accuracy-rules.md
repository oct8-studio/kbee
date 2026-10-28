# Accuracy rules

A wrong knowledge base (KB) is worse than an empty one. Follow these rules every time you write to the KB.

## 1. Every fact cites its source

Facts about code need a **code citation**:

- `[repo@sha:path:line]`, for example `[shop-api@a1b2c3d:src/orders.ts:42]`
- `[repo@sha:path:start-end]`, for example `[shop-api@a1b2c3d:src/orders.ts:10-24]`

`repo` is the repo's `name` in `manifest.json`. `sha` is 7–40 lowercase hex characters: the commit of the repo's **default branch** that you read. `path` uses forward slashes and is relative to the git root, which is the top of the git repo even in a monorepo. For a package entry like `packages/api`, a citation reads `[shop-api@a1b2c3d:packages/api/src/orders.ts:42]`. Lines are 1-based.

In an **in-repo KB** (`"location": "in-repo"`), use `[repo:path:line]` or `[repo:path:start-end]`, with no commit: the KB and the code share history, so the citation means "the code in this same commit". `validate` reads the file from the working tree. A citation without a commit in a separate KB is an error (`NEEDS_SHA`).

Facts the code can't show, such as decisions and the "why" behind them, may use a **non-code citation**:

- `[source: user, YYYY-MM-DD]`, for something the user told you on that date
- `[source: https://...]`, for a doc, PR, or ticket

If a fact has no citation, don't write it.

## 2. Verify before writing

After drafting KB text, run a separate verify pass:

1. Reread every cited range (`show`, below).
2. Confirm that the cited lines actually support the sentence.
3. Delete the claim, or move it to `gaps.md` as a question, if it isn't confirmed.

4. **Cross-check contracts.** For every consumer behavior that depends on the producer (a header read, a field used, a status code handled), confirm the producer emits it and that nothing in between (CORS, a proxy, auth) blocks it. Record a mismatch in `gaps.md` as a possible bug, never as a fact.

Never "fix" a citation by guessing another line. Reread the code instead.

## 3. Track freshness

`manifest.json` records the commit each repo was last synced at (`syncedSha`). In an in-repo KB there's no `syncedSha`: a KB file is stale when a file it cites changed in a commit after the KB file's own last commit. Before trusting the KB, check staleness (`stale`, below). Treat KB files that cite changed files of a stale repo as unconfirmed until re-verified.

## 4. Uncertain means ask

If you can't confirm something, don't guess. Add a question to `gaps.md` and tell the user.

## The helper and its manual fallbacks

The optional helper lives next to this file at `../scripts/kbee-tool.mjs`. It needs Node 18 or later. Run it as `node <skill-dir>/scripts/kbee-tool.mjs <command> ...`. It prints JSON. If it reports an error, the output is `{"error":{"code","message"}}` and the exit code is 1.

If Node is not available, do the same thing by hand:

| Command | What it does | Manual fallback |
|---------|--------------|-----------------|
| `find [dir]` | Locates the KB (see `kb-discovery.md`), says whether it's a `skeleton` (a manifest with no fact files yet), and lists `foreign` KB-like folders without a manifest. | Follow the order in `kb-discovery.md`, then look for `kb/`, `docs/kb/`, `knowledge/`, `wiki/`, `docs/architecture/` holding two or more `.md` files. The KB is a skeleton if it has no `system-map.md` and no `.md` files under `repos/`, `contracts/` or `decisions/`. |
| `resolve <kb> <repo>` | Gives the repo's local path and its `gitRoot`. | Use `.kbee.local.json` `repos.<name>` if present, otherwise `pathHint` relative to the KB. Then `git -C <path> rev-parse --show-toplevel`. |
| `roots <kb>` | Groups manifest entries by the git repo they live in (`[{gitRoot, repos}]`). Entries in one group share one branch and one PR. | Run `git rev-parse --show-toplevel` in each entry's folder and group equal results. |
| `validate <kb>` | Checks every citation in `system-map.md`, `repos/`, `contracts/`, `decisions/`, and reports anything shaped like `[x@y]` that isn't a valid citation as `BAD_CITATION`. Also checks that `teamDocs` exist (`TEAM_DOC_MISSING`) and that an in-repo KB's entries share its git repo (`IN_REPO_SPLIT`). | For each code citation: `git -C <repo> cat-file -e <sha>^{commit}`, then `git -C <repo> show <sha>:<path>`, then check the line range exists. In-repo citations: open `<git root>/<path>` and check the lines. Non-code citations must match the two forms above. |
| `show <kb> "<citation>" [context]` (brackets optional) | Prints the cited lines with context. | `git -C <repo> show <sha>:<path>` (in-repo: read `<git root>/<path>`) and read the lines. |
| `stale <kb> [--no-fetch]` | Compares `syncedSha` with the remote default branch and lists the KB files that cite changed files. | `git -C <repo> fetch origin <branch>`, then `git -C <repo> diff --name-only --no-renames <syncedSha> origin/<branch>`. `--no-renames` makes renamed files appear under their old path too. Then search the KB fact files and `teamDocs` for citations or mentions of those paths. **In-repo KB:** for each KB file without uncommitted edits, `git log -1 --format=%H -- <kb file>`, then `git diff --name-only --no-renames <that sha> HEAD -- <cited or mentioned paths>`. Any output means that KB file is stale. |
| `rules <kb>` | Compares the KB's `rulesVersion` with this kbee's, and lists the newer changelog entries. Run as `rules` with no KB, it prints only `{"currentRulesVersion": N}`. | A missing `rulesVersion` means v1. The current version is the highest `## vN` in `rules-changelog.md`. |
| `set-rules <kb> <version>` | Records an upgrade to a rules version. It never goes backwards. | Edit `rulesVersion` in `manifest.json`. |
| `set-synced <kb> <repo> <sha>` | Records a verified sync, and refuses a SHA that doesn't descend from the current `syncedSha`. | Check `git -C <repo> merge-base --is-ancestor <syncedSha> <sha>` succeeds, then edit `manifest.json`: set `syncedSha` to the full SHA and `syncedAt` to the current ISO time. |

# Acceptance run

The automated tests check the helper and that each skill *states* its required behavior. Whether an agent actually *follows* the skills can only be checked by running them. Do this per agent before a release, and for any agent affected by a skill change.

## Setup

```bash
WS=$(mktemp -d)
for r in shop-types shop-api shop-web; do
  cp -R examples/fixtures/$r "$WS/$r"
  git -C "$WS/$r" init -q -b main
  git -C "$WS/$r" add -A
  git -C "$WS/$r" commit -qm initial
done
npx skills add <path to this repo> -a <agent> -y   # or install from GitHub
```

Open the agent in `$WS`.

## Checklist

| # | Do | Pass when |
|---|----|-----------|
| 1 | Run `kbee-init` with the three local repo paths. | It asks new-vs-existing, scans, and shows **one** summary. After a yes, `$WS/shop-kb` exists and `node shared/scripts/kbee-tool.mjs validate $WS/shop-kb` reports no errors. It asks before any push, and offers the pointer per repo. |
| 2 | Compare the result with `examples/expected-kb`. | It finds the orders API contract (producer shop-api, consumer shop-web) and the order types (producer shop-types, consumers shop-api and shop-web). Its depth is roughly the same, not much thinner or padded. |
| 3 | Ask `kbee-kb`: "which repos consume POST /orders?" | The answer is shop-web, with a citation into `shop-web/src/api.ts`. |
| 4 | Ask `kbee-kb`: "what database does shop-api use?" | It says it doesn't know (orders are in memory) and doesn't invent a database. |
| 5 | Run `kbee-feature`: "add order cancellation". | It pauses after Spec and after Plan. The spec lists all three repos. The plan orders shop-types, then shop-api, then shop-web. Branches `kbee/<slug>` exist in all three, with tests. `review.md` exists. It asks before pushing. |
| 6 | Commit a change to `shop-api/src/orders.ts` on main, then run any kbee skill. | The gap check flags shop-api as stale and lists the KB files that cite `src/orders.ts`. |
| 7 | Run `kbee-sync` after merging the feature branch into main in each repo. | It proposes KB fact updates from `pending.md`, writes only after a yes, and updates `syncedSha`. |
| 8a | `/kbee build "add order cancellation"` in a workspace with **no KB**. | It sets up the KB first (step 1), then continues into the build without asking you to start again. |
| 8b | `/kbee build SHOP-1` with **no Jira connection**. | One line saying Jira isn't connected, then it asks you to paste the ticket, and continues. |
| 8c | `/kbee build <real ticket>` with Jira connected. | The spec uses the ticket's acceptance criteria and cites `[source: <ticket url>]`. Before the PRs, it asks once about pushing and about posting to the ticket. The ticket status is unchanged. |
| 9 | Run with Node unavailable (for example `PATH` without node). | Steps 1 and 6 still work through the manual git fallbacks. |

### Monorepo and audit

Build a monorepo from the same fixtures, with the hand-written KB from `examples/fixtures/shop-legacy-kb` at its root:

```bash
MONO=$(mktemp -d)/shop
mkdir -p "$MONO/apps" "$MONO/packages"
cp -R examples/fixtures/shop-api "$MONO/apps/api"
cp -R examples/fixtures/shop-web "$MONO/apps/web"
cp -R examples/fixtures/shop-types "$MONO/packages/types"
cp -R examples/fixtures/shop-legacy-kb "$MONO/kb"
git -C "$MONO" init -q -b main && git -C "$MONO" add -A && git -C "$MONO" commit -qm initial
```

Open the agent in `$MONO`. For 10d, build a second copy without the `kb` line. The legacy KB has two planted errors, so don't tell the agent about them: it claims orders are stored in Postgres, and it points at `apps/api/src/db/orders.sql`, which doesn't exist.

| # | Do | Pass when |
|---|----|-----------|
| 10a | `/kbee audit` | It finds `kb/` without being told where. One report flags "orders are stored in Postgres" as wrong (orders are in memory, cited) and `apps/api/src/db/orders.sql` as missing, then asks once: rewrite, or keep and add alongside. Nothing is written before the yes. |
| 10b | Answer **keep**. | `git diff --stat` shows the four original files unchanged, except an approved link to `system-map.md` and any approved fixes. `kb/manifest.json` has `"location": "in-repo"` and lists the team docs in `teamDocs`. `validate` is clean. |
| 10c | Reset, run 10a again, and answer **rewrite**. | `kb/` follows kbee's layout. The walkthrough survives under `kb/flows/`, linked from `system-map.md`. `validate` is clean. |
| 10d | `/kbee init` in the monorepo without `kb/`. | It treats `apps/api`, `apps/web`, `packages/types` as entries, **asks** where the KB goes, and suggests `kb/` inside the repo. Citations have no commit. |
| 10f | In a second copy without `kb/`, write only `kb/manifest.json` (`kbeeVersion` 1, `"location": "in-repo"`, entries `shop-types` → `../packages/types`, `shop-api` → `../apps/api`, `shop-web` → `../apps/web`, `syncedSha` null), commit it, then `/kbee init`. | `find` reports `"skeleton": true`. It doesn't ask new-or-join, where the KB goes, or for repo links. It builds the KB in `kb/` keeping the three entries' names, `pathHint`s and order, sets `rulesVersion`, and `validate` is clean. `/kbee audit` on the same skeleton hands over to init instead of listing missing files. |
| 10e | After 10b, `/kbee build "add order cancellation"`. | The spec stage creates `kbee/order-cancellation` and commits the feature records there. The plan orders packages types → api → web. Build makes **one** branch, and ship proposes **one** PR. The pre-push summary lists the KB changes, and the PR contains them. No `pending.md`. |

## Results

| Date | Agent and version | Steps passed | Notes |
|------|-------------------|--------------|-------|
| 2026-10-18 | Claude Code 2.1.302 (Sonnet, headless `-p`, approvals given up front) | 1, 3, 4 | Init: `validate` clean, one commit, no push, code repos untouched. Contracts and citations spot-checked correct, and it found an extra real gap (no status transitions). The `url` fields are null because the fixtures have no remotes. Steps 2, 5–8 not run yet. |

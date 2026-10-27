# Skills reference

**Most people only ever type `/kbee`.** It runs the right skill below for you. This page is for when you want to know what's happening underneath, or to run one stage on its own.

Invoke a skill by name in plain language ("use kbee-feature to …"), or as a slash command (`/kbee-feature`) in agents that support them. Most people only use the first three skills. The stage skills run inside `kbee-feature`, but you can run any of them on its own.

Every skill follows the same three rules:

1. **It reads the KB first** and checks for stale repos.
2. **Facts need your yes**, while bookkeeping is saved automatically.
3. **Pushes always need your yes.**

---

## kbee

The one command.

| You type | It runs |
|----------|---------|
| `/kbee build PROJ-123`, `/kbee build "<requirements>"`, `/kbee build <figma link>` | **kbee-feature**, setting up the KB first if there isn't one |
| `/kbee init` | **kbee-init** |
| `/kbee audit` | **kbee-audit** |
| `/kbee ask "<question>"` | **kbee-kb** (Ask) |
| `/kbee add <repo>`, "document X" | **kbee-kb** |
| `/kbee sync` | **kbee-sync** |
| `/kbee` | Status: the KB, stale repos, unfinished features, and the next step |

You're asked to review three times: the spec, the plan, and before the PRs open.

## kbee-init

Sets up a knowledge base, or joins an existing one.

- **Asks:** new or existing KB, where to put it, and your repo links. For a monorepo it also asks whether to treat each package separately.
- **Writes:** the whole KB (see [Knowledge base format](kb-format.md)). If you allow it, it also adds a pointer block to each code repo's `AGENTS.md`.
- **You approve:** one summary of the whole KB, the push, and each pointer.
- **Joining an existing KB:** it clones or finds the listed repos, records your local paths in `.kbee.local.json`, and reports what's stale. It doesn't rebuild anything.
- **A skeleton KB** (a `manifest.json` with no facts yet, for example one a project scaffolder pre-filled with an entry per package): it doesn't ask new or existing, where, or which repos. It builds the KB in place from the manifest's entries. See [Pre-filling a KB from a scaffolder](kb-format.md#pre-filling-a-kb-from-a-scaffolder).

**Example prompts:** "set up kbee for these repos: …", "join our KB at git@github.com:acme/shop-kb.git".

## kbee-audit

Adopts a knowledge base you already have, whatever its format, and fixes it so kbee can use it.

- **Finds:** a kbee KB, a hand-written one (for example a `kb/` folder at the root of a monorepo, or a separate docs repo), or knowledge scattered across READMEs, `CLAUDE.md` and `AGENTS.md`. If there's only scattered knowledge, it hands over to **kbee-init** with those docs as sources.
- **Checks** it against the code: what's covered, what's missing, which claims are wrong (each one verified), and what kbee needs that isn't there.
- **Asks once:** after one report, whether to **rewrite** your KB into kbee's layout, or **keep** your files and add kbee's files alongside them. Keeping is the safe choice: your files stay exactly as they are, and kbee keeps them up to date from then on, with your yes for each change.
- **For a kbee KB**, it's a health check: stale repos go through **kbee-sync**, outdated rules through its upgrade mode.

**Example prompts:** "/kbee audit", "check our kb folder and make it work with kbee", "is our knowledge base still right?".

## kbee-feature

Runs the whole flow: Spec, then a pause for your approval, then Plan, then another pause, then Build, Review and Ship, with Sync after every stage.

- **Resumes** unfinished features from `features/<slug>/status.json`.
- **Stops on its own** only for:
  - the two approvals
  - a dirty working tree
  - destructive steps
  - a plan that's badly wrong
  - 3 review rounds that still have blocking findings
  - the push

**Example prompts:** "kbee-feature: let customers cancel unpaid orders", "resume the order-cancellation feature".

## kbee-kb

Your interface to the KB itself. It has four intents:

| Intent | Example | What happens |
|--------|---------|--------------|
| Ask | "which repos read the orders table?" | It answers with citations. If neither the KB nor the code knows, it says "I don't know" and logs a gap. |
| Expand | "document how auth works across repos" | It researches the code, drafts cited text, verifies it, and shows you. It writes on your yes. |
| Add a repo | "add ../shop-worker to the KB" | It scans the repo and proposes `repos/shop-worker/` plus system map and contract updates. |
| Fix | "the KB is wrong about the API port" | It checks your correction against the code, then proposes the fix. |

## kbee-spec

**Stage 1.** Turns a Jira ticket, a Figma design, a GitHub issue, or plain text into `features/<slug>/spec.md`. Tickets and designs are fetched through your agent's connected tools (see [Jira and Figma](integrations.md)), or you can paste them in. The spec contains:

- the problem
- testable acceptance criteria
- the affected repos
- the contracts touched, with every consumer of each
- what's out of scope
- open questions

It asks you questions only where the idea is ambiguous. The slug comes from the title, for example `order-cancellation`.

## kbee-plan

**Stage 2.** It needs an approved spec. It writes `plan.md` with tasks grouped per repo and a dependency order across repos (producers before consumers). Each task names its test. If it finds a consumer the spec missed, it flags it.

## kbee-implement

**Stage 3.** It needs an approved plan. In each repo it:

1. checks the working tree is clean
2. updates the default branch
3. creates `kbee/<slug>`
4. builds test-first, one repo at a time: failing test, smallest fix, full suite, commit

Any changes to the plan are written into `plan.md`. **It never pushes.**

## kbee-review

**Stage 4.** It checks:

- each acceptance criterion has code and a test
- bugs
- the repo's conventions
- a fresh test run
- **every changed contract against every consumer** in the KB

It writes `review.md`, with findings marked blocking or non-blocking. Blocking findings send the feature back to Build.

## kbee-ship

**Stage 5.** It shows you the branches, the PR titles and the merge order, and asks **once**. If the work came from a ticket, it also offers to post the PR links on it (it never changes the ticket's status unless you ask). Then it pushes and opens a PR per repo, cross-linked to each other. Without `gh`, it pushes and gives you ready-to-paste PR descriptions. It never merges or deploys.

## kbee-sync

Keeps the KB true to each repo's default branch.

- **Feature mode** runs at the end of each stage. It records the planned KB changes in `features/<slug>/pending.md`, never in the facts themselves.
- **Merge mode** runs when you ask, or after PRs merge. It:
  1. finds merged features and changed code
  2. rereads it and verifies the new text
  3. shows you the changes
  4. writes them on your yes
  5. records the new synced commit

  If you decline a change, that repo stays marked stale, so the outdated fact keeps getting flagged. If the network is down, it won't update facts at all.
- **Upgrade mode** runs when your KB was built with older kbee rules. Every skill tells you when that's the case. It applies only the new passes from the [rules changelog](../shared/references/rules-changelog.md) to your existing KB, for example adding data flow or field-level contracts. It shows you the changes grouped by pass, writes what you approve, and records the new `rulesVersion`.

  **Example prompt:** "kbee-sync: upgrade the KB to the latest rules".

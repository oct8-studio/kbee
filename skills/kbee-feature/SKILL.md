---
name: kbee-feature
description: Take a feature from a Jira ticket, Figma design, or plain-text idea to cross-linked pull requests across all affected repos - spec, plan, build, review, ship, and KB sync - using the kbee knowledge base. Pauses for approval after the spec and after the plan. Use when the user says "build this feature", "kbee feature", "add X across our repos", or wants to resume a kbee feature.
---

# kbee-feature

Runs the six kbee stages in order. Each stage has its own skill. If a stage skill isn't installed as a skill in your agent, read its steps from the sibling folder (`../kbee-spec/SKILL.md` and so on) and follow them.

| Stage | Skill | Output |
|-------|-------|--------|
| 1. Spec | **kbee-spec** | `features/<slug>/spec.md` |
| 2. Plan | **kbee-plan** | `features/<slug>/plan.md` |
| 3. Build | **kbee-implement** | branches `kbee/<slug>` with tested commits |
| 4. Review | **kbee-review** | `features/<slug>/review.md` |
| 5. Ship | **kbee-ship** | cross-linked PRs |
| 6. Sync | **kbee-sync** | KB kept true (runs at the end of every stage) |

Progress lives in `features/<slug>/status.json` ([references/kb-layout.md](references/kb-layout.md)). Approvals follow [references/approval-rules.md](references/approval-rules.md).


`<skill-dir>` below is the folder containing this SKILL.md. If Node is not available, use the manual fallbacks in `references/accuracy-rules.md`.
## 0. Find the KB and check it

- Find the KB ([references/kb-discovery.md](references/kb-discovery.md)). If there's **no KB**, or only a **skeleton** (`find` reports `"skeleton": true`), say so, offer **kbee-init** (which builds a skeleton in place), and stop.
- Run the gap check: `node <skill-dir>/scripts/kbee-tool.mjs stale <kb>` (without Node, use the manual fallback in [references/accuracy-rules.md](references/accuracy-rules.md)). Report stale or missing repos in one or two lines, and offer **kbee-sync** before starting.
- Run `node <skill-dir>/scripts/kbee-tool.mjs rules <kb>`. If the KB was built with older kbee rules, mention it once and offer the **kbee-sync** upgrade mode. Don't block on it.

## 1. New feature, or resume?

Check `features/*/status.json` for features whose `stage` isn't `done`. For an **in-repo** KB, feature records live on their branches: also list local and remote `kbee/*` branches and read each one's `features/<slug>/status.json` with `git show` (see `references/kb-layout.md`). A `shipped` record that's on the default branch is done (it merged). Otherwise check the PR state (`gh pr view <url> --json state`).

- If the user names one, or there's exactly one that matches what they asked, **resume** it from its `stage`: `spec` without `approved.spec` goes to the spec approval pause, `spec` with approval goes to Plan, `plan` without `approved.plan` goes to the plan approval pause, and so on.
- Otherwise start a new feature at Spec.

## 2. Spec, then pause

Run **kbee-spec** with whatever the user gave you: a Jira ticket ID or URL, a Figma link, a GitHub issue, plain-text requirements, or a mix. kbee-spec fetches tickets and designs through the agent's connected tools. Then **pause** and show the user:

- the acceptance criteria
- the affected repos and contracts
- any open questions

Ask: *"Is this spec right?"* Apply any changes they ask for. On a yes, set `approved.spec: true`. Don't continue without it.

## 3. Plan, then pause

Run **kbee-plan**. Then **pause** and show the user the repo order and the task list.

Ask: *"Good to build?"* On a yes, set `approved.plan: true`.

These two pauses, after Spec and after Plan, are the only check-ins before shipping. From here on, run without stopping, except for the cases below.

## 4. Build and review

1. Run **kbee-implement**.
2. Run **kbee-review**.
3. If the review has blocking findings, run **kbee-implement** again with those findings, then **kbee-review** again. After 3 rounds that still have blocking findings, stop and ask the user how to proceed.

Stop and ask during build only for:

- a dirty working tree
- a destructive or irreversible step
- a plan so wrong that every way forward is a guess

## 5. Ship

Run **kbee-ship**. It asks once before pushing and opening PRs.

## 6. Wrap up

- Make sure **kbee-sync** feature mode has recorded `pending.md` (separate KB), or written the verified KB changes on the branch (in-repo KB).
- Give the user a summary:
  - the PR links, in merge order
  - what changed in each repo
  - any changes made to the plan during the build
  - which KB changes are pending until merge, or, for an in-repo KB, which KB changes are in the PR
- **Separate KB:** tell them that after the PRs merge, running **kbee-sync** folds the changes into the KB. Mark the feature `done` at that point, not before.
- **In-repo KB:** the docs merge with the code. The feature stays `shipped` and counts as done once its record is on the default branch.

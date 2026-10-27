# Agents and setup

kbee is a set of [Agent Skills](https://agentskills.io): plain `SKILL.md` folders that many coding agents load. The `skills` CLI copies them into the right place for each agent.

## Installing

```bash
# interactive: pick your agents
npx skills add oct8-studio/kbee

# name the agents yourself
npx skills add oct8-studio/kbee -a claude-code codex cursor github-copilot gemini-cli

# for your user account instead of this project
npx skills add oct8-studio/kbee -g

# see what's in the package without installing
npx skills add oct8-studio/kbee --list

# update later
npx skills update
```

Install all 11 skills: `kbee`, `kbee-audit`, `kbee-feature`, `kbee-implement`, `kbee-init`, `kbee-kb`, `kbee-plan`, `kbee-review`, `kbee-ship`, `kbee-spec` and `kbee-sync`. `kbee` and `kbee-feature` call the other skills by name. If one is missing, they read that skill's steps from the sibling folder.

## Tested agents

| Agent | `-a` name | Notes |
|-------|-----------|-------|
| Claude Code | `claude-code` | Supports slash commands (`/kbee-init`). Scans run in parallel on a fast model, and the KB is written on a strong one. |
| Codex | `codex` | |
| Cursor | `cursor` | |
| GitHub Copilot | `github-copilot` | |

Other agents in the `skills` CLI list (for example `gemini-cli`, `windsurf`, `opencode`) should work, but aren't part of the release checks yet. Reports are welcome. See [acceptance.md](acceptance.md).

## What changes between agents

| Capability | With it | Without it |
|------------|---------|------------|
| Subagents and model choice | Repos are scanned in parallel on a fast, cheap model, and the KB is written on a strong one. | Repos are scanned one after another on the current model. Same result, just slower. |
| Slash commands | `/kbee-feature` | Just ask: "use kbee-feature to …" |
| Skill support at all | Everything works. | Accept the **pointer** during init. An agent without skill support still finds the KB through `AGENTS.md` and can follow the rules in the KB's `README.md`, but the guided flows aren't available. |

## Optional tools

**Node.js 18 or later.** This enables the bundled helper, `kbee-tool.mjs`, inside each skill's `scripts/` folder:

| Command | Does |
|---------|------|
| `find [dir]` | Locates the KB, and says whether it's a `skeleton` (a manifest with no facts yet). |
| `resolve <kb> <repo>` | Gives a repo's local path. |
| `validate <kb>` | Checks every citation. |
| `show <kb> "<citation>"` | Prints the cited lines. |
| `stale <kb> [--no-fetch]` | Lists out-of-date repos and the KB files affected. |
| `set-synced <kb> <repo> <sha>` | Records a verified sync. |
| `rules [kb]` | Checks whether the KB was built with older kbee rules. Without a KB, prints the current rules version. |
| `set-rules <kb> <version>` | Records a rules upgrade. |

Without Node, the skills tell the agent how to do each step with plain git. It's slower, but works the same.

**GitHub CLI (`gh`).** With it, kbee opens and cross-links PRs itself. Without it, kbee still pushes, after asking, and gives you PR descriptions to paste.

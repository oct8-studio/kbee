---
name: kbee
description: The one kbee command. "/kbee build <Jira ticket | Figma link | plain-text requirements>" takes a feature from ticket or idea to reviewed, cross-linked PRs across all repos; "/kbee init" sets up the knowledge base; "/kbee audit" adopts and fixes an existing one; "/kbee ask" queries it; "/kbee sync" keeps it current. Use whenever the user says kbee, gives a ticket ID like PROJ-123 to build, or asks to build, ship, or set up something with kbee.
---

# kbee

This is the only command users need. Work out what they want, then follow the matching skill. If a skill isn't installed as a skill in your agent, read its steps from the sibling folder (`../kbee-feature/SKILL.md` and so on) and follow them exactly.

| The user says | Do |
|---------------|-----|
| `/kbee build <anything>` (also "build", "implement", "ship this", a bare ticket ID or link) | **kbee-feature**, passing their input as the feature source |
| `/kbee init` ("set up", "connect my repos", "join our KB") | **kbee-init** |
| `/kbee audit` ("check our KB", "use our existing docs", "is our KB any good") | **kbee-audit** |
| `/kbee ask <question>` (any question about how the system works) | **kbee-kb**, Ask intent |
| `/kbee add <repo>`, "document X", "the KB is wrong about Y" | **kbee-kb** |
| `/kbee sync` ("update the KB", "upgrade the KB", "PRs merged") | **kbee-sync** |
| `/kbee` alone, or "status" | Show the KB location, stale repos, unfinished features from `features/*/status.json` (for an in-repo KB, also from the `kbee/*` branches, see `references/kb-layout.md`), and whether the rules are outdated. Then offer the next step |

If there's **no KB** yet and the user asked to build, say so in one line, set one up first, then continue with the build. Don't make them start over. A **skeleton** KB (`find` reports `"skeleton": true`: a manifest a project scaffolder pre-filled, with no fact files yet) counts as no KB: run **kbee-init**, which builds it in place without asking new or join. Do the same for `/kbee`, `/kbee audit`, `/kbee ask` and `/kbee sync` on a skeleton. If `find` lists a **foreign** KB (a hand-written one without a kbee manifest), set it up with **kbee-audit**. Otherwise use **kbee-init**.

## What `/kbee build` accepts

Work out the input yourself. Don't ask the user what kind it is.

- **A Jira ticket:** an ID like `PROJ-123` (`[A-Z][A-Z0-9]+-\d+`) or an Atlassian URL.
- **A Figma link:** `figma.com/design/…`, `figma.com/file/…`, or a FigJam link.
- **A GitHub issue or other ticket URL.**
- **Plain text:** the requirements written out, as short or long as the user likes.
- **A mix** of these, for example a ticket plus extra notes.

**kbee-spec** says how to fetch each source.

## What the user sees

Keep it to the minimum. They're asked to review **three times**, and only three:

1. **The spec:** "Is this what we're building?"
2. **The plan:** "Good to build?"
3. **Before pushing:** "Open these PRs?" (and, if there's a ticket, "Post the PR links to PROJ-123?")

Everything else runs without questions, except the safety stops in **kbee-feature** (a dirty working tree, destructive steps, or a broken plan). Between stages, post one short progress line, such as "Spec ready", "Building shop-api (2/3)", or "Review passed". Don't post walls of text.

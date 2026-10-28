<!-- generated from shared/references/kb-discovery.md; edit the source, then run npm run sync -->
# Finding the KB

Search in this order, and stop at the first folder whose `manifest.json` is valid (it has `"kbeeVersion": 1` and a `repos` list):

1. The current folder and each of its parent folders.
2. **`<git root>/kb`**: an in-repo KB in a folder named `kb` at the root of the current git repo, even when you're deep inside a package. Also the other places **kbee-audit** adopts a team's KB (`docs/kb`, `knowledge`, `wiki`, `docs/architecture` and similar), and a `kbee/` subfolder of any of them.
3. A **pointer block** in `AGENTS.md` or `CLAUDE.md` at the root of the current git repo. Its path is relative to that repo root:

   ```
   <!-- kbee:start -->
   kbee-kb-path: ../shop-kb
   <!-- kbee:end -->
   ```

4. Folders next to the current git repo's root (siblings), for example `../shop-kb`.

`node <skill-dir>/scripts/kbee-tool.mjs find` does all four steps. Its `foreign` list holds folders that look like a hand-written KB without a kbee manifest (`kb/`, `docs/kb/`, `knowledge/`, `wiki/`, `docs/architecture/` and similar, with at least two Markdown files).

If the user names a KB path or URL, use that instead.

## Skeleton KBs

A **skeleton** is a valid `manifest.json` with no fact files yet: no `system-map.md`, and nothing under `repos/`, `contracts/` or `decisions/`. Project scaffolders write one, pre-filled with an entry per package, so kbee knows the repos before anyone runs it. `find` reports it as `"skeleton": true`.

A skeleton is not a KB to read yet. Treat it like **no KB**, except that **kbee-init** builds it in place from the manifest's entries, without asking where it goes or which repos it covers.

## Nothing found

If no KB is found but there's a **foreign** KB (from `find`, or one you spot yourself), say so in one line and offer **kbee-audit**, which adopts it. Otherwise say there's no KB and offer **kbee-init**. Never invent a KB, and never write KB files outside a real KB folder.

## Pointer block

`kbee-init` offers to add this block to each code repo, **only with permission**. The full snippet is in `templates/pointer-snippet.md`.

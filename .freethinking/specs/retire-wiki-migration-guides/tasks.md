# Implementation Plan

## Overview

The guide is built in place, one task at a time, because every guide task edits `MIGRATION.md`: first the 3.x content is moved under its new headings with the intro, then the 2.x details are written and checked, then the 2.x prompt is written from them. The README and the link-check change touch other files and run beside the first guide task. `llms.txt` waits for the guide's final headings. The last task runs the full check. Docs are tested by the existing `test/docs.test.ts` link, anchor and README-shape checks, extended to `MIGRATION.md`, and each 4.x example is checked by a scratch run against `dist/`. Turning the wiki off (Requirement 8.2) happens after the pull request merges, outside this run; see Notes.

## Tasks

- [x] 1. The migration guide
  - [x] 1.1 Restructure `MIGRATION.md` for both paths: keep `# Migrating to v4`; replace the intro with one paragraph per path, telling the reader to follow "Upgrading from 3.x" when `package.json` names 3.x and "Upgrading from 2.x" when it names 2.x or older; move the current "Convert your templates with an AI assistant" section to straight after the intro as `## AI prompt for 3.x templates`, its text and ten rules unchanged; leave a `## AI prompt for 2.x code` heading after it with one line saying the prompt follows in this change; put every current difference section under `## Upgrading from 3.x`, each demoted from `##` to `###` (and `### Reserved fields` to `####`), text unchanged; rename "What stays the same" to `### What stays the same from 3.x`; add an empty `## Upgrading from 2.x` at the end; every heading's slug unique; confirm with a diff, headings normalised, that no 3.x sentence changed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.1, 5.2_
  - [x] 1.2 Write the `## Upgrading from 2.x` sections in `MIGRATION.md`, each a `###` with a before from tag `2.0.1` (`git show 2.0.1:lib/render.js`, `git show 2.0.1:bin/inline-email`, `git show 2.0.1:README.md`) and an after from the current build: "Node.js 22 and ESM", "lib/render becomes inlineEmailHtml", "The --inky flag and Inky markup", "Linked stylesheets are no longer read", "Images are not inlined by default", "Double braces are template syntax", "Styles in the HTML when --css is given", and "What stays the same from 2.x"; run every after example against `dist/` with a scratch script and show its real output, correcting any section the run contradicts; say where 2.x behaviour has no 4.x equivalent and name the nearest alternative (layout tags or a `transform` for Inky, `--css` or `juice.webResources.links` for linked stylesheets)
    - **Property 1: Every example is real**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x] 1.3 Write `## AI prompt for 2.x code` in `MIGRATION.md`, in the shape of the 3.x prompt: one paragraph telling the reader to paste every CLI call from their scripts and every file that requires `inline-email/lib/render`, then a `text` block that states the upgrade, gives one numbered rule per `###` section under "Upgrading from 2.x" except "What stays the same from 2.x", tells the assistant to list each Inky tag with its nearest 4.x layout tag and ask before replacing it, to treat any `{{` in the HTML as a question, to leave working code unchanged and change nothing else, and to return each file in full followed by its changes with rule numbers and one-line reasons, then its questions; check each rule against its section
    - **Property 3: One rule per difference**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 2. README and index
  - [x] 2.1 Edit `README.md`: delete the Library API, Template Syntax, Responsive Layout Tags, Compile Transforms and CLI sections; replace the "Upgrading from 3.x?" callout and the v2 wiki line with one line under the Docs_Line linking `MIGRATION.md` for users on 2.x or 3.x and saying it starts with a prompt to paste into an AI assistant; leave every other section unchanged; `npx vitest run test/docs.test.ts` passes without changing a check
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 8.1_
  - [x] 2.2 Edit `llms.txt`: replace the "Migration guide" entry with one that says it covers 2.x and 3.x to 4.x, and add one entry per prompt linking `MIGRATION.md#ai-prompt-for-3x-templates` and `MIGRATION.md#ai-prompt-for-2x-code` by the absolute GitHub URL; stay within the 60-line limit; `npx vitest run test/docs.test.ts` passes
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Tests and final check
  - [x] 3.1 Add `MIGRATION.md` to the link-check `it.each` list in `test/docs.test.ts`, beside the README, guides, reference and `llms.txt`
    - **Property 2: Every link and anchor resolves**
    - **Validates: Requirements 7.3**
  - [x] 3.2 Run `npm run check`; confirm `grep -rn wiki` finds no link to the wiki outside `.freethinking/specs/` (the Code of Conduct's word "wiki" is not a link), no file under `src/` changed, and `npm pack --dry-run` still lists `MIGRATION.md` and `llms.txt`
    - _Requirements: 6.5, 7.3, 8.1_

## Notes

- Write plain prose in the style of the current `MIGRATION.md`: one sentence per line, "Before:" and "After:" labels, `sh`, `js`, `html` and `text` fences.
- 4.x examples use `import`, never `require`. 2.x examples use `require`, as 2.x did.
- An after example must show what the current build prints; build with `npm run build` first. Put scratch scripts in the session scratchpad and delete them.
- GitHub slugs drop dots: `## AI prompt for 3.x templates` is `#ai-prompt-for-3x-templates`. The docs test's `headingSlugs` decides; check with it.
- Touch nothing under `src/`. A defect found while writing, such as `@media` rules passed through `css` being dropped, goes in the task's summary for a separate issue, not into this change.
- Node is at `$HOME/.nvm/versions/node/v24.12.0/bin`.
- After the pull request merges, the author turns the wiki off with `gh api -X PATCH repos/freethinkingit/inline-email -f has_wiki=false` and confirms `gh api repos/freethinkingit/inline-email --jq .has_wiki` prints `false` (Requirements 8.2, 8.3). It is not a task here because the run hands off to `pr` before the merge.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["3.2"] }
  ]
}
```

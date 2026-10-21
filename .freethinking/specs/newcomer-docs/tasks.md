# Implementation Plan

## Overview

The plan builds from the inside out: the alias and metadata first, then the runnable guide examples, then the tests that run them and the pages that quote them, then the README that links everything, then the discovery file and the documentation-shape test that locks the whole set, and last the metadata commands the author runs by hand and the final checks. Every page is written after the files it quotes exist, so no page ever names a file that is not there.

Tests are vitest, in the repository's existing style. Two test files are implementation tasks rather than optional ones, because the requirements make the suite the thing that keeps the guides true: `test/guides.test.ts` runs every guide example (Requirement 2.3) and `test/docs.test.ts` keeps pages and files in step (Requirements 2.2, 2.7, 1.7, 5.3). The transactional guide's own `welcome.test.ts` is part of its example, since the guide teaches strict mode in tests.

## Tasks

- [x] 1. Wiring and metadata
  - [x] 1.1 Add `vitest.config.ts` with a single `resolve.alias` mapping `inline-email` to `./src/index.ts`; confirm with an ephemeral test file importing `from 'inline-email'` that the alias resolves under vitest, and with a scratch `.mjs` run by `node` after `npm run build` that package self-reference resolves `import 'inline-email'` to `dist/index.js`; confirm the existing suite still passes
    - _Requirements: 2.3, 6.2_
  - [x] 1.2 In `package.json`, set `description` to "Compile HTML and CSS into email-safe templates and render them with Handlebars per send. Node library and CLI.", set `keywords` to `email`, `html-email`, `email-templates`, `transactional-email`, `handlebars`, `juice`, `css-inlining`, `responsive-email`, `cli`, set `homepage` to `https://github.com/freethinkingit/inline-email#readme`, and add `llms.txt` to `files`; confirm `npm pack --dry-run` lists `llms.txt` once the file exists (task 5.1) or warns until then
    - _Requirements: 4.1, 4.2, 4.3, 5.3_

- [x] 2. Guide examples under `examples/guides/`
  - [x] 2.1 Create `examples/guides/quickstart/welcome.html` (a short template with a variable, a `{{#items}}` block and a `{{slot:summary}}`, using layout tags) and `send.mjs` (imports `compileEmailTemplate` from `'inline-email'`, compiles with a subject and text, renders with data and a slot, prints the `{ subject, html, text }` as JSON); run it with `node` after a build and confirm the output
    - _Requirements: 1.3, 2.2_
  - [x] 2.2 Create `examples/guides/transactional/welcome.html`, `shared.css` (a few rules the template uses), `send.mjs` (compile once with `strict: true`, render per user with a trusted `summary` slot, print JSON) and `welcome.test.ts` (vitest: compiles with `strict: true`, asserts a full render contains the name and the slot HTML, asserts a render missing `firstName` throws `/"firstName" not defined/`, asserts the slot content is inserted raw and a variable with `<b>` is escaped); run the test file and the script
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.3 Create `examples/guides/cli-preview/email.html`, `email.css` and `data.json` (an order-confirmation with an `{{#each items}}` table and a `{{#if discount}}` line; data with three items and a discount); run `node dist/cli.js examples/guides/cli-preview/email.html --css examples/guides/cli-preview/email.css --data examples/guides/cli-preview/data.json --strict` after a build and confirm the rendered HTML has the items and no placeholders, and that removing a field from a copy of the data makes the run fail with `not defined`
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 2.4 Create `examples/guides/marketing/launch.html` (uses `{{shout headline}}`, `{{badge plan}}`, `{{> signature}}` and `<img src="logo.png">`), a `logo.png` under 5 KB, and `send.mjs` (registers `shout` returning upper case and `badge` returning a `Handlebars.SafeString` built with `Handlebars.escapeExpression`, a `signature` partial, compiles with `juice: { webResources: { images: true, relativeTo } }`, renders, prints JSON); run it and confirm the html has `data:image/png;base64`, the shouted text, the badge markup unescaped and the partial's text
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.5 Create `examples/guides/digest/digest.html` (heading, `{{#if rows.length}}` with a table of `{{#each rows}}` rows showing `@index`, title, owner, `{{formatNumber count}}` and a `<panel tone="{{tone}}">` for `done` rows, an `{{else}}` empty state, and a total line), `data.json` with twelve rows and a total, and `send.mjs` (registers `formatNumber` using `Intl.NumberFormat`, compiles, renders, prints JSON); add a "Guides" entry for it to `scripts/render-examples.js` that reads `data.json`; run the script and `npm run examples` and confirm the gallery shows the digest
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 3. Tests that run the guide examples
  - [x] 3.1 Write `test/guides.test.ts`: runs `quickstart/send.mjs`, `marketing/send.mjs` and `digest/send.mjs` as `node` child processes (after the build the suite already assumes), parses their JSON and asserts the behaviour each guide claims (name and slot HTML in the quickstart; `data:image/png;base64`, shouted text, raw badge and partial text in marketing; at least ten `<tr>` rows, the formatted total and no empty state in the digest, and the empty state when `rows` is `[]` by rendering the template directly); runs the CLI guide through `main()` from `src/cli.ts` with `console.log` captured, asserting the items render and a strict run with a field removed rejects with `not defined`; applies the two leak regexes from `test/examples.test.ts` to every rendered html
    - **Property 2: Guide examples render clean**
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [x] 4. Pages
  - [x] 4.1 Create `docs/reference.md`: a table of contents, then the README's Library API (with `juice.webResources`), Template Syntax (with its four subsections), Responsive Layout Tags (with Vanilla Tones and Image-Based Open Analytics), Compile Transforms and CLI sections moved verbatim, each opening sentence adjusted for the new home and relative links repointed; the CLI options block stays a line-for-line copy of `usage()`; do not edit the README in this task
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Write `docs/guides/transactional.md`: the job and time in one sentence, the files from task 2.2 as `file=` blocks in reading order with prose between, how to run the test and what it prints, a closing next step
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 4.3 Write `docs/guides/cli-preview.md`: the files from task 2.3 as `file=` blocks, the exact commands from task 2.3 with `--out preview.html`, what to open, the iterate loop, what `--strict` catches with its error text, a closing next step
    - _Requirements: 2.1, 2.2, 2.4, 2.6_
  - [x] 4.4 Write `docs/guides/marketing.md`: the files from task 2.4 as `file=` blocks, explaining helper escaping and `SafeString`, the partial, `webResources.images` with the size cap and the `strict` opt-in and the placeholder limitation, a closing next step
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 4.5 Write `docs/guides/digest.md`: the files from task 2.5 as `file=` blocks, explaining `{{#each}}` with `@index` and `@last`, `{{#if}}`/`{{else}}` and `{{#unless}}`, the helper, tones per row, and that the digest is in the gallery, a closing next step pointing at the reference
    - _Requirements: 2.1, 2.2, 2.5, 2.6_
  - [x] 4.6 Rewrite `README.md`: keep the title and badges; then the Pitch paragraph in the author's words from Requirement 1.2; a single line linking the four guides, `docs/reference.md` and `MIGRATION.md`; `docs/assets/feature-roundup.png`; the "when to use it" list naming the Library, MJML, React Email and juice in one sentence each; then a Quickstart with `npm install inline-email` and the task 2.1 files as `file=` blocks and the printed result; then Examples (the other three images, `npm run examples`, the integration scripts), one-line pointers under the old Library API, Template Syntax, Responsive Layout Tags, Compile Transforms and CLI headings, and the kept Status, Quality, Development, Release, What This Does Not Do and License sections; at most 220 lines; the `MIGRATION.md` callout stays near the top
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 5. Discovery file and the documentation-shape test
  - [x] 5.1 Write `llms.txt` at the root: `# inline-email`, a one-paragraph summary matching the README's Pitch, then sections `## Docs` (README, the four guides, the reference, `MIGRATION.md`) and `## Package` (the npm page), each line `- [title](absolute GitHub or npm URL): one-line description`; at most 60 lines; confirm `npm pack --dry-run` lists it
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 5.2 Write `test/docs.test.ts`: a checker that reads a markdown file, finds fenced blocks whose info string carries `file=<path>`, and compares each body to the file (trailing newline tolerated), reporting the file and first differing line; apply it to the README and every `docs/guides/*.md`; assert the README is at most 220 lines, that links to the four guides, `docs/reference.md` and `MIGRATION.md` occur within the first 60 lines after the last badge line, and that every relative link in the README, the guides, the reference and `llms.txt` resolves to a file; assert the reference's table of contents anchors match its headings and its CLI block equals `usage()` from `src/cli.ts`; assert `llms.txt` starts with an H1 and is at most 60 lines; include three negative cases for the checker itself (an altered block, a missing path, a 221-line document) built from in-memory strings
    - **Property 1: Guides show real files**
    - **Property 3: Every documentation link resolves**
    - **Validates: Requirements 1.3, 1.6, 1.7, 2.2, 2.7, 3.3, 3.4, 5.1, 5.2, 5.3**

- [x] 6. Metadata by hand and final checks
  - [x] 6.1 The author runs, from the repository: `gh repo edit --description "Compile HTML and CSS into email-safe templates and render them with Handlebars per send. Node library and CLI." --homepage "https://github.com/freethinkingit/inline-email#readme"` and `gh repo edit --add-topic handlebars --add-topic transactional-email --add-topic email-templates --add-topic juice --add-topic css-inlining --remove-topic convert-html-files --remove-topic inky`, then `gh repo view --json description,homepageUrl,repositoryTopics` shows the new values
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 6.2 Run `npm run build`, `npm test`, `npm run examples`, `npm run test:visual` and `npm pack --dry-run`; confirm no file under `src/` changed (`git diff --stat master -- src` is empty), no dependency was added, the five visual snapshots are unchanged, and the tarball lists `llms.txt`
    - _Requirements: 6.1, 6.2, 6.3_

## Notes

- Match the existing style: two-space indent, single quotes, `.js` suffixes on relative imports in `src/`, tests importing `.ts` sources; guide scripts are plain ESM `.mjs` importing `from 'inline-email'`; markdown with one sentence per line is not required, but keep prose plain and the code blocks exact.
- A `file=` block's body must equal the file byte for byte; write the file first, then paste it into the page, never the reverse.
- Do not create a directory named `assets` under `examples/guides/`; `.gitignore` ignores that name.
- Node is at `$HOME/.nvm/versions/node/v24.12.0/bin`; the child-process guide tests need `npm run build` first, as `test/esm-package.test.ts` already does.
- Touch nothing under `src/`. If a guide needs something the library lacks, work around it and record the gap in the task's summary for a follow-up issue.
- Task 6.1 is the author's to run; it changes repository settings, not files.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "4.1"] },
    { "id": 2, "tasks": ["3.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 3, "tasks": ["4.6", "5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["6.1", "6.2"] }
  ]
}
```

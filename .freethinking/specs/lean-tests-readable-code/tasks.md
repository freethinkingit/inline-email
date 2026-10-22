# Implementation Plan

## Overview

The plan builds the guards before it changes anything they guard. The coverage gate and the Behaviour_Record come first, so every later test change is measured against today's Module_Coverage and every later code change against today's behaviour. The linter and shared test support follow, with the community files, which touch no code. Then the tests are slimmed file by file, the style tests moving into their own file first, with Awkward_Input tests marking any Defect as an expected failure. Then the Defects are fixed, and tests are added for the uncovered Paths until coverage reaches 95% of lines and 90% of branches, with the gate raised to match. Then every Code_File is rewritten to read plainly and made lint-clean. Last, the Behaviour_Record is replayed, CI gains the lint step, the contributor docs describe the new commands, and the whole gate runs once more.

Tests are vitest and Playwright, as today. The coverage numbers are the verification for test tasks: each slimming task runs `npm run coverage:module` for its module before and after and reports both. Code tasks are verified by the existing suite, the linter and, at the end, the Behaviour_Record replay.

## Tasks

- [x] 1. Tooling
  - [x] 1.1 Add `@vitest/coverage-v8` at the 4.x line matching vitest as a dev dependency. Configure `test.coverage` in `vitest.config.ts` (`enabled: true`, `provider: 'v8'`, `include: ['src/**']`, `exclude: ['src/types.ts']`). Measure `src/` line and branch coverage on an unchanged suite and set `thresholds` to those numbers rounded down. Add `/coverage` to `.gitignore`. Add `scripts/module-coverage.js <module>` with the design's module-to-test mapping, running those test files alone with coverage limited to the module and thresholds off, plus `"coverage:module"` in `package.json`. Run it for every module and record each line and branch figure in the summary as the baseline; `style` is measured with `compile.test.ts` and `layout.test.ts`. Check the gate: one point above the measured value fails `npm test`, and the measured value passes.
    - **Property 1: Coverage never drops below the gate**
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.7, 9.1, 9.3_
  - [x] 1.2 Add ESLint 10, `@eslint/js`, `typescript-eslint`, `eslint-plugin-jsdoc` and `globals` as dev dependencies with `^` ranges. Write a flat `eslint.config.js`:
    - ignore `dist`, `coverage`, `examples/out` and `test-results`;
    - apply the recommended JS and TypeScript rules to every Code_File, with Node globals for `.js` and `.mjs`;
    - apply `jsdoc/require-jsdoc`, `require-param`, `require-param-description`, `require-returns` and `require-returns-description` to exported functions and classes under `src/` only.

    Add `"lint": "eslint ."` and `"check": "npm run lint && npm run build && npm test && npm run examples"` to `package.json`. Run `npm run lint` and record the full list of findings per file in the summary. Change no Code_File other than the config in this task.
    - _Requirements: 2.1, 2.2, 2.3, 9.3_

- [x] 2. Behaviour_Record
  - [x] 2.1 In the session scratchpad only, compile `src/` with `npx tsc -p tsconfig.json --outDir <scratch>/before`, never `npm run build`. Write a script that imports that build and records every Public_Contract over representative and edge-case inputs into `<scratch>/before.json`, in the design's Data Models shape:
    - each export of `src/index.ts` with each option it takes;
    - `renderResponsiveLayout` with every layout tag;
    - `compileTemplate` with escape modes, slots, strict and helpers;
    - `parseArgs`, and `main` with each flag and each error, with stdout, stderr and thrown messages captured;
    - `applyEmailStyle` with built-in, override and unknown tones;
    - the Awkward_Input set through each Parsing_Unit.

    Also record the sha256 of each guide script's output, run against the scratch build. Keep the script for task 8.1. Change no Repository file.
    - **Property 4: The rewrite changes no behaviour** (recording half)
    - _Requirements: 7.1_

- [x] 3. Test support and community files
  - [x] 3.1 Create `test/support/awkward-inputs.ts` with `AWKWARD_INPUTS`: named entries for a family emoji, a flag emoji, a non-Latin script, a 10,000-character string, surrounding whitespace, whitespace only, a zero-width joiner, a control character and a byte order mark. Add `expectCleanOutcome(run)`, which passes when the call returns or throws an `Error` with a message that is neither a `TypeError` nor a `RangeError`, within 1 second. Create `test/support/temp-dir.ts` and `test/support/console.ts` holding the one temp-directory helper and the one console-capture helper the CLI, guide and package tests will share. Prove each helper with an ephemeral check.
    - _Requirements: 3.4, 3.5, 4.1, 4.2, 4.3_
  - [x] 3.2 Write the security and support files:
    - `.github/SECURITY.md`: private vulnerability reporting link, supported versions table (latest 4.x), first response within 7 days, coordinated disclosure after a fix ships.
    - `.github/SUPPORT.md`: where questions go.
    - `.github/CODEOWNERS`: `* @sabind`.
    - `.github/dependabot.yml`: weekly `npm` and `github-actions` updates, minor and patch grouped.
    - _Requirements: 8.1, 8.4, 8.6_
  - [x] 3.3 Write `.github/ISSUE_TEMPLATE/bug.yml` and `feature.yml`. Each has the package version, Node version and reproduction fields, and preflight checkboxes in the Handbook's style. Add `config.yml` with `blank_issues_enabled: false` and links to the security policy and `docs/`. Delete the root `ISSUE_TEMPLATE.md`, which names the wrong package. Replace `CODE_OF_CONDUCT.md` with Contributor Covenant 2.1, keeping `hello@freethinking.it` as the contact. Add `permissions: contents: read` to `.github/workflows/ci.yml`.
    - _Requirements: 8.2, 8.5, 8.6_

- [x] 4. Slim the tests
  - [x] 4.1 Create `test/style.test.ts` by moving every tone and `applyEmailStyle` test out of `test/compile.test.ts` and `test/layout.test.ts`, unchanged. Confirm `npm run coverage:module style` matches the task 1.1 baseline, and that `compile` and `layout` still match theirs.
    - _Requirements: 1.5, 3.5_
  - [x] 4.2 Slim `test/cli.test.ts`:
    - one test per Path of `parseArgs` and `main`, with behaviour-sentence names and boundary values;
    - the shared temp-dir and console helpers from task 3.1;
    - one Awkward_Input test for CLI arguments and one for the JSON data file, a Defect marked `it.fails` with a one-line note;
    - `coverage:module cli` before and after, with cut tests and any lost branch named in the summary.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 9.1_
  - [x] 4.3 Slim `test/engine.test.ts` and `test/template.test.ts` together, since both measure `engine`. Keep one test per Path of escaping, slots, strict mode, helpers, partials and engine options. Add one Awkward_Input test for template text and slot names, any Defect `it.fails`. Run `coverage:module engine` and `coverage:module template` before and after.
    - **Property 2: Slimming keeps each module's coverage**
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 9.1_
  - [x] 4.4 Slim the integration and documentation Test_Files:
    - `test/docs.test.ts`, `test/guides.test.ts`, `test/examples.test.ts` and `test/esm-package.test.ts`;
    - `examples/guides/transactional/welcome.test.ts`;
    - `test/visual/email-examples.visual.ts`.

    Remove only Redundant_Tests, keep every behaviour each checks today, use the shared helpers, and rename tests as behaviour sentences. Report counts before and after.
    - _Requirements: 3.1, 3.3, 3.5, 3.6, 3.9, 9.1_
  - [x] 4.5 Slim `test/compile.test.ts` with the same rules, mocking only at the file-system and juice resource boundary. Run `coverage:module compile` before (from task 4.1) and after.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 9.1_
  - [x] 4.6 Slim `test/layout.test.ts`, keeping one test per layout tag's Paths and boundary sizes. Add one Awkward_Input test for tag attributes, `size` values and tag content, any Defect `it.fails`. Run `coverage:module layout` before and after.
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 9.1_
  - [x] 4.7 Slim `test/style.test.ts`, keeping one test per container and content Path, built-in, override and partial tones, and unknown tones. Add one Awkward_Input test for `data-ie-variant` values and tone colours, any Defect `it.fails`. Run `coverage:module style` before (from task 4.1) and after.
    - **Property 3: Awkward_Input never crashes a Parsing_Unit** (detection half)
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 9.1_

  - [x] 4.8 Add one guard test per strict-mode behaviour that `docs/reference.md` promises and that comes from Handlebars itself, so a Handlebars update that breaks a documented promise fails the suite. The behaviours: `{{{slots.x}}}` throws in strict mode; a missing block and a missing inverted block throw in strict mode; for a missing two-segment path the error names the leaf (`{{user.name}}` names `name`); names used only by `#if` and `#each` are not checked in strict mode; `@root.` paths resolve in strict mode. Add them to `test/engine.test.ts` with behaviour-sentence names, each citing the reference line it guards in a one-line comment only if the name cannot say it.
    - _Requirements: 3.3, 3.6, 3.9_

- [x] 5. Fix the Defects
  - [x] 5.1 For each `it.fails` test left by tasks 4.2, 4.3, 4.6 and 4.7, fix the root cause in its Source_Module with the smallest change and flip the test to a plain `it`. Report the input, the wrong result and the fix. If a Defect lets input inject markup, script or CSS, stop and report it for a private advisory instead of fixing it here. With no `it.fails` tests, confirm none exist and report that. End with no `it.fails` in the suite.
    - **Property 3: Awkward_Input never crashes a Parsing_Unit**
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.1_

  - [x] 5.2 Add tests for the uncovered Paths of each Source_Module until `src/` reaches at least 95% of lines and 90% of branches and every module at least 90% of lines and 85% of branches, as measured by `npm test` and `npm run coverage:module`. Each new test checks a behaviour, named as a sentence, in the module's Unit_Test_File, using the shared helpers. Add the `/* v8 ignore */` comment with its reason around the CLI's entry block, the only coverage exclusion. Then raise the `thresholds` in `vitest.config.ts` to the measured `src/` numbers rounded down. Report each module's coverage before and after this task. If a Path cannot be reached without changing behaviour, name it and leave it.
    - **Property 1b: Coverage meets the targets**
    - _Requirements: 1.7, 1.8, 1.9, 9.1_

- [x] 6. Readability rewrite
  - [x] 6.1 Rewrite `src/engine.ts`, `src/template.ts`, `src/index.ts` and `src/types.ts` to Requirement 6's rules, for example the `Object.fromEntries(...filter)` in `compileTemplate`. Add the docstrings the linter requires to `normalizeEscapeMode`, `renderTemplate` and `isTemplateData`. Make the files lint-clean. Report each comment removed or rewritten and any side effect.
    - _Requirements: 2.2, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.2_
  - [x] 6.2 Rewrite `src/compile.ts`, including the conditional resource-inlining ternary in `inlineEmailHtml`. Add docstrings to `compileEmailTemplate`, `renderEmail` and `inlineEmailHtml`. Move the layout tag names that `shouldRenderResponsiveLayout` tests into one named internal export of `src/compile.ts`, with a docstring, not re-exported from `src/index.ts`, and make `test/support/leaks.ts` import it instead of its copy. Lint-clean, same report.
    - _Requirements: 2.2, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.2_
  - [x] 6.3 Rewrite `src/layout.ts`, including `renderImage`'s nested template-literal conditionals and the `attrs` and `img` abbreviations. Add docstrings to `renderResponsiveLayout` and `BUILT_IN_TONES`. Lint-clean, same report.
    - _Requirements: 2.2, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.2_
  - [x] 6.4 Rewrite `src/style.ts`, merging its two near-identical `replace` callbacks into one named step and unchaining `readStyleValue`. Add the docstring to `applyEmailStyle`. Lint-clean, same report.
    - _Requirements: 2.2, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.2_
  - [x] 6.5 Rewrite `src/cli.ts`, including `options.css.pop()` mutating parsed state, without changing any flag, message or exit code. Add docstrings to `main` and `parseArgs`. Lint-clean, same report.
    - _Requirements: 2.2, 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.2_
  - [x] 6.6 Rewrite `scripts/render-examples.js`, `scripts/serve-examples.js` and `scripts/module-coverage.js`, keeping every output file name and byte. Lint-clean, same report.
    - _Requirements: 2.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.2_
  - [x] 6.7 Rewrite the guide example scripts under `examples/guides/*/` (`send.mjs` files) and update each guide page's quoted block in `docs/guides/` and the README Quickstart in the same change. Keep every printed output identical. Lint-clean, same report.
    - _Requirements: 2.4, 6.1, 6.2, 6.3, 6.5, 6.7, 6.9, 9.2_
  - [x] 6.8 Make every Test_File, the `test/support/` helpers (except the import in `test/support/leaks.ts`, which task 6.2 changes), `vitest.config.ts`, `playwright.config.ts` and `eslint.config.js` lint-clean. Apply Requirement 6's rules to any test helper code the slimming tasks left dense, such as the checkers in `test/docs.test.ts`. Same report.
    - _Requirements: 2.4, 2.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 9.2_

- [x] 7. CI and contributor docs
  - [x] 7.1 Add an `npm run lint` step to `.github/workflows/ci.yml` before the build in the test job.
    - _Requirements: 2.3_
  - [x] 7.2 Rewrite `CONTRIBUTING.md`, keeping its Releases section, with these sections:
    - set up;
    - `npm run check`;
    - lint;
    - the coverage gate and `npm run coverage:module`;
    - branch naming `<issue>-<slug>`;
    - issues and labels.

    Update the README's Development and Quality sections to name `npm run check`, the linter and the coverage gate, within the README's 220-line limit.
    - _Requirements: 8.3_

- [x] 8. Prove and report
  - [x] 8.1 Compile the new `src/` to `<scratch>/after` with `tsc --outDir`, run task 2.1's script unchanged against it into `<scratch>/after.json`, and `diff` the two records. Every difference must be a fixed Defect from task 5.1, or a behaviour change the author approved during the run, each named. Any other difference goes back to the rewrite task that caused it. Then delete the script and both records.
    - **Property 4: The rewrite changes no behaviour**
    - _Requirements: 6.8, 7.1, 7.2, 7.3_
  - [x] 8.2 Run `npm run check`, `npm run test:visual` and `coverage:module` for every module. Confirm:
    - zero lint findings;
    - the Coverage_Gate passes;
    - every module's line coverage is at or above its task 1.1 baseline, and at least 90% of lines and 85% of branches;
    - the visual snapshots pass against the email-only baselines the author approved;
    - `npm pack --dry-run` lists the same files as before.

    Compile the report Requirement 9 asks for, including the Handbook_Gap list from the design.
    - **Property 2: Slimming keeps each module's coverage**
    - _Requirements: 3.7, 7.4, 8.7, 9.1, 9.2, 9.3_
  - [x] 8.3 The author runs, from the repository:
    - `gh api -X PUT repos/freethinkingit/inline-email/private-vulnerability-reporting` to enable private reporting;
    - `gh label create` for each label CONTRIBUTING names (`bug`, `enhancement`, `documentation`, `security`, `good first issue`, `help wanted`, `triage`, plus any other label an issue form applies), with `--force` to update ones that exist;
    - `gh repo edit --enable-discussions`, since SUPPORT and the issue chooser send questions to Discussions Q&A.

    Then `gh api repos/freethinkingit/inline-email/community/profile --jq .health_percentage` reports the new score.
    - _Requirements: 8.8_

## Notes

- Match the repository's style: two-space indent, single quotes, `.js` suffixes on relative imports in `src/`, tests importing `.ts` sources, `^` version ranges.
- Never run `npm run build` while another task in the wave may run tests; build into the scratchpad with `tsc --outDir` where a task needs compiled code of its own. The guide and package tests need `npm run build` first and run at the end of each wave, not inside tasks that run concurrently.
- A test task changes no Source_Module. A rewrite task changes no Test_File except to keep it passing when a helper it imports is renamed, which is not expected since exports keep their names.
- At the end of wave 3, before wave 4, the author commits, so the expected-failure tests land before their fixes (Requirement 4.4).
- The Behaviour_Record lives at the session scratchpad path, not in the Repository, and is deleted in task 8.1.
- A `file=` block in a guide page must equal its file byte for byte; change the file, then paste it into the page.
- `release.yml` moved to the Node 24 action versions in wave 1, at the author's request; if `v4.0.1` is tagged after this branch merges, 4.0.1 publishes through them.
- In `src/`, exports are named declarations only: no default exports and no local `export { name }` lists (the lint config enforces it).
- Task 8.3 is the author's to run; it changes repository settings, not files.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 3, "tasks": ["4.5", "4.6", "4.7", "4.8"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8"] },
    { "id": 7, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 8, "tasks": ["8.2"] },
    { "id": 9, "tasks": ["8.3"] }
  ]
}
```

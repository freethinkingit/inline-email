# Implementation Plan

## Overview

The plan builds the layout flavors from the bottom up. First come the package entries and the exported `LayoutFlavor` type. Then the Inky loader, then the compile pipeline that uses it, then the CLI on top. Tests follow the code they read, file by file, so no two tasks in a wave edit the same file. The docs that do not depend on code run in the first waves. A final task runs the checks that sit outside `npm run check`.

Properties are table-driven vitest tests, since the repository has no property-testing library. Inky is a devDependency, so the Inky tests run the real Inky 1. Its absence is simulated with `vi.doMock`.

## Tasks

- [x] 1. Add Inky to the package and bump the version
  - [x] 1.1 Add the Inky dev dependencies and the version
    - In `package.json`, add `devDependencies.inky: "^1.5.0"` and `devDependencies["inky-2"]: "npm:inky@2.0.0-beta.10"`, declare no peer dependency on Inky, and set `version` to `4.1.0`.
    - Run `npm install` so `package-lock.json` matches, and confirm `npm run audit` still passes.
    - _Requirements: 2.6, 5.1_
- [x] 2. Add the layout flavor type
  - [x] 2.1 Export `LayoutFlavor`
    - Add `export type LayoutFlavor = 'default' | 'inky'` to `src/types.ts`, with a doc comment, and export it from `src/index.ts`.
    - Do not widen `CompileEmailTemplateOptions.responsive` here. Task 4.1 widens it, because `src/compile.ts` must change in the same step to build.
    - _Requirements: 1.1_
- [x] 3. Load and run Inky
  - [x] 3.1 Create `src/inky.ts` with `renderInky(html)`
    - Import Inky through a specifier held in a variable and cache the module promise. Type the two shapes locally: Inky 1 as `{ Inky: new () => { releaseTheKraken(html: string): string } }` and Inky 2 as `{ transform(html: string): string }`, each read from the module or its `default` export.
    - With Inky 2's `transform`, return `transform(html)`; otherwise, with Inky 1's `Inky`, return `new Inky().releaseTheKraken(html)`.
    - When the module has neither, reject with `responsive: 'inky' supports Inky 1 and Inky 2; the installed inky package exports neither.`
    - With Inky 2, when the HTML contains `{{>`, reject with `Inky 2 escapes Handlebars partials ({{> name}}); Inky 1 keeps them. Use Inky 1 (npm install inky@1), or inline the partial.` before calling `transform`.
    - When the import fails because `inky` is not installed (`ERR_MODULE_NOT_FOUND`), reject with `responsive: 'inky' needs the inky package. Install it with npm install inky.`, with the original error as `cause`. When it fails any other way, reject with `responsive: 'inky' could not load the inky package.`, with the original error as `cause`.
    - When Inky throws, let its error through unchanged.
    - _Requirements: 2.1, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10_
- [x] 4. Choose the layout step by flavor
  - [x] 4.1 Replace the boolean layout switch in `src/compile.ts`
    - Widen `CompileEmailTemplateOptions.responsive` in `src/types.ts` to `boolean | LayoutFlavor | ResponsiveLayoutOptions`, and widen `inlineEmailHtml`'s `responsive` to `boolean | LayoutFlavor`.
    - Replace `normalizeResponsiveOption` and `shouldRenderResponsiveLayout` with `resolveLayout(responsive, html)`, which returns `'default'`, `'inky'` or `'none'` per the design's normalization decision. Keep `LAYOUT_TAG_PATTERN` detection for left out, `null` and `{}`.
    - Throw `Unknown responsive value <value>. Use 'default', 'inky', true or false.` for anything else, including an object whose `enabled` is not a boolean.
    - Add the `LAYOUT_FLAVORS` table, mapping `'default'` to `renderResponsiveLayout` and `'inky'` to `renderInky`.
    - Make `applyTransforms` run the chosen layout step and then the Transform.
    - Update the doc comments of `compileEmailTemplate` and `inlineEmailHtml` for the new values and rejections.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2_
- [x] 5. Add `--responsive` to the CLI
  - [x] 5.1 Parse, pass and document the flag in `src/cli.ts`
    - Add `responsive?: boolean | LayoutFlavor` to `CliOptions`.
    - Read `--responsive <value>` with `readValue`. Map `false` to `false`, and pass `default` and `inky` through. Throw `CliError: Unknown --responsive value <value>. Use default, inky or false.` otherwise.
    - Pass the value to `compileEmailTemplate`.
    - Add a `--responsive` line to the help text.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 6. Test the flavors
  - [x] 6.1 Test that existing values are unchanged and that `'default'` is `true` in `test/compile.test.ts`
    - Write a table of left out, `null`, `true`, `false`, `{}`, `{ enabled: true }` and `{ enabled: false }`, crossed with HTML that has a Layout_Tag and HTML that has none, against the existing cases' expected output. Edit no existing expectation.
    - For each `examples/` template that uses Layout_Tags, assert that `'default'` equals `true`.
    - **Property 1: Existing values are unchanged**
    - **Property 2: `'default'` is `true`**
    - **Validates: Requirements 1.2, 1.3, 5.3**
  - [x] 6.2 Test Inky rendering and loading in a new `test/inky.test.ts`
    - Write a table of Inky_Markup: container, row with columns, button, spacer, a mix with `<section>`, and one with Handlebars expressions. Compile each with `'inky'`. Assert no Built_In_Layout markup, no Inky tags left, and the Handlebars expressions intact after `render`.
    - Mock the `inky` specifier with a spy, and assert that no non-`'inky'` value imports it.
    - Simulate a missing Inky with `vi.doMock`, throwing an `ERR_MODULE_NOT_FOUND` error. Assert the message and `cause`, and that no fallback output is returned. Make the import throw a `SyntaxError` instead, and assert the could-not-load message and its `cause`.
    - Use a mock whose `releaseTheKraken` throws, and assert that its error comes through unchanged.
    - Run the Inky_Markup table with Inky 2 too, loaded through the `inky-2` alias, and assert each output equals what the installed Inky's own API returns.
    - Use a mock with neither `Inky` nor `transform`, and assert the unknown-export message. Compile `{{> footer}}` with Inky 2, and assert the partials message.
    - **Property 3: Under `'inky'`, only Inky lays out**
    - **Property 6: Inky loads only on request**
    - **Property 7: Either Inky renders**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**
  - [x] 6.3 Test unknown values and Transform order in `test/compile.test.ts`
    - Write a table of `'true'`, `'Default'`, `'mjml'`, `''`, `1`, `[]` and `{ enabled: 'yes' }`. Each rejects with the message naming the value.
    - For each of `'default'`, `'inky'` and `false`, use a recording Transform and assert that its input equals that layout step's output.
    - **Property 4: Unknown values reject**
    - **Property 5: The Transform sees the layout's output**
    - **Validates: Requirements 1.4, 1.5**
  - [x] 6.4 Test the CLI flag in `test/cli.test.ts`
    - Cover `--responsive default`, `inky` and `false` against the library's output, no flag against today's output, a missing value, an unknown value, `--responsive inky` without Inky (mocked) exiting with status 1, and the help line.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.5 Check the packed package without Inky in `scripts/check-package.js`
    - Add a check that, in the clean install without Inky, `compileEmailTemplate({ html, responsive: 'inky' })` rejects with the install message, and that the existing check still passes.
    - _Requirements: 2.6, 5.2_
- [x] 7. Document Inky as a flavor
  - [x] 7.1 Add Inky to the README's "When to use it"
    - Add a line saying that Inky provides the layout markup and runs inside inline-email through `responsive: 'inky'`, keeping compile-once, render-per-send, the preview and the CLI.
    - _Requirements: 4.1_
  - [x] 7.2 Document the values and the Inky flavor in `docs/reference.md`
    - In Responsive Layout Tags, add the Combination_Table, `'default'` as the preferred spelling of `true`, and that flavors do not mix.
    - Add an Inky subsection: install `inky`, set `responsive: 'inky'`, and pass Foundation for Emails' CSS through `css` or `--css`. Open `node_modules/foundation-emails` first to confirm the CSS file's path before naming it.
    - In the Inky subsection, say that Inky 1 is stable but installs about 200 packages with known `npm audit` findings, that Inky 2 is a beta with no dependencies, and that Inky 2 cannot be used with Handlebars partials.
    - Update line 285 ("Disable them with `responsive: false`") and line 352 ("without coupling the package to Inky") so they agree with the flavors.
    - In Compile Transforms, say that the Transform runs after the chosen flavor.
    - In CLI, add `--responsive`.
    - Make the Compile Transforms example show the transform doing something visible, since calling `renderResponsiveLayout` again after the built-in layout changes nothing.
    - In the Inky subsection, say that after fixing a broken `inky` install, a running process needs a restart.
    - _Requirements: 4.2, 4.3, 4.4, 4.6, 4.7_
  - [x] 7.3 Point MIGRATION.md's Inky guidance at `responsive: 'inky'`
    - In the 2.x prompt's rules 3 and 4, and in the "Keep writing Inky" section, replace `responsive: false` plus an Inky Transform with installing `inky@1` and setting `responsive: 'inky'` on 4.1.0 or later.
    - Say that the CLI takes `--responsive inky`, and replace "the CLI has no switch" with `--responsive false`.
    - Drop the 2.x Inky-settings route and its CLI clause, change `npm install inky@1` to `npm install inky`, and replace "`responsive: 'inky'` runs Inky 1 only" with how `'inky'` handles Inky 2 and partials.
    - Keep the docs' line limits from `test/docs.test.ts`.
    - _Requirements: 4.5_
- [x] 8. Run the checks outside `npm run check`
  - [x] 8.1 Run the package check, audit and visual tests
    - Run `npm run test:package`, `npm run audit` and `npm run test:visual`. The visual snapshots must not change. If any does, treat it as a break of Requirement 1.3, not a snapshot update.
    - Run MIGRATION.md's `inlineEmailHtml('<row>thing</row>', '', { responsive: 'inky' })` After example and its `inline-email --responsive false footer.html` example, and confirm the output the text shows.
    - _Requirements: 5.2, 5.3_

## Notes

- Write doc comments the way `src/compile.ts` does (`@param`, `@returns`, `@rejects`). The ESLint jsdoc plugin checks exported functions.
- The coverage gate (99% of `src/` lines and branches) can only pass from wave 4 on, once the tests that read the new code land. Before that, judge each wave's suite by its test results and report the coverage figure rather than treating the gate as a failure.
- `src/inky.ts` is the only file that names the `inky` package. Tests mock that specifier, never the import inside `src/compile.ts`.
- Do not edit any existing test's expected output. A change there means Requirement 1.3 is broken.
- Inky prints `DEP0060 DeprecationWarning: util._extend` on Node 24. That is expected and is not a test failure.
- The two `test/docs.test.ts` checks of `--responsive` fail from wave 1 until task 5.1 lands. Task 7.2 is ticked once they pass, and task 5.1 copies the reference's `usage()` line exactly: `--responsive <flavor>  Layout flavor: default, inky or false. Without it, layout tags in the HTML get the built-in layout.`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "7.1", "7.3"] },
    { "id": 1, "tasks": ["3.1", "7.2"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["5.1", "6.1", "6.2"] },
    { "id": 4, "tasks": ["6.3", "6.4", "6.5"] },
    { "id": 5, "tasks": ["8.1"] }
  ]
}
```

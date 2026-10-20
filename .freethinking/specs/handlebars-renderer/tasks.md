# Implementation Plan

## Overview

The plan builds the Handlebars layer bottom-up: dependency and types first, then the engine module in three steps (escape modes, compile pipeline, strict mode), then the two callers (`renderTemplate` and `compileEmailTemplate`) with their test updates, with the CLI change running alongside since it touches nothing the engine does. Documentation, the version bump and the visual snapshots come once behaviour is final, and a last task runs every check the release workflow runs.

Tests are vitest example tests in the repository's existing style. The five design properties are implemented as table-driven tests built in the test file, so no new dev dependency is added. Every leaf task cites the requirements it implements; property-test tasks also name the design property they verify. Tests that lock in a behaviour change (stray tags now throw, subject escaping) are part of the implementation task that changes the behaviour, since the suite must stay green at the end of every wave.

## Tasks

- [x] 1. Dependency and types
  - [x] 1.1 Add `handlebars` `^4.7.9` to `dependencies`, run `npm install`, and confirm `npm audit --audit-level=high --omit=dev`, `npm run build` and `npm test` still pass before any code uses it
    - _Requirements: 1.1, 6.4_
  - [x] 1.2 Add `EscapeMode` and `EngineOptions` to `src/types.ts`; extend `RenderTemplateOptions` with `escape?: EscapeMode | boolean`, `strict?` and `handlebars?`; add the same three optional fields to `CompileEmailTemplateOptions`; export the two new types from `src/index.ts`
    - _Requirements: 3.1, 4.1, 5.1, 6.1_

- [x] 2. Engine module `src/engine.ts`
  - [x] 2.1 Implement `normalizeEscapeMode(value)` returning `html` for `undefined`/`true`, `none` for `false`, the two names as given, and throwing an error that lists the accepted values otherwise
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.8_
  - [x] 2.2 Implement `compileTemplate(source, options)`: create an isolated instance with `Handlebars.create()`; register `options.handlebars.helpers`; build compile options `{ ...passthrough, compat: true, noEscape: mode === 'none' }` where passthrough is `options.handlebars` without `helpers`, `partials`, `compat`, `noEscape`, `strict`; `parse`; run a `Handlebars.Visitor` subclass that turns each param-less, hash-less `MustacheStatement` whose path begins `slot:` into a raw call to the built-in `lookup` helper, `{{{lookup @root.slots "name"}}}`; call `instance.precompile(ast, compileOptions)` so compiler-stage faults throw at compile time; `instance.compile(ast, compileOptions)`; register each `options.handlebars.partials` entry as a function compiled through this same pipeline; delete `escapeValue` and the `__ieEscape` helper; narrow `EscapeMode` in `src/types.ts` to `'html' | 'none'`; return a function that calls the compiled template with `{ ...data, slots: data.slots ?? {} }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.3, 2.4, 3.6, 3.7, 5.1, 5.2, 5.3_
  - [x] 2.3 Replace the root Proxy with Handlebars' strict: read `strict = options.strict === true` and compile with `{ ...passthrough, compat: !strict, strict, noEscape: mode === 'none' }`, delete `strictRoot`, keep Handlebars' built-in `lookup` helper ahead of a caller helper of that name, and change the slot rewrite target to the built-in helper call `{{{lookup @root.slots "name"}}}` so a missing slot renders empty under strict
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x]* 2.4 Write `test/engine.test.ts` with the escape-mode table: 50 generated strings mixing the seven special characters with text, asserting `html` against Handlebars' `escapeExpression`, `none` against the input, `true`/`false` as aliases, and that a helper's string result is escaped in `html` mode while a `SafeString` result is inserted unchanged
    - **Property 2: Escape modes are exact**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
  - [x]* 2.5 Add to `test/engine.test.ts`: two compiles with different helpers where the first helper is unknown to the second; a reserved field in Engine_Options is overridden without error; an invalid escape value throws naming the accepted values; an unclosed block throws with a location; `{{slot:a.b}}` resolves `slots["a.b"]`; a bare mustache naming a registered helper still calls the helper; `{{slot:x}}` inside an `each` whose item has its own `slots` key still reads the root slot; `\{{slot:x}}` renders literally; a partial reference with two context arguments throws at compile; `knownHelpersOnly: true` with a registered helper compiles
    - **Property 5: Compiles are isolated**
    - **Validates: Requirements 1.10, 2.1, 2.2, 3.8, 5.2, 5.3**

- [x] 3. Wire `renderTemplate`
  - [x] 3.1 Replace the body of `src/template.ts` so `renderTemplate(template, data, options)` calls `compileTemplate(template, options)(data)`; keep and export `isTemplateData`; delete the block scanner, the three patterns and `escapeHtml`. Update `test/template.test.ts` only where behaviour changed by this spec: the stray-tag test now expects a thrown parse error, and any assertion depending on standalone-tag whitespace is adjusted
    - _Requirements: 1.1, 1.10, 6.1, 8.5_
  - [x]* 3.2 Add to `test/template.test.ts` the inert-value table: each of `{{secret}}`, `{{slot:x}}`, `{{#a}}x{{/a}}`, `{{{slots.x}}}` and a lone `{{` placed at top level, inside a block, inside a nested block, inside a scalar block with `{{.}}`, and inside slot content, asserting literal output
    - **Property 1: Rendered values are inert**
    - **Validates: Requirements 1.8, 2.4**
  - [x]* 3.3 Add to `test/template.test.ts` the strict table: for each existing renderer case that does not rely on enclosing-context fall-through, strict output equals non-strict output; a missing top-level variable, a missing leaf, a missing block name, a missing inverted block name and a missing row key inside `each` each throw naming the name; a null-valued field, a missing `{{slot:x}}`, an `{{#if}}` over a missing name, and `../` and `@root.` references do not throw
    - **Property 4: Strict is a pure refinement**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 4. Wire `compileEmailTemplate`
  - [x] 4.1 In `src/compile.ts` accept `escape`, `strict` and `handlebars`; at compile time build three functions with `compileTemplate`, the HTML with the caller's escape mode and the subject and text with `none`, all sharing `strict` and `handlebars`; `render` calls them and keeps `applyEmailStyle` on the HTML; `html`, `subject` and `text` string fields stay as before. Replace the `{ escape: false }` calls from 3.0.2
    - _Requirements: 3.1, 3.6, 4.1, 5.1, 6.1, 6.3_
  - [x] 4.2 Update `test/compile.test.ts` for the new options (an `escape: 'none'` compile, a `strict` compile that throws on missing data, a `handlebars.helpers` compile); extend `test/examples.test.ts` to render every example a second time with `strict: true` and the same data; confirm `test/esm-package.test.ts` passes against the built package
    - _Requirements: 3.1, 4.2, 5.1, 6.2, 6.4, 8.5_

- [x] 5. CLI image default and local render
  - [x] 5.1 In `src/cli.ts` replace `noInlineImages` with `inlineImages` defaulting to false; accept `--inlineImages`; keep accepting `--noInlineImages` as a no-op that sets a `deprecatedFlag` and makes `main` print one line to stderr naming the new default; pass `webResources.images: options.inlineImages` and `webResources.relativeTo` set to the input file's directory; update the usage text
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x]* 5.2 Add to `test/cli.test.ts`: no flag parses to `inlineImages: false`; `--inlineImages` parses to true; `--noInlineImages` parses to false with the deprecation marker; help text names both flags; `main` with `--inlineImages` on a file referencing a local image writes a `data:image` URI; and add to `test/compile.test.ts` that `compileEmailTemplate` with `juice: { webResources: { images: true, relativeTo } }` and a local image yields a `data:image` URI
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 5.3 In `inlineEmailHtml` in `src/compile.ts`, when `juice.webResources.images` is truthy, await `juice.inlineExternal(html, { links: false, scripts: false, ...webResources })` and run the existing synchronous `inlineContent` or `juice` call on its output; when it is not, keep the current path unchanged
    - _Requirements: 7.2, 7.5, 7.6_
  - [x] 5.4 In `src/cli.ts` add `--data <file>` and `--strict`: `parseArgs` records `data` and `strict`; `main` passes `strict` to `compileEmailTemplate`, and when `data` is set reads the file, parses it as JSON (throwing a `CliError` that names the file when it cannot be read or parsed), renders with `compiled.render(parsed)` and writes the rendered `html`; without `--data` the output stays `compiled.html`; update the usage text
    - _Requirements: 7.4, 7.7, 7.8_
  - [x]* 5.5 Add to `test/cli.test.ts`: `--data` and `--strict` parse; `main` with `--data` on a template and a JSON file writes the rendered HTML with the placeholder replaced; a missing or malformed data file rejects naming the file; `--strict` with a field missing from the data rejects with Handlebars' error; help text names both flags
    - _Requirements: 7.4, 7.7, 7.8_

- [x] 6. Documentation and release
  - [x] 6.1 Write `MIGRATION.md` listing every difference from 3.x named in Requirement 8.1 plus Handlebars' entity set and `SafeString` for helpers that return HTML, each with a before and after example, including the `{{#if}}` and `{{#unless}}` guidance for conditions on numbers and strings, opening with the statement that 4.0 renders with Handlebars and everything Handlebars documents applies, and closing with a section written as a prompt an author can paste into an AI assistant together with their 3.x templates to convert them
    - _Requirements: 1.11, 8.1_
  - [x] 6.2 Update `README.md`: link the migration note next to the v3 link, document Escape_Mode with the two names and the boolean aliases, helpers that return HTML wrapping it in Handlebars' `SafeString`, Strict_Mode with the `../` and `@root.` rule for enclosing contexts and `{{slot:x}}` for slots, Inverted_Blocks, the `{{#if}}` and `{{#unless}}` guidance for conditions on numbers and strings, Engine_Options with the reserved fields and the reserved `lookup` helper, both Slot forms, the CLI flags, and the four `juice.webResources` resource kinds with their size caps and the `strict` opt-in
    - _Requirements: 1.11, 7.4, 7.5, 7.6, 8.1, 8.2_
  - [x] 6.3 Set `version` to `4.0.0` with `npm version 4.0.0 --no-git-tag-version`
    - _Requirements: 8.3_
  - [x] 6.4 Run `npx playwright install chromium` if needed and `npm run test:visual`; if snapshots differ, regenerate with `--update-snapshots`, commit the PNGs, and add a line to the migration note saying layout output changed; if Playwright cannot run locally, record that CI will run it and leave the note's line out until CI reports
    - _Requirements: 8.4_

- [x] 8. Additions the author asked for after the final review
  - [x] 8.1 In `src/engine.ts`, rethrow a `TypeError` from a strict render as `Strict render failed: ...` with a hint and the original as `cause`; update the three-segment strict test, README and `MIGRATION.md`
    - _Requirements: 4.2_
  - [x] 8.2 In `src/style.ts`, decode `&#x27;`, `&#x3D;` and `&#x60;` in tone attributes, with a test in `test/compile.test.ts`
    - _Requirements: 3.2_
  - [x] 8.3 Add the two image failure-mode tests to `test/compile.test.ts`; move the migration note to `MIGRATION.md` with a README callout; add `.github/pull_request_template.md`; the `data-inline` sentence; the `CONTRIBUTING.md` tag
    - _Requirements: 7.6, 8.1_

- [x] 7. Release checks
  - Run `npm ci`, `npm audit --audit-level=high --omit=dev`, `npm run build`, `npm test`, `npm run examples` and `npm pack --dry-run`, and confirm every renderer regression test from 3.0.2 is still present and passing
  - _Requirements: 6.4, 8.5_

## Notes

- Match the existing file style: two-space indent, single quotes, no semicolons omitted, `.js` suffixes on relative imports, tests importing `.ts` sources, no comments that explain what a line does.
- Node is at `$HOME/.nvm/versions/node/v24.12.0/bin`; run `npm ci` in a fresh worktree before building.
- The reserved compile fields `compat`, `noEscape` and `strict` are fixed by the design; do not rename them without updating the README and migration note.
- A test that locks in a behaviour change belongs to the implementation task that makes the change, so the suite is green at the end of every wave. Optional `*` tasks add coverage beyond that.
- Do not touch `src/layout.ts` or `src/style.ts`; the juice step changes only as task 5.3 describes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "5.1", "5.3"] },
    { "id": 1, "tasks": ["2.1", "5.2"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "3.1", "4.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "4.2"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["7"] },
    { "id": 8, "tasks": ["5.4"] },
    { "id": 9, "tasks": ["5.5"] },
    { "id": 10, "tasks": ["8.1", "8.2", "8.3"] }
  ]
}
```

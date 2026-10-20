# Requirements Document

## Introduction

inline-email 4.0 replaces the hand-written template renderer with Handlebars while keeping the 3.x template syntax, public API and rendered output as close to unchanged as the engine allows. Server applications that compile an email once and render it per recipient get a maintained parsing engine with a security track record, an escape mode they can choose, an optional strict mode, inverted blocks, and raw access to the engine for callers who want more. The same major release flips the CLI so it no longer inlines remote images by default, matching the library. Issue #30 records the decision; this document says what the release must do.

## Glossary

- **Library**: The `inline-email` npm package: its compile and render functions, exported types and CLI.
- **Template**: A string of HTML or plain text containing Variables, Blocks and Slots in `{{ }}` syntax, supplied by the caller at compile time.
- **Template_Data**: The JSON-like object of values a caller passes at render time.
- **Variable**: A `{{name}}` or `{{a.b.c}}` reference resolved against Template_Data.
- **Block**: A `{{#name}}...{{/name}}` section rendered once per item for an array, once with the object as context for a non-empty object, once for any other truthy value, and not at all otherwise.
- **Inverted_Block**: A `{{^name}}...{{/name}}` section rendered exactly when the matching Block would not render.
- **Slot**: A named piece of trusted HTML supplied under `Template_Data.slots` and inserted without escaping where the Template references it.
- **Escape_Mode**: The named rule that decides whether a Variable's value, or a helper's result, is HTML-escaped.
- **Strict_Mode**: Handlebars' strict compile option, exposed by the Library, that makes a reference to a missing field an error instead of an empty string.
- **Engine_Options**: Handlebars compile options a caller passes through unchanged, such as helpers and partials.
- **Compiled_Template**: The object returned by `compileEmailTemplate`, holding the inlined HTML, subject and text and a `render` method.
- **Rendered_Output**: The `{ subject, html, text }` object `render` returns.
- **Image_Inlining**: The CLI behaviour of fetching remote images and embedding them as data URIs in the compiled HTML.
- **Migration_Note**: The document that tells a 3.x user what changes in 4.0 and what, if anything, they must do.
- **Visual_Snapshot**: A stored screenshot of an example email that the visual regression test compares against.

## Requirements

### Requirement 1: Render templates with Handlebars

**User Story:** As a maintainer, I want the Library to parse and render Templates with Handlebars, so that the engine is maintained by a project with a security record instead of by us.

#### Acceptance Criteria

1. THE Library SHALL compile every Template with Handlebars and SHALL contain no template parser of its own.
2. WHEN a Template references a Variable present in Template_Data, THE Library SHALL render its value, with nested `a.b.c` paths resolved through nested objects.
3. WHEN a Template contains a Block, THE Library SHALL render it as Handlebars does: once per item for a non-empty array, once with the value as context for an object or any value other than `false`, `null`, `undefined` or an empty array, and not at all for those four.
4. WHILE rendering inside a Block, THE Library SHALL resolve a Variable that the current item does not define against the enclosing contexts, outermost last, as 3.x did.
5. WHEN a Template contains `{{.}}` or `{{this}}` inside a Block over scalars, THE Library SHALL render the current item.
6. WHEN a Template contains an Inverted_Block, THE Library SHALL render it exactly when the matching Block renders nothing.
7. WHEN a Template references a Variable missing from Template_Data and Strict_Mode is off, THE Library SHALL render an empty string.
8. THE Library SHALL never parse a rendered value, a Slot's content or any part of Rendered_Output as Template syntax.
9. WHEN a Template nests a Block under the same name, THE Library SHALL pair each close tag with the innermost open Block of that name.
10. IF a Template is malformed, such as an unclosed Block or a close tag with no matching open, THEN THE Library SHALL throw at compile time with the line of the fault and a marker at its position, rather than rendering the tags as text.
11. THE Migration_Note and README SHALL tell authors to use `{{#if}}` and `{{#unless}}` for conditions on numbers and strings, since a bare Block over `0` or `""` now renders.

### Requirement 2: Keep 3.x slot syntax working

**User Story:** As a 3.x user, I want my `{{slot:name}}` references to keep working, so that upgrading does not force me to edit templates.

#### Acceptance Criteria

1. WHEN a Template contains `{{slot:name}}`, THE Library SHALL insert `Template_Data.slots.name` unescaped.
2. WHEN a Template contains `{{{slots.name}}}`, THE Library SHALL insert `Template_Data.slots.name` unescaped.
3. IF a referenced Slot is missing, null or undefined, THEN THE Library SHALL insert an empty string.
4. THE Library SHALL rewrite `{{slot:name}}` only in Template text at compile time and never in Template_Data or Rendered_Output.

### Requirement 3: Choose an escape mode

**User Story:** As a server developer, I want to pick how Variable values are escaped, so that values are inert HTML by default and raw where I choose.

#### Acceptance Criteria

1. THE Library SHALL support an Escape_Mode option on `renderTemplate` and on `compileEmailTemplate` with the values `html` and `none`.
2. WHERE Escape_Mode is `html` or not given, THE Library SHALL escape Variable values with Handlebars' own escaping, replacing `&`, `<`, `>`, `"`, `'`, `=` and the backtick.
3. WHEN an escaped `{{ }}` reference inserts a helper's result, THE Library SHALL escape it under the same Escape_Mode unless it is a Handlebars `SafeString`, which is inserted unchanged.
4. WHERE Escape_Mode is `none`, THE Library SHALL insert Variable values unchanged.
5. WHEN a caller passes the 3.x boolean `escape: true` or `escape: false`, THE Library SHALL treat them as `html` and `none` respectively.
6. THE Library SHALL render the subject and text of a Compiled_Template with Escape_Mode `none` and its HTML with the Escape_Mode the caller chose at compile time.
7. THE Library SHALL apply Escape_Mode to Variables only and never to Slots.
8. IF a caller passes an Escape_Mode value outside the two names and two booleans, THEN THE Library SHALL throw an error naming the accepted values.

### Requirement 4: Optional strict mode

**User Story:** As a server developer, I want an option that fails loudly on a missing Variable, so that a typo in a template is caught in tests instead of sending a blank to a customer.

#### Acceptance Criteria

1. THE Library SHALL accept a `strict` option on `compileEmailTemplate` and `renderTemplate`, default off.
2. WHERE `strict` is on, THE Library SHALL compile with Handlebars' `strict` option, so a Variable, Block or Inverted_Block whose name or path segment is missing from its context throws Handlebars' error naming the missing name, while a field present with a `null` value renders empty.
3. WHERE `strict` is on, THE Library SHALL still render a missing Slot referenced as `{{slot:name}}` as an empty string.
4. WHERE `strict` is on, THE Library SHALL turn off the enclosing-context lookup of Requirement 1.4, since Handlebars' strict mode fails when combined with it, and the README SHALL say that a strict Template reaches an enclosing context with `../name` or `@root.name`.
5. WHERE `strict` is on, THE Library SHALL not throw for a name used only as a parameter of `if`, `unless`, `each` or another helper, following Handlebars' own rule.

### Requirement 5: Raw engine access

**User Story:** As an advanced user, I want to pass Handlebars options such as helpers and partials through the Library, so that I can use engine features the Library does not wrap.

#### Acceptance Criteria

1. THE Library SHALL accept an Engine_Options object on `compileEmailTemplate` and `renderTemplate` and pass it to Handlebars unchanged, except for the fields the Library sets itself.
2. THE Library SHALL use an isolated Handlebars instance per compile so that helpers or partials registered for one Template never affect another.
3. IF an Engine_Options field conflicts with an option the Library sets, such as `compat`, `noEscape` or `strict`, or a helper named `lookup`, which the Slot rewrite relies on, THEN THE Library SHALL apply the Library's value and document that the field is reserved.

### Requirement 6: Public API compatibility

**User Story:** As a 3.x user, I want `compileEmailTemplate`, `renderEmail`, `renderTemplate` and the exported types to keep their shapes, so that my server code compiles against 4.0 without edits.

#### Acceptance Criteria

1. THE Library SHALL export `compileEmailTemplate`, `renderEmail`, `inlineEmailHtml`, `renderTemplate` and `renderResponsiveLayout` with their 3.x parameters and return types, extended only by the new optional fields.
2. WHEN a 3.x caller renders the example Templates in `examples/` with the data in `test/examples.test.ts`, THE Library SHALL produce Rendered_Output with every Variable and Slot resolved and no Template syntax left.
3. THE Library SHALL keep the `transform`, `responsive` and `juice` compile options and apply them before and after the Handlebars step in the same order as 3.x.
4. THE Library SHALL remain an ESM-only package that installs and runs on Node.js 20, 22 and 24.

### Requirement 7: Image inlining works and is off by default in the CLI

**User Story:** As a CLI user, I want the compiled HTML to reference remote images rather than embed them, so that the output matches the Library's default and stays small enough for email clients.

#### Acceptance Criteria

1. WHEN the CLI compiles a file with no image flag, THE Library SHALL leave remote image references in place and perform no Image_Inlining.
2. WHERE the CLI receives `--inlineImages`, THE Library SHALL perform Image_Inlining.
3. WHEN the CLI receives the 3.x flag `--noInlineImages`, THE Library SHALL accept it, change nothing, and print one deprecation line to stderr naming the new default.
4. THE CLI help text SHALL describe the new default and both image flags, and the `--data` and `--strict` flags.
5. WHERE `juice.webResources.images` is true on `compileEmailTemplate` or `inlineEmailHtml`, THE Library SHALL embed each reachable image as a data URI before inlining CSS, resolving relative paths against `juice.webResources.relativeTo`.
6. IF an image cannot be fetched while Image_Inlining is on, THEN THE Library SHALL keep its original `src`, continue, and let juice's warning reach stderr.
7. WHERE the CLI receives `--data <file>`, THE Library SHALL read the file as JSON, render the compiled Template with it through `render`, and write the rendered HTML instead of the compiled HTML; IF the file is missing or not valid JSON, THEN THE CLI SHALL fail with a message naming the file.
8. WHERE the CLI receives `--strict`, THE Library SHALL compile with Strict_Mode on, so a Template that references a field missing from the `--data` file fails the CLI run with Handlebars' error.

### Requirement 8: Migration note and release

**User Story:** As a 3.x user, I want one document that tells me what changed in 4.0 and what I must do, so that I can upgrade in one sitting.

#### Acceptance Criteria

1. THE Library SHALL ship a Migration_Note, linked from the README, that opens by stating that 4.0 renders with Handlebars and everything Handlebars documents applies, closes with a section written as a prompt an author can paste into an AI assistant together with their 3.x templates to convert them, and lists every behaviour difference from 3.x: the engine, Escape_Mode with the boolean alias and Handlebars' entity set, Strict_Mode, Inverted_Blocks, bare Blocks over `0` and `""`, malformed templates throwing, standalone-tag whitespace, whitespace inside tags, object values rendering as `[object Object]` instead of empty, Engine_Options, reserved fields, partials, the CLI image default, and the CLI failing on a malformed Template since it now compiles its input with Handlebars.
2. THE README SHALL document Escape_Mode, Strict_Mode, Inverted_Blocks, Engine_Options and both Slot forms.
3. THE Library SHALL be versioned 4.0.0.
4. WHEN the Visual_Snapshots differ after the engine change, THE Library SHALL regenerate and commit them, and the Migration_Note SHALL state that layout output changed.
5. THE existing test suite, including the renderer regression tests added in 3.0.2, SHALL pass against the Handlebars implementation, with assertions changed only where this document changes the behaviour.

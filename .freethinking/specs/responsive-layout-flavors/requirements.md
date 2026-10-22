# Requirements Document

## Introduction

inline-email's `responsive` option decides which layout markup a template is written in. Today it takes `true`, `false` or nothing, and only knows inline-email's built-in layout tags, so Inky markup collides with them: Inky's `<container>`, `<button>` and `<spacer>` are rendered as built-in tags and the result is broken tables. This change lets `responsive` name a Layout_Flavor: `'default'` for the built-in tags and `'inky'` for Inky, which the Library runs itself when the caller has installed it. Teams who write Inky drop it in with one option and keep compile-once, render-per-send, the preview and the CLI. Every existing value of `responsive` keeps its behaviour, the names leave room for more flavors later, and the README, reference and MIGRATION.md say how to use Inky with inline-email in one consistent way.

## Glossary

- **Library**: The `inline-email` npm package: its compile functions, exported types and CLI.
- **Layout_Flavor**: A named kind of layout markup that the Library turns into email table HTML before the Transform runs; `'default'` and `'inky'` are the flavors this change defines.
- **Built_In_Layout**: The Library's own layout step, which renders tags such as `<container>`, `<section>` and `<button>` into table markup; it is the `'default'` Layout_Flavor.
- **Layout_Tag**: A tag the Built_In_Layout renders, as listed in the reference's Responsive Layout Tags section.
- **Inky**: The `inky` npm package, Foundation for Emails' layout markup compiler: version 1.x, or the 2.x beta.
- **Inky_Markup**: HTML written with Inky's tags, such as `<container>`, `<row>`, `<columns>`, `<button>` and `<spacer>`.
- **Responsive_Option**: The `responsive` option of `compileEmailTemplate` and `inlineEmailHtml`.
- **Responsive_Flag**: The CLI's `--responsive <flavor>` option.
- **Transform**: The caller's `transform` function, run on the HTML after the layout step and before CSS inlining.
- **Combination_Table**: The table in Requirement 1 that maps each value of the Responsive_Option to its result.

## Requirements

### Requirement 1: Name the layout flavor in `responsive`

**User Story:** As a developer, I want to set `responsive` to the name of the layout markup I write, so that the option documents itself and does not overload `true`.

The Combination_Table is the contract for this requirement. In every row the Transform, when given, runs after the layout step.

| `responsive` | HTML has a Layout_Tag | Inky installed | Result |
| --- | --- | --- | --- |
| left out, or `{}` | yes | any | Built_In_Layout runs (as today) |
| left out, or `{}` | no | any | No layout step (as today) |
| `true`, or `{ enabled: true }` | any | any | Built_In_Layout runs (as today) |
| `false`, or `{ enabled: false }` | any | any | No layout step (as today) |
| `'default'` | any | any | Built_In_Layout runs, the same as `true` |
| `'inky'` | any | yes | Inky renders the HTML; Built_In_Layout does not run |
| `'inky'` | any | no | Compile rejects with an error that names the `inky` package and how to install it |
| any other string or type | any | any | Compile rejects with an error that lists the accepted values |

#### Acceptance Criteria

1. THE Library SHALL accept `'default'` and `'inky'` as values of the Responsive_Option, in its runtime checks and in its exported TypeScript types.
2. WHEN the Responsive_Option is `'default'`, THE Library SHALL produce output identical to the output for `true` given the same HTML, CSS and options.
3. WHEN the Responsive_Option is `true`, `false`, `{}`, `{ enabled: true }`, `{ enabled: false }` or left out, THE Library SHALL produce output identical to 4.0.2's for the same input.
4. IF the Responsive_Option is a string other than `'default'` or `'inky'`, or a value of another type not in the Combination_Table, THEN THE Library SHALL reject at compile time with an error that names the value given and lists the accepted values.
5. WHEN a Transform is given, THE Library SHALL run it after the layout step chosen by the Responsive_Option and before CSS inlining, for every row of the Combination_Table.

### Requirement 2: Render Inky markup with Inky

**User Story:** As a developer who writes Inky_Markup, I want `responsive: 'inky'` to run Inky for me, so that I get valid tables without writing a Transform or knowing that the Built_In_Layout must be turned off.

#### Acceptance Criteria

1. WHEN the Responsive_Option is `'inky'` and Inky is installed, THE Library SHALL render the HTML with the installed Inky, version 1 or 2, before the Transform and CSS inlining.
2. WHILE the Responsive_Option is `'inky'`, THE Library SHALL NOT run the Built_In_Layout, even when the HTML contains a Layout_Tag.
3. WHEN the Responsive_Option is `'inky'`, THE Library SHALL produce HTML in which every Inky_Markup tag has been rendered to table markup, with no `<row>`, `<columns>` or `<container>` tag left in the output.
4. IF the Responsive_Option is `'inky'` and Inky is not installed, THEN THE Library SHALL reject at compile time with an error that names the `inky` package and the command `npm install inky`, and SHALL NOT fall back to another Layout_Flavor.
5. IF Inky throws while rendering, THEN THE Library SHALL reject at compile time with Inky's error, not return partial HTML.
6. THE Library SHALL NOT list Inky in `dependencies`, so that installing the Library without Inky installs no Inky code and every value other than `'inky'` works without it.
7. THE Library SHALL NOT load Inky unless the Responsive_Option or Responsive_Flag is `'inky'`.
8. IF the installed `inky` package exports neither Inky 1's `Inky` class nor Inky 2's `transform` function, THEN THE Library SHALL reject at compile time with an error that names the Inky versions it supports.
9. IF the installed Inky is version 2 and the HTML contains a Handlebars partial (`{{>`), THEN THE Library SHALL reject at compile time with an error saying that Inky 2 escapes partials and that Inky 1 keeps them, rather than failing later with a Handlebars parse error.
10. IF the Responsive_Option is `'inky'` and the installed `inky` package fails to load, THEN THE Library SHALL reject at compile time with an error that says it could not load the `inky` package, with the load error as its cause.

### Requirement 3: Choose the flavor from the CLI

**User Story:** As a developer using the CLI, I want a `--responsive <flavor>` option, so that I can compile Inky_Markup or switch the layout off without writing a script.

#### Acceptance Criteria

1. WHEN the CLI is run with `--responsive default`, `--responsive inky` or `--responsive false`, THE Library SHALL compile as the Responsive_Option `'default'`, `'inky'` or `false` does.
2. WHEN the CLI is run without the Responsive_Flag, THE Library SHALL compile as 4.0.2's CLI does.
3. IF the Responsive_Flag has no value or a value other than `default`, `inky` or `false`, THEN THE CLI SHALL print an error naming the accepted values and exit with status 1.
4. IF the CLI is run with `--responsive inky` and Inky cannot be loaded, THEN THE CLI SHALL print the error from Requirement 2, criterion 4, and exit with status 1.
5. THE CLI's help text SHALL list the Responsive_Flag with its accepted values.

### Requirement 4: Document one way to use Inky

**User Story:** As a reader of the README, reference or MIGRATION.md, I want each to say the same thing about Inky, so that I can tell inline-email from Inky and use them together.

#### Acceptance Criteria

1. THE README's "When to use it" list SHALL include a line saying that Inky provides the layout markup and runs inside the Library through `responsive: 'inky'`, keeping compile-once, render-per-send, the preview and the CLI.
2. THE reference SHALL document the Responsive_Option's values with the Combination_Table, and the Responsive_Flag in its CLI section.
3. THE reference SHALL say that Inky's layout needs Foundation for Emails' CSS passed through `css` or `--css`, or the layout is unstyled.
4. THE reference SHALL say that Layout_Flavors do not mix: under `'inky'`, Layout_Tags that Inky does not know are passed through unrendered.
5. WHEN MIGRATION.md tells a reader to keep writing Inky, THE MIGRATION.md SHALL tell them to install `inky` and set `responsive: 'inky'` on 4.1.0 or later, in place of `responsive: false` with an Inky Transform, and SHALL say that the CLI now takes `--responsive inky`.
6. THE docs SHALL describe `'default'` as the preferred spelling of `true`, without deprecating `true`.
7. THE reference SHALL say that Inky 1 is stable but installs about 200 packages with known `npm audit` findings, that Inky 2 is a beta with no dependencies, and that Inky 2 cannot be used with Handlebars partials.

### Requirement 5: Release as a minor version

**User Story:** As a 4.x user, I want this to ship as a minor release, so that upgrading changes nothing I did not ask for.

#### Acceptance Criteria

1. THE pull request SHALL bump the version to 4.1.0.
2. THE packed-package check (`npm run test:package`) SHALL pass on a clean install without Inky.
3. IF any existing test of compiled output changes, THEN THE change SHALL be treated as a break of Requirement 1, criterion 3, and fixed rather than the test updated.

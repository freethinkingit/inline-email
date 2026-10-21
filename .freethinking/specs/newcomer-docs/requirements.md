# Requirements Document

## Introduction

inline-email's documentation and package metadata are reshaped for two readers: a developer meeting the project for the first time, and an assistant or index deciding whether to recommend it. Today the README is a 492-line reference that opens with examples and quality badges, the GitHub description and topics still describe the 2.x CSS-inlining CLI, and the five example templates are never walked through. After this work the README opens with the pitch, an end-to-end quickstart and an honest "when to use it" list, four task-shaped guides show the product doing real jobs with code that runs in the test suite, the reference moves to its own page, the metadata says what 4.0 is, and a root `llms.txt` gives assistants the same story in plain text. Nothing in the library's code changes.

## Glossary

- **Library**: The `inline-email` npm package and its repository on GitHub.
- **Newcomer**: A developer who has not used the Library and is deciding whether to, in one sitting.
- **Assistant**: A language model or search index that reads the Library's public text to describe or recommend it.
- **Pitch**: The short statement of what the Library is, who it is for, and why, in the author's words.
- **Quickstart**: A runnable sequence from install to a rendered email that a Newcomer can complete without reading anything else.
- **Neighbour**: Another tool a Newcomer might pick instead: MJML, React Email, or juice on its own.
- **Guide**: A page under `docs/` that teaches one job from start to finish with a complete example.
- **Guide_Example**: The code and template files a Guide shows, stored in the repository and executed by the test suite.
- **Reference**: The page under `docs/` that holds the full API, template syntax, layout tag and CLI detail moved out of the README.
- **Sample_Image**: One of the rendered-email screenshots under `docs/assets/`.
- **Metadata**: The `description`, `keywords` and `homepage` fields of `package.json`, and the description, topics and homepage URL of the GitHub repository.
- **Discovery_File**: The `llms.txt` file at the repository root.

## Requirements

### Requirement 1: Open the README with the Pitch and a Quickstart

**User Story:** As a Newcomer, I want the first screen of the README to tell me what the Library is, show it working, and say whether it is for me, so that I can decide in minutes.

#### Acceptance Criteria

1. THE README SHALL open, within its first 60 lines after the badges, with the Pitch, links to each Guide, the Reference and `MIGRATION.md`, and a "when to use it" list, followed by the Quickstart.
2. THE Pitch SHALL say that the Library is built to be simple and durable, to work across many email clients, and to make emails clear and easy, for teams that treat email as a necessary part of their product, worry about dependency bloat, and do not want to build on juice from scratch.
3. THE Quickstart SHALL go from `npm install` to a rendered `{ subject, html, text }` in one copyable sequence, with a template that uses a variable, a block and a slot, and SHALL be a Guide_Example so the suite runs it.
4. THE "when to use it" list SHALL name each Neighbour once, saying in one sentence when that Neighbour is the better choice, without disparaging it.
5. THE README SHALL keep exactly one Sample_Image above the fold and link the rest from an examples section.
6. THE README SHALL link each Guide, the Reference and `MIGRATION.md` from its first 60 lines after the badges.
7. THE README SHALL be at most 220 lines after the move of the Reference out of it.
8. IF a README section is moved to the Reference, THEN THE README SHALL keep a one-line pointer to it where the section was, so an existing deep link still lands near its content.

### Requirement 2: Teach four jobs with Guides

**User Story:** As a Newcomer, I want a guide for the job I actually have, so that I can copy a working pattern instead of assembling one from the reference.

#### Acceptance Criteria

1. THE Library SHALL ship four Guides under `docs/guides/`: a transactional email with slots and strict mode in tests; previewing a template with the CLI `--data` loop; helpers, partials and inlined images for a marketing email; and a data-heavy digest email built from arrays, `{{#each}}` with `@index`, conditions and formatting helpers.
2. WHEN a Guide shows code or a template, THE Library SHALL store it as a Guide_Example under `examples/guides/<guide-name>/` and show the file's content, so the page and the file cannot drift.
3. THE test suite SHALL execute every Guide_Example and assert the behaviour the Guide claims for it, including a strict render that throws for the transactional Guide and an embedded image for the marketing Guide.
4. THE CLI Guide SHALL run its commands against a Guide_Example in a test, asserting the rendered output, so the commands shown are the commands that work.
5. THE digest Guide's Guide_Example SHALL render with at least ten rows of data and SHALL be added to the example gallery the render script builds.
6. EACH Guide SHALL open with the job it teaches in one sentence and the time it takes, and close with the next Guide or Reference section to read.
7. IF a Guide_Example changes behaviour, THEN THE suite SHALL fail, since the Guide's assertions run against it.

### Requirement 3: Move the reference out of the README

**User Story:** As a returning user, I want the full detail in one place I can search, so that the README stays an introduction and the detail is not lost.

#### Acceptance Criteria

1. THE Library SHALL ship `docs/reference.md` holding the Library API, the `juice.webResources` options, the template syntax with escaping, slots, strict mode, helpers, partials and engine options, the responsive layout tags and tones, compile transforms, and the CLI options.
2. THE Reference SHALL carry every statement the moved README sections made, reworded only where the move requires it, so no documented behaviour is lost.
3. THE Reference SHALL open with a table of contents linking each section.
4. THE README's CLI options block SHALL stay a copy of the CLI's `usage()` text, in the Reference, line for line.

### Requirement 4: Align the Metadata with 4.0

**User Story:** As an Assistant, I want the package and repository metadata to describe the Library as it is, so that I describe and recommend it correctly.

#### Acceptance Criteria

1. THE Metadata SHALL describe the Library as compiling HTML and CSS into email-safe templates rendered with Handlebars per send, available as a Node library and a CLI, in the same sentence on npm and GitHub.
2. THE `package.json` keywords and the GitHub topics SHALL both include `handlebars`, `transactional-email`, `email-templates`, `juice` and `css-inlining`, and SHALL drop the 2.x terms `convert-html-files` and `inky`.
3. THE `package.json` `homepage` and the GitHub homepage URL SHALL point at the repository README.
4. IF the GitHub description or topics cannot be changed from the repository (they live in repository settings, not in a file), THEN THE task list SHALL record the exact `gh` commands for the author to run and the values they set.

### Requirement 5: Give Assistants a Discovery File

**User Story:** As an Assistant, I want one plain-text page that states what the Library is and where its documentation lives, so that I can answer about it without crawling the repository.

#### Acceptance Criteria

1. THE Library SHALL ship a Discovery_File at the repository root following the `llms.txt` convention: an H1 with the Library's name, a one-paragraph summary, and sections of links with a one-line description each.
2. THE Discovery_File SHALL link the README, each Guide, the Reference, `MIGRATION.md` and the npm package page, each with the one-line description.
3. THE Discovery_File SHALL be at most 60 lines and SHALL be included in the npm package through the `files` list.
4. IF the Discovery_File and the README disagree on the Pitch, THEN THE Discovery_File SHALL be treated as wrong and corrected, since the README is the source of the Pitch.

### Requirement 6: Change no library behaviour

**User Story:** As a maintainer, I want this to be documentation and metadata only, so that it can merge without a release and nothing a user runs changes.

#### Acceptance Criteria

1. THE work SHALL change no file under `src/`.
2. THE work SHALL add no runtime or development dependency.
3. THE work SHALL leave the existing test suite, the examples script and the visual snapshots passing, and SHALL add tests only for Guide_Examples.
4. THE work SHALL not include a hosted documentation site, an announcement or blog text, or screenshots beyond the existing Sample_Images.
5. IF writing a Guide reveals a missing library feature, THEN THE Guide SHALL work around it with what exists and the gap SHALL be recorded for a follow-up issue, not built.

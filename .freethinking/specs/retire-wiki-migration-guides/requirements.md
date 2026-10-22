# Requirements Document

## Introduction

inline-email's upgrade help is split between the repository and a GitHub wiki that nobody reviews and that has drifted from the code. This change makes `MIGRATION.md` the one place a user goes to upgrade from 2.x or 3.x straight to 4.x, opening with a prompt for each starting version that the user can paste into an AI assistant together with their code. It also cuts the README's pointer-only sections, points `llms.txt` at the migration paths and prompts, and turns the wiki off. Users upgrading get one current guide; maintainers keep one set of docs that is reviewed and tested.

## Glossary

- **Migration_Guide**: The file `MIGRATION.md` at the repository root, shipped in the npm package.
- **Upgrade_Path**: One starting major version and the steps from it to 4.x; there are two, From_2x and From_3x.
- **From_2x**: The Upgrade_Path for a project using inline-email 2.x, the CommonJS command-line tool with `lib/render.js` and the `--inky` flag.
- **From_3x**: The Upgrade_Path for a project using inline-email 3.x, the ESM library with its own template renderer.
- **Agent_Prompt**: A fenced text block in the Migration_Guide that a reader pastes into an AI assistant, followed by their code, to convert that code to 4.x.
- **Difference_Section**: A section of the Migration_Guide that names one behaviour that differs between a starting version and 4.x and shows it with a before and an after example.
- **Pointer_Section**: A README section whose only content is a link into `docs/reference.md`: Library API, Template Syntax, Responsive Layout Tags, Compile Transforms and CLI.
- **Docs_Line**: The README line beginning `**Docs:**` that links the guides, the reference and the Migration_Guide.
- **Wiki**: The GitHub wiki of `freethinkingit/inline-email`.
- **LLM_Index**: The file `llms.txt` at the repository root.

## Requirements

### Requirement 1: One migration guide for both starting versions

**User Story:** As a user on 2.x or 3.x, I want one guide that takes me to 4.x from where I am, so that I do not chain two guides or hunt in a wiki.

#### Acceptance Criteria

1. THE Migration_Guide SHALL cover exactly two Upgrade_Paths, From_2x and From_3x, each ending at 4.x.
2. THE Migration_Guide SHALL open, before any Difference_Section, with a short introduction that tells the reader which Upgrade_Path to follow by the version in their `package.json`.
3. THE Migration_Guide SHALL place both Agent_Prompts before every Difference_Section.
4. THE Migration_Guide SHALL group the Difference_Sections under one heading per Upgrade_Path.
5. IF a reader's version is older than 2.x, THEN THE Migration_Guide SHALL tell them to follow From_2x.

### Requirement 2: The 2.x agent prompt

**User Story:** As a user on 2.x, I want a prompt I can paste with my build scripts and code, so that an assistant converts them to working 4.x usage.

#### Acceptance Criteria

1. THE From_2x Agent_Prompt SHALL ask the reader to paste every place their project uses inline-email: CLI invocations in scripts, and code that calls `lib/render`.
2. THE From_2x Agent_Prompt SHALL give one numbered rule for each From_2x Difference_Section.
3. THE From_2x Agent_Prompt SHALL tell the assistant to leave code that already works under the rules unchanged and to change nothing else.
4. THE From_2x Agent_Prompt SHALL ask the assistant to return each converted file in full, followed by every change with its rule number and a one-line reason, then its questions.
5. IF the pasted code uses Inky markup, THEN THE From_2x Agent_Prompt SHALL tell the assistant to list each Inky tag with its nearest 4.x layout tag and to ask before replacing it.

### Requirement 3: The 3.x agent prompt

**User Story:** As a user on 3.x, I want the existing conversion prompt at the top of the guide, so that I can start converting without reading the details first.

#### Acceptance Criteria

1. THE From_3x Agent_Prompt SHALL keep the rules of the current prompt in `MIGRATION.md`, unchanged in meaning.
2. THE From_3x Agent_Prompt SHALL keep the same request for converted templates, changes with rule numbers, and questions.

### Requirement 4: The 2.x details

**User Story:** As a user on 2.x, I want each difference shown with a before and after, so that I can check the assistant's work and convert by hand.

#### Acceptance Criteria

1. THE Migration_Guide SHALL give one Difference_Section for each change between 2.x and 4.x that a 2.x project must act on: Node.js version, CommonJS to ESM, the `lib/render` call, CLI flags and defaults, Inky, template syntax that 4.x now renders, and CSS inlining behaviour.
2. THE Migration_Guide SHALL show every 4.x "after" example exactly as the current package produces or accepts it, checked by running it before the change is done.
3. THE Migration_Guide SHALL show every 2.x "before" example as 2.x source at tag `2.0.1` accepts it.
4. IF a 2.x behaviour has no 4.x equivalent, THEN THE Migration_Guide SHALL say so and name the nearest alternative.

### Requirement 5: The 3.x details

**User Story:** As a user on 3.x, I want the existing difference sections kept, so that nothing I rely on is lost in the reshuffle.

#### Acceptance Criteria

1. THE Migration_Guide SHALL keep every current 3.x Difference_Section and its examples under the From_3x heading, unchanged in meaning.
2. THE Migration_Guide SHALL keep the "What stays the same" list for From_3x.

### Requirement 6: A shorter README

**User Story:** As a newcomer reading the README, I want no sections that only point elsewhere, so that the page is short and every section says something.

#### Acceptance Criteria

1. THE README SHALL contain no Pointer_Section.
2. THE README SHALL contain one upgrade line that links the Migration_Guide for users on 2.x or 3.x, in place of the current 3.x note and the v2 wiki line.
3. THE README SHALL contain no link to the Wiki.
4. THE Docs_Line SHALL keep its links to every guide, `docs/reference.md` and the Migration_Guide.
5. IF the README structure checks in `test/docs.test.ts` fail after the change, THEN THE change SHALL be adjusted until they pass, without loosening the checks.

### Requirement 7: The LLM index

**User Story:** As an AI assistant reading `llms.txt`, I want entries for the upgrade paths and their prompts, so that I can send a user straight to the right one.

#### Acceptance Criteria

1. THE LLM_Index SHALL describe the Migration_Guide as covering 2.x and 3.x to 4.x.
2. THE LLM_Index SHALL link each Agent_Prompt by its heading anchor in the Migration_Guide.
3. IF an anchor in the LLM_Index does not match a heading in the Migration_Guide, THEN THE change SHALL not be done.

### Requirement 8: Retire the wiki

**User Story:** As the maintainer, I want the wiki turned off, so that no unreviewed, stale copy of the docs is left online.

#### Acceptance Criteria

1. THE repository SHALL contain no link to the Wiki outside closed specs under `.freethinking/specs/`.
2. WHEN the pull request carrying Requirements 1 to 7 has merged, THE Wiki SHALL be turned off with `has_wiki=false`.
3. IF the Wiki is turned off before that pull request merges, THEN THE Wiki SHALL be turned back on until it has merged.

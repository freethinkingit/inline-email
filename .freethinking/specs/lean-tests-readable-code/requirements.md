# Requirements Document

## Introduction

inline-email's code and tests are reworked in one pass so that a maintainer or contributor can read, change and review them with confidence. Today the repository has no coverage measurement and no linter, its tests repeat the same paths with different values while some awkward inputs are never tried, parts of the code lean on dense expressions that are hard to review, and its contributor and community files fall short of common open-source practice. After this work, coverage is measured and gated, a linter runs everywhere the tests run, every test file pressure-tests its code with one test per path, corner case or gotcha, every source, script, example and test file in the repository reads plainly without any change in behaviour, defects the new tests find are fixed, and the community files meet the open-source standard taken from the best of this repository and the freethinking developer handbook.

## Glossary

- **Repository**: Every tracked file of inline-email from its root down, excluding generated output (`dist/`, `examples/out/`, `coverage/`, lockfiles and visual snapshot images).
- **Source_Module**: One TypeScript file under `src/`.
- **Code_File**: Any hand-written JavaScript or TypeScript file in the Repository: Source_Modules, files under `scripts/`, guide example scripts under `examples/`, test files and their helpers, and tool configuration files.
- **Test_File**: Any file the test runners execute: the vitest files under `test/` and `examples/`, and the Playwright files under `test/visual/`.
- **Unit_Test_File**: A Test_File that exercises one Source_Module, named after it, such as `test/engine.test.ts` for `src/engine.ts`.
- **Module_Coverage**: The line and branch coverage of one Source_Module measured while running only its Unit_Test_File.
- **Coverage_Gate**: The minimum coverage that `npm test` enforces, failing the run when coverage falls below it.
- **Linter**: The static analysis tool that checks Code_Files for errors, unsafe patterns and missing docstrings on public contracts.
- **Path**: One distinct route through a unit of code: a branch, a loop's zero, one and many cases, or an error exit.
- **Redundant_Test**: A test that exercises a Path another test in the same file already exercises, differing only in values, names or mocks.
- **Awkward_Input**: One of a fixed set of hostile strings: emoji including joined sequences (a family emoji and a flag), a non-Latin script, a string of at least 10,000 characters, surrounding whitespace, whitespace only, a zero-width character, a control character, and a byte order mark.
- **Parsing_Unit**: Code that reads text a user supplies: CLI arguments, a JSON data file, a template, layout tag attributes and their numeric sizes, and style attributes read back from rendered HTML.
- **Defect**: A crash, hang or wrong result that a test shows in the current code.
- **Behaviour_Record**: A scratch script's recorded outputs of every exported function and CLI command over representative and edge-case inputs, used to prove a refactor changed no behaviour and deleted afterwards.
- **Public_Contract**: An exported function, class, type or constant of a Source_Module, and the `inline-email` command.
- **Community_File**: A file GitHub and open-source practice expect in a repository's root or `.github/`: README, LICENSE, CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, issue forms, pull request template, CODEOWNERS, Dependabot configuration and workflow files.
- **Handbook**: The freethinking developer handbook repository at `~/autohdr/developer-handbook`, the reference for repository structure and contributor documents.
- **Handbook_Gap**: A point where the Handbook's structure is weaker than this Repository's or than common open-source practice.

## Requirements

### Requirement 1: Measure and gate coverage

**User Story:** As a maintainer, I want coverage measured on every test run and enforced by a gate, so that slimming the tests or refactoring the code cannot silently drop what is tested.

#### Acceptance Criteria

1. THE Repository SHALL measure coverage with `@vitest/coverage-v8` at the major version that matches the installed vitest, as a development dependency.
2. THE Repository SHALL collect coverage for every Source_Module on every `npm test` run, as the house setup does, without a separate command.
3. THE Coverage_Gate SHALL start at the line and branch coverage measured across `src/` before any test is changed, rounded down to the whole percent.
4. IF a test run's coverage of `src/` falls below the Coverage_Gate, THEN `npm test` SHALL exit non-zero, so CI, the release workflow and a local run fail the same way.
5. THE Repository SHALL provide one documented command that reports Module_Coverage for a named Source_Module and its Unit_Test_File.
6. THE Repository SHALL ignore coverage output in git.
7. WHEN the tests have been slimmed and the Defects fixed, THE work SHALL add tests for uncovered Paths until coverage of `src/` reaches at least 95% of lines and 90% of branches, and every Source_Module at least 90% of lines and 85% of branches.
8. WHEN the coverage targets are met, THE Coverage_Gate SHALL be raised to the coverage then measured across `src/`, rounded down to the whole percent.
9. IF code can only run in a separate process, such as the CLI's entry block, THEN THE work SHALL exclude it from coverage with an inline ignore comment that states the reason, and SHALL exclude nothing else.

### Requirement 2: Lint every Code_File

**User Story:** As a contributor, I want a linter to flag errors and missing docs before review, so that review time goes to behaviour rather than style.

#### Acceptance Criteria

1. THE Repository SHALL lint every Code_File with ESLint using a flat configuration and the recommended TypeScript rules.
2. THE Linter SHALL require a docstring with intent, parameters, return value and thrown errors on every exported function and class of a Source_Module, and SHALL NOT require one on internal functions.
3. THE Repository SHALL provide an `npm run lint` script, and CI SHALL run it on every pull request and push to `master` before the tests.
4. WHEN the Linter is first added, THE Repository SHALL pass it with zero errors and zero warnings, through code fixes rather than rule exemptions, except where a single line carries an inline exemption with its reason.
5. IF a lint rule cannot be satisfied without changing a Public_Contract or behaviour, THEN THE work SHALL disable that rule for that line with its reason and record it in the report.

### Requirement 3: Slim every Test_File to one test per Path

**User Story:** As a maintainer, I want each test to pressure-test a distinct Path, corner case or gotcha, so that the suite is short enough to read and still catches real breakage.

#### Acceptance Criteria

1. THE work SHALL delete every Redundant_Test in every Test_File, keeping one test per Path, corner case or gotcha.
2. WHERE a behaviour depends on a numeric or size bound, THE tests SHALL cover it with boundary values (zero, one, the limit, one past the limit, empty, NaN and a negative value as they apply) instead of tables or cross products.
3. THE tests SHALL NOT assert that a constant equals its own value, that a library does what its documentation says, or that the code matches its implementation line by line.
4. WHERE a test needs a collaborator, THE test SHALL replace it only at the boundary (file system, process, clock, network, child process), preferring a small in-memory fake that enforces the real contract over a mock that accepts anything.
5. THE work SHALL keep shared fakes and fixtures in one directory under `test/` and SHALL NOT copy one between Test_Files.
6. EACH test's name SHALL state the behaviour it checks as a sentence.
7. THE work SHALL keep every Unit_Test_File's Module_Coverage of lines at or above its value before the change.
8. IF a branch of a Source_Module loses coverage, THEN that branch's only test SHALL have been a Redundant_Test, and the report SHALL name the branch and the deleted test.
9. THE work SHALL keep the documentation, guide, example, package and visual Test_Files checking every behaviour they check today, with Redundant_Tests removed, except that the visual Test_Files compare only each rendered email, not the page around it, by the author's choice, so that a change inside the email cannot pass under the page's background.

### Requirement 4: Try Awkward_Input on every Parsing_Unit

**User Story:** As a maintainer, I want every input parser tried with hostile text, so that a user's odd input is accepted or refused cleanly instead of crashing.

#### Acceptance Criteria

1. THE tests SHALL run each Parsing_Unit against the full Awkward_Input set, as one test per Parsing_Unit that iterates the set.
2. WHEN a Parsing_Unit receives an Awkward_Input, THE test SHALL assert that it either returns a result that keeps the input's text intact or throws the module's own error with a message, and that it never throws an unhandled `TypeError` or `RangeError`.
3. WHEN a Parsing_Unit receives the 10,000-character Awkward_Input, THE test SHALL assert that it finishes within 1 second.
4. IF an Awkward_Input shows a Defect, THEN THE work SHALL first commit the test marked as an expected failure (`it.fails`) with a one-line note naming the Defect, before any fix.

### Requirement 5: Fix every Defect the tests find

**User Story:** As a user, I want the defects this pass finds fixed in the same pass, so that the suite ends green with no known failures carried forward.

#### Acceptance Criteria

1. WHEN a Defect is found, THE work SHALL fix its root cause in the Source_Module and turn its expected-failure test into a passing test.
2. EACH Defect fix SHALL change only the behaviour the Defect describes, and the report SHALL list each Defect with its input, the wrong result and the fix.
3. IF a Defect lets template or style input inject markup, script or CSS, THEN THE work SHALL hold its fix and report it for a private security advisory instead of describing it in the pull request.
4. WHEN this work is finished, THE suite SHALL contain no expected-failure tests.

### Requirement 6: Make every Code_File read plainly

**User Story:** As a reviewer, I want the code written the way a person would write it, so that I can understand each function on first read.

#### Acceptance Criteria

1. THE work SHALL name every variable, parameter and function for what it is, with no one-letter names outside a trivial loop index and no abbreviations a newcomer must decode.
2. THE work SHALL replace nested ternaries, chained `&&`/`??`/`?.` logic used for control flow, and conditional object spreads with early returns or plain `if` blocks.
3. THE work SHALL break any call chain or expression that does more than one thing into named steps or helpers that read top to bottom.
4. THE work SHALL replace tricks with the obvious form: an explicit `null` and `undefined` check instead of loose equality, a named variable instead of destructuring with renames, and a loop instead of a `reduce` that builds an object.
5. WHERE the short form is the clearest one on first read, THE work SHALL keep it.
6. THE work SHALL ensure no function named like a question writes state, and no function mutates its arguments unless the mutation is required and the function's name says so.
7. THE work SHALL keep docstrings on Public_Contracts only, keep inline comments only where they explain a non-obvious reason, workaround or edge case, remove divider comments and commented-out code, and correct every comment that is untrue.
8. THE work SHALL NOT change any exported name, signature, CLI flag, output byte, error message, or the package's `files`, `exports` or `bin`.
9. WHEN a guide example file changes, THE guide page that quotes it SHALL change in the same commit, so the documentation tests stay green.

### Requirement 7: Prove the code's behaviour did not change

**User Story:** As a maintainer, I want evidence that the refactor changed nothing users see, so that it can ship without a behaviour review.

#### Acceptance Criteria

1. BEFORE any Code_File outside the tests changes, THE work SHALL record a Behaviour_Record against the current code.
2. WHEN the refactor is done, THE work SHALL run the same Behaviour_Record script unchanged against the new code and SHALL find no difference, except the outputs of fixed Defects, each named.
3. THE work SHALL delete the Behaviour_Record script and its outputs before the work is committed.
4. THE work SHALL leave the build, the type check, the Linter, the test suite with its Coverage_Gate, the examples script and the visual snapshots all passing.

### Requirement 8: Meet the open-source standard for Community_Files

**User Story:** As a newcomer or security reporter, I want the usual community files in their usual places, so that I know how to ask, report, contribute and report a vulnerability.

#### Acceptance Criteria

1. THE Repository SHALL have a SECURITY policy that sends reports to GitHub private vulnerability reporting, names the supported versions, and states a response time and a disclosure approach.
2. THE Repository SHALL replace the root `ISSUE_TEMPLATE.md` with YAML issue forms for a bug and a feature request, and a `config.yml` that disables blank issues and links the security policy and the documentation.
3. THE CONTRIBUTING guide SHALL describe setup, the one command that runs every offline check CI runs, and the network and macOS checks CI runs beyond it, lint, coverage and Module_Coverage, branch naming, issues and labels, and the release process.
4. THE Repository SHALL have a Dependabot configuration for npm and GitHub Actions updates, a CODEOWNERS file, and a SUPPORT file that says where questions go.
5. EACH workflow SHALL declare the least `permissions` it needs.
6. WHERE the Handbook has a structure or document this Repository lacks and common open-source practice supports it, THE Repository SHALL adopt it; WHERE this Repository's structure is stronger, THE Repository SHALL keep its own.
7. THE report SHALL list every Handbook_Gap found, each with what this Repository or common practice does better, so the author can raise it against the Handbook.
8. IF a Community_File change needs a repository setting rather than a file (labels, private vulnerability reporting, branch protection), THEN THE task list SHALL record the exact `gh` commands for the author to run.

### Requirement 9: Report the pass

**User Story:** As the author, I want one report that accounts for every change, so that I can review a repository-wide pass without reading every diff.

#### Acceptance Criteria

1. THE report SHALL give, per Test_File, the test count before and after, what was cut and why, the Awkward_Inputs added and the Defects found, and per Unit_Test_File the Module_Coverage before and after.
2. THE report SHALL list every Code_File changed with a one-line reason, every comment removed or rewritten, and every side effect found and whether it was removed or justified.
3. THE report SHALL list every dependency added with its version, and every lint exemption with its reason.

# Contributing

Thanks for helping improve Inline Email.

## Set up

You need Node.js 22 (22.13 or later) or Node.js 24 or later.
The repository's `.nvmrc` pins Node.js 24, so `nvm use` picks it.
CI runs on Node.js 22, 24 and 26.

```sh
nvm use
npm ci
```

## Run everything before a pull request

One command runs the checks that work offline: the lint, the build, the tests with the coverage gate, and the examples:

```sh
npm run check
```

CI runs the same steps on every pull request, plus three that `npm run check` leaves out.
Two need the network, so you can run them yourself when you are online:

```sh
npm run audit
npm run test:package
```

`npm run audit` checks the runtime dependencies for high-severity advisories.
`npm run test:package` packs the package, installs it in a fresh folder and runs its library and CLI.
The third is the visual tests on macOS, which you run with `npm run test:visual`.

While you work, run the tests in watch mode, with coverage off:

```sh
npm run test:watch
```

When you change layout primitives, examples or rendering, run the visual tests.
They compare each rendered example with an approved screenshot.
The approved screenshots exist only for macOS, so on Linux or Windows the visual tests have nothing to compare against.
Install the browser once before the first run, as CI does:

```sh
npx playwright install chromium
npm run test:visual
```

When a layout change is intended, update the screenshots and commit them:

```sh
npm run test:visual -- --update-snapshots
```

## Lint

The linter is ESLint, configured in `eslint.config.js`.

```sh
npm run lint
```

It applies the recommended JavaScript and TypeScript rules everywhere.
In `src/`, every exported function, class and public method needs a docstring.
The docstring says what the code is for, and describes each parameter, the return value and any error the function throws.
In `src/`, exports are named and declared where they are defined: no default exports and no `export { name }` lists.

The lint must report nothing.
If one line truly needs an exemption, disable that rule on that line only and say why in the same comment.

## Coverage

`npm test` measures line and branch coverage of `src/`, and fails below 99% for either.
The coverage gate is set in `vitest.config.ts`.

Every behaviour change comes with a test: new code, a changed behaviour or a bug fix.
A bug-fix test fails before the fix and passes after it.
Cover the code you add with tests rather than excluding it from coverage.
Two things are excluded.
`src/types.ts` holds only types, so it has no code to run.
The block in `src/cli.ts` that runs only when Node starts the file as its own process is excluded; its comment says why.

To see how well one module's own test file covers it, run:

```sh
npm run coverage:module -- compile
```

`coverage:module` accepts the modules `cli`, `compile`, `engine`, `template`, `layout` and `style`.
`src/index.ts` only re-exports them, so it is not one of them.
The `engine` module is measured with both the engine and the template tests.

## Branches and pull requests

Name your branch after its issue: `<issue>-<slug>`, for example `12-add-greeting`.
Never work on `master`.

Keep a pull request to one behaviour or feature.
Fill in the pull request template, and write `Closes #<issue>` when the pull request finishes the issue.

Update the docs when the public API or template syntax changes.
The API and syntax are documented in `docs/reference.md`, and the task guides in `docs/guides/`.
Code a guide shows lives under `examples/guides/` and is quoted byte for byte, which `test/docs.test.ts` checks.

## Issues and labels

Open an issue with one of the two forms: **Report a bug** or **Request a feature**.
Blank issues are turned off.

Ask questions in [Discussions Q&A](https://github.com/freethinkingit/inline-email/discussions/categories/q-a), not in an issue.
Report a security problem privately, as [`.github/SECURITY.md`](.github/SECURITY.md) describes, never in a public issue.

These are the labels used for triage. The repository has others, such as the ones Dependabot adds.

- `bug`: inline-email does something wrong. The bug form adds it.
- `enhancement`: a new feature or a change in behaviour. The feature form adds it.
- `documentation`: the docs are wrong or missing.
- `security`: a security fix, after it is disclosed.
- `good first issue`: a small, well-described change for a newcomer.
- `help wanted`: the maintainers welcome a pull request.
- `triage`: not yet reviewed by a maintainer. Both forms add it.

## Releases

A release is a version tag. Merging to `master` publishes nothing.

1. Bump the version in the pull request that completes the release, with `npm version <x.y.z> --no-git-tag-version`, so `package.json` and `package-lock.json` change together. Use a prerelease such as `4.1.0-beta.0` for anything users should opt into.
2. Merge, then wait for the CI run on `master` to pass.
3. Tag the merge commit and push the tag:

   ```sh
   git fetch origin master
   git tag v<x.y.z> origin/master
   git push origin v<x.y.z>
   ```

The Release workflow checks out the tag, runs the audit, build and tests again, fails if the tag does not match `package.json`, publishes to npm with a signed provenance statement through Trusted Publishing (no token is stored), and creates a GitHub Release with the tarball attached. A plain version publishes as `latest`; a prerelease publishes as `next`.

The registry can take a few minutes to show the new version after the workflow succeeds. A published version cannot be replaced: fix a bad release with a patch version, and tell users to pin the previous version meanwhile.

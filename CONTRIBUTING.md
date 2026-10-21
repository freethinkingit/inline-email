# Contributing

Thanks for helping improve Inline Email.

## Development

```sh
npm ci
npm run build
npm test
```

Run `npm run examples` when changing layout primitives, examples, or rendering behavior.

## Pull Requests

Before opening a pull request:

1. Keep changes focused on one behavior or feature.
2. Add or update tests for rendering, template syntax, or CLI changes.
3. Update the docs when the public API or template syntax changes: the API and syntax are documented in `docs/reference.md`, and the task guides in `docs/guides/`. Code a guide shows lives under `examples/guides/` and is quoted byte for byte, which `test/docs.test.ts` checks.
4. Run `npm audit --audit-level=high --omit=dev`, `npm run build`, and `npm test`.

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

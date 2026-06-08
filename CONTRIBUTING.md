# Contributing

Thanks for helping improve Inline Email.

## Development

```sh
npm install
npm run build
npm test
```

Run `npm run examples` when changing layout primitives, examples, or rendering behavior.

## Pull Requests

Before opening a pull request:

1. Keep changes focused on one behavior or feature.
2. Add or update tests for rendering, template syntax, or CLI changes.
3. Update `README.md` when the public API changes.
4. Run `npm audit --audit-level=high`, `npm run build`, and `npm test`.

## Releases

Package releases are created by pushing a version tag that matches `package.json`, for example `v3.0.0`.

The release workflow publishes `inline-email` to npm and creates a GitHub Release with the package tarball attached.

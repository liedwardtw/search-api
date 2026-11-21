# Contributing

## Layout

| File | Role |
| --- | --- |
| `index.js` | DSH host plugin: registers the `ego-google` search provider on `ctx.web`, spawns and supervises browser tasks |
| `ego-task.mjs` | Task script executed inside `ego-browser nodejs`: opens Google, extracts results, closes the space |
| `cordis.patch.yml` | Bundle patch: inserts the plugin row and sets `web.searchProvider: ego-google` |
| `locale/*.json` | Plugin Manager display metadata (`meta.title` / `meta.description`) |
| `icon.svg` | Plugin icon (36×36, exported as `./icon`) |
| `test/` | Standalone tests and SERP probes (not shipped in the npm tarball) |

The plugin has **zero dependencies** and imports nothing from DSH internals —
keep it that way so it activates on any profile. Configuration is validated
manually in `apply()`; do not add a `Config` export (it would require a host
schema package that profiles may not install).

## Testing

Requires ego-browser installed locally:

```sh
node test/test-provider.mjs
```

registers the provider against a mock `ctx.web` and runs one real Google
search. To check that no task spaces leak:

```sh
ego-browser nodejs -e "await import('file:///<abs-path>/test/probe-spaces.mjs')"
```

`test/probe-01.mjs` dumps the SERP DOM around the first result — useful when
Google changes its markup and snippet extraction needs updating (selectors
live in `extractInPage` in `ego-task.mjs`).

## Publishing a release

The npm package name is `dsh-ego-google-search` (unscoped → public).

1. Bump `version` in `package.json`.
2. `npm pack --dry-run` — confirm the tarball contains only the shipped files
   (`files[]` in `package.json`; `test/` must stay out).
3. Commit and push to GitHub.
4. `npm login` (if needed), then `npm publish --access public`.
   npm requires 2FA (or a publish-capable granular token) for publishing.
5. Verify: `npm view dsh-ego-google-search version`, then install
   `dsh-ego-google-search` through DSH **Plugins → Add plugin** and run a
   `web_search`.

GitHub installs (`github:liedwardtw/search-api`) track the repository's
default branch, so push before announcing a release.
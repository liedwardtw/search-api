# dsh-ego-google-search

[繁體中文](README.zh-TW.md)

Google web search for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness),
driven by your local [ego-browser (ego lite)](https://github.com/citrolabs/ego-lite).
Each `web_search` call:

1. opens a fresh ego-browser task space,
2. loads `https://www.google.com/search?q=…`,
3. extracts the organic results (title, URL, snippet, publish date),
4. **closes the space and its tabs** and returns the results.

Installing this bundle registers the `ego-google` search provider and sets it
as the profile's default search provider (`web.searchProvider`), replacing the
official DeepSeek search. The official providers remain installed and can be
re-selected in **Settings → Web search** at any time.

No API key, no build step, no dependencies — one Node file plus a browser-task
script. All searches run locally in your own browser session.

## Install

Requires DeepSeek Harness with the Plugin Manager (`plugin_manager` tool or
the **Plugins** page) and ego-browser (ego lite) installed on the same machine.

**Option A — straight from GitHub (recommended):** in DSH, open
**Plugins → Add plugin** and paste:

```
github:liedwardtw/search-api
```

or ask your agent: “install the plugin bundle `github:liedwardtw/search-api`”.
The full URL `https://github.com/liedwardtw/search-api` works too. Git must be
installed and able to reach github.com.

Nothing runs at install time: this bundle ships plain JavaScript with no
dependencies and no install/build scripts, so no build authorization is
needed. To pin exactly what you install, append a commit SHA:
`github:liedwardtw/search-api#<commit-sha>`.

**Option B — from a clone:**

```sh
git clone https://github.com/liedwardtw/search-api.git
```

Then **Plugins → Add plugin → local directory** and select the cloned folder
(absolute path). A local-directory install links the checkout, so `git pull`
updates the plugin in place (restart DSH to load new code).

**Option C — npm:**

```
dsh-ego-google-search
```

Works once the package is published to npm (see
[Publishing to npm](#publishing-to-npm) below).

After installation the provider is live immediately (`application: applied`);
the next `web_search` call already goes through Google. Verify in
**Settings → Web search**: the provider should read **Google (ego-browser)**.

## Requirements

- [ego-browser (ego lite)](https://github.com/citrolabs/ego-lite) installed on
  this machine. The plugin looks for the executable at the configured
  `egoPath`, at `$EGO_BROWSER_PATH`, at
  `~/.local/share/ego/active_version_dir/ego-browser.exe`, or on `PATH`.
- A network that can reach Google. If Google serves a CAPTCHA /
  unusual-traffic page, the search fails with `GOOGLE_BLOCKED`; open
  ego-browser, pass the check manually, and retry.

## Configuration

Defaults work out of the box. To tune them, edit the `web-search-ego-google`
row in your profile's `cordis.patch.yml`
(`~/.dsh/profiles/<profile>/cordis.patch.yml`) and restart DSH:

```yaml
- id: web-search-ego-google
  name: 'dsh-ego-google-search'
  config:
    hl: en            # Google interface language (default zh-TW)
    concurrency: 2    # simultaneous browser searches
```

| Key | Default | Meaning |
| --- | --- | --- |
| `egoPath` | auto-detect | Absolute path to the ego-browser executable |
| `concurrency` | `2` | Max simultaneous browser searches (multi-query tool calls queue) |
| `timeoutMs` | `45000` | Per-search budget, below the tool's 60 s call budget |
| `hl` | `zh-TW` | Google interface language |
| `googleDomain` | `www.google.com` | Google domain to query |

## Switch back to the official search

- **Temporarily:** Settings → Web search → pick a DeepSeek provider.
- **Permanently:** remove this bundle in **Plugins** (the `web` row override
  goes away with it), or override the `web` row in your profile's
  `cordis.patch.yml` with `searchProvider: deepseek-search-api`.

## How it works

`index.js` registers a search provider on DSH's `ctx.web` seam. Every search
spawns `ego-browser nodejs` with a generated UTF-8 task file (the query is
inlined as JSON); the task opens one tab, extracts results in-page, always
closes its task space (`task.finish({ keep: [] })`), and prints a single JSON
payload the plugin parses. An internal lane limiter caps concurrent browser
tasks; timeouts and cancellation kill the child process; temp scripts are
deleted after each run. The plugin imports nothing from DSH internals, so it
activates on any profile regardless of installed peer packages.

## Test

With ego-browser installed:

```sh
node test/test-provider.mjs
```

registers the provider against a mock context and runs one real Google
search. `test/probe-spaces.mjs` (run via `ego-browser nodejs`) confirms no
search task spaces are left behind.

## Limitations

- Returns organic links only — no AI answer/summary (the official provider's
  summary answer is not reproduced).
- One browser task per query; searches are slower than an API provider.
- Snippet extraction follows Google's current SERP markup (`.VwiC3b` /
  `[data-sncf]`); a Google redesign may degrade snippets to titles + URLs.
- Frequent automated queries may trigger Google's CAPTCHA (`GOOGLE_BLOCKED`).

## Publishing to npm

For maintainers. The package name `dsh-ego-google-search` is unscoped, so it
publishes public by default.

```sh
npm login          # opens the browser to authenticate your npm account
npm pack --dry-run # preview the exact tarball contents
npm publish --access public
```

If your npm account enforces 2FA for publishing, npm prompts for a one-time
code (or use a granular access token with publish permission). To ship an
update: bump `version` in `package.json`, commit, then `npm publish` again.
After publishing, anyone can install with just `dsh-ego-google-search` in
**Plugins → Add plugin**.

## License

[MIT](LICENSE)
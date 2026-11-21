# dsh-ego-google-search

[![npm version](https://img.shields.io/npm/v/dsh-ego-google-search)](https://www.npmjs.com/package/dsh-ego-google-search)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Google web search for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), running in your own browser.**

[繁體中文說明](README.zh-TW.md)

This DSH plugin replaces the default `web_search` provider with Google search
driven by [ego-browser (ego lite)](https://github.com/citrolabs/ego-lite) on
your machine. Each search:

1. opens a fresh, isolated ego-browser task space,
2. loads `https://www.google.com/search?q=…`,
3. extracts the organic results — title, URL, snippet, publish date,
4. **closes the space and its tabs**, and returns the results to the agent.

No API key. No search subscription. No build step, no dependencies. Queries
run locally in your own browser session and never pass through a third-party
search API.

## Requirements

- **DeepSeek Harness** with the Plugin Manager (**Plugins** page or the
  `plugin_manager` tool).
- **[ego-browser (ego lite)](https://github.com/citrolabs/ego-lite)** installed
  on the same machine.
- A network that can reach `google.com`.

The plugin finds the ego-browser executable automatically, in this order:
configured `egoPath` → `$EGO_BROWSER_PATH` →
`~/.local/share/ego/active_version_dir/ego-browser.exe` → `PATH`.

## Install

**From npm (recommended):** in DSH open **Plugins → Add plugin** and paste:

```
dsh-ego-google-search
```

or tell your agent: *“install the plugin bundle `dsh-ego-google-search`”*.

**From GitHub:** paste `github:liedwardtw/search-api` instead (requires Git).
Pin an exact revision with `github:liedwardtw/search-api#<commit-sha>`.

**From a clone:**

```sh
git clone https://github.com/liedwardtw/search-api.git
```

then **Plugins → Add plugin → local directory** and pick the cloned folder
(absolute path). A local-directory install links the checkout, so `git pull`
updates the plugin in place — restart DSH to load new code.

The package ships plain JavaScript with no dependencies and no install/build
scripts: nothing runs at install time, and no build authorization is needed.

### After installing

- The provider is live immediately — the next `web_search` call already goes
  through Google.
- **Settings → Web search** should show **Google (ego-browser)** as the
  provider.
- The official DeepSeek providers stay installed; this bundle only changes
  the default.

## Configuration

Defaults work out of the box. To tune them, edit the `web-search-ego-google`
row in your profile's `cordis.patch.yml`
(`~/.dsh/profiles/<profile>/cordis.patch.yml`) and restart DSH:

```yaml
- id: web-search-ego-google
  name: 'dsh-ego-google-search'
  config:
    hl: en          # Google interface language (default: zh-TW)
    concurrency: 2  # simultaneous browser searches
```

| Key | Default | Description |
| --- | --- | --- |
| `egoPath` | auto-detect | Absolute path to the ego-browser executable |
| `concurrency` | `2` | Max simultaneous browser searches; extra queries queue |
| `timeoutMs` | `45000` | Per-search budget (below the tool layer's 60 s limit) |
| `hl` | `zh-TW` | Google interface language (`en`, `ja`, …) |
| `googleDomain` | `www.google.com` | Google domain to query (e.g. `www.google.co.jp`) |

## Switching back to the official search

- **Temporarily:** Settings → Web search → pick a DeepSeek provider.
- **Permanently:** remove this bundle in **Plugins**, or override the `web`
  row in your profile's `cordis.patch.yml` with
  `searchProvider: deepseek-search-api`.

## Troubleshooting

| Error | Meaning / fix |
| --- | --- |
| `EGO_NOT_FOUND` | ego-browser executable not found. Install ego lite, or set `egoPath` to its absolute path. |
| `GOOGLE_BLOCKED` | Google served a CAPTCHA / unusual-traffic page. Open ego-browser, pass the check manually, then retry. |
| `EGO_SEARCH_TIMEOUT` | The search exceeded `timeoutMs`. Raise the budget or check your network. |
| `EGO_TASK_FAILED` | The browser task failed; the error message includes the last output lines. |

## How it works

`index.js` registers a search provider on DSH's `ctx.web` seam. Each search
spawns `ego-browser nodejs` with a generated UTF-8 task file (the query is
inlined as JSON). The task opens one tab, extracts results in-page, always
closes its task space (`task.finish({ keep: [] })`), and prints a single JSON
payload the plugin parses. An internal lane limiter caps concurrent browser
tasks; timeouts and cancellation kill the child process; temp scripts are
deleted after every run. The plugin imports nothing from DSH internals, so it
activates on any profile regardless of installed peer packages.

## Limitations

- Organic links only — no AI answer/summary like the official provider's.
- One browser task per query: slower than an API provider (typically a few
  seconds per search).
- Snippet extraction follows Google's current SERP markup (`.VwiC3b` /
  `[data-sncf]`); a Google redesign may degrade snippets to titles + URLs.
- Frequent automated queries may trigger Google's CAPTCHA.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for running the tests and publishing.

## License

[MIT](LICENSE)
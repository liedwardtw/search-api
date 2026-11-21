// Standalone test: exercise apply() with a mock ctx.web, run one search.
import { apply } from '../index.js'

let provider
const ctx = { web: { registerSearchProvider(p) { provider = p; return () => {} } } }
apply(ctx, {})

console.log('provider id:', provider.id)
console.log('available:', provider.available())
if (!provider.available()) { console.log('FAIL: ego-browser not found'); process.exit(1) }

const t0 = Date.now()
try {
  const result = await provider.search({ query: 'DeepSeek Harness', maxResults: 5 }, undefined)
  console.log(`OK in ${Date.now() - t0}ms — ${result.sources.length} sources, truncated=${result.truncated}`)
  for (const s of result.sources) console.log('-', s.title, '|', s.url, '|', (s.snippet || '').slice(0, 80), '|', s.publishedAt || '')
} catch (error) {
  console.log(`FAIL in ${Date.now() - t0}ms: [${error.code}] ${error.message}`)
  process.exit(1)
}
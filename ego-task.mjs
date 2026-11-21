// ego-browser Google search task. Runs INSIDE `ego-browser nodejs` (custom
// helpers: taskSpace, listTaskSpaces, task.finish). The plugin inlines its
// request object into REQUEST below, runs this file, and parses the single
// line printed after DSH_EGO_SEARCH_RESULT:. The task space is always closed
// before the process exits (task.finish({ keep: [] })).
const REQUEST = {"query":"placeholder","maxResults":10,"hl":"zh-TW","domain":"www.google.com","id":"placeholder"};

const MARKER = 'DSH_EGO_SEARCH_RESULT:';
const emit = (payload) => console.log(MARKER + JSON.stringify(payload));

// Unique per-search space name; the plugin never reuses spaces.
const task = await taskSpace(`dsh-web-search-${REQUEST.id}`);

// Runs in the PAGE. Google SERP organic results: each h3 belongs to one
// result title; its enclosing <a href> is the destination link. Snippets
// live in .VwiC3b / [data-sncf] blocks; a leading "Mon D, YYYY —" or CJK
// date prefix carries the publish date.
function extractInPage({ maxResults }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const isGoogleHost = (h) =>
    /(^|\.)google\.[a-z.]+$/.test(h) ||
    h === 'googleusercontent.com' ||
    h.endsWith('.googleusercontent.com') ||
    h === 'gstatic.com' ||
    h.endsWith('.gstatic.com');
  const out = [];
  const seen = new Set();
  for (const h3 of document.querySelectorAll('h3')) {
    if (out.length >= maxResults) break;
    const a = h3.closest('a[href]') || (h3.parentElement && h3.parentElement.closest('a[href]'));
    if (!a) continue;
    let url;
    try { url = new URL(a.href, location.href); } catch { continue; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    if (isGoogleHost(url.hostname)) continue;
    if (seen.has(url.href)) continue;
    const title = clean(h3.textContent);
    if (!title) continue;
    // Walk up to the result container that holds a snippet candidate.
    let container = a;
    for (let i = 0; i < 8 && container && container !== document.body; i++) {
      container = container.parentElement;
      if (container && container.querySelector('.VwiC3b, [data-sncf]')) break;
    }
    let snippet = '';
    if (container) {
      // Prefer .VwiC3b; reject header wrappers (they contain the h3/cite or
      // repeat the title) — some SERP variants mark them data-sncf too.
      for (const el of container.querySelectorAll('.VwiC3b, [data-sncf]')) {
        if (el.querySelector('h3, cite')) continue;
        const text = clean(el.textContent);
        if (!text || text.startsWith(title)) continue;
        snippet = text;
        if (el.classList.contains('VwiC3b')) break;
      }
    }
    snippet = snippet.replace(/\s*·\s*(翻譯這個網頁|翻译这个网页|Translate this page)\s*$/i, '');
    let publishedAt;
    const dateMatch = snippet.match(
      /^([A-Z][a-z]{2} \d{1,2}, \d{4}|\d{4}年\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})\s*[—–-]\s*/
    );
    if (dateMatch) {
      snippet = snippet.slice(dateMatch[0].length);
      const raw = dateMatch[1];
      let iso;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) iso = raw;
      else if (raw.includes('年')) {
        const m = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (m) iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
      } else {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
      }
      if (iso) publishedAt = iso;
    } else {
      // Relative dates: "3 天前 —", "2 hours ago —", "昨天 —" …
      const rel = snippet.match(/^(\d+)\s*(天|小时|小時|分钟|分鐘|days?|hours?|minutes?)\s*(?:前|ago)\s*[—–-]\s*/i)
        || snippet.match(/^(昨天|Yesterday)\s*[—–-]\s*/i);
      if (rel) {
        snippet = snippet.slice(rel[0].length);
        const unit = (rel[2] || '').toLowerCase();
        let ms;
        if (rel[1] === '昨天' || rel[1] === 'Yesterday') ms = 86400000;
        else {
          const n = Number(rel[1]);
          const per = /天|day/.test(unit) ? 86400000 : /小时|小時|hour/.test(unit) ? 3600000 : 60000;
          ms = n * per;
        }
        publishedAt = new Date(Date.now() - ms).toISOString().slice(0, 10);
      }
    }
    seen.add(url.href);
    out.push({
      url: url.href,
      title,
      ...(snippet ? { snippet: snippet.slice(0, 600) } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return {
    results: out,
    blocked: /\/sorry\/|unusual traffic|recaptcha/i.test(location.href + ' ' + document.title),
    resultStats: clean((document.querySelector('#result-stats') || {}).textContent || ''),
    url: location.href,
  };
}

try {
  const page = task.page('p1'); // a new space starts with p1; navigate it
  const params = new URLSearchParams({
    q: REQUEST.query,
    num: String(Math.min(Math.max(REQUEST.maxResults + 4, 10), 30)),
    hl: REQUEST.hl,
    pws: '0',
    nfpr: '1',
    filter: '0',
  });
  await page.goto(`https://${REQUEST.domain}/search?${params.toString()}`, { timeout: 30000 });
  await page.waitForLoadState();
  // Wait briefly for organic results; a blocked/empty page falls through to
  // extraction, which reports what it saw instead of hanging.
  try {
    await page.waitForSelector('#search h3', { state: 'visible', timeout: 8000 });
  } catch {}
  const data = await page.evaluate(extractInPage, { maxResults: REQUEST.maxResults });
  if (data.blocked) {
    emit({ ok: false, code: 'GOOGLE_BLOCKED', message: 'Google served a CAPTCHA / unusual-traffic page. Open ego-browser, pass the check manually, then retry.' });
  } else {
    emit({ ok: true, sources: data.results, resultStats: data.resultStats, finalUrl: data.url });
  }
} catch (error) {
  emit({ ok: false, code: 'EGO_TASK_FAILED', message: String((error && error.message) || error) });
} finally {
  // Always close the space and its tabs — "return results and close".
  try { await task.finish({ keep: [] }); } catch {}
}
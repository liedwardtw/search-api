// Probe: dump the DOM structure around the first organic result h3.
const task = await taskSpace('dsh-serp-probe-01');
try {
  const page = task.page('p1');
  await page.goto('https://www.google.com/search?q=DeepSeek+Harness&num=10&hl=zh-TW&pws=0', { timeout: 30000 });
  await page.waitForLoadState();
  try { await page.waitForSelector('#search h3', { state: 'visible', timeout: 8000 }); } catch {}
  const data = await page.evaluate(() => {
    const h3 = document.querySelector('#search h3');
    if (!h3) return { none: true, url: location.href };
    let block = h3;
    const chain = [];
    for (let i = 0; i < 8 && block && block !== document.body; i++) {
      block = block.parentElement;
      if (!block) break;
      chain.push({
        tag: block.tagName,
        cls: block.className && String(block.className).slice(0, 120),
        attrs: [...block.attributes].map(a => a.name).join(','),
        hasVwiC3b: !!block.querySelector('.VwiC3b'),
        sncfCount: block.querySelectorAll('[data-sncf]').length,
        textLen: (block.textContent || '').length,
      });
    }
    // find candidate snippet elements in the widest block
    const wide = h3.closest('div.g') || h3.parentElement?.parentElement?.parentElement?.parentElement;
    const candidates = [];
    if (wide) {
      for (const el of wide.querySelectorAll('.VwiC3b, [data-sncf], [data-snhf], .yXK7lf, .MUxGbd')) {
        candidates.push({
          cls: String(el.className).slice(0, 100),
          sncf: el.getAttribute('data-sncf'),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        });
      }
    }
    return { chain, wideCls: wide ? String(wide.className).slice(0, 120) : null, candidates, html: wide ? wide.outerHTML.slice(0, 3000) : null };
  });
  console.log('PROBE:' + JSON.stringify(data, null, 1));
} finally {
  try { await task.finish({ keep: [] }); } catch {}
}
// Verify: no leftover dsh-web-search task spaces after provider runs.
const spaces = await listTaskSpaces();
const leftovers = spaces.filter(s => String(s.name || '').startsWith('dsh-web-search-'));
console.log('SPACES:' + JSON.stringify({ total: spaces.length, leftovers: leftovers.map(s => ({ id: s.id, name: s.name })) }));
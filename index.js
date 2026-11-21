// dsh-ego-google-search — Google web search through the local ego-browser.
// Registers search provider 'ego-google' on ctx.web. Zero host-package
// imports: everything here is Node built-ins, so the plugin activates even
// though the desktop profile does not install optional peers.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const name = 'ego-google-search'
export const inject = ['web']

const HERE = fileURLToPath(new URL('.', import.meta.url))
const MARKER = 'DSH_EGO_SEARCH_RESULT:'

/** Resolve the ego-browser executable: config → env → default install path → PATH. */
function resolveEgoPath(configured) {
  const candidates = []
  if (typeof configured === 'string' && configured.trim() !== '') candidates.push(configured.trim())
  if (process.env.EGO_BROWSER_PATH) candidates.push(process.env.EGO_BROWSER_PATH)
  candidates.push(join(homedir(), '.local', 'share', 'ego', 'active_version_dir', 'ego-browser.exe'))
  const exeNames = process.platform === 'win32' ? ['ego-browser.exe', 'ego-browser.cmd'] : ['ego-browser']
  for (const dir of (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const exe of exeNames) candidates.push(join(dir.replace(/^"|"$/g, ''), exe))
  }
  for (const candidate of candidates) {
    try { if (existsSync(candidate)) return candidate } catch {}
  }
  return undefined
}

/** Manual config validation (no Config export: no host schema dependency). */
function readConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(Math.floor(v), lo), hi) : d)
  const str = (v, d) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : d)
  return {
    egoPath: str(c.egoPath, ''),
    concurrency: num(c.concurrency, 2, 1, 8),
    timeoutMs: num(c.timeoutMs, 45000, 5000, 300000),
    hl: str(c.hl, 'zh-TW'),
    googleDomain: str(c.googleDomain, 'www.google.com'),
  }
}

export function apply(ctx, rawConfig) {
  const config = readConfig(rawConfig)
  const template = readFileSync(join(HERE, 'ego-task.mjs'), 'utf8')
  const workDir = join(tmpdir(), 'dsh-ego-google-search')

  // Internal lane limiter: dsh-tool-web fires multi-query searches
  // concurrently; keep at most `concurrency` browser tasks in flight.
  let active = 0
  const queue = []
  const pump = () => {
    while (active < config.concurrency && queue.length > 0) {
      const next = queue.shift()
      active += 1
      next()
    }
  }
  const acquire = (signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return }
    const start = () => resolve()
    const entry = () => { signal?.removeEventListener('abort', onAbort); start() }
    const onAbort = () => {
      const i = queue.indexOf(entry)
      if (i >= 0) queue.splice(i, 1)
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    queue.push(entry)
    pump()
  })
  const release = () => { active -= 1; pump() }

  const abortError = () => Object.assign(new Error('web search cancelled'), { code: 'WEB_SEARCH_CANCELLED' })

  /** Spawn one ego-browser task and collect its marker payload. */
  function runEgoTask(egoPath, request, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(abortError()); return }
      const id = randomUUID()
      let scriptPath
      try {
        mkdirSync(workDir, { recursive: true })
        scriptPath = join(workDir, `task-${id}.mjs`)
        const inlined = template.replace(
          /^const REQUEST = .*$/m,
          `const REQUEST = ${JSON.stringify({
            query: request.query,
            maxResults: request.maxResults ?? 10,
            hl: config.hl,
            domain: config.googleDomain,
            id,
          })};`,
        )
        writeFileSync(scriptPath, inlined, 'utf8')
      } catch (error) {
        reject(Object.assign(new Error(`cannot prepare ego task: ${error.message}`), { code: 'EGO_TASK_FAILED' }))
        return
      }
      const cleanup = () => { try { rmSync(scriptPath, { force: true }) } catch {} }
      const fileUrl = 'file:///' + scriptPath.replace(/\\/g, '/')
      const child = spawn(egoPath, ['nodejs', '-e', `await import('${fileUrl}')`], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      let settled = false
      const finish = (fn, arg) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        cleanup()
        fn(arg)
      }
      const killChild = () => {
        // taskkill /T also reaps the node child the CLI spawned.
        if (process.platform === 'win32' && child.pid) {
          try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }) } catch {}
        }
        try { child.kill() } catch {}
      }
      const onAbort = () => { killChild(); finish(reject, abortError()) }
      const timer = setTimeout(() => {
        killChild()
        finish(reject, Object.assign(
          new Error(`ego-browser search timed out after ${config.timeoutMs}ms`),
          { code: 'EGO_SEARCH_TIMEOUT' },
        ))
      }, config.timeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      child.stdout.on('data', (d) => { stdout += d.toString('utf8'); if (stdout.length > 4_000_000) stdout = stdout.slice(-2_000_000) })
      child.stderr.on('data', (d) => { stderr += d.toString('utf8'); if (stderr.length > 200_000) stderr = stderr.slice(-100_000) })
      child.on('error', (error) => finish(reject, Object.assign(new Error(`cannot launch ego-browser: ${error.message}`), { code: 'EGO_TASK_FAILED' })))
      child.on('close', (code) => {
        // ego-browser routes script console.log to stderr; scan both streams.
        const combined = stdout + '\n' + stderr
        const markerAt = combined.lastIndexOf(MARKER)
        if (markerAt >= 0) {
          const line = combined.slice(markerAt + MARKER.length).split('\n')[0].trim()
          try {
            const payload = JSON.parse(line)
            if (payload.ok) { finish(resolve, payload); return }
            finish(reject, Object.assign(new Error(payload.message || 'ego task failed'), { code: payload.code || 'EGO_TASK_FAILED' }))
            return
          } catch {}
        }
        const tail = (stderr || stdout).trim().split('\n').slice(-6).join('\n')
        finish(reject, Object.assign(
          new Error(`ego-browser exited (code ${code}) without a search result${tail ? `: ${tail}` : ''}`),
          { code: 'EGO_TASK_FAILED' },
        ))
      })
    })
  }

  ctx.web.registerSearchProvider({
    id: 'ego-google',
    title: 'Google (ego-browser)',
    description: {
      en: 'Searches Google in the local ego-browser and closes the tab afterwards. Requires ego-browser to be installed.',
      zh: '透過本機 ego-browser 開啟 Google 搜尋，取得結果後自動關閉分頁。需要已安裝 ego-browser。',
      'zh-tw': '透過本機 ego-browser 開啟 Google 搜尋，取得結果後自動關閉分頁。需要已安裝 ego-browser。',
    },
    available: () => resolveEgoPath(config.egoPath) !== undefined,
    async search(request, signal) {
      const egoPath = resolveEgoPath(config.egoPath)
      if (egoPath === undefined) {
        throw Object.assign(
          new Error('ego-browser executable not found; install ego lite or set egoPath in the web-search-ego-google plugin config'),
          { code: 'EGO_NOT_FOUND' },
        )
      }
      await acquire(signal)
      try {
        const payload = await runEgoTask(egoPath, request, signal)
        const max = request.maxResults ?? 10
        const sources = payload.sources.slice(0, max)
        return { sources, truncated: payload.sources.length > sources.length }
      } finally {
        release()
      }
    },
  })
}
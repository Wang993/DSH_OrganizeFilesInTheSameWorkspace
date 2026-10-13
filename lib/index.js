import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Package root: lib/index.js -> package root. Keeps the bundle relocatable
// when installed as a normal DSH npm plugin (node_modules or a local link).
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// DSH home: tag memory lives here so node_modules stays read-only safe.
const DSH_HOME = process.env.DSH_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '.', '.dsh')
const TAGS_FILE = path.join(DSH_HOME, '.dsh-organizer-tags.json')

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

const MAX_TAGS_PER_SESSION = 8
const MAX_TAG_LENGTH = 24
// state.json response cache window: bounds how often the (potentially log-scanning)
// title fold runs while the client polls.
const STATE_TTL_MS = 5000

const name = 'dsh-session-organizer'
const inject = ['webServer', 'workspaceRegistry', 'sessionQuery']

function readTags() {
  try {
    const parsed = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.tags && typeof parsed.tags === 'object') return parsed.tags
  } catch (err) {}
  return {}
}

function writeTags(tags) {
  try {
    fs.mkdirSync(path.dirname(TAGS_FILE), { recursive: true })
    fs.writeFileSync(TAGS_FILE, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), tags }), 'utf8')
    return true
  } catch (err) {
    return false
  }
}

function sanitizeTags(input) {
  const seen = new Set()
  const out = []
  if (!Array.isArray(input)) return out
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const tag = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_TAGS_PER_SESSION) break
  }
  return out
}

function readBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function basename(p) {
  if (!p) return ''
  const parts = String(p).split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] || String(p)
}

function apply(ctx) {
  const disposers = []
  const stateCache = { at: 0, value: null, inFlight: null }

  function workspaces() {
    try {
      return ctx.workspaceRegistry.list().map((w) => ({ id: String(w.id), title: w.title, path: w.path }))
    } catch (err) {
      return []
    }
  }

  async function buildState() {
    if (!ctx.sessionQuery) return { ok: false, error: 'sessionQuery service unavailable' }
    const records = await ctx.sessionQuery.listSessions()

    // Blank live stubs (never sent a turn) are the sidebar's hidden rows; mirror that.
    const blankIds = new Set()
    const sessionsService = ctx.get('sessions')
    if (sessionsService) {
      for (const session of sessionsService.list()) {
        if (!session.events.some((event) => event.type === 'turn/start')) blankIds.add(String(session.id))
      }
    }

    const archivedSet = new Set((ctx.workspaceRegistry.archivedSessionIds || []).map(String))
    const tags = readTags()
    const ws = workspaces()
    const wsByPath = new Map(ws.map((w) => [w.path, w]))

    const kept = records.filter((r) => {
      const header = r && r.header
      if (!header) return false
      if (blankIds.has(String(header.id))) return false
      if (header.origin === 'subagent') return false
      return true
    })

    const titles = new Map()
    try {
      const results = await ctx.sessionQuery.readTitleSnapshots(kept.map((r) => r.header.id))
      for (const result of results) {
        if (!result || result.status !== 'fulfilled') continue
        const value = result.value
        const snap = value && value.title
        if (snap && typeof snap.title === 'string' && snap.title) titles.set(String(result.sessionId), snap.title)
      }
    } catch (err) {}

    const sessionsOut = kept.map((r) => {
      const header = r.header
      const id = String(header.id)
      const cwd = header.cwd
      const workspace = cwd === void 0 ? void 0 : wsByPath.get(cwd)
      return {
        id,
        title: titles.get(id) || `会话 ${id.slice(0, 8)}`,
        cwd: cwd === void 0 ? null : cwd,
        workspaceId: workspace ? workspace.id : null,
        workspaceTitle: workspace ? workspace.title : (cwd ? basename(cwd) : null),
        createdAt: typeof header.createdAt === 'number' ? header.createdAt : null,
        archived: archivedSet.has(id),
        tags: Array.isArray(tags[id]) ? tags[id] : [],
      }
    })

    const allTags = [...new Set(sessionsOut.flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    return { ok: true, workspaces: ws, sessions: sessionsOut, allTags, archivedCount: archivedSet.size }
  }

  async function getState() {
    const now = Date.now()
    if (stateCache.value && now - stateCache.at < STATE_TTL_MS) return stateCache.value
    if (stateCache.inFlight) return stateCache.inFlight
    stateCache.inFlight = buildState()
      .then((value) => {
        stateCache.value = value
        stateCache.at = Date.now()
        return value
      })
      .catch((error) => ({ ok: false, error: String((error && error.message) || error) }))
      .finally(() => {
        stateCache.inFlight = null
      })
    return stateCache.inFlight
  }

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-organizer/state.json',
    handler: async (req, res) => {
      const payload = await getState()
      res.writeHead(200, JSON_HEADERS)
      res.end(JSON.stringify(payload))
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-organizer/archive',
    handler: async (req, res) => {
      try {
        const body = JSON.parse(await readBody(req))
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        const archived = !!body.archived
        if (!sessionId) throw new Error('missing sessionId')
        if (archived) {
          await ctx.workspaceRegistry.archiveSession(sessionId)
        } else {
          const state = ctx.workspaceRegistry.requireState()
          await ctx.workspaceRegistry.setState({
            ...state,
            archivedSessionIds: state.archivedSessionIds.filter((id) => String(id) !== sessionId),
          })
        }
        stateCache.at = 0
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({ ok: true }))
      } catch (error) {
        res.writeHead(400, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String((error && error.message) || error) }))
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-organizer/tags',
    handler: async (req, res) => {
      try {
        const body = JSON.parse(await readBody(req))
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
        if (!sessionId) throw new Error('missing sessionId')
        const tags = sanitizeTags(body.tags)
        const all = readTags()
        all[sessionId] = tags
        if (!writeTags(all)) throw new Error('failed to persist tags')
        stateCache.at = 0
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({ ok: true, tags }))
      } catch (error) {
        res.writeHead(400, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, error: String((error && error.message) || error) }))
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-organizer/organizer.js',
    handler: (req, res) => {
      try {
        const bytes = fs.readFileSync(path.join(PACKAGE_ROOT, 'lib', 'organizer.js'))
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': String(bytes.length),
        })
        res.end(bytes)
      } catch (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('organizer client unavailable: ' + String((error && error.message) || error))
      }
    },
  }))

  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.indexOf('/dsh-organizer/organizer.js') !== -1) return html
    const tag = '<script defer src="/dsh-organizer/organizer.js"></script>'
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
    return html + tag
  }))

  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) {}
    }
  })
}

export { name, inject, apply }

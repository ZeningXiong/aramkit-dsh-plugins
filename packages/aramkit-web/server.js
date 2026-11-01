import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { randomBytes } from 'node:crypto'
import { createService } from '../aramkit-core/service.js'
import * as data from '../aramkit-live/data.js'
import { createAiReview } from './ai-review.js'
import { createPostgameStore } from './recent-postgame.js'
import { createMatchHistoryStore } from './match-history.js'

const publicDir = new URL('./public/', import.meta.url)
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
])
const fail = (message, status = 400) => Object.assign(new Error(message), { status })
function dataset(params) {
  const value = params.get('dataset') || 'all'
  if (!['all', 'high'].includes(value)) throw fail('无效的分段。')
  return value
}
function text(params, key, max = 150) {
  const value = (params.get(key) || '').trim()
  if (value.length > max) throw fail('查询内容过长。')
  return value
}
function flag(params, key, defaultValue) {
  if (!params.has(key)) return defaultValue
  const value = params.get(key)
  if (!['0', '1'].includes(value)) throw fail('无效的开关参数。')
  return value === '1'
}
function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}
async function jsonBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw fail('请使用 JSON 请求。', 415)
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > 16384) throw fail('请求过大。', 413)
  }
  let parsed
  try { parsed = JSON.parse(body || '{}') } catch { throw fail('JSON 格式错误。') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw fail('请求体必须是 JSON 对象。')
  return parsed
}

export function createApp({ service = createService(), dataApi = data, aiApi, aiOptions, postgameStore = createPostgameStore(), historyStore = createMatchHistoryStore() } = {}) {
  const rememberPostgame = async (game) => {
    await postgameStore.save(game).catch(() => {})
    await historyStore.record(game)
  }
  const reviewService = { ...service, async postgame(options) {
    if (options?.gameId !== undefined) {
      const entry = await historyStore.get(options.gameId)
      return entry ? { ok: true, cached: true, postgame: entry.postgame } : { ok: false, error: '没有找到这局记录，可能已超过 24 小时。请在对局记录中重新选择。' }
    }
    const result = await service.postgame(options)
    if (result.ok) { await rememberPostgame(result.postgame); return result }
    const saved = await postgameStore.load()
    if (saved) { await historyStore.record(saved); return { ok: true, cached: true, restored: true, postgame: { ...saved, source: 'local-snapshot' } } }
    const latest = (await historyStore.list())[0]
    return latest ? { ok: true, cached: true, restored: true, postgame: { ...(await historyStore.get(latest.gameId)).postgame, source: 'local-history' } } : result
  } }
  const ai = aiApi || createAiReview({ ...aiOptions, service: reviewService, historyStore })
  const csrf = randomBytes(24).toString('hex')
  const pending = new Map()
  // Multiple open tabs share in-flight reads instead of duplicating game/API requests.
  function once(key, fn) {
    if (!pending.has(key)) pending.set(key, Promise.resolve().then(fn).finally(() => pending.delete(key)))
    return pending.get(key)
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('referrer-policy', 'no-referrer')
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://data.aramkit.cn data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    try {
      const address = server.address()
      const origin = `http://127.0.0.1:${address.port}`
      if (request.headers.host !== `127.0.0.1:${address.port}`) throw fail('请使用本机启动器提供的地址。', 403)
      if ((request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') throw fail('仅允许本机页面访问。', 403)
      const url = new URL(request.url, origin)
      const p = url.searchParams
      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        const [file, contentType] = staticFiles.get(url.pathname)
        response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-cache' })
        response.end(await readFile(new URL(file, publicDir)))
        return
      }
      if (!url.pathname.startsWith('/api/')) throw fail('页面不存在。', 404)
      if (request.method === 'POST') {
        if (request.headers['x-aramkit-session'] !== csrf) throw fail('请刷新页面后重试。', 403)
        const body = await jsonBody(request)
        if (url.pathname === '/api/ai/config') { send(response, 200, await ai.saveConfig(body)); return }
        if (url.pathname === '/api/ai/test') { send(response, 200, await ai.testConnection()); return }
        if (url.pathname === '/api/ai/review') { send(response, 200, await ai.review(body)); return }
        if (url.pathname === '/api/connect') {
          if (body.lockfile !== undefined && (typeof body.lockfile !== 'string' || body.lockfile.length > 1024)) throw fail('lockfile 路径无效。')
          const diagnostic = await service.diagnose({ lockfile: body.lockfile || undefined })
          send(response, 200, { ...diagnostic, status: await service.status({ reconnect: true }) })
          return
        }
        if (url.pathname === '/api/shutdown') {
          send(response, 200, { ok: true })
          setImmediate(() => { server.close(); server.closeIdleConnections() })
          return
        }
        throw fail('接口不存在。', 404)
      }
      if (request.method !== 'GET') throw fail('不支持此操作。', 405)
      let result
      switch (url.pathname) {
        case '/api/health': result = { ok: true, app: 'aramkit-web', version: '0.3.0', independent: true }; break
        case '/api/history': {
          const legacy = await postgameStore.load()
          if (legacy) await historyStore.record(legacy)
          result = { ok: true, entries: await historyStore.list() }
          break
        }
        case '/api/history/detail': {
          const gameId = text(p, 'gameId', 80)
          if (!/^[A-Za-z0-9_-]{1,80}$/.test(gameId)) throw fail('对局编号无效。')
          const entry = await historyStore.get(gameId)
          if (!entry) throw fail('没有找到这局记录，可能已超过 24 小时。', 404)
          result = { ok: true, entry }
          break
        }
        case '/api/ai/config': result = await ai.getConfig(); break
        case '/api/session': result = { ok: true, csrf }; break
        case '/api/status': result = await once('status', () => service.status()); break
        case '/api/champions': result = await once(`champions:${dataset(p)}`, () => dataApi.listChampions(dataset(p))); break
        case '/api/champion': {
          const id = Number(p.get('id'))
          if (!Number.isSafeInteger(id) || id < 1 || id > 100000) throw fail('英雄 ID 无效。')
          result = await once(`champion:${id}:${dataset(p)}`, () => dataApi.buildChampionPayload(id, dataset(p)))
          break
        }
        case '/api/augments': {
          const rarity = p.get('rarity') || undefined
          if (rarity && !['gold', 'silver', 'prismatic'].includes(rarity)) throw fail('海克斯品质无效。')
          result = await service.searchAugments({ query: text(p, 'q', 100), rarity, limit: 60 })
          const resources = await dataApi.getResources()
          result.augments = result.augments.map((row) => ({ ...row, icon: resources.augments?.[row.id]?.icon ? `https://data.aramkit.cn/${resources.augments[row.id].icon.replace(/^\/+/, '')}` : '' }))
          break
        }
        case '/api/rating': {
          const riotId = text(p, 'riotId')
          if (!/^.+#[^#]+$/.test(riotId)) throw fail('请输入完整的 昵称#Tag。')
          result = await service.playerRating({ riotId })
          break
        }
        case '/api/state': {
          const options = { includeRatings: flag(p, 'ratings', false), anonymize: flag(p, 'anonymous', true) }
          result = await once(`state:${JSON.stringify(options)}`, () => service.gameState(options))
          if (result.postgame) await rememberPostgame(result.postgame)
          break
        }
        case '/api/postgame': result = await once(`postgame:${p.get('anonymous')}`, () => reviewService.postgame({ anonymize: flag(p, 'anonymous', true) })); break
        default: throw fail('接口不存在。', 404)
      }
      send(response, 200, result)
    } catch (error) {
      if (!response.headersSent) send(response, error.status || 502, { ok: false, error: error.message || '读取失败，请重试。' })
      else response.end()
    }
  })
  server.requestTimeout = 150000
  return server
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.ARAMKIT_WEB_PORT || 3210)
  const server = createApp()
  server.on('error', (error) => { process.stderr.write(`海斗助手启动失败：${error.code === 'EADDRINUSE' ? '端口已占用，请重新运行启动器。' : error.message}\n`); process.exitCode = 1 })
  server.listen(port, '127.0.0.1', () => process.stdout.write(`海斗助手 http://127.0.0.1:${port}\n`))
}

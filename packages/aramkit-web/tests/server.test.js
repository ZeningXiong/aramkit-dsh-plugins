import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createApp } from '../server.js'

async function fixture(run, { savedGame = null, historyStore = { record: async () => {}, list: async () => [], get: async () => null } } = {}) {
  const calls = []
  const service = {
    status: async () => ({ ok: true, connected: true, phase: 'Lobby' }),
    gameState: async (args) => { calls.push(args); return { ok: true, connected: true, phase: 'Lobby' } },
    postgame: async () => ({ ok: false, error: '尚无结算' }),
    searchAugments: async () => ({ ok: true, total: 1, augments: [{ id: 1, name: '测试海克斯' }] }),
    playerRating: async (args) => ({ ok: true, ...args }),
    diagnose: async (args) => { calls.push(args); return { ok: true } },
  }
  const dataApi = {
    listChampions: async () => ({ ok: true, champions: [{ id: 157, title: '亚索' }] }),
    buildChampionPayload: async (id, dataset) => ({ ok: true, champion: { id }, dataset }),
    getResources: async () => ({ augments: { 1: { icon: 'assets/test.png' } } }),
  }
  const aiApi = {
    getConfig: async () => ({ ok: true, configured: false }),
    saveConfig: async (input) => ({ ok: true, configured: Boolean(input.apiKey) }),
    testConnection: async () => ({ ok: true, modelVisible: true }),
    review: async () => ({ ok: true, review: { summary: '测试五人锐评', players: [] } }),
  }
  const postgameStore = { save: async () => {}, load: async () => savedGame }
  const server = createApp({ service, dataApi, aiApi, postgameStore, historyStore })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try { await run({ base, calls }) } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections() })
  }
}

test('独立 HTTP 服务提供页面、静态资源和健康状态，无需 MCP 客户端', async () => fixture(async ({ base }) => {
  const html = await fetch(base)
  assert.equal(html.status, 200)
  assert.match(await html.text(), /海斗助手/)
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  const health = await (await fetch(`${base}/api/health`)).json()
  assert.equal(health.independent, true)
  for (const file of ['app.js', 'style.css', 'icon.svg']) assert.equal((await fetch(`${base}/${file}`)).status, 200)
  assert.equal((await fetch(`${base}/server.js`)).status, 404)
}))

test('查询接口验证英雄、分段和开关；默认匿名且不查队友隐藏分', async () => fixture(async ({ base, calls }) => {
  assert.equal((await fetch(`${base}/api/champion?id=-1`)).status, 400)
  assert.equal((await fetch(`${base}/api/champions?dataset=bad`)).status, 400)
  assert.equal((await fetch(`${base}/api/state?anonymous=bad`)).status, 400)
  const build = await (await fetch(`${base}/api/champion?id=157&dataset=high`)).json()
  assert.equal(build.champion.id, 157)
  assert.equal(build.dataset, 'high')
  await fetch(`${base}/api/state`)
  assert.deepEqual(calls[0], { includeRatings: false, anonymize: true })
  assert.equal((await fetch(`${base}/api/rating?riotId=missingtag`)).status, 400)
}))

test('本机 API 拒绝跨站读取与伪造 Host', async () => fixture(async ({ base }) => {
  assert.equal((await fetch(`${base}/api/state`, { headers: { origin: 'https://example.com' } })).status, 403)
  assert.equal((await fetch(`${base}/api/health`, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403)
  const wrongHostStatus = await new Promise((resolve, reject) => {
    const request = http.get(`${base}/api/health`, { headers: { host: 'example.com' } }, (response) => { response.resume(); resolve(response.statusCode) })
    request.on('error', reject)
  })
  assert.equal(wrongHostStatus, 403)
}))

test('连接与退出需要当前页面会话标记，拒绝任意内容', async () => fixture(async ({ base, calls }) => {
  const missing = await fetch(`${base}/api/connect`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(missing.status, 403)
  const { csrf } = await (await fetch(`${base}/api/session`)).json()
  const headers = { 'content-type': 'application/json', 'x-aramkit-session': csrf }
  const invalid = await fetch(`${base}/api/connect`, { method: 'POST', headers, body: JSON.stringify({ lockfile: {} }) })
  assert.equal(invalid.status, 400)
  const valid = await fetch(`${base}/api/connect`, { method: 'POST', headers, body: JSON.stringify({ lockfile: 'C:\\game\\lockfile' }) })
  assert.equal(valid.status, 200)
  assert.deepEqual(calls[0], { lockfile: 'C:\\game\\lockfile' })
  assert.equal((await fetch(`${base}/api/shutdown`, { method: 'GET' })).status, 404)
}))

test('AI 设置和生成使用 POST 与会话校验，不可通过 GET 触发付费请求', async () => fixture(async ({ base }) => {
  assert.equal((await (await fetch(`${base}/api/ai/config`)).json()).configured, false)
  assert.equal((await fetch(`${base}/api/ai/review`)).status, 404)
  assert.equal((await fetch(`${base}/api/ai/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 403)
  const { csrf } = await (await fetch(`${base}/api/session`)).json()
  const headers = { 'content-type': 'application/json', 'x-aramkit-session': csrf }
  assert.equal((await fetch(`${base}/api/ai/config`, { method: 'POST', headers, body: 'null' })).status, 400)
  const result = await (await fetch(`${base}/api/ai/review`, { method: 'POST', headers, body: '{}' })).json()
  assert.equal(result.review.summary, '测试五人锐评')
}))

test('最新结算不可用时返回带标记的本机最近结算，便于升级后重试', async () => fixture(async ({ base }) => {
  const response = await (await fetch(`${base}/api/postgame`)).json()
  assert.equal(response.ok, true)
  assert.equal(response.restored, true)
  assert.equal(response.postgame.gameId, 42)
  assert.equal(response.postgame.source, 'local-snapshot')
}, { savedGame: { gameId: 42, allies: [] } }))

test('历史列表与详情不要求 API Key，读取不会触发模型，参数与跨站访问受限', async () => {
  const entry = { gameId: 'previous', postgame: { gameId: 'previous', allies: [] }, reviews: [{ result: { review: { summary: '已保存的上一局评价' } } }] }
  const historyStore = { record: async () => {}, list: async () => [{ gameId: entry.gameId, reviewCount: 1 }], get: async (id) => id === entry.gameId ? entry : null }
  await fixture(async ({ base }) => {
    assert.equal((await (await fetch(`${base}/api/ai/config`)).json()).configured, false)
    assert.equal((await (await fetch(`${base}/api/history`)).json()).entries[0].gameId, 'previous')
    const detail = await (await fetch(`${base}/api/history/detail?gameId=previous`)).json()
    assert.equal(detail.entry.reviews[0].result.review.summary, '已保存的上一局评价')
    assert.equal((await fetch(`${base}/api/history/detail?gameId=missing`)).status, 404)
    assert.equal((await fetch(`${base}/api/history/detail?gameId=..%2Ffile`)).status, 400)
    assert.equal((await fetch(`${base}/api/history`, { headers: { origin: 'https://example.com' } })).status, 403)
  }, { historyStore })
})

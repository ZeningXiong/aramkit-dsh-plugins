import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../server.js'
import { createMatchHistoryStore } from '../match-history.js'

test('完整 HTTP 链路：下一局开始后可评价上一局，重启后查看与复用均不再次调用模型', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-history-http-test-'))
  const file = path.join(directory, 'history.json')
  const game = (gameId, champion) => ({ gameId, capturedAt: Date.now(), gameLength: 600, win: true, totals: {}, allies: Array.from({ length: 5 }, (_, i) => ({ gameName: 'fictional-private-name', tagLine: 'fictional-private-tag', puuid: 'fictional-private-id', isLocalPlayer: i === 0, champion: { name: champion }, items: [], augments: [], kills: 1, deaths: 2, assists: 3, damage: 100 })) })
  let current = game('game-one', '旧局英雄'), server
  const modelCalls = []
  async function open() {
    server = createApp({
      service: { gameState: async () => ({ ok: true, connected: true, phase: 'EndOfGame', postgame: current }), postgame: async () => ({ ok: true, postgame: current }) },
      postgameStore: { load: async () => null, save: async () => {} },
      historyStore: createMatchHistoryStore({ file }),
      aiOptions: {
        store: { load: async () => null, save: async () => {} },
        fetchImpl: async (url, options) => {
          modelCalls.push(JSON.parse(options.body))
          return Response.json({ status: 'completed', output_text: JSON.stringify({ summary: '人工测试总结', players: Array.from({ length: 5 }, (_, i) => ({ playerId: `p${i + 1}`, verdict: '正常发挥', score: 75, title: '人工测试标题', comment: '根据人工统计数据评价', suggestion: '人工测试建议' })) }) })
        },
      },
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    const { csrf } = await (await fetch(`${base}/api/session`)).json()
    const get = async (route) => (await fetch(`${base}/api/${route}`)).json()
    const post = async (route, body) => (await fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-aramkit-session': csrf }, body: JSON.stringify(body) })).json()
    const configure = () => post('ai/config', { baseUrl: 'https://api.example.test/v1', model: 'fixture-model', apiKey: 'fixture-only-key', remember: false })
    return { get, post, configure }
  }
  const close = () => new Promise((resolve) => { server.close(resolve); server.closeIdleConnections() })
  try {
    let client = await open()
    await client.get('state')
    await client.configure()
    assert.equal((await client.post('ai/review', { gameId: 'game-one' })).gameId, 'game-one')
    current = game('game-two', '新局英雄')
    await client.get('state')
    const old = await client.post('ai/review', { gameId: 'game-one', style: 'coach' })
    assert.equal(old.gameId, 'game-one')
    assert.match(JSON.stringify(modelCalls.at(-1)), /旧局英雄/)
    assert.doesNotMatch(JSON.stringify(modelCalls), /新局英雄|fictional-private/)
    assert.equal((await client.get('history/detail?gameId=game-one')).entry.reviews.length, 2)
    assert.equal((await client.get('history/detail?gameId=game-two')).entry.reviews.length, 0)
    await close()
    client = await open()
    assert.equal((await client.get('ai/config')).configured, false)
    assert.equal((await client.get('history')).entries.length, 2)
    assert.equal((await client.get('history/detail?gameId=game-one')).entry.reviews[0].result.review.players.length, 5)
    await client.configure()
    assert.equal((await client.post('ai/review', { gameId: 'game-one' })).cached, true)
    assert.equal(modelCalls.length, 2)
    const missing = await client.post('ai/review', { gameId: 'missing-game' })
    assert.equal(missing.ok, false)
    assert.equal(modelCalls.length, 2)
  } finally {
    if (server?.listening) await close()
    for (const entry of await readdir(directory)) await unlink(path.join(directory, entry))
    await rmdir(directory)
  }
})

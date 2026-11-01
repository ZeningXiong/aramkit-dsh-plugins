import test from 'node:test'
import assert from 'node:assert/strict'
import { createService, sanitize } from '../service.js'

const champions = [
  { id: 157, name: '亚索', title: '疾风剑豪', slug: 'yasuo', rank: 1, icon: 'unused' },
  { id: 777, name: '永恩', title: '封魔剑魂', slug: 'yone', rank: 2 },
]
function fixture() {
  const calls = []
  let phase = 'ChampSelect'
  let connected = true
  let clock = 1000000
  let eog = { gameId: 1 }
  const postgame = { gameId: 1, augmentsReady: false, allies: [{ gameName: '秘密昵称', tagLine: '1234', puuid: 'secret-puuid', summonerId: 42, isLocalPlayer: true, champion: { name: '亚索' } }] }
  const dataApi = {
    listChampions: async () => ({ ok: true, version: 'test', champions }),
    buildChampionPayload: async (id, dataset) => ({ ok: true, champion: { id }, dataset }),
    getResources: async () => ({ version: { version: 'test' }, augments: { 1: { name: '珠光护手', rarity: 'gold', tooltip: { blocks: [{ spans: [{ type: 'text', text: '技能可以暴击' }] }] } } } }),
    queryRating: async (...args) => { calls.push(args); return { ok: true, rating: 3000 } },
  }
  const lcuApi = {
    discoverLcu: async () => connected ? { source: 'lockfile', password: 'secret-token', port: 1234 } : null,
    getGameflowPhase: async () => phase,
    resetLcuCache: () => calls.push('reset'),
    getChampSelectSession: async () => ({ localPlayerCellId: 0 }),
    getEogStatsBlock: async () => eog,
    inspectLockfile: () => ({ valid: false, reason: '空文件' }),
    diagnoseLcu: async () => ({ ok: true, active: { password: 'secret-token', port: 1234 } }),
  }
  const modelApi = {
    buildChampSelect: async (session, current, phase, options) => {
      calls.push(options)
      return { team: [{ gameName: '秘密昵称', tagLine: '1234', puuid: 'secret-puuid', isSelf: true }], top5: [{ name: '亚索' }] }
    },
    buildInGameFromLive: async () => null,
    buildPostgame: async () => postgame,
    formatReviewData: (game) => ({ allies: game.allies.map((row) => ({ name: row.gameName, champion: row.champion.name })) }),
  }
  return { service: createService({ dataApi, lcuApi, modelApi, now: () => clock }), calls,
    setPhase: (value) => { phase = value }, disconnect: () => { connected = false },
    setEog: (value) => { eog = value }, tick: (amount) => { clock += amount } }
}

test('搜索支持中文称号、英文和 ID，并限制输出数量', async () => {
  const { service } = fixture()
  for (const query of ['亚索', '疾风', 'YASUO', '157']) {
    assert.equal((await service.searchChampions({ query })).champions[0].id, 157)
  }
  const all = await service.searchChampions({ limit: 1 })
  assert.equal(all.total, 2)
  assert.equal(all.champions.length, 1)
  assert.equal(all.champions[0].icon, undefined)
})

test('英雄详情区分唯一、歧义和未找到，并传递分段', async () => {
  const { service } = fixture()
  assert.deepEqual(await service.championBuild({ champion: 'Yasuo', dataset: 'high' }), { ok: true, champion: { id: 157 }, dataset: 'high' })
  assert.equal((await service.championBuild({ champion: '剑' })).candidates.length, 2)
  assert.equal((await service.championBuild({ champion: '不存在' })).ok, false)
})

test('海克斯查询保留说明，支持品质过滤', async () => {
  const { service } = fixture()
  assert.equal((await service.searchAugments({ query: '珠光' })).augments[0].description, '技能可以暴击')
  assert.equal((await service.searchAugments({ rarity: 'silver' })).total, 0)
})

test('隐藏分仅提交指定 Riot ID，返回估算声明', async () => {
  const { service, calls } = fixture()
  const result = await service.playerRating({ riotId: '玩家#1234' })
  assert.deepEqual(calls[0], ['玩家', '1234'])
  assert.match(result.notice, /不是 Riot 官方/)
  await assert.rejects(service.playerRating({ riotId: '缺少Tag' }), /昵称#Tag/)
})

test('找到 lockfile 但端点无响应时不误报已连接，也不输出令牌', async () => {
  const f = fixture()
  const status = await f.service.status()
  assert.equal(status.connected, true)
  assert.equal(status.password, undefined)
  f.setPhase(null)
  assert.equal((await f.service.status()).connected, false)
  f.disconnect()
  assert.equal((await f.service.status()).connected, false)
})

test('选人默认匿名、不查询队友隐藏分；显式参数可以开启', async () => {
  const f = fixture()
  const result = await f.service.gameState()
  assert.deepEqual(f.calls[0], { includeRatings: false })
  const serialized = JSON.stringify(result)
  for (const secret of ['秘密昵称', '"tagLine"', 'secret-puuid', 'secret-token']) assert.equal(serialized.includes(secret), false)
  assert.equal(result.champSelect.team[0].gameName, '你')
  const named = await f.service.gameState({ includeRatings: true, anonymize: false })
  assert.deepEqual(f.calls[1], { includeRatings: true })
  assert.equal(named.champSelect.team[0].gameName, '秘密昵称')
})

test('结算缓存十分钟过期，复盘由调用方生成，默认只带匿名名字', async () => {
  const f = fixture()
  const review = await f.service.prepareReview({ style: 'data' })
  assert.equal(review.ok, true)
  assert.equal(review.augmentsReady, false)
  assert.equal(review.data.allies[0].name, '你')
  assert.match(review.instructions, /不额外|无需另一个模型/)
  assert.equal(JSON.stringify(review).includes('秘密昵称'), false)
  f.setEog(null)
  assert.equal((await f.service.postgame()).cached, true)
  f.tick(10 * 60 * 1000 + 1)
  assert.equal((await f.service.postgame()).ok, false)
})

test('诊断不返回凭据，错误 lockfile 不能生效', async () => {
  const { service } = fixture()
  assert.deepEqual(await service.diagnose(), { ok: true, active: { port: 1234 } })
  await assert.rejects(service.diagnose({ lockfile: 'config.json' }), /lockfile/)
  await assert.rejects(service.diagnose({ lockfile: 'C:\\game\\lockfile' }), /空文件/)
})

test('递归移除凭据和账户标识，不删除英雄与装备名称', () => {
  assert.deepEqual(sanitize({ token: 'x', players: [{ password: 'y', puuid: 'z', champion: { name: '亚索' } }] }), { players: [{ champion: { name: '亚索' } }] })
})

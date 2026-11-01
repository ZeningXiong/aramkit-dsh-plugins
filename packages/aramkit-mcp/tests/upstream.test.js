import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createService } from '../service.js'
import { buildChampSelect, buildInGameFromLive, buildPostgame } from '../../aramkit-live/index.js'
import { resetLcuCache } from '../../aramkit-live/lcu.js'

let fakeLcu, temp, port, phase = 'ChampSelect', ratingRequests = 0
const originalFetch = globalThis.fetch
const originalLockfile = process.env.ARAMKIT_LCU_LOCKFILE
const eog = { gameId: 123, gameLength: 600, teams: [
  { teamId: 100, players: [{ championId: 777, summonerName: '敌方', stats: {} }] },
  { teamId: 200, isWinningTeam: true, players: [{ puuid: 'local-id', championId: 157, summonerName: '真名', tagLine: 'secret-tag', stats: { KILLS: 10, DEATHS: 2, ASSISTS: 20, GOLD_EARNED: 10000, TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 30000, TOTAL_HEAL: 9999, TOTAL_HEAL_ON_TEAMMATES: 500, PLAYER_AUGMENT1: 1 } }] },
] }

before(async () => {
  globalThis.fetch = async (url) => {
    const pathname = new URL(url).pathname
    let payload
    if (pathname.endsWith('/versions.json')) payload = { latest: 'fixture', versions: [{ version: 'fixture', dataPath: 'data/fixture', resourcePath: 'data/fixture', dataDate: '2026-10-29' }] }
    else if (pathname.endsWith('/champions.json')) payload = { 157: { name: '疾风剑豪', title: '亚索', slug: 'yasuo' }, 777: { name: '封魔剑魂', title: '永恩', slug: 'yone' } }
    else if (pathname.endsWith('/champion-rankings.json')) payload = { rows: [{ id: 157, rank: 1, winRate: 0.6 }, { id: 777, rank: 2, winRate: 0.5 }] }
    else if (pathname.endsWith('/augments.json')) payload = { 1: { name: '测试海克斯', rarity: 'gold' } }
    else if (pathname === '/rating') { ratingRequests += 1; payload = { code: 200, data: { rating: 3000 } } }
    else if (/\/(items|summoner-spells|archetypes)\.json$/.test(pathname)) payload = {}
    else throw new Error(`Unexpected fixture request: ${pathname}`)
    return { ok: true, json: async () => payload }
  }
  fakeLcu = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.headers.authorization !== `Basic ${Buffer.from('riot:fixture-only-token').toString('base64')}`) {
      response.writeHead(401).end('{}')
      return
    }
    let payload = null
    if (request.url === '/lol-gameflow/v1/gameflow-phase') payload = phase
    else if (request.url === '/lol-champ-select/v1/session') payload = { localPlayerCellId: 0, myTeam: [{ cellId: 0, summonerId: 1, championId: 157 }], benchChampions: [{ championId: 777 }] }
    else if (request.url === '/lol-summoner/v1/summoners/1') payload = { gameName: '真名', tagLine: 'secret-tag', puuid: 'local-id' }
    else if (request.url === '/lol-summoner/v1/current-summoner') payload = { puuid: 'local-id' }
    else if (request.url === '/lol-end-of-game/v1/eog-stats-block') payload = eog
    else if (request.url.startsWith('/lol-match-history/')) payload = { games: { games: [] } }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(payload))
  })
  await new Promise((resolve, reject) => { fakeLcu.once('error', reject); fakeLcu.listen(0, '127.0.0.1', resolve) })
  port = fakeLcu.address().port
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'aramkit-test-'))
  const lockfile = path.join(temp, 'lockfile')
  await fs.writeFile(lockfile, `LeagueClient:1:${port}:fixture-only-token:http`)
  process.env.ARAMKIT_LCU_LOCKFILE = lockfile
  resetLcuCache()
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalLockfile === undefined) delete process.env.ARAMKIT_LCU_LOCKFILE
  else process.env.ARAMKIT_LCU_LOCKFILE = originalLockfile
  resetLcuCache()
  if (fakeLcu) await new Promise((resolve) => fakeLcu.close(resolve))
  // Delete only the one known temporary fixture; never recurse across paths.
  if (temp) { await fs.unlink(path.join(temp, 'lockfile')); await fs.rmdir(temp) }
})

test('真实上游选人逻辑+模拟 LCU：默认无隐藏分请求，显式启用后才查询', async () => {
  const service = createService()
  const state = await service.gameState()
  assert.equal(state.connected, true)
  assert.equal(state.champSelect.currentChampionId, 157)
  assert.equal(state.champSelect.top5.length, 2)
  assert.equal(ratingRequests, 0)
  assert.equal(JSON.stringify(state).includes('fixture-only-token'), false)
  assert.equal(JSON.stringify(state).includes('真名'), false)
  const session = { localPlayerCellId: 0, myTeam: [{ cellId: 0, summonerId: 1, championId: 157 }] }
  const originalDsh = await buildChampSelect(session, null, 'ChampSelect')
  assert.equal(ratingRequests, 1)
  assert.equal(originalDsh.team[0].rating.value, 3000)
})

test('真实上游结算逻辑通过当前账户识别红方，正确统计队友治疗', async () => {
  phase = 'EndOfGame'
  const result = await createService().prepareReview()
  assert.equal(result.ok, true)
  assert.equal(result.data.result, '胜利')
  assert.equal(result.data.allies.length, 1)
  assert.equal(result.data.allies[0].name, '你')
  assert.equal(result.data.allies[0].teammateHealing, 500)
  assert.equal(result.data.allies[0].metrics.damageShare, 100)
  assert.equal(result.data.allies[0].augments[0].name, '测试海克斯')
  assert.equal(JSON.stringify(result).includes('secret-tag'), false)
  assert.equal(JSON.stringify(result).includes('local-id'), false)
})

test('无法识别本机玩家时不把蓝方误认作友方', async () => {
  await assert.rejects(buildPostgame({ ...eog, teams: [{ teamId: 100, players: [{ championId: 157, stats: {} }] }] }), /无法确定本机玩家/)
})

test('局内支持新 Riot ID，身份缺失时不把前五人当友方', async () => {
  const live = { activePlayer: { riotId: '真名#Tag' }, allPlayers: [{ riotId: '真名#Tag', championId: 157, team: 'CHAOS', scores: { kills: 3, deaths: 1, assists: 5, creepScore: 42 }, level: 9 }, { riotId: '敌方#Tag', championId: 777, team: 'ORDER' }] }
  const known = await buildInGameFromLive(live)
  assert.equal(known.allies.length, 1)
  assert.equal(known.allies[0].isSelf, true)
  assert.equal(known.allies[0].kills, 3)
  assert.equal(known.allies[0].cs, 42)
  const unknown = await buildInGameFromLive({ ...live, activePlayer: {} })
  assert.deepEqual(unknown.allies, [])
  assert.match(unknown.message, /无法确定/)
})

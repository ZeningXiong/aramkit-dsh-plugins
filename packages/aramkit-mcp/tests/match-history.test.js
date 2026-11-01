import test from 'node:test'
import assert from 'node:assert/strict'
import { recoverLatestPostgame } from '../../aramkit-core/match-history.js'
import { createService } from '../service.js'
import { formatReviewData } from '../../aramkit-live/index.js'

function fixture() {
  const now = () => 1000000000
  const summary = { gameId: 123, gameMode: 'KIWI', gameCreation: now() - 600000, gameDuration: 500, participants: [{ participantId: 6 }] }
  const game = { ...summary, participantIdentities: Array.from({ length: 10 }, (_, i) => ({ participantId: i + 1, player: { puuid: i === 5 ? 'fixture-self' : `fixture-other-${i}` } })), participants: Array.from({ length: 10 }, (_, i) => ({ participantId: i + 1, teamId: i < 5 ? 100 : 200, championId: 100 + i, stats: { win: i >= 5, kills: 1, deaths: 2, assists: 3, totalMinionsKilled: 42, timeCCingOthers: 8 } })) }
  let detailReads = 0
  const lcuApi = {
    discoverLcu: async () => ({ source: 'fixture', port: 1234 }), getGameflowPhase: async () => 'Lobby', getEogStatsBlock: async () => null,
    getCurrentSummoner: async () => ({ puuid: 'fixture-self' }), getLatestMatchForPuuid: async () => summary,
    getMatchDetails: async () => { detailReads++; return game },
  }
  const modelApi = { formatReviewData, buildPostgame: async (eog, options) => {
    assert.equal(options.matchGame, game)
    const team = eog.teams.find((row) => row.players.some((player) => player.isLocalPlayer))
    assert.equal(team.teamId, 200)
    assert.equal(team.players[0].stats.MINIONS_KILLED, 42)
    assert.equal(team.players[0].stats.TOTAL_CC_TIME, 8)
    return { gameId: eog.gameId, gameMode: eog.gameMode, gameLength: eog.gameLength, win: team.isWinningTeam, augmentsReady: true, totals: { healing: 500 }, allies: team.players.map((row) => ({ isLocalPlayer: row.isLocalPlayer, puuid: row.puuid, gameName: 'fictional-private-name', championId: row.championId, champion: { name: '测试英雄' }, items: [], healing: 100, metrics: { healShare: 20 } })) }
  } }
  return { summary, game, lcuApi, modelApi, now, detailReads: () => detailReads }
}

test('离开结算回到大厅后补读完整比赛详情，识别红方五人并默认匿名', async () => {
  const f = fixture()
  const service = createService(f)
  const state = await service.gameState()
  assert.equal(state.phase, 'Lobby')
  assert.equal(state.postgame.source, 'client-history')
  assert.equal(state.postgame.allies.length, 5)
  assert.equal(state.postgame.win, true)
  assert.equal(state.postgame.capturedAt, f.now() - 100000)
  assert.equal(state.postgame.allies[0].gameName, '你')
  assert.doesNotMatch(JSON.stringify(state), /fixture-self|fixture-other|fictional-private-name/)
  await service.postgame()
  assert.equal(f.detailReads(), 1, '重复查询只复用短时缓存')
})

test('比赛历史缺少队友治疗时保留未知值并提示，不能把 totalHeal 当队友治疗', async () => {
  const f = fixture()
  f.game.participants.forEach((row) => { row.stats.totalHeal = 99999 })
  const result = await recoverLatestPostgame(f)
  assert.equal(result.allies[0].healing, null)
  assert.equal(result.totals.healing, null)
  assert.equal(result.allies[0].metrics.healShare, null)
  const review = formatReviewData(result)
  assert.equal(review.teamTotals.teammateHealing, null)
  assert.equal(review.allies[0].teammateHealing, null)
  assert.match(review.dataWarnings[0], /不得按零治疗/)
})

test('超过一天、未结束、其他模式、身份不符或人数不完整的历史不补读', async () => {
  const cases = [
    (f) => { f.summary.gameCreation = f.now() - 25 * 3600000 },
    (f) => { f.summary.gameCreation = f.now() },
    (f) => { f.summary.gameMode = 'CLASSIC' },
    (f) => { f.game.participantIdentities = [] },
    (f) => { f.game.participants.pop() },
    (f) => { f.game.gameId = 456 },
  ]
  for (const change of cases) { const f = fixture(); change(f); assert.equal(await recoverLatestPostgame(f), null) }
})

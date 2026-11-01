// Recover only the current account's latest recent ARAM result via fixed local GETs.
// The matches list contains only the local player; the detail endpoint contains both teams.
export async function recoverLatestPostgame({ lcuApi, modelApi, now = Date.now }) {
  if (!lcuApi.getCurrentSummoner || !lcuApi.getLatestMatchForPuuid || !lcuApi.getMatchDetails) return null
  const current = await lcuApi.getCurrentSummoner()
  if (!current?.puuid) return null
  const summary = await lcuApi.getLatestMatchForPuuid(current.puuid)
  if (!summary?.gameId || !['KIWI', 'ARAM'].includes(summary.gameMode)) return null
  const createdAt = Number(summary.gameCreation) || Date.parse(summary.gameCreationDate)
  const endedAt = createdAt + Number(summary.gameDuration) * 1000
  if (!Number.isFinite(endedAt) || !summary.gameDuration || endedAt > now() || now() - endedAt >= 24 * 60 * 60 * 1000) return null
  const game = await lcuApi.getMatchDetails(summary.gameId)
  if (String(game?.gameId) !== String(summary.gameId) || game.gameMode !== summary.gameMode) return null
  const identities = Array.isArray(game.participantIdentities) ? game.participantIdentities : []
  const participants = Array.isArray(game.participants) ? game.participants : []
  const ownIdentity = identities.find((row) => row.player?.puuid === current.puuid)
  const self = ownIdentity && participants.find((row) => row.participantId === ownIdentity.participantId)
  if (!self?.teamId || participants.filter((row) => row.teamId === self.teamId).length !== 5) return null
  const teams = [...new Set(participants.map((row) => row.teamId))].map((teamId) => ({
    teamId,
    isWinningTeam: participants.some((row) => row.teamId === teamId && row.stats?.win === true),
    players: participants.filter((row) => row.teamId === teamId).map((row) => ({
      championId: row.championId, spell1Id: row.spell1Id, spell2Id: row.spell2Id,
      puuid: identities.find((identity) => identity.participantId === row.participantId)?.player?.puuid || '',
      isLocalPlayer: row === self,
      stats: { ...row.stats, MINIONS_KILLED: row.stats?.totalMinionsKilled ?? row.stats?.minionsKilled, TOTAL_CC_TIME: row.stats?.timeCCingOthers ?? row.stats?.totalTimeCCingOthers },
    })),
  }))
  const result = await modelApi.buildPostgame({ gameId: game.gameId, gameMode: game.gameMode, gameLength: game.gameDuration, teams }, { currentSummoner: current, matchGame: game })
  if (result.allies?.length !== 5) return null
  let missingHealing = false
  for (const row of result.allies) {
    const participant = participants.find((entry) => entry.teamId === self.teamId && Number(entry.championId) === Number(row.championId))
    const stats = participant?.stats || {}
    if (!['TOTAL_HEAL_ON_TEAMMATES', 'totalHealsOnTeammates', 'totalHealOnTeammates'].some((key) => stats[key] !== undefined)) {
      row.healing = null
      row.metrics.healShare = null
      missingHealing = true
    }
  }
  if (missingHealing) result.totals.healing = null
  return { ...result, capturedAt: endedAt, source: 'client-history', dataWarnings: missingHealing ? ['客户端比赛历史未提供队友治疗数据，表格以「—」显示，评价时不得按零治疗判断。'] : [] }
}

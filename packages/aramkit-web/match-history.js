import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { sanitize } from '../aramkit-core/service.js'

export const HISTORY_TTL = 24 * 60 * 60 * 1000
export const HISTORY_LIMIT = 60
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]))
const rowKeys = ['isLocalPlayer', 'championId', 'kills', 'deaths', 'assists', 'level', 'cs', 'gold', 'damage', 'damageTaken', 'healing', 'cc', 'vision', 'damageToObjectives']

function anonymousGame(game) {
  if (!game?.gameId || !Array.isArray(game.allies) || game.allies.length !== 5 || game.allies.some((row) => !row?.champion || !Array.isArray(row.items))) return null
  const result = pick(sanitize(game, true), ['gameId', 'gameMode', 'gameLength', 'win', 'augmentsReady', 'capturedAt', 'source', 'dataWarnings'])
  result.gameId = String(game.gameId)
  result.totals = pick(game.totals, ['kills', 'deaths', 'assists', 'gold', 'damage', 'damageTaken', 'healing', 'cc', 'vision'])
  result.allies = game.allies.map((row, index) => ({
    ...pick(row, rowKeys), gameName: row.isLocalPlayer ? '你' : `队友${index + 1}`,
    champion: pick(row.champion, ['id', 'name', 'title']),
    metrics: pick(row.metrics, ['kp', 'damageShare', 'goldShare', 'takenShare', 'healShare', 'ccShare', 'deathsPer10', 'damagePerGold']),
    items: row.items.map((item) => pick(item, ['id', 'name'])),
    spells: (row.spells || []).map((spell) => pick(spell, ['id', 'name'])),
    augments: (row.augments || []).map((augment) => pick(augment, ['id', 'name', 'rarity', 'rarityLabel', 'description'])),
  }))
  return result
}

function cleanReview(value, game) {
  if (String(value?.gameId) !== game.gameId || !Array.isArray(value.review?.players) || value.review.players.length !== 5) return null
  const players = game.allies.map((row, index) => {
    const matching = value.review.players.filter((player) => player.playerId === `p${index + 1}`)
    if (matching.length !== 1) return null
    return { ...pick(matching[0], ['playerId', 'verdict', 'score', 'title', 'comment', 'suggestion']), name: row.gameName, champion: row.champion.name }
  })
  if (players.some((row) => !row || !row.comment || !Number.isFinite(row.score))) return null
  return { ...pick(value, ['gameId', 'augmentsReady', 'style', 'model', 'destination', 'generatedAt']), ok: true, cached: true,
    review: { summary: String(value.review.summary || ''), players, warnings: (value.review.warnings || []).map(String) },
    usage: pick(value.usage, ['inputTokens', 'outputTokens', 'totalTokens']) }
}

export function createMatchHistoryStore({ file = new URL('./.local/match-history.json', import.meta.url), now = Date.now } = {}) {
  const target = file instanceof URL ? fileURLToPath(file) : file
  let entries = null, writing = Promise.resolve()
  const validAge = (at) => Number.isFinite(at) && now() >= at && now() - at < HISTORY_TTL
  function prune() { entries = entries.filter((entry) => validAge(entry.capturedAt)).sort((a, b) => b.capturedAt - a.capturedAt).slice(0, HISTORY_LIMIT) }
  async function load() {
    if (entries) { const before = entries.length; prune(); if (entries.length !== before) await persist(); return }
    let raw
    try { raw = JSON.parse(await readFile(target, 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('本机对局记录无法读取，未覆盖原文件。'); raw = {} }
    entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((entry) => {
      const postgame = anonymousGame(entry.postgame)
      if (!postgame || !validAge(entry.capturedAt)) return []
      const reviews = (Array.isArray(entry.reviews) ? entry.reviews : []).flatMap((review) => {
        const result = cleanReview(review.result, postgame)
        return result && /^[a-f0-9]{64}$/.test(review.key) ? [{ key: review.key, result }] : []
      }).slice(-8)
      return [{ gameId: postgame.gameId, capturedAt: entry.capturedAt, postgame, reviews }]
    })
    prune()
    if (Array.isArray(raw.entries) && entries.length !== raw.entries.length) await persist()
  }
  function queue(fn) {
    const task = writing.catch(() => {}).then(async () => {
      await load()
      const previous = structuredClone(entries)
      try { return await fn() } catch (error) { entries = previous; throw error }
    })
    writing = task
    return task
  }
  async function persist() {
    prune()
    await mkdir(dirname(target), { recursive: true })
    await writeFile(`${target}.tmp`, JSON.stringify({ version: 1, entries }), { mode: 0o600 })
    await rename(`${target}.tmp`, target)
  }
  function upsert(game) {
    const clean = anonymousGame(game)
    if (!clean) return null
    let entry = entries.find((row) => row.gameId === clean.gameId)
    const capturedAt = Number.isFinite(game.capturedAt) ? Math.min(game.capturedAt, now()) : now()
    if (!entry) {
      if (!validAge(capturedAt)) return null
      entry = { gameId: clean.gameId, capturedAt, postgame: clean, reviews: [] }
      entries.unshift(entry)
    } else {
      // Later polling may bring augment details; an older callback must not erase them.
      if (clean.augmentsReady || !entry.postgame.augmentsReady) entry.postgame = clean
    }
    return entry
  }
  return {
    record: (game) => queue(async () => { if (upsert(game)) await persist() }),
    saveReview: (game, key, value) => queue(async () => {
      const clean = anonymousGame(game)
      const result = clean && cleanReview(value, clean)
      if (!result || !/^[a-f0-9]{64}$/.test(key)) throw new Error('结算或评价格式不完整，未保存历史。')
      const entry = upsert(game)
      if (!entry) throw new Error('该局记录已过期，未保存历史。')
      entry.reviews = [...entry.reviews.filter((row) => row.key !== key), { key, result }].slice(-8)
      await persist()
    }),
    get: (gameId) => queue(() => structuredClone(entries.find((entry) => entry.gameId === String(gameId)) || null)),
    findReview: (gameId, key) => queue(() => structuredClone(entries.find((entry) => entry.gameId === String(gameId))?.reviews.find((row) => row.key === key)?.result || null)),
    list: () => queue(() => entries.map((entry) => ({
      gameId: entry.gameId, capturedAt: entry.capturedAt, win: entry.postgame.win, gameLength: entry.postgame.gameLength,
      me: entry.postgame.allies.find((row) => row.isLocalPlayer) || null,
      reviewCount: entry.reviews.length, review: entry.reviews.at(-1)?.result || null,
    }))),
  }
}

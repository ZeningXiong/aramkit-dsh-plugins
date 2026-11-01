import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, unlink, rmdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createMatchHistoryStore, HISTORY_TTL, HISTORY_LIMIT } from '../match-history.js'

export function gameFixture(id = 1, capturedAt) {
  return { gameId: id, capturedAt, gameLength: 600, win: true, augmentsReady: true, totals: { damage: 500 }, allies: Array.from({ length: 5 }, (_, index) => ({ gameName: `private-name-${index}`, tagLine: 'private-tag', puuid: 'private-puuid', summonerId: 123, token: 'private-token', extra: 'private-extra', isLocalPlayer: index === 0, champion: { name: `英雄${index}`, title: `称号${index}` }, items: [], augments: [], kills: 1, deaths: 2, assists: 3, damage: 100, gold: 50, metrics: { damageShare: 20 } })) }
}
export function reviewFixture(id = 1, style = 'sharp') {
  return { ok: true, gameId: id, style, model: 'fixture-model', destination: 'api.example.test', generatedAt: 1000000000, apiKey: 'private-token', usage: { totalTokens: 10 }, review: { summary: '人工构造的全队总结', players: Array.from({ length: 5 }, (_, index) => ({ playerId: `p${index + 1}`, name: 'private-name', champion: 'private-champion-alias', score: 80, verdict: '正常发挥', title: '测试标题', comment: '仅评价人工数据', suggestion: '测试建议', puuid: 'private-puuid' })) } }
}
async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-history-store-test-'))
  const file = path.join(directory, 'history.json')
  let clock = 1000000000
  const now = () => clock
  const store = createMatchHistoryStore({ file, now })
  try { await run({ file, store, now, tick: (ms) => { clock += ms } }) }
  finally { for (const entry of await readdir(directory)) await unlink(path.join(directory, entry)); await rmdir(directory) }
}

test('第二局不覆盖第一局，刷新或重启后恢复两局结算及各自评价', async () => fixture(async ({ file, store, now, tick }) => {
  await store.saveReview(gameFixture(1), 'a'.repeat(64), reviewFixture(1))
  tick(1000)
  await store.saveReview(gameFixture(2), 'b'.repeat(64), reviewFixture(2, 'coach'))
  const restarted = createMatchHistoryStore({ file, now })
  assert.deepEqual((await restarted.list()).map((entry) => entry.gameId), ['2', '1'])
  assert.equal((await restarted.get(1)).reviews[0].result.style, 'sharp')
  assert.equal((await restarted.get(2)).reviews[0].result.style, 'coach')
  const raw = await readFile(file, 'utf8')
  for (const secret of ['private-name', 'private-tag', 'private-puuid', 'private-token', 'private-extra', 'private-champion-alias', 'apiKey', 'summonerId']) assert.equal(raw.includes(secret), false, secret)
  assert.equal((await restarted.get(1)).reviews[0].result.review.players[0].name, '你')
}))

test('并发更新结算不擦除评价，也不会用未同步海克斯覆盖已同步数据', async () => fixture(async ({ store }) => {
  const game = gameFixture(1)
  await store.saveReview(game, 'a'.repeat(64), reviewFixture(1))
  await Promise.all([store.record({ ...game, augmentsReady: false }), store.saveReview(game, 'b'.repeat(64), reviewFixture(1, 'coach')), store.record(game)])
  const entry = await store.get(1)
  assert.equal(entry.reviews.length, 2)
  assert.equal(entry.postgame.augmentsReady, true)
  await store.record({ ...game, allies: game.allies.slice(0, 4) })
  assert.equal((await store.get(1)).postgame.allies.length, 5)
}))

test('重复读取或保存不延长 24 小时寿命，最多保留 60 局和每局 8 份评价', async () => fixture(async ({ store, now, tick }) => {
  const old = gameFixture('old', now())
  await store.record(old)
  tick(HISTORY_TTL - 1000)
  await store.record(old)
  tick(1001)
  assert.equal(await store.get('old'), null)
  for (let i = 0; i < HISTORY_LIMIT + 2; i++) { tick(1); await store.record(gameFixture(i + 1)) }
  assert.equal((await store.list()).length, HISTORY_LIMIT)
  assert.equal(await store.get(1), null)
  for (let i = 0; i < 10; i++) await store.saveReview(gameFixture(62), String(i).repeat(64), reviewFixture(62))
  assert.equal((await store.get(62)).reviews.length, 8)
}))

test('历史损坏时报告失败并保留原文件，不静默覆盖；错局评价无法写入', async () => fixture(async ({ file, store }) => {
  await assert.rejects(store.saveReview(gameFixture(1), 'a'.repeat(64), reviewFixture(2)), /未保存历史/)
  await writeFile(file, 'invalid-json')
  const restarted = createMatchHistoryStore({ file })
  await assert.rejects(restarted.record(gameFixture(3)), /未覆盖原文件/)
  assert.equal(await readFile(file, 'utf8'), 'invalid-json')
}))

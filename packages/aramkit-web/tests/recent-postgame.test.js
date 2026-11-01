import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createPostgameStore } from '../recent-postgame.js'

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-game-test-'))
  const file = path.join(directory, 'recent.json')
  let clock = 10000000
  const store = createPostgameStore({ file, now: () => clock })
  try { await run({ file, store, tick: (ms) => { clock += ms }, now: () => clock }) }
  finally { for (const entry of await readdir(directory)) await unlink(path.join(directory, entry)); await rmdir(directory) }
}
function game(now) {
  return { gameId: 123, capturedAt: now(), allies: Array.from({ length: 5 }, (_, i) => ({ gameName: `private-name-${i}`, tagLine: 'private-tag', puuid: 'private-puuid', isLocalPlayer: i === 0, champion: { name: '英雄' }, items: [], damage: 100 })) }
}

test('最近结算只保存匿名数据，可在新进程实例中恢复', async () => fixture(async ({ file, store, now }) => {
  await store.save(game(now))
  const text = await readFile(file, 'utf8')
  for (const secret of ['private-name', 'private-tag', 'private-puuid']) assert.equal(text.includes(secret), false)
  const restarted = createPostgameStore({ file, now })
  const restored = await restarted.load()
  assert.equal(restored.gameId, 123)
  assert.equal(restored.allies[0].gameName, '你')
  assert.equal(restored.allies[0].damage, 100)
}))

test('过期三十分钟后不恢复，重新读取不能延长旧数据有效期', async () => fixture(async ({ store, now, tick }) => {
  const old = game(now)
  await store.save(old)
  tick(31 * 60 * 1000)
  assert.equal(await store.load(), null)
  await store.save(old)
  assert.equal(await store.load(), null)
}))

test('并发保存不会损坏文件；不完整的四人结算不覆盖已有五人记录', async () => fixture(async ({ store, now }) => {
  await Promise.all([store.save(game(now)), store.save({ ...game(now), gameId: 456 })])
  assert.equal((await store.load()).gameId, 456)
  await store.save({ ...game(now), allies: game(now).allies.slice(0, 4) })
  assert.equal((await store.load()).gameId, 456)
}))

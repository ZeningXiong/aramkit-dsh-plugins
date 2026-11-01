import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, access, readFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const temp = await mkdtemp(path.join(os.tmpdir(), 'aramkit-history-test-'))
const originalHome = process.env.DSH_HOME
process.env.DSH_HOME = temp
const upstream = await import('../../aramkit-live/index.js')
const { createService } = await import('../../aramkit-core/service.js')
const dataDir = path.join(temp, 'aramkit-live')
const historyFile = path.join(dataDir, 'history.json')

after(async () => {
  if (originalHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalHome
  await unlink(historyFile).catch((error) => { if (error.code !== 'ENOENT') throw error })
  await rmdir(dataDir).catch((error) => { if (error.code !== 'ENOENT') throw error })
  await rmdir(temp)
})

test('网页和 MCP 导入共享服务不会初始化 DSH 记录或自动生成锐评', async () => {
  createService()
  await assert.rejects(access(dataDir), { code: 'ENOENT' })
  assert.equal(typeof upstream.buildInGameFromLive, 'function')
  assert.equal(typeof upstream.startReviewJob, 'function')
})

test('上游记录仍能保存两局并读取详情，关闭 AI 后不会自动生成', async () => {
  upstream.loadHistory().settings.enabled = false
  const game = (gameId) => ({ gameId, win: true, augmentsReady: true, allies: [{ isLocalPlayer: true, gameName: '测试玩家', champion: { name: '测试英雄' }, kills: 1, deaths: 2, assists: 3 }] })
  upstream.recordPostgame(game('fixture-one'))
  upstream.recordPostgame(game('fixture-two'))
  const persisted = JSON.parse(await readFile(historyFile, 'utf8'))
  assert.equal(persisted.entries.length, 2)
  assert.equal(persisted.entries.every((entry) => entry.reviewStatus === 'idle' && !entry.review), true)
  const first = upstream.publicHistoryEntry(upstream.findHistoryEntry('fixture-one'), true)
  assert.equal(first.postgame.allies[0].kills, 1)
  assert.equal(first.review, null)
})

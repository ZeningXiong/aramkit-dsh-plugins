import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createAiReview, validateConfig, decodeReview } from '../ai-review.js'
import { createSecretStore } from '../secret-store.js'
import { createMatchHistoryStore } from '../match-history.js'

function gameFixture() {
  return { gameId: 12345, win: true, gameLength: 600, augmentsReady: true, totals: { damage: 150000, healing: 500 }, allies: Array.from({ length: 5 }, (_, i) => ({ gameName: `真实玩家${i}`, tagLine: 'private-tag', puuid: 'private-id', isLocalPlayer: i === 0, champion: { name: `英雄${i}` }, kills: i + 1, deaths: 2, assists: 5, level: 18, cs: 30, gold: 10000, damage: 30000, damageTaken: 20000, healing: 100, cc: 2, vision: 0, metrics: { damageShare: 20 }, items: [{ name: '测试装备' }], augments: [{ name: '测试海克斯', rarityLabel: '黄金' }] })) }
}
const modelReview = () => ({ summary: '测试全队总结', players: Array.from({ length: 5 }, (_, i) => ({ playerId: `p${i + 1}`, verdict: i === 0 ? '尽力' : '正常发挥', score: 80 - i, title: '测试标题', comment: '伤害占比20%，依据统计数据评价。', suggestion: '根据英雄定位补充防装。' })) })
function fixture({ response, protocol = 'responses', historyStore, diagnostics } = {}) {
  const calls = [], saved = []
  let game = gameFixture(), clock = 1000000
  const service = { postgame: async (options) => { assert.equal(options.anonymize, true); return { ok: true, postgame: game } } }
  const store = { load: async () => null, save: async (config) => { saved.push({ ...config }) } }
  const fetchImpl = async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined })
    if (response) return response(url, options)
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'test-model' }] })
    if (protocol === 'chat-completions') return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(modelReview()) } }], usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 } })
    return Response.json({ status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(modelReview()) }] }], usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 } })
  }
  const ai = createAiReview({ service, store, historyStore, diagnostics, fetchImpl, now: () => clock })
  const configure = () => ai.saveConfig({ baseUrl: 'https://api.example.test/v1', model: 'test-model', protocol, apiKey: 'fixture-only-key', remember: false })
  return { ai, calls, saved, configure, setGame: (value) => { game = value }, tick: (value) => { clock += value } }
}

test('配置不回显密钥，更换目标需要新密钥，清除后不可调用模型', async () => {
  const f = fixture()
  assert.equal((await f.ai.getConfig()).configured, false)
  await f.configure()
  assert.equal(JSON.stringify(await f.ai.getConfig()).includes('fixture-only-key'), false)
  await assert.rejects(f.ai.saveConfig({ baseUrl: 'https://different.example/v1', model: 'x' }), /重新填写/)
  await f.ai.saveConfig({ baseUrl: 'https://api.example.test/v1', model: 'test-model', remember: false, clearKey: true })
  await assert.rejects(f.ai.review(), /配置 AI API/)
  assert.equal(f.calls.length, 0)
})

test('Responses 请求只包含匿名友方统计，设置 store=false，无工具执行权限', async () => {
  const f = fixture()
  await f.configure()
  const result = await f.ai.review()
  assert.equal(result.review.players.length, 5)
  assert.equal(result.review.players[0].name, '你')
  assert.equal(result.usage.totalTokens, 46)
  const request = f.calls[0]
  assert.equal(request.url, 'https://api.example.test/v1/responses')
  assert.equal(request.body.store, false)
  assert.equal(request.body.stream, true)
  assert.equal(request.body.text.format.type, 'json_schema')
  assert.equal(request.body.tools, undefined)
  assert.equal(request.redirect, 'error')
  for (const privateText of ['真实玩家', 'private-tag', 'private-id', 'puuid']) assert.equal(JSON.stringify(request.body).includes(privateText), false)
})

test('同局同风格缓存不重复调用，强制生成和缓存过期才再次调用', async () => {
  const f = fixture()
  await f.configure()
  await f.ai.review()
  assert.equal((await f.ai.review()).cached, true)
  assert.equal(f.calls.length, 1)
  assert.equal((await f.ai.review({ force: true })).cached, false)
  assert.equal(f.calls.length, 2)
  f.tick(30 * 60 * 1000 + 1)
  await f.ai.review()
  assert.equal(f.calls.length, 3)
})

test('并发点击去重，校验连接仅 GET 模型列表，不调用推理', async () => {
  const f = fixture()
  await f.configure()
  await Promise.all([f.ai.review(), f.ai.review()])
  assert.equal(f.calls.length, 1)
  const connection = await f.ai.testConnection()
  assert.equal(connection.modelVisible, true)
  assert.equal(f.calls[1].method, 'GET')
  assert.equal(f.calls[1].body, undefined)
})

test('Chat Completions 兼容路径能生成完整五人点评', async () => {
  const f = fixture({ protocol: 'chat-completions' })
  await f.configure()
  const result = await f.ai.review({ style: 'coach' })
  assert.equal(f.calls[0].url.endsWith('/chat/completions'), true)
  assert.equal(f.calls[0].body.response_format.type, 'json_object')
  assert.equal(result.review.players.length, 5)
})

test('分块 SSE 支持 UTF-8 和 CRLF，必须收到 completed 才接受结果', async () => {
  const text = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '部分内容' })}\r\n\r\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output_text: JSON.stringify(modelReview()) } })}\r\n\r\n`
  const bytes = new TextEncoder().encode(text)
  const f = fixture({ response: async () => new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close() } }), { headers: { 'content-type': 'text/event-stream' } }) })
  await f.configure()
  assert.equal((await f.ai.review()).review.players.length, 5)
})

test('API 错误不回显上游正文或密钥，也不自动重试', async () => {
  const f = fixture({ response: async () => Response.json({ error: 'fixture-only-key' }, { status: 401 }) })
  await f.configure()
  await assert.rejects(f.ai.review(), (error) => !error.message.includes('fixture-only-key') && /API Key 无效/.test(error.message))
  assert.equal(f.calls.length, 1)
})

test('结算不足五人不调用 API；重复玩家或格式不完整不能误报生成成功', async () => {
  const f = fixture()
  await f.configure()
  f.setGame({ ...gameFixture(), allies: gameFixture().allies.slice(0, 4) })
  await assert.rejects(f.ai.review(), /不足五人/)
  assert.equal(f.calls.length, 0)
  const invalid = modelReview(); invalid.players[4].playerId = 'p1'
  const bad = fixture({ response: async () => Response.json({ output_text: JSON.stringify(invalid) }) })
  await bad.configure()
  await assert.rejects(bad.ai.review(), /重复评价/)
  assert.equal(bad.calls.length, 1)
})

const rosterFixture = () => Array.from({ length: 5 }, (_, i) => ({ playerId: `p${i + 1}`, name: i === 0 ? '你' : `队友${i + 1}`, champion: `英雄${i}`, championAliases: [`英雄${i}`, `称号${i}`] }))

test('兼容 DeepSeek 数字字符串、大小写编号与 player_id 字段，并按编号排序', () => {
  const result = modelReview()
  result.players = result.players.reverse().map(({ playerId, ...row }) => ({ ...row, player_id: playerId.toUpperCase(), score: String(row.score) }))
  const parsed = decodeReview(JSON.stringify(result), rosterFixture())
  assert.deepEqual(parsed.players.map((row) => row.playerId), ['p1', 'p2', 'p3', 'p4', 'p5'])
  assert.equal(parsed.players[0].name, '你')
  assert.equal(parsed.players[0].score, 80)
})

test('支持明确的字段别名，缺少建议时如实标注，不伪造模型内容', () => {
  const result = modelReview()
  result.players[0].advice = result.players[0].suggestion
  delete result.players[0].suggestion
  delete result.players[1].suggestion
  delete result.players[2].title
  const parsed = decodeReview(JSON.stringify(result), rosterFixture())
  assert.equal(parsed.players[0].suggestion, '根据英雄定位补充防装。')
  assert.equal(parsed.players[1].suggestion, '模型未单独提供改进建议。')
  assert.equal(parsed.players[2].title, '本局表现')
  assert.equal(parsed.warnings.length, 2)
})

test('保留自定义模型标签，小数评分仅四舍五入并标注', () => {
  const result = modelReview()
  result.players[0].verdict = 'MVP'
  result.players[0].score = '88.6/100'
  const parsed = decodeReview(JSON.stringify(result), rosterFixture())
  assert.equal(parsed.players[0].verdict, 'MVP')
  assert.equal(parsed.players[0].score, 89)
  assert.equal(parsed.warnings.length, 2)
})

test('无编号时仅允许唯一匿名名称或英雄匹配，不按数组顺序猜测', () => {
  const result = modelReview()
  result.players[0].name = '你'
  delete result.players[0].playerId
  result.players[1].champion = '称号1'
  delete result.players[1].playerId
  assert.equal(decodeReview(JSON.stringify(result), rosterFixture()).players[0].name, '你')
  delete result.players[2].playerId
  assert.throws(() => decodeReview(JSON.stringify(result), rosterFixture()), /第 3 条.*缺少可确认/)
})

test('玩家编号与名称冲突、重复英雄无法唯一匹配时仍拒绝', () => {
  const result = modelReview()
  result.players[0].name = '队友2'
  assert.throws(() => decodeReview(JSON.stringify(result), rosterFixture()), /相互冲突/)
  delete result.players[0].name
  delete result.players[0].playerId
  result.players[0].champion = '同一个英雄'
  const roster = rosterFixture()
  roster[0].champion = '同一个英雄'; roster[1].champion = '同一个英雄'
  assert.throws(() => decodeReview(JSON.stringify(result), roster), /无法唯一匹配/)
})

test('缺评价正文、超范围评分及人数不正确时提供具体错误', () => {
  const noComment = modelReview(); delete noComment.players[2].comment
  assert.throws(() => decodeReview(JSON.stringify(noComment), rosterFixture()), /p3.*缺少 comment/)
  const badScore = modelReview(); badScore.players[1].score = 1000
  assert.throws(() => decodeReview(JSON.stringify(badScore), rosterFixture()), /p2.*score/)
  badScore.players[1].score = '8/10'
  assert.throws(() => decodeReview(JSON.stringify(badScore), rosterFixture()), /未修改评分尺度/)
  const missing = modelReview(); missing.players.pop()
  assert.throws(() => decodeReview(JSON.stringify(missing), rosterFixture()), /4 条评价/)
})

test('Chat Completions 提示词包含全部允许标签和五个完整模板，兼容修复不额外调用 API', async () => {
  const answer = modelReview()
  answer.players[0].score = '80'
  answer.players[1].verdict = '正常'
  const f = fixture({ protocol: 'chat-completions', response: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(answer) } }] }) })
  await f.configure()
  assert.equal((await f.ai.review()).review.players[0].score, 80)
  assert.equal(f.calls.length, 1)
  const prompt = f.calls[0].body.messages.map((row) => row.content).join('\n')
  for (const tag of ['尽力', '正常发挥', '犯罪', '不团队']) assert.ok(prompt.includes(tag))
  for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) assert.ok(prompt.includes(`"playerId":"${id}"`))
})

test('拒绝带凭据地址、非本机明文地址和未知协议', () => {
  assert.throws(() => validateConfig({ baseUrl: 'https://key:secret@example.com' }), /不能包含/)
  assert.throws(() => validateConfig({ baseUrl: 'http://example.com/v1' }), /HTTPS/)
  assert.throws(() => validateConfig({ protocol: 'unknown' }), /协议/)
  assert.equal(validateConfig({ baseUrl: 'http://127.0.0.1:12345/v1' }).baseUrl, 'http://127.0.0.1:12345/v1')
})

test('Windows 加密保存可恢复，磁盘文件没有明文密钥；取消记住会移除持久密钥', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-ai-test-'))
  const filename = path.join(directory, 'settings.json')
  const store = createSecretStore(filename)
  try {
    const config = { baseUrl: 'https://api.example.test/v1', model: 'x', protocol: 'responses', remember: true, apiKey: 'fixture-only-not-a-real-key' }
    await store.save(config)
    assert.equal((await readFile(filename, 'utf8')).includes(config.apiKey), false)
    assert.equal((await store.load()).apiKey, config.apiKey)
    await store.save({ ...config, remember: false })
    assert.equal((await store.load()).apiKey, '')
    assert.equal((await readFile(filename, 'utf8')).includes(config.apiKey), false)
  } finally {
    for (const file of await readdir(directory)) await unlink(path.join(directory, file))
    await rmdir(directory)
  }
})

async function historyFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-review-history-test-'))
  const file = path.join(directory, 'history.json')
  const historyStore = createMatchHistoryStore({ file, now: () => 1000000 })
  try { await run({ file, historyStore }) }
  finally { for (const entry of await readdir(directory)) await unlink(path.join(directory, entry)); await rmdir(directory) }
}

test('两局 AI 评价分别持久保存，重启后复用历史评价不再次调用模型', async () => historyFixture(async ({ file, historyStore }) => {
  const first = fixture({ historyStore })
  await first.configure()
  const result = await first.ai.review()
  first.setGame({ ...gameFixture(), gameId: 67890 })
  await first.ai.review({ style: 'coach' })
  const restarted = fixture({ historyStore: createMatchHistoryStore({ file, now: () => 1000000 }) })
  await restarted.configure()
  const cached = await restarted.ai.review()
  assert.equal(cached.cached, true)
  assert.deepEqual(cached.review, result.review)
  assert.equal(restarted.calls.length, 0)
  assert.equal((await historyStore.get(67890)).reviews[0].result.style, 'coach')
}))

test('模型较晚返回时仍保存到原对局，不会覆盖已经开始的下一局', async () => historyFixture(async ({ historyStore }) => {
  let release, reached
  const started = new Promise((resolve) => { reached = resolve })
  const gate = new Promise((resolve) => { release = resolve })
  const f = fixture({ historyStore, response: async () => {
    reached()
    await gate
    return Response.json({ status: 'completed', output_text: JSON.stringify(modelReview()) })
  } })
  await f.configure()
  const pending = f.ai.review()
  await started
  const next = { ...gameFixture(), gameId: 67890 }
  f.setGame(next)
  await historyStore.record(next)
  release()
  const result = await pending
  assert.equal(result.gameId, 12345)
  assert.equal((await historyStore.get(12345)).reviews.length, 1)
  assert.equal((await historyStore.get(67890)).reviews.length, 0)
}))

test('落盘失败仍返回已付费生成的评价并明确提示，不自动重试模型', async () => {
  const historyStore = { findReview: async () => null, saveReview: async () => { throw new Error('fixture disk failure') } }
  const f = fixture({ historyStore })
  await f.configure()
  const result = await f.ai.review()
  assert.match(result.persistenceWarning, /保存失败/)
  assert.equal(result.review.players.length, 5)
  assert.equal(f.calls.length, 1)
  assert.equal((await f.ai.review()).cached, true)
  assert.equal(f.calls.length, 1)
})

test('仅向 DeepSeek 官方 Chat 端点发送关闭思考参数，兼容其他服务的请求不受影响', async () => {
  const official = fixture({ protocol: 'chat-completions' })
  await official.ai.saveConfig({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', protocol: 'chat-completions', apiKey: 'fixture-only-key', remember: false })
  await official.ai.review()
  assert.deepEqual(official.calls[0].body.thinking, { type: 'disabled' })
  const compatible = fixture({ protocol: 'chat-completions' })
  await compatible.configure()
  await compatible.ai.review()
  assert.equal(compatible.calls[0].body.thinking, undefined)
})

test('服务商 stop 但最终内容全为空白时明确报错，保存元数据但不保存推理内容或自动重试', async () => {
  const reports = []
  const f = fixture({ protocol: 'chat-completions', diagnostics: { save: async (record) => reports.push(record) }, response: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '   \n  ', reasoning_content: 'fixture-hidden-reasoning' } }], usage: { completion_tokens: 6000, completion_tokens_details: { reasoning_tokens: 5000 } } }) })
  await f.configure()
  await assert.rejects(f.ai.review(), /空白最终内容/)
  assert.equal(f.calls.length, 1)
  assert.equal(reports.length, 1)
  assert.equal(reports[0].nonWhitespaceCharacters, 0)
  assert.equal(reports[0].reasoningTokens, 5000)
  assert.doesNotMatch(JSON.stringify(reports), /fixture-hidden-reasoning|fixture-only-key|authorization/)
})

test('格式失败诊断保留最终文本但移除当前密钥，不复制配置和请求头', async () => {
  const reports = []
  const f = fixture({ diagnostics: { save: async (record) => reports.push(record) }, response: async () => Response.json({ status: 'completed', output_text: 'invalid-json fixture-only-key' }) })
  await f.configure()
  await assert.rejects(f.ai.review(), /有效的五人点评 JSON/)
  assert.equal(reports[0].finalText, 'invalid-json [redacted]')
  assert.doesNotMatch(JSON.stringify(reports), /fixture-only-key|apiKey|authorization/)
  assert.equal(f.calls.length, 1)
})

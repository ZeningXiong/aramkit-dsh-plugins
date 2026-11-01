// Browser QA fixture: no model requests, credentials, or real game data.
import { createApp } from '../server.js'
import { decodeReview } from '../ai-review.js'
const game = { gameId: 'format-test', gameLength: 600, win: true, augmentsReady: false, totals: {}, capturedAt: Date.now(), allies: Array.from({ length: 5 }, (_, i) => ({ gameName: i === 0 ? '你' : `队友${i + 1}`, isLocalPlayer: i === 0, champion: { name: `测试英雄${i + 1}` }, kills: 1, deaths: 1, assists: 1, damage: 100, gold: 100, damageTaken: 100, healing: 0, items: [], metrics: { damageShare: 20 }, augments: [] })) }
const roster = game.allies.map((row, index) => ({ playerId: `p${index + 1}`, name: row.gameName, champion: row.champion.name }))
const raw = { summary: '本地格式兼容测试，非真实对局评价，未调用 DeepSeek。', players: roster.map((row, i) => ({ player_id: row.playerId.toUpperCase(), score: '80', verdict: i ? '正常' : 'MVP', headline: '模拟模型返回', analysis: '测试数字字符串、编号别名和自定义标签，不是真实玩家评价。', ...(i ? { advice: '此处为模拟建议。' } : {}) })) }
const aiApi = {
  getConfig: async () => ({ ok: true, configured: true, baseUrl: 'https://example.test/v1', model: '本地格式测试', destination: '本地模拟', protocol: 'chat-completions', remember: false }),
  review: async () => ({ ok: true, gameId: game.gameId, cached: true, augmentsReady: false, model: '本地模拟（未调用模型）', destination: 'fixture', generatedAt: Date.now(), review: decodeReview(JSON.stringify(raw), roster), usage: { inputTokens: 0, outputTokens: 0 } }),
}
const service = { gameState: async () => ({ ok: true, connected: true, phase: 'EndOfGame', postgame: game }), postgame: async () => ({ ok: true, postgame: game }) }
const dataApi = { listChampions: async () => ({ ok: true, champions: [{ id: 157, name: '测试', title: '亚索' }] }), buildChampionPayload: async () => ({ ok: true, champion: { id: 157, name: '测试', title: '亚索' }, builds: [], augments: {} }) }
const app = createApp({ service, dataApi, aiApi, postgameStore: { save: async () => {}, load: async () => null } })
app.listen(3211, '127.0.0.1', () => console.log('Local mock QA http://127.0.0.1:3211'))

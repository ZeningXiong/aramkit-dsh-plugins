// UI-only artificial history fixture. No real players, credentials or model calls.
import { createApp } from '../server.js'
const now = Date.now()
const champions = ['示例亚索', '示例布隆', '示例阿狸', '示例金克丝', '示例璐璐']
const game = (id) => ({ gameId: id, gameLength: 1020, capturedAt: now - (id === 'demo-previous' ? 3600000 : 0), win: id === 'demo-previous', augmentsReady: true, totals: {}, allies: champions.map((name, index) => ({ gameName: index ? `队友${index + 1}` : '你', isLocalPlayer: index === 0, champion: { name }, kills: 5 + index, deaths: 3, assists: 20, damage: 24000 + index * 1000, gold: 12000, damageTaken: 20000, healing: index * 1500, metrics: { damageShare: 20 }, items: [], augments: [{ name: '示例海克斯' }] })) })
const previous = game('demo-previous'), current = game('demo-current')
const result = (style) => ({ ok: true, cached: true, gameId: previous.gameId, style, model: '本地预览 · 未调用模型', destination: 'fixture', generatedAt: now - 3000000, augmentsReady: true, usage: { inputTokens: 0, outputTokens: 0 }, review: { summary: `人工演示数据：上一局的${style === 'sharp' ? '毒舌' : '教练'}评价已保存在本机。当前已进入下一局，仍可切换查看。`, players: previous.allies.map((row, index) => ({ playerId: `p${index + 1}`, name: row.gameName, champion: row.champion.name, score: 80 - index, verdict: index ? '正常发挥' : '尽力', title: '示例复盘，非真实玩家评价', comment: '示例数据：伤害占比 20%，结合英雄定位评价团队贡献。仅供检查界面，不代表任何真实比赛。', suggestion: '示例建议：根据阵容调整出装与海克斯选择。' })) } })
const entries = [current, previous].map((postgame) => ({ gameId: postgame.gameId, capturedAt: postgame.capturedAt, postgame, reviews: postgame === previous ? [{ key: 'a'.repeat(64), result: result('sharp') }, { key: 'b'.repeat(64), result: result('coach') }] : [] }))
const historyStore = {
  record: async () => {}, get: async (id) => structuredClone(entries.find((row) => row.gameId === String(id)) || null),
  list: async () => entries.map((entry) => ({ gameId: entry.gameId, capturedAt: entry.capturedAt, win: entry.postgame.win, gameLength: entry.postgame.gameLength, me: entry.postgame.allies[0], reviewCount: entry.reviews.length })),
}
const aiApi = { getConfig: async () => ({ ok: true, configured: false, baseUrl: 'https://api.example.test/v1', model: 'fixture', protocol: 'chat-completions', remember: false, destination: 'fixture' }) }
const service = { gameState: async () => ({ ok: true, connected: true, phase: 'InProgress', inGame: { active: true, allies: current.allies, message: '本地模拟：已进入下一局。历史页仍可查看上一局评价。' } }), postgame: async () => ({ ok: false }) }
const dataApi = { listChampions: async () => ({ ok: true, champions: [{ id: 157, name: '人工预览', title: '示例亚索' }] }), buildChampionPayload: async () => ({ ok: true, champion: { id: 157, name: '人工预览', title: '示例亚索' }, builds: [], augments: {} }) }
const app = createApp({ service, dataApi, aiApi, historyStore, postgameStore: { save: async () => {}, load: async () => null } })
app.listen(3211, '127.0.0.1', () => console.log('Artificial history preview http://127.0.0.1:3211/#history'))

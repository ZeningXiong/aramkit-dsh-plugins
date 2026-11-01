const $ = (query) => document.querySelector(query)
const $$ = (query) => [...document.querySelectorAll(query)]
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const percent = (value) => value == null ? '—' : `${(Number(value) * (Number(value) <= 1 ? 100 : 1)).toFixed(1)}%`
const number = (value) => value == null ? '—' : Number(value).toLocaleString('zh-CN')
const compact = (value) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : number(value)
const icon = (row, className = '') => row?.icon ? `<img class="${className}" src="${escape(row.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''
const phases = { None: '客户端就绪', Lobby: '大厅', Matchmaking: '匹配中', ReadyCheck: '等待确认', ChampSelect: '选人中', InProgress: '对局中', Reconnect: '等待重连', PreEndOfGame: '正在结算', EndOfGame: '赛后结算', WaitingForStats: '同步结算' }
const qualityNames = { prismatic: '棱彩', gold: '黄金', silver: '白银' }
const state = { view: 'champions', dataset: 'all', champions: [], championId: Number(localStorage.getItem('aramkit-champion')) || 157, detail: null, archetype: '', quality: 'prismatic', expanded: false, rarity: '', game: null, csrf: '', gameBusy: false, championRequest: 0, augmentRequest: 0, listRequest: 0 }
let toastTimer, augmentTimer
$('#view-live').insertAdjacentHTML('beforeend', `<section id="ai-review-panel" class="panel ai-review-panel"><div class="section-title"><h2><span class="ai-spark">✦</span> 赛后 AI 锐评</h2><button id="review-api-settings" class="text-button">配置 API ↗</button></div><p id="ai-status-text" class="muted">正在读取 AI 配置…</p><div class="review-toolbar"><label for="review-style">点评风格</label><select id="review-style"><option value="sharp">毒舌锐评</option><option value="coach">温和教练</option><option value="data">数据复盘</option><option value="abstract">抽象整活</option></select><button id="generate-review" class="button">✦ 生成五人锐评</button><button id="regenerate-review" class="button secondary" disabled>重新生成</button></div><p class="fine-print">仅手动点击时调用模型。发送匿名友方的英雄、KDA、伤害、经济、承伤、队友治疗和海克斯；不发送游戏令牌。重复查看缓存不调用 API，重新生成会再次消耗额度。</p><div id="ai-review-result" aria-live="polite"><div class="review-empty"><span>✦</span><h3>这一局，谁在扛着队伍走？</h3><p>结算后读取五名友方数据，再生成有数据依据的评价。</p></div></div></section>`)

async function api(route, options = {}) {
  const response = await fetch(`/api/${route}`, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json', 'x-aramkit-session': state.csrf } : {}), ...options.headers } })
  let result
  try { result = await response.json() } catch { throw new Error('本地服务未响应，请重新打开海斗助手。') }
  if (!response.ok || result.ok === false) throw new Error(result.error || '读取失败，请重试。')
  return result
}
function toast(message) {
  $('#toast').textContent = message
  $('#toast').classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000)
}
function errorBox(error, retry) {
  return `<div class="error-box">${escape(error.message)}${retry ? `<br><button class="text-button" data-retry="${retry}">重新加载 ↻</button>` : ''}</div>`
}
function setView(view) {
  state.view = view
  $$('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${view}`))
  $$('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view))
  $('#breadcrumb').textContent = { champions: '英雄出装', augments: '海克斯图鉴', live: '我的对局', history: '对局记录', rating: '隐藏分查询' }[view]
  window.history.replaceState(null, '', `#${view}`)
  if (view === 'augments') loadAugments()
  if (view === 'live') refreshGame(true)
  if (view === 'history') loadHistory(true)
}
function updateVersion(data) {
  if (data.version) $('#version-badge').textContent = `版本 ${data.version}`
  if (data.dataDate) $('#data-date').textContent = `数据更新于 ${data.dataDate}`
}
function renderChampionList() {
  const query = $('#champion-search').value.toLowerCase().trim()
  const rows = state.champions.filter((row) => [row.name, row.title, row.slug, row.id].some((value) => String(value).toLowerCase().includes(query)))
  $('#champion-count').textContent = `${rows.length} 位英雄`
  $('#champion-list').innerHTML = rows.map((row) => `<button class="champion-row ${row.id === state.championId ? 'selected' : ''}" data-champion="${row.id}" aria-pressed="${row.id === state.championId}">${icon(row)}<span><strong>${escape(row.title || row.name)}</strong><small>${escape(row.name)}</small></span><span class="row-stat"><b>${percent(row.winRate)}</b><small class="tier">${escape(row.tier || '—')} TIER</small></span></button>`).join('') || '<div class="loading">没有找到英雄，试试中文名、称号或英文名。</div>'
}
async function loadChampions() {
  const request = ++state.listRequest
  try {
    const result = await api(`champions?dataset=${state.dataset}`)
    if (request !== state.listRequest) return
    state.champions = result.champions
    updateVersion(result)
    renderChampionList()
  } catch (error) {
    if (request === state.listRequest) $('#champion-list').innerHTML = errorBox(error, 'champions')
  }
}
async function chooseChampion(id) {
  state.championId = Number(id)
  localStorage.setItem('aramkit-champion', state.championId)
  renderChampionList()
  const request = ++state.championRequest
  $('#champion-detail').innerHTML = '<div class="panel loading tall">正在读取出装与海克斯数据…</div>'
  try {
    const detail = await api(`champion?id=${state.championId}&dataset=${state.dataset}`)
    if (request !== state.championRequest) return
    state.detail = detail
    state.archetype = detail.archetypes?.[0]?.key || ''
    state.expanded = false
    updateVersion(detail)
    renderDetail()
  } catch (error) {
    if (request === state.championRequest) $('#champion-detail').innerHTML = errorBox(error, 'detail')
  }
}
function itemRoute(items) {
  return items.map((item, index) => `${index ? '<span class="route-arrow">›</span>' : ''}<div class="item-block">${icon(item)}<strong>${escape(item.name)}</strong></div>`).join('')
}
function renderBuild() {
  const detail = state.detail
  const archetype = detail.archetypes?.find((row) => row.key === state.archetype)
  const builds = archetype?.builds?.length ? archetype.builds : detail.builds
  const build = builds?.[0]
  const tabs = (detail.archetypes || []).map((row) => `<button data-archetype="${escape(row.key)}" class="${row.key === state.archetype ? 'active' : ''}">${escape(row.label)}</button>`).join('')
  if (!build) return `<div class="archetype-tabs">${tabs}</div><div class="blank-note">此分段暂无达到样本门槛的出装，试试切换全分段。</div>`
  const extras = [
    ...(build.starters?.[0]?.items || []).map((item, index) => `<div class="build-extra">${index === 0 ? '<span>出门装</span>' : ''}${icon(item)}<span>${escape(item.name)}</span></div>`),
    ...(build.boots?.slice(0, 1) || []).map(({ item }) => `<div class="build-extra"><span>鞋子</span>${icon(item)}<span>${escape(item.name)}</span></div>`),
  ].join('')
  return `<div class="archetype-tabs">${tabs}</div><div class="build-caption"><span>该路线胜率 <b>${percent(build.winRate)}</b></span><span>登场率 ${percent(build.pickRate)}</span><span>${compact(build.sampleCount)} 场样本</span></div><div class="item-route">${itemRoute(build.items)}</div><div class="build-extras">${extras}</div>${build.later?.length ? `<div class="build-extras"><span class="caption">后续可选</span>${build.later.map(({ item }) => `<div class="build-extra">${icon(item)}<span>${escape(item.name)}</span></div>`).join('')}</div>` : ''}`
}
function augmentCards(rows, quality) {
  return rows.map((row, index) => `<article class="augment-card ${quality}">${icon(row)}<span class="augment-rank">#${index + 1}</span><h3>${escape(row.name)}</h3><div class="augment-stats"><strong>${percent(row.winRate)}</strong><span>胜率<br>${compact(row.sampleCount)} 场</span></div></article>`).join('')
}
function renderChampionAugments() {
  const rows = state.detail.augments?.[state.quality] || []
  return `<div class="augment-grid">${augmentCards(rows.slice(0, state.expanded ? 15 : 3), state.quality)}</div>${!rows.length ? '<div class="blank-note">此品质暂无达到样本门槛的海克斯数据。</div>' : ''}${rows.length > 3 ? `<button id="expand-augments" class="expand-button">${state.expanded ? '收起推荐 ⌃' : `查看全部 ${rows.length} 个推荐 ⌄`}</button>` : ''}`
}
function renderDetail() {
  const detail = state.detail
  const champion = detail.champion
  const spells = detail.summoners?.[0]
  const skills = detail.skills?.[0]
  const skillKeys = String(skills?.order || '').match(/[QWER]/gi) || []
  $('#champion-detail').innerHTML = `
    <section class="panel champion-overview">${icon(champion, 'hero-avatar')}<div><span class="hero-label">${escape(champion.slug?.toUpperCase())}</span><h2>${escape(champion.title || champion.name)}</h2><span class="hero-subtitle">${escape(champion.name)} <span> · ${escape(champion.tier)} 级推荐</span></span></div><div class="hero-stats"><div class="hero-stat"><span>英雄胜率</span><strong>${percent(champion.winRate)}</strong><small>${state.dataset === 'high' ? '高分段' : '全分段'}数据</small></div><div class="hero-stat"><span>登场率</span><strong>${percent(champion.pickRate)}</strong><small>${compact(champion.sampleCount)} 场</small></div><div class="hero-stat"><span>强度排名</span><strong>#${number(champion.rank)}</strong><small>当前版本</small></div></div></section>
    <section class="panel section-body"><div class="section-title"><h2><span class="section-number">01</span> 推荐出装</h2><span class="caption">选择流派，查看装备路线</span></div><div id="build-content">${renderBuild()}</div></section>
    <section class="panel section-body"><div class="section-title"><h2><span class="section-number">02</span> 海克斯推荐</h2><div class="rarity-tabs">${Object.entries(qualityNames).map(([key, label]) => `<button data-quality="${key}" class="${state.quality === key ? 'active' : ''}">✧ ${label}</button>`).join('')}</div></div><div id="champion-augments">${renderChampionAugments()}</div></section>
    <div class="bottom-grid"><section class="panel section-body"><div class="section-title"><h2>召唤师技能</h2><span class="caption">${percent(spells?.winRate)} 胜率</span></div>${spells ? `<div class="spell-row">${spells.spells.map((row) => icon(row)).join('')}<span class="spell-names">${spells.spells.map((row) => escape(row.name)).join(' + ')}</span></div>` : '<p class="blank-note">暂无足够样本</p>'}</section><section class="panel section-body"><div class="section-title"><h2>技能加点优先级</h2><span class="caption">${percent(skills?.winRate)} 胜率</span></div><div class="skill-order">${skillKeys.length ? skillKeys.map((key, index) => `${index ? '<span class="muted">›</span>' : ''}<span class="skill-key">${key.toUpperCase()}</span>`).join('') : '<span class="blank-note">暂无足够样本</span>'}</div></section></div>
    ${detail.augmentCombinations?.length ? `<section class="panel section-body"><div class="section-title"><h2>高胜率海克斯组合</h2><span class="caption">组合样本 ≥ 200 场</span></div>${detail.augmentCombinations.map((row) => `<div class="combo-row"><span>${row.augments.map((augment) => escape(augment.name)).join(' ＋ ')}</span><strong>${percent(row.winRate)}</strong></div>`).join('')}</section>` : ''}`
}
async function loadAugments() {
  const request = ++state.augmentRequest
  $('#augment-results').innerHTML = '<div class="loading">正在查询海克斯…</div>'
  try {
    const result = await api(`augments?q=${encodeURIComponent($('#augment-search').value)}&rarity=${state.rarity}`)
    if (request !== state.augmentRequest) return
    updateVersion(result)
    $('#augment-results').innerHTML = `<div class="caption">找到 ${result.total} 个海克斯${result.total > result.augments.length ? `，当前显示前 ${result.augments.length} 个，请输入名称缩小范围` : ''}</div>` + result.augments.map((row) => `<article class="augment-card ${escape(row.rarity)}">${icon(row)}<span class="augment-rank">${qualityNames[row.rarity] || ''}</span><h3>${escape(row.name)}</h3><p>${escape(row.description || '此海克斯暂无公开效果说明。')}</p></article>`).join('')
    if (!result.total) $('#augment-results').innerHTML += '<div class="blank-note">没有找到匹配的海克斯。</div>'
  } catch (error) { if (request === state.augmentRequest) $('#augment-results').innerHTML = errorBox(error, 'augments') }
}
function updateStatus(game) {
  const active = game.connected || game.inGame?.active
  const label = active ? `客户端已连接 · ${phases[game.phase] || (game.inGame?.active ? '对局中' : '就绪')}` : '客户端未连接'
  $('#connection-chip span').textContent = label
  $('#connection-chip').classList.toggle('connected', active)
  $('#nav-dot').style.background = active ? '#96e5c4' : '#77818e'
}
function renderGame(game) {
  const phaseIndex = game.inGame ? 2 : game.champSelect ? 1 : game.postgame ? 3 : 0
  $('#phase-track').innerHTML = ['大厅 / 匹配', '英雄选择', '对局进行', '赛后结算'].map((label, index) => `<div class="phase-step ${phaseIndex === index ? 'active' : ''}"><span>0${index + 1}</span>${label}</div>`).join('')
  const current = game.champSelect
  if (current) {
    $('#live-content').innerHTML = `<div class="panel live-summary"><span class="large-glyph">◈</span><div><h2>正在选人，先挑一个顺手的英雄</h2><p>候选池中胜率最高的 ${current.top5?.length || 0} 位英雄 · 点击查看完整出装</p></div>${current.currentChampionId ? `<button class="button" data-open-champion="${current.currentChampionId}">查看我的英雄 ↗</button>` : ''}</div><div class="available-grid">${(current.top5 || []).map((row) => `<button class="available-card" data-open-champion="${row.id}"><strong>${escape(row.title || row.name)}</strong><span>${percent(row.winRate)} 胜率</span><small>${row.source === 'mine' ? '当前使用' : '候选英雄'} · ${escape(row.tier || '—')} 级</small></button>`).join('')}</div><section class="panel section-body postgame-panel"><div class="section-title"><h2>友方阵容</h2></div>${teamTable(current.team || [])}</section>`
  } else if (game.inGame) {
    const allies = game.inGame.allies || []
    const self = allies.find((row) => row.isSelf)
    $('#live-content').innerHTML = `<div class="panel live-summary"><span class="large-glyph">◉</span><div><h2>对局进行中</h2><p>${escape(game.inGame.notice || game.inGame.message || '随时查看本局英雄的推荐出装与海克斯。')}</p></div>${self?.championId ? `<button class="button" data-open-champion="${self.championId}">查看我的出装 ↗</button>` : ''}</div><section class="panel section-body"><h2>友方阵容</h2>${teamTable(allies)}</section>`
  } else {
    $('#live-content').innerHTML = `<div class="panel"><div class="empty-state"><span>${game.connected ? '◉' : '⌁'}</span><h2>${game.postgame ? (game.postgame.source === 'client-history' ? '已找回最近一局结算' : '本局已结束') : game.connected ? `客户端已连接 · ${phases[game.phase] || game.phase}` : '等待连接英雄联盟客户端'}</h2><p>${escape(game.message || (game.postgame ? (game.postgame.source === 'client-history' ? '从客户端比赛历史补回，下方显示最近一局数据。' : '下方已同步本局结算数据。') : '进入英雄选择后，这里会自动展示候选英雄、友方阵容和推荐。'))}</p>${!game.connected ? '<br><button class="button secondary" data-settings>检查连接</button>' : ''}</div></div>`
  }
  if (game.postgame) renderPostgame(game.postgame)
}
function teamTable(rows) {
  const live = rows.some((row) => row.kills != null)
  return `<div class="table-scroll"><table><thead><tr><th>玩家</th><th>英雄</th>${live ? '<th>K / D / A</th><th>等级 / 补刀</th>' : '<th>估算隐藏分</th>'}<th>推荐</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${escape(row.gameName || `队友${index + 1}`)}</td><td>${escape(row.champion?.title || row.champion?.name || '待选择')}</td>${live ? `<td>${number(row.kills)} / ${number(row.deaths)} / ${number(row.assists)}</td><td>${number(row.level)} 级 / ${number(row.cs)}</td>` : `<td>${row.rating?.value != null ? number(row.rating.value) : '未查询'}</td>`}<td>${row.championId ? `<button class="text-button" data-open-champion="${row.championId}">查看出装 ↗</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>`
}
function postgameHtml(game) {
  return `<div class="game-result"><strong class="${game.win ? '' : 'loss'}">${game.win ? '胜利' : '失败'}</strong><span>时长 ${Math.floor(game.gameLength / 60)} 分 ${Math.round(game.gameLength % 60)} 秒</span><span>对局 ${escape(game.gameId)}</span></div><div class="table-scroll"><table><thead><tr><th>玩家 / 英雄</th><th>K / D / A</th><th>英雄伤害</th><th>伤害占比</th><th>经济</th><th>承伤</th><th>队友治疗</th><th>海克斯</th></tr></thead><tbody>${(game.allies || []).map((row, index) => `<tr><td>${escape(row.gameName || `队友${index + 1}`)}<br><small class="muted">${escape(row.champion?.title || row.champion?.name)}</small></td><td>${row.kills} / ${row.deaths} / ${row.assists}</td><td>${number(row.damage)}</td><td>${number(row.metrics?.damageShare)}%</td><td>${number(row.gold)}</td><td>${number(row.damageTaken)}</td><td>${number(row.healing)}</td><td>${row.augments?.map((augment) => escape(augment.name)).join('<br>') || '尚未同步'}</td></tr>`).join('')}</tbody></table></div><p class="fine-print">${game.augmentsReady ? '海克斯已同步。' : '海克斯明细可能需要等待客户端对局历史同步，稍后可重新读取。'} 以上为原始统计与占比，未调用 AI 模型。</p>` + (game.dataWarnings || []).map((warning) => `<p class="fine-print">${escape(warning)}</p>`).join('')
}
function renderPostgame(game) {
  state.postgameGameId = String(game.gameId)
  if (state.lastReviewGame && String(state.lastReviewGame) !== String(game.gameId)) {
    $('#ai-review-result').innerHTML = '<div class="blank-note">新一局结算已到，可以生成这局五人的锐评。</div>'
    state.lastReviewGame = null
    $('#regenerate-review').disabled = true
  }
  state.hasPostgame = true
  $('#postgame-content').classList.remove('empty-small')
  $('#postgame-content').innerHTML = postgameHtml(game)
  if (['local-snapshot', 'local-history'].includes(game.source)) $('#postgame-content').insertAdjacentHTML('beforeend', '<p class="fine-print">当前显示本机保存的匿名结算；历史记录保留 24 小时，请核对上方对局编号。</p>')
  if (String(state.lastReviewGame) !== String(game.gameId) && !state.reviewBusy) restoreLiveReview(game.gameId)
}
async function refreshGame(manual = false) {
  if (state.gameBusy) return
  state.gameBusy = true
  try {
    const game = await api(`state?ratings=${$('#team-ratings').checked ? 1 : 0}&anonymous=${$('#anonymous').checked ? 1 : 0}`)
    state.game = game
    updateStatus(game)
    renderGame(game)
    if (state.view === 'history') loadHistory(true)
    if (manual) toast('客户端状态已刷新')
  } catch (error) {
    $('#connection-chip span').textContent = '连接暂不可用'
    $('#connection-chip').classList.remove('connected')
    if (manual || !state.game) $('#live-content').innerHTML = errorBox(error, 'game')
    if (manual) toast(error.message)
  } finally { state.gameBusy = false }
}
async function readPostgame() {
  const button = $('#load-postgame')
  button.disabled = true
  try { const result = await api(`postgame?anonymous=${$('#anonymous').checked ? 1 : 0}`); renderPostgame(result.postgame) }
  catch (error) { $('#postgame-content').innerHTML = errorBox(error) }
  finally { button.disabled = false }
}
async function rating(event) {
  event.preventDefault()
  const button = $('#rating-form button')
  button.disabled = true
  $('#rating-result').innerHTML = '<div class="loading tall">正在查询 ARAMKit 玩家数据…</div>'
  try {
    const result = await api(`rating?riotId=${encodeURIComponent($('#riot-id').value.trim())}`)
    $('#rating-result').innerHTML = `<h3>ARAMKIT 估算隐藏分</h3><div class="result-name">${escape(result.gameName || $('#riot-id').value)}${result.tagLine ? ` #${escape(result.tagLine)}` : ''}</div><div class="rating-number">${number(result.rating)}</div><p class="muted">${escape(result.ratingType || '海克斯大乱斗')}</p><div class="rating-stat-grid"><div><small>估算误差</small><strong>${result.marginOfError == null ? '暂无' : `± ${escape(result.marginOfError)}`}</strong></div><div><small>表现分</small><strong>${escape(result.performanceScore ?? '暂无')}</strong></div></div><p class="fine-print">${escape(Array.isArray(result.performanceComment) ? result.performanceComment.join(' · ') : result.performanceComment || '')}</p><p class="fine-print">${escape(result.notice)}</p>`
  } catch (error) { $('#rating-result').innerHTML = errorBox(error) }
  finally { button.disabled = false }
}
function openSettings() {
  $('#settings-dialog').showModal()
}
async function connect(event) {
  event.preventDefault()
  const button = $('#connect-form button')
  button.disabled = true
  $('#connection-result').textContent = '正在检查客户端和连接路径…'
  try {
    const result = await api('connect', { method: 'POST', body: JSON.stringify({ lockfile: $('#lockfile-path').value.trim() }) })
    $('#connection-result').textContent = result.status.connected ? `已连接 · ${phases[result.status.phase] || result.status.phase}` : result.status.message
    await refreshGame()
  } catch (error) { $('#connection-result').textContent = error.message }
  finally { button.disabled = false }
}

function applyAiConfig(config) {
  state.aiConfig = config
  $('#ai-base-url').value = config.baseUrl
  $('#ai-model').value = config.model
  $('#ai-protocol').value = config.protocol
  $('#ai-remember').checked = config.remember
  $('#ai-api-key').value = ''
  $('#ai-api-key').placeholder = config.configured ? '密钥已配置；留空保留原密钥' : '粘贴服务商提供的 API Key'
  $('#ai-status-text').textContent = config.configured ? `已配置 ${config.model} · ${config.destination} · 默认匿名发送` : '尚未配置 API。先填写服务地址、模型和密钥，再生成五人锐评。'
  $('#ai-config-status').textContent = config.warning || (config.configured ? `密钥已配置 · ${config.remember ? 'Windows 加密保存' : '仅本次运行'}` : '未配置密钥；保存设置不会调用模型。')
  $('#clear-ai-key').disabled = !config.configured
}
async function loadAiConfig() {
  try { applyAiConfig(await api('ai/config')) }
  catch (error) { $('#ai-status-text').textContent = error.message }
}
function openAiSettings() { $('#ai-dialog').showModal() }
async function saveAiSettings(event, clearKey = false) {
  event?.preventDefault()
  const button = $('#ai-config-form button[type=submit]')
  button.disabled = true
  $('#ai-config-status').textContent = '正在保存本机配置…'
  try {
    const config = await api('ai/config', { method: 'POST', body: JSON.stringify({
      baseUrl: $('#ai-base-url').value.trim(), protocol: $('#ai-protocol').value, model: $('#ai-model').value.trim(),
      apiKey: clearKey ? '' : $('#ai-api-key').value.trim(), remember: $('#ai-remember').checked, clearKey,
    }) })
    applyAiConfig(config)
    toast(clearKey ? '已清除密钥' : 'AI 配置已保存，尚未调用模型')
  } catch (error) { $('#ai-config-status').textContent = error.message }
  finally { button.disabled = false }
}
async function testAiConnection() {
  const button = $('#test-ai')
  button.disabled = true
  $('#ai-config-status').textContent = '正在校验已保存的 API 配置（仅查询模型列表）…'
  try { $('#ai-config-status').textContent = (await api('ai/test', { method: 'POST', body: '{}' })).message }
  catch (error) { $('#ai-config-status').textContent = error.message }
  finally { button.disabled = false }
}

const reviewStyles = { sharp: '毒舌锐评', coach: '温和教练', data: '数据复盘', abstract: '抽象整活' }
function reviewHtml(result) {
  const classes = { '尽力': 'carry', '正常发挥': 'normal', '犯罪': 'poor', '不团队': 'solo' }
  const verdictClass = new Proxy(classes, { get: (target, key) => Object.hasOwn(target, key) ? target[key] : 'normal' })
  let html = `<div class="review-summary"><span>本局锐评</span><p>${escape(result.review.summary)}</p></div><div class="review-grid">${result.review.players.map((row) => `<article class="player-review"><div class="player-review-head"><div><h3>${escape(row.name)}</h3><small>${escape(row.champion)}</small></div><strong class="review-score ${verdictClass[row.verdict]}">${row.score}<small>/100</small></strong></div><span class="verdict-badge ${verdictClass[row.verdict]}">${escape(row.verdict)}</span><h4>${escape(row.title)}</h4><p>${escape(row.comment)}</p><div class="review-suggestion"><span>下把试试</span>${escape(row.suggestion)}</div></article>`).join('')}</div><div class="review-meta"><span>${escape(result.model)} · ${escape(result.destination)} · ${result.cached ? '缓存结果，未再次调用模型' : '本次已调用模型'}</span><span>输入 ${number(result.usage.inputTokens)} / 输出 ${number(result.usage.outputTokens)} tokens</span></div><p class="fine-print">对局 ${escape(result.gameId)} · ${new Date(result.generatedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })} 生成 · AI 评价仅供参考。${result.augmentsReady ? '' : '海克斯尚未同步，点评仅基于现有数据。'}</p>`
  if (result.review.warnings?.length) html = `<details class="format-note"><summary>本地格式兼容说明（未再次调用模型）</summary><ul>${result.review.warnings.map((note) => `<li>${escape(note)}</li>`).join('')}</ul></details>` + html
  if (result.persistenceWarning) html = `<p class="error-box">${escape(result.persistenceWarning)}</p>` + html
  return html
}
async function restoreLiveReview(gameId) {
  try {
    const { entry } = await api(`history/detail?gameId=${encodeURIComponent(gameId)}`)
    const saved = entry.reviews.at(-1)?.result
    if (saved && state.postgameGameId === String(gameId) && !state.reviewBusy) {
      $('#ai-review-result').innerHTML = reviewHtml(saved)
      state.lastReviewGame = String(gameId)
      $('#regenerate-review').disabled = false
    }
  } catch { /* A fresh or incomplete result may not yet be in history. */ }
}
function historyList() {
  $('#history-list').innerHTML = state.historyEntries?.length ? state.historyEntries.map((entry) => `<button class="panel history-card ${state.historyGameId === entry.gameId ? 'selected' : ''}" data-history-game="${escape(entry.gameId)}" aria-pressed="${state.historyGameId === entry.gameId}"><span class="history-result ${entry.win ? '' : 'loss'}">${entry.win ? '胜利' : '失败'}</span><strong>${escape(entry.me?.champion?.title || entry.me?.champion?.name || '未知英雄')}</strong><span>${entry.me ? `${number(entry.me.kills)} / ${number(entry.me.deaths)} / ${number(entry.me.assists)}` : '友方五人结算'}</span><small>${new Date(entry.capturedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${Math.floor((entry.gameLength || 0) / 60)} 分钟</small><span class="history-status">${entry.reviewCount ? `✦ 已保存 ${entry.reviewCount} 份评价` : '尚未生成评价'}</span><small>对局 ${escape(entry.gameId)}</small></button>`).join('') : '<div class="panel loading">暂无最近 24 小时的完整结算。对局结束后，在「我的对局」读取五人结算即可保存。</div>'
}
async function loadHistory(refreshDetail = false) {
  const request = state.historyListRequest = (state.historyListRequest || 0) + 1
  try {
    const result = await api('history')
    if (request !== state.historyListRequest) return
    state.historyEntries = result.entries
    historyList()
    if (state.historyGameId && !result.entries.some((entry) => entry.gameId === state.historyGameId)) {
      state.historyGameId = null
      state.historyEntry = null
    }
    if (!state.historyGameId && result.entries.length) openHistory(result.entries[0].gameId)
    else if (refreshDetail && state.historyGameId && state.reviewBusyGame !== state.historyGameId) openHistory(state.historyGameId)
    else if (!result.entries.length) $('#history-detail').innerHTML = '<div class="panel loading">记录保存在本机，生成过的评价也会随对应对局保存。升级前已经丢失的评价无法恢复。</div>'
  } catch (error) { $('#history-list').innerHTML = errorBox(error) }
}
function renderHistoryDetail(entry) {
  const reviews = entry.reviews
  const selected = reviews.find((row) => row.key === state.historyReviewKey) || reviews.at(-1)
  state.historyReviewKey = selected?.key
  state.historyEntry = entry
  $('#history-detail').innerHTML = `<section class="panel postgame-panel"><div class="section-title"><h2>历史结算 · 匿名保存</h2><span class="muted">对局 ${escape(entry.gameId)}</span></div>${postgameHtml(entry.postgame)}</section><section class="panel ai-review-panel"><div class="section-title"><h2>✦ 这局的 AI 评价</h2><button class="text-button" data-ai-settings>配置 API ↗</button></div>${reviews.length ? `<label class="history-select">已保存的评价<select id="history-review-select">${[...reviews].reverse().map((row) => `<option value="${escape(row.key)}" ${row.key === selected.key ? 'selected' : ''}>${escape(reviewStyles[row.result.style] || row.result.style)} · ${escape(row.result.model)} · ${new Date(row.result.generatedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })}</option>`).join('')}</select></label>` : ''}<div id="history-review-result">${selected ? reviewHtml(selected.result) : '<div class="review-empty"><h3>这局还没有 AI 评价</h3><p>已有结算保存在本机；你可以现在生成，也可以开下一局后再来。</p></div>'}</div><div class="review-toolbar"><label for="history-review-style">生成风格</label><select id="history-review-style">${Object.entries(reviewStyles).map(([key, value]) => `<option value="${key}" ${key === (state.historyStyle || 'sharp') ? 'selected' : ''}>${value}</option>`).join('')}</select><button class="button" data-history-generate="${escape(entry.gameId)}" ${state.reviewBusy ? 'disabled' : ''}>生成所选风格</button>${reviews.length ? `<button class="button secondary" data-history-force="${escape(entry.gameId)}" ${state.reviewBusy ? 'disabled' : ''}>重新生成（消耗 API）</button>` : ''}</div><p class="fine-print">查看已保存的评价不调用模型。同一数据、模型和风格可复用已保存结果；强制重新生成会再次消耗 API 额度。历史最多保留 24 小时。</p></section>`
}
async function openHistory(gameId) {
  const changed = state.historyGameId !== String(gameId)
  state.historyGameId = String(gameId)
  if (changed) state.historyReviewKey = null
  historyList()
  const request = state.historyDetailRequest = (state.historyDetailRequest || 0) + 1
  if (changed) $('#history-detail').innerHTML = '<div class="panel loading">正在读取本机记录…</div>'
  try {
    const { entry } = await api(`history/detail?gameId=${encodeURIComponent(gameId)}`)
    if (request === state.historyDetailRequest && state.historyGameId === String(gameId)) renderHistoryDetail(entry)
  } catch (error) { if (request === state.historyDetailRequest) $('#history-detail').innerHTML = errorBox(error) }
}
async function generateReview(force = false, requestedGameId, style = $('#review-style').value) {
  if (!state.aiConfig?.configured) { openAiSettings(); return }
  if (state.reviewBusy) return
  if (!requestedGameId && !state.postgameGameId) await readPostgame()
  const gameId = String(requestedGameId || state.postgameGameId || '')
  if (!gameId) { toast('先读取完整五人结算，再生成评价。'); return }
  state.reviewBusy = true
  state.reviewBusyGame = gameId
  const target = requestedGameId ? $('#history-review-result') : $('#ai-review-result')
  const previous = target?.innerHTML || ''
  const buttons = [$('#generate-review'), $('#regenerate-review'), ...$$('[data-history-generate], [data-history-force]')]
  buttons.forEach((button) => { button.disabled = true })
  if (target) target.innerHTML = `<div class="review-empty"><span>✦</span><h3>正在复盘对局 ${escape(gameId)} 的友方五人…</h3><p>可以切换页面或开始下一局，请保持助手运行。完成后会保存到这局记录。</p></div>`
  try {
    const result = await api('ai/review', { method: 'POST', body: JSON.stringify({ style, force, gameId }) })
    if (state.postgameGameId === String(result.gameId)) {
      state.lastReviewGame = String(result.gameId)
      $('#ai-review-result').innerHTML = reviewHtml(result)
    }
    if (state.historyGameId === String(result.gameId)) state.historyReviewKey = null
    toast(result.persistenceWarning || (result.cached ? '已读取保存的评价，未调用模型' : `对局 ${gameId} 的评价已保存到对局记录`))
  } catch (error) {
    const stillSelected = requestedGameId ? state.historyGameId === gameId : state.postgameGameId === gameId
    if (stillSelected && target?.isConnected) target.innerHTML = errorBox(error) + (previous ? `<details class="previous-review"><summary>查看此前内容</summary>${previous}</details>` : '')
    toast(error.message)
  } finally {
    state.reviewBusy = false
    state.reviewBusyGame = null
    buttons.forEach((button) => { button.disabled = false })
    $$('[data-history-generate], [data-history-force]').forEach((button) => { button.disabled = false })
    $('#regenerate-review').disabled = !state.lastReviewGame
    await loadHistory(false)
    if (state.historyGameId === gameId) await openHistory(gameId)
  }
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button')
  if (!target) return
  if (target.dataset.view) setView(target.dataset.view)
  if (target.id === 'review-nav') { setView('live'); readPostgame(); $('#ai-review-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  if (target.dataset.historyGame) openHistory(target.dataset.historyGame)
  if (target.hasAttribute('data-ai-settings')) openAiSettings()
  if (target.dataset.historyGenerate) generateReview(false, target.dataset.historyGenerate, state.historyStyle || 'sharp')
  if (target.dataset.historyForce) generateReview(true, target.dataset.historyForce, state.historyStyle || 'sharp')
  if (target.dataset.champion) chooseChampion(target.dataset.champion)
  if (target.dataset.openChampion) { setView('champions'); chooseChampion(target.dataset.openChampion); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  if (target.dataset.dataset && state.dataset !== target.dataset.dataset) {
    state.dataset = target.dataset.dataset
    $$('#dataset-tabs button').forEach((button) => button.classList.toggle('active', button === target))
    loadChampions(); chooseChampion(state.championId)
  }
  if (target.dataset.archetype) {
    state.archetype = target.dataset.archetype
    $('#build-content').innerHTML = renderBuild()
  }
  if (target.dataset.quality) {
    state.quality = target.dataset.quality; state.expanded = false
    $$('.rarity-tabs button').forEach((button) => button.classList.toggle('active', button === target))
    $('#champion-augments').innerHTML = renderChampionAugments()
  }
  if (target.id === 'expand-augments') { state.expanded = !state.expanded; $('#champion-augments').innerHTML = renderChampionAugments() }
  if (target.hasAttribute('data-rarity')) {
    state.rarity = target.dataset.rarity
    $$('#rarity-filter button').forEach((button) => button.classList.toggle('active', button === target))
    loadAugments()
  }
  if (target.dataset.retry) ({ champions: loadChampions, detail: () => chooseChampion(state.championId), augments: loadAugments, game: () => refreshGame(true) })[target.dataset.retry]?.()
  if (target.hasAttribute('data-settings')) openSettings()
})
$('#refresh-history').addEventListener('click', () => loadHistory(true))
document.addEventListener('change', (event) => {
  if (event.target.id === 'history-review-style') state.historyStyle = event.target.value
  if (event.target.id === 'history-review-select' && state.historyEntry) { state.historyReviewKey = event.target.value; renderHistoryDetail(state.historyEntry) }
})
$('#champion-search').addEventListener('input', renderChampionList)
$('#augment-search').addEventListener('input', () => { clearTimeout(augmentTimer); augmentTimer = setTimeout(loadAugments, 280) })
$('#rating-form').addEventListener('submit', rating)
$('#connect-form').addEventListener('submit', connect)
$('#connection-settings').addEventListener('click', openSettings)
$('#connection-chip').addEventListener('click', openSettings)
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close())
$('#ai-settings').addEventListener('click', openAiSettings)
$('#review-api-settings').addEventListener('click', openAiSettings)
$('#close-ai-settings').addEventListener('click', () => $('#ai-dialog').close())
$('#ai-config-form').addEventListener('submit', saveAiSettings)
$('#test-ai').addEventListener('click', testAiConnection)
$('#clear-ai-key').addEventListener('click', () => saveAiSettings(null, true))
$('#generate-review').addEventListener('click', () => generateReview(false))
$('#regenerate-review').addEventListener('click', () => generateReview(true))
$('#refresh-game').addEventListener('click', () => refreshGame(true))
$('#load-postgame').addEventListener('click', readPostgame)
$('#anonymous').addEventListener('change', () => { refreshGame(); if (state.hasPostgame) readPostgame() })
$('#team-ratings').addEventListener('change', () => { if ($('#team-ratings').checked) toast('选人时将向 ARAMKit 查询队友昵称与 Tag 对应的估算隐藏分'); refreshGame() })
$('#auto-refresh').addEventListener('change', () => { if ($('#auto-refresh').checked) refreshGame() })
$('#quit').addEventListener('click', async () => {
  try {
    await api('shutdown', { method: 'POST', body: '{}' })
    $('#auto-refresh').checked = false
    $('#connection-chip span').textContent = '助手已停止'
    $('#connection-chip').classList.remove('connected')
    toast('海斗助手已停止。下次双击启动入口即可重新打开。')
  } catch (error) { toast(error.message) }
})
setInterval(() => { if ($('#auto-refresh').checked && !document.hidden) refreshGame() }, 8000)
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#auto-refresh').checked) refreshGame() })
async function init() {
  try { const session = await api('session'); state.csrf = session.csrf } catch (error) { toast(error.message) }
  loadChampions()
  chooseChampion(state.championId)
  refreshGame()
  loadAiConfig()
  loadHistory()
  if (['champions', 'augments', 'live', 'history', 'rating'].includes(location.hash.slice(1))) setView(location.hash.slice(1))
}
init()

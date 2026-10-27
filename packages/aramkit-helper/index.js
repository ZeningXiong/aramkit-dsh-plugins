/**
 * ARAMKit Helper — Host half.
 *
 * Proxies the public ARAMKit CN endpoints through a same-origin route so the
 * Web UI can read them without CORS problems, and compacts the large static
 * champion JSON into the small shape the panel needs.
 */

const DATA_ORIGIN = 'https://data.aramkit.cn'
const RATING_ORIGIN = 'https://api.aramkit.cn'
const ASSET_ORIGIN = 'https://data.aramkit.cn'
const DATASETS = new Set(['all', 'high'])
const MIN_AUGMENT_SAMPLE = 200
const MIN_BUILD_SAMPLE = 500
const CACHE_TTL = 5 * 60 * 1000
const RESOURCE_TTL = 60 * 60 * 1000

const versionsCache = { at: 0, value: null }
const resourcesCache = new Map()
const rankingsCache = new Map()
const detailCache = new Map()
const ratingCache = new Map()

const RARITY_LABEL = {
  prismatic: '棱彩',
  gold: '黄金',
  silver: '白银',
}

function asset(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${ASSET_ORIGIN}/${String(path).replace(/^\/+/, '')}`
}

async function fetchJson(url, timeout = 20000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSH-ARAMKit-Helper/1.0',
      referer: 'https://aramkit.cn/',
    },
  })
  if (!response.ok) {
    throw new Error(`ARAMKit 返回 HTTP ${response.status}`)
  }
  return await response.json()
}

async function getVersions() {
  if (versionsCache.value && Date.now() - versionsCache.at < RESOURCE_TTL) return versionsCache.value
  const data = await fetchJson(`${DATA_ORIGIN}/data/versions.json`, 15000)
  const latest = Array.isArray(data?.versions) ? data.versions.find((row) => row.version === data.latest) ?? data.versions[0] : null
  if (!latest?.dataPath || !latest?.resourcePath) throw new Error('无法读取 ARAMKit 数据版本')
  const value = {
    version: latest.version,
    dataPath: latest.dataPath,
    resourcePath: latest.resourcePath,
    dataDate: latest.dataDate,
    allMatches: latest.allMatches,
  }
  versionsCache.at = Date.now()
  versionsCache.value = value
  return value
}

function normalizeDataset(value) {
  const dataset = String(value || '').trim()
  return DATASETS.has(dataset) ? dataset : 'all'
}

async function getResources() {
  const version = await getVersions()
  const key = version.resourcePath
  const cached = resourcesCache.get(key)
  if (cached && Date.now() - cached.at < RESOURCE_TTL) return cached.value

  const base = `${DATA_ORIGIN}/${version.resourcePath}/zh-CN/resources`
  const [champions, augments, items, spells] = await Promise.all([
    fetchJson(`${base}/champions.json`),
    fetchJson(`${base}/augments.json`),
    fetchJson(`${base}/items.json`),
    fetchJson(`${base}/summoner-spells.json`),
  ])
  const value = { champions, augments, items, spells, version }
  resourcesCache.set(key, { at: Date.now(), value })
  return value
}

async function getRankings(dataset) {
  const version = await getVersions()
  const key = `${version.dataPath}:${dataset}`
  const cached = rankingsCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value
  const rankings = await fetchJson(
    `${DATA_ORIGIN}/${version.dataPath}/stats/${dataset}/champion-rankings.json`,
  )
  const value = {
    rankings,
    rankById: new Map((rankings.rows ?? []).map((row) => [String(row.id), row])),
  }
  rankingsCache.set(key, { at: Date.now(), value })
  return value
}

async function getChampionDetail(id, dataset) {
  const version = await getVersions()
  const key = `${version.dataPath}:${dataset}:${id}`
  const cached = detailCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value
  const detail = await fetchJson(
    `${DATA_ORIGIN}/${version.dataPath}/stats/${dataset}/champion-details/${id}.json`,
    30000,
  )
  detailCache.set(key, { at: Date.now(), value: detail })
  if (detailCache.size > 60) {
    const oldest = [...detailCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) detailCache.delete(oldest[0])
  }
  return detail
}

function itemRef(resources, id) {
  const row = resources.items?.[String(id)]
  return {
    id: Number(id),
    name: row?.name ?? String(id),
    icon: asset(row?.icon),
  }
}

function spellRef(resources, id) {
  const row = resources.spells?.[String(id)]
  return {
    id: Number(id),
    name: row?.name ?? String(id),
    icon: asset(row?.icon),
  }
}

function augmentRef(resources, row) {
  const meta = resources.augments?.[String(row.id)]
  return {
    id: Number(row.id),
    name: meta?.name ?? String(row.id),
    icon: asset(meta?.icon),
    rarity: meta?.rarity ?? 'silver',
    rarityLabel: RARITY_LABEL[meta?.rarity] ?? meta?.rarity ?? '白银',
    rank: row.rank,
    tier: row.tier,
    winRate: row.winRate,
    pickRate: row.pickRate,
    sampleCount: row.sampleCount,
    augmentRank: row.augmentRank,
    augmentTier: row.augmentTier,
    availableStages: row.availableStages ?? [],
  }
}

function itemList(resources, rows) {
  return (rows ?? []).map((row) => itemRef(resources, row.id))
}

function compactBuild(resources, profile) {
  const route = profile.routes?.[0] ?? {}
  const coreItems = itemList(resources, route.purchaseOrder?.length ? route.purchaseOrder : profile.itemSet)
  const starters = (route.starters ?? [])
    .filter((row) => row.sampleCount >= 50)
    .slice(0, 3)
    .map((row) => ({
      items: itemList(resources, row.items),
      winRate: row.winRate,
      pickRate: row.pickRate,
      sampleCount: row.sampleCount,
    }))
  const boots = (route.boots ?? [])
    .filter((row) => row.sampleCount >= 50)
    .slice(0, 2)
    .map((row) => ({
      item: itemRef(resources, row.item.id),
      winRate: row.winRate,
      pickRate: row.pickRate,
      sampleCount: row.sampleCount,
    }))
  const later = (route.laterItems ?? [])
    .filter((row) => row.sampleCount >= 50)
    .slice(0, 3)
    .map((row) => ({
      item: itemRef(resources, row.item.id),
      winRate: row.winRate,
      pickRate: row.pickRate,
      sampleCount: row.sampleCount,
    }))
  return {
    items: coreItems,
    winRate: profile.winRate,
    pickRate: profile.pickRate,
    sampleCount: profile.sampleCount,
    starters,
    boots,
    later,
  }
}

function compactBuilds(resources, detail) {
  const source = detail.builds?.filtered?.archetypes?.length
    ? detail.builds.filtered
    : detail.builds?.unfiltered?.archetypes?.length
      ? detail.builds.unfiltered
      : detail.builds
  const archetypes = source?.archetypes ?? []
  const profiles = []
  for (const archetype of archetypes) {
    for (const profile of archetype.profiles ?? []) {
      if (!profile || !Array.isArray(profile.itemSet) || profile.itemSet.length === 0) continue
      if ((profile.sampleCount ?? 0) < MIN_BUILD_SAMPLE) continue
      profiles.push({ ...profile, archetype: archetype.key })
    }
  }
  profiles.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || (b.sampleCount ?? 0) - (a.sampleCount ?? 0))
  const seen = new Set()
  const chosen = []
  for (const profile of profiles) {
    const key = profile.itemSet.map((row) => row.id).join('-')
    if (seen.has(key)) continue
    seen.add(key)
    chosen.push(profile)
    if (chosen.length >= 3) break
  }
  return chosen.map((profile) => compactBuild(resources, profile))
}

function compactAugments(resources, detail) {
  const groups = { prismatic: [], gold: [], silver: [] }
  for (const row of detail.augments?.all ?? []) {
    if ((row.sampleCount ?? 0) < MIN_AUGMENT_SAMPLE) continue
    const meta = resources.augments?.[String(row.id)]
    const rarity = meta?.rarity
    if (!rarity || !groups[rarity]) continue
    groups[rarity].push(augmentRef(resources, row))
  }
  for (const rarity of Object.keys(groups)) {
    groups[rarity].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    groups[rarity] = groups[rarity].slice(0, 15)
  }
  return groups
}

function compactSummoners(resources, detail) {
  return (detail.summoners ?? [])
    .filter((row) => (row.sampleCount ?? 0) >= 100)
    .slice(0, 3)
    .map((row) => ({
      spells: (row.spells ?? []).map((spell) => spellRef(resources, spell.id)),
      winRate: row.winRate,
      pickRate: row.pickRate,
      sampleCount: row.sampleCount,
    }))
}

function compactSkills(detail) {
  return (detail.skills ?? [])
    .filter((row) => (row.sampleCount ?? 0) >= 100)
    .slice(0, 3)
    .map((row) => ({
      order: row.order,
      winRate: row.winRate,
      pickRate: row.pickRate,
      sampleCount: row.sampleCount,
    }))
}

export async function buildChampionPayload(id, datasetArg = 'all') {
  const dataset = normalizeDataset(datasetArg)
  const resources = await getResources()
  const { rankById } = await getRankings(dataset)
  const championId = Number(id)
  if (!Number.isInteger(championId) || championId <= 0) throw new Error('无效的英雄 ID')
  const detail = await getChampionDetail(championId, dataset)
  const meta = resources.champions?.[String(championId)]
  if (!meta) throw new Error(`未知英雄：${championId}`)
  const rank = rankById.get(String(championId)) ?? {}
  const stats = detail.champion?.stats ?? {}
  return {
    ok: true,
    version: resources.version.version,
    dataDate: resources.version.dataDate,
    dataset,
    minAugmentSample: MIN_AUGMENT_SAMPLE,
    champion: {
      id: championId,
      slug: meta.slug,
      name: meta.name,
      title: meta.title,
      icon: asset(meta.icon),
      tier: rank.tier ?? detail.champion?.tier ?? '',
      rank: rank.rank ?? detail.champion?.rank ?? null,
      winRate: stats.winRate ?? rank.winRate ?? null,
      pickRate: stats.pickRate ?? rank.pickRate ?? null,
      sampleCount: stats.sampleCount ?? rank.sampleCount ?? null,
    },
    builds: compactBuilds(resources, detail),
    summoners: compactSummoners(resources, detail),
    skills: compactSkills(detail),
    augments: compactAugments(resources, detail),
  }
}

export async function listChampions(datasetArg = 'all') {
  const dataset = normalizeDataset(datasetArg)
  const resources = await getResources()
  const { rankById } = await getRankings(dataset)
  const rows = []
  for (const [id, meta] of Object.entries(resources.champions ?? {})) {
    const rank = rankById.get(String(id)) ?? {}
    rows.push({
      id: Number(id),
      slug: meta.slug,
      name: meta.name,
      title: meta.title,
      icon: asset(meta.icon),
      tier: rank.tier ?? '',
      rank: rank.rank ?? 9999,
      winRate: rank.winRate ?? null,
      pickRate: rank.pickRate ?? null,
    })
  }
  rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'zh-CN'))
  return {
    ok: true,
    version: resources.version.version,
    dataDate: resources.version.dataDate,
    dataset,
    champions: rows,
  }
}

function normalizeParticipant(row) {
  return {
    gameName: row.gameName,
    tagLine: row.tagLine,
    teamId: row.teamId,
    isSelf: row.isSelf === true,
    championId: row.championId,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    rating: Number.isFinite(row.rating) ? row.rating : undefined,
    performanceScore: Number.isFinite(row.performanceScore) ? row.performanceScore : undefined,
  }
}

function normalizeMatch(row) {
  return {
    gameCreationTime: row.gameCreationTime,
    championId: row.championId,
    matchResult: row.matchResult,
    durationSeconds: row.durationSeconds,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    avgRating: row.avgRating,
    blueAvgRating: row.blueAvgRating,
    redAvgRating: row.redAvgRating,
    participants: (row.participants ?? []).map(normalizeParticipant),
  }
}

export async function queryRating(gameName, tagLine) {
  const name = String(gameName ?? '').trim()
  const tag = String(tagLine ?? '').trim()
  if (!name || !tag) throw new Error('请输入完整的「昵称#Tag」')
  if (name.length > 64 || tag.length > 32) throw new Error('昵称或 Tag 过长')
  const cacheKey = `${name.toLowerCase()}#${tag.toLowerCase()}`
  const cached = ratingCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 2 * 60 * 1000) return cached.value

  const url = new URL(`${RATING_ORIGIN}/rating`)
  url.searchParams.set('gameName', name)
  url.searchParams.set('tagLine', tag)
  const payload = await fetchJson(url.toString(), 20000)
  if (payload?.code !== 200 || !payload.data) {
    const error = new Error(payload?.message || '未找到该玩家的海克斯大乱斗记录')
    error.status = 404
    throw error
  }
  const data = payload.data
  const value = {
    ok: true,
    gameName: data.gameName,
    tagLine: data.tagLine,
    platformId: data.platformId,
    rating: data.rating,
    ratingType: data.ratingType,
    marginOfError: data.marginOfError,
    performanceScore: data.performanceScore,
    performanceComment: data.performanceComment ?? [],
    remoteLastMatchTime: data.remoteLastMatchTime,
    matches: (data.matches ?? []).slice(0, 8).map(normalizeMatch),
  }
  ratingCache.set(cacheKey, { at: Date.now(), value })
  if (ratingCache.size > 60) {
    const oldest = [...ratingCache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) ratingCache.delete(oldest[0])
  }
  return value
}

function sendJson(response, status, body) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.end(JSON.stringify(body))
}

function route(handler) {
  return async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const result = await handler(url)
      sendJson(response, 200, result)
    } catch (error) {
      const status = Number(error?.status) || 502
      sendJson(response, status, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const inject = ['webServer']

export function apply(ctx) {
  const routes = [
    [
      '/aramkit-api/champions',
      route(async (url) => {
        const dataset = url.searchParams.get('dataset') ?? 'all'
        return await listChampions(dataset)
      }),
    ],
    [
      '/aramkit-api/champion',
      route(async (url) => {
        const id = Number(url.searchParams.get('id'))
        if (!Number.isInteger(id) || id <= 0) throw new Error('缺少英雄 ID')
        const dataset = url.searchParams.get('dataset') ?? 'all'
        return await buildChampionPayload(id, dataset)
      }),
    ],
    [
      '/aramkit-api/rating',
      route(async (url) => {
        const gameName = url.searchParams.get('gameName') ?? ''
        const tagLine = url.searchParams.get('tagLine') ?? ''
        return await queryRating(gameName, tagLine)
      }),
    ],
  ]
  for (const [path, handler] of routes) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, handler }), `aramkit-helper: ${path}`)
  }
}

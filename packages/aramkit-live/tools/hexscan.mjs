/**
 * hexscan — 海克斯选卡识别（本地，零 token）
 *
 *   node tools/hexscan.mjs grab [--out x.png]
 *   node tools/hexscan.mjs scan [--png x.png] [--champion 157] [--json] [--mask-overlay]
 *   node tools/hexscan.mjs watch [--overlay] [--champion 157] [--timeout 600] [--once]
 *
 * 思路：整屏 OCR → 用 ARAMKit 词表把卡名对回来 → 按该英雄的海克斯胜率排序。
 * 不做模板匹配、不猜坐标，所以换分辨率/UI 缩放都不怕。
 *
 * 注意：DSH 沙箱禁止 Node 用管道 spawn 子进程，所以这里所有子进程都
 * `stdio: 'ignore'`，结果一律走文件（ffmpeg 写 PNG/裸帧，PowerShell 写 JSON）。
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchAugments } from '../src/augment-match.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const CACHE = join(ROOT, '.cache')

const FFMPEG = process.env.DSH_FFMPEG_PATH
  || join(process.env.DSH_HOME || join(process.env.USERPROFILE || '', '.dsh'), 'tools', 'ffmpeg', 'bin', 'ffmpeg.exe')
const OCR_PS1 = join(HERE, 'ocr.ps1')

const args = process.argv.slice(2)
const cmd = args.find((a) => !a.startsWith('--')) ?? 'scan'
const opt = {}
for (let i = 0; i < args.length; i += 1) {
  const a = args[i]
  if (!a.startsWith('--')) continue
  const eq = a.indexOf('=')
  if (eq > 0) opt[a.slice(2, eq)] = a.slice(eq + 1)
  else if (args[i + 1] && !args[i + 1].startsWith('--')) { opt[a.slice(2)] = args[i + 1]; i += 1 }
  else opt[a.slice(2)] = true
}

function log(...a) { if (!opt.json) console.log(...a) }

/** 跑一个不产生管道的子进程，等它自己退出。 */
function execQuiet(file, argv, timeout = 30000) {
  return new Promise((res, rej) => {
    const child = spawn(file, argv, { stdio: 'ignore', windowsHide: true })
    const timer = setTimeout(() => { try { child.kill() } catch { /* 已退出 */ } ; rej(new Error('超时')) }, timeout)
    child.once('error', (e) => { clearTimeout(timer); rej(e) })
    child.once('exit', (code) => { clearTimeout(timer); code === 0 ? res() : rej(new Error(`退出码 ${code}`)) })
  })
}

/** 直接读 PNG 头拿尺寸，省掉一次 ffmpeg 打听。 */
function pngSize(png) {
  const b = readFileSync(png)
  if (b.length < 24 || b.readUInt32BE(12) !== 0x49484452) throw new Error('不是 PNG')
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
}

const ENGINES = {
  ddagrab: ['-f', 'lavfi', '-i', 'ddagrab=0:framerate=30', '-frames:v', '1', '-vf', 'hwdownload,format=bgra'],
  gdigrab: ['-f', 'gdigrab', '-framerate', '5', '-i', 'desktop', '-frames:v', '1'],
}

/**
 * 快扫的裁剪：只留中间那条横带。选卡永远在屏幕正中，整屏 OCR 是纯浪费。
 * 只裁纵向是为了让覆盖层的遮罩坐标仍然简单（横向不偏移）。
 */
const FAST_CROP = 'crop=iw:ih*0.55:0:ih*0.22'
const FAST_TOP = 0.22

async function toRaw(png, mask) {
  const raw = png.replace(/\.png$/i, '') + '.bgra'
  rmSync(raw, { force: true })
  // mask：把某块矩形涂黑再送 OCR。覆盖层就压在右上角，不涂掉会把
  // 覆盖层上的旧卡名当成新卡读回来（自己看见自己）。
  const vf = mask
    ? ['-vf', `drawbox=x=${mask.x}:y=${mask.y}:w=${mask.w}:h=${mask.h}:color=black@1:t=fill`]
    : []
  await execQuiet(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', png, ...vf,
    '-f', 'rawvideo', '-pix_fmt', 'bgra', '-y', raw], 20000)
  return raw
}

/**
 * 画面是不是"一片纯色"。沙箱里 ddagrab 有时不报错但吐黑帧，
 * 只看文件大小或"有没有亮像素"都不够：黑帧上仍有鼠标指针那几十个亮点。
 * 所以看的是"非黑像素占比"。
 */
function hasContent(raw) {
  const b = readFileSync(raw)
  if (b.length < 4) return false
  const step = 4 * 97
  let lit = 0
  let n = 0
  for (let i = 0; i + 3 < b.length; i += step) {
    n += 1
    if ((b[i] + b[i + 1] + b[i + 2]) / 3 > 8) lit += 1
  }
  return n > 0 && lit / n > 0.02
}

/** 便宜的帧指纹：抽 512 个采样点做 FNV，用来判断"画面有没有变"。 */
function signature(raw) {
  const b = readFileSync(raw)
  const step = Math.max(4, Math.floor(b.length / 512))
  let h = 2166136261
  for (let i = 0; i + 2 < b.length; i += step) {
    h = Math.imul(h ^ (b[i] + b[i + 1] * 7 + b[i + 2] * 13), 16777619) >>> 0
  }
  return h
}

const INPUTS = {
  ddagrab: ['-f', 'lavfi', '-i', 'ddagrab=0:framerate=30', '-frames:v', '1'],
  gdigrab: ['-f', 'gdigrab', '-framerate', '5', '-i', 'desktop', '-frames:v', '1'],
}
const FILTERS = {
  ddagrab: (fast) => ['-vf', fast ? `hwdownload,format=bgra,${FAST_CROP}` : 'hwdownload,format=bgra'],
  gdigrab: (fast) => (fast ? ['-vf', FAST_CROP] : []),
}

/**
 * 抓一帧。ddagrab 走 GPU 更省 CPU，但在受限环境里会"成功"吐黑帧，
 * 所以抓到之后要验一下有没有内容，黑了就退 gdigrab。
 * fast：只截屏幕中间那块（选卡永远在正中间），OCR 快 3 倍。
 */
async function grab(out, prefer = 'ddagrab', fast = false) {
  mkdirSync(dirname(out), { recursive: true })
  const order = prefer === 'gdigrab' ? ['gdigrab', 'ddagrab'] : ['ddagrab', 'gdigrab']
  const why = []
  for (const name of order) {
    rmSync(out, { force: true })
    try {
      await execQuiet(FFMPEG, ['-hide_banner', '-loglevel', 'error',
        ...INPUTS[name], ...FILTERS[name](fast), '-y', out], 20000)
      if (!existsSync(out)) { why.push(`${name}: 没出图`); continue }
      const raw = await toRaw(out)
      const ok = hasContent(raw)
      rmSync(raw, { force: true })
      if (ok) return { out, engine: name }
      why.push(`${name}: 黑帧`)
    } catch (e) { why.push(`${name}: ${e.message}`) }
  }
  throw new Error(`抓屏失败（${why.join(' / ')}）`)
}

async function ocr(raw, width, height) {
  const out = raw.replace(/\.bgra$/i, '') + '.ocr.json'
  rmSync(out, { force: true })
  await execQuiet('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', OCR_PS1,
      '-Raw', raw, '-Width', String(width), '-Height', String(height), '-Out', out], 120000)
  if (!existsSync(out)) throw new Error('OCR 没有产出结果文件')
  return JSON.parse(readFileSync(out, 'utf8'))
}

function loadAugments() {
  const data = JSON.parse(readFileSync(join(CACHE, 'augments.json'), 'utf8'))
  return Object.entries(data).map(([id, v]) => ({ id, name: v.name, rarity: v.rarity }))
}

/** 从整屏 OCR 行里挑出卡名：不同 id 去重，最多 3 张。 */
export function pickCards(lines, augments, { minScore = 0.72, max = 3 } = {}) {
  const byId = new Map()
  for (const line of lines) {
    for (const m of matchAugments(line, augments, { limit: 3, minScore })) {
      const prev = byId.get(m.id)
      if (!prev || m.score > prev.score) byId.set(m.id, { ...m, line })
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, max)
}

/** 一句话建议：给"该怎么选"，不只是"哪个高"。 */
export function makeAdvice(ranked) {
  if (!ranked.length) return ''
  const top = ranked[0]
  const second = ranked[1]
  if (!top.augmentWinRate) return `选「${top.name}」（该英雄暂无统计）`
  if (second?.augmentWinRate) {
    const gap = (top.augmentWinRate - second.augmentWinRate) * 100
    if (gap < 1) return `「${top.name}」与「${second.name}」基本持平（差 ${gap.toFixed(1)} 点），按手感/阵容选`
    return `选「${top.name}」，比第二高 ${gap.toFixed(1)} 个点`
  }
  return `选「${top.name}」`
}

function championLabel(id) {
  if (!id) return ''
  try {
    const champs = JSON.parse(readFileSync(join(CACHE, 'champions.json'), 'utf8'))
    const row = champs[String(id)]
    if (!row) return `英雄 ${id}`
    return row.title ? `${row.name}·${row.title}` : row.name
  } catch { return `英雄 ${id}` }
}

async function loadChampionStats(id) {
  if (!id) return null
  // 缓存 30 分钟：盯屏时每 2 秒查一次网络，光 RTT 就比 OCR 还慢
  const cacheFile = join(CACHE, `champion-stats-${id}.json`)
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
    if (cached?.at && Date.now() - cached.at < 30 * 60 * 1000 && cached.rows) {
      return new Map(cached.rows)
    }
  } catch { /* 没缓存或坏了，重新拉 */ }

  const versions = JSON.parse(readFileSync(join(CACHE, 'versions.json'), 'utf8'))
  const latest = versions.versions.find((v) => v.version === versions.latest) ?? versions.versions[0]
  const url = `https://data.aramkit.cn/${latest.dataPath}/stats/all/champion-details/${id}.json`
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSH-ARAMKit-Online/1.0',
      referer: 'https://aramkit.cn/',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null
  const detail = await res.json()
  const table = new Map()
  for (const group of Object.values(detail.augments ?? detail.augmentStats ?? {})) {
    if (!Array.isArray(group)) continue
    for (const row of group) table.set(String(row.id), row)
  }
  try {
    writeFileSync(cacheFile, JSON.stringify({ at: Date.now(), rows: [...table] }))
  } catch { /* 写不了就算了 */ }
  return table
}

function rankCards(cards, stats) {
  return cards.map((c) => {
    const s = stats?.get(c.id)
    return {
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      match: c.score,
      winRate: s?.winRate ?? null,
      augmentWinRate: s?.augmentWinRate ?? null,
      tier: s?.augmentTier ?? s?.tier ?? null,
      pickRate: s?.pickRate ?? null,
      samples: s?.sampleCount ?? null,
      matchedLine: c.line ?? null,
    }
  }).sort((a, b) => (b.augmentWinRate ?? b.winRate ?? 0) - (a.augmentWinRate ?? a.winRate ?? 0))
}

if (cmd === 'grab') {
  const out = resolve(opt.out || join(CACHE, 'grab.png'))
  const r = await grab(out)
  if (opt.json) console.log(JSON.stringify(r))
  else log(`抓屏成功（${r.engine}）→ ${r.out}`)
} else if (cmd === 'scan') {
  let png = opt.png ? resolve(opt.png) : null
  let engine = 'reuse'
  if (!png) {
    // 用 pid 命名：宿主的轮询和手敲的命令可能同时跑，共用一个 grab.png 会互相删文件
    png = resolve(join(CACHE, `grab-${process.pid}.png`))
    const r = await grab(png, 'ddagrab', Boolean(opt.fast || opt['mask-overlay']))
    engine = r.engine
    log(`抓屏（${engine}）`)
  }
  const { width, height } = pngSize(png)
  const fast = Boolean(opt.fast || opt['mask-overlay'])
  const t0 = Date.now()
  // 快扫裁掉了上面 22%，覆盖层遮罩的 y 要跟着减掉这段
  const cropTop = fast ? Math.round((height / 0.55) * FAST_TOP) : 0
  const mask = opt['mask-overlay']
    ? { x: Math.max(0, width - 760), y: 0, w: 760, h: Math.max(40, 508 - cropTop) }
    : null
  const raw = await toRaw(png, mask)
  const ocrResult = await ocr(raw, width, height)
  const t1 = Date.now()
  const cards = pickCards(ocrResult.lines, loadAugments())
  const t2 = Date.now()

  const stats = await loadChampionStats(opt.champion).catch(() => null)
  const ranked = rankCards(cards, stats)
  const out = {
    png,
    engine,
    size: `${width}x${height}`,
    ocrLines: ocrResult.lines.length,
    ocrMs: t1 - t0,
    matchMs: t2 - t1,
    champion: opt.champion ?? null,
    championLabel: championLabel(opt.champion),
    cards: ranked,
    advice: makeAdvice(ranked),
  }
  writeFileSync(join(CACHE, 'last-scan.json'), JSON.stringify(out, null, 2))
  if (opt.json) console.log(JSON.stringify(out, null, 2))
  else {
    log(`屏幕 ${out.size} · OCR ${out.ocrLines} 行（${out.ocrMs}ms）· 识别 ${out.cards.length} 张卡（${out.matchMs}ms）`)
    if (!out.cards.length) log('没识别到海克斯卡 —— 要么不在选卡界面，要么 OCR 没读清。')
    for (const c of ranked) {
      const wr = c.augmentWinRate != null ? `${(c.augmentWinRate * 100).toFixed(1)}%` : '—'
      log(`  [${c.tier ?? '?'}] ${c.name}（${c.rarity}）海克斯胜率 ${wr} · 样本 ${c.samples ?? '—'} · 匹配 ${c.match}`)
    }
    if (out.advice) log(`建议：${out.advice}`)
  }
} else if (cmd === 'watch') {
  // 盯屏：抓起一张就 OCR，读出 2 张以上卡就往覆盖层推。
  // 纯本地、不花 token。
  const seconds = Number(opt.timeout ?? 180)
  const deadline = Date.now() + seconds * 1000
  const champion = opt.champion
  const stats = await loadChampionStats(champion).catch(() => null)
  const augments = loadAugments()
  const png = resolve(join(CACHE, 'watch.png'))
  if (opt.overlay) {
    // 独立置顶窗：不依赖 DSH 进程，鼠标可穿透，游戏里也能看到
    const py = process.env.DSH_SEE_PYTHON || 'python'
    const child = spawn(py, [join(HERE, 'hexoverlay.py'), '--file', join(CACHE, 'overlay.json')],
      { stdio: 'ignore', detached: true, windowsHide: true })
    child.unref()
    log('覆盖层已启动（右上角，鼠标穿透）')
  }
  let round = 0
  let lastSig = null
  let idle = 0
  let lastKey = ''
  let lastKeyAt = 0
  while (Date.now() < deadline) {
    round += 1
    try {
      const r = await grab(png)
      const { width, height } = pngSize(png)
      const mask = opt.overlay
        ? { x: Math.max(0, width - 760), y: 8, w: 760, h: 500 }
        : null
      const raw = await toRaw(png, mask)
      // 画面没变就别再 OCR 一遍：选卡界面是静态的，静止时每轮白跑一次
      // 很浪费 CPU（会跟游戏抢核）。每 5 轮强制识别一次兜底。
      const sig = signature(raw)
      idle += 1
      if (sig === lastSig && idle < 5) {
        await new Promise((res) => setTimeout(res, Number(opt.interval ?? 1500)))
        continue
      }
      lastSig = sig
      idle = 0
      const ocrResult = await ocr(raw, width, height)
      const cards = pickCards(ocrResult.lines, augments)
      const stamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      if (cards.length >= 2) {
        const ranked = rankCards(cards, stats)
        const advice = makeAdvice(ranked)
        const payload = {
          at: stamp,
          champion: champion ?? null,
          championLabel: championLabel(champion),
          cards: ranked,
          advice,
        }
        writeFileSync(join(CACHE, 'last-watch.json'), JSON.stringify(payload, null, 2))
        // 同一批卡只推一次：静止画面每 5 轮会兜底重认一次，否则覆盖层会反复闪
        const key = ranked.map((c) => c.id).join(',')
        const repeat = key === lastKey && Date.now() - lastKeyAt < 120000
        if (!repeat) {
          writeFileSync(join(CACHE, 'overlay.json'), JSON.stringify(payload, null, 2))
          lastKey = key
          lastKeyAt = Date.now()
          log(`[${stamp}] 抓到 ${cards.length} 张卡（${r.engine}）→ 已推到覆盖层`)
          for (const c of ranked) {
            const wr = c.augmentWinRate != null ? `${(c.augmentWinRate * 100).toFixed(1)}%` : '—'
            log(`  [${c.tier ?? '?'}] ${c.name} · 海克斯胜率 ${wr} · 样本 ${c.samples ?? '—'}`)
          }
          log(`建议：${advice}`)
        }
        if (opt.once) process.exit(0)
      } else if (round <= 3 || round % 10 === 0) {
        log(`[${stamp}] 第 ${round} 轮 · OCR ${ocrResult.lines.length} 行 · 没看到卡`)
      }
    } catch (e) {
      log(`第 ${round} 轮失败：${e.message}`)
    }
    await new Promise((r) => setTimeout(r, Number(opt.interval ?? 1500)))
  }
  log('超时，没等到选卡界面。')
  process.exit(1)
} else {
  console.error('用法：node tools/hexscan.mjs grab|scan|watch [--png x.png] [--champion 157] [--json] [--timeout 180]')
  process.exit(2)
}

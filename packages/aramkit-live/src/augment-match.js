/**
 * augment-match.js — 把 OCR 出来的一坨文字，对回 ARAMKit 的海克斯词表。
 *
 * 为什么不让模型读卡面：卡面文字又小又长，OCR 一定掉字；模型看到残句会顺着
 * 编一个"看起来合理"的海克斯。词表是有限的 239 条，匹配是确定性的，错了也
 * 能给出置信度让人复核。
 *
 * 名字都很短（2–6 字），所以策略是"滑窗 + 编辑距离"，不是整段比对。
 */

/** 全角→半角、去标点、去空白、小写。只保留汉字/字母/数字。 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, '')
}

/** Levenshtein 距离，只算到 limit 就提前退出（这些名字很短，够用）。 */
export function editDistance(a, b, limit = Infinity) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let cur = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i += 1) {
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > limit) return limit + 1
    const swap = prev
    prev = cur
    cur = swap
  }
  return prev[b.length]
}

/** 相似度 0..1：1 - 距离/较长者长度。 */
export function similarity(a, b) {
  if (!a || !b) return 0
  const d = editDistance(a, b)
  return 1 - d / Math.max(a.length, b.length)
}

/**
 * 在 text 里找 name 的最佳窗口相似度。
 * 窗口长度允许 name 长度 ±2，这样"OCR 多认/少认一个字"也能对上。
 */
export function bestWindowScore(name, text) {
  if (!name || !text) return 0
  if (text.includes(name)) return 1
  const min = Math.max(2, name.length - 2)
  const max = name.length + 2
  let best = 0
  for (let len = min; len <= max; len += 1) {
    if (len > text.length) break
    for (let i = 0; i + len <= text.length; i += 1) {
      const score = similarity(name, text.slice(i, i + len))
      // 短名字容易在长文本里"撞"到，按长度打折
      const weighted = score * Math.min(1, len / name.length)
      if (weighted > best) best = weighted
      if (best >= 0.999) return best
    }
  }
  return best
}

/**
 * @param {string} ocrText 一段 OCR 文本（可以带描述、品质字样）
 * @param {Array<{id:string,name:string,rarity?:string}>} augments 词表
 * @param {{limit?:number,minScore?:number,rarity?:string}} [opts]
 * @returns {Array<{id:string,name:string,rarity?:string,score:number}>}
 */
export function matchAugments(ocrText, augments, opts = {}) {
  const { limit = 5, minScore = 0.6, rarity } = opts
  const text = normalizeText(ocrText)
  if (!text) return []
  const scored = []
  for (const aug of augments) {
    const name = normalizeText(aug.name)
    if (!name) continue
    let score = bestWindowScore(name, text)
    // 卡框颜色/品质已知时，品质对不上的降权（不是排除：OCR 可能只读到名字）
    if (rarity && aug.rarity && aug.rarity !== rarity) score *= 0.85
    if (score >= minScore) scored.push({ ...aug, score: Math.round(score * 1000) / 1000 })
  }
  scored.sort((a, b) => b.score - a.score || b.name.length - a.name.length)
  return scored.slice(0, limit)
}

/** 三张卡各自 OCR 之后，做一次互斥分配：一张卡只能吃一个海克斯。 */
export function assignCards(texts, augments, opts = {}) {
  const candidates = texts.map((t) => matchAugments(t, augments, opts))
  const used = new Set()
  const out = []
  for (let i = 0; i < texts.length; i += 1) {
    const pick = candidates[i].find((c) => !used.has(c.id)) ?? null
    if (pick) used.add(pick.id)
    out.push({ text: texts[i], pick, candidates: candidates[i] })
  }
  return out
}

/**
 * comments-service.js — 游戏内 AI 解说：人格设定 + 评论流。
 *
 * 只做"存什么、怎么给前端"，不负责调模型——模型调用在 index.js 里，
 * 那边才有 provider/model 的选择权限。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const MAX_COMMENTS = 200
const DEFAULT_DISPLAY_MS = 10_000
const MIN_DISPLAY_MS = 3_000
const MAX_DISPLAY_MS = 30_000
export const DEFAULT_PERSONA = '温柔的女朋友陪玩：说话软、爱夸人、会维护你，输了也先安慰，偶尔小撒娇，短句口语，绝不毒舌。'
/** 老版本存下来的默认值：读到就迁移成新的，免得用户一直用旧人格 */
const LEGACY_PERSONA = '毒舌但好笑的老队友：短句、口语、只看画面里发生的事，不编造数据，不说教。'

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

export function createCommentsService({ dshHome }) {
  const file = join(dshHome, 'aramkit-live', 'comments.json')
  const saved = readJson(file, {})
  const state = {
    enabled: saved.enabled === true,
    persona: typeof saved.persona === 'string' && saved.persona.trim() && saved.persona !== LEGACY_PERSONA
      ? saved.persona
      : DEFAULT_PERSONA,
    comments: Array.isArray(saved.comments) ? saved.comments.slice(-MAX_COMMENTS) : [],
    lastAt: saved.lastAt || 0,
    displayMs: Math.max(MIN_DISPLAY_MS, Math.min(MAX_DISPLAY_MS,
      Number(saved.displayMs) || DEFAULT_DISPLAY_MS)),
  }

  function save() {
    writeJson(file, {
      enabled: state.enabled,
      persona: state.persona,
      comments: state.comments.slice(-MAX_COMMENTS),
      lastAt: state.lastAt,
      displayMs: state.displayMs,
    })
  }

  return {
    snapshot() {
      return {
        ok: true,
        enabled: state.enabled,
        persona: state.persona,
        displayMs: state.displayMs,
        comments: state.comments.slice(-60),
      }
    },
    setEnabled(enabled) {
      state.enabled = Boolean(enabled)
      save()
      return this.snapshot()
    },
    setPersona(persona) {
      const text = String(persona || '').trim()
      state.persona = text || DEFAULT_PERSONA
      save()
      return this.snapshot()
    },
    setDisplayMs(ms) {
      const value = Number(ms)
      state.displayMs = Math.max(MIN_DISPLAY_MS, Math.min(MAX_DISPLAY_MS,
        Number.isFinite(value) && value > 0 ? value : DEFAULT_DISPLAY_MS))
      save()
      return this.snapshot()
    },
    add(text, meta = {}) {
      const clean = String(text || '').trim()
      if (!clean) return null
      const row = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        at: Date.now(),
        text: clean.slice(0, 400),
        kind: meta.kind || 'comment',
      }
      state.comments.push(row)
      state.comments = state.comments.slice(-MAX_COMMENTS)
      state.lastAt = row.at
      save()
      return row
    },
    clear() {
      state.comments = []
      save()
      return this.snapshot()
    },
    get enabled() { return state.enabled },
    get persona() { return state.persona },
    get lastAt() { return state.lastAt },
    get displayMs() { return state.displayMs },
  }
}

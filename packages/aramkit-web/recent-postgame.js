import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { sanitize } from '../aramkit-core/service.js'

// Retain one anonymous result across restarts so a format fix does not lose
// the user's match. No credentials, model responses or account IDs are stored.
export function createPostgameStore({ file = new URL('./.local/recent-postgame.json', import.meta.url), now = Date.now } = {}) {
  const target = file instanceof URL ? fileURLToPath(file) : file
  let writing = Promise.resolve()
  function anonymous(game) {
    if (!game?.gameId || !Array.isArray(game.allies) || game.allies.length !== 5 || game.allies.some((row) => !row || typeof row !== 'object' || !row.champion || !Array.isArray(row.items))) return null
    const result = sanitize(game, true)
    result.allies.forEach((row, index) => { row.gameName = row.isLocalPlayer ? '你' : `队友${index + 1}` })
    return result
  }
  return {
    async save(game) {
      const clean = anonymous(game)
      if (!clean) return
      const savedAt = Number.isFinite(game.capturedAt) ? Math.min(game.capturedAt, now()) : now()
      writing = writing.catch(() => {}).then(async () => {
        await mkdir(dirname(target), { recursive: true })
        await writeFile(`${target}.tmp`, JSON.stringify({ savedAt, postgame: clean }), { mode: 0o600 })
        await rename(`${target}.tmp`, target)
      })
      await writing
    },
    async load() {
      try {
        const record = JSON.parse(await readFile(target, 'utf8'))
        const age = now() - record.savedAt
        if (!Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) return null
        return anonymous(record.postgame)
      } catch { return null }
    },
  }
}

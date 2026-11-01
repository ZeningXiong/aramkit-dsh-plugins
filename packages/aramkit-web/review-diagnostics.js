import { mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Last failed FINAL answer only. Never retain headers, API configuration or reasoning.
export function createReviewDiagnostics({ file = new URL('./.local/review-error.json', import.meta.url) } = {}) {
  const target = file instanceof URL ? fileURLToPath(file) : file
  return { async save(input) {
    const safe = Object.fromEntries(['gameId', 'model', 'destination', 'protocol', 'style', 'at', 'finishReason', 'contentLength', 'nonWhitespaceCharacters', 'inputTokens', 'outputTokens', 'reasoningTokens', 'error', 'finalText'].filter((key) => input[key] !== undefined).map((key) => [key, input[key]]))
    safe.finalText = String(safe.finalText || '').slice(0, 48000).replace(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[redacted]')
    await mkdir(dirname(target), { recursive: true })
    await writeFile(`${target}.tmp`, JSON.stringify(safe), { mode: 0o600 })
    await rename(`${target}.tmp`, target)
  } }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createReviewDiagnostics } from '../review-diagnostics.js'

test('失败诊断仅写入固定允许字段，并脱敏最终文本中的凭据模式', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aramkit-diagnostic-test-'))
  const file = path.join(directory, 'diagnostic.json')
  try {
    const store = createReviewDiagnostics({ file })
    await store.save({ gameId: 'fixture', model: 'fixture-model', contentLength: 3, finalText: 'sk-' + 'a'.repeat(32), apiKey: 'fixture-config-key', headers: { authorization: 'fixture-secret-header' }, reasoning_content: 'fixture-reasoning' })
    const raw = await readFile(file, 'utf8')
    const result = JSON.parse(raw)
    assert.equal(result.finalText, '[redacted]')
    assert.doesNotMatch(raw, /fixture-config-key|fixture-secret-header|fixture-reasoning|apiKey|authorization/)
  } finally { await unlink(file).catch(() => {}); await rmdir(directory) }
})

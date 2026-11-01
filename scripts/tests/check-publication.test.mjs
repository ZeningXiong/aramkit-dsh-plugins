import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const scanner = fileURLToPath(new URL('../check-publication.mjs', import.meta.url))
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'aramkit-publication-test-'))
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(root, 'absent-config'), GIT_AUTHOR_NAME: 'Fixture', GIT_COMMITTER_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test', GIT_COMMITTER_EMAIL: 'fixture@example.test' }
  const git = (...args) => execFileSync('git', args, { cwd: root, env, windowsHide: true, stdio: 'pipe' })
  const write = (file, text) => writeFileSync(join(root, file), text)
  const commit = () => { git('add', '.'); git('commit', '-qm', 'Synthetic test snapshot') }
  const scan = (...args) => {
    const result = spawnSync(process.execPath, [scanner, ...args], { cwd: root, env, encoding: 'utf8', windowsHide: true })
    return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}` }
  }
  try {
    git('init', '-q', '-b', 'main')
    write('README.md', 'Synthetic public source.\n')
    commit()
    run({ git, write, commit, scan })
  } finally {
    // Validate the exact temporary target before any recursive cleanup on Windows.
    assert.equal(resolve(dirname(root)), resolve(tmpdir()))
    assert.match(basename(root), /^aramkit-publication-test-/)
    rmSync(root, { recursive: true, force: true })
  }
}

test('全量扫描会读取已经提交的源码，即使暂存区没有改动', () => fixture(({ scan }) => {
  const result = scan('--all')
  assert.equal(result.status, 0, result.output)
  assert.match(result.output, /1 file snapshots/)
}))

test('暂存凭据会阻止发布，错误不回显凭据值', () => fixture(({ git, write, scan }) => {
  const secret = 'sk-' + 'a'.repeat(32)
  write('config.js', `export const key = '${secret}'\n`)
  git('add', 'config.js')
  const result = scan()
  assert.equal(result.status, 1)
  assert.match(result.output, /API token/)
  assert.equal(result.output.includes(secret), false)
}))

test('历史中已删除的凭据仍会被贡献提交扫描发现', () => fixture(({ write, commit, scan }) => {
  const secret = 'sk-' + 'b'.repeat(32)
  write('config.js', `export const key = '${secret}'\n`)
  commit()
  write('config.js', 'export const key = null\n')
  commit()
  assert.equal(scan('--all').status, 0)
  const result = scan('--all', '--base', 'HEAD~2')
  assert.equal(result.status, 1)
  assert.match(result.output, /API token/)
  assert.equal(result.output.includes(secret), false)
}))

test('对局历史文件即使被强行跟踪也会阻止发布', () => fixture(({ write, commit, scan }) => {
  write('history.json', '{"entries":[]}\n')
  commit()
  const result = scan('--all')
  assert.equal(result.status, 1)
  assert.match(result.output, /history\.json: private\/runtime file is tracked/)
}))

import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'

const client = new Client({ name: 'aramkit-live-smoke', version: '1.0.0' })
const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.js', import.meta.url))], stderr: 'pipe' })
const summary = []
try {
  await client.connect(transport)
  const { tools } = await client.listTools()
  assert.equal(tools.length, 9)
  summary.push({ check: 'MCP initialize / tools.list', ok: true, tools: tools.length })
  for (const [name, args] of [
    ['aramkit_search_champions', { query: '亚索', limit: 3 }],
    ['aramkit_champion_build', { champion: '157', dataset: 'all' }],
    ['aramkit_search_augments', { query: '珠光', limit: 3 }],
  ]) {
    const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 })
    if (result.isError) throw new Error(`${name}: ${result.content[0]?.text}`)
    const value = result.structuredContent
    assert.equal(value.ok, true)
    if (name === 'aramkit_champion_build') assert.equal(value.champion.id, 157)
    else assert.ok(value.total > 0)
    summary.push({ check: name, ok: true, version: value.version, dataDate: value.dataDate, count: value.total, champion: value.champion?.name })
  }
  const status = await client.callTool({ name: 'aramkit_lcu_status', arguments: {} })
  assert.equal(status.isError, undefined)
  summary.push({ check: 'aramkit_lcu_status', ...status.structuredContent })
} catch (error) {
  summary.push({ ok: false, error: error.message })
  process.exitCode = 1
} finally {
  await client.close()
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

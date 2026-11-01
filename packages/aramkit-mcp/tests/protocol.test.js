import test from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'

test('真实 stdio 握手、工具发现、参数校验和异常返回', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.js', import.meta.url))], stderr: 'pipe' })
  const client = new Client({ name: 'aramkit-protocol-test', version: '1.0.0' })
  let stderr = ''
  transport.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    assert.equal(tools.length, 9)
    for (const tool of tools) {
      assert.equal(tool.annotations.destructiveHint, false)
      assert.ok(tool.inputSchema)
    }
    const invalid = await client.callTool({ name: 'aramkit_champion_build', arguments: { champion: -1 } })
    assert.equal(invalid.isError, true)
    const badLimit = await client.callTool({ name: 'aramkit_search_champions', arguments: { limit: 5000 } })
    assert.equal(badLimit.isError, true)
    const badDataset = await client.callTool({ name: 'aramkit_search_champions', arguments: { dataset: 'unknown' } })
    assert.equal(badDataset.isError, true)
    const badLockfile = await client.callTool({ name: 'aramkit_lcu_diagnose', arguments: { lockfile: 'not-a-lockfile.json' } })
    assert.equal(badLockfile.isError, true)
    assert.equal(badLockfile.structuredContent.ok, false)
  } finally {
    await client.close()
  }
  assert.equal(stderr, '')
})

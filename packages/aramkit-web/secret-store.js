import { execFile } from 'node:child_process'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// DPAPI is bound to the signed-in Windows user. Secrets travel over stdin,
// never process arguments, terminal output, browser storage or plaintext files.
export function dpapi(value, decrypt = false) {
  if (process.platform !== 'win32') return Promise.reject(new Error('加密保存仅支持 Windows；请取消“记住密钥”，仅在本次运行中使用。'))
  const method = decrypt ? 'Unprotect' : 'Protect'
  const input = decrypt ? '[Convert]::FromBase64String($value)' : '[Text.Encoding]::UTF8.GetBytes($value)'
  const output = decrypt ? '[Text.Encoding]::UTF8.GetString($bytes)' : '[Convert]::ToBase64String($bytes)'
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $value=[Console]::In.ReadToEnd(); $bytes=[Security.Cryptography.ProtectedData]::${method}(${input},$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write(${output})`
  return new Promise((resolve, reject) => {
    const child = execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000, encoding: 'utf8', maxBuffer: 65536 }, (error, stdout) => {
      if (error) reject(new Error(decrypt ? '无法解密已保存的密钥，请重新填写。' : 'Windows 密钥加密失败；可取消“记住密钥”后重试。'))
      else resolve(stdout.trim())
    })
    child.stdin.on('error', () => {})
    child.stdin.end(value)
  })
}

export function createSecretStore(file = new URL('./.local/ai-settings.json', import.meta.url)) {
  const target = file instanceof URL ? fileURLToPath(file) : file
  return {
    async load() {
      try {
        const stored = JSON.parse(await readFile(target, 'utf8'))
        return { ...stored, apiKey: stored.encryptedKey ? await dpapi(stored.encryptedKey, true) : '' }
      } catch (error) {
        if (error.code === 'ENOENT') return null
        throw new Error('本机 AI 配置无法读取或解密，请重新配置。')
      }
    },
    async save(config) {
      const { apiKey, ...metadata } = config
      const encryptedKey = config.remember && apiKey ? await dpapi(apiKey) : ''
      await mkdir(dirname(target), { recursive: true })
      const temporary = `${target}.tmp`
      await writeFile(temporary, JSON.stringify({ ...metadata, encryptedKey }, null, 2), { mode: 0o600 })
      await rename(temporary, target)
    },
  }
}

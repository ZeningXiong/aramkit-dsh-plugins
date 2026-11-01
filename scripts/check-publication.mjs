import { execFileSync } from 'node:child_process'
import os from 'node:os'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true })
const split = (value) => value.split('\0').filter(Boolean)
const index = split(git('ls-files', '-z'))
const changed = split(git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'))
const issues = []
const privateName = /(?:^|\/)(?:\.local|node_modules|\.pnpm-store|runtime)(?:\/|$)|(?:^|\/)(?:\.env(?:\..+)?|ai-settings\.json|recent-postgame\.json)$|\.(?:log|key|pem|pfx|p12|lnk|zip|exe|dmp)$/i
for (const file of index) if (privateName.test(file) && !file.endsWith('/.env.example') && file !== '.env.example') issues.push(`${file}: private/runtime file is tracked`)
const binaryAllowlist = new Set(['packages/aramkit-web/public/app.ico'])
const rules = [
  ['API token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/],
  ['JWT credential', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['personal user directory', /[A-Za-z]:\\Users\\(?!Public(?:\\|$)|Default(?:\\|$)|<)[^\\\s"']+/i],
]
const paths = [os.homedir(), process.cwd()].map((value) => value.replaceAll('\\', '/').toLowerCase())
for (const file of changed) {
  const blob = execFileSync('git', ['show', `:${file}`], { maxBuffer: 16 * 1024 * 1024, windowsHide: true })
  if (blob.length > 2 * 1024 * 1024) { issues.push(`${file}: oversized staged file`); continue }
  if (blob.includes(0)) {
    if (!binaryAllowlist.has(file)) issues.push(`${file}: binary file requires explicit review`)
    continue
  }
  const lines = blob.toString('utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    const normalized = line.replaceAll('\\\\', '\\')
    for (const [name, pattern] of rules) if (pattern.test(normalized)) issues.push(`${file}:${index + 1}: ${name}`)
    const slashPath = normalized.replaceAll('\\', '/').toLowerCase()
    if (paths.some((prefix) => slashPath.includes(prefix))) issues.push(`${file}:${index + 1}: current machine/workspace path`)
    const emails = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []
    for (const email of emails) if (!/@(?:example\.(?:com|org|net|test|invalid)|users\.noreply\.github\.com)$/i.test(email)) issues.push(`${file}:${index + 1}: email address requires review`)
  })
}
if (issues.length) {
  // Report rule names and positions only; never print matching secret values.
  process.stderr.write(`${issues.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Publication scan passed: ${changed.length} staged files; no tracked credentials, runtime data or personal paths detected.\n`)
}

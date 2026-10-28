/**
 * Read-only League Client (LCU) connector.
 *
 * The LCU is a local HTTPS service with a self-signed certificate. Auth comes
 * from the client lockfile, or from the LeagueClientUx command line on Windows.
 */

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { execFile } from 'node:child_process'

const AUTH_TTL = 8 * 1000
const AUTH_MISS_TTL = 15000
const SUMMONER_TTL = 10 * 60 * 1000

let authCache = { at: 0, value: null }
let authMissAt = 0
let manualLockfile = ''
const summonerCache = new Map()

const LOCKFILE_CANDIDATES = [
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  'E:\\Riot Games\\League of Legends\\lockfile',
  'F:\\Riot Games\\League of Legends\\lockfile',
  'C:\\Program Files\\Riot Games\\League of Legends\\lockfile',
  'C:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile',
  'D:\\Program Files\\Riot Games\\League of Legends\\lockfile',
  'D:\\Program Files (x86)\\Riot Games\\League of Legends\\lockfile',
  'C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'C:\\WeGameApps\\英雄联盟\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\lockfile',
  'E:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'E:\\WeGameApps\\英雄联盟\\lockfile',
  'C:\\腾讯游戏\\英雄联盟\\lockfile',
  'D:\\腾讯游戏\\英雄联盟\\lockfile',
]

const LOG_DIR_CANDIDATES = [
  'C:\\WeGameApps\\英雄联盟\\LeagueClient',
  'D:\\WeGameApps\\英雄联盟\\LeagueClient',
  'E:\\WeGameApps\\英雄联盟\\LeagueClient',
  'C:\\WeGameApps\\英雄联盟\\Logs\\LeagueClient Logs',
  'D:\\WeGameApps\\英雄联盟\\Logs\\LeagueClient Logs',
  'C:\\Riot Games\\League of Legends\\LeagueClient',
  'D:\\Riot Games\\League of Legends\\LeagueClient',
  'C:\\Riot Games\\League of Legends\\Logs\\LeagueClient Logs',
  'D:\\Riot Games\\League of Legends\\Logs\\LeagueClient Logs',
  'C:\\Program Files\\Riot Games\\League of Legends\\LeagueClient',
  'C:\\Program Files (x86)\\Riot Games\\League of Legends\\LeagueClient',
]

export function setLockfileOverride(file) {
  manualLockfile = String(file || '').trim()
  authCache = { at: 0, value: null }
  authMissAt = 0
}

export function getLockfileCandidates() {
  return [
    manualLockfile,
    process.env.ARAMKIT_LCU_LOCKFILE,
    process.env.LOL_LOCKFILE,
    ...LOCKFILE_CANDIDATES,
  ].filter(Boolean)
}

function parseLockfile(text) {
  const parts = String(text || '').trim().split(':')
  if (parts.length < 5) return null
  const port = Number(parts[2])
  const password = parts[3]
  const protocol = parts[4] === 'http' ? 'http' : 'https'
  if (!Number.isInteger(port) || port <= 0 || !password) return null
  return { port, password, protocol, source: 'lockfile' }
}

function readLockfile(file) {
  try {
    if (!file || !fs.existsSync(file)) return null
    const auth = parseLockfile(fs.readFileSync(file, 'utf8'))
    return auth ? { ...auth, file } : null
  } catch {
    return null
  }
}

function parseProcessCommandLine(commandLine) {
  const text = String(commandLine || '')
  const port = text.match(/--app-port=(\d+)/)?.[1]
  const token = text.match(/--remoting-auth-token=([^\s"]+)/)?.[1]
  if (!port || !token) return null
  return {
    port: Number(port),
    password: token,
    protocol: 'https',
    source: 'process',
  }
}

function discoverFromProcess() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null)
      return
    }
    const script =
      "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine"
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 3500, windowsHide: true, maxBuffer: 64 * 1024 },
      (error, stdout) => {
        if (error || !stdout) {
          resolve(null)
          return
        }
        resolve(parseProcessCommandLine(stdout))
      },
    )
  })
}

export function inspectLockfile(file) {
  try {
    if (!file) return { exists: false, size: 0, valid: false, reason: '没有填写路径' }
    if (!fs.existsSync(file)) return { exists: false, size: 0, valid: false, reason: '文件不存在' }
    const stat = fs.statSync(file)
    if (!stat.isFile()) return { exists: true, size: 0, valid: false, reason: '路径不是文件' }
    if (stat.size === 0) {
      return {
        exists: true,
        size: 0,
        valid: false,
        reason: '文件是 0 字节：LeagueClientUx 还没启动或还没登录（Riot Client 的 lockfile 不能代替它）',
      }
    }
    const auth = readLockfile(file)
    if (!auth) {
      return {
        exists: true,
        size: stat.size,
        valid: false,
        reason: '内容不是有效的 LCU lockfile（应为 name:pid:port:password:https）',
      }
    }
    return { exists: true, size: stat.size, valid: true, reason: '', port: auth.port }
  } catch (error) {
    return {
      exists: true,
      size: 0,
      valid: false,
      reason: `无法读取：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(450)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function parseLogAuth(file) {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size === 0) return null
    const fd = fs.openSync(file, 'r')
    const length = Math.min(stat.size, 256 * 1024)
    const buffer = Buffer.alloc(length)
    const bytes = fs.readSync(fd, buffer, 0, length, 0)
    fs.closeSync(fd)
    const text = buffer.toString('utf8', 0, bytes)
    const port = text.match(/--app-port=(\d+)/)?.[1]
    // The LCU remoting token, not the Riot Client token on the same line.
    const token = text.match(/--remoting-auth-token=([^\s"\\]+)/)?.[1]
    if (!port || !token) return null
    return {
      port: Number(port),
      password: token,
      protocol: 'https',
      source: 'log',
      file,
    }
  } catch {
    return null
  }
}

async function discoverFromLogs() {
  const dirs = new Set(LOG_DIR_CANDIDATES)
  for (const file of [manualLockfile, process.env.ARAMKIT_LCU_LOCKFILE, process.env.LOL_LOCKFILE]) {
    if (file) dirs.add(path.dirname(file))
  }
  const logs = []
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || !/LeagueClientUx\.log$/i.test(entry.name)) continue
        const file = path.join(dir, entry.name)
        try {
          const stat = fs.statSync(file)
          logs.push({ file, mtime: stat.mtimeMs, size: stat.size })
        } catch {}
      }
    } catch {}
  }
  logs.sort((a, b) => b.mtime - a.mtime)
  for (const log of logs.slice(0, 8)) {
    if (log.size === 0) continue
    const auth = parseLogAuth(log.file)
    if (auth && (await portOpen(auth.port))) return auth
  }
  return null
}

export function resetLcuCache() {
  authCache = { at: 0, value: null }
  authMissAt = 0
  summonerCache.clear()
}

export async function discoverLcu(force = false) {
  const now = Date.now()
  if (!force && authCache.value && now - authCache.at < AUTH_TTL) return authCache.value
  if (!force && !authCache.value && now - authMissAt < AUTH_MISS_TTL) return null

  for (const candidate of getLockfileCandidates()) {
    const auth = readLockfile(candidate)
    if (auth) {
      authCache = { at: now, value: auth }
      return auth
    }
  }

  const fromLog = await discoverFromLogs()
  if (fromLog) {
    authCache = { at: Date.now(), value: fromLog }
    return fromLog
  }

  const fromProcess = await discoverFromProcess()
  if (fromProcess) {
    authCache = { at: Date.now(), value: fromProcess }
    return fromProcess
  }

  authCache = { at: 0, value: null }
  authMissAt = Date.now()
  return null
}

export async function diagnoseLcu() {
  const candidates = [...new Set(getLockfileCandidates())].map((file) => {
    const info = inspectLockfile(file)
    return {
      path: file,
      exists: info.exists,
      size: info.size,
      valid: info.valid,
      reason: info.reason,
      source: file === manualLockfile ? 'manual' : 'auto',
    }
  })
  const active = await discoverLcu(true)
  const processAuth = active?.source === 'process' ? active : await discoverFromProcess()
  return {
    ok: true,
    env: {
      ARAMKIT_LCU_LOCKFILE: process.env.ARAMKIT_LCU_LOCKFILE || '',
      LOL_LOCKFILE: process.env.LOL_LOCKFILE || '',
    },
    manual: manualLockfile,
    candidates,
    process: processAuth
      ? { found: true, port: processAuth.port, source: 'process' }
      : { found: false },
    log: active?.source === 'log'
      ? { found: true, port: active.port, file: active.file || '' }
      : { found: false },
    active: active
      ? { port: active.port, source: active.source, file: active.file || '' }
      : null,
  }
}

function requestWith(protocol, options) {
  return new Promise((resolve, reject) => {
    const mod = protocol === 'http' ? http : https
    const request = mod.request(
      {
        hostname: '127.0.0.1',
        port: options.port,
        path: options.path,
        method: options.method || 'GET',
        rejectUnauthorized: false,
        timeout: options.timeout || 2500,
        headers: {
          accept: 'application/json',
          authorization: `Basic ${Buffer.from(`riot:${options.password}`).toString('base64')}`,
          ...(options.body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(options.body) } : {}),
        },
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let data = null
          try {
            data = text ? JSON.parse(text) : null
          } catch {
            data = text
          }
          resolve({ status: response.statusCode || 0, data })
        })
      },
    )
    request.on('timeout', () => request.destroy(new Error('LCU request timeout')))
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

export async function lcuRequest(path, options = {}) {
  const auth = await discoverLcu()
  if (!auth) return null
  try {
    const response = await requestWith(auth.protocol, {
      ...auth,
      path,
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : null,
      timeout: options.timeout,
    })
    if (response.status === 401 || response.status === 403) {
      authCache = { at: 0, value: null }
      return null
    }
    if (response.status < 200 || response.status >= 300) return null
    return response.data
  } catch {
    authCache = { at: 0, value: null }
    return null
  }
}

export function lcuGet(path, options = {}) {
  return lcuRequest(path, { ...options, method: 'GET' })
}

export async function getGameflowPhase() {
  const phase = await lcuGet('/lol-gameflow/v1/gameflow-phase', { timeout: 1500 })
  return typeof phase === 'string' ? phase : null
}

export async function getCurrentSummoner() {
  const summoner = await lcuGet('/lol-summoner/v1/current-summoner')
  return summoner && typeof summoner === 'object' ? summoner : null
}

export async function getSummonerById(summonerId) {
  const id = String(summonerId ?? '')
  if (!id) return null
  const cached = summonerCache.get(id)
  if (cached && Date.now() - cached.at < SUMMONER_TTL) return cached.value
  const summoner = await lcuGet(`/lol-summoner/v1/summoners/${encodeURIComponent(id)}`)
  if (!summoner || typeof summoner !== 'object') return null
  const value = {
    summonerId: summoner.summonerId ?? Number(id),
    puuid: summoner.puuid ?? '',
    gameName: summoner.gameName ?? summoner.displayName ?? '',
    tagLine: summoner.tagLine ?? '',
    displayName: summoner.displayName ?? '',
    profileIconId: summoner.profileIconId ?? 0,
  }
  summonerCache.set(id, { at: Date.now(), value })
  return value
}

export async function getChampSelectSession() {
  const session = await lcuGet('/lol-champ-select/v1/session', { timeout: 2000 })
  return session && typeof session === 'object' ? session : null
}

export async function getEogStatsBlock() {
  const eog = await lcuGet('/lol-end-of-game/v1/eog-stats-block', { timeout: 4000 })
  return eog && typeof eog === 'object' && eog.gameId ? eog : null
}

export async function getLatestMatchForPuuid(puuid, gameId = '') {
  if (!puuid) return null
  const history = await lcuGet(
    `/lol-match-history/v1/products/lol/${encodeURIComponent(puuid)}/matches?begIndex=0&endIndex=5`,
    { timeout: 5000 },
  )
  const games = history?.games?.games ?? (Array.isArray(history?.games) ? history.games : [])
  if (!games.length) return null
  if (gameId) return games.find((game) => String(game?.gameId) === String(gameId)) ?? null
  return games[0] ?? null
}

export function getLiveGameData() {
  return new Promise((resolve) => {
    const request = https.request(
      {
        hostname: '127.0.0.1',
        port: 2999,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 1800,
        headers: { accept: 'application/json' },
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            resolve(data && typeof data === 'object' ? data : null)
          } catch {
            resolve(null)
          }
        })
      },
    )
    request.on('timeout', () => request.destroy(new Error('Live Client timeout')))
    request.on('error', () => resolve(null))
    request.end()
  })
}

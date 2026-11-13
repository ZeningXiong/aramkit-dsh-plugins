/**
 * hexscan-service.js — 海克斯选卡识别的宿主持久化服务。
 *
 * 职责：
 *   1. 记住"开/关"（写 $DSH_HOME/aramkit-live/hexscan.json）
 *   2. 开着的时候每 2.5 秒问一次 hexscan CLI：现在屏幕上有没有三选一
 *   3. 英雄 id 由外部注入（LCU 局内数据），不用用户手填
 *   4. 认出来就写 overlay.json，并拉起独立的置顶覆盖层
 *
 * 为什么用子进程而不是 import：抓屏/OCR 是同步阻塞的重活，塞进 DSH 的
 * 事件循环里会卡住整个会话；单独进程崩了也只影响自己。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, openSync, closeSync } from 'node:fs'
import { dirname, join } from 'node:path'

// 一次扫描本身约 1.5 秒，轮询间隔只留一点喘息，扫完立刻接下一次
const POLL_MS = 400
const SCAN_TIMEOUT_MS = 25000
const INFO_POLL_MS = 2500
/** 一轮识别最多盯这么久，超时就收工，避免用户忘了点结束。 */
const SESSION_MAX_MS = 3 * 60 * 1000

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

/** 覆盖层只能走 http(s)；`dsh-app://app` 这种自定义 scheme 不能 urllib POST。 */
function httpBase(value) {
  const text = String(value || '').trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(text) ? text : ''
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

/** DSH 进程的 PATH 里常常没有 Python，直接 spawn('python') 会拿到商店占位符。 */
function resolvePython() {
  const candidates = [
    process.env.DSH_SEE_PYTHON,
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    'C:/Windows/py.exe',
  ].filter(Boolean)
  for (const file of candidates) {
    if (existsSync(file)) return file
  }
  return 'python'
}

/** 同一进程里只允许一个服务实例：插件来回开关时不要叠出多个定时器。 */
let singleton = null

export function obtainHexScanService(options) {
  if (singleton) return singleton
  singleton = createHexScanService(options)
  return singleton
}

export function createHexScanService({ root, dshHome, getChampionId, isActive = async () => true,
  getOverlayInfo = null, webBase = '', log = () => {} }) {
  const stateDir = join(dshHome, 'aramkit-live')
  const configFile = join(stateDir, 'hexscan.json')
  const cacheDir = join(root, '.cache')
  const overlayData = join(cacheDir, 'overlay.json')
  const overlayInfo = join(cacheDir, 'overlay-info.json')
  const overlayRequest = join(cacheDir, 'overlay-request.json')
  const overlayPidFile = join(cacheDir, 'overlay.pid')
  const cli = join(root, 'tools', 'hexscan.mjs')
  const overlayPy = join(root, 'tools', 'hexoverlay.py')

  const saved = readJson(configFile, {})
  const state = {
    enabled: saved.enabled === true,
    // 覆盖层要 POST 锐评，得有 DSH 的地址；宿主进程拿不到端口，
    // 所以由页面在开关时把自己的 origin 报上来
    // 优先用宿主当前注入的 DSH_WEB_URL：保存值可能是上个端口的旧地址
    webBase: httpBase(webBase) || httpBase(saved.webBase) || '',
    busy: false,
    last: null,
    lastError: '',
    championId: 0,
    lastScanAt: 0,
    session: null,
    // 不在 DSH 启动时就显示：等插件页挂载后心跳上报 visible:true 再开
    visible: false,
    visibleAt: 0,
  }

  let timer = null
  let overlayChild = null
  let lastRequestSeq = 0
  let infoTimer = null

  function save() {
    writeJson(configFile, { enabled: state.enabled, webBase: state.webBase })
  }

  /** 跑一次单帧识别，返回 CLI 的 JSON（卡数 <2 时也算一次有效结果）。 */
  function scanOnce(championId) {
    return new Promise((resolve, reject) => {
      const argv = [cli, 'scan', '--json', '--mask-overlay']
      if (championId) argv.push('--champion', String(championId))
      const child = spawn(process.execPath, argv, {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let out = ''
      let err = ''
      const timerId = setTimeout(() => {
        try { child.kill() } catch { /* 已退出 */ }
        reject(new Error('识别超时'))
      }, SCAN_TIMEOUT_MS)
      child.stdout.on('data', (c) => { out += c })
      child.stderr.on('data', (c) => { err += c })
      child.once('error', (e) => { clearTimeout(timerId); reject(e) })
      child.once('exit', (code) => {
        clearTimeout(timerId)
        if (code !== 0) return reject(new Error(err.trim() || `hexscan 退出码 ${code}`))
        try {
          resolve(JSON.parse(out))
        } catch {
          reject(new Error('hexscan 输出不是 JSON'))
        }
      })
    })
  }

  /** pid 是否真的还活着：detached + unref 的子进程有时收不到 exit，不能只看 exitCode。 */
  function pidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  function ensureOverlay() {
    // 先看上一次宿主留下的 pid：DSH 重启/插件重载时旧覆盖层可能还活着。
    // 不认这个文件就会再起一个，用户看到的就是**两个米色悬浮窗**。
    const savedOverlay = readJson(overlayPidFile, {})
    if (Number.isInteger(savedOverlay?.pid) && savedOverlay.pid > 0 && pidAlive(savedOverlay.pid)) {
      return
    }
    // 以前只判 `exitCode === null`：覆盖层被用户关掉、或进程已经死了但 Node 没收到
    // exit 事件时，这里会一直以为它还活着，于是**再也不重启**（表现就是"解说有了但
    // 游戏里什么都不显示"）。现在额外确认 pid 真的存在。
    if (overlayChild && overlayChild.exitCode === null && pidAlive(overlayChild.pid)) return
    overlayChild = null
    if (!existsSync(overlayPy)) return
    // 清掉上次留下的旧结果：刚开启时不该弹出一副"不是这一局"的三选一
    writeJson(overlayData, {})
    const python = resolvePython()
    try {
      // stderr 落盘：覆盖层是独立进程，启动即崩时宿主侧只看得到"pid 不在了"。
      // 没有这个文件，排查只能靠猜（这次的现场就是进程秒退但没有任何输出）。
      let stderrFd = null
      try {
        mkdirSync(stateDir, { recursive: true })
        stderrFd = openSync(join(stateDir, 'overlay-error.log'), 'a')
      } catch { /* 日志开不了也要能启动覆盖层 */ }
      const child = spawn(python,
        [overlayPy, '--file', overlayData, '--request', overlayRequest, '--info', overlayInfo,
          '--pid-file', overlayPidFile],
        // **不要 detached**：DSH 宿主会把 detached 子进程连同调用上下文一起收掉，
        // 覆盖层起来几秒就没了。普通子进程跟宿主同生命周期，unref 已经足够不挡退出。
        { cwd: root, stdio: ['ignore', 'ignore', stderrFd ?? 'ignore'], windowsHide: true })
      if (stderrFd !== null) {
        try { closeSync(stderrFd) } catch { /* 子进程已经复制了句柄 */ }
      }
      overlayChild = child
      child.on('error', (e) => log(`hexscan: 覆盖层启动失败 ${e.message}`))
      child.on('exit', () => {
        // 只清自己的引用，避免旧进程退出时把新进程的引用也抹掉
        if (overlayChild === child) overlayChild = null
        try {
          const saved = readJson(overlayPidFile, {})
          if (saved.pid === child.pid) rmSync(overlayPidFile, { force: true })
        } catch { /* 清理失败不影响主流程 */ }
      })
      child.unref()
      // pid 文件由覆盖层进程自己写（--pid-file）：命名互斥量保证只有一个实例，
      // 被拒的那个不会覆盖真正在跑的那份 pid。
      log(`hexscan: 覆盖层已启动（${python}，pid ${child.pid}）`)
    } catch (e) {
      log(`hexscan: 覆盖层启动失败 ${e.message}`)
    }
  }

  function stopOverlay() {
    try {
      const { pid } = readJson(overlayPidFile, {})
      if (pid) process.kill(pid)
    } catch { /* 已经没了 */ }
    overlayChild = null
    rmSync(overlayPidFile, { force: true })
  }

  async function tick() {
    if (!state.enabled || state.busy) return
    state.busy = true
    try {
      // 点按钮才会开始一轮识别；没点就什么都不做，不烧 CPU
      const req = readJson(overlayRequest, null)
      if (req && req.cancel === true) {
        if (Number(req.seq) > lastRequestSeq) {
          lastRequestSeq = Number(req.seq)
          state.session = null
          state.last = null
          writeJson(overlayData, { status: 'idle', at: Date.now() })
          log('hexscan: 用户收起面板，结束这一轮')
        }
        return
      }
      if (req && Number(req.seq) > lastRequestSeq) {
        lastRequestSeq = Number(req.seq)
        state.session = { startedAt: Date.now(), detected: false, miss: 0 }
        state.last = null
        writeJson(overlayData, { status: 'scanning', at: Date.now() })
        log('hexscan: 收到识别请求')
      }
      const session = state.session
      if (!session) return

      // 不在局内 / 超时 → 结束这一轮
      const active = await isActive().catch(() => false)
      if (!active || Date.now() - session.startedAt > SESSION_MAX_MS) {
        finishSession(active ? 'timeout' : 'left-game')
        return
      }

      const championId = Number(await getChampionId().catch(() => 0)) || 0
      state.championId = championId
      const payload = await scanOnce(championId)
      state.lastScanAt = Date.now()
      state.lastError = ''
      const cards = payload?.cards ?? []

      if (cards.length >= 2) {
        session.detected = true
        session.miss = 0
        state.last = {
          at: Date.now(),
          status: 'found',
          championId,
          cards,
          advice: payload.advice || '',
        }
        writeJson(overlayData, { ...state.last, championLabel: payload.championLabel || '' })
      } else if (session.detected) {
        // 认出来之后画面不再有卡 = 用户已经选完
        session.miss += 1
        if (session.miss >= 2) finishSession('picked')
      }
    } catch (e) {
      state.lastError = e instanceof Error ? e.message : String(e)
    } finally {
      state.busy = false
    }
  }

  function finishSession(reason) {
    const last = state.last
    state.session = null
    if (last) {
      writeJson(overlayData, { ...last, status: 'done', reason })
    } else {
      writeJson(overlayData, { status: reason === 'timeout' ? 'timeout' : 'idle', at: Date.now() })
    }
    log(`hexscan: 本轮结束（${reason}）`)
  }

  function start() {
    if (timer) return
    timer = setInterval(() => { tick() }, POLL_MS)
    if (typeof timer.unref === 'function') timer.unref()
    if (getOverlayInfo && !infoTimer) {
      const push = async () => {
        try {
          const info = await getOverlayInfo()
          writeJson(overlayInfo, {
            ...info,
            webBase: state.webBase || httpBase(process.env.DSH_WEB_URL) || '',
            visible: state.visible,
            visibleAt: state.visibleAt,
            at: Date.now(),
          })
        } catch (e) {
          log(`hexscan: 覆盖层信息刷新失败 ${e instanceof Error ? e.message : e}`)
        }
      }
      push()
      infoTimer = setInterval(push, INFO_POLL_MS)
      if (typeof infoTimer.unref === 'function') infoTimer.unref()
    }
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    if (infoTimer) clearInterval(infoTimer)
    infoTimer = null
  }

  return {
    /** 只读快照给路由用 */
    snapshot() {
      return {
        ok: true,
        enabled: state.enabled,
        running: Boolean(timer),
        visible: state.visible,
        webBase: state.webBase,
        overlayPid: overlayChild?.pid ?? null,
        overlayRunning: Boolean(overlayChild && overlayChild.exitCode === null && pidAlive(overlayChild.pid)),
        championId: state.championId,
        last: state.last,
        lastScanAt: state.lastScanAt,
        lastError: state.lastError,
      }
    },
    setEnabled(enabled, base) {
      state.enabled = Boolean(enabled)
      if (base) state.webBase = String(base)
      save()
      if (state.enabled) {
        ensureOverlay()
        start()
        tick()
      } else {
        stop()
        stopOverlay()
      }
      return this.snapshot()
    },
    setChampion(id) {
      state.championId = Number(id) || 0
    },
    /** 面板开/关：开着才有覆盖层进程，关掉直接杀掉——比隐藏窗口可靠得多 */
    setVisible(visible, at) {
      const next = Boolean(visible)
      state.visibleAt = Number(at) || Date.now()
      if (next !== state.visible) {
        state.visible = next
        if (next) {
          ensureOverlay()
          start()
        } else {
          stopOverlay()
        }
      } else if (next) {
        ensureOverlay()
      }
      return this.snapshot()
    },
    /**
     * 不限面板、只把覆盖层拉起来。
     *
     * 解说开启后不该要求用户一直把插件页开着：切到聊天窗时页面卸载会发
     * `visible:false` 把覆盖层杀掉，自动解说就永远没窗口可显示。自动叫醒
     * 每次发现它没跑就用这里补起来（不启动 hexscan 扫描，避免顺带烧 OCR）。
     */
    showOverlay() {
      state.visible = true
      state.visibleAt = Date.now()
      ensureOverlay()
      return this.snapshot()
    },
    /** 页面心跳带上当前 DSH origin：重启后端口会变，覆盖层的锐评按钮靠它找接口。 */
    setWebBase(base) {
      const next = httpBase(base)
      if (!next || next === state.webBase) return
      state.webBase = next
      save()
    },
    /** DSH 启动时**不**自动拉起覆盖层：等用户打开「海斗助手在线版」页面，
     *  页面心跳 `visible:true` 后由 setVisible 显示。 */
    restore() {
      // 只恢复配置，不启动任何窗口/定时器。
      // 用户明确要求：不要一开 DSH 就弹悬浮窗，打开在线版界面再显示。
    },
    dispose() {
      stop()
      stopOverlay()
      singleton = null
    },
  }
}

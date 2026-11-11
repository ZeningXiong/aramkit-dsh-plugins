/**
 * game-window.js — 「现在能不能读游戏画面」的唯一判断入口。
 *
 * ## 为什么不能只看 LCU 的 InProgress
 *
 * 用户可能 Alt-Tab 到桌面、聊天窗，或者把游戏最小化了。这时抓屏拿到的是
 * 桌面/DSH 面板，模型会对着桌面解说。
 *
 * ## 为什么也不能只看“前台窗口”
 *
 * 之前要求前台标题必须是英雄联盟。用户把 DSH 放在第二块屏、或者窗口化游戏时
 * 一边看面板一边打，游戏窗口仍然可见，但前台是 DSH，于是自动解说永远不触发。
 *
 * ## 现在的判定
 *
 * 1. 存在 `RiotWindowClass`（或标题带 `(TM) Client`）的游戏窗口，**没有最小化**
 *    → 可以抓（game）。这是主判据，和窗口是否在前台无关。
 * 2. 找不到窗口，但前台标题像英雄联盟 → 可以抓（foreground，兼容全屏）。
 * 3. 窗口存在但最小化 / 没有游戏窗口 → 不抓（minimized / none）。
 * 4. 查询失败 → null，由调用方按放行处理，避免整个解说失效。
 *
 * 判断走一次 PowerShell + user32，结果缓存 1.5 秒 —— 自动叫醒和紧接着的
 * `aram_peek` 通常在同一瞬间，不必起两次进程。
 *
 * 为什么用临时文件而不是 stdout：DSH 的受限执行环境不允许 Node 子进程开
 * 命名管道（`spawn EPERM`），`stdio:'pipe'` 会直接失败。写文件 + 读文件在
 * 沙箱内外都成立。
 *
 * 为什么不用 `Get-Process 'League of Legends'`：部分环境里进程查询被拒，
 * 但窗口枚举仍然可用。`RiotWindowClass` 是游戏主窗口的稳定类名；客户端是
 * `RCLIENT`，不会被误判。
 */
import { spawn } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const GAME_STATES = new Set(['game', 'foreground'])
const CACHE_MS = 1500

/** PowerShell 单引号字符串里的单引号要写成两个。 */
function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

const STATE_CLASS = [
  'using System;',
  'using System.Text;',
  'using System.Runtime.InteropServices;',
  'public static class GameWin {',
  '  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
  '  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);',
  '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
  '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);',
  '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int n);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  public static string State() {',
  '    bool found = false, visible = false;',
  '    EnumWindows((h, l) => {',
  '      if (!IsWindowVisible(h)) return true;',
  '      var cls = new StringBuilder(128); GetClassName(h, cls, 128);',
  '      var txt = new StringBuilder(256); GetWindowText(h, txt, 256);',
  '      string title = txt.ToString();',
  '      bool isGame = cls.ToString() == "RiotWindowClass" || title.IndexOf("(TM) Client") >= 0;',
  '      if (isGame) { found = true; if (!IsIconic(h)) visible = true; }',
  '      return true;',
  '    }, IntPtr.Zero);',
  '    if (visible) return "game";',
  '    IntPtr fg = GetForegroundWindow();',
  '    if (fg != IntPtr.Zero) {',
  '      var sb = new StringBuilder(512); GetWindowText(fg, sb, 512);',
  '      string t = sb.ToString();',
  '      if (t.IndexOf("League of Legends") >= 0) return "foreground";',
  '    }',
  '    return found ? "minimized" : "none";',
  '  }',
  '}',
].join('\n')

/** 返回 game | foreground | minimized | none | unknown。 */
function readGameWindowState(timeoutMs = 2500) {
  return new Promise((resolve) => {
    const outFile = join(tmpdir(), `aram-fg-${process.pid}-${randomUUID()}.txt`)
    const script = [
      `Add-Type -TypeDefinition ${psQuote(STATE_CLASS)}`,
      `[System.IO.File]::WriteAllText(${psQuote(outFile)}, [GameWin]::State(), [System.Text.Encoding]::UTF8)`,
    ].join('; ')
    const exe = join(process.env.SystemRoot || 'C:\\Windows',
      'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    let child = null
    try {
      child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { stdio: 'ignore', windowsHide: true })
    } catch {
      resolve('unknown')
      return
    }
    let settled = false
    const done = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { rmSync(outFile, { force: true }) } catch { /* 清不掉也不影响结果 */ }
      resolve(value)
    }
    const timer = setTimeout(() => {
      try { child.kill() } catch { /* 已退出 */ }
      done('unknown')
    }, timeoutMs)
    child.once('error', () => done('unknown'))
    child.once('exit', () => {
      try {
        done(readFileSync(outFile, 'utf8').trim() || 'unknown')
      } catch {
        done('unknown')
      }
    })
  })
}

export function createGameWindowProbe() {
  let cachedAt = 0
  let cachedValue = null
  let pending = null

  async function measure() {
    if (Date.now() - cachedAt < CACHE_MS) return cachedValue
    if (pending) return pending
    pending = readGameWindowState()
      .then((state) => {
        cachedAt = Date.now()
        cachedValue = state === 'unknown' ? null : GAME_STATES.has(state)
        return cachedValue
      })
      .finally(() => { pending = null })
    return pending
  }

  return {
    /** true / false / null，语义见文件头。 */
    isGameForeground() {
      return measure()
    },
    /** 诊断用：连原始状态一起返回。 */
    async probe() {
      const state = await readGameWindowState()
      return {
        state,
        isGame: state === 'unknown' ? null : GAME_STATES.has(state),
      }
    },
  }
}

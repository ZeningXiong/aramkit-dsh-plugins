# -*- coding: utf-8 -*-
"""hexoverlay.py — 游戏内三个独立功能，竖排一列。

    ┌──────────────┐
    │ ● 海克斯识别  │  点一下开始识别（展开后显示三选一）
    │ ◆ 出装推荐    │  点一下展开当前英雄的流派出装
    │ ■ 赛后锐评    │  结算数据齐了变绿，点一下生成
    └──────────────┘

三者互不影响：展开哪个只看哪个，互不挤占。窗口默认 132 宽，展开后 300 宽，
按住任意位置可拖动。锐评仍然调用插件已有的 /aramkit-live/review。
"""
import argparse
import ctypes
import hashlib
import json
import os
import subprocess
import sys
import threading
import time
import tkinter as tk
import urllib.request

NARROW = 132
WIDE = 304
ROW_H = 30
GAP = 4
PAD = 8
ROWS = ('hex', 'build', 'review')
TITLES = {'hex': '海克斯识别', 'build': '出装推荐', 'review': '赛后锐评'}
RED = '#b23a2e'
SECTION_H = {'hex': 142, 'build': 212, 'review': 64}
SECTION_W = {'hex': WIDE, 'build': 420, 'review': WIDE}

BG = '#f7f4ea'
BORDER = '#c9c1ad'
ACCENT = '#2f6b4f'
MUTED = '#8a8478'
TEXT = '#2b2b2b'
GOLD = '#b23a2e'
GREEN = '#3f8f5f'
# 水墨：宣纸底 + 墨色字 + 淡墨描边 + 一点朱砂
PAPER = '#f7f4ea'
INK = '#2b2b2b'
LINE = '#cfc7b3'
SEAL = '#b23a2e'
MASCOT = 56
BODY = ('Microsoft YaHei UI', 10)
BODY_B = ('Microsoft YaHei UI', 10, 'bold')
TITLE = ('KaiTi', 11, 'bold')
SMALL = ('Microsoft YaHei UI', 8)


def read_json(path):
    try:
        with open(path, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except Exception:
        return None


def write_json(path, value):
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(value, f, ensure_ascii=False)
        return True
    except Exception:
        return False


def no_activate(win):
    try:
        import ctypes
        hwnd = ctypes.windll.user32.GetParent(win.winfo_id())
        if not hwnd:
            return
        GWL_EXSTYLE = -20
        WS_EX_NOACTIVATE = 0x8000000
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        ctypes.windll.user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE)
    except Exception:
        pass


class Icons:
    """装备图标：下载 → ffmpeg 转成 26px PNG → Tk PhotoImage。

    图标源是 webp，Tk 8.6 读不了，所以必须转一次；转好的按 URL 哈希缓存在本地，
    同一个英雄第二次看就是瞬开。
    """

    def __init__(self, root, cache_dir, on_ready):
        self.root = root
        self.dir = cache_dir
        self.on_ready = on_ready
        self.cache = {}
        self.pending = set()
        os.makedirs(cache_dir, exist_ok=True)
        self.ffmpeg = os.environ.get('DSH_FFMPEG_PATH') or os.path.join(
            os.environ.get('DSH_HOME') or os.path.join(os.path.expanduser('~'), '.dsh'),
            'tools', 'ffmpeg', 'bin', 'ffmpeg.exe')

    def path_for(self, url):
        return os.path.join(self.dir, hashlib.md5(url.encode('utf-8')).hexdigest()[:12] + '.png')

    def get(self, url, size=26):
        if not url:
            return None
        img = self.cache.get(url)
        if img is not None:
            return img
        path = self.path_for(url)
        if os.path.exists(path):
            try:
                self.cache[url] = tk.PhotoImage(file=path)
                return self.cache[url]
            except Exception:
                return None
        if url in self.pending:
            return None
        self.pending.add(url)
        threading.Thread(target=self._load, args=(url, path, size), daemon=True).start()
        return None

    def _load(self, url, path, size):
        tmp = path + '.webp'
        try:
            with urllib.request.urlopen(url, timeout=15) as resp:
                data = resp.read()
            with open(tmp, 'wb') as f:
                f.write(data)
            subprocess.run([self.ffmpeg, '-hide_banner', '-loglevel', 'error',
                            '-i', tmp, '-vf', 'scale=%d:%d' % (size, size), '-y', path],
                           timeout=20, creationflags=0x08000000)
        except Exception:
            pass
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass
            self.pending.discard(url)
            self.root.after(0, self.on_ready)


class Overlay:
    def __init__(self, data_file, request_file, info_file, x, y):
        self.data_file = data_file
        self.request_file = request_file
        self.info_file = info_file
        self.data = {}
        self.info = {}
        self.section = None          # None | 'hex' | 'build'
        self.data_mtime = 0
        self.info_mtime = 0
        self.review_busy = False
        self.withdrawn = False
        self.hidden = False
        self.home = None
        self.row_rects = {}
        self.tab_rects = []
        self.arch = 0
        self.cur_w = NARROW
        icon_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache', 'icons')
        self._drag = None
        self._moved = False

        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        self.root.attributes('-alpha', 0.97)
        self.root.configure(bg=BG)
        self.root.geometry('%dx%d+%d+%d' % (NARROW, 106, x, y))
        self.canvas = tk.Canvas(self.root, bg=BG, highlightthickness=0, width=NARROW, height=106)
        self.canvas.pack(fill='both', expand=True)
        self.icons = Icons(self.root, icon_dir, lambda: self.render())
        self.mascot = None
        try:
            mascot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'whale.png')
            if os.path.exists(mascot_path):
                img = tk.PhotoImage(file=mascot_path)
                # 头像只要 32px 左右，别把对话框挡住
                self.mascot = img.subsample(3, 3) if img.width() >= 90 else img
        except Exception:
            self.mascot = None
        self.canvas.bind('<Button-1>', self.on_press)
        self.canvas.bind('<B1-Motion>', self.on_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_release)
        no_activate(self.root)
        self.root.after(300, self.tick)
        self.render()

    # ---------- 拖动 ----------
    def on_press(self, e):
        self._drag = (e.x_root, e.y_root, self.root.winfo_x(), self.root.winfo_y())
        self._moved = False

    def on_drag(self, e):
        if not self._drag:
            return
        sx, sy, wx, wy = self._drag
        dx, dy = e.x_root - sx, e.y_root - sy
        if abs(dx) + abs(dy) > 4:
            self._moved = True
        self.root.geometry('+%d+%d' % (wx + dx, wy + dy))

    def available(self, key):
        """绿灯 = 可点，红灯 = 点了没反应。可用性只看当前阶段与数据。"""
        phase = (self.info or {}).get('phase') or ''
        if key == 'hex':
            return phase == 'InProgress'
        if key == 'build':
            # 对局前（选人）与局内都能看出装
            return bool((self.info or {}).get('archetypes'))
        if key == 'review':
            return self.review_ready()
        return False

    def on_release(self, e):
        self._drag = None
        if self._moved:
            return
        # 先看流派标签
        for x0, y0, x1, y1, idx in self.tab_rects:
            if x0 <= e.x <= x1 and y0 <= e.y <= y1:
                self.arch = idx
                self.render()
                return
        for key, (x0, y0, x1, y1) in self.row_rects.items():
            if x0 <= e.x <= x1 and y0 <= e.y <= y1:
                if self.available(key):
                    self.on_row(key)
                return

    def on_row(self, key):
        if key == 'hex':
            if self.section == 'hex':
                self.section = None
            else:
                self.section = 'hex'
                write_json(self.request_file, {'seq': int(time.time() * 1000), 'at': time.time()})
                self.data = {'status': 'scanning', 'cards': []}
        elif key == 'build':
            self.section = None if self.section == 'build' else 'build'
        elif key == 'review':
            self.request_review()
        self.render()

    # ---------- 动作 ----------
    def review_ready(self):
        return bool(((self.info or {}).get('review') or {}).get('ready'))

    def request_review(self):
        if not self.review_ready() or self.review_busy:
            return
        base = ((self.info or {}).get('webBase') or '').rstrip('/')
        game_id = ((self.info or {}).get('review') or {}).get('gameId') or ''
        if not base or not game_id:
            return
        self.review_busy = True
        self.render()

        def run():
            try:
                body = json.dumps({'gameId': game_id}).encode('utf-8')
                req = urllib.request.Request(base + '/aramkit-live/review', data=body, method='POST',
                                             headers={'content-type': 'application/json'})
                with urllib.request.urlopen(req, timeout=180) as resp:
                    resp.read()
            except Exception:
                pass
            finally:
                self.review_busy = False
                self.root.after(0, self.render)

        threading.Thread(target=run, daemon=True).start()

    # ---------- 绘制 ----------
    def resize(self, w, h):
        # 以**右边缘**为锚：展开往左长、收起往右缩，这样来回切换位置不会漂。
        # 宽度自己记，别用 winfo_width()：它在一串 geometry() 之后可能是旧值，
        # 拿旧宽度算右边缘就又会漂。
        sw = self.root.winfo_screenwidth()
        cur_x, cur_y = self.root.winfo_x(), self.root.winfo_y()
        right = cur_x + self.cur_w
        x = right - w
        x = max(0, min(x, max(0, sw - w - 8)))
        self.cur_w = w
        self.root.geometry('%dx%d+%d+%d' % (w, h, x, cur_y))
        self.canvas.configure(width=w, height=h)

    def render(self):
        comment = self.fresh_comment()
        base_w = WIDE if comment else NARROW
        width = SECTION_W.get(self.section, WIDE) if self.section else base_w
        if comment and width < 340:
            width = 340
        height = PAD * 2 + ROW_H * 3 + GAP * 2
        if self.section:
            height += SECTION_H[self.section] + 6
        if comment:
            height += 118
        self.resize(width, height)

        c = self.canvas
        c.delete('all')
        self.round_rect(1, 1, width - 1, height - 1, 12, BG, BORDER)
        # 水墨点缀：一枚淡墨圆（像洇开的墨点）和一方朱砂小印
        c.create_oval(width - 74, -26, width + 22, 70, outline='#e2dac6', width=2)
        c.create_oval(width - 60, -12, width + 8, 56, outline='#ece5d3', width=1)
        c.create_rectangle(width - 34, 8, width - 12, 30, fill=SEAL, outline='')
        c.create_text(width - 23, 19, text='鲸', fill='#fdfaf2', font=('KaiTi', 11, 'bold'))

        self.row_rects = {}
        y = PAD
        for key in ROWS:
            x0, x1 = PAD, width - PAD
            self.row_rects[key] = (x0, y, x1, y + ROW_H)
            self.draw_row(key, x0, y, x1, y + ROW_H)
            y += ROW_H + GAP

        if self.section:
            self.draw_section(self.section, PAD, y + 2, width - PAD, height - PAD)
        elif comment:
            self.draw_comment(PAD, y + 2, width - PAD, height - PAD)

    def fresh_comment(self):
        """一句解说在游戏里显示 60 秒，之后自己消失。"""
        row = (self.info or {}).get('comment') or None
        if not row or not row.get('text'):
            return None
        try:
            if time.time() * 1000 - float(row.get('at') or 0) > 60000:
                return None
        except (TypeError, ValueError):
            return None
        return row

    def draw_comment(self, x0, y0, x1, y1):
        """微信/QQ 那种：左边小头像，右边气泡，气泡带小尖角。"""
        c = self.canvas
        row = self.fresh_comment() or {}
        avatar = 34
        ax, ay = x0 + 2, y0 + 4
        if self.mascot:
            c.create_image(ax, ay, anchor='nw', image=self.mascot)
        else:
            self.round_rect(ax, ay, ax + avatar, ay + avatar, 6, '#efe7d2', LINE)
        # 名字
        c.create_text(ax + avatar + 8, ay + 2, anchor='nw', text='小满',
                      fill=MUTED, font=('KaiTi', 9))
        bx0, by0 = ax + avatar + 8, ay + 16
        bx1, by1 = x1 - 2, y1 - 2
        self.round_rect(bx0, by0, bx1, by1, 10, PAPER, LINE)
        # 气泡尖角
        c.create_polygon(bx0 + 2, by0 + 12, bx0 - 7, by0 + 18, bx0 + 2, by0 + 22,
                         fill=PAPER, outline=LINE)
        c.create_text(bx0 + 10, by0 + 9, anchor='nw', width=max(80, bx1 - bx0 - 20),
                      justify='left', text=row.get('text', ''),
                      fill=INK, font=('Microsoft YaHei UI', 10))

    def round_rect(self, x0, y0, x1, y1, r, fill, outline):
        """Tk 没有圆角矩形，用平滑多边形拼一个。"""
        pts = [
            x0 + r, y0, x1 - r, y0, x1, y0, x1, y0 + r,
            x1, y1 - r, x1, y1, x1 - r, y1, x0 + r, y1,
            x0, y1, x0, y1 - r, x0, y0 + r, x0, y0,
        ]
        return self.canvas.create_polygon(pts, smooth=True, splinesteps=24,
                                          fill=fill, outline=outline, width=1)

    def draw_row(self, key, x0, y0, x1, y1):
        c = self.canvas
        active = self.section == key and self.available(key)
        self.round_rect(x0, y0, x1, y1, 9, '#efe7d2' if active else '#fbf9f2', BORDER)
        # 只有红绿两种灯：绿=可点，红=点了没反应
        ok = self.available(key)
        color = GREEN if ok else RED
        if key == 'review' and (self.review_busy or ((self.info or {}).get('review') or {}).get('status') == 'running'):
            color = GOLD
        c.create_oval(x0 + 10, y0 + 11, x0 + 20, y0 + 21, fill=color, outline='')
        c.create_text(x0 + 27, y0 + ROW_H / 2, anchor='w', text=TITLES[key],
                      fill=TEXT if ok else MUTED, font=TITLE)

    def draw_section(self, key, x0, y0, x1, y1):
        c = self.canvas
        c.create_line(x0, y0 - 2, x1, y0 - 2, fill='#d8d0bd')
        if key == 'hex':
            self.draw_hex(x0, y0 + 8)
        elif key == 'build':
            self.draw_build(x0, y0 + 8)
        elif key == 'review':
            self.draw_review(x0, y0 + 8)

    def draw_hex(self, x0, y0):
        c = self.canvas
        cards = (self.data or {}).get('cards') or []
        if not cards:
            c.create_text(x0, y0 + 10, anchor='w', text='点上面那行开始识别；卡一出现就显示',
                          fill=MUTED, font=SMALL)
            return
        colors = {'S': GOLD, 'A': ACCENT, 'B': '#8fb4ff', 'C': '#9aa4b8', 'D': '#6b7280'}
        y = y0 + 8
        for i, card in enumerate(cards[:3]):
            wr = card.get('augmentWinRate')
            wr_txt = ('%.1f%%' % (wr * 100)) if isinstance(wr, (int, float)) else '—'
            tier = card.get('tier') or '?'
            color = colors.get(tier, '#8fb4ff')
            if i == 0:
                self.round_rect(x0 - 4, y - 11, x0 + 286, y + 11, 8, '#efe7d2', color)
            c.create_text(x0, y, anchor='w', text=tier, fill=color,
                          font=TITLE)
            c.create_text(x0 + 18, y, anchor='w', text=(card.get('name') or '?'), fill=TEXT,
                          font=TITLE)
            c.create_text(x0 + 284, y, anchor='e', text=wr_txt, fill=color if i == 0 else TEXT,
                          font=('Consolas', 11, 'bold'))
            y += 26
        advice = (self.data or {}).get('advice') or ''
        if advice:
            # width 让 Tk 自己折行；anchor 用 nw，多行时从左上往下排
            c.create_text(x0, y + 6, anchor='nw', width=276,
                          text='▸ ' + advice, fill=GOLD, justify='left',
                          font=SMALL)

    def draw_build(self, x0, y0):
        c = self.canvas
        archs = (self.info or {}).get('archetypes') or []
        self.tab_rects = []
        if not archs:
            c.create_text(x0, y0 + 10, anchor='w', text='读到你选的英雄后显示出装',
                          fill=MUTED, font=SMALL)
            return
        if self.arch >= len(archs):
            self.arch = 0

        # 流切换：标签当按钮，点谁切谁
        tx = x0
        for i, row in enumerate(archs):
            label = (row.get('label') or '流派')[:6]
            w = 12 + len(label) * 9
            active = (i == self.arch)
            self.round_rect(tx, y0 - 6, tx + w, y0 + 14, 8, '#efe7d2' if active else '#fbf9f2', ACCENT if active else BORDER)
            c.create_text(tx + w / 2, y0 + 4, text=label,
                          fill=ACCENT if active else MUTED,
                          font=BODY_B)
            self.tab_rects.append((tx, y0 - 6, tx + w, y0 + 14, i))
            tx += w + 6

        build = archs[self.arch]
        y = y0 + 30
        groups = [
            ('出门', build.get('starter') or []),
            ('核心', (build.get('core') or []) + ([build['boots']] if build.get('boots') else [])),
            ('后续', build.get('later') or []),
        ]
        for title, items in groups:
            if not items:
                continue
            c.create_text(x0, y + 12, anchor='w', text=title, fill=MUTED,
                          font=SMALL)
            ix = x0 + 30
            for it in items[:7]:
                img = self.icons.get(it.get('icon'), 26)
                if img is not None:
                    c.create_image(ix, y, anchor='nw', image=img)
                else:
                    c.create_rectangle(ix, y, ix + 26, y + 26, fill='#f1ece0', outline='#c9c1ad')
                name = (it.get('name') or '')[:4]
                c.create_text(ix + 13, y + 32, text=name, fill=TEXT,
                              font=SMALL)
                ix += 38
            y += 56

    def draw_review(self, x0, y0):
        c = self.canvas
        review = (self.info or {}).get('review') or {}
        status = review.get('status') or 'idle'
        if status in ('ready', 'done'):
            text, color = '锐评已生成，去插件面板看', GREEN
        elif self.review_busy or status == 'running':
            text, color = '正在生成，大约十几秒…', GOLD
        elif review.get('ready'):
            text, color = '数据已齐，点上面那行生成', GREEN
        else:
            text, color = '对局结束、结算数据同步后才能用', MUTED
        c.create_text(x0, y0 + 10, anchor='w', text=text, fill=color,
                      font=SMALL)

    # ---------- 轮询 ----------
    def tick(self):
        changed = False
        try:
            m = os.path.getmtime(self.info_file)
            if m != self.info_mtime:
                self.info_mtime = m
                self.info = read_json(self.info_file) or {}
                changed = True
        except OSError:
            pass
        try:
            m = os.path.getmtime(self.data_file)
            if m != self.data_mtime:
                self.data_mtime = m
                data = read_json(self.data_file) or {}
                if data:
                    self.data = data
                    if data.get('cards'):
                        self.section = 'hex'
                    elif data.get('status') in ('idle', 'timeout', 'left-game') and self.section == 'hex':
                        self.section = None
                changed = True
        except OSError:
            pass
        if changed:
            self.render()
        self.root.after(600, self.tick)


_MUTEX = None


def single_instance():
    """同一个 Windows 会话只允许一个覆盖层。

    以前 DSH 重启后旧覆盖层还活着，插件又会拉一个新的，游戏里就出现两个
    米色悬浮窗。命名互斥量是进程级保证：第二个进程直接退出。
    """
    global _MUTEX
    try:
        kernel32 = ctypes.windll.kernel32
        # 必须先清零：GetLastError 是线程级“上一次错误”，宿主进程里可能残留 183，
        # 不重置会把“新建成功”误判成“已存在”，覆盖层直接静默退出。
        kernel32.SetLastError(0)
        _MUTEX = kernel32.CreateMutexW(None, False, 'Local\\aramkit-live-hexoverlay')
        # ERROR_ALREADY_EXISTS = 183
        return kernel32.GetLastError() != 183
    except Exception:
        # 非 Windows / 取不到 API 时不要拦住启动
        return True


def write_pid_file(path):
    if not path:
        return
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'pid': os.getpid(), 'python': sys.executable}, f, ensure_ascii=False)
    except Exception:
        pass


def clear_pid_file(path):
    if not path:
        return
    try:
        data = read_json(path) or {}
        if int(data.get('pid') or 0) == os.getpid():
            os.remove(path)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', required=True)
    ap.add_argument('--request', required=True)
    ap.add_argument('--info', required=True)
    ap.add_argument('--pid-file', default='')
    ap.add_argument('--x', type=int, default=-1)
    ap.add_argument('--y', type=int, default=-1)
    a = ap.parse_args()
    if not single_instance():
        return
    for p in (a.file, a.request, a.info):
        if not os.path.exists(p):
            write_json(p, {})
    write_pid_file(a.pid_file)
    try:
        ov = Overlay(a.file, a.request, a.info, 0, 0)
        sw = ov.root.winfo_screenwidth()
        x = a.x if a.x >= 0 else sw - NARROW - 24
        y = a.y if a.y >= 0 else 64
        ov.root.geometry('+%d+%d' % (x, y))
        ov.root.mainloop()
    finally:
        clear_pid_file(a.pid_file)


if __name__ == '__main__':
    main()

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

NARROW = 198
WIDE = 456
ROW_H = 48
GAP = 6
PAD = 12
ROWS = ('hex', 'build', 'review')
TITLES = {'hex': '海克斯识别', 'build': '出装推荐', 'review': '赛后锐评'}
RED = '#A43B2B'
SECTION_H = {'hex': 213, 'build': 318, 'review': 96}
SECTION_W = {'hex': WIDE, 'build': 630, 'review': WIDE}
# 圆钮的“透明色”：窗口这一层用 Windows -transparentcolor 抠掉四角
TRANSPARENT = '#010203'

BG = '#F4F0E6'
BORDER = '#C9C1AD'
ACCENT = '#2F6B4F'
MUTED = '#6E6A60'
TEXT = '#242522'
GOLD = '#A98446'
GREEN = '#2F6B4F'
# 水墨：宣纸底 + 墨色字 + 淡墨描边 + 一点朱砂
PAPER = '#FBF8F0'
INK = '#242522'
LINE = '#C9C1AD'
SEAL = '#A43B2B'
MASCOT = 56
# 负数字号 = 像素：DPI 感知后窗口尺寸是物理像素，用点字号会在 150% 缩放下撑爆 132px 宽
BODY = ('Microsoft YaHei UI', -21)
BODY_B = ('Microsoft YaHei UI', -21, 'bold')
TITLE = ('KaiTi', -24, 'bold')
SMALL = ('Microsoft YaHei UI', -20)


def enable_dpi_awareness():
    """在创建 Tk 之前声明 DPI 感知，否则 125/150% 缩放下整个窗口被系统拉伸，字会糊。"""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


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
        self.review_error = ''
        self.review_text = ''
        self.review_game_id = ''
        self.withdrawn = False
        self.hidden = False
        # 用户手动收起海克斯面板后，后续扫描结果不要再把它顶出来
        self.hex_dismissed = False
        # 默认缩成一个圆形按钮；点开才显示三个功能
        self.menu_open = False
        self.launcher_rect = None
        self.close_rect = None
        self.comment_ms = 10000
        self._comment_key = None
        self._comment_pos = None
        self.home = None
        self.row_rects = {}
        self.tab_rects = []
        self.arch = 0
        self.cur_w = 80
        icon_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.cache', 'icons')
        self._drag = None
        self._moved = False

        self.root = tk.Tk()
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        # 不透明才清晰：0.97 会把文字对比度一起拉低
        self.root.attributes('-alpha', 1.0)
        self.root.configure(bg=TRANSPARENT)
        self.transparent_ok = False
        try:
            self.root.attributes('-transparentcolor', TRANSPARENT)
            self.transparent_ok = True
        except Exception:
            pass
        try:
            # 按实际 DPI 校正 Tk 的点字号，避免高缩放下字被拉糊
            self.root.tk.call('tk', 'scaling', self.root.winfo_fpixels('1i') / 72.0)
        except Exception:
            pass
        self.root.geometry('%dx%d+%d+%d' % (80, 80, x, y))
        self.canvas = tk.Canvas(self.root, bg=TRANSPARENT if self.transparent_ok else BG,
                                highlightthickness=0, width=80, height=80)
        self.canvas.pack(fill='both', expand=True)
        self.icons = Icons(self.root, icon_dir, lambda: self.render())
        self.launcher_image = None
        try:
            launcher_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                         'assets', 'launcher.png')
            if os.path.exists(launcher_path):
                self.launcher_image = tk.PhotoImage(file=launcher_path)
        except Exception:
            self.launcher_image = None

        # 解说气泡是独立窗口，不和三个功能按钮连在一起
        self.comment_win = tk.Toplevel(self.root)
        self.comment_win.overrideredirect(True)
        self.comment_win.attributes('-topmost', True)
        self.comment_win.attributes('-alpha', 1.0)
        self.comment_win.configure(bg=BG)
        self.comment_canvas = tk.Canvas(self.comment_win, bg=BG, highlightthickness=0, width=320, height=80)
        self.comment_canvas.pack(fill='both', expand=True)
        self.comment_win.withdraw()
        self.mascot = None
        self.mascot_small = None
        try:
            assets = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
            mascot_path = os.path.join(assets, 'whale-girl.png')
            if not os.path.exists(mascot_path):
                mascot_path = os.path.join(assets, 'whale.png')
            if os.path.exists(mascot_path):
                img = tk.PhotoImage(file=mascot_path)
                # 头像只要 32px 左右，别把对话框挡住
                self.mascot = img.subsample(2, 2) if img.width() >= 90 else img
                self.mascot_small = img.subsample(4, 4) if img.width() >= 80 else img
        except Exception:
            self.mascot = None
            self.mascot_small = None
        self.canvas.bind('<Button-1>', self.on_press)
        self.canvas.bind('<B1-Motion>', self.on_drag)
        self.canvas.bind('<ButtonRelease-1>', self.on_release)
        no_activate(self.root)
        no_activate(self.comment_win)
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

    def collapse(self):
        if self.section == 'hex' and not self.hex_dismissed:
            self.hex_dismissed = True
            write_json(self.request_file, {
                'cancel': True,
                'seq': int(time.time() * 1000),
                'at': time.time(),
            })
        self.section = None
        self.menu_open = False
        self.render()

    def on_release(self, e):
        self._drag = None
        if self._moved:
            return
        if not self.menu_open:
            if self.launcher_rect:
                x0, y0, x1, y1 = self.launcher_rect
                if x0 <= e.x <= x1 and y0 <= e.y <= y1:
                    self.menu_open = True
                    self.render()
            return
        if self.close_rect:
            x0, y0, x1, y1 = self.close_rect
            if x0 <= e.x <= x1 and y0 <= e.y <= y1:
                self.collapse()
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
                self.collapse()
                return
            self.menu_open = True
            self.section = 'hex'
            self.hex_dismissed = False
            write_json(self.request_file, {'seq': int(time.time() * 1000), 'at': time.time()})
            self.data = {'status': 'scanning', 'cards': []}
        elif key == 'build':
            if self.section == 'build':
                self.collapse()
                return
            self.menu_open = True
            self.section = 'build'
        elif key == 'review':
            if self.section == 'review':
                self.collapse()
                return
            self.menu_open = True
            self.section = 'review'
            self.request_review()
        self.render()

    # ---------- 动作 ----------
    def review_ready(self):
        return bool(((self.info or {}).get('review') or {}).get('ready'))

    def request_review(self):
        if self.review_busy:
            return
        if not self.review_ready():
            self.review_error = '结算数据还没同步，稍等再点'
            self.render()
            return
        base = ((self.info or {}).get('webBase') or '').rstrip('/')
        game_id = ((self.info or {}).get('review') or {}).get('gameId') or ''
        if not base or not game_id:
            self.review_error = '缺少接口地址，刷新插件页再试'
            self.render()
            return
        self.review_busy = True
        self.review_error = ''
        self.review_game_id = game_id
        self.render()

        def run():
            try:
                body = json.dumps({'gameId': game_id}).encode('utf-8')
                req = urllib.request.Request(base + '/aramkit-live/review', data=body, method='POST',
                                             headers={'content-type': 'application/json'})
                with urllib.request.urlopen(req, timeout=180) as resp:
                    payload = json.loads(resp.read().decode('utf-8') or '{}')
                review = payload.get('review') or {}
                lines = []
                summary = str(review.get('summary') or '').strip()
                if summary:
                    lines.append(summary)
                for player in (review.get('players') or [])[:5]:
                    name = str(player.get('name') or '')
                    champ = str(player.get('champion') or '')
                    verdict = str(player.get('verdict') or '')
                    title = str(player.get('title') or '')
                    if name or title:
                        lines.append('%s · %s  %s：%s' % (name, champ, verdict, title))
                self.review_text = '\n'.join(lines).strip()
                self.review_error = ''
            except Exception as e:
                self.review_text = ''
                self.review_error = '生成失败：%s' % (str(e)[:60] or '网络错误')
            finally:
                self.review_busy = False
                self.root.after(0, self.render)
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

    def render_launcher(self):
        """收起状态：只显示一个 52px 的圆形入口，不占地方。"""
        self.resize(80, 80)
        c = self.canvas
        c.configure(bg=TRANSPARENT if self.transparent_ok else BG)
        c.delete('all')
        # 只画圆：四角用 Windows -transparentcolor 抠掉，不再是“方形图片里画个圆”
        if self.launcher_image:
            c.create_image(1, 1, anchor='nw', image=self.launcher_image)
            c.create_oval(1, 1, 79, 79, outline=BORDER, width=3)
        else:
            c.create_oval(4, 6, 78, 80, fill='#E8E1D1', outline='')
            c.create_oval(3, 3, 77, 77, fill=BG, outline=BORDER, width=3)
            c.create_text(40, 40, text='海', fill=SEAL, font=('KaiTi', -36, 'bold'))
        self.launcher_rect = (0, 0, 52, 52)
        self.row_rects = {}
        self.close_rect = None

    def render(self):
        if not self.menu_open:
            self.render_launcher()
            return
        width = SECTION_W.get(self.section, WIDE) if self.section else NARROW
        top = PAD + 33
        height = top + ROW_H * 3 + GAP * 2 + PAD
        if self.section:
            section_h = SECTION_H[self.section]
            if self.section == 'review' and self.review_text:
                section_h += 195
            height += section_h + 9
        self.resize(width, height)

        c = self.canvas
        c.configure(bg=BG)
        c.delete('all')
        self.round_rect(1, 1, width - 1, height - 1, 18, BG, BORDER)
        # 顶部：鲸鱼娘品牌 + 收起按钮（点它回到圆形）
        if self.mascot_small:
            c.create_image(PAD, 4, anchor='nw', image=self.mascot_small)
        c.create_text(PAD + 36, 13, anchor='nw', text='海斗助手', fill=INK, font=('KaiTi', -24, 'bold'))
        self.close_rect = (width - 39, 6, width - 6, 36)
        c.create_text(width - 22, 21, text='×', fill=MUTED, font=('Microsoft YaHei UI', -26))
        # 水墨点缀
        c.create_oval(width - 111, -39, width + 33, 105, outline='#e2dac6', width=3)
        c.create_oval(width - 90, -18, width + 12, 84, outline='#ece5d3', width=2)
        c.create_rectangle(width - 51, 45, width - 18, 78, fill=SEAL, outline='')
        c.create_text(width - 34, 61, text='鲸', fill='#fdfaf2', font=('KaiTi', -21, 'bold'))

        self.row_rects = {}
        y = top
        for key in ROWS:
            x0, x1 = PAD, width - PAD
            self.row_rects[key] = (x0, y, x1, y + ROW_H)
            self.draw_row(key, x0, y, x1, y + ROW_H)
            y += ROW_H + GAP

        if self.section:
            self.draw_section(self.section, PAD, y + 6, width - PAD, height - PAD)

    def fresh_comment(self):
        """一条解说显示 commentMs（默认 10 秒），之后自己消失。"""
        row = (self.info or {}).get('comment') or None
        if not row or not row.get('text'):
            return None
        try:
            self.comment_ms = max(3000, min(30000, int((self.info or {}).get('commentMs') or 10000)))
        except (TypeError, ValueError):
            self.comment_ms = 10000
        try:
            if time.time() * 1000 - float(row.get('at') or 0) > self.comment_ms:
                return None
        except (TypeError, ValueError):
            return None
        return row

    def comment_messages(self, row=None):
        """把一条评论拆成最多 4 条短消息，按聊天软件的方式逐条显示。"""
        row = row or self.fresh_comment() or {}
        text = str(row.get('text') or '').replace('\r', '')
        msgs = [line.strip() for line in text.split('\n') if line.strip()]
        return (msgs or [text.strip()])[:4]

    def render_comment(self):
        """独立解说窗口：在三个功能按钮左侧，显示 commentMs 后自动消失。"""
        row = self.fresh_comment()
        if not row:
            try:
                self.comment_win.withdraw()
            except Exception:
                pass
            self._comment_key = None
            self._comment_pos = None
            return
        messages = self.comment_messages(row)
        width = 450
        height = 39 + sum(51 + 27 * max(0, (len(m) - 1) // 18) for m in messages) + 9 * len(messages) + 15
        height = max(111, min(390, height))
        mx = self.root.winfo_x()
        my = self.root.winfo_y()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = max(12, mx - width - 18)
        y = max(12, min(my, sh - height - 60))
        key = (row.get('id') or row.get('at'), row.get('text'), self.comment_ms)
        pos = (x, y, width, height)
        if key == self._comment_key and pos == self._comment_pos:
            try:
                if self.comment_win.state() != 'withdrawn':
                    return
            except Exception:
                pass
        self._comment_key = key
        self._comment_pos = pos
        try:
            self.comment_win.geometry('%dx%d+%d+%d' % (width, height, x, y))
            self.comment_canvas.configure(width=width, height=height)
            self.draw_comment(width, height)
            self.comment_win.deiconify()
        except Exception:
            pass

    def draw_comment(self, width, height):
        """微信/QQ 那种：左边小头像，右边独立气泡，每个气泡带小尖角。"""
        c = self.comment_canvas
        c.delete('all')
        self.round_rect(1, 1, width - 1, height - 1, 18, BG, BORDER, canvas=c)
        row = self.fresh_comment() or {}
        messages = self.comment_messages(row)
        avatar = 51
        ax, ay = 9, 9
        if self.mascot:
            c.create_image(ax, ay, anchor='nw', image=self.mascot)
        else:
            self.round_rect(ax, ay, ax + avatar, ay + avatar, 9, '#efe7d2', LINE, canvas=c)
        # 名字只显示在第一条上方
        c.create_text(ax + avatar + 12, ay + 3, anchor='nw', text='小满',
                      fill=MUTED, font=('KaiTi', -20))
        bx0 = ax + avatar + 12
        bx1 = width - 9
        y = ay + 24
        for index, message in enumerate(messages):
            # 先放文字，再用它的 bbox 决定气泡高度，长句会自动换行
            text_id = c.create_text(
                bx0 + 15, y + 12, anchor='nw', width=max(120, bx1 - bx0 - 30),
                justify='left', text=message, fill=INK,
                font=('Microsoft YaHei UI', -22),
            )
            bbox = c.bbox(text_id)
            text_h = (bbox[3] - bbox[1]) if bbox else 27
            bubble_h = max(45, text_h + 24)
            bubble = self.round_rect(bx0, y, bx1, y + bubble_h, 15, PAPER, LINE, canvas=c)
            c.tag_lower(bubble, text_id)
            # 尖角只给第一条，连续消息看起来才像同一个人连发
            if index == 0:
                c.create_polygon(bx0 + 3, y + 18, bx0 - 10, y + 27, bx0 + 3, y + 33,
                                 fill=PAPER, outline=LINE)
            y += bubble_h + 9

    def round_rect(self, x0, y0, x1, y1, r, fill, outline, canvas=None):
        """Tk 没有圆角矩形，用平滑多边形拼一个。"""
        cv = canvas or self.canvas
        pts = [
            x0 + r, y0, x1 - r, y0, x1, y0, x1, y0 + r,
            x1, y1 - r, x1, y1, x1 - r, y1, x0 + r, y1,
            x0, y1, x0, y1 - r, x0, y0 + r, x0, y0,
        ]
        return cv.create_polygon(pts, smooth=True, splinesteps=24,
                                 fill=fill, outline=outline, width=1)

    def draw_row(self, key, x0, y0, x1, y1):
        c = self.canvas
        active = self.section == key and self.available(key)
        self.round_rect(x0, y0, x1, y1, 14, '#efe7d2' if active else '#fbf9f2', BORDER)
        # 只有红绿两种灯：绿=可点，红=点了没反应
        ok = self.available(key)
        color = GREEN if ok else RED
        if key == 'review' and (self.review_busy or ((self.info or {}).get('review') or {}).get('status') == 'running'):
            color = GOLD
        c.create_oval(x0 + 15, y0 + 16, x0 + 30, y0 + 31, fill=color, outline='')
        c.create_text(x0 + 40, y0 + ROW_H / 2, anchor='w', text=TITLES[key],
                      fill=TEXT if ok else MUTED, font=TITLE)

    def draw_section(self, key, x0, y0, x1, y1):
        c = self.canvas
        c.create_line(x0, y0 - 3, x1, y0 - 3, fill='#d8d0bd')
        if key == 'hex':
            self.draw_hex(x0, y0 + 12)
        elif key == 'build':
            self.draw_build(x0, y0 + 12)
        elif key == 'review':
            self.draw_review(x0, y0 + 12)

    def draw_hex(self, x0, y0):
        c = self.canvas
        cards = (self.data or {}).get('cards') or []
        if not cards:
            c.create_text(x0, y0 + 15, anchor='w', text='点上面那行开始识别；卡一出现就显示',
                          fill=MUTED, font=SMALL)
            return
        colors = {'S': GOLD, 'A': ACCENT, 'B': '#8fb4ff', 'C': '#9aa4b8', 'D': '#6b7280'}
        y = y0 + 12
        for i, card in enumerate(cards[:3]):
            wr = card.get('augmentWinRate')
            wr_txt = ('%.1f%%' % (wr * 100)) if isinstance(wr, (int, float)) else '—'
            tier = card.get('tier') or '?'
            color = colors.get(tier, '#8fb4ff')
            if i == 0:
                self.round_rect(x0 - 6, y - 17, x0 + 429, y + 17, 12, '#efe7d2', color)
            c.create_text(x0, y, anchor='w', text=tier, fill=color,
                          font=TITLE)
            c.create_text(x0 + 27, y, anchor='w', text=(card.get('name') or '?'), fill=TEXT,
                          font=TITLE)
            c.create_text(x0 + 426, y, anchor='e', text=wr_txt, fill=color if i == 0 else TEXT,
                          font=('Consolas', -21, 'bold'))
            y += 39
        advice = (self.data or {}).get('advice') or ''
        if advice:
            # width 让 Tk 自己折行；anchor 用 nw，多行时从左上往下排
            c.create_text(x0, y + 9, anchor='nw', width=414,
                          text='▸ ' + advice, fill=GOLD, justify='left',
                          font=SMALL)

    def draw_build(self, x0, y0):
        c = self.canvas
        archs = (self.info or {}).get('archetypes') or []
        self.tab_rects = []
        if not archs:
            c.create_text(x0, y0 + 15, anchor='w', text='读到你选的英雄后显示出装',
                          fill=MUTED, font=SMALL)
            return
        if self.arch >= len(archs):
            self.arch = 0

        # 流切换：标签当按钮，点谁切谁
        tx = x0
        for i, row in enumerate(archs):
            label = (row.get('label') or '流派')[:6]
            w = 18 + int(len(label) * 13.5)
            active = (i == self.arch)
            self.round_rect(tx, y0 - 9, tx + w, y0 + 21, 12, '#efe7d2' if active else '#fbf9f2', ACCENT if active else BORDER)
            c.create_text(tx + w / 2, y0 + 6, text=label,
                          fill=ACCENT if active else MUTED,
                          font=BODY_B)
            self.tab_rects.append((tx, y0 - 9, tx + w, y0 + 21, i))
            tx += w + 9

        build = archs[self.arch]
        y = y0 + 45
        groups = [
            ('出门', build.get('starter') or []),
            ('核心', (build.get('core') or []) + ([build['boots']] if build.get('boots') else [])),
            ('后续', build.get('later') or []),
        ]
        for title, items in groups:
            if not items:
                continue
            c.create_text(x0, y + 18, anchor='w', text=title, fill=MUTED,
                          font=SMALL)
            ix = x0 + 45
            for it in items[:7]:
                img = self.icons.get(it.get('icon'), 39)
                if img is not None:
                    c.create_image(ix, y, anchor='nw', image=img)
                else:
                    c.create_rectangle(ix, y, ix + 39, y + 39, fill='#f1ece0', outline='#c9c1ad')
                name = (it.get('name') or '')[:4]
                c.create_text(ix + 20, y + 48, text=name, fill=TEXT,
                              font=SMALL)
                ix += 57
            y += 84

    def draw_review(self, x0, y0):
        c = self.canvas
        review = (self.info or {}).get('review') or {}
        status = review.get('status') or 'idle'
        if self.review_text:
            c.create_text(x0, y0 + 3, anchor='nw', text='锐评已生成', fill=GREEN, font=SMALL)
            c.create_text(x0, y0 + 33, anchor='nw', width=max(270, self.cur_w - x0 - PAD),
                          justify='left', text=self.review_text, fill=INK, font=SMALL)
            return
        if status in ('ready', 'done'):
            text, color = '锐评已生成，去插件面板看', GREEN
        elif self.review_busy or status == 'running':
            text, color = '正在生成，大约十几秒…', GOLD
        elif self.review_error:
            text, color = self.review_error, RED
        elif review.get('ready'):
            text, color = '数据已齐，点上面那行生成', GREEN
        else:
            text, color = '对局结束、结算数据同步后才能用', MUTED
        c.create_text(x0, y0 + 15, anchor='w', text=text, fill=color,
                      font=SMALL)

    # ---------- 轮询 ----------
    def tick(self):
        changed = False
        try:
            m = os.path.getmtime(self.info_file)
            if m != self.info_mtime:
                self.info_mtime = m
                self.info = read_json(self.info_file) or {}
                review = (self.info or {}).get('review') or {}
                game_id = str(review.get('gameId') or '')
                if self.review_text and game_id and self.review_game_id and game_id != self.review_game_id:
                    self.review_text = ''
                    self.review_game_id = ''
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
                    # 只有用户没手动收起、且当前没在看别的内容时才自动展开；
                    # 收起后写出的 cancel 会让服务端停扫，这里再加一道本地保险。
                    if data.get('cards') and not self.hex_dismissed and self.section is None:
                        self.section = 'hex'
                    elif data.get('status') in ('idle', 'timeout', 'left-game') and self.section == 'hex':
                        self.section = None
                changed = True
        except OSError:
            pass
        if changed:
            self.render()
        # 解说独立窗口：每拍检查过期（commentMs）与位置，不跟主按钮绑在一起
        self.render_comment()
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
    # 必须在 Tk 创建之前：否则 Windows 缩放会把窗口位图拉伸，字发虚
    enable_dpi_awareness()
    if not single_instance():
        return
    for p in (a.file, a.request, a.info):
        if not os.path.exists(p):
            write_json(p, {})
    write_pid_file(a.pid_file)
    try:
        ov = Overlay(a.file, a.request, a.info, 0, 0)
        sw = ov.root.winfo_screenwidth()
        x = a.x if a.x >= 0 else sw - 80 - 24
        y = a.y if a.y >= 0 else 64
        ov.root.geometry('+%d+%d' % (x, y))
        ov.root.mainloop()
    finally:
        clear_pid_file(a.pid_file)


if __name__ == '__main__':
    main()

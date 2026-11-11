# 海斗助手在线版

DSH Web UI 插件：连接本机 League Client 的 LCU 只读接口，覆盖选人、局内、结算；
数据来自 [ARAMKit](https://aramkit.cn/zh-CN)。

除了常规的出装 / 海克斯推荐和赛后 AI 锐评，这一版重点做了**游戏内实时陪伴解说**：
一个置顶悬浮窗，AI 按你写的人设每隔 45–90 秒说一句，像女朋友在旁边陪你打。

> 本项目不是 Riot Games、腾讯或 ARAMKit 的官方产品。

---

## 功能

### 选人阶段

- 读取当前共享备选席和你的当前英雄，列出这一局可选的英雄；
- 按 ARAMKit 胜率排序，标出胜率最高的 5 个；
- 读取五名队友的 `昵称#Tag`，查询隐藏分、表现分；
- 识别你当前选择的英雄，自动加载出装、召唤师技能和海克斯；
- 支持暴击 / 战士 / 特效等流派切换，每个流派有独立核心装路线；
- 海克斯按品质切换，默认前 3，可展开前 15，并显示高胜率组合。

### 对局进行中

- 只保留你自己的英雄，切出游戏也能继续查看；
- 显示当前英雄的出装、召唤师技能和海克斯；
- 没有选人缓存时，从 Live Client API 读取当前阵容并定位你自己。

### 游戏内实时解说（v1.1.0 重点）

- **置顶悬浮窗**：宣纸底、32px 头像、QQ 式气泡，不挡游戏操作；
- **自动开口**：对局中且解说开启时，每 **45–90 秒随机**抓一帧，直接调用 DSH 当前模型生成一句；
- **不创建会话**：走 `ctx.llm.stream` + 图片附件，不唤醒、不新建任何 DSH 聊天；
- **陪伴优先**：prompt 明确“你是女朋友，不是解说员”，游戏只是背景；
- **人设强化**：完整人设 + 随机情绪落点（挑刺 / 护短 / 吃醋 / 心疼 / 日常联想 / 撒娇）+ 随机口癖
  （啧、哎、你看你、真是的、行吧、我跟你讲、笨死了、嗯？），并附最近 3 条避免重复；
- **画面门禁**：只有游戏窗口存在且**未最小化**时才读取画面；切到桌面并最小化游戏时直接跳过；
- **单实例**：Windows 命名互斥量保证只有一个悬浮窗，DSH 重启也不会叠出两个；
- **手动抓帧**：注册 `aram_peek` 工具，会话里的模型也可以随时调用它看一帧、写 `say`；
- **解说历史**：最新一条写入 `%USERPROFILE%\.dsh\aramkit-live\comments.json`，面板里可开关 / 改人设 / 清空。

### 对局结束

- 读取 LCU 结算面板，展示友方五人 KDA、伤害、经济等；
- 等待 match history 同步本局海克斯，表格显示每人海克斯图标，悬浮看名称、品质和说明；
- 调用 DSH 当前默认模型生成友方五人 AI 锐评：谁尽力、谁犯罪、谁不团队，并结合海克斯选择；
- 治疗只统计对队友的治疗，自身吸血 / 自愈不计入团队贡献；
- AI 锐评可关闭，关闭后只显示结算面板，不消耗 Token；
- 支持毒舌 / 教练 / 抽象 / 数据复盘 / 自定义风格，内置三套语料预设；
- AI 结果按对局、风格和语料缓存 30 分钟。

### 对局记录

- 结算出现时自动跳到「对局记录」并打开这一局；
- 记录当天对局，保留 24 小时：胜负、时长、英雄、KDA、五人结算表、该局锐评；
- 锐评由宿主在结算时后台生成，切页面、开下一局都不影响；
- 记录存在 `%USERPROFILE%\.dsh\aramkit-live\history.json`（遵循 `DSH_HOME`）。

---

## 环境要求

- Windows 10 / 11
- DeepSeek Harness Desktop，Web UI 可用
- 已启动并登录的 League 客户端（国服账号）
- DSH 已配置默认模型（解说和锐评都要用）
- 游戏内悬浮窗需要 Python 3（插件会自动找 `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`；
  也可以用环境变量 `DSH_SEE_PYTHON` 指定）
- Node.js 22+（仅本机安装插件时需要）

---

## 安装

DSH 插件以本地 bundle 方式安装。在仓库根目录执行：

```powershell
dsh plugin --profile desktop add "link:<仓库绝对路径>\packages\aramkit-live"
```

例如：

```text
D:\DSH\aramkit-dsh-plugins\packages\aramkit-live
```

`desktop` 是常见 profile 名；不是的话替换成实际名称。安装后重启 DSH，或刷新 Web 页面。

Release ZIP 解压后，在 DSH 的插件管理器里选择「从本地目录安装」，指向解压出来的
`aramkit-live` 目录即可。

---

## 使用

### 1. 连接 LCU

保持 League 客户端和 DSH 在同一台 Windows 机器上。插件会自动发现：

1. `ARAMKIT_LCU_LOCKFILE` 指定的路径；
2. 常见 Riot / WeGame 安装目录的 `lockfile`；
3. 最新的 `LeagueClientUx.log`；
4. `LeagueClientUx.exe` 的命令行。

WeGame 的 `LeagueClient\lockfile` 经常是 0 字节，这是正常的；自动恢复失败时，
在页面里手动指定有效的 `lockfile`。

### 2. 打开游戏内解说

1. 打开左侧栏「海斗助手在线版」；
2. 在解说设置里打开「全程解说」；
3. 把完整人设粘进文本框（**上限 4000 字**，别再被 300 字截断）；
4. 进对局，悬浮窗会自动出现；每 45–90 秒随机说一句。

人设建议包含：名字、年龄、职业、称呼、口癖、生气/开心时的反应、几个示例台词。
示例见仓库 `docs/` 里的「林小满」设定。

### 3. 解释 / 手动抓帧

- 面板里可以改人设、开关解说、清空评论；
- 会话里的模型也可以调用 `aram_peek` 抓一帧，并把 `say` 写进覆盖层；
- HTTP 接口：`POST /aramkit-live/comments {text}` 可手动发一条。

---

## 成本

按 DeepSeek 官方价格（`deepseek-flash`，空闲时段输入 ¥1 / 百万、输出 ¥4 / 百万；
高峰翻倍；图片每张最多 1024 tokens）：

| 路径 | 单条估算 | 说明 |
|---|---|---|
| 直接看图（v1.1.0 默认） | **约 0.15–0.35 分** | 1.7k 输入 + 30–100 输出；不累积历史 |
| 会话式（旧方案） | 1–8 分 | 会带工具定义和历史截图，越打越贵 |

20 分钟一局、45–90 秒一条，大约 15–25 条，直接看图一局约 **3–9 分钱**。
价格以 [DeepSeek 官方页面](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) 为准。

---

## 隐私与边界

- LCU 只读，不修改客户端文件、不注入游戏进程、不读取游戏内存；
- 隐藏分只覆盖国服；队友名不可见 / 人机 / 未收录时显示「未收录」；
- 开启解说后，**游戏画面帧会发送给 DSH 配置的模型**；这是解说的必要输入；
- 画面帧只在本机抓取，不经过本项目作者的服务器；
- 对局记录、评论、解说设置都在 `%USERPROFILE%\.dsh\aramkit-live\` 下，只在本机；
- 关掉解说开关后不会抓帧，也不会调用模型；
- 「可选英雄」是当前候选池，不是全部英雄。

---

## 常见问题

### 游戏里没有解说气泡

1. 确认「全程解说」是开的；
2. 确认游戏窗口**没有最小化**（窗口在后台、DSH 在前台都可以）；
3. 看 `http://127.0.0.1:<DSH 端口>/aramkit-live/commentary-status`：
   - `enabled` 应为 true；
   - `phase` 应为 `InProgress`；
   - `foreground` 应为 true；
4. 如果 `overlay.overlayRunning` 为 false，重启 DSH；仍有问题看
   `%USERPROFILE%\.dsh\aramkit-live\overlay-error.log`。

### 出现两个悬浮窗

v1.1.0 已用 Windows 命名互斥量做单实例，并在启动前读取 `.cache/overlay.pid` 复用旧窗口。
如果还能看到两个，说明其中一个是旧版本残留进程：重启 DSH 即可清掉。

### 解说太像游戏播报 / 没有人设感

1. 确认人设没有被截断（输入框已从 300 字放宽到 4000 字）；
2. 把人设写得具体一点：称呼、口癖、生气/撒娇时的反应、示例台词；
3. 还是不对的话，把最近 2–3 条解说发出来，调 prompt 里的情绪落点和口癖。

### 模型报错 / 没有输出

- 检查 DSH 默认模型、余额和网络；
- 单条失败只记日志，下一拍会重试；
- 可以手动请求 `/aramkit-live/test-direct-comment` 看具体错误。

---

## 项目结构

```text
aramkit-live/
├─ index.js              # Host：LCU 状态、AI 锐评、解说循环、HTTP 路由
├─ client.js             # Client：侧栏 + 本局 / 对局记录 / 解说设置
├─ data.js               # ARAMKit 数据访问
├─ lcu.js                # LCU / Live Client 连接器
├─ comments-service.js   # 解说流（人设、评论持久化）
├─ hexscan-service.js    # 海克斯识别 + 悬浮窗生命周期
├─ peek-tool.js          # aram_peek 工具（抓帧 + say）
├─ game-window.js        # 画面门禁（游戏窗口是否可见）
├─ src/augment-match.js  # 海克斯 OCR 文本匹配
├─ tools/hexscan.mjs     # 抓帧 / OCR CLI
├─ tools/hexoverlay.py   # 游戏内 Tk 悬浮窗
├─ tools/ocr.ps1         # Windows OCR
├─ assets/whale.png      # 悬浮窗头像
├─ locale/               # 中 / 英文案
└─ package.json
```

---

## 更新日志

### v1.1.0（2026-11-12）

- 新增游戏内实时陪伴解说：置顶悬浮窗 + 45–90 秒随机开口；
- 解说改为**直接看图**：`ctx.llm.stream` + `{ type:'image', attachment }`，不创建 DSH 会话；
- prompt 强化人设：完整人设、随机情绪落点、随机口癖、最近 3 条去重、陪伴优先；
- 新增 `aram_peek` 工具与 `/aramkit-live/comments` 手动接口；
- 新增画面门禁：只在游戏窗口未最小化时抓帧；
- 悬浮窗单实例 + pid 复用，修复 DSH 重启后两个悬浮窗；
- 人设输入上限 300 → 4000 字；
- 新增 `/commentary-status`、`/test-direct-comment` 诊断接口。

### v1.0.15

- 选人 / 局内 / 结算、队友隐藏分、出装海克斯推荐、赛后 AI 锐评、对局记录。

---

## 声明

本项目不是 Riot Games 或 ARAMKit 的官方产品。
英雄联盟和 Riot Games 是 Riot Games, Inc. 的商标或注册商标；ARAMKit 的数据归其所有者所有。
使用本插件产生的任何后果由使用者自行承担，请遵守游戏服务条款。

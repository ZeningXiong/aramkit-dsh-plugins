# 架构说明

本文档面向想修改或二次开发本项目的贡献者。两个插件都遵循 DSH 的 Host / Client 两半结构。

## 总览

```text
┌───────────────────────────── DSH Web UI ─────────────────────────────┐
│  Client 半（client.js）                                               │
│  - 注册 sidebar.panellist + main slot                                 │
│  - React 组件渲染页面                                                 │
│  - 只通过同源 /aramkit-* 路由取数据                                   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ HTTP（同源）
┌───────────────────────────────▼───────────────────────────────────────┐
│  Host 半（index.js）                                                   │
│  - webServer 注册只读路由                                             │
│  - 请求 ARAMKit 公开数据                                              │
│  - 在线版：读取 LCU / Live Client API                                 │
│  - 在线版：调用 DSH LLM 生成 AI 锐评                                  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   data.aramkit.cn       api.aramkit.cn       127.0.0.1 LCU
   （静态 JSON）          （隐藏分）            :2999 Live API
```

## 隔离版

### 文件

- `packages/aramkit-helper/index.js`
  - ARAMKit 数据版本发现
  - 英雄 / 海克斯 / 装备 / 召唤师技能资源缓存
  - 英雄详情裁剪
  - 隐藏分查询
  - 注册 `/aramkit-api/*` 路由
- `packages/aramkit-helper/client.js`
  - 侧栏图标 + 主面板
  - 队伍隐藏分
  - 英雄推荐
  - 全分段 / 高分段切换
  - 海克斯品质标签 + 展开前 15
  - 深色主题、中英文切换

### 路由

| 路由 | 说明 |
|---|---|
| `GET /aramkit-api/champions?dataset=all\|high` | 英雄排行 |
| `GET /aramkit-api/champion?id=157&dataset=all\|high` | 英雄详情、出装、海克斯 |
| `GET /aramkit-api/rating?gameName=&tagLine=` | 隐藏分 |

## 在线版

### 文件

- `packages/aramkit-live/index.js`
  - 状态机：`ChampSelect` / `InProgress` / `Postgame`
  - 选人会话归一化、队友 MMR、可选英雄 top5
  - 局内缓存 / Live Client 回退
  - 结算归一化、AI 锐评
  - 对局记录：`$DSH_HOME/aramkit-live/history.json`，保留 24 小时、最多 60 条
- `packages/aramkit-live/data.js`
  - 与隔离版共用的 ARAMKit 访问逻辑（独立副本，便于单包发布）
- `packages/aramkit-live/lcu.js`
  - lockfile / 日志 / 进程命令行发现
  - 本地 HTTPS Basic Auth
  - Live Client API :2999
- `packages/aramkit-live/client.js`
  - 选人页
  - 局内五英雄推荐
  - 结算 / AI 锐评页
  - 对局记录列表与详情（本局 / 对局记录 两个标签）
  - LCU 手动连接与诊断

### 路由

| 路由 | 说明 |
|---|---|
| `GET /aramkit-live/state` | 当前阶段、选人、局内或结算状态（结算会顺手记录并触发后台锐评） |
| `GET /aramkit-live/connect?path=` | 指定 lockfile 并重连 |
| `GET /aramkit-live/diagnose` | 候选路径、日志、进程、连接诊断 |
| `GET /aramkit-live/champion?id=&dataset=` | 英雄推荐数据 |
| `GET /aramkit-live/champions?dataset=` | 英雄列表 |
| `GET /aramkit-live/review?gameId=` | AI 锐评（可带 `style` / `corpus` / `preset` / `force`） |
| `GET /aramkit-live/corpus-presets` | 内置语料预设（虎扑毒舌 / 海斗专业分析 / 专业抓处） |
| `GET /aramkit-live/history` | 最近 24 小时对局列表 + AI 设置 |
| `GET /aramkit-live/history-detail?gameId=` | 单局完整结算 + 锐评 |
| `POST /aramkit-live/ai-settings` | 客户端同步 AI 开关 / 风格 / 语料，供后台生成使用 |

### 状态流

```text
ChampSelect
  └─ buildChampSelect()
       ├─ myTeam + benchChampions → 可选英雄 / top5
       ├─ summonerId → 昵称#Tag → ARAMKit 隐藏分
       ├─ currentChampionId → /champion 推荐
       └─ lastChampSelect 缓存

InProgress
  ├─ 有 lastChampSelect：直接返回缓存的五人阵容
  └─ 无缓存：Live Client API /liveclientdata/allgamedata
       └─ 按 rawChampionName / championName 映射 ARAMKit 英雄

PreEndOfGame / EndOfGame / WaitingForStats
  └─ /lol-end-of-game/v1/eog-stats-block
       ├─ 双方玩家 stats 归一化
       ├─ 友方五人 damage/gold/CC/vision 汇总
       ├─ recordPostgame() → history.json（新增对局）
       └─ 后台 startReviewJob() → DSH llm.stream → 写回该局记录
```

### LCU 发现顺序

1. 手动路径（页面输入 / 环境变量）
2. 常见安装目录的 `lockfile`
3. 最新的 `LeagueClientUx.log` 中的 `--app-port` + `--remoting-auth-token`
4. `LeagueClientUx.exe` 的命令行

优先级是“手动 > 自动”。日志回退是为了解决 WeGame 客户端 `lockfile` 为 0 字节的问题。

### 安全边界

- 只发送 GET 请求到本地 LCU / Live Client API；
- 不修改客户端文件、不注入进程、不读取游戏内存；
- LCU token 仅在 Host 内存中使用，不返回给 Client，也不写入日志；
- AI 请求只通过 DSH 注入的 `llm` 服务发出；
- 不提交 `lockfile`、`*.log`、`node_modules`。

## 扩展建议

- 想增加新的数据面板：在 `client.js` 里新增组件，复用现有 `/champion` 数据。
- 想增加新的 LCU 数据：在 `lcu.js` 加只读函数，在 `index.js` 加路由。
- 想修改 AI 锐评风格：修改 `index.js` 的 `generateReview()` prompt；内置语料在 `index.js` 的 `CORPUS_PRESETS`。
- 想支持其他语言：`client.js` 目前是中文文案；可仿照隔离版的语言切换，把文案抽成字典。

## 已知限制

- LCU 是 Riot 未公开接口，可能随客户端版本变化；
- WeGame 路径/日志格式可能变化；
- AI 输出是模型生成，可能不稳定；
- 对局记录靠面板轮询 `/state` 落盘，DSH 面板完全关闭期间结束的对局不会记录；
- 高分段样本较少时推荐会显示“暂无数据”。

# 海斗助手 MCP（Codex 适配）

在 [ZeningXiong/aramkit-dsh-plugins](https://github.com/ZeningXiong/aramkit-dsh-plugins) 的 MIT 许可代码上添加的本地 stdio MCP 服务。复用原项目 `aramkit-live/data.js`、`lcu.js` 及选人/结算归一化函数，不需要安装 DSH。

这是聊天工具接口。原 DSH 侧栏、React 面板不会出现在 Codex 内，也不会自动持续轮询或在对局结束时主动弹出点评。用户提问时由 Codex 调用工具并解释结果。

如果需要脱离 AI 软件使用，现已提供 [独立网页版](../aramkit-web/README.md)。MCP 与独立网页共用 `aramkit-core/service.js`；本文件夹的 `service.js` 保留兼容导出。

## 已适配的能力

| MCP 工具 | 用途 |
|---|---|
| `aramkit_search_champions` | 按中文名、称号、英文名、ID 搜索，或查看当前版本排行 |
| `aramkit_champion_build` | 出装与流派、加点、召唤师技能、三种品质海克斯和组合 |
| `aramkit_search_augments` | 按名称、ID、品质查询海克斯说明 |
| `aramkit_player_rating` | 手动查询国服玩家估算隐藏分 |
| `aramkit_lcu_status` | 检查本机客户端连接和游戏阶段 |
| `aramkit_lcu_diagnose` | 连接诊断，可指定完整 lockfile 路径 |
| `aramkit_game_state` | 选人英雄池与推荐、友方信息、局内或结算状态 |
| `aramkit_postgame` | 友方结算统计、海克斯和贡献占比 |
| `aramkit_prepare_review` | 提供匿名结算数据和风格要求，由当前 Codex 生成点评 |

英雄数据支持 `dataset="all"`（全分段）和 `"high"`（高分段）。英雄查询保留上游低样本过滤。海克斯胜率与组合在英雄出装查询中返回。

## 要求与安装

- Node.js 22+；首次安装依赖需要联网。
- Codex Desktop 或 CLI，支持本地 STDIO MCP。
- 本机游戏连接按上游设计支持 Windows 10/11。公开数据查询无需启动游戏；在线功能需要同一台 Windows 电脑上启动并登录 LeagueClient。
- 这是仓库内的私有包，引用相邻的 `aramkit-live`。必须保留整个仓库目录，不能只复制 `aramkit-mcp` 文件夹，也不能用 `npx aramkit-mcp` 安装。

在本目录执行：

```powershell
pnpm install --frozen-lockfile --ignore-scripts
.\setup-codex.ps1
```

也可直接运行 `setup-codex.ps1`，它会在缺少依赖时尝试使用本机 npm/pnpm 安装。脚本通过 Codex CLI 注册名为 `aramkit` 的本地服务，使用 Node 和 `server.js` 的绝对路径，不依赖工作目录。若已有指向其他位置的同名 MCP，脚本会保留原配置并停止。

若可执行程序不在 PATH，可明确指定：

```powershell
.\setup-codex.ps1 -NodePath 'C:\Program Files\nodejs\node.exe' -CodexPath 'C:\实际路径\codex.exe'
```

完成后在 Codex 的 MCP 设置中重启连接，或重新打开 Codex 并开启新聊天。当前对话的工具列表不一定动态刷新。

手动注册的等价命令（把示例换成实际绝对路径）：

```powershell
codex mcp add aramkit -- 'C:\Program Files\nodejs\node.exe' 'D:\DSH\aramkit-dsh-plugins\packages\aramkit-mcp\server.js'
```

可用 `codex mcp get aramkit --json` 检查配置。MCP 的连接方式参见 [OpenAI 官方文档](https://learn.chatgpt.com/docs/extend/mcp)。如需移除连接，运行 `codex mcp remove aramkit`；此操作不删除源码。

## 在 Codex 中直接提问

- “用海斗助手查一下亚索高分段的出装和棱彩海克斯。”
- “查珠光护手的效果。”
- “看看英雄联盟客户端是否已连接。”
- “读取我现在选人的英雄池，帮我挑五个推荐英雄。”
- “查询我队友的隐藏分，允许将他们的昵称和 Tag 发给 ARAMKit。”
- “读取这局结算，用教练风格匿名复盘五个人。”

工具返回数据，最终解释和赛后点评由当前 Codex 生成。MCP 不保存模型密钥，不另行调用付费模型，也不需要 DSH 默认模型；当前 Codex 会话仍按其自身使用额度计费。

## 本机连接与隐私

继承上游 lockfile、WeGame 日志和 LeagueClientUx 进程发现逻辑。自动发现失败时，可让 Codex 调用诊断工具，指定 `D:\WeGameApps\英雄联盟\LeagueClient\lockfile` 等实际路径。

也可以在首次注册时固定路径：

```powershell
.\setup-codex.ps1 -Lockfile 'D:\WeGameApps\英雄联盟\LeagueClient\lockfile'
```

令牌只用于本机 `127.0.0.1` 的 LCU 请求，不作为工具参数或返回值，也不输出到日志。服务没有任意 URL、任意 LCU 路径或修改游戏设置的工具，只调用固定只读接口。

- **匿名默认开启**：游戏状态与结算只返回“你/队友N”，移除昵称、Tag、PUUID 和召唤师 ID。明确设置 `anonymize=false` 可返回昵称，但仍不返回令牌和账号标识。
- **队友隐藏分默认关闭**：`aramkit_game_state` 仅在 `includeRatings=true` 时把队友昵称和 Tag 发给 ARAMKit。
- 手动隐藏分查询会把指定 `昵称#Tag` 发给 ARAMKit；分数是该站估算，不是 Riot 官方 MMR，仅覆盖国服。
- Codex 会接收工具返回的比赛数据；默认已匿名。不额外发往作者服务器或独立模型 API。
- 只读本机 LCU/Live Client API，不注入游戏、不修改客户端、不自动选英雄或出装。

## 验证与限制

```powershell
node --test tests/*.test.js
node scripts/smoke.js
```

测试覆盖真实 MCP stdio 握手与工具发现、参数校验、错误返回、匿名化、隐藏分按需查询、过期缓存，以及模拟 LCU 下复用原代码的选人、红方结算、队友治疗和海克斯读取。`smoke.js` 会访问真实 ARAMKit 数据并检测本机客户端；不会查询任何真实玩家隐藏分。

公开 API 和 LCU 接口可能变化。无运行中客户端时不能验证真实选人或赛后数据。结算应在客户端结算页仍可访问时读取；缓存只在当前 MCP 进程内保存十分钟，重启即失效。海克斯可能需要等待 match history 同步。MCP 本身不实现后台监控。

## 上游兼容改动

保留原 DSH 插件。`aramkit-live/index.js` 仅增加：可关闭选人隐藏分查询的可选参数（原 DSH 默认仍开启）、导出局内数据函数、支持新 Riot ID，以及无法识别本机玩家时不猜测友方队伍。原项目和 ARAMKit 署名及根目录 MIT 许可保留。

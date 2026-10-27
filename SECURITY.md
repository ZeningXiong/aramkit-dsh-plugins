# 安全说明

## 不要提交的东西

- `lockfile`
- `LeagueClientUx.log` / `debug.log`
- 任何包含 `remoting-auth-token` 的日志或截图
- `node_modules/`
- 个人 Riot ID、队友名单、对局记录截图

项目的 `.gitignore` 已经排除了 `lockfile` 和 `*.log`。提交前请在 GitHub Desktop 的 Changes 列表中再确认一遍。

## 插件会读取什么

在线版会在本机读取：

- League Client 的 `lockfile`，或 `LeagueClientUx.log` 中的端口和令牌；
- LCU 的选人、队友、结算数据；
- Live Client API（`127.0.0.1:2999`）的局内阵容。

这些数据只在本机 Host 进程和 DSH 页面之间使用。

## 插件会发送什么

- 隐藏分查询：向 `api.aramkit.cn` 发送 `昵称#Tag`；
- 英雄数据：向 `data.aramkit.cn` 请求公开静态数据；
- AI 锐评：向 DSH 配置的模型发送本局友方数据（包括玩家名、英雄和战绩）。

**不会**发送 LCU 端口、令牌、lockfile 内容或日志。

## 报告问题

如果发现安全问题，请通过 GitHub 的 **Security → Report a vulnerability** 私下报告，不要在公开 issue 里粘贴 token、lockfile 或日志。

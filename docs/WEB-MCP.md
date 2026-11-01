# 独立网页与 MCP 扩展

基于原项目的数据查询与只读客户端连接，增加独立网页和 MCP 两个入口。保留 DSH 插件及其 24 小时对局记录，新增入口与 DSH 各自启动、各自管理 AI 调用。

## 功能与边界

| 入口 | 运行要求 | AI 评价方式 | 结算保留方式 |
| --- | --- | --- | --- |
| DSH 隔离版 | DSH | 不提供自动锐评 | 手动查询 |
| DSH 在线版 | DSH、本机游戏客户端 | DSH 默认模型，可关闭自动锐评 | 上游的本机 24 小时记录，最多 60 局 |
| 独立网页 | Node.js 22+，便携包可自带运行程序 | 可选 API Key，手动生成匿名五人锐评 | 匿名结算与评价保存 24 小时，最多 60 局、每局 8 份评价 |
| MCP | Node.js 22+、支持 stdio 的 AI 客户端 | 返回匿名数据，由调用端生成点评 | 当前进程的结算缓存 10 分钟 |

网页查出装、海克斯、隐藏分和读取比赛不要求打开 Codex 或 DSH，也不需要模型 API。比赛读取需要同一台 Windows 电脑上已登录的英雄联盟客户端。网页不是游戏内悬浮窗。

独立网页 v0.3.0 增加自己的「对局记录」页，匿名结算与对应评价保存 24 小时。开下一局、刷新和重启后可以继续查看或评价指定的旧对局，迟到的模型返回仍存回原局。网页不会调用 DSH 的历史记录函数，AI 始终手动触发，不自动消费额度。

## 新增内容

- `packages/aramkit-core`：供网页和 MCP 共用的英雄、海克斯、隐藏分、只读对局与匿名复盘服务。
- `packages/aramkit-core/match-history.js`：离开结算后的只读比赛历史恢复，验证当前账号、比赛时效与完整五人详情，标明未知统计。
- `packages/aramkit-web`：只监听 `127.0.0.1:3210` 的网页服务、浏览器界面、Windows 启动入口与便携包构建脚本。网页服务没有第三方运行依赖。
- `packages/aramkit-mcp`：9 个 stdio 工具、Codex 注册脚本、锁定的 SDK 依赖和协议测试。
- `scripts/check-publication.mjs`：检查跟踪文件、暂存内容及本地待贡献的提交历史。

原 `aramkit-live/index.js` 的适配改动为：可选关闭选人隐藏分查询、导出局内数据函数、支持新 Riot ID、在无法识别本机玩家时拒绝猜测友方，以及复用已读取的比赛详情。`lcu.js` 新增固定的只读比赛详情端点，供共享服务在结算接口清空后补读。原 DSH 的隐藏分默认行为和历史记录导出保留。

## API 兼容

独立网页支持 OpenAI Responses（JSON 或 SSE）与 Chat Completions 兼容协议。DeepSeek 等服务通过设置页选择协议、填写其 Base URL、模型 ID 与 API Key，不复用 Codex 或 DSH 登录。

只有手动点击生成才请求模型；内存缓存保留 30 分钟，在 24 小时历史保留期内，相同对局数据、服务地址、模型和风格也能复用磁盘中的结果。查看已保存评价不需要 API Key；强制重新生成会再次调用，失败不自动进行付费重试。模型返回在本地完成五人完整性检查和有限格式兼容，不按数组顺序猜测玩家身份。

兼容性取决于服务商支持的端点、模型权限和 JSON 输出能力。自动测试使用人工构造响应，不代表所有服务商均已通过真实推理验证。

## 隐私与提交范围

- 网页与 MCP 的比赛输出默认匿名，队友隐藏分默认关闭；主动查询隐藏分时会把指定 Riot ID 发给 ARAMKit。
- 网页 AI 始终仅发送匿名友方统计，不发送昵称、Tag、PUUID、召唤师 ID 或游戏连接令牌。
- 记住的网页 API Key 使用 Windows 当前账户 DPAPI 加密，密钥不回显给前端，也不进入浏览器存储、命令行或日志。
- 源码不包含本机配置、真实比赛记录、API Key、游戏令牌、个人截图、绝对个人路径、桌面快捷方式、便携运行程序或 `node_modules`。
- `history.json`、`match-history.json`、`review-error.json` 及临时文件同样排除；上游 DSH 记录、网页匿名记录和脱敏诊断分别留在使用者本机。

发布检查读取 Git 中实际跟踪的内容，不会读取被忽略的个人设置。规则扫描不能识别所有形式的个人信息，发布前仍应人工审阅完整差异与提交署名。

## 验证

在仓库根目录运行：

```powershell
node --test packages/aramkit-web/tests/*.test.js packages/aramkit-mcp/tests/*.test.js scripts/tests/*.test.mjs
node scripts/check-publication.mjs --all --base origin/main
git diff --check origin/main...HEAD
```

MCP 测试需要先在 `packages/aramkit-mcp` 安装锁定依赖；Windows DPAPI 测试需要普通 Windows 用户环境。所有比赛与模型测试均使用人工数据，不调用付费模型，不查询真实玩家。

安装见 [独立网页说明](../packages/aramkit-web/README.md) 与 [MCP 说明](../packages/aramkit-mcp/README.md)。保留 [上游仓库](https://github.com/ZeningXiong/aramkit-dsh-plugins)、[ARAMKit](https://aramkit.cn/zh-CN) 署名和根目录 MIT 许可。

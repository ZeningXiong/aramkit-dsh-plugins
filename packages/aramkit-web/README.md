# 海斗助手 · 独立网页版

一个在 Windows 本机运行的英雄联盟海克斯大乱斗助手。双击启动，在普通浏览器使用。查出装、海克斯和读取游戏数据不需要打开或安装 Codex、DSH，也不需要模型 API、账号登录或 npm 安装。

## 从 GitHub 源码启动

仓库不提交 Node 可执行文件、个人配置、密钥、比赛缓存或本机截图。源码使用者先安装 Node.js 22+ 并确保 `node` 在 PATH 中，然后在仓库根目录运行：

```powershell
node packages/aramkit-web/server.js
```

打开 `http://127.0.0.1:3210` 即可。也可双击 `海斗助手.vbs`，启动器会优先使用便携运行程序，再查找本机 Node。基础网页服务没有第三方运行依赖，无需执行 npm install。

## 平时怎么用

1. 双击桌面的「海斗助手」快捷方式，或完整文件夹中的 `海斗助手.vbs`。
2. 浏览器打开 `http://127.0.0.1:3210`。不要直接双击 `index.html`，它需要本地数据服务。
3. 左侧选择「英雄出装」「海克斯图鉴」「我的对局」或「隐藏分查询」。
4. 「我的对局」默认每 8 秒跟随客户端；匿名显示默认开启，队友隐藏分默认关闭。
5. 结束使用时可点击左下角「退出助手」。关闭浏览器不会关闭后台服务，重新双击会复用已运行的服务。

桌面快捷方式是独立浏览器入口，关闭 Codex 和 DSH 不影响使用。可以直接把网页放到副屏；界面支持窄窗口。它不是游戏内悬浮窗，也不会自动操作游戏。

## 可选：赛后 AI 锐评

在左侧点击「✦ 赛后锐评」，选择「配置 API」。填写：

1. **API 地址**：官方 OpenAI 使用 `https://api.openai.com/v1`；兼容服务填写服务商提供的 Base URL，不要填成具体的 `/responses` 路径。
2. **协议**：Codex/OpenAI 模型优先使用 Responses；仅支持 Chat Completions 的服务请选择对应协议。
3. **模型名称**：填写该密钥有权限使用的准确模型 ID。默认示例为 `gpt-6.1-sol`，不保证所有账户都能访问。
4. **API Key**：在本机网页的密码输入框填写，不要发到聊天里。保存设置不会调用模型。「校验连接」仅查询模型列表，不等于完成一次推理验证。

DeepSeek 等兼容服务选择 **Chat Completions**，填写服务商给出的 API Base URL、模型 ID 和该服务商的密钥即可。支持的是上述两种协议，不保证所有第三方模型都支持需要的 JSON 输出；测试通过的模拟响应不代表所有服务商均已实测。

对局结束后先读取完整五人结算，再点击「生成五人锐评」。可选毒舌、教练、数据复盘、抽象四种风格。结果包含全队总结、每人标签、0–100 分、数据依据和改进建议。基础出装、海克斯和比赛数据功能仍不需要任何 API。

- 手动触发，不会自动消费 API 额度；同一局同模型同风格结果缓存 30 分钟。重新生成会再次调用模型；失败不会自动重试。
- 模型调用按所选服务商的 API 账户额度与价格结算，不会复用本机 Codex 的登录凭据。
- 只发送匿名友方的英雄、KDA、伤害、经济、承伤、队友治疗、装备和海克斯，不发送真实昵称、Tag、账号 ID 或游戏令牌。即使比赛表格关闭匿名，AI 请求仍强制匿名。
- 勾选「记住密钥」后，使用 Windows DPAPI 加密保存在 `packages/aramkit-web/.local/ai-settings.json`，只有同一 Windows 账户能解密。取消勾选时密钥仅保留在本次运行内存中。
- 密钥不会回显给页面，不写入 localStorage，不进入命令行或日志。更换 API 地址必须重新填写对应密钥；HTTP 重定向不会携带密钥继续跳转。
- 支持官方 Responses JSON/SSE 结果及 Chat Completions 兼容返回。若服务商缺少结构化输出支持，可能无法生成；兼容性以真实调用为准。
- v0.2.1 补齐兼容模式下的五人 JSON 示例与标签约束。可在本地处理数字字符串、常见字段别名和唯一可确认的玩家名称；不会按数组位置猜测玩家归属。缺失的建议会明确标注，不伪造模型内容；真正的重复玩家、漏评和缺失评价正文仍会给出具体错误。
- 最近一局完整结算以匿名形式在本机保留最多 30 分钟，升级或重启后仍可读取并核对对局编号。旧版失败的模型返回没有保存，无法恢复已丢弃的评价原文；格式兼容处理本身不调用模型、不额外扣费。

官方参考：[Responses 文本生成](https://developers.openai.com/api/docs/guides/text)、[结构化输出](https://developers.openai.com/api/docs/guides/structured-outputs)、[API Key 身份验证与计费](https://learn.chatgpt.com/docs/auth)。

## 基础查询能力

- 173 位英雄（数量随上游更新）搜索、全分段/高分段切换。
- 多个出装流派、推荐装备顺序、出门装、鞋子和后续可选装备。
- 棱彩/黄金/白银推荐、展开更多、海克斯组合、技能优先级与召唤师技能。
- 海克斯名称、品质与效果检索。
- 自动连接 LeagueClient：选人时查看候选英雄和友方阵容；局内查看友方英雄、KDA、等级与补刀；结算查看伤害、经济、承伤、队友治疗和海克斯。
- 手动国服隐藏分查询。分数由 ARAMKit 估算，不是 Riot 官方 MMR。

这些基础查询由本地 Node 服务直接读取 ARAMKit 公共接口和本机游戏接口完成，没有调用 Codex、DSH、MCP 客户端或 AI 模型。基础查询无需支付模型费用；公开查询仍需要联网。客户端数据需要本机 LeagueClient 已启动并登录。

## 独立运行原理

完整独立版自带 `packages/aramkit-web/runtime/node.exe`，不会调用 Codex 安装目录中的程序。网页的 `server.js` 使用 Node 内置模块，没有第三方运行依赖。共享数据逻辑位于 `packages/aramkit-core` 和 `packages/aramkit-live`，这些目录是代码库，不需要安装对应 DSH 插件。

只监听 `127.0.0.1:3210`，仅本机浏览器可用，不开放到局域网或公网。游戏令牌仅用于本机连接，不发送到浏览器和远程服务器。队友隐藏分需要主动勾选，勾选时会把昵称和 Tag 发给 ARAMKit。其他游戏数据默认匿名。

独立版文件夹必须整体保留，不能只移动启动文件。可将整个文件夹搬到其他位置，然后重新创建快捷方式。已有 MCP 功能仍可单独使用，但不是独立网页的启动条件。

## 连接问题

先进入英雄联盟客户端大厅，而不只是打开 WeGame。点击右上角连接状态或左下角「连接设置」，可重新扫描，或者填写真实游戏目录中的 `LeagueClient\lockfile`。不要填写 Riot Client 的 lockfile。

若 3210 端口被其他程序占用，请查看 `.local/error.log`。若网页显示旧样式，按 Ctrl+F5 刷新。若要查询赛后数据，请保留客户端结算页；结算可能需要几秒同步海克斯。

## 开发与测试

源码目录可用 Node.js 22+ 直接执行：

```powershell
node packages/aramkit-web/server.js
node --test packages/aramkit-web/tests/*.test.js packages/aramkit-mcp/tests/*.test.js
```

已覆盖 HTTP 读接口、参数校验、跨站请求阻止、会话校验、只读 LCU、匿名化、模拟选人/结算，以及 MCP 兼容测试。开发源码里的独立运行程序位于被忽略的 `runtime/` 目录。

生成便携独立版（含运行程序，无需安装其他软件）：

打包前需自行准备官方 Windows x64 Node 22+ 的 `node.exe` 与对应许可证，分别放入 `packages/aramkit-web/runtime/node.exe` 和 `packages/aramkit-web/runtime/NODE-LICENSE.txt`。运行程序和便携包仅在本地构建，均不纳入 Git 提交。

```powershell
.\packages\aramkit-web\package-standalone.ps1 -Destination 'D:\海斗助手独立版'
```

依托 [ZeningXiong/aramkit-dsh-plugins](https://github.com/ZeningXiong/aramkit-dsh-plugins) 修改，保留 MIT 许可与 ARAMKit 署名。Node 许可位于 `runtime/NODE-LICENSE.txt`。本项目不是 Riot、腾讯或 ARAMKit 官方产品。

公开源码前可执行 `node scripts/check-publication.mjs --all --base origin/main`，检查全部 Git 跟踪文件及待贡献的提交历史，防止误包含运行数据、凭据、个人目录或未经审核的二进制文件。测试数据均为人工构造，不包含真实玩家资料。

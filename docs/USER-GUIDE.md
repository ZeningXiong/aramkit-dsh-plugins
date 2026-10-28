# 给使用者的安装说明

这份文档面向“只想用插件、不想改代码”的人。

## 先确认

你需要：

- Windows 10 / 11；
- 已安装 **DeepSeek Harness Desktop（DSH）**；
- 想用**在线版**的话，还需要同一台电脑上的 League 客户端；
- 想用 **AI 锐评**的话，DSH 里要配置好默认模型。

这不是一个独立的 `.exe`，也不是浏览器扩展，必须装在 DSH 里使用。

---

## 第一步：下载仓库

任选一种：

### 方式 A：GitHub Desktop（推荐）

1. 打开 GitHub Desktop；
2. **File → Clone repository**；
3. 选择仓库 `aramkit-dsh-plugins`；
4. 选一个固定目录，例如：

```text
D:\DSH\aramkit-dsh-plugins
```

### 方式 B：下载 ZIP

1. 打开 GitHub 仓库页面；
2. 点 **Code → Download ZIP**；
3. 解压到一个固定目录，例如：

```text
D:\DSH\aramkit-dsh-plugins
```

> 不要放在下载文件夹里，也不要安装后再移动目录。插件是通过本地路径链接到 DSH 的，移动后需要重新安装。

---

## 第二步：安装插件

打开 PowerShell 或终端，执行：

```powershell
# 隔离版：不连接游戏客户端
dsh plugin --profile desktop add "link:D:\DSH\aramkit-dsh-plugins\packages\aramkit-helper"

# 在线版：连接 LCU，自动选人 / 局内 / 结算
dsh plugin --profile desktop add "link:D:\DSH\aramkit-dsh-plugins\packages\aramkit-live"
```

把 `D:\DSH\aramkit-dsh-plugins` 换成你的实际路径。

### 如果提示 dsh 不是命令

说明 `dsh` 没有加入 PATH。可以：

1. 找到 DSH 安装目录里的 `dsh.exe`；
2. 用完整路径执行：

```powershell
& "C:\你的DSH安装目录\dsh.exe" plugin --profile desktop add "link:D:\DSH\aramkit-dsh-plugins\packages\aramkit-live"
```

### 如果提示 profile 不存在

`desktop` 是常见名称，但你的 DSH 可能叫别的。把 `--profile desktop` 换成你的实际 profile 名称。

---

## 第三步：刷新 DSH

安装完成后：

1. 重启 DSH，或刷新 DSH Web 页面；
2. 看左侧栏底部，会出现两个六边形图标：
   - **海斗助手隔离版**
   - **海斗助手在线版**

如果只看到一个，检查安装命令的输出是否有报错。

---

## 怎么用

### 隔离版

不需要 League 客户端。

1. 点 **海斗助手隔离版**；
2. 输入自己的 `昵称#Tag`，查队友隐藏分；
3. 搜索英雄，查看：
   - 出装顺序；
   - 召唤师技能；
   - 技能加点；
   - 海克斯（棱彩 / 黄金 / 白银各前 3，可展开前 15）；
   - 海克斯组合；
4. 英雄流派可以在 **暴击 / 战士 / 特效** 等之间切换，每个流派有独立的核心装备；
5. 全分段 / 高分段可以切换。

### 在线版

需要 League 客户端已启动并登录。

1. 点 **海斗助手在线版**；
2. 进入选人阶段后自动显示：
   - 本局可选英雄；
   - 胜率最高的 5 个；
   - 五名队友隐藏分；
   - 当前英雄推荐；
3. 进入游戏后，页面只显示 **你的英雄** 和你自己的推荐出装、召唤师技能、海克斯；
4. 对局结束后自动显示结算，并生成 AI 锐评；AI 可以在「AI 锐评设置」里关闭，关闭后只显示结算面板。

### WeGame 用户

WeGame 的 `LeagueClient\lockfile` 有时是 0 字节，这是正常的。在线版会自动从 `LeagueClientUx.log` 恢复连接。

如果连不上：

1. 确认 League 客户端已经登录；
2. 点「重试连接」或「自动扫描」；
3. 自动扫描里选标 `✓` 的路径；
4. 仍失败时，手动填有效的 `lockfile` 路径。

---

## AI 锐评

在线版的 AI 锐评使用 DSH 当前默认模型：

- 在 DSH 设置里配置默认模型；
- 对局结束后自动生成；
- 只评价友方五人；
- 标签为：尽力 / 犯罪 / 不团队；
- 在「AI 锐评设置」里可以关闭 AI：关闭后只显示结算面板，不消耗 Token；
- 可以选择毒舌 / 教练 / 抽象 / 数据复盘 / 自定义风格；
- 可以填写自定义语料、常用梗、禁用词或额外要求；
- 失败可以点「重新锐评」。

不配置模型也能用选人、出装、海克斯、隐藏分功能，只是没有 AI 锐评。

---

## 以后更新

### GitHub Desktop 克隆的

1. 打开 GitHub Desktop；
2. 选择仓库；
3. 点 **Fetch origin → Pull origin**；
4. 重启 DSH / 刷新页面。

### ZIP 下载的

重新下载 ZIP，覆盖原目录，然后重启 DSH。

---

## 不要分享这些

- `lockfile`
- `LeagueClientUx.log` / `debug.log`
- 带 token 的截图
- 队友名单和隐藏分截图（可选打码）

插件不会上传 LCU token，但日志里可能包含敏感信息。

---

## 常见问题

### 左侧栏没有图标

- 刷新页面；
- 重启 DSH；
- 检查安装命令输出；
- 在 DSH 插件管理器确认 bundle 已启用。

### 在线版显示未连接

- 确认 League 客户端已登录；
- 点「重试连接」；
- 点「自动扫描」选 `✓`；
- 参考上面的 WeGame 说明。

### 页面是英文

隔离版右上角有 `EN / 中文`，点「中文」。

### 出装 / 海克斯显示暂无数据

可能样本量不足。插件默认过滤海克斯少于 200 场、出装少于 500 场的样本。

更多细节见根目录 [README.md](../README.md)。

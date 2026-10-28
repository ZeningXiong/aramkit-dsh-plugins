# 用 GitHub Desktop 发布

这份文档按 GitHub Desktop 的实际操作顺序写，适合第一次发布本项目的人。

## 1. 确认目录

本项目已经整理成一个可直接发布的仓库目录：

```text
aramkit-dsh-plugins\
├─ README.md
├─ LICENSE
├─ .gitignore
├─ SECURITY.md
├─ CONTRIBUTING.md
├─ docs\
└─ packages\
   ├─ aramkit-helper\
   └─ aramkit-live\
```

不要直接把 `E:\dsh workspace` 整个目录发布，里面还有别的项目和临时文件。

## 2. 在 GitHub Desktop 中添加本地仓库

1. 打开 GitHub Desktop。
2. 菜单栏 **File → Add Local Repository...**。
3. 选择 `E:\dsh workspace\aramkit-dsh-plugins`。
4. 如果提示 “This directory does not appear to be a Git repository”，点 **create a repository**。
5. 在创建窗口里填写：
   - **Name**：`aramkit-dsh-plugins`
   - **Description**：`DeepSeek Harness 海斗助手：隔离版 + 在线版（LCU / AI 锐评）`
   - **Local path**：保持 `E:\dsh workspace`
   - **Initialize this repository with a README**：不要勾选（我们已经有 README）
   - **Git ignore**：`None`（我们已经有 `.gitignore`）
   - **License**：`None`（我们已经有 `LICENSE`）
6. 点 **Create Repository**。

## 3. 检查要提交的文件

GitHub Desktop 左侧会列出所有变更。确认：

- 包含 `README.md`、`LICENSE`、`.gitignore`、`docs/`、`packages/`；
- **不包含** `lockfile`、`*.log`、`node_modules`；
- 不包含任何 token、端口、密码、队友名单截图。

`.gitignore` 已经排除：

```text
node_modules/
*.log
lockfile
**/lockfile
```

如果仍然看到 `lockfile` 或日志文件，右键选择 **Ignore file**，或者确认 `.gitignore` 已生效。

## 4. 第一次提交

1. 左下角 **Summary** 填：

```text
Initial commit: ARAMKit DSH plugins
```

2. 可选 **Description**：

```text
海斗助手隔离版 + 在线版
- ARAMKit 隐藏分 / 出装 / 海克斯
- LCU 选人、局内五英雄推荐、结算 AI 锐评
```

3. 点 **Commit to main**。

## 5. 发布到 GitHub

1. 点右上角 **Publish repository**。
2. 填写：
   - **Name**：`aramkit-dsh-plugins`
   - **Description**：同上
   - **Keep this code private**：**取消勾选**（如果要公开）
3. 点 **Publish Repository**。

发布完成后，GitHub Desktop 会显示 **Fetch origin / Push origin** 等按钮。

## 6. 添加 Topics（推荐）

打开 GitHub 仓库页面 → 右侧齿轮 **Topics**，添加：

```text
league-of-legends
aramkit
deepseek-harness
dsh
lcu
aram-mayhem
```

## 7. 以后更新

1. 修改 `packages/...` 里的代码；
2. 更新对应的 `package.json` 版本号；
3. 在 GitHub Desktop 里查看 Changes；
4. 填写 Summary，例如：

```text
fix: keep in-game champion recommendations
```

5. **Commit to main**；
6. **Push origin**。

## 8. 发布 Release（可选）

GitHub Desktop 不直接管理 tag，如果需要 Release：

1. 打开仓库页面 → **Releases → Draft a new release**；
2. Tag 例如 `v1.0.11`；
3. 标题写“海斗助手 v1.0.11”；
4. 说明本次改动；
5. 发布。

## 9. 常见问题

### GitHub Desktop 提示文件太大

本项目不应该有大文件。检查是否误加了：

- `debug.log`（可能几百 MB）
- `lockfile`
- `node_modules`

从 Changes 中取消勾选，或加入 `.gitignore`。

### 已经创建过仓库

如果本地已经是 Git 仓库，第 2 步选择 **Add Local Repository** 后直接打开即可；如果远程仓库已存在，用 **Repository → Repository settings → Remote** 配置远程地址，然后 **Push origin**。

### 想改名

GitHub 仓库名可以在 **Settings → Repository name** 修改；本地目录名可以不改，不影响插件安装。

### 发布后别人怎么安装

见根目录 [README.md](../README.md) 的「安装」一节：

```bash
dsh plugin --profile desktop add "link:<仓库路径>\packages\aramkit-helper"
dsh plugin --profile desktop add "link:<仓库路径>\packages\aramkit-live"
```

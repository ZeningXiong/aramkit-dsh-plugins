# 发布 Release 给使用者

GitHub 的 **Releases** 适合放“下载包”，但 DSH 不能直接点一个 URL 就把插件装上。使用者仍然需要把 ZIP 解压到本地，然后从本地目录安装。

## 推荐做法

在 GitHub 仓库页面：

1. **Releases → Draft a new release**；
2. Tag 例如 `v1.0.11`；
3. 标题例如 `海斗助手 v1.0.11`；
4. 上传 `release/` 下这两个文件：
   - `aramkit-helper.zip`（隔离版）
   - `aramkit-live.zip`（在线版）
5. 写更新说明；
6. 发布。

这两个 ZIP 已经按插件根目录打包，解压后应直接看到 `package.json`、`index.js`、`client.js` 等文件。

## 使用者怎么装

### 如果 DSH 有本地安装入口

解压后，在 DSH 的插件管理器里选择“从本地目录安装”，分别选择：

```text
...\aramkit-helper
...\aramkit-live
```

### 如果通过 DSH 助手安装

把解压后的路径发给 DSH，例如：

```text
帮我安装本地 bundle：
D:\DSH\aramkit-helper
D:\DSH\aramkit-live
```

DSH 会调用插件管理器安装这两个 bundle。

### 如果使用命令行

```powershell
dsh plugin --profile desktop add "link:D:\DSH\aramkit-helper"
dsh plugin --profile desktop add "link:D:\DSH\aramkit-live"
```

## 稳定下载链接

如果 Release 资产名保持为 `aramkit-helper.zip` 和 `aramkit-live.zip`，可以使用：

```text
https://github.com/ZeningXiong/aramkit-dsh-plugins/releases/latest/download/aramkit-helper.zip
https://github.com/ZeningXiong/aramkit-dsh-plugins/releases/latest/download/aramkit-live.zip
```

## 为什么不用 GitHub Packages

GitHub Packages 可以发布 npm 包，但对普通使用者更麻烦：

1. 当前包名是 `@local/...`，需要改成你自己的 scope；
2. 需要去掉 `"private": true`；
3. GitHub Packages 的 npm registry 通常需要 GitHub Token / `.npmrc` 认证；
4. 两个插件是两个独立 bundle，需要分别发布；
5. 使用者还要配置 registry。

所以对这个项目，**Release ZIP + 本地安装** 更简单。

如果你以后想做到“一条命令安装”，可以把两个包发布到公共 npm registry，再提供：

```powershell
dsh plugin --profile desktop add <package-name>
```

但需要先确认你的 DSH 版本支持从 npm registry 安装，并处理包名、版本和 registry 配置。

## 注意

- 不要把 `release/` 提交进 Git；它已经在 `.gitignore` 里。
- Release 资产不要包含 `lockfile`、日志、`node_modules`。
- 解压后不要随意移动目录；DSH 安装的是本地路径链接。

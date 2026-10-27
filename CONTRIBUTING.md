# 贡献指南

感谢你愿意改进海斗助手。

## 提交前

1. 不要提交 `lockfile`、`*.log`、token、`node_modules`；
2. 不要提交个人 Riot ID 或队友名单截图；
3. 确认两个插件的 `package.json` 版本号已更新；
4. 确认 `client.js` 和 `index.js` 没有语法错误：

```bash
node --check packages/aramkit-helper/client.js
node --check packages/aramkit-helper/index.js
node --check packages/aramkit-live/client.js
node --check packages/aramkit-live/index.js
node --check packages/aramkit-live/data.js
node --check packages/aramkit-live/lcu.js
```

## 代码约定

- 只读 LCU，不修改客户端；
- 不把 LCU token 返回给浏览器或写入日志；
- 新功能优先放在 Host 路由里，Client 只渲染；
- 新增 UI 文案尽量同时提供中英文（隔离版已有 `ZH` / `EN` 字典）；
- 修改 AI prompt 时，保留“只评价友方、基于数据、不人身攻击”的约束。

## Pull Request

请说明：

- 改了什么；
- 为什么改；
- 是否影响 LCU 连接；
- 是否验证过选人 / 局内 / 结算；
- 截图（不要包含 token 和队友个人信息）。

## 版本

- 隔离版：`packages/aramkit-helper/package.json`
- 在线版：`packages/aramkit-live/package.json`

两个版本独立发版，互不依赖。

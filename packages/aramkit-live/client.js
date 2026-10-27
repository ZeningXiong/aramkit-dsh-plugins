window.__ModuleLoader__.load({
  id: '@local/aramkit-live',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const API = '/aramkit-live'
    const POSTGAME_PHASES = new Set(['PreEndOfGame', 'EndOfGame', 'WaitingForStats'])
    const FALLBACK =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#20242b"/><path d="M32 12 49 23v18L32 52 15 41V23z" fill="none" stroke="#5ee0cf" stroke-width="2"/></svg>',
      )

    const TEXT = {
      panelLabel: '海斗助手在线版',
      title: '海斗助手在线版',
      subtitle: '连接 League Client · 选人自动推荐 · 赛后 AI 锐评',
      disconnected: '未连接 LCU',
      connected: 'LCU 已连接',
      phase: '阶段',
      champSelect: '选人阶段',
      inGame: '对局进行中',
      postgame: '结算阶段',
      waiting: '等待数据',
      retry: '重试连接',
      refresh: '刷新',
      offlineTitle: '没有检测到英雄联盟客户端',
      offlineDesc: '请先启动 League 客户端并登录。WeGame 版路径不固定时，可以在下面直接指定 lockfile。',
      connectTitle: '手动指定 lockfile',
      connectHint: '在任务管理器找到 LeagueClientUx.exe → 右键“打开文件所在的位置”，该目录下通常有 lockfile。路径必须精确到 lockfile 文件。',
      lockfileHint: 'lockfile 必须是正在运行的 LeagueClientUx.exe 生成的非空文件（约几十字节）。0 字节说明客户端还没登录；Riot Client 的 lockfile 不能代替它。',
      lockfilePlaceholder: '例如 C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
      connectButton: '使用此路径连接',
      scanning: '扫描中…',
      scanButton: '自动扫描',
      foundPaths: '找到这些 lockfile',
      noPaths: '没有扫描到现成的 lockfile，请按上面的方法手动找。',
      processFound: '已检测到 LeagueClientUx.exe',
      processMissing: '没有检测到 LeagueClientUx.exe',
      logFound: '已从 LeagueClientUx.log 自动恢复端口和令牌',
      manualHint: 'WeGame 常见位置：C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
      saved: '已记住此路径，下次自动尝试。',
      noBench: '当前没有读到可选备选席，先确认你已经在选人界面。',
      top5: '胜率最高 5 个',
      allAvailable: '本局可选英雄',
      availableCount: '可选',
      winRate: '胜率',
      pickRate: '选取率',
      noChampion: '还没有选择英雄',
      teammates: '队友隐藏分',
      teamAvg: '队伍平均',
      you: '你',
      teammate: '队友',
      noRating: '未收录',
      inferred: '推算',
      performance: '表现分',
      current: '当前英雄',
      buildAndAugments: '自动推荐',
      builds: '出装顺序',
      starters: '出门装',
      core: '核心三件套',
      boots: '鞋子',
      later: '后续装备',
      summoners: '召唤师技能',
      augments: '海克斯',
      loading: '读取中…',
      recommendationError: '推荐数据读取失败',
      inGameTitle: '对局进行中',
      inGameDesc: '本局结束后会自动读取结算面板，无需手动操作。',
      inGameRoster: '本局阵容',
      inGameHint: '对局已开始 · 切出来也能看 5 个英雄的推荐',
      inGameSourceCache: '来自选人记录',
      inGameSourceLive: '来自实时对局',
      viewRecommendation: '推荐',
      postgameTitle: '本局结算',
      win: '胜利',
      loss: '失败',
      duration: '时长',
      ally: '友方',
      damage: '伤害',
      damageTaken: '承伤',
      gold: '经济',
      healing: '治疗',
      cc: '控制',
      vision: '视野',
      kda: 'KDA',
      aiReview: 'AI 锐评',
      aiLoading: 'AI 正在锐评这局友方五人…',
      aiError: 'AI 锐评失败',
      retryAi: '重新锐评',
      summary: '一句话总结',
      allAllies: '友方五人数据',
      score: '评分',
      verdict: '判定',
      source: '数据来源 ARAMKit · LCU 只读',
      noData: '暂无数据',
      waitingPostgame: '等待客户端生成结算数据…',
      gameId: '对局',
    }

    function pct(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return `${(value * 100).toFixed(1)}%`
    }

    function compact(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
      if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
      return String(Math.round(value))
    }

    function mmr(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return String(Math.round(value))
    }

    function time(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return '—'
      return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
    }

    function Img({ src, alt, size = 32, className = '', style = {} }) {
      return h('img', {
        src: src || FALLBACK,
        alt: alt || '',
        width: size,
        height: size,
        loading: 'lazy',
        decoding: 'async',
        referrerPolicy: 'no-referrer',
        className,
        style: { width: size, height: size, objectFit: 'cover', ...style },
        onError: (event) => {
          if (event.currentTarget.src !== FALLBACK) event.currentTarget.src = FALLBACK
        },
      })
    }

    function BrandMark({ size = 36 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true },
        h('defs', null,
          h('linearGradient', { id: 'ol-gold', x1: '0', y1: '0', x2: '1', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#f2d28c' }),
            h('stop', { offset: '100%', stopColor: '#b6873e' }),
          ),
        ),
        h('path', { d: 'M24 3 42 14v20L24 45 6 34V14Z', fill: '#111820', stroke: 'url(#ol-gold)', strokeWidth: '2.4' }),
        h('path', { d: 'M24 11 35 17.5v13L24 37 13 30.5v-13Z', fill: '#5ee0cf', opacity: '0.9' }),
        h('path', { d: 'M24 16.5v15M18.5 21.5l11 5M29.5 21.5l-11 5', stroke: '#081118', strokeWidth: '2', strokeLinecap: 'round' }),
        h('circle', { cx: '38', cy: '10', r: '4', fill: '#5ee0cf', stroke: '#10161d', strokeWidth: '1.5' }),
      )
    }

    function PanelIcon({ size = 20, active = false }) {
      return h(
        'span',
        { style: { width: size, height: size, display: 'inline-flex', color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)' } },
        h('svg', { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true },
          h('path', { d: 'M12 1.8 20.6 6.8v10.4L12 22.2 3.4 17.2V6.8Z', fill: active ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: '1.7', opacity: active ? 0.24 : 1 }),
          h('path', { d: 'M12 5.3 17 8.2v5.7L12 16.8 7 13.9V8.2Z', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }),
          h('circle', { cx: '17.5', cy: '5.5', r: '2', fill: 'currentColor' }),
        ),
      )
    }

    const CSS = `
.ol-page{
--dsw-alias-bg-base:#070b11;
--dsw-alias-bg-layer-1:#0f1620;
--dsw-alias-bg-layer-2:#17202b;
--dsw-alias-bg-overlay:#111923;
--dsw-alias-border-l1:rgba(255,255,255,.09);
--dsw-alias-border-l2:rgba(255,255,255,.17);
--dsw-alias-brand-primary:#5ee0cf;
--dsw-alias-label-primary:#f2f6fa;
--dsw-alias-label-secondary:#95a3b4;
--dsw-alias-state-idle-primary:#647184;
--dsw-alias-state-error-primary:#ff7373;
--dsw-alias-state-success-primary:#63d99d;
--dsw-alias-state-warn-primary:#eab55d;
color-scheme:dark;height:100%;min-height:100%;overflow:auto;box-sizing:border-box;padding:26px 30px 48px;color:var(--dsw-alias-label-primary);
background:radial-gradient(1200px 520px at 12% -10%,rgba(94,224,207,.10),transparent 65%),radial-gradient(900px 420px at 95% 0%,rgba(216,180,106,.07),transparent 70%),#070b11;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;scrollbar-color:#2a3644 transparent}
.ol-page *{box-sizing:border-box}
.ol-shell{width:100%;max-width:1240px;margin:0 auto}
.ol-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}
.ol-brand{display:flex;gap:13px;align-items:center;min-width:0}
.ol-title{margin:0;font-size:25px;line-height:1.18;letter-spacing:-.4px;font-weight:760}
.ol-sub{margin:6px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}
.ol-meta{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
.ol-pill{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:11px;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 85%,transparent);white-space:nowrap}
.ol-pill.ok{color:#63d99d;border-color:color-mix(in srgb,#63d99d 35%,var(--dsw-alias-border-l1))}
.ol-pill.bad{color:#ff8a8a;border-color:color-mix(in srgb,#ff8a8a 35%,var(--dsw-alias-border-l1))}
.ol-pill.gold{color:#d9b56a;border-color:color-mix(in srgb,#d9b56a 36%,var(--dsw-alias-border-l1))}
.ol-dot{width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block}
.ol-card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:16px;padding:16px}
.ol-section{margin-top:14px}
.ol-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}
.ol-section-head h2{margin:0;font-size:16px;letter-spacing:-.15px}
.ol-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ol-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:15px;padding:40px 22px;text-align:center;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 60%,transparent)}
.ol-empty strong{display:block;color:var(--dsw-alias-label-primary);font-size:16px;margin-bottom:7px}
.ol-empty p{margin:0 auto;max-width:600px;font-size:12px;line-height:1.7}
.ol-connect{margin-top:12px}
.ol-connect-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
.ol-input{flex:1;min-width:280px;height:36px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 11px;outline:none}
.ol-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ol-diag{margin-top:10px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:10px}
.ol-path{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:10px;padding:7px 8px;border-radius:7px;margin-top:5px;cursor:pointer;word-break:break-all}
.ol-path:hover{border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-base))}
.ol-path .ok{color:#63d99d;font-weight:700;flex:none}
.ol-path .bad{color:#ff8a8a;font-weight:700;flex:none}
.ol-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;font-weight:650;height:34px;padding:0 13px;border-radius:9px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.ol-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-2))}
.ol-btn.primary{background:var(--dsw-alias-brand-primary);color:#081216;border-color:transparent}
.ol-btn.primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 86%,#fff)}
.ol-btn:disabled{opacity:.55;cursor:default}
.ol-error{margin-top:10px;padding:9px 11px;border:1px solid color-mix(in srgb,#ff7373 40%,transparent);background:color-mix(in srgb,#ff7373 9%,transparent);color:#ff8a8a;border-radius:9px;font-size:12px;line-height:1.5}
.ol-champs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ol-champ{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:10px;padding:8px;min-width:0}
.ol-champ.top{border-color:color-mix(in srgb,#d9b56a 48%,var(--dsw-alias-border-l1));background:linear-gradient(135deg,color-mix(in srgb,#d9b56a 9%,var(--dsw-alias-bg-base)),var(--dsw-alias-bg-base))}
.ol-champ img{width:38px;height:38px;border-radius:8px;object-fit:cover;flex:none;border:1px solid var(--dsw-alias-border-l1)}
.ol-champ-info{min-width:0;flex:1}
.ol-champ-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-champ-title{font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-champ-rate{font-size:11px;font-weight:750;color:#e0b25c;white-space:nowrap}
.ol-champ-rank{font-size:9px;color:var(--dsw-alias-state-idle-primary);font-weight:800}
.ol-team{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.ol-player{display:flex;gap:8px;align-items:center;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:11px;padding:9px;min-width:0}
.ol-player.self{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1))}
.ol-player img{width:34px;height:34px;border-radius:8px;object-fit:cover;flex:none;border:1px solid var(--dsw-alias-border-l2)}
.ol-player-info{min-width:0;flex:1}
.ol-player-role{font-size:9px;font-weight:800;letter-spacing:.6px;color:var(--dsw-alias-label-secondary)}
.ol-player-name{font-size:11px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-player-mmr{font-size:17px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.ol-player-sub{font-size:9px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-live-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:13px}
.ol-reco{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:12px}
.ol-label{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:750;margin-bottom:6px}
.ol-items{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.ol-item{display:flex;flex-direction:column;align-items:center;gap:3px;width:50px;min-width:0}
.ol-item img{width:34px;height:34px;border-radius:8px;object-fit:cover;border:1px solid var(--dsw-alias-border-l1)}
.ol-item span{font-size:9px;color:var(--dsw-alias-label-secondary);max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ol-arrow{color:var(--dsw-alias-state-idle-primary);margin:0 -1px 12px}
.ol-spell{display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);margin-bottom:6px;font-size:11px}
.ol-spell img{width:26px;height:26px;border-radius:6px;object-fit:cover}
.ol-spell b{font-weight:650}
.ol-spell span{margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:10px}
.ol-aug-tabs{display:flex;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:8px;width:fit-content;margin-bottom:7px}
.ol-aug-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;font-weight:650;height:25px;padding:0 9px;border-radius:5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.ol-aug-tab.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary)}
.ol-rarity{width:6px;height:6px;border-radius:50%}
.ol-rarity.prismatic{background:#b98cff}.ol-rarity.gold{background:#e0b25c}.ol-rarity.silver{background:#aeb8c4}
.ol-aug{display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 50%,transparent)}
.ol-aug:last-child{border-bottom:0}
.ol-aug img{width:28px;height:28px;border-radius:6px;object-fit:cover;flex:none}
.ol-aug-info{min-width:0;flex:1}
.ol-aug-name{font-size:11px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-aug-sub{font-size:9px;color:var(--dsw-alias-label-secondary);margin-top:1px}
.ol-aug-win{font-size:11px;font-weight:750;color:var(--dsw-alias-label-primary)}
.ol-post-head{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;padding:16px 18px;background:linear-gradient(120deg,color-mix(in srgb,#63d99d 8%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1) 60%);margin-bottom:13px}
.ol-post-head.loss{background:linear-gradient(120deg,color-mix(in srgb,#ff7373 8%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1) 60%)}
.ol-post-title{font-size:22px;font-weight:800;letter-spacing:-.3px}
.ol-post-meta{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px}
.ol-post-score{font-size:30px;font-weight:850;letter-spacing:-1px}
.ol-table{width:100%;border-collapse:collapse;font-size:11px}
.ol-table th{text-align:left;font-size:9px;letter-spacing:.4px;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:750;padding:7px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.ol-table td{padding:8px 6px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 55%,transparent);white-space:nowrap}
.ol-table tr:last-child td{border-bottom:0}
.ol-table .ol-table-champ{display:flex;align-items:center;gap:7px}
.ol-table .ol-table-champ img{width:28px;height:28px;border-radius:6px;object-fit:cover}
.ol-table .ol-table-name{font-weight:650;max-width:150px;overflow:hidden;text-overflow:ellipsis}
.ol-table .ol-table-tag{font-size:9px;color:var(--dsw-alias-label-secondary)}
.ol-review{margin-top:13px}
.ol-ingame-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:4px}
.ol-ingame-tab{display:flex;align-items:center;gap:7px;text-align:left;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;padding:8px;border-radius:10px;cursor:pointer;min-width:0;transition:border-color .15s,background .15s}
.ol-ingame-tab:hover{border-color:var(--dsw-alias-border-l2)}
.ol-ingame-tab.active{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 60%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-base))}
.ol-ingame-tab img{width:32px;height:32px;border-radius:7px;object-fit:cover;flex:none;border:1px solid var(--dsw-alias-border-l1)}
.ol-ingame-tab-info{min-width:0}
.ol-ingame-tab-name{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-ingame-tab-player{font-size:9px;color:var(--dsw-alias-label-secondary);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-ingame-head{display:flex;align-items:center;gap:10px;margin-top:12px}
.ol-ingame-head img{width:42px;height:42px;border-radius:9px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2)}
.ol-ingame-head strong{font-size:16px}
.ol-ingame-head span{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ol-review-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.ol-review-head h2{margin:0;font-size:16px}
.ol-review-summary{border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent);border-radius:11px;padding:11px 13px;font-size:12px;line-height:1.7;margin-bottom:10px}
.ol-review-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.ol-review-card{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);padding:10px;min-width:0}
.ol-review-card .ol-verdict{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:5px;font-size:10px;font-weight:800;border:1px solid var(--dsw-alias-border-l1);margin-bottom:6px}
.ol-verdict.尽力{color:#63d99d;border-color:color-mix(in srgb,#63d99d 35%,transparent);background:color-mix(in srgb,#63d99d 10%,transparent)}
.ol-verdict.犯罪{color:#ff8a8a;border-color:color-mix(in srgb,#ff7373 38%,transparent);background:color-mix(in srgb,#ff7373 9%,transparent)}
.ol-verdict.不团队{color:#eab55d;border-color:color-mix(in srgb,#eab55d 35%,transparent);background:color-mix(in srgb,#eab55d 9%,transparent)}
.ol-verdict.中规中矩{color:#aeb8c4}
.ol-review-name{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ol-review-champ{font-size:9px;color:var(--dsw-alias-label-secondary);margin-top:1px}
.ol-review-title{font-size:11px;font-weight:750;margin-top:7px;line-height:1.45}
.ol-review-comment{font-size:10px;color:var(--dsw-alias-label-secondary);line-height:1.65;margin-top:5px}
.ol-review-score{font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:6px}
.ol-loading{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);padding:12px 0}
.ol-spinner{width:14px;height:14px;border:2px solid color-mix(in srgb,currentColor 25%,transparent);border-top-color:currentColor;border-radius:50%;animation:ol-spin .7s linear infinite}
@keyframes ol-spin{to{transform:rotate(360deg)}}
.ol-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:16px;line-height:1.6}
@media (max-width:1050px){.ol-live-grid,.ol-reco{grid-template-columns:1fr}.ol-team{grid-template-columns:repeat(3,minmax(0,1fr))}.ol-review-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ol-ingame-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:720px){.ol-page{padding:18px 14px 40px}.ol-header{flex-direction:column}.ol-team{grid-template-columns:repeat(2,minmax(0,1fr))}.ol-review-grid{grid-template-columns:1fr}.ol-ingame-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.ol-post-head{flex-direction:column;align-items:flex-start}.ol-table{font-size:10px}}
`

    function Styles() {
      return h('style', { 'data-aramkit-live': 'styles' }, CSS)
    }

    async function getJson(path, params) {
      const url = new URL(`${API}/${path}`, window.location.origin)
      for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value)
      const response = await fetch(url.toString(), { credentials: 'same-origin', headers: { accept: 'application/json' } })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.ok === false) throw new Error(body?.error || `HTTP ${response.status}`)
      return body
    }

    function TopChampion({ row, rank }) {
      return h(
        'div',
        { className: 'ol-champ top', title: `${row.name} · ${pct(row.winRate)}` },
        h('span', { className: 'ol-champ-rank' }, `#${rank}`),
        h(Img, { src: row.icon, alt: row.name, size: 38 }),
        h('div', { className: 'ol-champ-info' },
          h('div', { className: 'ol-champ-name' }, row.name),
          h('div', { className: 'ol-champ-title' }, row.title),
        ),
        h('span', { className: 'ol-champ-rate' }, pct(row.winRate)),
      )
    }

    function ChampCard({ row }) {
      return h(
        'div',
        { className: 'ol-champ', title: `${row.name} · ${pct(row.winRate)}` },
        h(Img, { src: row.icon, alt: row.name, size: 38 }),
        h('div', { className: 'ol-champ-info' },
          h('div', { className: 'ol-champ-name' }, row.name),
          h('div', { className: 'ol-champ-title' }, `${row.title} · ${row.source === 'mine' ? '当前' : '备选'}`),
        ),
        h('span', { className: 'ol-champ-rate' }, pct(row.winRate)),
      )
    }

    function PlayerCard({ row }) {
      return h(
        'div',
        { className: `ol-player${row.isSelf ? ' self' : ''}` },
        row.champion?.icon
          ? h(Img, { src: row.champion.icon, alt: row.champion.name, size: 34 })
          : h('div', { style: { width: 34, height: 34, borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2)', flex: 'none' } }),
        h('div', { className: 'ol-player-info' },
          h('div', { className: 'ol-player-role' }, row.isSelf ? TEXT.you : TEXT.teammate),
          h('div', { className: 'ol-player-name', title: `${row.gameName}#${row.tagLine}` }, row.gameName || '未知玩家'),
          h('div', { className: 'ol-player-mmr' }, row.rating ? mmr(row.rating.value) : '—'),
          h('div', { className: 'ol-player-sub' }, row.rating ? `${TEXT.performance} ${row.rating.performanceScore ?? '—'}${row.rating.ratingType === 1 ? ` · ${TEXT.inferred}` : ''}` : row.ratingError || TEXT.noRating),
        ),
      )
    }

    function Items({ items }) {
      return h('div', { className: 'ol-items' },
        (items || []).map((item, index) =>
          h('div', { className: 'ol-item', key: `${item.id}-${index}`, title: item.name },
            h(Img, { src: item.icon, alt: item.name, size: 34 }),
            h('span', null, item.name),
          ),
        ),
      )
    }

    function Recommendation({ data }) {
      const [rarity, setRarity] = useState('prismatic')
      if (!data) return null
      const build = data.builds?.[0]
      const starter = build?.starters?.[0]
      const boots = build?.boots?.[0]
      const augments = data.augments || {}
      const rows = (augments[rarity] || []).slice(0, 3)
      const labels = { prismatic: '棱彩', gold: '黄金', silver: '白银' }
      return h(
        'div',
        { className: 'ol-reco' },
        h('div', null,
          h('div', { className: 'ol-label' }, TEXT.builds),
          starter ? h('div', { style: { marginBottom: '7px' } },
            h('div', { className: 'ol-label' }, TEXT.starters),
            h(Items, { items: starter.items }),
          ) : null,
          build ? h('div', null,
            h('div', { className: 'ol-label' }, TEXT.core),
            h('div', { className: 'ol-items' },
              build.items.map((item, index) =>
                h(React.Fragment, { key: `${item.id}-${index}` },
                  h('div', { className: 'ol-item' }, h(Img, { src: item.icon, alt: item.name, size: 34 }), h('span', null, item.name)),
                  index < build.items.length - 1 ? h('span', { className: 'ol-arrow' }, '›') : null,
                ),
              ),
              boots ? h(React.Fragment, null,
                h('span', { className: 'ol-arrow' }, '·'),
                h('div', { className: 'ol-item' }, h(Img, { src: boots.item.icon, alt: boots.item.name, size: 34 }), h('span', null, boots.item.name)),
              ) : null,
            ),
          ) : null,
          build?.later?.length ? h('div', { style: { marginTop: '6px' } },
            h('div', { className: 'ol-label' }, TEXT.later),
            h(Items, { items: build.later.map((row) => row.item) }),
          ) : null,
        ),
        h('div', null,
          h('div', { className: 'ol-label' }, TEXT.summoners),
          (data.summoners || []).slice(0, 2).map((row, index) =>
            h('div', { className: 'ol-spell', key: index },
              row.spells.map((spell) => h(Img, { key: spell.id, src: spell.icon, alt: spell.name, size: 26 })),
              h('b', null, row.spells.map((spell) => spell.name).join(' + ')),
              h('span', null, pct(row.winRate)),
            ),
          ),
          h('div', { className: 'ol-label', style: { marginTop: '8px' } }, TEXT.augments),
          h('div', { className: 'ol-aug-tabs' },
            ['prismatic', 'gold', 'silver'].map((key) =>
              h('button', { key, type: 'button', className: `ol-aug-tab${rarity === key ? ' active' : ''}`, onClick: () => setRarity(key) },
                h('span', { className: `ol-rarity ${key}` }),
                labels[key],
              ),
            ),
          ),
          rows.length
            ? rows.map((row) => h('div', { className: 'ol-aug', key: row.id },
                h(Img, { src: row.icon, alt: row.name, size: 28 }),
                h('div', { className: 'ol-aug-info' },
                  h('div', { className: 'ol-aug-name', title: row.name }, row.name),
                  h('div', { className: 'ol-aug-sub' }, `${compact(row.sampleCount)}场`),
                ),
                h('span', { className: 'ol-aug-win' }, pct(row.winRate)),
              ))
            : h('div', { className: 'ol-hint' }, TEXT.noData),
        ),
      )
    }

    function ChampSelectView({ data }) {
      const [recommendation, setRecommendation] = useState(null)
      const [recLoading, setRecLoading] = useState(false)
      const [recError, setRecError] = useState('')
      const cache = useRef(new Map())
      const championId = data?.currentChampionId

      useEffect(() => {
        let alive = true
        if (!championId) {
          setRecommendation(null)
          return () => { alive = false }
        }
        setRecLoading(true)
        setRecError('')
        const load = async () => {
          try {
            if (cache.current.has(championId)) {
              if (alive) setRecommendation(cache.current.get(championId))
              return
            }
            const payload = await getJson('champion', { id: championId, dataset: 'all' })
            cache.current.set(championId, payload)
            if (alive) setRecommendation(payload)
          } catch (error) {
            if (alive) setRecError(error instanceof Error ? error.message : String(error))
          } finally {
            if (alive) setRecLoading(false)
          }
        }
        load()
        return () => { alive = false }
      }, [championId])

      if (!data) return null
      return h(
        'div',
        null,
        h('div', { className: 'ol-card' },
          h('div', { className: 'ol-section-head' },
            h('h2', null, TEXT.top5),
            h('span', { className: 'ol-hint' }, `${TEXT.availableCount} ${data.availableChampions?.length || 0} · ${TEXT.winRate}排序`),
          ),
          data.top5?.length
            ? h('div', { className: 'ol-champs' }, data.top5.map((row, index) => h(TopChampion, { key: row.id, row, rank: index + 1 })))
            : h('div', { className: 'ol-hint' }, TEXT.noBench),
          h('div', { className: 'ol-label', style: { marginTop: '12px' } }, TEXT.allAvailable),
          data.availableChampions?.length
            ? h('div', { className: 'ol-champs' }, data.availableChampions.map((row) => h(ChampCard, { key: row.id, row })))
            : h('div', { className: 'ol-hint' }, TEXT.noBench),
        ),
        h('div', { className: 'ol-section' },
          h('div', { className: 'ol-section-head' },
            h('h2', null, TEXT.teammates),
            h('span', { className: 'ol-hint' }, `${TEXT.teamAvg} ${mmr(data.teamAverageRating)}`),
          ),
          h('div', { className: 'ol-team' }, (data.team || []).map((row) => h(PlayerCard, { key: row.cellId, row }))),
        ),
        h('div', { className: 'ol-section' },
          h('div', { className: 'ol-section-head' },
            h('h2', null, TEXT.current),
            h('span', { className: 'ol-hint' }, data.currentChampion ? `${data.currentChampion.name} ${data.currentChampion.title}` : TEXT.noChampion),
          ),
          recError ? h('div', { className: 'ol-error' }, recError) : null,
          recLoading && !recommendation
            ? h('div', { className: 'ol-loading' }, h('span', { className: 'ol-spinner' }), TEXT.loading)
            : recommendation
              ? h(Recommendation, { data: recommendation })
              : h('div', { className: 'ol-empty' }, h('strong', null, TEXT.noChampion), h('p', null, '在客户端选择英雄后，这里会自动推荐出装、召唤师技能和海克斯。')),
        ),
      )
    }

    function InGameView({ data }) {
      const allies = data?.allies || []
      const [selected, setSelected] = useState(() => {
        const index = allies.findIndex((row) => row.isSelf)
        return index >= 0 ? index : 0
      })
      const [recommendation, setRecommendation] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const cache = useRef(new Map())
      const championId = allies[selected]?.championId
      const champion = allies[selected]?.champion

      useEffect(() => {
        let alive = true
        if (!championId) {
          setRecommendation(null)
          setError('')
          return () => { alive = false }
        }
        setLoading(true)
        setError('')
        setRecommendation(null)
        const load = async () => {
          try {
            if (cache.current.has(championId)) {
              if (alive) setRecommendation(cache.current.get(championId))
              return
            }
            const payload = await getJson('champion', { id: championId, dataset: 'all' })
            cache.current.set(championId, payload)
            if (alive) setRecommendation(payload)
          } catch (err) {
            if (alive) setError(err instanceof Error ? err.message : String(err))
          } finally {
            if (alive) setLoading(false)
          }
        }
        load()
        return () => { alive = false }
      }, [championId])

      return h(
        'div',
        null,
        h('div', { className: 'ol-card' },
          h('div', { className: 'ol-section-head' },
            h('h2', null, TEXT.inGameRoster),
            h('span', { className: 'ol-hint' }, `${TEXT.inGameHint} · ${data.source === 'live' ? TEXT.inGameSourceLive : TEXT.inGameSourceCache}`),
          ),
          allies.length
            ? h('div', { className: 'ol-ingame-tabs' },
                allies.map((row, index) =>
                  h('button', {
                    key: index,
                    type: 'button',
                    className: `ol-ingame-tab${selected === index ? ' active' : ''}`,
                    onClick: () => setSelected(index),
                  },
                    h(Img, { src: row.champion?.icon, alt: row.champion?.name, size: 32 }),
                    h('div', { className: 'ol-ingame-tab-info' },
                      h('div', { className: 'ol-ingame-tab-name' }, row.champion?.title || row.champion?.name || '未知英雄'),
                      h('div', { className: 'ol-ingame-tab-player' }, row.isSelf ? TEXT.you : (row.gameName || TEXT.teammate)),
                    ),
                  ),
                ),
              )
            : h('div', { className: 'ol-hint' }, '还没有读到本局英雄，等待客户端数据…'),
        ),
        champion
          ? h('div', { className: 'ol-section' },
              h('div', { className: 'ol-card' },
                h('div', { className: 'ol-section-head' },
                  h('h2', null, TEXT.viewRecommendation),
                  h('span', { className: 'ol-hint' }, `${champion.name} ${champion.title}`),
                ),
                h('div', { className: 'ol-ingame-head' },
                  h(Img, { src: champion.icon, alt: champion.name, size: 42 }),
                  h('div', null,
                    h('strong', null, champion.name),
                    h('span', null, ` ${champion.title}`),
                  ),
                ),
                error ? h('div', { className: 'ol-error' }, `${TEXT.recommendationError}：${error}`) : null,
                loading && !recommendation
                  ? h('div', { className: 'ol-loading' }, h('span', { className: 'ol-spinner' }), TEXT.loading)
                  : recommendation
                    ? h('div', { style: { marginTop: '10px' } }, h(Recommendation, { data: recommendation }))
                    : null,
              ),
            )
          : null,
      )
    }

    function PostgameView({ data }) {
      const [review, setReview] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const attempted = useRef(null)

      const loadReview = useCallback(async (force = false) => {
        if (!data?.gameId) return
        if (!force && attempted.current === data.gameId) return
        attempted.current = data.gameId
        setLoading(true)
        setError('')
        try {
          const payload = await getJson('review', { gameId: data.gameId })
          setReview(payload.review)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setLoading(false)
        }
      }, [data?.gameId])

      useEffect(() => {
        if (data?.gameId) loadReview()
      }, [data?.gameId, loadReview])

      if (!data) return null
      return h(
        'div',
        null,
        h('div', { className: `ol-post-head${data.win ? '' : ' loss'}` },
          h('div', null,
            h('div', { className: 'ol-post-title' }, data.win ? TEXT.win : TEXT.loss),
            h('div', { className: 'ol-post-meta' }, `${TEXT.duration} ${time(data.gameLength)} · ${TEXT.gameId} ${data.gameId} · ${data.gameMode}`),
          ),
          h('div', { className: 'ol-post-score' }, data.win ? 'W' : 'L'),
        ),
        h('div', { className: 'ol-card' },
          h('div', { className: 'ol-section-head' }, h('h2', null, TEXT.allAllies)),
          h('div', { style: { overflowX: 'auto' } },
            h('table', { className: 'ol-table' },
              h('thead', null,
                h('tr', null,
                  h('th', null, '英雄'),
                  h('th', null, TEXT.kda),
                  h('th', null, TEXT.damage),
                  h('th', null, TEXT.damageTaken),
                  h('th', null, TEXT.gold),
                  h('th', null, TEXT.healing),
                  h('th', null, TEXT.cc),
                  h('th', null, TEXT.vision),
                ),
              ),
              h('tbody', null,
                data.allies.map((row, index) =>
                  h('tr', { key: index },
                    h('td', null,
                      h('div', { className: 'ol-table-champ' },
                        h(Img, { src: row.champion.icon, alt: row.champion.name, size: 28 }),
                        h('div', null,
                          h('div', { className: 'ol-table-name' }, row.champion.name),
                          h('div', { className: 'ol-table-tag' }, row.gameName || '未知玩家'),
                        ),
                      ),
                    ),
                    h('td', null, `${row.kills}/${row.deaths}/${row.assists}`),
                    h('td', null, compact(row.damage)),
                    h('td', null, compact(row.damageTaken)),
                    h('td', null, compact(row.gold)),
                    h('td', null, compact(row.healing)),
                    h('td', null, `${Math.round(row.cc)}s`),
                    h('td', null, Math.round(row.vision)),
                  ),
                ),
              ),
            ),
          ),
        ),
        h('div', { className: 'ol-review' },
          h('div', { className: 'ol-review-head' },
            h('h2', null, TEXT.aiReview),
            h('button', { type: 'button', className: 'ol-btn', onClick: () => loadReview(true), disabled: loading }, loading ? TEXT.loading : TEXT.retryAi),
          ),
          loading ? h('div', { className: 'ol-loading' }, h('span', { className: 'ol-spinner' }), TEXT.aiLoading) : null,
          error ? h('div', { className: 'ol-error' }, `${TEXT.aiError}：${error}`) : null,
          review ? h('div', null,
            review.summary ? h('div', { className: 'ol-review-summary' }, review.summary) : null,
            h('div', { className: 'ol-review-grid' },
              (review.players || []).map((row, index) =>
                h('div', { className: 'ol-review-card', key: index },
                  h('span', { className: `ol-verdict ${row.verdict || ''}` }, row.verdict || TEXT.verdict),
                  h('div', { className: 'ol-review-name' }, row.name || '—'),
                  h('div', { className: 'ol-review-champ' }, row.champion || ''),
                  row.title ? h('div', { className: 'ol-review-title' }, row.title) : null,
                  row.comment ? h('div', { className: 'ol-review-comment' }, row.comment) : null,
                  Number.isFinite(Number(row.score)) ? h('div', { className: 'ol-review-score' }, `${TEXT.score} ${row.score}`) : null,
                ),
              ),
            ),
            review.raw && (!review.players || !review.players.length) ? h('div', { className: 'ol-review-summary' }, review.raw) : null,
            review.model ? h('div', { className: 'ol-hint', style: { marginTop: '8px' } }, review.model) : null,
          ) : null,
        ),
      )
    }

    function Page() {
      const [state, setState] = useState(null)
      const [error, setError] = useState('')
      const [refreshing, setRefreshing] = useState(false)
      const [lockfilePath, setLockfilePath] = useState(() => {
        try {
          return localStorage.getItem('aramkit.liveLockfile') || ''
        } catch {
          return ''
        }
      })
      const [diagnostic, setDiagnostic] = useState(null)
      const [connectError, setConnectError] = useState('')
      const [connecting, setConnecting] = useState(false)
      const autoTried = useRef(false)
      const alive = useRef(true)

      const poll = useCallback(async (force = false) => {
        try {
          const payload = await getJson('state', force ? { reconnect: 1 } : {})
          if (!alive.current) return
          setState(payload)
          setError('')
        } catch (err) {
          if (alive.current) setError(err instanceof Error ? err.message : String(err))
        } finally {
          if (alive.current) setRefreshing(false)
        }
      }, [])

      const connect = useCallback(async (path) => {
        const target = String(path ?? lockfilePath ?? '').trim()
        if (!target) {
          setConnectError('请先填写 lockfile 的完整路径')
          return
        }
        setConnecting(true)
        setConnectError('')
        try {
          await getJson('connect', { path: target })
          try {
            localStorage.setItem('aramkit.liveLockfile', target)
          } catch {}
          await poll(true)
        } catch (err) {
          setConnectError(err instanceof Error ? err.message : String(err))
        } finally {
          setConnecting(false)
        }
      }, [lockfilePath, poll])

      const diagnose = useCallback(async () => {
        setConnectError('')
        try {
          setDiagnostic(await getJson('diagnose'))
        } catch (err) {
          setConnectError(err instanceof Error ? err.message : String(err))
        }
      }, [])

      useEffect(() => {
        if (autoTried.current) return
        autoTried.current = true
        let saved = ''
        try {
          saved = localStorage.getItem('aramkit.liveLockfile') || ''
        } catch {}
        if (saved) {
          setLockfilePath(saved)
          connect(saved)
        }
      }, [connect])

      useEffect(() => {
        alive.current = true
        let timer = null
        const tick = async (force = false) => {
          await poll(force)
          if (!alive.current) return
          const delay = state?.connected === false ? 3000 : 1100
          timer = setTimeout(() => tick(false), delay)
        }
        tick(false)
        return () => {
          alive.current = false
          if (timer) clearTimeout(timer)
        }
      }, [poll])

      const phase = state?.phase || ''
      const status = state?.connected
        ? state?.inGame
          ? TEXT.inGame
          : state?.postgame
            ? TEXT.postgame
            : phase === 'ChampSelect'
              ? TEXT.champSelect
              : POSTGAME_PHASES.has(phase)
                ? TEXT.postgame
                : phase === 'InProgress'
                  ? TEXT.inGame
                  : !phase || phase === 'None' || phase === 'Lobby'
                    ? TEXT.waiting
                    : phase
        : TEXT.disconnected

      return h(
        'div',
        { className: 'ol-page' },
        h(Styles),
        h('div', { className: 'ol-shell' },
          h('header', { className: 'ol-header' },
            h('div', { className: 'ol-brand' },
              h(BrandMark, { size: 42 }),
              h('div', null,
                h('h1', { className: 'ol-title' }, TEXT.title),
                h('p', { className: 'ol-sub' }, TEXT.subtitle),
              ),
            ),
            h('div', { className: 'ol-meta' },
              h('span', { className: `ol-pill ${state?.connected ? 'ok' : 'bad'}` }, h('span', { className: 'ol-dot' }), status),
              state?.champSelect ? h('span', { className: 'ol-pill gold' }, `版本 ${state.champSelect.version}`) : null,
              h('button', { type: 'button', className: 'ol-btn', onClick: () => { setRefreshing(true); poll(true) }, disabled: refreshing }, refreshing ? TEXT.loading : TEXT.retry),
            ),
          ),
          error ? h('div', { className: 'ol-error' }, error) : null,
          state?.connected === false
            ? h('div', null,
                h('div', { className: 'ol-empty' },
                  h('strong', null, TEXT.offlineTitle),
                  h('p', null, TEXT.offlineDesc),
                ),
                h('div', { className: 'ol-card ol-connect' },
                  h('div', { className: 'ol-section-head' },
                    h('h2', null, TEXT.connectTitle),
                    h('span', { className: 'ol-hint' }, TEXT.processMissing),
                  ),
                  h('p', { className: 'ol-hint', style: { margin: '0 0 4px', lineHeight: 1.6 } }, TEXT.connectHint),
                  h('p', { className: 'ol-hint', style: { margin: '0 0 4px', lineHeight: 1.6 } }, TEXT.lockfileHint),
                  h('div', { className: 'ol-connect-row' },
                    h('input', {
                      className: 'ol-input',
                      value: lockfilePath,
                      placeholder: TEXT.lockfilePlaceholder,
                      spellCheck: false,
                      onChange: (event) => setLockfilePath(event.target.value),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' && !connecting) connect()
                      },
                    }),
                    h('button', { type: 'button', className: 'ol-btn primary', onClick: () => connect(), disabled: connecting }, connecting ? TEXT.loading : TEXT.connectButton),
                    h('button', { type: 'button', className: 'ol-btn', onClick: diagnose }, TEXT.scanButton),
                  ),
                  connectError ? h('div', { className: 'ol-error' }, connectError) : null,
                  diagnostic
                    ? h('div', { className: 'ol-diag' },
                        h('div', { className: 'ol-hint' },
                          diagnostic.log?.found ? TEXT.logFound : diagnostic.process?.found ? TEXT.processFound : TEXT.processMissing,
                          diagnostic.active?.file ? ` · 当前：${diagnostic.active.file}` : '',
                        ),
                        (diagnostic.candidates || []).filter((row) => row.exists).length
                          ? h('div', null,
                              h('div', { className: 'ol-label', style: { marginTop: '8px' } }, TEXT.foundPaths),
                              (diagnostic.candidates || []).filter((row) => row.exists).map((row) =>
                                h('button', {
                                  key: row.path,
                                  type: 'button',
                                  className: 'ol-path',
                                  onClick: () => { setLockfilePath(row.path); connect(row.path) },
                                },
                                  h('span', { className: row.valid ? 'ok' : 'bad' }, row.valid ? '✓' : '!'),
                                  h('span', null,
                                    h('div', null, row.path),
                                    !row.valid && row.reason ? h('div', { className: 'ol-hint', style: { marginTop: '3px' } }, row.reason) : null,
                                  ),
                                ),
                              ),
                            )
                          : h('div', { className: 'ol-hint', style: { marginTop: '8px' } }, TEXT.noPaths),
                      )
                    : null,
                  h('div', { className: 'ol-hint', style: { marginTop: '8px' } }, TEXT.manualHint),
                ),
              )
            : state?.inGame
              ? h(InGameView, { data: state.inGame })
              : state?.champSelect
                ? h(ChampSelectView, { data: state.champSelect })
                : state?.postgame
                  ? h(PostgameView, { data: state.postgame })
                  : state?.waiting
                    ? h('div', { className: 'ol-empty' }, h('strong', null, TEXT.waiting), h('p', null, TEXT.waitingPostgame))
                    : h('div', { className: 'ol-empty' },
                        h('strong', null, phase === 'InProgress' ? TEXT.inGameTitle : TEXT.waiting),
                        h('p', null, phase === 'InProgress' ? TEXT.inGameDesc : '进入选人阶段后，这里会自动显示可选英雄、队友隐藏分与当前英雄推荐。'),
                      ),
          h('div', { className: 'ol-foot' }, h('span', null, TEXT.source), h('span', null, 'LCU 数据仅在本机读取，不上传。')),
        ),
      )
    }

    function apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'aramkit-live',
            order: 31,
            label: () => TEXT.panelLabel,
          },
          PanelIcon,
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          { name: 'main', key: 'aramkit-live' },
          Page,
        ),
      )
    }

    return { inject: ['slots'], apply }
  },
})

window.__ModuleLoader__.load({
  id: '@local/aramkit-helper',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'aramkit-helper'
    const API = '/aramkit-api'
    const AUGMENT_RARITIES = [
      { key: 'prismatic', labelKey: 'rarityPrismatic' },
      { key: 'gold', labelKey: 'rarityGold' },
      { key: 'silver', labelKey: 'raritySilver' },
    ]
    const ASSET_FALLBACK =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#20242b"/><path d="M32 12 49 23v18L32 52 15 41V23z" fill="none" stroke="#d8b46a" stroke-width="2"/></svg>',
      )

    const ZH = {
      panelLabel: '海斗助手隔离版',
      title: '海斗助手隔离版',
      subtitle: '隔离版 · 队友隐藏分、英雄出装与海克斯推荐',
      source: '数据来源 ARAMKit',
      teamTab: '队伍隐藏分',
      championTab: '英雄推荐',
      teamHeroTitle: '看看这局谁是大腿',
      teamHeroDesc: '输入你的「昵称#Tag」，读取最近一局海斗的同队五人隐藏分。也可以展开手动查询，逐个查当前队友。',
      riotIdPlaceholder: '你的昵称#Tag',
      queryMyTeam: '查询我的队伍',
      querying: '查询中…',
      manualToggle: '手动查询队友',
      manualHint: '最多 5 人，留空的行会被忽略。',
      queryAll: '查询全部',
      clear: '清空',
      latestMatch: '最近一局',
      teamAvg: '队伍平均',
      win: '胜',
      loss: '负',
      you: '你',
      teammate: '队友',
      hiddenRating: '隐藏分',
      performance: '表现分',
      inferred: '推算分',
      noRating: '未收录',
      matchKda: '本局 KDA',
      noTeamTitle: '还没有查询记录',
      noTeamDesc: '查询后会在这里显示同队五人的隐藏分与最近一局表现。',
      manualTitle: '手动查询结果',
      player: '玩家',
      notFound: '未找到该玩家',
      championTitle: '选一个英雄，直接看答案',
      championDesc: '出装顺序、召唤师技能、技能加点，以及阶段 1–4 各自前三名的海克斯。',
      searchChampion: '搜索英雄：名称 / 称号 / 拼音',
      noChampion: '没有匹配的英雄',
      pickChampion: '选择英雄',
      builds: '出装顺序',
      starters: '出门装',
      core: '核心三件套',
      boots: '鞋子',
      later: '后续装备',
      alternatives: '备选核心',
      summoners: '召唤师技能',
      skills: '技能加点',
      augments: '海克斯推荐',
      augmentHint: '按品质 · 默认前 3，展开看前 15',
      augmentCombo: '海克斯组合',
      top3Short: '前 3 名',
      top15Short: '前 15 名',
      expandTop15: '展开该品质前 15 名',
      collapse: '收起',
      stage: '阶段',
      top3: '前三名',
      winRate: '胜率',
      pickRate: '选取率',
      sample: '场',
      games: '场',
      loading: '正在从 ARAMKit 读取数据…',
      loadError: '数据读取失败',
      retry: '重试',
      disclaimer: '隐藏分为 ARAMKit 根据对局推算，仅供参考；组队会影响准确性。',
      version: '版本',
      datasetLabel: '数据范围',
      allBracket: '全分段',
      highBracket: '高分段',
      updated: '更新',
      filtered: '已过滤低样本',
      rarityPrismatic: '棱彩',
      rarityGold: '黄金',
      raritySilver: '白银',
      noData: '暂无足够样本',
      selectHint: '从上方搜索框选择英雄，或点击热门英雄。',
      popular: '热门英雄',
      refresh: '刷新数据',
      errorPrefix: '出错了：',
      invalidRiotId: '请输入「昵称#Tag」格式',
    }

    const EN = {
      panelLabel: 'ARAM Helper (Isolated)',
      title: 'ARAM Helper (Isolated)',
      subtitle: 'Isolated edition · teammate MMR, builds and augment picks',
      source: 'Data from ARAMKit',
      teamTab: 'Team MMR',
      championTab: 'Champion',
      teamHeroTitle: 'Who is carrying this lobby?',
      teamHeroDesc: 'Enter your Riot ID and read the hidden MMR of all five players in your latest ARAM Mayhem match.',
      riotIdPlaceholder: 'YourName#Tag',
      queryMyTeam: 'Read my team',
      querying: 'Loading…',
      manualToggle: 'Query teammates manually',
      manualHint: 'Up to five players; empty rows are ignored.',
      queryAll: 'Query all',
      clear: 'Clear',
      latestMatch: 'Latest match',
      teamAvg: 'Team average',
      win: 'Win',
      loss: 'Loss',
      you: 'You',
      teammate: 'Ally',
      hiddenRating: 'Hidden MMR',
      performance: 'Performance',
      inferred: 'Estimated',
      noRating: 'No data',
      matchKda: 'Match KDA',
      noTeamTitle: 'No lookup yet',
      noTeamDesc: 'Your team’s hidden MMR and latest match performance will appear here.',
      manualTitle: 'Manual results',
      player: 'Player',
      notFound: 'Player not found',
      championTitle: 'Pick a champion, get the answer',
      championDesc: 'Item path, summoner spells, skill order, and the top three augments for each stage.',
      searchChampion: 'Search champion: name / title / alias',
      noChampion: 'No champion found',
      pickChampion: 'Pick a champion',
      builds: 'Item path',
      starters: 'Starting items',
      core: 'Core three',
      boots: 'Boots',
      later: 'Follow-up',
      alternatives: 'Alternative cores',
      summoners: 'Summoner spells',
      skills: 'Skill order',
      augments: 'Augments',
      augmentHint: 'By rarity · top 3, expand for top 15',
      augmentCombo: 'Augment pairs',
      top3Short: 'Top 3',
      top15Short: 'Top 15',
      expandTop15: 'Show the top 15 of this rarity',
      collapse: 'Collapse',
      stage: 'Stage',
      top3: 'Top 3',
      winRate: 'Win rate',
      pickRate: 'Pick rate',
      sample: 'games',
      games: 'games',
      loading: 'Reading ARAMKit data…',
      loadError: 'Could not load data',
      retry: 'Retry',
      disclaimer: 'MMR is estimated by ARAMKit from match history and is informational only.',
      version: 'Patch',
      datasetLabel: 'Data bracket',
      allBracket: 'All ranks',
      highBracket: 'High MMR',
      updated: 'Updated',
      filtered: 'Low-sample rows filtered',
      rarityPrismatic: 'Prismatic',
      rarityGold: 'Gold',
      raritySilver: 'Silver',
      noData: 'Not enough sample',
      selectHint: 'Search above or pick a popular champion.',
      popular: 'Popular',
      refresh: 'Refresh',
      errorPrefix: 'Error: ',
      invalidRiotId: 'Use the Name#Tag format',
    }

    const LANG_KEY = 'aramkit.lang'

    function readUiLang() {
      try {
        const saved = localStorage.getItem(LANG_KEY)
        if (saved === 'zh' || saved === 'en') return saved
      } catch {}
      return 'zh'
    }

    let uiLang = readUiLang()

    function dictFor(lang) {
      return lang === 'en' ? EN : ZH
    }

    function translate(key) {
      return dictFor(uiLang)[key] ?? (ZH[key] ?? key)
    }

    function parseRiotId(value) {      const text = String(value || '').trim()
      const index = text.lastIndexOf('#')
      if (index <= 0) return null
      const gameName = text.slice(0, index).trim()
      const tagLine = text.slice(index + 1).trim()
      return gameName && tagLine ? { gameName, tagLine } : null
    }

    function pct(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return `${(value * 100).toFixed(1)}%`
    }

    function compactNumber(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
      if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
      return String(Math.round(value))
    }

    function mmr(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      return String(Math.round(value))
    }

    function timeText(value, locale) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date)
    }

    function isWin(result) {
      return result === 0 || result === 2 || result === 4
    }

    async function getJson(path, params) {
      const url = new URL(`${API}/${path}`, window.location.origin)
      for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value)
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || `HTTP ${response.status}`)
      }
      return body
    }

    function Img(props) {
      const { src, alt, size = 32, className = '', style = {}, ...rest } = props
      return h('img', {
        src: src || ASSET_FALLBACK,
        alt: alt || '',
        width: size,
        height: size,
        loading: 'lazy',
        decoding: 'async',
        referrerPolicy: 'no-referrer',
        className,
        style: { width: size, height: size, objectFit: 'cover', ...style },
        onError: (event) => {
          if (event.currentTarget.src !== ASSET_FALLBACK) event.currentTarget.src = ASSET_FALLBACK
        },
        ...rest,
      })
    }

    function BrandMark({ size = 36 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 48 48', 'aria-hidden': true, className: 'ak-mark' },
        h('defs', null,
          h('linearGradient', { id: 'ak-gold', x1: '0', y1: '0', x2: '1', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#f2d28c' }),
            h('stop', { offset: '100%', stopColor: '#b6873e' }),
          ),
          h('linearGradient', { id: 'ak-blue', x1: '0', y1: '0', x2: '1', y2: '1' },
            h('stop', { offset: '0%', stopColor: '#4fe3d0' }),
            h('stop', { offset: '100%', stopColor: '#137f9e' }),
          ),
        ),
        h('path', { d: 'M24 3 42 14v20L24 45 6 34V14Z', fill: '#111820', stroke: 'url(#ak-gold)', strokeWidth: '2.4' }),
        h('path', { d: 'M24 11 35 17.5v13L24 37 13 30.5v-13Z', fill: 'url(#ak-blue)', opacity: '0.95' }),
        h('path', { d: 'M24 16.5 24 31.5M18.5 21.5 29.5 26.5M29.5 21.5 18.5 26.5', stroke: '#081118', strokeWidth: '2', strokeLinecap: 'round' }),
      )
    }

    function PanelIcon({ size = 20, active = false }) {
      return h(
        'span',
        {
          className: `ak-panel-icon${active ? ' is-active' : ''}`,
          style: { width: size, height: size, display: 'inline-flex' },
        },
        h(
          'svg',
          { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true },
          h('path', {
            d: 'M12 1.8 20.6 6.8v10.4L12 22.2 3.4 17.2V6.8Z',
            fill: active ? 'currentColor' : 'none',
            stroke: 'currentColor',
            strokeWidth: '1.7',
            opacity: active ? 0.26 : 1,
          }),
          h('path', {
            d: 'M12 5.3 17 8.2v5.7L12 16.8 7 13.9V8.2Z',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: '1.5',
          }),
          h('path', { d: 'M12 8v4.5M9.6 10.2h4.8', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }),
        ),
      )
    }

    const CSS = `
.ak-page{
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
color-scheme:dark;
height:100%;min-height:100%;overflow:auto;box-sizing:border-box;padding:26px 30px 48px;color:var(--dsw-alias-label-primary);background:
radial-gradient(1200px 520px at 12% -10%, rgba(94,224,207,.10), transparent 65%),
radial-gradient(900px 420px at 95% 0%, rgba(216,180,106,.07), transparent 70%),
#070b11;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;scrollbar-color:#2a3644 transparent;}
.ak-page *{box-sizing:border-box}
.ak-shell{width:100%;max-width:1180px;margin:0 auto}
.ak-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}
.ak-brand{display:flex;gap:14px;align-items:center;min-width:0}
.ak-mark{flex:none;filter:drop-shadow(0 6px 18px rgba(80,210,220,.18))}
.ak-title{margin:0;font-size:25px;line-height:1.18;letter-spacing:-.4px;font-weight:760}
.ak-subtitle{margin:6px 0 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.ak-meta{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}
.ak-pill{display:inline-flex;align-items:center;gap:5px;height:25px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:11px;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 85%, transparent);white-space:nowrap}
.ak-pill.gold{color:#d9b56a;border-color:color-mix(in srgb,#d9b56a 36%,var(--dsw-alias-border-l1))}
.ak-lang{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:700;height:25px;padding:0 9px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s,background .15s}
.ak-lang:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
.ak-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;width:fit-content;margin-bottom:18px}
.ak-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:600;padding:8px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:7px;transition:background .15s,color .15s}
.ak-tab:hover{color:var(--dsw-alias-label-primary)}
.ak-tab.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}
.ak-hero{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;padding:22px 24px;background:linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1) 62%);overflow:hidden}
.ak-hero:after{content:"";position:absolute;right:-90px;top:-110px;width:320px;height:320px;border-radius:50%;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);box-shadow:0 0 0 40px color-mix(in srgb,var(--dsw-alias-brand-primary) 4%,transparent),0 0 0 88px color-mix(in srgb,var(--dsw-alias-brand-primary) 3%,transparent);pointer-events:none}
.ak-hero h2{margin:0 0 7px;font-size:20px;letter-spacing:-.2px}
.ak-hero p{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.6;max-width:640px}
.ak-query{display:flex;gap:9px;margin-top:17px;position:relative;z-index:1;flex-wrap:wrap}
.ak-input{height:40px;min-width:0;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s}
.ak-input:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}
.ak-input::placeholder{color:var(--dsw-alias-state-idle-primary)}
.ak-query .ak-input{flex:1;max-width:420px}
.ak-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;height:40px;padding:0 16px;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:transform .12s,background .15s,border-color .15s}
.ak-btn:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-2))}
.ak-btn:active{transform:translateY(1px)}
.ak-btn:disabled{opacity:.55;cursor:default;transform:none}
.ak-btn.primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#081216}
.ak-btn.primary:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 86%,#fff)}
.ak-btn.ghost{background:transparent}
.ak-btn.small{height:32px;padding:0 11px;font-size:12px;border-radius:8px}
.ak-spinner{width:14px;height:14px;border:2px solid color-mix(in srgb,currentColor 25%,transparent);border-top-color:currentColor;border-radius:50%;animation:ak-spin .7s linear infinite}
@keyframes ak-spin{to{transform:rotate(360deg)}}
.ak-error{margin-top:13px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);color:var(--dsw-alias-state-error-primary);padding:9px 12px;border-radius:9px;font-size:12px;line-height:1.5}
.ak-meta-line{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:var(--dsw-alias-label-secondary);font-size:12px}
.ak-kicker{font-size:11px;letter-spacing:.9px;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:700}
.ak-team{margin-top:18px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}
.ak-card{position:relative;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:15px;padding:14px;min-width:0;overflow:hidden}
.ak-card.self{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1));background:linear-gradient(160deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1) 55%)}
.ak-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.ak-role{font-size:10px;font-weight:800;letter-spacing:.7px;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.ak-champ{width:42px;height:42px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);object-fit:cover;flex:none;background:var(--dsw-alias-bg-layer-2)}
.ak-player-name{margin:9px 0 1px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ak-player-tag{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ak-mmr-row{display:flex;align-items:baseline;gap:6px;margin-top:11px}
.ak-mmr{font-size:32px;line-height:1;font-weight:800;letter-spacing:-1.2px;font-variant-numeric:tabular-nums}
.ak-mmr-label{font-size:10px;color:var(--dsw-alias-label-secondary)}
.ak-badge{display:inline-flex;align-items:center;height:19px;padding:0 6px;border-radius:5px;font-size:10px;font-weight:700;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2);white-space:nowrap}
.ak-badge.inferred{color:#e0b25c;border-color:color-mix(in srgb,#e0b25c 35%,var(--dsw-alias-border-l1))}
.ak-badge.win{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent)}
.ak-badge.loss{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 32%,transparent)}
.ak-perf{margin-top:12px}
.ak-perf-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--dsw-alias-label-secondary);margin-bottom:5px}
.ak-perf-track{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.ak-perf-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-brand-primary),#e2bd73)}
.ak-kda{margin-top:11px;display:flex;justify-content:space-between;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.ak-kda b{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.ak-empty{margin-top:18px;border:1px dashed var(--dsw-alias-border-l2);border-radius:16px;padding:42px 20px;text-align:center;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 55%,transparent)}
.ak-empty strong{display:block;color:var(--dsw-alias-label-primary);font-size:15px;margin-bottom:6px}
.ak-empty p{margin:0 auto;font-size:12px;line-height:1.6;max-width:440px}
.ak-manual{margin-top:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 70%,transparent)}
.ak-manual summary{cursor:pointer;list-style:none;padding:13px 16px;font-size:13px;font-weight:650;display:flex;align-items:center;gap:8px}
.ak-manual summary::-webkit-details-marker{display:none}
.ak-manual summary:before{content:"+";width:18px;height:18px;border-radius:5px;border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:var(--dsw-alias-label-secondary)}
.ak-manual[open] summary:before{content:"−"}
.ak-manual-body{padding:0 16px 16px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:13px}
.ak-manual-hint{font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:9px}
.ak-manual-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.ak-manual-actions{display:flex;gap:8px;margin-top:10px}
.ak-manual-results{margin-top:16px}
.ak-champ-head{display:flex;align-items:center;gap:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:17px;padding:17px 19px;background:linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1) 60%);margin-bottom:16px}
.ak-champ-icon{width:70px;height:70px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);object-fit:cover;flex:none;background:var(--dsw-alias-bg-layer-2)}
.ak-champ-meta{min-width:0;flex:1}
.ak-champ-name{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.ak-champ-name h2{margin:0;font-size:22px;letter-spacing:-.3px}
.ak-champ-title{font-size:13px;color:var(--dsw-alias-label-secondary)}
.ak-stats{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
.ak-stat{font-size:11px;color:var(--dsw-alias-label-secondary)}
.ak-stat b{display:block;font-size:15px;color:var(--dsw-alias-label-primary);margin-top:2px;font-variant-numeric:tabular-nums}
.ak-dataset-bar{display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap}
.ak-seg{display:inline-flex;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:9px}
.ak-seg button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:650;height:28px;padding:0 13px;border-radius:6px;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s;white-space:nowrap}
.ak-seg button:hover{color:var(--dsw-alias-label-primary)}
.ak-seg button.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 15%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,transparent)}
.ak-search{position:relative;z-index:5}
.ak-search-box{display:flex;align-items:center;gap:8px;height:42px;border:1px solid var(--dsw-alias-border-l2);border-radius:11px;padding:0 12px;background:var(--dsw-alias-bg-base);transition:border-color .15s,box-shadow .15s}
.ak-search-box:focus-within{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.ak-search-box input{flex:1;min-width:0;border:0;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.ak-search-box svg{opacity:.65;flex:none}
.ak-drop{position:absolute;left:0;right:0;top:48px;max-height:360px;overflow:auto;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 45px rgba(0,0,0,.28);padding:5px}
.ak-option{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:7px 8px;border-radius:8px;cursor:pointer}
.ak-option:hover,.ak-option:focus{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);outline:none}
.ak-option img{width:30px;height:30px;border-radius:7px;object-fit:cover;flex:none}
.ak-option-name{font-size:12px;font-weight:650;display:block}
.ak-option-title{font-size:10px;color:var(--dsw-alias-label-secondary);display:block;margin-top:1px}
.ak-option-tier{margin-left:auto;font-size:10px;font-weight:800;color:#d9b56a}
.ak-popular{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.ak-pop{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;height:27px;padding:0 10px;font:inherit;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.ak-pop:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.ak-pop img{width:16px;height:16px;border-radius:50%;object-fit:cover}
.ak-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.85fr);gap:13px}
.ak-panel{border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:17px}
.ak-panel h3{margin:0 0 14px;font-size:14px;letter-spacing:-.1px;display:flex;align-items:center;gap:8px}
.ak-panel h3 .ak-hint{margin-left:auto;font-size:10px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.ak-section{margin-top:15px}
.ak-section:first-of-type{margin-top:0}
.ak-label{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:750;margin-bottom:7px;display:flex;align-items:center;gap:6px}
.ak-items{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.ak-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;width:54px;min-width:0}
.ak-item img{width:38px;height:38px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);object-fit:cover;background:var(--dsw-alias-bg-layer-2)}
.ak-item span{font-size:9px;line-height:1.2;color:var(--dsw-alias-label-secondary);text-align:center;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-item .ak-index{position:absolute;top:-5px;left:-4px;width:15px;height:15px;border-radius:50%;background:var(--dsw-alias-brand-primary);color:#081216;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--dsw-alias-bg-layer-1)}
.ak-arrow{color:var(--dsw-alias-state-idle-primary);font-size:13px;margin:0 -2px 12px}
.ak-build-line{display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap}
.ak-rate{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:9px;display:flex;gap:10px;flex-wrap:wrap}
.ak-rate b{color:var(--dsw-alias-label-primary)}
.ak-alt{display:flex;flex-direction:column;gap:6px;margin-top:12px;padding-top:11px;border-top:1px solid var(--dsw-alias-border-l1)}
.ak-alt-row{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--dsw-alias-label-secondary);min-width:0}
.ak-alt-row .ak-mini-items{display:flex;gap:3px;flex:none}
.ak-alt-row .ak-mini-items img{width:21px;height:21px;border-radius:5px;object-fit:cover;border:1px solid var(--dsw-alias-border-l1)}
.ak-alt-row .ak-alt-win{margin-left:auto;color:var(--dsw-alias-label-primary);font-weight:650;white-space:nowrap}
.ak-spell-pair{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);margin-bottom:7px}
.ak-spell-pair .ak-spells{display:flex;gap:4px;flex:none}
.ak-spell-pair img{width:29px;height:29px;border-radius:7px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2)}
.ak-spell-info{min-width:0}
.ak-spell-info strong{display:block;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ak-spell-info span{display:block;font-size:10px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.ak-skill{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);margin-bottom:7px}
.ak-skill-order{font-size:17px;font-weight:800;letter-spacing:.4px;font-variant-numeric:tabular-nums}
.ak-skill-meta{margin-left:auto;text-align:right;font-size:10px;color:var(--dsw-alias-label-secondary);line-height:1.5}
.ak-skill-meta b{color:var(--dsw-alias-label-primary);display:block;font-size:12px}
.ak-arch-tabs{display:flex;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:9px;width:fit-content;max-width:100%;overflow:auto;margin-bottom:10px}
.ak-arch-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;font-weight:650;height:28px;padding:0 10px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.ak-arch-tab:hover{color:var(--dsw-alias-label-primary)}
.ak-arch-tab.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}
.ak-arch-tab span{font-size:9px;color:var(--dsw-alias-label-secondary)}
.ak-rarity-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);border-radius:11px;width:fit-content;margin-bottom:11px;max-width:100%;overflow:auto}
.ak-rarity-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;font-weight:650;height:34px;padding:0 14px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:background .15s,color .15s,box-shadow .15s}
.ak-rarity-tab:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent)}
.ak-rarity-tab.active{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,transparent)}
.ak-rarity-tab .ak-dot{width:7px;height:7px}
.ak-rarity-tab .ak-aug-count{height:17px;min-width:19px;font-size:9px}
.ak-stage{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.ak-aug-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 55%,transparent)}
.ak-aug-toolbar-label{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary);min-width:0}
.ak-aug-toolbar-label strong{font-size:15px;font-weight:750;color:var(--dsw-alias-label-primary);white-space:nowrap}
.ak-aug-toolbar-label .ak-aug-count{height:18px;min-width:20px;font-size:10px}
.ak-aug-count{display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:16px;padding:0 4px;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:9px;font-weight:700}
.ak-expand{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex:none;transition:color .15s,border-color .15s,background .15s}
.ak-expand svg{width:15px;height:15px;transition:transform .18s ease}
.ak-expand:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,var(--dsw-alias-bg-layer-1))}
.ak-expand.is-open svg{transform:rotate(180deg)}
.ak-aug{display:flex;gap:11px;align-items:center;padding:11px 14px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 55%,transparent)}
.ak-aug:last-child{border-bottom:0}
.ak-aug-rank{font-size:12px;font-weight:800;color:var(--dsw-alias-state-idle-primary);width:18px;flex:none;text-align:center}
.ak-aug img{width:40px;height:40px;border-radius:10px;object-fit:cover;flex:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.ak-aug-info{min-width:0;flex:1}
.ak-aug-name{font-size:14px;font-weight:650;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ak-aug-sub{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:3px;display:flex;gap:4px;align-items:center;white-space:nowrap}
.ak-dot{width:5px;height:5px;border-radius:50%;flex:none}
.ak-dot.prismatic{background:#b98cff}
.ak-dot.gold{background:#e0b25c}
.ak-dot.silver{background:#aeb8c4}
.ak-aug-win{font-size:14px;font-weight:750;color:var(--dsw-alias-label-primary);margin-left:auto;white-space:nowrap}
.ak-combos{margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l1)}
.ak-combo{display:flex;align-items:center;gap:6px;padding:5px 0;font-size:11px}
.ak-combo img{width:24px;height:24px;border-radius:5px;object-fit:cover}
.ak-combo span{margin-left:auto;font-weight:750;color:var(--dsw-alias-label-primary)}
.ak-skeleton{height:13px;border-radius:6px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-2),color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-2));background-size:200% 100%;animation:ak-shimmer 1.2s linear infinite}
@keyframes ak-shimmer{to{background-position:-200% 0}}
.ak-loading{border:1px solid var(--dsw-alias-border-l1);border-radius:16px;padding:28px;background:var(--dsw-alias-bg-layer-1)}
.ak-loading-row{display:flex;gap:14px;align-items:center;margin-bottom:16px}
.ak-foot{margin-top:18px;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.6;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
.ak-panel-icon{color:var(--dsw-alias-label-secondary)}
.ak-panel-icon.is-active{color:var(--dsw-alias-brand-primary)}
@media (max-width:1000px){.ak-team{grid-template-columns:repeat(3,minmax(0,1fr))}.ak-grid{grid-template-columns:1fr}.ak-aug-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:720px){.ak-page{padding:18px 15px 40px}.ak-header{flex-direction:column}.ak-meta{justify-content:flex-start}.ak-team{grid-template-columns:repeat(2,minmax(0,1fr))}.ak-manual-grid{grid-template-columns:1fr 1fr}.ak-aug-grid{grid-template-columns:1fr}.ak-title{font-size:21px}.ak-hero{padding:18px}.ak-champ-head{padding:14px;gap:12px}.ak-champ-icon{width:54px;height:54px}}
`

    function Styles() {
      return h('style', { 'data-aramkit-helper': 'styles' }, CSS)
    }

    function ErrorBox({ message }) {
      if (!message) return null
      return h('div', { className: 'ak-error', role: 'alert' }, message)
    }

    function TeamCard({ member, index, t, champion }) {
      const isSelf = member.isSelf === true
      const championIcon = champion?.icon || ''
      const championName = champion?.title || champion?.name || ''
      return h(
        'article',
        { className: `ak-card${isSelf ? ' self' : ''}` },
        h(
          'div',
          { className: 'ak-card-top' },
          h('div', null,
            h('div', { className: 'ak-role' }, isSelf ? t('you') : `${t('teammate')} ${index + 1}`),
            h('div', { className: 'ak-player-name', title: `${member.gameName}#${member.tagLine}` }, member.gameName || t('player')),
            h('div', { className: 'ak-player-tag' }, member.tagLine ? `#${member.tagLine}` : ''),
          ),
          championIcon
            ? h(Img, { src: championIcon, alt: championName, size: 42, className: 'ak-champ' })
            : null,
        ),
        h(
          'div',
          { className: 'ak-mmr-row' },
          h('span', { className: 'ak-mmr' }, mmr(member.rating)),
          h('span', { className: 'ak-mmr-label' }, t('hiddenRating')),
        ),
        member.ratingType === 1 || member.inferred
          ? h('span', { className: 'ak-badge inferred' }, t('inferred'))
          : null,
        typeof member.performanceScore === 'number'
          ? h(
              'div',
              { className: 'ak-perf' },
              h('div', { className: 'ak-perf-head' }, h('span', null, t('performance')), h('span', null, Math.round(member.performanceScore))),
              h('div', { className: 'ak-perf-track' },
                h('div', {
                  className: 'ak-perf-fill',
                  style: { width: `${Math.max(3, Math.min(100, member.performanceScore))}%` },
                }),
              ),
            )
          : null,
        typeof member.kills === 'number'
          ? h(
              'div',
              { className: 'ak-kda' },
              h('span', null, t('matchKda')),
              h('span', null,
                h('b', null, `${member.kills}/${member.deaths}/${member.assists}`),
                member.matchResult === 0 || member.matchResult === 2 || member.matchResult === 4
                  ? h('span', { className: 'ak-badge win', style: { marginLeft: '6px' } }, t('win'))
                  : member.matchResult != null
                    ? h('span', { className: 'ak-badge loss', style: { marginLeft: '6px' } }, t('loss'))
                    : null,
              ),
            )
          : null,
      )
    }

    function TeamView({ t, locale, championsById }) {
      const [riotId, setRiotId] = useState('')
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const [team, setTeam] = useState([])
      const [meta, setMeta] = useState(null)
      const [manual, setManual] = useState(['', '', '', '', ''])
      const [manualLoading, setManualLoading] = useState(false)
      const [manualError, setManualError] = useState('')
      const [manualResults, setManualResults] = useState([])

      useEffect(() => {
        try {
          const saved = localStorage.getItem('aramkit.riotId')
          if (saved) setRiotId(saved)
        } catch {}
      }, [])

      const readTeam = useCallback(async () => {
        const parsed = parseRiotId(riotId)
        if (!parsed) {
          setError(t('invalidRiotId'))
          return
        }
        setLoading(true)
        setError('')
        setTeam([])
        setMeta(null)
        try {
          localStorage.setItem('aramkit.riotId', `${parsed.gameName}#${parsed.tagLine}`)
        } catch {}
        try {
          const selfData = await getJson('rating', parsed)
          const matches = [...(selfData.matches || [])].sort(
            (a, b) => new Date(b.gameCreationTime).getTime() - new Date(a.gameCreationTime).getTime(),
          )
          const latest = matches[0]
          if (!latest || !latest.participants?.length) {
            setTeam([
              {
                gameName: selfData.gameName,
                tagLine: selfData.tagLine,
                rating: selfData.rating,
                ratingType: selfData.ratingType,
                performanceScore: selfData.performanceScore,
                isSelf: true,
              },
            ])
            setMeta({ ratingData: selfData, match: null })
            return
          }
          const selfParticipant =
            latest.participants.find((row) => row.isSelf) ||
            latest.participants.find(
              (row) =>
                String(row.gameName).toLowerCase() === parsed.gameName.toLowerCase() &&
                String(row.tagLine).toLowerCase() === parsed.tagLine.toLowerCase(),
            )
          const teamId = selfParticipant?.teamId
          const allies = latest.participants
            .filter((row) => (teamId == null || row.teamId === teamId) && row.gameName && row.tagLine)
            .slice(0, 5)
          const ordered = [
            ...allies.filter((row) => row.isSelf),
            ...allies.filter((row) => !row.isSelf),
          ]
          setMeta({
            ratingData: selfData,
            match: latest,
            teamId,
            avgRating: latest.avgRating,
            self: selfParticipant,
          })
          setTeam(ordered.map((row) => ({ ...row, matchResult: latest.matchResult })))
          setLoading(false)
          for (const row of ordered) {
            if (typeof row.rating === 'number') continue
            try {
              const extra = await getJson('rating', { gameName: row.gameName, tagLine: row.tagLine })
              setTeam((current) =>
                current.map((item) =>
                  item.gameName === row.gameName && item.tagLine === row.tagLine
                    ? { ...item, rating: extra.rating, ratingType: extra.ratingType, performanceScore: extra.performanceScore }
                    : item,
                ),
              )
            } catch {}
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setLoading(false)
        }
      }, [riotId, t])

      const queryManual = useCallback(async () => {
        const entries = manual.map(parseRiotId).filter(Boolean)
        if (!entries.length) {
          setManualError(t('invalidRiotId'))
          return
        }
        setManualLoading(true)
        setManualError('')
        const results = []
        for (const entry of entries.slice(0, 5)) {
          try {
            const data = await getJson('rating', entry)
            const latest = [...(data.matches || [])].sort(
              (a, b) => new Date(b.gameCreationTime).getTime() - new Date(a.gameCreationTime).getTime(),
            )[0]
            const self = latest?.participants?.find((row) => row.isSelf)
            results.push({
              gameName: data.gameName,
              tagLine: data.tagLine,
              rating: data.rating,
              ratingType: data.ratingType,
              performanceScore: data.performanceScore,
              championId: latest?.championId,
              kills: self?.kills,
              deaths: self?.deaths,
              assists: self?.assists,
              matchResult: latest?.matchResult,
            })
          } catch (err) {
            results.push({
              gameName: entry.gameName,
              tagLine: entry.tagLine,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
        setManualResults(results)
        setManualLoading(false)
      }, [manual, t])

      const latestMatch = meta?.match
      const avgRating = meta?.avgRating ?? null

      return h(
        'div',
        null,
        h(
          'section',
          { className: 'ak-hero' },
          h('h2', null, t('teamHeroTitle')),
          h('p', null, t('teamHeroDesc')),
          h(
            'div',
            { className: 'ak-query' },
            h('input', {
              className: 'ak-input',
              value: riotId,
              placeholder: t('riotIdPlaceholder'),
              autoComplete: 'off',
              spellCheck: false,
              onChange: (event) => setRiotId(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter' && !loading) readTeam()
              },
            }),
            h(
              'button',
              { type: 'button', className: 'ak-btn primary', onClick: readTeam, disabled: loading },
              loading ? h('span', { className: 'ak-spinner' }) : h('span', { 'aria-hidden': true }, '⌕'),
              loading ? t('querying') : t('queryMyTeam'),
            ),
          ),
          h(ErrorBox, { message: error }),
          latestMatch
            ? h(
                'div',
                { className: 'ak-meta-line' },
                h('span', { className: 'ak-badge' }, t('latestMatch')),
                h(
                  'span',
                  { className: `ak-badge ${isWin(latestMatch.matchResult) ? 'win' : 'loss'}` },
                  isWin(latestMatch.matchResult) ? t('win') : t('loss'),
                ),
                h('span', null, timeText(latestMatch.gameCreationTime, locale)),
                h('span', null, '·'),
                h('span', null, `${t('teamAvg')} ${mmr(avgRating)}`),
                h('span', null, '·'),
                h('span', null, `${Math.floor((latestMatch.durationSeconds || 0) / 60)}:${String((latestMatch.durationSeconds || 0) % 60).padStart(2, '0')}`),
              )
            : null,
        ),
        team.length
          ? h(
              'div',
              { className: 'ak-team' },
              team.map((member, index) =>
                h(TeamCard, {
                  key: `${member.gameName}#${member.tagLine}-${index}`,
                  member,
                  index,
                  t,
                  champion: championsById.get(Number(member.championId)),
                }),
              ),
            )
          : loading
            ? h(
                'div',
                { className: 'ak-team', 'aria-hidden': true },
                Array.from({ length: 5 }, (_, index) =>
                  h('div', { className: 'ak-card', key: index },
                    h('div', { className: 'ak-skeleton', style: { width: '42px', height: '42px', borderRadius: '10px' } }),
                    h('div', { className: 'ak-skeleton', style: { width: '70%', marginTop: '14px' } }),
                    h('div', { className: 'ak-skeleton', style: { width: '48%', height: '28px', marginTop: '13px' } }),
                    h('div', { className: 'ak-skeleton', style: { width: '100%', marginTop: '16px' } }),
                  ),
                ),
              )
            : h(
                'div',
                { className: 'ak-empty' },
                h('strong', null, t('noTeamTitle')),
                h('p', null, t('noTeamDesc')),
              ),
        h(
          'details',
          { className: 'ak-manual' },
          h('summary', null, t('manualToggle')),
          h(
            'div',
            { className: 'ak-manual-body' },
            h('div', { className: 'ak-manual-hint' }, t('manualHint')),
            h(
              'div',
              { className: 'ak-manual-grid' },
              manual.map((value, index) =>
                h('input', {
                  key: index,
                  className: 'ak-input',
                  value,
                  placeholder: `#${index + 1}  ${t('riotIdPlaceholder')}`,
                  autoComplete: 'off',
                  spellCheck: false,
                  onChange: (event) => {
                    const next = [...manual]
                    next[index] = event.target.value
                    setManual(next)
                  },
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && !manualLoading) queryManual()
                  },
                }),
              ),
            ),
            h(
              'div',
              { className: 'ak-manual-actions' },
              h(
                'button',
                { type: 'button', className: 'ak-btn primary small', onClick: queryManual, disabled: manualLoading },
                manualLoading ? h('span', { className: 'ak-spinner' }) : null,
                manualLoading ? t('querying') : t('queryAll'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'ak-btn ghost small',
                  onClick: () => {
                    setManual(['', '', '', '', ''])
                    setManualResults([])
                    setManualError('')
                  },
                },
                t('clear'),
              ),
            ),
            h(ErrorBox, { message: manualError }),
          ),
        ),
        manualResults.length
          ? h(
              'div',
              { className: 'ak-manual-results' },
              h('div', { className: 'ak-label' }, t('manualTitle')),
              h(
                'div',
                { className: 'ak-team' },
                manualResults.map((member, index) =>
                  member.error
                    ? h(
                        'article',
                        { className: 'ak-card', key: index },
                        h('div', { className: 'ak-role' }, `${t('teammate')} ${index + 1}`),
                        h('div', { className: 'ak-player-name' }, member.gameName),
                        h('div', { className: 'ak-player-tag' }, `#${member.tagLine}`),
                        h('div', { className: 'ak-error', style: { marginTop: '10px' } }, member.error),
                      )
                    : h(TeamCard, {
                        key: index,
                        member,
                        index,
                        t,
                        champion: championsById.get(Number(member.championId)),
                      }),
                ),
              ),
            )
          : null,
        h('p', { className: 'ak-foot' }, h('span', null, t('disclaimer')), null),
      )
    }

    function ChampionView({ t, locale, champions, championsById, initialChampionId }) {
      const [query, setQuery] = useState('')
      const [open, setOpen] = useState(false)
      const [selectedId, setSelectedId] = useState(initialChampionId || null)
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(Boolean(initialChampionId))
      const [error, setError] = useState('')
      const [expanded, setExpanded] = useState({})
      const [activeRarity, setActiveRarity] = useState('prismatic')
      const [archetypeKey, setArchetypeKey] = useState(null)
      const [dataset, setDataset] = useState(() => {
        try {
          return localStorage.getItem('aramkit.dataset') === 'high' ? 'high' : 'all'
        } catch {
          return 'all'
        }
      })
      const searchRef = useRef(null)
      const detailCache = useRef(new Map())
      const requestRef = useRef(0)

      const selected = selectedId ? championsById.get(Number(selectedId)) : null
      const popular = useMemo(() => champions.slice(0, 8), [champions])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return champions.slice(0, 40)
        return champions
          .filter((row) =>
            [row.name, row.title, row.slug, row.id]
              .filter(Boolean)
              .some((part) => String(part).toLowerCase().includes(needle)),
          )
          .slice(0, 40)
      }, [champions, query])

      const load = useCallback(
        async (id, bracket) => {
          if (!id) return
          const selectedDataset = bracket || 'all'
          const requestId = ++requestRef.current
          setLoading(true)
          setError('')
          try {
            const cacheKey = `${selectedDataset}:${id}`
            if (detailCache.current.has(cacheKey)) {
              if (requestId === requestRef.current) {
                setData(detailCache.current.get(cacheKey))
                setLoading(false)
              }
              return
            }
            const payload = await getJson('champion', { id, dataset: selectedDataset })
            if (requestId !== requestRef.current) return
            detailCache.current.set(cacheKey, payload)
            setData(payload)
          } catch (err) {
            if (requestId !== requestRef.current) return
            setError(err instanceof Error ? err.message : String(err))
            setData(null)
          } finally {
            if (requestId === requestRef.current) setLoading(false)
          }
        },
        [],
      )

      useEffect(() => {
        if (selectedId) load(selectedId, dataset)
      }, [selectedId, dataset, load])

      useEffect(() => {
        setArchetypeKey(data?.archetypes?.[0]?.key ?? null)
      }, [data?.champion?.id, data?.dataset])

      useEffect(() => {
        if (!open) return
        const close = (event) => {
          if (!searchRef.current?.contains(event.target)) setOpen(false)
        }
        document.addEventListener('pointerdown', close, true)
        return () => document.removeEventListener('pointerdown', close, true)
      }, [open])

      const pick = (id) => {
        setSelectedId(Number(id))
        setExpanded({})
        setActiveRarity('prismatic')
        setQuery('')
        setOpen(false)
        try {
          localStorage.setItem('aramkit.champion', String(id))
        } catch {}
      }

      const champion = data?.champion || selected
      const archetypes = data?.archetypes || []
      const activeArchetype = archetypes.find((row) => row.key === archetypeKey) || archetypes[0] || null
      const builds = activeArchetype?.builds || data?.builds || []
      const primary = builds[0]
      const starters = primary?.starters?.[0]
      const boots = primary?.boots?.[0]
      const later = primary?.later || []
      const summoners = data?.summoners || []
      const skills = data?.skills || []
      const augments = data?.augments || {}

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'ak-dataset-bar' },
          h('span', { className: 'ak-kicker' }, t('datasetLabel')),
          h(
            'div',
            { className: 'ak-seg', role: 'group', 'aria-label': t('datasetLabel') },
            ['all', 'high'].map((key) =>
              h(
                'button',
                {
                  key,
                  type: 'button',
                  className: dataset === key ? 'active' : '',
                  'aria-pressed': dataset === key,
                  onClick: () => {
                    if (dataset === key) return
                    setDataset(key)
                    setData(null)
                    setExpanded({})
                    setLoading(true)
                    try {
                      localStorage.setItem('aramkit.dataset', key)
                    } catch {}
                  },
                },
                key === 'high' ? t('highBracket') : t('allBracket'),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ak-search', ref: searchRef },
          h(
            'div',
            { className: 'ak-search-box' },
            h(
              'svg',
              { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, 'aria-hidden': true },
              h('circle', { cx: 11, cy: 11, r: 7 }),
              h('path', { d: 'm20 20-4-4' }),
            ),
            h('input', {
              value: query,
              placeholder: t('searchChampion'),
              'aria-label': t('searchChampion'),
              autoComplete: 'off',
              spellCheck: false,
              onFocus: () => setOpen(true),
              onChange: (event) => {
                setQuery(event.target.value)
                setOpen(true)
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' && filtered[0]) pick(filtered[0].id)
                if (event.key === 'Escape') setOpen(false)
              },
            }),
            h('span', { className: 'ak-kicker' }, selected ? `${selected.name} ${selected.title}` : t('pickChampion')),
          ),
          open
            ? h(
                'div',
                { className: 'ak-drop', role: 'listbox' },
                filtered.length
                  ? filtered.map((row) =>
                      h(
                        'button',
                        {
                          key: row.id,
                          type: 'button',
                          role: 'option',
                          className: 'ak-option',
                          onMouseDown: (event) => event.preventDefault(),
                          onClick: () => pick(row.id),
                        },
                        h(Img, { src: row.icon, alt: row.name, size: 30 }),
                        h('span', null,
                          h('span', { className: 'ak-option-name' }, row.name),
                          h('span', { className: 'ak-option-title' }, row.title),
                        ),
                        row.tier ? h('span', { className: 'ak-option-tier' }, row.tier) : null,
                      ),
                    )
                  : h('div', { className: 'ak-option-title', style: { padding: '12px' } }, t('noChampion')),
              )
            : null,
        ),
        h(
          'div',
          { className: 'ak-popular' },
          h('span', { className: 'ak-kicker', style: { marginRight: '2px', alignSelf: 'center' } }, t('popular')),
          popular.map((row) =>
            h(
              'button',
              { key: row.id, type: 'button', className: 'ak-pop', onClick: () => pick(row.id) },
              h(Img, { src: row.icon, alt: row.name, size: 16 }),
              row.title,
            ),
          ),
        ),
        error
          ? h(
              'div',
              { className: 'ak-panel', style: { marginTop: '14px' } },
              h(ErrorBox, { message: error }),
              h('button', { type: 'button', className: 'ak-btn small', onClick: () => load(selectedId, dataset) }, t('retry')),
            )
          : loading && !data
            ? h(
                'div',
                { className: 'ak-loading', style: { marginTop: '14px' } },
                h('div', { className: 'ak-loading-row' },
                  h('div', { className: 'ak-skeleton', style: { width: '70px', height: '70px', borderRadius: '14px' } }),
                  h('div', { style: { flex: 1 } },
                    h('div', { className: 'ak-skeleton', style: { width: '35%', height: '20px' } }),
                    h('div', { className: 'ak-skeleton', style: { width: '55%', marginTop: '9px' } }),
                  ),
                ),
                h('div', { className: 'ak-skeleton', style: { width: '100%', height: '120px' } }),
                h('p', { style: { margin: '14px 0 0', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, t('loading')),
              )
            : champion
              ? h(
                  'div',
                  { style: { marginTop: '14px' } },
                  h(
                    'div',
                    { className: 'ak-champ-head' },
                    h(Img, { src: champion.icon, alt: champion.name, size: 70, className: 'ak-champ-icon' }),
                    h(
                      'div',
                      { className: 'ak-champ-meta' },
                      h(
                        'div',
                        { className: 'ak-champ-name' },
                        h('h2', null, champion.name),
                        h('span', { className: 'ak-champ-title' }, champion.title),
                        champion.tier ? h('span', { className: 'ak-pill gold' }, `${champion.tier}${champion.rank ? ` · #${champion.rank}` : ''}`) : null,
                      ),
                      h(
                        'div',
                        { className: 'ak-stats' },
                        h('span', { className: 'ak-stat' }, t('winRate'), h('b', null, pct(champion.winRate))),
                        h('span', { className: 'ak-stat' }, t('pickRate'), h('b', null, pct(champion.pickRate))),
                        h('span', { className: 'ak-stat' }, t('games'), h('b', null, compactNumber(champion.sampleCount))),
                      ),
                    ),
                    h('span', { className: 'ak-pill gold' }, dataset === 'high' ? t('highBracket') : t('allBracket')),
                    h('span', { className: 'ak-pill' }, `${t('version')} ${data?.version || '—'}`),
                  ),
                  h(
                    'div',
                    { className: 'ak-grid' },
                    h(
                      'section',
                      { className: 'ak-panel' },
                      h('h3', null, t('builds'), h('span', { className: 'ak-hint' }, `${t('winRate')} ${pct(primary?.winRate)}`)),
                      archetypes.length > 1
                        ? h('div', { className: 'ak-arch-tabs' },
                            archetypes.map((row) =>
                              h('button', {
                                key: row.key,
                                type: 'button',
                                className: `ak-arch-tab${activeArchetype?.key === row.key ? ' active' : ''}`,
                                title: `${row.label} · ${t('winRate')} ${pct(row.winRate)}`,
                                onClick: () => {
                                  setArchetypeKey(row.key)
                                  setExpanded({})
                                },
                              },
                                row.label,
                                h('span', null, pct(row.winRate)),
                              ),
                            ),
                          )
                        : null,
                      starters
                        ? h(
                            'div',
                            { className: 'ak-section' },
                            h('div', { className: 'ak-label' }, t('starters')),
                            h(
                              'div',
                              { className: 'ak-items' },
                              starters.items.map((item, index) =>
                                h('div', { className: 'ak-item', key: `${item.id}-${index}`, title: item.name },
                                  h(Img, { src: item.icon, alt: item.name, size: 38 }),
                                  h('span', null, item.name),
                                ),
                              ),
                            ),
                            h('div', { className: 'ak-rate' },
                              h('span', null, `${t('winRate')} `, h('b', null, pct(starters.winRate))),
                              h('span', null, `${t('pickRate')} `, h('b', null, pct(starters.pickRate))),
                              h('span', null, `${compactNumber(starters.sampleCount)} ${t('games')}`),
                            ),
                          )
                        : null,
                      primary
                        ? h(
                            'div',
                            { className: 'ak-section' },
                            h('div', { className: 'ak-label' }, t('core')),
                            h(
                              'div',
                              { className: 'ak-build-line' },
                              primary.items.map((item, index) =>
                                h(React.Fragment, { key: `${item.id}-${index}` },
                                  h('div', { className: 'ak-item', title: item.name },
                                    h('span', { className: 'ak-index' }, index + 1),
                                    h(Img, { src: item.icon, alt: item.name, size: 38 }),
                                    h('span', null, item.name),
                                  ),
                                  index < primary.items.length - 1 ? h('span', { className: 'ak-arrow' }, '›') : null,
                                ),
                              ),
                              boots
                                ? h(React.Fragment, null,
                                    h('span', { className: 'ak-arrow' }, '·'),
                                    h('div', { className: 'ak-item', title: boots.item.name },
                                      h('span', { className: 'ak-index', style: { background: '#e0b25c' } }, '鞋'),
                                      h(Img, { src: boots.item.icon, alt: boots.item.name, size: 38 }),
                                      h('span', null, boots.item.name),
                                    ),
                                  )
                                : null,
                            ),
                            h(
                              'div',
                              { className: 'ak-rate' },
                              h('span', null, `${t('winRate')} `, h('b', null, pct(primary.winRate))),
                              h('span', null, `${t('pickRate')} `, h('b', null, pct(primary.pickRate))),
                              h('span', null, `${compactNumber(primary.sampleCount)} ${t('games')}`),
                            ),
                          )
                        : null,
                      later.length
                        ? h(
                            'div',
                            { className: 'ak-section' },
                            h('div', { className: 'ak-label' }, t('later')),
                            h(
                              'div',
                              { className: 'ak-items' },
                              later.map((row, index) =>
                                h('div', { className: 'ak-item', key: `${row.item.id}-${index}`, title: row.item.name },
                                  h(Img, { src: row.item.icon, alt: row.item.name, size: 38 }),
                                  h('span', null, row.item.name),
                                ),
                              ),
                            ),
                          )
                        : null,
                      builds.length > 1
                        ? h(
                            'div',
                            { className: 'ak-alt' },
                            h('div', { className: 'ak-label', style: { marginBottom: '2px' } }, t('alternatives')),
                            builds.slice(1, 3).map((build, index) =>
                              h(
                                'div',
                                { className: 'ak-alt-row', key: index },
                                h('div', { className: 'ak-mini-items' },
                                  build.items.map((item) => h(Img, { key: item.id, src: item.icon, alt: item.name, size: 21 })),
                                ),
                                h('span', null, build.items.map((item) => item.name).join(' + ')),
                                h('span', { className: 'ak-alt-win' }, pct(build.winRate)),
                              ),
                            ),
                          )
                        : null,
                    ),
                    h(
                      'section',
                      { className: 'ak-panel' },
                      h('h3', null, t('summoners')),
                      summoners.map((row, index) =>
                        h(
                          'div',
                          { className: 'ak-spell-pair', key: index },
                          h('div', { className: 'ak-spells' },
                            row.spells.map((spell) => h(Img, { key: spell.id, src: spell.icon, alt: spell.name, size: 29 })),
                          ),
                          h(
                            'div',
                            { className: 'ak-spell-info' },
                            h('strong', null, row.spells.map((spell) => spell.name).join(' + ')),
                            h('span', null, `${t('winRate')} ${pct(row.winRate)} · ${t('pickRate')} ${pct(row.pickRate)}`),
                          ),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'ak-section' },
                        h('div', { className: 'ak-label' }, t('skills')),
                        skills.map((row, index) =>
                          h(
                            'div',
                            { className: 'ak-skill', key: index },
                            h('span', { className: 'ak-skill-order' }, row.order.replace(/>/g, ' › ')),
                            h(
                              'span',
                              { className: 'ak-skill-meta' },
                              h('b', null, pct(row.winRate)),
                              `${t('pickRate')} ${pct(row.pickRate)}`,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  h(
                    'section',
                    { className: 'ak-panel', style: { marginTop: '13px' } },
                    h('h3', null, t('augments'),
                      h('span', { className: 'ak-hint' }, `${t('augmentHint')} · ${t('filtered')} < ${data?.minAugmentSample ?? 200}`),
                    ),
                    h(
                      'div',
                      { className: 'ak-rarity-tabs', role: 'tablist' },
                      AUGMENT_RARITIES.map(({ key, labelKey }) => {
                        const count = (augments[key] || []).length
                        return h(
                          'button',
                          {
                            key,
                            type: 'button',
                            role: 'tab',
                            'aria-selected': activeRarity === key,
                            className: `ak-rarity-tab${activeRarity === key ? ' active' : ''}`,
                            onClick: () => setActiveRarity(key),
                          },
                          h('span', { className: `ak-dot ${key}` }),
                          t(labelKey),
                          h('span', { className: 'ak-aug-count' }, count),
                        )
                      }),
                    ),
                    (() => {
                      const rarity = AUGMENT_RARITIES.find((row) => row.key === activeRarity) || AUGMENT_RARITIES[0]
                      const rows = augments[rarity.key] || []
                      const isOpen = !!expanded[rarity.key]
                      const visible = isOpen ? rows : rows.slice(0, 3)
                      return h(
                        'div',
                        { className: 'ak-stage', role: 'tabpanel' },
                        h(
                          'div',
                          { className: 'ak-aug-toolbar' },
                          h(
                            'span',
                            { className: 'ak-aug-toolbar-label' },
                            h('span', { className: `ak-dot ${rarity.key}` }),
                            h('strong', null, isOpen ? t('top15Short') : t('top3Short')),
                            h('span', { className: 'ak-aug-count' }, rows.length),
                          ),
                          rows.length > 3
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  className: `ak-expand${isOpen ? ' is-open' : ''}`,
                                  'aria-expanded': isOpen,
                                  'aria-label': isOpen ? t('collapse') : t('expandTop15'),
                                  title: isOpen ? t('collapse') : t('expandTop15'),
                                  onClick: () =>
                                    setExpanded((current) => ({ ...current, [rarity.key]: !current[rarity.key] })),
                                },
                                h(
                                  'svg',
                                  {
                                    viewBox: '0 0 24 24',
                                    fill: 'none',
                                    stroke: 'currentColor',
                                    strokeWidth: 2.2,
                                    strokeLinecap: 'round',
                                    strokeLinejoin: 'round',
                                    'aria-hidden': true,
                                  },
                                  h('path', { d: 'm6 9 6 6 6-6' }),
                                ),
                              )
                            : null,
                        ),
                        visible.length
                          ? visible.map((row, index) =>
                              h(
                                'div',
                                { className: 'ak-aug', key: row.id },
                                h('span', { className: 'ak-aug-rank' }, index + 1),
                                h(Img, { src: row.icon, alt: row.name, size: 40 }),
                                h(
                                  'div',
                                  { className: 'ak-aug-info' },
                                  h('div', { className: 'ak-aug-name', title: row.name }, row.name),
                                  h(
                                    'div',
                                    { className: 'ak-aug-sub' },
                                    h('span', null, `${compactNumber(row.sampleCount)}${t('sample')}`),
                                  ),
                                ),
                                h('span', { className: 'ak-aug-win' }, pct(row.winRate)),
                              ),
                            )
                          : h('div', { className: 'ak-aug-sub', style: { padding: '16px 14px' } }, t('noData')),
                      )
                    })(),
                    data?.augmentCombinations?.length
                      ? h('div', { className: 'ak-combos' },
                          h('div', { className: 'ak-label' }, t('augmentCombo')),
                          data.augmentCombinations.slice(0, 2).map((combo, index) =>
                            h('div', { className: 'ak-combo', key: index },
                              combo.augments.map((row) => h(Img, { key: row.id, src: row.icon, alt: row.name, size: 24 })),
                              h('span', null, pct(combo.winRate)),
                            ),
                          ),
                        )
                      : null,
                  ),
                  h(
                    'div',
                    { className: 'ak-foot' },
                    h('span', null, `${t('source')} · ${t('updated')} ${data?.dataDate || ''}`),
                    h('span', null, t('disclaimer')),
                  ),
                )
              : h(
                  'div',
                  { className: 'ak-empty', style: { marginTop: '14px' } },
                  h('strong', null, t('selectHint')),
                  h('p', null, t('championDesc')),
                ),
      )
    }

    function Page({ t, locale, lang, onToggleLang, champions, championsById, initialChampionId }) {
      const [tab, setTab] = useState('team')
      return h(
        'div',
        { className: 'ak-page' },
        h(Styles),
        h(
          'div',
          { className: 'ak-shell' },
          h(
            'header',
            { className: 'ak-header' },
            h(
              'div',
              { className: 'ak-brand' },
              h(BrandMark, { size: 42 }),
              h(
                'div',
                null,
                h('h1', { className: 'ak-title' }, t('title')),
                h('p', { className: 'ak-subtitle' }, t('subtitle')),
              ),
            ),
            h(
              'div',
              { className: 'ak-meta' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'ak-lang',
                  title: lang === 'zh' ? 'Switch to English' : '切换到中文',
                  onClick: onToggleLang,
                },
                lang === 'zh' ? 'EN' : '中文',
              ),
              h('span', { className: 'ak-pill gold' }, h('span', { 'aria-hidden': true }, '◆'), t('source')),
              h('span', { className: 'ak-pill' }, `${t('version')} ${champions.version || '—'}`),
            ),
          ),
          h(
            'div',
            { className: 'ak-tabs', role: 'tablist' },
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                'aria-selected': tab === 'team',
                className: `ak-tab${tab === 'team' ? ' active' : ''}`,
                onClick: () => setTab('team'),
              },
              h('span', { 'aria-hidden': true }, '⚔'),
              t('teamTab'),
            ),
            h(
              'button',
              {
                type: 'button',
                role: 'tab',
                'aria-selected': tab === 'champion',
                className: `ak-tab${tab === 'champion' ? ' active' : ''}`,
                onClick: () => setTab('champion'),
              },
              h('span', { 'aria-hidden': true }, '✦'),
              t('championTab'),
            ),
          ),
          tab === 'team'
            ? h(TeamView, { t, locale, championsById })
            : h(ChampionView, {
                t,
                locale,
                champions: champions.list,
                championsById,
                initialChampionId,
              }),
        ),
      )
    }

    function apply(ctx) {
      const disposeLocale = ctx.locale.register(NS, {
        'zh-CN': ZH,
        'en-US': EN,
      })
      ctx.effect(() => disposeLocale, 'aramkit-helper: locale')
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'aramkit-helper',
            order: 30,
            label: () => (uiLang === 'en' ? 'ARAM Helper (Isolated)' : '海斗助手隔离版'),
          },
          PanelIcon,
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'aramkit-helper',
          },
          function AramKitPage() {
            const [lang, setLang] = useState(uiLang)
            const t = useMemo(() => (key) => dictFor(lang)[key] ?? (ZH[key] ?? key), [lang])
            const locale = lang === 'en' ? 'en-US' : 'zh-CN'
            const [champions, setChampions] = useState({ list: [], version: '' })
            const championsById = useMemo(() => new Map(champions.list.map((row) => [row.id, row])), [champions.list])
            const [initialChampionId, setInitialChampionId] = useState(157)

            const toggleLang = useCallback(() => {
              setLang((current) => {
                const next = current === 'en' ? 'zh' : 'en'
                uiLang = next
                try {
                  localStorage.setItem(LANG_KEY, next)
                } catch {}
                return next
              })
            }, [])

            useEffect(() => {
              let alive = true
              getJson('champions')
                .then((payload) => {
                  if (!alive) return
                  setChampions({ list: payload.champions, version: payload.version })
                  let stored = 0
                  try {
                    stored = Number(localStorage.getItem('aramkit.champion') || 0)
                  } catch {}
                  const exists = stored && payload.champions.some((row) => row.id === stored)
                  const fallback = exists ? stored : payload.champions[0]?.id || 157
                  setInitialChampionId(fallback)
                })
                .catch(() => {})
              return () => {
                alive = false
              }
            }, [])

            return h(Page, {
              t,
              locale,
              lang,
              onToggleLang: toggleLang,
              champions,
              championsById,
              initialChampionId,
            })
          },
        ),
      )
    }

    return { inject: ['slots', 'locale'], apply }
  },
})

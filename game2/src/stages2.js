// 小向クエスト2 ゴールデンエイジ編 — コンテンツ定義
// 1（game/）とはデータを完全に分離する。エンジン（entities/combat/sprites/input/audio）だけ共有。
//
// 陣営は3種類:
//   enemy … 相手企業・審査・そして直属PM
//   ally  … 同期（絶対に裏切らない・誤爆しない）
//   mob   … 中間管理職・通行人（攻撃も被弾もしない。ただ見ている）

// ===== スプライト（1のパレット差し替え方式に追加登録する） =====
export const PALETTES2 = {
  // 主人公: 第1章は白（新人）→ 配属後は緑（＝1のally色）→ エピローグで橙（＝1のplayer色）
  p2_shinjin: { map: 'worker', h: '#e6edf2' },
  p2_haizoku: { map: 'worker', h: '#36b06a' },

  // 同期3人（配属先の色）
  douki_sekkei: { map: 'worker', h: '#4a7ad0' }, // 設計: 青
  douki_genba:  { map: 'cap',    h: '#44507a' }, // 現場: 製造なのでキャップ（紺）
  douki_hinsho: { map: 'worker', h: '#9a6ad0' }, // 品証: 紫
  shutantou:    { map: 'worker', h: '#40b0a8' }, // 主担当（支援章のみ）: 青緑

  // モブ（中間管理職・通行人）— くすんだ色で背景に沈める
  chukan: { map: 'worker', h: '#6e737a' },
  tsukou: { map: 'worker', h: '#8a8f96' },

  // 直属PM（課長）— 全章に出る反復エネミー。黒に近い作業着
  pm: { map: 'worker', h: '#2a2a30' },

  // 第1章 社内（研修）
  jinji:  { map: 'suit',   b: '#4a4a58', p: '#3c3c48', t: '#8a8a9a', h: '#20180f' },
  manner: { map: 'suit',   b: '#6a4a5a', p: '#583e4c', t: '#d0c0c8', h: '#241a12' },
  anzen:  { map: 'worker', h: '#d05a20' },
  ryocho: { map: 'worker', h: '#7a6a40' },
  kyoiku: { map: 'suit',   b: '#2c3348', p: '#242a3c', t: '#a03030', h: '#1a1410' },

  // 第2章 M菱重工（機体メーカー）— 機体側は白〜銀系
  m_kikai:  { map: 'cap',    h: '#8a9099' }, // 機械設計。現場に降りるのでキャップ
  m_denso:  { map: 'worker', h: '#a8b4c0' },
  m_sekkei: { map: 'worker', h: '#8e9aa8' },
  m_pm:     { map: 'suit',   b: '#3a4250', p: '#303643', t: '#b0b8c2', h: '#1e1a14' },

  // 第3章 GR社 — 古い工場。褪せた黄土
  gr_chotatsu: { map: 'worker', h: '#b09040' },
  gr_gijutsu:  { map: 'worker', h: '#967a38' },
  gr_seizo:    { map: 'cap',    h: '#6b5a2c' }, // GR社 製造: キャップ
  gr_pm:       { map: 'suit',   b: '#5a4a2e', p: '#4a3d26', t: '#9a8a5a', h: '#3a2a18' },

  // 第4章 L社 — 藍。閉じている
  l_toiawase: { map: 'worker', h: '#3f51b5' },
  l_yushutsu: { map: 'worker', h: '#2e3a86' },
  l_pm:       { map: 'suit',   b: '#232a4a', p: '#1c2240', t: '#6a78c0', h: '#1a1610' },

  // 第5章 LM社 — 巨大。濃紺と金
  lm_keiyaku: { map: 'suit',   b: '#2a3050', p: '#232842', t: '#c0a040', h: '#1a1410' },
  lm_cr:      { map: 'worker', h: '#5a6480' },
  lm_shiken:  { map: 'cap',    h: '#3b4458' }, // 試験は現場仕事なのでキャップ
  lm_kanri:   { map: 'suit',   b: '#242a44', p: '#1e2338', t: '#d0b050', h: '#151109' },
  lm_pm:      { map: 'suit',   b: '#161c30', p: '#121728', t: '#d8bc58', h: '#12100c' },

  // 代理店（商社）— 攻撃してこない。灰色のスーツで「間に立つ」
  dairiten: { map: 'suit', b: '#8a8f98', p: '#767b84', t: '#5a5f68', h: '#241c14' },

  // 最終章 発注官庁 ＋ 四騎士
  kensakan:   { map: 'suit',   b: '#3a4038', p: '#30352e', t: '#8a9080', h: '#1c1810' },
  kancho_pm:  { map: 'suit',   b: '#1c2018', p: '#161a14', t: '#7a8068', h: '#141008' },
  kishi_kigen:    { map: 'suit', b: '#101014', p: '#0c0c10', t: '#c04a1a', h: '#d8d8d8', s: '#8a7a6a', e: '#ff6a1a' },
  kishi_seinou:   { map: 'suit', b: '#101014', p: '#0c0c10', t: '#1a7ac0', h: '#d8d8d8', s: '#8a7a6a', e: '#3aa0ff' },
  kishi_sonshitsu:{ map: 'suit', b: '#101014', p: '#0c0c10', t: '#c0a01a', h: '#d8d8d8', s: '#8a7a6a', e: '#ffd23a' },
  kishi_keisou:   { map: 'suit', b: '#101014', p: '#0c0c10', t: '#8a1a1a', h: '#d8d8d8', s: '#8a7a6a', e: '#ff2a2a' },
};

export const LABELS2 = {
  douki_sekkei: '設計', douki_genba: '現場', douki_hinsho: '品証', shutantou: '主担当',
  chukan: '部長・課長', tsukou: '社員', pm: 'PM（課長）',
  jinji: '人事部', manner: 'マナー講師', anzen: '安全衛生', ryocho: '寮長',
  m_kikai: '機械設計', m_denso: '電装', m_sekkei: '設計課長',
  gr_chotatsu: '調達', gr_gijutsu: '技術', gr_seizo: '製造',
  l_toiawase: '技術問合せ', l_yushutsu: '輸出管理責任者',
  lm_keiyaku: '契約', lm_cr: '変更要求', lm_shiken: '試験', lm_kanri: '契約管理',
  dairiten: '代理店', kensakan: '検査官',
  kishi_kigen: '期限', kishi_seinou: '性能', kishi_sonshitsu: '損失', kishi_keisou: '係争',
};

export const COLORS2 = {
  douki_sekkei: '#7aa8ff', douki_genba: '#f0d860', douki_hinsho: '#b88ce8', shutantou: '#5cd0c8',
  chukan: '#9aa0a8', tsukou: '#aab0b8', pm: '#c8c8d8',
  jinji: '#9a9ab0', manner: '#d0a8bc', anzen: '#ff8a4a', ryocho: '#c0b070',
  m_kikai: '#e0e4ea', m_denso: '#c0ccd8', m_sekkei: '#aab6c4',
  gr_chotatsu: '#d0b060', gr_gijutsu: '#b89a50', gr_seizo: '#a08648',
  l_toiawase: '#8c9eff', l_yushutsu: '#7080e0',
  lm_keiyaku: '#c0a860', lm_cr: '#8a94b0', lm_shiken: '#7a86a0', lm_kanri: '#e0c060',
  dairiten: '#c0c4cc', kensakan: '#a0a898',
  kishi_kigen: '#ff8a4a', kishi_seinou: '#6ac0ff', kishi_sonshitsu: '#ffd85a', kishi_keisou: '#ff5a5a',
};

// ===== 種別ごとの基礎ステータス =====
// noFumble / noBetray … 同期は誤爆も裏切りもしない
// team: 'mob'          … 攻撃も被弾もしない
// passive: true        … 攻撃してこない（代理店。1のS田/H本と同じ実装）
export const UNIT_TYPES2 = {
  // --- 同期（味方）---
  douki_sekkei: { name: '設計', sprite: 'douki_sekkei', team: 'ally', taunts: 'douki_sekkei', noFumble: true, noBetray: true, hp: 6, speed: 62, reach: 23, dmg: 1, kb: 90, cooldown: 0.55, telegraph: 0.22, score: 0 },
  douki_genba:  { name: '現場', sprite: 'douki_genba',  team: 'ally', taunts: 'douki_genba',  noFumble: true, noBetray: true, hp: 7, speed: 58, reach: 24, dmg: 1, kb: 100, cooldown: 0.6, telegraph: 0.24, score: 0 },
  douki_hinsho: { name: '品証', sprite: 'douki_hinsho', team: 'ally', taunts: 'douki_hinsho', noFumble: true, noBetray: true, hp: 6, speed: 60, reach: 23, dmg: 1, kb: 90, cooldown: 0.58, telegraph: 0.23, score: 0 },
  shutantou:    { name: '主担当', sprite: 'shutantou',  team: 'ally', taunts: 'shutantou',    noFumble: true, noBetray: true, hp: 8, speed: 60, reach: 24, dmg: 1, kb: 95, cooldown: 0.55, telegraph: 0.22, score: 0 },

  // --- モブ（見ているだけ）---
  chukan: { name: '部長・課長', sprite: 'chukan', team: 'mob', hp: 1, speed: 40, reach: 0, dmg: 0, kb: 0, cooldown: 9, telegraph: 1, score: 0 },
  tsukou: { name: '社員',       sprite: 'tsukou', team: 'mob', hp: 1, speed: 44, reach: 0, dmg: 0, kb: 0, cooldown: 9, telegraph: 1, score: 0 },

  // --- 直属PM（全章に出る反復エネミー。章ごとに強くなる）---
  pm: { name: 'PM（課長）', sprite: 'pm', taunts: 'pm', midboss: true, scale: 1.5, hp: 16, speed: 50, reach: 27, dmg: 2, kb: 110, cooldown: 0.62, telegraph: 0.38, score: 600 },

  // --- 第1章 社内 ---
  jinji:  { name: '人事部教育担当', sprite: 'jinji',  taunts: 'jinji',  hp: 2, speed: 48, reach: 21, dmg: 1, kb: 80, cooldown: 0.8, telegraph: 0.44, score: 80 },
  manner: { name: 'マナー講師',     sprite: 'manner', taunts: 'manner', hp: 3, speed: 44, reach: 22, dmg: 1, kb: 85, cooldown: 0.75, telegraph: 0.42, score: 100 },
  anzen:  { name: '安全衛生講習',   sprite: 'anzen',  taunts: 'anzen',  hp: 3, speed: 42, reach: 22, dmg: 1, kb: 90, cooldown: 0.8, telegraph: 0.46, score: 110 },
  ryocho: { name: '寮長', sprite: 'ryocho', taunts: 'ryocho', midboss: true, scale: 1.45, hp: 14, speed: 44, reach: 27, dmg: 1, kb: 115, cooldown: 0.72, telegraph: 0.44, score: 600 },
  kyoiku: { name: '教育担当課長', sprite: 'kyoiku', taunts: 'kyoiku', boss: true, scale: 1.7, hp: 20, speed: 42, reach: 29, dmg: 2, kb: 125, cooldown: 0.8, telegraph: 0.5, firstLine: '学生気分は、いつ抜けるんだ？', score: 1000 },

  // --- 第2章 M菱重工（同格。だが上から来る）---
  m_kikai:  { name: '機械設計', sprite: 'm_kikai',  taunts: 'm_kikai',  hp: 3, speed: 48, reach: 23, dmg: 1, kb: 95, cooldown: 0.75, telegraph: 0.42, score: 140 },
  m_denso:  { name: '電装担当', sprite: 'm_denso',  taunts: 'm_denso',  hp: 3, speed: 46, reach: 23, dmg: 1, kb: 95, cooldown: 0.78, telegraph: 0.44, score: 140 },
  m_sekkei: { name: '設計課長', sprite: 'm_sekkei', taunts: 'm_sekkei', midboss: true, scale: 1.5, hp: 18, speed: 46, reach: 27, dmg: 2, kb: 120, cooldown: 0.7, telegraph: 0.44, score: 700 },
  // 「載せてやっている」側。最初こちらを向かず、怯まない。
  m_pm: { name: 'M菱重工プロマネ', sprite: 'm_pm', taunts: 'm_pm', boss: true, scale: 1.8, hp: 30, speed: 44, reach: 30, dmg: 2, kb: 130, cooldown: 0.75, telegraph: 0.46, firstLine: 'うちは、予定どおりなんですけどね', score: 1500 },

  // --- 第3章 GR社（技術力が低い。作り直しの無限ループ）---
  gr_chotatsu: { name: 'GR社 調達', sprite: 'gr_chotatsu', taunts: 'gr_chotatsu', thrower: true, proj: 'paper', projRange: 260, throwCooldown: 2.2, hp: 3, speed: 38, reach: 21, dmg: 1, kb: 85, cooldown: 0.85, telegraph: 0.48, score: 150 },
  gr_gijutsu:  { name: 'GR社 技術', sprite: 'gr_gijutsu',  taunts: 'gr_gijutsu',  hp: 3, speed: 42, reach: 22, dmg: 1, kb: 90, cooldown: 0.8, telegraph: 0.46, score: 150 },
  gr_seizo:    { name: 'GR社 製造', sprite: 'gr_seizo', taunts: 'gr_seizo', midboss: true, scale: 1.5, hp: 16, speed: 44, reach: 27, dmg: 1, kb: 115, cooldown: 0.72, telegraph: 0.44, score: 700 },
  gr_pm: { name: 'GR社プロマネ', sprite: 'gr_pm', taunts: 'gr_pm', boss: true, scale: 1.8, hp: 32, speed: 40, reach: 30, dmg: 2, kb: 125, cooldown: 0.9, telegraph: 0.58, firstLine: "We're working on it.", score: 1800 },

  // --- 第4章 L社（技術力が高い。だが情報を出さない）---
  l_toiawase: { name: '技術問合せ', sprite: 'l_toiawase', taunts: 'l_toiawase', hp: 3, speed: 44, reach: 22, dmg: 1, kb: 90, cooldown: 0.78, telegraph: 0.44, score: 160 },
  l_yushutsu: { name: '輸出管理責任者', sprite: 'l_yushutsu', taunts: 'l_yushutsu', midboss: true, scale: 1.5, hp: 18, speed: 44, reach: 27, dmg: 2, kb: 120, cooldown: 0.7, telegraph: 0.44, score: 800 },
  // HPバーが出ない。食らいつき続けると途中で現れ、そこから普通に勝てる。
  l_pm: { name: 'L社プロマネ', sprite: 'l_pm', taunts: 'l_pm', boss: true, scale: 1.8, hp: 34, speed: 52, reach: 30, dmg: 2, kb: 130, cooldown: 0.7, telegraph: 0.44, hideHpBar: true, firstLine: 'その情報は提供できません', score: 2200 },

  // --- 第5章 LM社（技術力は高い。それでも完成しない）---
  lm_keiyaku: { name: 'LM社 契約', sprite: 'lm_keiyaku', taunts: 'lm_keiyaku', hp: 4, speed: 44, reach: 23, dmg: 1, kb: 95, cooldown: 0.76, telegraph: 0.44, score: 180 },
  lm_cr:      { name: '変更要求', sprite: 'lm_cr', taunts: 'lm_cr', thrower: true, proj: 'paper', projRange: 300, throwCooldown: 2.0, hp: 3, speed: 40, reach: 21, dmg: 1, kb: 85, cooldown: 0.8, telegraph: 0.46, score: 180 },
  lm_shiken:  { name: '試験', sprite: 'lm_shiken', taunts: 'lm_shiken', hp: 4, speed: 50, reach: 24, dmg: 2, kb: 105, cooldown: 0.7, telegraph: 0.4, score: 220 },
  lm_kanri:   { name: 'LM社 契約管理', sprite: 'lm_kanri', taunts: 'lm_kanri', midboss: true, scale: 1.55, hp: 20, speed: 46, reach: 28, dmg: 2, kb: 125, cooldown: 0.68, telegraph: 0.42, score: 900 },
  lm_pm: { name: 'LM社プロマネ', sprite: 'lm_pm', taunts: 'lm_pm', boss: true, scale: 1.95, hp: 40, speed: 48, reach: 32, dmg: 3, kb: 140, cooldown: 0.66, telegraph: 0.42, firstLine: "That's out of scope.", score: 3000 },

  // --- 代理店（商社）。攻撃してこないが、間に立つ ---
  dairiten: { name: '代理店', sprite: 'dairiten', taunts: 'dairiten', passive: true, elite: true, scale: 1.4, hp: 18, speed: 40, reach: 24, dmg: 0, kb: 100, cooldown: 0.9, telegraph: 0.5, score: 300 },

  // --- 最終章 発注官庁 ---
  kensakan: { name: '検査官', sprite: 'kensakan', taunts: 'kensakan', midboss: true, scale: 1.5, hp: 20, speed: 46, reach: 28, dmg: 2, kb: 125, cooldown: 0.68, telegraph: 0.42, score: 900 },
  kishi_kigen:     { name: '期限', sprite: 'kishi_kigen',     taunts: 'kishi_kigen',     elite: true, scale: 1.7, hp: 24, speed: 50, reach: 28, dmg: 2, kb: 130, cooldown: 0.66, telegraph: 0.4, score: 1200 },
  kishi_seinou:    { name: '性能', sprite: 'kishi_seinou',    taunts: 'kishi_seinou',    elite: true, scale: 1.7, hp: 24, speed: 46, reach: 28, dmg: 2, kb: 130, cooldown: 0.7, telegraph: 0.42, score: 1200 },
  kishi_sonshitsu: { name: '損失', sprite: 'kishi_sonshitsu', taunts: 'kishi_sonshitsu', elite: true, scale: 1.7, hp: 24, speed: 44, reach: 28, dmg: 2, kb: 130, cooldown: 0.72, telegraph: 0.44, score: 1200 },
  kishi_keisou:    { name: '係争', sprite: 'kishi_keisou',    taunts: 'kishi_keisou',    elite: true, scale: 1.75, hp: 30, speed: 48, reach: 30, dmg: 3, kb: 140, cooldown: 0.66, telegraph: 0.4, score: 1600 },
  kancho_pm: { name: '発注官庁 担当官', sprite: 'kancho_pm', taunts: 'kancho_pm', boss: true, scale: 2.0, hp: 48, speed: 48, reach: 32, dmg: 3, kb: 150, cooldown: 0.64, telegraph: 0.42, firstLine: '納入される見込みが、ないと判断しました', score: 6000 },
};

export function defFor2(type) {
  const base = UNIT_TYPES2[type];
  if (!base) throw new Error('unknown unit type (game2): ' + type);
  return { ...base, team: base.team || 'enemy' };
}

// 同期の並び（章をまたいで持ち越す。減ったら戻らない）
export const DOUKI_ORDER = ['douki_sekkei', 'douki_genba', 'douki_hinsho'];

// ===== 6章 =====
// chapter 固有キー:
//   noBetray   … 味方は絶対に裏切らない（全章 true）
//   douki      … 開始時に連れている同期の数（roster から先頭N人）
//   doukiJoin  … [{wave, type}] 波の開始時に加入
//   doukiLeave … [{wave, type}] 波の開始時に恒久離脱（roster からも消える）
//   soloBoss   … ボス戦の間、味方は画面端へ退避（英語の会議）
//   waitingRoom… { sec } 開幕の待合室フェーズ（敵が出ない・レターが溜まる）
//   agent      … ボス戦に代理店を同席させる（倒すまでボスの被ダメ半減）
//   bossRevive … ボスの復活回数（試験で裏切られる）
//   completion … 撃破時に「完成」を表示（第4章だけ）
//   gauges     … { kouki: bool, genka: bool }
//   slope      … 章間に出す坂の角度(0..1)
export const CHAPTERS = [
  {
    id: 1,
    name: '第1章 配属編',
    subtitle: '入社1年目',
    playerRank: '小向候補生',
    playerSprite: 'p2_shinjin',
    location: '研修センター 大講堂',
    intro: '入社。全員が同じ作業着で、同じ白いヘルメットで、番号で呼ばれる。\n名刺交換をやり直し、指差呼称をやり直し、「学生気分を捨てろ」と言われ続ける。',
    width: 1700,
    bg: { scene: 'meeting', wall: '#4a5058', floor: '#6c727a', detail: '#343a42', accent: '#b0b8c0' },
    noBetray: true,
    douki: 0,
    doukiJoin: [{ wave: 1, type: 'douki_genba' }, { wave: 2, type: 'douki_sekkei' }, { wave: 3, type: 'douki_hinsho' }],
    mobs: [{ type: 'tsukou', x: 300 }, { type: 'tsukou', x: 900 }],
    waves: [
      { x: 360, label: 'ビジネスマナー研修', enemies: [{ type: 'manner', count: 1 }, { type: 'jinji', count: 2 }] },
      { x: 720, label: '安全衛生講習', enemies: [{ type: 'anzen', count: 2 }, { type: 'jinji', count: 2 }] },
      { x: 1080, label: '独身寮 寮長 出現！', enemies: [{ type: 'ryocho', count: 1 }] },
      { x: 1330, label: '配属面談 待合', enemies: [{ type: 'jinji', count: 3 }] },
    ],
    boss: { type: 'kyoiku', x: 1560 },
    clearLine: '……今年のは、しぶといな',
    outro: '配属発表。同じ色だったヘルメットが、それぞれの部署の色に分かれる。\n4人はバラバラの部署へ散っていった。',
    slope: 0.0,
  },
  {
    id: 2,
    name: '第2章 M菱重工編',
    subtitle: '入社2〜3年目 — 載せる側と、載る側',
    playerRank: '小向新兵',
    playerSprite: 'p2_haizoku',
    location: 'M菱重工 大会議室',
    intro: 'こちらはレーダー、向こうは機体。互いに官庁と直接契約していて、上下関係はない。\nつまり誰も相手に命令できない。重量が超過し、電力が足りず、寸法が合わない。\n——どちらが合わせるのかを、延々と決められない。',
    width: 1800,
    bg: { scene: 'meeting', wall: '#3c4650', floor: '#586470', detail: '#2a323c', accent: '#8a96a4' },
    noBetray: true,
    douki: 3,
    gauges: { kouki: true },
    mobs: [{ type: 'chukan', x: 260 }, { type: 'chukan', x: 640 }, { type: 'tsukou', x: 1100 }],
    waves: [
      { x: 380, label: '機械設計・重量調整', enemies: [{ type: 'm_kikai', count: 2 }, { type: 'm_denso', count: 1 }] },
      { x: 760, label: '電装・熱設計', enemies: [{ type: 'm_denso', count: 2 }, { type: 'm_kikai', count: 1 }] },
      { x: 1050, label: '機体側 設計課長 出現！', enemies: [{ type: 'm_sekkei', count: 1 }] },
      { x: 1320, label: '帰社 — PM（課長）', enemies: [{ type: 'pm', count: 1 }] },
    ],
    boss: { type: 'm_pm', x: 1700 },
    bossFaceLock: true, // 最初こちらを向かない・怯まない
    clearLine: '……あの若いの、何度突き返しても持ってくるな',
    slope: 0.2,
  },
  {
    id: 3,
    name: '第3章 GR社編',
    subtitle: '入社3年目 — 待たされる（支援）',
    playerRank: '小向新兵',
    playerSprite: 'p2_haizoku',
    location: 'GR社 工場 待合室',
    intro: '主要機器の供給元。技術力が低く、モノが完成しない。作っては壊れ、作り直し、また壊れる。\nそして扱いがひどい。金を払っているのはこちらなのに、\n肌寒いタイル張りの待合室で、何時間も待たされる。',
    width: 1800,
    bg: { scene: 'factory', wall: '#3e4248', floor: '#5c6068', detail: '#2c3036', accent: '#8e9298' },
    noBetray: true,
    douki: 3,
    support: 'shutantou', // 支援章: 主担当が同行する
    gauges: { kouki: true, letter: true },
    waitingRoom: { sec: 18 }, // 敵が出ない。レターが溜まる。残工期は減る
    soloBoss: true,
    agent: true,
    mobs: [{ type: 'tsukou', x: 520 }],
    waves: [
      { x: 420, label: '不具合説明', enemies: [{ type: 'gr_gijutsu', count: 2 }, { type: 'gr_chotatsu', count: 1 }] },
      { x: 800, label: '再試作 — また作り直し', enemies: [{ type: 'gr_gijutsu', count: 2 }, { type: 'gr_chotatsu', count: 2 }] },
      { x: 1080, label: 'GR社 製造部門 出現！', enemies: [{ type: 'gr_seizo', count: 1 }] },
      { x: 1340, label: '帰社 — PM（課長）', enemies: [{ type: 'pm', count: 1 }] },
    ],
    boss: { type: 'gr_pm', x: 1700 },
    clearLine: '……あの日本人、また手紙を書いたらしいぞ',
    slope: 0.4,
  },
  {
    id: 4,
    name: '第4章 L社編',
    subtitle: '入社4年目 — 担当は自分ひとり',
    playerRank: '小向兵士',
    playerSprite: 'p2_haizoku',
    location: 'L社 立入制限エリア',
    intro: '技術力はある。作れる会社だ。だが情報を出さない。\n規制でインターフェース仕様さえ十分に出てこない。中身の分からない箱に合わせて設計する。\n——そして、この相手の担当は自分ひとり。逃げ場がない。',
    width: 1750,
    bg: { scene: 'office', wall: '#2c3350', floor: '#465070', detail: '#1e2438', accent: '#7a86c0' },
    noBetray: true,
    douki: 3,
    doukiLeave: [{ wave: 3, type: 'douki_hinsho' }], // 朝、来たらいなかった
    gauges: { kouki: true },
    soloBoss: true,
    agent: true,
    completion: true, // 2で唯一「完成」が出る章
    mobs: [{ type: 'chukan', x: 300 }],
    waves: [
      { x: 380, label: '輸出管理', enemies: [{ type: 'l_toiawase', count: 2 }] },
      { x: 740, label: '技術問合せ — 回答不可', enemies: [{ type: 'l_toiawase', count: 3 }] },
      { x: 1020, label: '輸出管理責任者 出現！', enemies: [{ type: 'l_yushutsu', count: 1 }] },
      { x: 1300, label: '帰社 — PM（課長）', enemies: [{ type: 'pm', count: 1 }] },
    ],
    boss: { type: 'l_pm', x: 1660 },
    clearLine: '……あいつら、何度潰しても立ってくるぞ',
    outro: '納期は遅れた。コストも少し上がった。\nだが——完成した。5年でひとつだけ、自分の手でやりきったもの。',
    slope: 0.6,
  },
  {
    id: 5,
    name: '第5章 LM社編',
    subtitle: '入社4〜5年目 — 設計が、試験に裏切られる（支援）',
    playerRank: '小向兵士',
    playerSprite: 'p2_haizoku',
    location: 'LM社 組立工場（米国）',
    intro: '技術力はある。設計もできる。人も揃っている。それでも完成しない。\n設計は通る。だが試験で裏切られる。壊れる。作り直し。\n納得がいかず設計方針に口を出すと——「That\'s out of scope.」そして追加費用を要求される。',
    width: 1900,
    bg: { scene: 'office_win', wall: '#2e3448', floor: '#4c5468', detail: '#1e2230', accent: '#c0a040' },
    noBetray: true,
    douki: 2,
    doukiLeave: [{ wave: 4, type: 'douki_genba' }], // 帰国後、異動。見送りもない
    support: 'shutantou',
    gauges: { kouki: true, genka: true }, // 原価バーはここで出現
    soloBoss: true,
    agent: true,
    bossRevive: 2, // 試験で裏切られる → 作り直し
    mobs: [{ type: 'tsukou', x: 420 }, { type: 'tsukou', x: 1150 }],
    waves: [
      { x: 400, label: '設計レビュー', enemies: [{ type: 'lm_keiyaku', count: 2 }, { type: 'lm_cr', count: 1 }] },
      { x: 780, label: '試験 — 壊れる', enemies: [{ type: 'lm_shiken', count: 3 }] },
      { x: 1060, label: 'LM社 契約管理 出現！', enemies: [{ type: 'lm_kanri', count: 1 }, { type: 'lm_cr', count: 2 }] },
      { x: 1340, label: '作り直し', enemies: [{ type: 'lm_shiken', count: 2 }, { type: 'lm_keiyaku', count: 2 }] },
      { x: 1560, label: '帰社 — PM（課長）', enemies: [{ type: 'pm', count: 1 }] },
    ],
    boss: { type: 'lm_pm', x: 1800 },
    bossFaceLock: true,
    clearLine: '……金の世代、か。そう呼ばれてたらしいぞ、あいつら',
    slope: 0.82,
  },
  {
    id: 6,
    name: '最終章 発注官庁編',
    subtitle: '入社5年目 — 解散の日',
    playerRank: '小向古参兵',
    playerSprite: 'p2_haizoku',
    location: '60号5階 会議室',
    intro: '残工期はもう無い。原価は膨れきっている。装置は動くが、要求性能には届かない。\n納期の延長を願い出る。何度も、何度も。',
    width: 1900,
    bg: { scene: 'meeting', wall: '#33383c', floor: '#4e545a', detail: '#22262a', accent: '#7a8088' },
    bossLocation: '60号1階 大会議室',
    bossBg: { scene: 'boardroom', wall: '#1c1726', floor: '#2c2640', detail: '#120d1a', accent: '#c79a3a' },
    noBetray: true,
    douki: 1,
    doukiLeave: [], // 最後の1人はエンディングで連れて行かれる
    gauges: { kouki: true, genka: true },
    mobs: [{ type: 'chukan', x: 280 }, { type: 'chukan', x: 700 }, { type: 'chukan', x: 1150 }],
    waves: [
      { x: 380, label: '再設計審査', enemies: [{ type: 'l_toiawase', count: 2 }, { type: 'lm_cr', count: 2 }] },
      { x: 760, label: 'リカバリプラン', enemies: [{ type: 'lm_keiyaku', count: 2 }, { type: 'm_kikai', count: 2 }] },
      { x: 1040, label: '検査官 出現！', enemies: [{ type: 'kensakan', count: 1 }] },
      { x: 1360, label: '四騎士 出現！', enemies: [
        { type: 'kishi_kigen', count: 1 }, { type: 'kishi_seinou', count: 1 }, { type: 'kishi_sonshitsu', count: 1 },
      ] },
    ],
    boss: { type: 'kancho_pm', x: 1800 },
    coBoss: 'kishi_keisou',
    clearLine: '',
    slope: 1.0,
    final: true,
  },
];

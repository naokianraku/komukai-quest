// コンテンツ定義: 敵/味方のステータスと、4段階の出世ステージ
// （世界観は東芝 小向工場の技術者の風刺。敵=上司/部下/客/ベンダー/スタッフ部門）

// 種別ごとの基礎ステータス（Char のコンストラクタが解釈する def）
export const UNIT_TYPES = {
  // 雑魚
  buka:   { name: '部下',        sprite: 'buka',   taunts: 'buka',   hp: 2, speed: 52, reach: 22, dmg: 1, kb: 90,  cooldown: 0.7, telegraph: 0.40, score: 80 },
  senpai: { name: '先輩戦士',    sprite: 'senpai', taunts: 'senpai', hp: 3, speed: 46, reach: 24, dmg: 1, kb: 100, cooldown: 0.8, telegraph: 0.44, score: 120 },
  staff:  { name: 'スタッフ部門', sprite: 'staff',  taunts: 'staff',  hp: 3, speed: 36, reach: 20, dmg: 1, kb: 80,  cooldown: 0.9, telegraph: 0.46, thrower: true, score: 140 },
  dr:     { name: '設計審査委員', sprite: 'dr',     taunts: 'dr',     hp: 3, speed: 42, reach: 23, dmg: 1, kb: 100, cooldown: 0.7, telegraph: 0.46, score: 200 },
  exctrl: { name: '輸出管理',     sprite: 'exctrl', taunts: 'exctrl', hp: 3, speed: 38, reach: 21, dmg: 1, kb: 90,  cooldown: 0.8, telegraph: 0.46, score: 200 },
  kyaku:  { name: '客',          sprite: 'kyaku',  taunts: 'kyaku',  hp: 2, speed: 66, reach: 22, dmg: 2, kb: 110, cooldown: 0.7, telegraph: 0.36, score: 120 },
  vendor: { name: '調達先ベンダー', sprite: 'vendor', taunts: 'vendor', hp: 4, speed: 44, reach: 24, dmg: 1, kb: 90,  cooldown: 0.8, telegraph: 0.44, score: 160 },
  // 携行ミサイル兵: 遠距離から誘導弾を撃つ射手（防衛工場ネタ）。離れて撃つカイト型。ジャンプで回避可。
  missile: { name: '携行ミサイル兵', sprite: 'missile', taunts: 'missile', hp: 3, speed: 34, reach: 20, dmg: 1, kb: 80, cooldown: 0.9, telegraph: 0.5, thrower: true, proj: 'missile', projRange: 340, throwCooldown: 2.4, score: 240 },

  // PMR（プロジェクトマネジメント審査会）: 部長たちの徒党。生産部長が最強、他は少し弱め。
  pmr_seisan:    { name: '生産部長',     sprite: 'pmr_seisan',    taunts: 'pmr', hp: 8, speed: 44, reach: 26, dmg: 2, kb: 120, cooldown: 0.7,  telegraph: 0.44, score: 400 },
  pmr_seizou:    { name: '製造部長',     sprite: 'pmr_seizou',    taunts: 'pmr', hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_choutatsu: { name: '調達部長',     sprite: 'pmr_choutatsu', taunts: 'pmr', hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_gijutsu:   { name: '技術管理部長', sprite: 'pmr_gijutsu',   taunts: 'pmr', hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_hinshou:   { name: '品証部長',     sprite: 'pmr_hinshou',   taunts: 'pmr', hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },

  // 出向先（関連会社）
  kanren:  { name: '関連会社社員', sprite: 'kanren',  taunts: 'kanren',  hp: 3, speed: 46, reach: 22, dmg: 1, kb: 90,  cooldown: 0.8,  telegraph: 0.4,  score: 120 },
  shukkou: { name: '出向先上長',   sprite: 'shukkou', taunts: 'shukkou', hp: 8, speed: 42, reach: 26, dmg: 2, kb: 120, cooldown: 0.7,  telegraph: 0.46, score: 400 },
  // 関連会社社長: 見た目は怖い（黒スーツ/白髪/日焼け/赤目）。能力は普通の部長級。
  shacho:  { name: '関連会社社長', sprite: 'shacho',  taunts: 'shacho',  boss: true, scale: 2.0, hp: 14, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.8, telegraph: 0.46, score: 1500 },

  // 味方（同じプロジェクトのメンバー）
  ally:   { name: '同僚',        sprite: 'ally',   team: 'ally', hp: 5, speed: 62, reach: 23, dmg: 1, kb: 90, cooldown: 0.55, telegraph: 0.22, score: 0 },

  // ボス: 工場内の三大ボス（生産部長/技師長/工場長）＋ 真のボス（事業部長）
  boss1: { name: '生産部長', sprite: 'boss1', taunts: 'boss_seisan', boss: true, scale: 1.6, hp: 22, speed: 40, reach: 30, dmg: 2, kb: 130, cooldown: 0.8,  telegraph: 0.50, score: 1000 },
  boss2: { name: '技師長',   sprite: 'boss2', taunts: 'boss_gishi',  boss: true, scale: 1.6, hp: 30, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.8,  telegraph: 0.48, thrower: true, score: 1500 },
  boss3: { name: '工場長',   sprite: 'boss3', taunts: 'boss_kojo',   boss: true, scale: 1.7, hp: 40, speed: 44, reach: 32, dmg: 2, kb: 140, cooldown: 0.75, telegraph: 0.46, score: 2000 },
  boss4: { name: '事業部長（真のボス）', sprite: 'boss4', taunts: 'boss_jigyo', boss: true, scale: 1.85, hp: 58, speed: 50, reach: 34, dmg: 3, kb: 160, cooldown: 0.65, telegraph: 0.42, thrower: true, score: 5000 },
};

export function defFor(type) {
  const base = UNIT_TYPES[type];
  if (!base) throw new Error('unknown unit type: ' + type);
  return { ...base, team: base.team || 'enemy' };
}

// 4ステージ。波(waves)を殲滅すると前進ロックが解除され、最後にボス。
export const STAGES = [
  {
    id: 1,
    name: '戦士編 — 新プロジェクト配属',
    playerRank: '小向戦士',
    location: '60号7階',
    intro: '入社5年目。新プロジェクトに配属、PM担当に任命された。\n設計審査（ランクB）を退け、生産部長を倒せ。',
    width: 1700,
    bg: { scene: 'factory', wall: '#262b33', floor: '#373d46', detail: '#191e25', accent: '#5a6470' },
    waves: [
      { x: 380, enemies: [{ type: 'staff', count: 2 }, { type: 'senpai', count: 1 }] },
      { x: 760, enemies: [{ type: 'senpai', count: 1 }, { type: 'staff', count: 2 }] },
      { x: 1180, label: '設計審査（ランクB）出現！', enemies: [{ type: 'dr', count: 5 }] },
    ],
    allies: [{ type: 'ally', x: 120, betrayer: false }, { type: 'ally', x: 175, betrayer: false }],
    boss: { type: 'boss1', x: 1500 },
  },
  {
    id: 2,
    name: '小隊長編 — スタッフ部門フロア',
    playerRank: '小向小隊長',
    location: '60号6階',
    intro: '小隊長（主務級）に昇進。スタッフ部門と無茶振りの客が襲う。\n技師長を超えろ。頼れる相棒…のはずが？',
    width: 1700,
    bg: { scene: 'office', wall: '#3a4450', floor: '#5a6470', detail: '#2a323c', accent: '#8a96a4' },
    waves: [
      { x: 380, enemies: [{ type: 'staff', count: 2 }, { type: 'kyaku', count: 1 }] },
      { x: 780, enemies: [{ type: 'staff', count: 1 }, { type: 'buka', count: 2 }] },
      { x: 1200, label: '輸出管理チーム出現！', enemies: [{ type: 'exctrl', count: 5 }] },
    ],
    allies: [
      { type: 'ally', x: 120, betrayer: true, trigger: { type: 'x', value: 820 } }, // 他部署に引き抜かれ裏切る
      { type: 'ally', x: 175, betrayer: false },
    ],
    boss: { type: 'boss2', x: 1600 },
  },
  {
    id: 3,
    name: '大隊長編 — 調達・渉外フロア',
    playerRank: '小向大隊長',
    location: '60号5階',
    intro: '大隊長（EX級）へ。ベンダーと「PMR審査会」が詰めてくる。\n工場長を倒せ。協力会社は味方か？',
    width: 1750,
    bg: { scene: 'meeting', wall: '#3c4640', floor: '#566058', detail: '#28302a', accent: '#8aa090' },
    door: { x: 1050 }, // 「出向」の扉（触れると関連会社サブステージへ）
    waves: [
      { x: 380, enemies: [{ type: 'vendor', count: 2 }, { type: 'kyaku', count: 1 }] },
      { x: 800, enemies: [{ type: 'vendor', count: 2 }, { type: 'missile', count: 1 }, { type: 'staff', count: 1 }] },
      { x: 1250, label: 'プロジェクトマネージメント審査会（PMR）', enemies: [
        { type: 'pmr_seisan', count: 1 }, { type: 'pmr_seizou', count: 1 }, { type: 'pmr_choutatsu', count: 1 },
        { type: 'pmr_gijutsu', count: 1 }, { type: 'pmr_hinshou', count: 1 },
      ] },
    ],
    allies: [
      { type: 'ally', x: 120, betrayer: true, trigger: { type: 'bossHp', value: 0.5 } }, // 手のひら返し
      { type: 'ally', x: 175, betrayer: false },
    ],
    boss: { type: 'boss3', x: 1650 },
  },
  {
    id: 4,
    name: '司令官編 — 経営フロア',
    playerRank: '小向司令官',
    location: '工場長室',
    bossLocation: '本社', // 事業部長が出現したら本社へ
    intro: '司令官（課長級）に到達。役員会議室で工場長の上の真のボス「事業部長」が待つ。\n全部署と経営層を蹴散らし頂点を獲れ。最後の味方も…信じられるか？',
    width: 1850,
    bg: { scene: 'boardroom', wall: '#1c1726', floor: '#2c2640', detail: '#120d1a', accent: '#c79a3a' },
    waves: [
      { x: 380, enemies: [{ type: 'staff', count: 2 }, { type: 'vendor', count: 1 }, { type: 'kyaku', count: 1 }] },
      { x: 820, enemies: [{ type: 'vendor', count: 2 }, { type: 'missile', count: 1 }, { type: 'staff', count: 1 }] },
      { x: 1300, enemies: [{ type: 'kyaku', count: 2 }, { type: 'missile', count: 2 }, { type: 'vendor', count: 1 }] },
    ],
    allies: [
      { type: 'ally', x: 120, betrayer: true, trigger: { type: 'time', value: 16 } }, // 最後の味方も裏切る
      { type: 'ally', x: 175, betrayer: false },
    ],
    boss: { type: 'boss4', x: 1750 },
  },
];

// 出向サブステージ（Stage3の「出向」扉から分岐。クリアで本社=Stage3へ帰還）
export const SHUKKOU_STAGE = {
  id: 'shukkou',
  name: '出向編 — 関連会社',
  playerRank: '大隊長（出向中）',
  location: '62号6階',
  intro: '「出向」の扉に触れた——関連会社へ出向となった。\n社員と出向先上長、そして“顔が怖い”関連会社社長を倒し、本社へ戻れ。',
  width: 1500,
  bg: { scene: 'office', wall: '#2e3640', floor: '#48525e', detail: '#1f262e', accent: '#7a8a9a' },
  waves: [
    { x: 360, enemies: [{ type: 'kanren', count: 3 }] },
    { x: 780, label: '出向先上長 登場', enemies: [{ type: 'kanren', count: 2 }, { type: 'shukkou', count: 1 }] },
  ],
  allies: [],
  boss: { type: 'shacho', x: 1400 },
};

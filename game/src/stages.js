// コンテンツ定義: 敵/味方のステータスと、4段階の出世ステージ
// （世界観はT芝K向工場の技術者の風刺。敵=上司/部下/客/ベンダー/スタッフ部門）

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

  // PMR（プロジェクトマネジメント審査会）: 部長たちの徒党。生産部長が最強、他は少し弱め。elite=地獄でも増殖しない。
  pmr_seisan:    { name: '生産部長',     sprite: 'pmr_seisan',    taunts: 'pmr', elite: true, hp: 8, speed: 44, reach: 26, dmg: 2, kb: 120, cooldown: 0.7,  telegraph: 0.44, score: 400 },
  pmr_seizou:    { name: '製造部長',     sprite: 'pmr_seizou',    taunts: 'pmr', elite: true, hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_choutatsu: { name: '調達部長',     sprite: 'pmr_choutatsu', taunts: 'pmr', elite: true, hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_gijutsu:   { name: '技術管理部長', sprite: 'pmr_gijutsu',   taunts: 'pmr', elite: true, hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },
  pmr_hinshou:   { name: '品証部長',     sprite: 'pmr_hinshou',   taunts: 'pmr', elite: true, hp: 5, speed: 40, reach: 24, dmg: 1, kb: 100, cooldown: 0.85, telegraph: 0.5,  score: 250 },

  // 出向先（関連会社）
  kanren:  { name: '関連会社社員', sprite: 'kanren',  taunts: 'kanren',  hp: 3, speed: 46, reach: 22, dmg: 1, kb: 90,  cooldown: 0.8,  telegraph: 0.4,  score: 120 },
  shukkou: { name: '出向先上長',   sprite: 'shukkou', taunts: 'shukkou', elite: true, hp: 8, speed: 42, reach: 26, dmg: 2, kb: 120, cooldown: 0.7,  telegraph: 0.46, score: 400 },
  // 関連会社社長: 見た目は怖い（黒スーツ/白髪/日焼け/赤目）。能力は普通の部長級。
  shacho:  { name: '関連会社社長', sprite: 'shacho',  taunts: 'shacho',  boss: true, scale: 2.2, hp: 14, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.8, telegraph: 0.46, score: 1500 },

  // 味方（同じプロジェクトのメンバー）
  ally:   { name: '同僚',        sprite: 'ally',   team: 'ally', taunts: 'ally', hp: 5, speed: 62, reach: 23, dmg: 1, kb: 90, cooldown: 0.55, telegraph: 0.22, score: 0 },

  // ボス: 工場内の三大ボス（生産部長/技師長/工場長）＋ 真のボス（事業部長）
  boss1: { name: '生産部長', sprite: 'boss1', taunts: 'boss_seisan', boss: true, scale: 1.6, hp: 22, speed: 40, reach: 30, dmg: 2, kb: 130, cooldown: 0.8,  telegraph: 0.50, score: 1000 },
  // 技術部長（Stage1ボス・セリフは生産部長と同じ）
  boss_gijutsubu: { name: '技術部長', sprite: 'boss_gijutsubu', taunts: 'boss_seisan', firstLine: '事前配布資料はもう用意できたか？', boss: true, scale: 1.8, hp: 22, speed: 40, reach: 30, dmg: 2, kb: 130, cooldown: 0.8, telegraph: 0.50, lastLine: 'おれもこれまでか。もう子会社転籍か。。', score: 1000 },
  // 生産部長（Stage2で技師長と一緒に出る・非ボスの強敵）
  seisan: { name: '生産部長', sprite: 'seisan', taunts: 'boss_seisan', scale: 1.6, hp: 12, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.75, telegraph: 0.46, score: 500 },
  // 技術管理部長（Stage2で技師長と一緒に出る・セリフは技術部長/生産部長と同じ boss_seisan）
  gijutsukanri: { name: '技術管理部長', sprite: 'pmr_gijutsu', taunts: 'boss_seisan', scale: 1.6, hp: 12, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.75, telegraph: 0.46, score: 500 },
  boss2: { name: '技師長',   sprite: 'boss2', taunts: 'boss_gishi',  firstLine: '事前配布資料にコメントしたけど、本番で全部回答しろよ', boss: true, scale: 1.8, hp: 30, speed: 42, reach: 30, dmg: 2, kb: 130, cooldown: 0.8,  telegraph: 0.48, thrower: true, lastLine: '今後も、しっかりとコスト管理をよろしくお願いします', score: 1500 },
  boss3: { name: '工場長',   sprite: 'boss3', taunts: 'boss_kojo',   firstLine: '安全とコンプライアンスはすべてに優先する！', boss: true, scale: 1.9, hp: 40, speed: 44, reach: 32, dmg: 2, kb: 140, cooldown: 0.75, telegraph: 0.46, lastLine: 'お前もこの立場になればわかる', score: 2000 },
  boss4: { name: '事業部長（真のボス）', sprite: 'boss4', taunts: 'boss_jigyo', firstLine: '売上あげろ！利益確保しろ！納期守れ！コスト下げろ！', boss: true, scale: 2.05, hp: 58, speed: 50, reach: 34, dmg: 3, kb: 160, cooldown: 0.65, telegraph: 0.42, thrower: true, lastLine: '究極のジェネラリストを目指していたが、俺もここまでか', score: 5000 },
  // 企画部長（事業部長と同時出現・セリフは事業部長と同じ boss_jigyo）
  kikakubucho: { name: '企画部長', sprite: 'kikakubucho', taunts: 'boss_jigyo', scale: 1.85, hp: 16, speed: 48, reach: 32, dmg: 2, kb: 140, cooldown: 0.7, telegraph: 0.44, score: 800 },

  // 中ボス（道中の強敵。midboss=地獄でも増殖しない。セリフは後から セリフ一覧.md の同名カテゴリに追記可）
  kanrik:    { name: '管理担当K',    sprite: 'kanrik',    taunts: 'kanrik',    midboss: true, scale: 1.5, hp: 18, speed: 46, reach: 28, dmg: 2, kb: 120, cooldown: 0.7, telegraph: 0.44,
               lastLine: '第二、第三の黒目が必ずやお前を倒すだろう',
               heir: 'kanrik_son', score: 700 }, // Stage2 中ボス。言い終わって崩れたあと、息子が出てくる
  // 管理担当Kの息子。父を倒したその場に現れる。若いぶん速いが、体力は父より軽い。
  // セリフは本人ゆずりの一言だけ（増やすときは セリフ一覧.md の kanrik_son に追記）。
  // K目息子。小学生。通学帽とランドセルで、父（黒ヘルメットの作業着）と対になる。
  // 体は大人より小さいぶん速い。背負い物は3D版だけ（2D版はドット絵なので帽子までで表現）。
  kanrik_son:{ name: 'K目息子', sprite: 'kanrik_son', taunts: 'kanrik_son', midboss: true, scale: 0.8, hp: 14, speed: 58, reach: 26, dmg: 2, kb: 110, cooldown: 0.58, telegraph: 0.36,
               satchel: true, firstLine: '俺が黒目だ！', score: 500 },
  // 生産企画課長（中村）: 一升瓶を山なりに投げる。投げるのは近すぎない間合いのときだけ。
  // 間合いに入られたら瓶を振り回す（swing）。遅くて広くて重い、見てからかわす大振り。
  seikikaku: { name: '生産企画課長', sprite: 'seikikaku', taunts: 'seikikaku', midboss: true, scale: 1.5, hp: 18, speed: 46, reach: 28, dmg: 2, kb: 120, cooldown: 0.7, telegraph: 0.44,
               thrower: true, proj: 'sake', projRange: 200, throwCooldown: 1.5,
               swing: { first: 2.6, every: 4.4, telegraph: 0.62, active: 0.34, recover: 0.95, dmg: 3, kb: 215 },
               lastLine: '鹿島田のエンジェルで待っている',
               score: 700 }, // Stage3 中ボス

  // 裏ステージ（事業部長撃破後の真・最終決戦／業火の60号7階Aゾーン）
  // Y下5人衆（一人ずつ別キャラ）。N村=生産企画課長／K目=管理担当K の再登場（セリフ流用）。
  shitennou_nmura: { name: 'N村', sprite: 'shitennou_nmura', taunts: 'seikikaku', elite: true, scale: 1.6, hp: 22, speed: 46, reach: 28, dmg: 2, kb: 130, cooldown: 0.7, telegraph: 0.44,
                     thrower: true, proj: 'sake', projRange: 200, throwCooldown: 1.4,
                     swing: { first: 2.2, every: 3.8, telegraph: 0.58, active: 0.34, recover: 0.85, dmg: 3, kb: 230 },
                     score: 1200 }, // 生産企画課長と同一人物＝同じく一升瓶を投げる（裏では振りも速い）
  shitennou_kme:   { name: 'K目', sprite: 'shitennou_kme',   taunts: 'kanrik',    elite: true, scale: 1.6, hp: 22, speed: 46, reach: 28, dmg: 2, kb: 130, cooldown: 0.7, telegraph: 0.44, score: 1200 },
  // S田・H本は攻撃してこない（passive）が体力多め。セリフは「。。。」のみ。
  shitennou_sda:   { name: 'S田', sprite: 'shitennou_sda',   taunts: 'sda',   elite: true, passive: true, scale: 1.6, hp: 40, speed: 40, reach: 26, dmg: 0, kb: 110, cooldown: 0.9, telegraph: 0.5, score: 1000 },
  shitennou_hmoto: { name: 'H本', sprite: 'shitennou_hmoto', taunts: 'hmoto', elite: true, passive: true, scale: 1.6, hp: 40, speed: 40, reach: 26, dmg: 0, kb: 110, cooldown: 0.9, telegraph: 0.5, score: 1000 },
  // H野: 5人目。殴り役2人・壁役2人に対して、速いが脆い詰め役。
  // セリフは共通の shitennou カテゴリ（あとで H野 専用に差し替え可）。
  shitennou_hno:   { name: 'H野', sprite: 'shitennou_hno',   taunts: 'hno',       elite: true, scale: 1.55, hp: 16, speed: 60, reach: 26, dmg: 2, kb: 120, cooldown: 0.55, telegraph: 0.34, score: 1100 },
  // 魔王Y下: 手近なものを何でも投げてくる（鉄パイプ→鉄アレイ→パソコンの順に持ち替える）。
  // さらに大技「メテオ」。床に印を出してから彗星を5発落とす。印が出ている間に走れば必ず逃げられる。
  maou:      { name: '魔王Y下',   sprite: 'maou',      taunts: 'maou',      boss: true, scale: 2.3, hp: 72, speed: 50, reach: 34, dmg: 3, kb: 170, cooldown: 0.62, telegraph: 0.4,
               thrower: true, proj: 'junk', projRange: 200, throwCooldown: 1.9,
               // ff=true: 5人衆もろとも巻き込む。降らせた本人だけは当たらない。
               // 連発させるので間隔を詰め、1回の本数も増やしてある。
               meteor: { n: 7, first: 3.2, every: 5.2, cast: 1.5, fall: 1.3, dmg: 2, kb: 190, radius: 42, ff: true },
               lastLine: 'もうわかっていると思うけど、私倒しても何も解決しないから', downDur: 4.0,
               bodyW: 1.3, bodyH: 0.94,   // 3D版の体型: 横に広く、少し低い（太っちょ）
               score: 12000 },
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
    location: '60号7階Cゾーン（技術部）',
    intro: '入社5年目。新プロジェクトに配属、PM担当に任命された。\n設計審査（ランクB）を退け、技術部長を倒せ。',
    width: 1700,
    bg: { scene: 'office_win', wall: '#36404c', floor: '#5a6470', detail: '#1d2530', accent: '#8a96a4' },
    waves: [
      { x: 380, enemies: [{ type: 'staff', count: 2 }, { type: 'senpai', count: 1 }] },
      { x: 760, enemies: [{ type: 'senpai', count: 1 }, { type: 'staff', count: 2 }] },
      { x: 1180, label: '設計審査（ランクB）出現！', enemies: [{ type: 'dr', count: 5 }] },
    ],
    allies: [{ type: 'ally', x: 120, betrayer: false }, { type: 'ally', x: 175, betrayer: false }, { type: 'ally', x: 230, betrayer: false }],
    boss: { type: 'boss_gijutsubu', x: 1500 },
  },
  {
    id: 2,
    name: '小隊長編 — 技術管理部フロア',
    playerRank: '小向小隊長',
    location: '60号7階Dゾーン（技術管理部）',
    intro: '小隊長（主務級）に昇進。スタッフ部門と無茶振りの客が襲う。',
    width: 1700,
    bg: { scene: 'office', wall: '#3a4450', floor: '#5a6470', detail: '#2a323c', accent: '#8a96a4' },
    waves: [
      { x: 380, enemies: [{ type: 'staff', count: 2 }, { type: 'kyaku', count: 1 }] },
      { x: 780, enemies: [{ type: 'staff', count: 1 }, { type: 'buka', count: 2 }] },
      { x: 1000, label: '中ボス 管理担当K 出現！', enemies: [{ type: 'kanrik', count: 1 }] },
      { x: 1200, label: '輸出管理チーム出現！', enemies: [{ type: 'exctrl', count: 5 }] },
    ],
    allies: [
      { type: 'ally', x: 120, betrayer: true, trigger: { type: 'x', value: 820 } }, // 他部署に引き抜かれ裏切る
      { type: 'ally', x: 175, betrayer: false },
      { type: 'ally', x: 230, betrayer: false },
    ],
    boss: { type: 'boss2', x: 1600 },
    // 3D版だけ、ステージの途中で場面が変わる（中ボスは昼の食堂で捕まる）。
    // 2D版はこのキーを見ないので背景も挙動も変わらない。
    scenes3d: [
      { x: 880, scene: 'shokudo', label: '構内食堂' },
      { x: 1130, scene: 'office', label: '60号7階Dゾーン（技術管理部）' },
    ],
    coBoss: 'gijutsukanri', // 技師長と一緒に技術管理部長も出現
  },
  {
    id: 3,
    name: '大隊長編 — 生産管理・生産企画フロア',
    playerRank: '小向大隊長',
    location: '60号5階',
    intro: '大隊長（EX級）へ。生管スタッフと「PMR審査会」が詰めてくる。\n工場長を倒せ。',
    width: 1750,
    bg: { scene: 'meeting', wall: '#3c4640', floor: '#566058', detail: '#28302a', accent: '#8aa090' },
    door: { x: 1050 }, // 「出向」の札（2D＝壁の扉／3D＝稲荷の鳥居。触れると関連会社サブステージへ）
    waves: [
      { x: 380, enemies: [{ type: 'vendor', count: 1 }, { type: 'staff', count: 2 }, { type: 'kyaku', count: 1 }] },
      { x: 800, enemies: [{ type: 'staff', count: 2 }, { type: 'vendor', count: 1 }, { type: 'missile', count: 1 }] },
      { x: 1000, label: '中ボス 生産企画課長 出現！', enemies: [{ type: 'seikikaku', count: 1 }] },
      { x: 1250, label: 'プロジェクトマネージメント審査会（PMR）', enemies: [
        { type: 'pmr_seisan', count: 1 }, { type: 'pmr_seizou', count: 1 }, { type: 'pmr_choutatsu', count: 1 },
        { type: 'pmr_gijutsu', count: 1 }, { type: 'pmr_hinshou', count: 1 },
      ] },
    ],
    allies: [
      { type: 'ally', x: 120, betrayer: true, trigger: { type: 'bossHp', value: 0.5 } }, // 手のひら返し
      { type: 'ally', x: 175, betrayer: false },
      { type: 'ally', x: 230, betrayer: false },
    ],
    boss: { type: 'boss3', x: 1650 },
    // 3D版でボス戦の場面が切り替わる（工場の守り神の前で、工場の長と戦う）。
    // 2D版はこのキーを見ないので挙動は変わらない。
    // PMR審査会を抜けると建屋を出て、構内道路を通って稲荷社へ向かう
    scenes3d: [{ x: 1380, scene: 'yard', label: '構内道路' }],
    bossScene: 'shrine',
    bossLocation: '構内 稲荷社',
    coBoss: 'seisan', // 工場長と一緒に生産部長も出現
  },
  {
    id: 4,
    name: '司令官編 — 本社 事業部フロア',
    playerRank: '小向司令官',
    location: '本社 事業部フロア',
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
      { type: 'ally', x: 230, betrayer: false },
    ],
    boss: { type: 'boss4', x: 1750 },
    coBoss: 'kikakubucho', // 事業部長と一緒に企画部長も出現
    trueFinal: true, // 事業部長を倒すと裏ステージ（業火の60号7階Aゾーン）へ
  },
];

// 出向サブステージ（Stage3の「出向」扉から分岐。クリアで本社=Stage3へ帰還）
export const SHUKKOU_STAGE = {
  id: 'shukkou',
  name: '出向編 — 関連会社',
  playerRank: '大隊長（出向中）',
  location: '62号6階',
  intro: '「出向」の札に触れた——関連会社へ出向となった。\n社員と出向先上長、そして“顔が怖い”関連会社社長を倒し、本社へ戻れ。',
  width: 1500,
  bg: { scene: 'office', wall: '#2e3640', floor: '#48525e', detail: '#1f262e', accent: '#7a8a9a' },
  // 3D版だけ、本社と同じ造りで色だけ古い関連会社の執務室にする
  scenes3d: [{ x: 0, scene: 'kanren' }],
  waves: [
    { x: 360, enemies: [{ type: 'kanren', count: 3 }] },
    { x: 780, label: '出向先上長 登場', enemies: [{ type: 'kanren', count: 2 }, { type: 'shukkou', count: 1 }] },
  ],
  allies: [],
  boss: { type: 'shacho', x: 1400 },
};

// 裏ステージ（事業部長を倒した“その先”。Stage4クリアで分岐。クリアでエンディング）
// 業火に包まれた60号7階Aゾーン。Y下5人衆と、常軌を逸したパワハラの魔王Y下が待つ。
export const URA_STAGE = {
  id: 'ura',
  stageLabel: '— 裏 —',
  name: '真・最終決戦 — 業火の60号7階Aゾーン',
  playerRank: '小向司令官',
  location: '60号7階Aゾーン（業火）',
  intro: '事業部長を倒した——だが終わりではなかった。\n60号7階Aゾーンが業火に包まれ、仲間は呑まれて消えた。まず「Y下5人衆」が立ちはだかり、やがて魔王Y下が降りてくる。\n魔王の業火は部下もろとも焼く。常軌を逸したパワハラに屈するな。すべての元凶を討て。',
  width: 1200,
  bg: { scene: 'hellfire', wall: '#1a0c08', floor: '#2a160c', detail: '#3a1408', accent: '#ff5a14' },
  // 敵は5人衆と魔王のみ（雑魚なし）。味方も登場しない（業火に呑まれた）。
  waves: [
    { x: 480, label: 'Y下5人衆 出現！', enemies: [
      { type: 'shitennou_nmura', count: 1 }, { type: 'shitennou_kme', count: 1 },
      { type: 'shitennou_sda', count: 1 }, { type: 'shitennou_hmoto', count: 1 },
      { type: 'shitennou_hno', count: 1 },
    ] },
  ],
  allies: [],
  // 5人衆を倒し切るのを待たない。出現から20秒で魔王が降りてきて、そこから総崩れになる。
  // 以降はメテオが敵味方の区別なく降るので、5人衆も巻き添えで減っていく。
  bossJoinsAfter: 20,
  bossJoinLabel: '魔王Y下 降臨！',
  boss: { type: 'maou', x: 1140 },
};

// 小向クエスト2 ゴールデンエイジ編 — 続編のキャラの3Dの見た目
//
// 2D版（game2/src/stages2.js の PALETTES2）の見た目は変えず、3D版だけをここで作り直す:
//   ・服の型・色・持ち物の指定 … PALETTES2_3D（同じ種別を3Dだけ上書きする）
//   ・顔を固定する人物 … 章が変わっても、遊び直しても同じ顔で出す（同期が減っていくのが分かる）
//   ・持ち物（小物）の形 … ボクセルの箱で組む。文字・社章・頭文字に見える記号は描かない
//   ・第1章（研修）の着替え … 主人公も同期も、同じ作業着に同じ白いヘルメット
//
// 描画エンジン（game3d/src/render3d.js）は読まない。登録先は voxel.js（形と個体差）だけなので、
// Node のテスト（scripts/test-headless.mjs）からもそのまま読める。本編のページは読まない。
// 呼ぶのは game2-3d/src/main2-3d.js（ゲーム本体）と game2-3d/cast.html（並べて見る確認用）。
import { registerFixedAppearance, registerProps, registerLookHook } from '../../game/src/voxel.js';
import { registerPalettes } from '../../game/src/sprites.js';

// ===== 3Dの見た目（服の型・色・持ち物） =====
// 2D版（game2/src/stages2.js の PALETTES2）と同じ種別を、3D版だけここで上書きする。
// registerChars2() が registerPalettes で登録するので、2D版のドット絵は1つも変わらない。
// 色のキーの意味は2D版と同じ（b 上衣 / a 肩・縁 / p ズボン / t ネクタイ / h ヘルメット・
// 帽子の色。スーツ型では髪 / s 肌 / e 目）。2Dのドット絵が使わないキー（w 中のシャツ / v ベスト・白衣 /
// l 反射テープ / x 差し色）と、形の指定（outfit 服の型 / headwear かぶりもの / pose 姿勢 / props 持ち物
// / eyes 光る目 / aura まとう光 / faceAway 背中を向ける / age / keepSkinHair / weapon / bodyW・bodyH
// など）は3Dだけが読む。語彙の意味は game/src/sprites.js の SHAPE_KEYS と game/src/voxel.js を参照。
// 顔（髪型・眼鏡・体格）の固定と持ち物の形は、このファイルの下の FACES2・PROPS2。
//
// 他社の人は自社の作業着（空色に紺のヨーク）を着ない。国内の元請け（M菱重工）は作業着の型と色を
// 1つに決め、役は帽子・着方・持ち物で分ける。海外の会社（GR社・L3社・LM社）の人は作業着もスーツも
// 着ない（普通のシャツ・セーター・カーディガン・替え上着＝ビジネスカジュアル）。商社（代理店）だけが
// 高そうなスーツ（本人の指摘、2026-11-14）。社の色は物語のテーマ色から取る。社章・頭文字に見える記号は描かない。
export const PALETTES2_3D = {
  // 主人公: 第1章は白（新人）→ 配属後は緑（＝1のally色）→ エピローグで橙（＝1のplayer色）
  // 3Dでも h はヘルメットの色（2D と同じ意味）。自社の作業着に保護帽。
  p2_shinjin: { map: 'worker', h: '#e6edf2', outfit: 'work', headwear: 'helmet', age: 'young' },
  p2_haizoku: { map: 'worker', h: '#36b06a', outfit: 'work', headwear: 'helmet', age: 'young' },
  // エピローグで「一人になった」主人公（ヘルメットが緑から橙＝本編の自機の色へ。構成案のとおり）。3D版だけの種別
  p2_senshi:  { map: 'worker', h: '#ff7f0e', outfit: 'work', headwear: 'helmet', age: 'young' },

  // 同期3人（配属先の色。設計=青 / 現場=黄 / 品証=紫）。第1章は主人公と同じ白（chars2.js）
  douki_sekkei: { map: 'worker', h: '#4a7ad0', outfit: 'work', headwear: 'helmet', age: 'young' }, // 設計: 青
  douki_genba:  { map: 'worker', h: '#e8c838', outfit: 'work', headwear: 'helmet', age: 'young' }, // 現場: 黄（名札と同じ）
  douki_hinsho: { map: 'worker', h: '#9a6ad0', outfit: 'work', headwear: 'helmet', age: 'young' }, // 品証: 紫
  shutantou:    { map: 'worker', h: '#40b0a8', outfit: 'work', headwear: 'helmet', age: 'young' }, // 主担当（支援章のみ）: 青緑

  // モブ（中間管理職・通行人）— くすんだ色で背景に沈める。部長・課長はスーツで腕を組んで見ている、
  // 社員は腕まくりのワイシャツに社員証
  chukan: { map: 'suit', b: '#4a4e56', p: '#3c4048', t: '#6a6e78', h: '#2a2420', outfit: 'suit', pose: 'cross' },
  tsukou: { map: 'suit', b: '#e2e4e6', p: '#4a4e58', t: '#e2e4e6', h: '#241c14', a: '#b8bcc2', x: '#8a8f96',
            outfit: 'shirt', roll: true, props: ['badge'] },

  // 直属PM（課長）— 全章に出る反復エネミー。黒に近い作業着。顔は最後まで見せない（声と背中だけ）。
  // 自社の作業着の型のまま色だけ沈め、背中のヨーク・後ろで立つ襟・後頭部を足して後ろ姿を読ませる
  pm: { map: 'worker', h: '#2a2a30', b: '#3a404c', a: '#22262e', p: '#30343e', outfit: 'work', back: true, faceAway: true },

  // 第1章 社内（研修）
  jinji:  { map: 'suit',   b: '#4a4a58', p: '#3c3c48', t: '#8a8a9a', h: '#20180f', outfit: 'suit', props: ['clipboard'], weapon: 'binder' },
  manner: { map: 'suit',   b: '#6a4a5a', p: '#583e4c', t: '#d0c0c8', h: '#241a12', w: '#efe6ea', outfit: 'suit', tie: false },
  anzen:  { map: 'worker', h: '#d05a20', x: '#2f8a4a', outfit: 'work', headwear: 'helmet', props: ['armband'] }, // 安全衛生: 保護帽と腕章
  ryocho: { map: 'suit',   b: '#7a6a48', a: '#5a4e34', p: '#4a4a52', t: '#e8e6dc', w: '#e8e6dc', h: '#3a3026', outfit: 'cardigan', weapon: 'binder' },
  kyoiku: { map: 'suit',   b: '#2c3348', p: '#242a3c', t: '#a03030', h: '#1a1410', outfit: 'suit', shoulder: 1, weapon: 'binder' },

  // 第2章 M菱重工（機体メーカー）— 機体側は白〜銀系。銀の作業ジャンパー（前ファスナー・裾を絞る）。
  // 機械設計は帽子と図面の筒、電装は肩から掛けたケーブル、設計課長はファスナーを下ろしてネクタイ
  m_kikai:  { map: 'cap',    h: '#c4c9cf', b: '#c8ccd2', a: '#5a6068', p: '#6a7078', outfit: 'jumper', props: ['tube'], weapon: 'roll' },
  m_denso:  { map: 'worker', h: '#9aa2ac', b: '#c8ccd2', a: '#5a6068', p: '#6a7078', x: '#4a5058', outfit: 'jumper', props: ['cable', 'badge'], weapon: 'wrench' },
  m_sekkei: { map: 'worker', h: '#8e9aa8', b: '#c8ccd2', a: '#5a6068', p: '#6a7078', t: '#46526e', x: '#4a5058', outfit: 'jumper', tie: true, props: ['clipboard', 'badge'], weapon: 'binder' },
  // プロマネは銀鼠の三つ揃い（機体側の白〜銀）。肩を張って少し背を高く。振り向くまでは背中を向けている（bossFaceLock）
  m_pm:     { map: 'suit',   b: '#5c6878', p: '#4a5464', t: '#c8ccd2', h: '#1e1a14', v: '#46505e', outfit: 'suit', vest3: true, shoulder: 1, bodyH: 1.04, faceAway: 'locked', weapon: 'binder' },

  // 第3章 GR社 — 古い工場。褪せた黄土。海外の会社（GR社・L3社・LM社）の人は作業着もスーツも着ない。
  // 普通のシャツやビジネスカジュアル（本人の指摘）。工場の場面でも同じ。
  // 調達は黄土の丸首セーターで書類の束、技術は生成りのシャツを腕まくりして紙挟み、
  // 製造（中ボス）は暗いオリーブのハーフジップにチノパン（素手で殴る）
  gr_chotatsu: { map: 'suit', b: '#a8915a', a: '#86733f', p: '#4a3d2a', w: '#eef0f2', h: '#2a2018', outfit: 'sweater', props: ['papers'], weapon: 'binder' },
  gr_gijutsu:  { map: 'suit', b: '#e9e5da', a: '#c4bfb0', p: '#6e6440', h: '#2a2018', outfit: 'shirt', roll: true, props: ['clipboard'], weapon: 'roll' },
  gr_seizo:    { map: 'suit', b: '#5f5530', a: '#463f24', p: '#b09a64', w: '#e9e5da', h: '#2a2018', outfit: 'sweater', zip: true, weapon: 'fist' },
  // プロマネは腕まくりのワイシャツに緩めたネクタイ。太った体格で、上着は着ていない
  gr_pm:       { map: 'suit',   b: '#d8cc9e', p: '#5a4a2e', t: '#6a4a2a', h: '#3a2a18', a: '#a89a70', outfit: 'shirt', tie: true, roll: true, bodyW: 1.1, weapon: 'roll' },

  // 第4章 L3社 — 藍。閉じている。全員が身分証を首から提げる。問合せはワイシャツに藍のネクタイ、
  // 責任者は藍のハーフジップで書類挟みを持ち、肩幅があって背が高い
  // （攻撃するので腕は組ませない。組むと殴る瞬間に腕が3本に見える）
  l3_toiawase: { map: 'suit', b: '#cfd5e4', a: '#a4adc2', p: '#3a3f52', t: '#2e3a86', h: '#1e1812', x: '#b03a3a', outfit: 'shirt', tie: true, props: ['badge', 'folder'], weapon: 'binder' },
  l3_yushutsu: { map: 'suit', b: '#2e3866', a: '#222a4c', p: '#4e5260', w: '#eef0f2', h: '#1a1610', x: '#b03a3a', outfit: 'sweater', zip: true, props: ['badge', 'clipboard'], shoulder: 1, bodyH: 1.05, weapon: 'stamp' },
  // プロマネは藍のタートルネック。首を顎の下まで包む（中身の見えない人）。細く背が高い
  l3_pm:       { map: 'suit', b: '#1c2240', a: '#141a33', p: '#2a2f45', h: '#1a1610', outfit: 'sweater', collar: 'high', bodyW: 0.94, bodyH: 1.08, weapon: 'binder' },

  // 第5章 LM社 — 巨大。濃紺と金。形で分ける:
  // 契約は腕まくりしないワイシャツに金のネクタイ、変更要求は紺のカーディガン、
  // 試験はワイシャツを腕まくりして紺のネクタイにチノパン（水色は自社の作業着の空色と紛れるので使わない）、
  // 契約管理（中ボス）は紺のニットのベストに金のネクタイ、プロマネは紺の替え上着に金ボタン・開襟・灰色のズボン
  lm_keiyaku: { map: 'suit',   b: '#eef0f2', p: '#232842', t: '#c0a040', h: '#1a1410', a: '#c8ccd2', outfit: 'shirt', tie: true, props: ['binder'], weapon: 'binder' },
  lm_cr:      { map: 'suit',   b: '#2a3352', a: '#1e2640', p: '#3a3f4c', w: '#eef0f2', h: '#1e1812', outfit: 'cardigan', props: ['papers'], weapon: 'roll' },
  lm_shiken:  { map: 'suit',   b: '#eef0f2', a: '#c8ccd2', p: '#a89a78', t: '#232a48', h: '#2a2018', x: '#c0a040', outfit: 'shirt', tie: true, roll: true, props: ['badge', 'clipboard'], weapon: 'roll' },
  lm_kanri:   { map: 'suit',   b: '#eef0f2', a: '#c8ccd2', v: '#242a44', p: '#5a5e66', t: '#d0b050', h: '#151109', outfit: 'vest', knit: true, tie: true, props: ['binder'], weapon: 'binder' },
  lm_pm:      { map: 'suit',   b: '#161c30', p: '#6a6e78', w: '#eef0f2', x: '#d8bc58', h: '#12100c', outfit: 'suit', tie: false, blazer: true, shoulder: 2, bodyW: 1.08, faceAway: 'locked', weapon: 'binder' },

  // 代理店（商社）— 攻撃してこない。海外の会社の人と違い、バシッと決めた高そうなスーツ（本人の指摘）:
  // 炭色の三つ揃い、白いシャツに深紅のネクタイと金のタイピン、胸のチーフ、金の腕時計、革の鞄
  dairiten: { map: 'suit', b: '#2a2d33', a: '#1c1e22', v: '#50545c', p: '#2a2d33', t: '#a01e2c', w: '#f6f7f8', h: '#241c14',
              outfit: 'suit', vest3: true, shoulder: 1, bodyW: 0.96, bodyH: 1.04, props: ['pocketsquare', 'tiepin', 'watch', 'briefcase'] },

  // 最終章 発注官庁 ＋ 四騎士
  kensakan:   { map: 'suit',   b: '#3a4038', p: '#30352e', t: '#8a9080', h: '#1c1810', x: '#d8c040', outfit: 'suit', props: ['armband', 'clipboard'], weapon: 'stamp' },
  kancho_pm:  { map: 'suit',   b: '#1c2018', p: '#161a14', t: '#7a8068', h: '#141008', outfit: 'coat', skirt: 9, shoulder: 1, bodyH: 1.05, weapon: 'stamp' },
  // 四騎士 — 人ではなく、5年で溜まった数字が立ち上がったもの。灰の肌・白髪はパレットのまま
  // （keepSkinHair。個体差で人の色に戻さない）。目が光り（eyes）、足元に光をまとう（aura）。
  // 4体は形と持ち物で分ける: 期限＝顎まで襟の立った長い外套と砂時計、性能＝白衣と計器、
  // 損失＝三つ揃いの太った体と帳簿、係争＝足首までの法衣と木槌（本編の黒スーツ組とは別物にする）
  kishi_kigen:    { map: 'suit', b: '#1a1a20', p: '#101014', t: '#c04a1a', h: '#d8d8d8', s: '#8a7a6a', e: '#ff6a1a', x: '#ff6a1a',
                    outfit: 'coat', collar: 'high', skirt: 8, props: ['hourglass'], eyes: true, aura: 1, keepSkinHair: true, bodyW: 0.92, bodyH: 1.1, weapon: 'fist' },
  kishi_seinou:   { map: 'suit', b: '#101014', p: '#0c0c10', t: '#1a7ac0', h: '#d8d8d8', s: '#8a7a6a', e: '#3aa0ff', x: '#3aa0ff', v: '#c8ccd0',
                    outfit: 'labcoat', skirt: 10, props: ['gauge'], eyes: true, aura: 1, keepSkinHair: true, weapon: 'fist' },
  kishi_sonshitsu:{ map: 'suit', b: '#101014', p: '#0c0c10', t: '#c0a01a', h: '#d8d8d8', s: '#8a7a6a', e: '#ffd23a', x: '#ffd23a', v: '#4a3e10',
                    outfit: 'suit', vest3: true, props: ['ledger'], eyes: true, aura: 1, keepSkinHair: true, bodyW: 1.14, bodyH: 0.96, weapon: 'fist' },
  kishi_keisou:   { map: 'suit', b: '#24141c', p: '#160c12', t: '#8a1a1a', h: '#d8d8d8', s: '#8a7a6a', e: '#ff2a2a', x: '#ff2a2a',
                    outfit: 'robe', skirt: 6, props: ['gavel'], eyes: true, aura: 1, keepSkinHair: true, bodyW: 1.06, bodyH: 1.06, weapon: 'fist' },
};

// ===== 顔を固定する人物 =====
// [髪型, 眼鏡, 髭, 肌, 髪色, 体格]（voxel.js の APPEARANCES と同じ並び）
//   髪型 0標準 1刈り上げ 2七三 3薄毛 4襟足長め 5オールバック / 眼鏡 0なし 1黒縁 2銀縁 /
//   髭 0なし 1口髭 2無精髭 / 肌 0〜4 / 髪色 0〜3 黒〜茶・4〜6 白混じり〜白髪 /
//   体格 0細身で背が高い 1標準 2がっしり 3小柄で太め
// 肌・髪色を null にすると個体差で上書きせず、パレットの色のまま（四騎士）。
// 時代や人物の細部は本人の記憶に合わせて差し替える前提。ここを書き換えれば全章に効く。
export const FACES2 = {
  // 主人公。本編の自機と同じ顔（5年前の同じ人）。ヘルメットで髪型はほぼ隠れる
  p2_shinjin:   [0, 0, 0, 0, 0, 1],
  p2_haizoku:   [0, 0, 0, 0, 0, 1],
  p2_senshi:    [0, 0, 0, 0, 0, 1],
  // 同期3人と主担当。入社1年目なので白髪・薄毛・髭は当てない。研修中は全員同じ白い
  // ヘルメットなので、眼鏡・肌・体格で見分けがつくようにしてある
  douki_sekkei: [4, 2, 0, 2, 1, 0],   // 設計: 銀縁・細身で背が高い
  douki_genba:  [1, 0, 0, 3, 0, 2],   // 現場: 刈り上げ・日焼け・がっしり
  douki_hinsho: [2, 1, 0, 1, 2, 3],   // 品証: 七三・黒縁・小柄
  shutantou:    [5, 0, 0, 4, 3, 2],   // 主担当: オールバック・がっしり
  // 直属PM（課長）。背中しか見せないので、後ろ姿で読める短髪とがっしりした体格だけ。
  // 役割（PM）以上の属性は与えない（眼鏡・髭なし）
  pm:           [1, 0, 0, 0, 0, 2],
  // 章のボス・中ボス・代理店。一度きりの相手でも、遊び直すたびに顔が変わらないようにする
  kyoiku:       [2, 1, 0, 1, 4, 2],
  ryocho:       [3, 0, 1, 0, 5, 3],
  m_sekkei:     [2, 2, 0, 2, 3, 1],
  m_pm:         [5, 1, 0, 1, 1, 2],
  gr_seizo:     [1, 0, 2, 3, 2, 2],
  gr_pm:        [3, 0, 1, 4, 4, 3],
  l3_yushutsu:  [2, 1, 0, 2, 0, 0],
  l3_pm:        [5, 2, 0, 2, 0, 0],
  lm_kanri:     [2, 2, 0, 1, 5, 1],
  lm_pm:        [5, 0, 0, 0, 3, 2],
  dairiten:     [2, 1, 0, 0, 1, 1],
  kensakan:     [1, 2, 0, 3, 4, 1],
  kancho_pm:    [2, 2, 0, 1, 5, 2],
  // 四騎士。灰の肌と白髪はパレットのまま。髪型と体格で4体のシルエットを分ける
  kishi_kigen:     [4, 0, 0, null, null, 0],   // 期限: 細く背が高い
  kishi_seinou:    [5, 0, 0, null, null, 1],   // 性能
  kishi_sonshitsu: [3, 0, 0, null, null, 3],   // 損失: 小柄で太い
  kishi_keisou:    [2, 0, 0, null, null, 2],   // 係争: がっしり
};

// ===== 持ち物（小物）=====
// [x0, x1, y0, y1, z0, z1, 色] の箱の並び。座標は voxel.js の charParts と同じ
// （x 0-39 左右 / y 0-59 下から上 / z 0-23 奥から手前、+z が正面）。
// o = { bw, bd, sh }: 体格による胴の張り出しと肩幅。手は x 6-bw-sh..10-bw-sh と
// 29+bw+sh..33+bw+sh、y 18-21、z 8-16。胴の前面は z=19+bd。
// 色は '#rrggbb'（固定の色）か大文字のキー（X＝パレットの差し色 x）。どちらも胴と一緒に動く。
// 脚の振り（足先で横に最大9ボクセル）に当たらないよう、膝より下には置かない。
const INK = '#2a2c30', PAPER = '#f2f4f6';
export const PROPS2 = {
  // 紙挟み（左手に提げる）
  clipboard: ({ bw, sh }) => {
    const x = 5 - bw - sh;
    return [
      [x - 1, x, 10, 22, 7, 16, '#7a5a3a'],          // 板
      [x - 2, x - 2, 11, 21, 8, 15, PAPER],          // 紙（外向き）
      [x - 2, x - 1, 20, 22, 10, 13, '#a8aeb4'],     // 留め金
    ];
  },
  // 閉じた紙挟み（左手。赤い留め紐で閉じてある）
  folder: ({ bw, sh }) => {
    const x = 5 - bw - sh;
    return [
      [x - 1, x, 10, 22, 7, 17, '#262c48'],
      [x - 1, x, 15, 16, 7, 17, 'X'],
    ];
  },
  // 厚いバインダー（左手に提げる。紙の小口を前へ向ける）
  binder: ({ bw, sh }) => {
    const x = 5 - bw - sh;
    return [
      [x - 2, x, 10, 23, 7, 17, '#1e2a4a'],
      [x - 1, x - 1, 11, 22, 18, 18, PAPER],
      [x - 2, x - 2, 15, 17, 9, 15, '#c0a040'],      // 背の帯
    ];
  },
  // 書類の束（右手に持つ。投げてくる人の手持ち）
  papers: ({ bw, sh }) => {
    const x = 34 + bw + sh;
    return [
      [x, x + 1, 12, 22, 7, 16, PAPER],
      [x + 2, x + 2, 13, 21, 8, 15, '#d8dde2'],
    ];
  },
  // 図面の筒（右手で手の前に立てて持つ）
  tube: ({ bw, sh }) => {
    const x = 30 + bw + sh;
    return [
      [x, x + 2, 12, 32, 17, 19, '#6f8fae'],
      [x, x + 2, 33, 34, 17, 19, '#46525e'],          // 蓋
    ];
  },
  // 肩から斜めに掛けた束ねたケーブル（電装）。左の肩から右の腰へ、前と後ろを通す
  cable: ({ bd }) => {
    const F = 20 + bd, B = 4 - bd, P = [];
    for (let i = 0; i <= 14; i++) {
      const x = 12 + i, y = 36 - i;
      P.push([x, x + 1, y - 1, y, F, F, INK]);
      P.push([x, x + 1, y - 1, y, B, B, INK]);
    }
    P.push([12, 14, 37, 38, B, F, INK]);            // 肩に掛かるところ
    P.push([25, 28, 19, 23, F, F + 1, INK]);         // 腰で巻いた束
    return P;
  },
  // 首から下げた身分証（ひもは差し色 x、札は白。文字は描かない）
  badge: ({ bd }) => {
    const F = 19 + bd;
    return [
      [17, 17, 31, 38, F, F + 1, 'X'],
      [22, 22, 31, 38, F, F + 1, 'X'],
      [18, 21, 26, 31, F + 1, F + 2, PAPER],
      [18, 21, 31, 31, F + 1, F + 2, 'X'],
    ];
  },
  // 腕章（左の上腕。差し色 x の無地の帯）
  armband: ({ bw, sh }) => [[5 - bw - sh, 10 - bw - sh, 29, 31, 7, 17, 'X']],
  // 革手袋（両手）
  gloves: ({ bw, sh }) => [
    [6 - bw - sh, 10 - bw - sh, 18, 22, 8, 16, '#c08e52'],
    [29 + bw + sh, 33 + bw + sh, 18, 22, 8, 16, '#c08e52'],
  ],
  // 腰の前の工具袋と、差したレンチの柄
  toolpouch: ({ bd }) => [
    [23, 27, 13, 18, 20 + bd, 21 + bd, '#5a3e22'],
    [24, 25, 19, 25, 21 + bd, 21 + bd, '#9aa0a6'],
  ],
  // 胸ポケットのチーフ（白）。鞄を提げる側の胸（x の大きい側）
  pocketsquare: ({ bd }) => {
    const F = 19 + bd;
    return [
      [25, 27, 31, 32, F + 1, F + 1, '#f6f7f8'],
      [26, 26, 33, 33, F + 1, F + 1, '#f6f7f8'],     // 先を少し立てる
    ];
  },
  // ネクタイの金のタイピン（ネクタイの1段手前）
  tiepin: ({ bd }) => [[18, 21, 28, 28, 21 + bd, 21 + bd, '#d8b84a']],
  // 金の腕時計（鞄を提げる側の手首。袖口の高さで腕をひと回り巻く）
  watch: ({ bw, sh }) => [[29 + bw + sh, 33 + bw + sh, 22, 22, 7, 17, '#d8b84a']],
  // 鞄（右手に提げる）
  briefcase: ({ bw, sh }) => {
    const x = 33 + bw + sh;
    return [
      [x, x + 2, 7, 15, 6, 17, '#3a2a1e'],
      [x, x + 2, 16, 18, 10, 13, '#241a12'],         // 取っ手
      [x, x + 2, 12, 12, 6, 17, '#9a8458'],          // 金具の帯
    ];
  },
  // 砂時計（期限）。くびれを右手で握る。落ちた砂がほとんど＝もう時間が無い。砂は光と同じ色
  hourglass: ({ bw, sh }) => {
    const x0 = 33 + bw + sh, x1 = x0 + 4, W = '#3a2a1e', G = '#d8e6ec';
    return [
      [x0, x1, 26, 27, 7, 16, W], [x0, x1, 9, 10, 7, 16, W],       // 上下の板
      [x0, x0, 11, 25, 7, 7, W], [x1, x1, 11, 25, 16, 16, W],      // 柱（対角に2本）
      [x0 + 1, x1 - 1, 20, 25, 9, 14, G],                          // 上の玉
      [x0 + 2, x1 - 2, 17, 19, 11, 12, G],                         // くびれ
      [x0 + 1, x1 - 1, 11, 16, 9, 14, G],                          // 下の玉
      [x0 + 1, x1 - 1, 11, 14, 9, 14, 'X'],                        // 落ちた砂
      [x0 + 2, x1 - 2, 24, 25, 10, 13, 'X'],                       // 残りわずか
    ];
  },
  // 計器（性能）。左手に提げ、文字盤を前へ向ける。針は規定値（赤）に届かない。数字は描かない
  gauge: ({ bw, sh }) => {
    const x0 = 1 - bw - sh;
    return [
      [x0, x0 + 4, 12, 22, 9, 14, '#2a2e34'],
      [x0 + 1, x0 + 3, 13, 21, 15, 15, '#e8ecef'],
      [x0 + 1, x0 + 3, 20, 21, 15, 15, '#c0392b'],
      [x0 + 2, x0 + 2, 14, 18, 16, 16, 'X'],
    ];
  },
  // 帳簿（損失）。右手に提げる厚い台帳。紙の小口を前へ、角の金具は光と同じ色
  ledger: ({ bw, sh }) => {
    const x0 = 33 + bw + sh;
    return [
      [x0, x0 + 3, 11, 24, 6, 17, '#5a1414'],
      [x0 + 1, x0 + 2, 12, 23, 18, 18, '#e8dcb0'],
      [x0, x0 + 3, 23, 24, 6, 7, 'X'],
      [x0, x0 + 3, 11, 12, 16, 17, 'X'],
    ];
  },
  // 木槌（係争）。右手で手の前に振り上げる。打面の縁は光と同じ色
  gavel: ({ bw, sh }) => {
    const x = 31 + bw + sh;
    return [
      [x, x + 1, 21, 30, 17, 18, '#6a4428'],         // 柄
      [x - 2, x + 3, 31, 33, 17, 19, '#5a3820'],     // 頭
      [x - 2, x - 2, 31, 33, 17, 19, 'X'],
      [x + 3, x + 3, 31, 33, 17, 19, 'X'],
    ];
  },
};

// ===== 第1章（研修）の着替え =====
// 入社した日は全員が同じ作業着に同じ白いヘルメット（第1章の指示事項のとおり）。
// 主人公が研修生（p2_shinjin）でいる間は、同期も主人公と同じパレットで作る。
// 顔は各自の固定のまま（voxel.js の modelKeyOf は着ている物だけを差し替える）。
// 白は 2D でも p2_shinjin の h＝ヘルメットの色。配属後（第2章〜）は各自の配属色に分かれる。
const DOUKI = new Set(['douki_sekkei', 'douki_genba', 'douki_hinsho']);
export function kenshuLook(e, stage) {
  if (!DOUKI.has(e.spriteKey)) return null;
  const p = stage && stage.player;
  return p && p.spriteKey === 'p2_shinjin' ? 'p2_shinjin' : null;
}

// 登録（1回だけ。2回呼んでも同じ）
let done = false;
export function registerChars2() {
  if (done) return;
  done = true;
  registerPalettes(PALETTES2_3D);   // 2D版の色（PALETTES2）の上に、3Dの服の型・色を重ねる
  const fixed = {};
  for (const [key, t] of Object.entries(FACES2)) {
    fixed[key] = { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
  }
  registerFixedAppearance(fixed);
  registerProps(PROPS2);
  registerLookHook(kenshuLook);
}

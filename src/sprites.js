// ピクセルアート: 文字配列のドット絵をオフスクリーンcanvasへ焼き、拡大/反転描画する
//
// 2種の体型:
//  worker = 水色の作業着 + 黒の安全靴 + ヘルメット（現場/技術/スタッフ/管理職）
//  suit   = スーツ + ネクタイ + 革靴 + 髪（客・ベンダー・事業部長）
//
// パレットキー: . 透明 / k 輪郭 / s 肌 / e 目 / h 頭(ヘルメット or 髪) / b 上半身 / p 下半身 / t ネクタイ / f 靴

const WORKER_BASE = {
  '.': null, 'k': '#0d1118', 's': '#f1c79b', 'e': '#0d1118',
  'h': '#8fd0e0',   // ヘルメット（種別で上書き）
  'b': '#8fd0e0',   // 作業着（水色・全員共通）
  'p': '#79bccd',   // 作業ズボン（やや濃い水色）
  't': '#8fd0e0',   // workerはネクタイ無し（bと同色で潰す）
  'f': '#0c0c0e',   // 黒の安全靴
};

const SUIT_BASE = {
  '.': null, 'k': '#0d1118', 's': '#f1c79b', 'e': '#0d1118',
  'h': '#2a2018',   // 髪
  'b': '#37506e',   // スーツ上着（種別で上書き）
  'p': '#2f4660',   // スラックス
  't': '#aeb4bc',   // ネクタイ（種別で上書き）
  'f': '#14141a',   // 黒の革靴
};

// 作業着＋ヘルメット (12 x 18)
const WORKER_MAP = [
  '....kkkk....',
  '...khhhhk...',
  '...khhhhk...',
  '...kssssk...',
  '...ksesek...',
  '...kssssk...',
  '....kkkk....',
  '..kbbbbbbk..',
  '.kbbbbbbbbk.',
  '.kbbbbbbbbk.',
  '.ksbbbbbbsk.',
  '.kbbbbbbbbk.',
  '.kbbbbbbbbk.',
  '..kppppppk..',
  '..kpp..ppk..',
  '..kpp..ppk..',
  '..fff..fff..',
  '.ffff..ffff.',
];

// スーツ＋ネクタイ (12 x 18)
const SUIT_MAP = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hksssskh..',
  '...kssssk...',
  '...ksesek...',
  '...kssssk...',
  '....kkkk....',
  '..kbbttbbk..',
  '.kbbbttbbbk.',
  '.kbbbttbbbk.',
  '.ksbbttbbsk.',
  '.kbbbttbbbk.',
  '.kbbbbbbbbk.',
  '..kppppppk..',
  '..kpp..ppk..',
  '..kpp..ppk..',
  '..fff..fff..',
  '.ffff..ffff.',
];

export const SPRITE_W = WORKER_MAP[0].length; // 12
export const SPRITE_H = WORKER_MAP.length;    // 18

// 種別ごとの体型と配色（worker= h上書き / suit= b,p,t,h上書き）
export const CHAR_PALETTES = {
  player: { map: 'worker', h: '#ff7f0e' },                                  // 小向戦士: 橙ヘルメット
  ally:   { map: 'worker', h: '#36b06a' },                                  // 同僚: 緑ヘルメット
  buka:   { map: 'worker', h: '#e6edf2' },                                  // 部下: 白ヘルメット
  senpai: { map: 'worker', h: '#f2c53d' },                                  // 先輩: 黄ヘルメット
  staff:  { map: 'worker', h: '#9aa0a8' },                                  // スタッフ部門: 灰ヘルメット
  dr:     { map: 'worker', h: '#b03030' },                                  // 設計審査委員: 緋色ヘルメット（徒党）
  exctrl: { map: 'worker', h: '#3f51b5' },                                  // 輸出管理: 藍色ヘルメット（徒党）
  missile: { map: 'worker', h: '#6e7b2e' },                                 // 携行ミサイル兵: 国防色ヘルメット
  // PMR（プロジェクトマネジメント審査会）の部長たち
  pmr_seisan:    { map: 'worker', h: '#2a4f8a' }, // 生産部長: 青
  pmr_seizou:    { map: 'worker', h: '#2f7d4a' }, // 製造部長: 緑
  pmr_choutatsu: { map: 'worker', h: '#b07a2a' }, // 調達部長: 橙茶
  pmr_gijutsu:   { map: 'worker', h: '#5a4ab0' }, // 技術管理部長: 青紫
  pmr_hinshou:   { map: 'worker', h: '#a03a7a' }, // 品証部長: 赤紫
  // 出向先（関連会社）
  kanren:  { map: 'worker', h: '#5a7a6a' }, // 関連会社社員: 灰緑
  shukkou: { map: 'worker', h: '#8a5a2a' }, // 出向先上長: 茶
  // 関連会社社長: 黒スーツ・白髪・日焼け顔・赤い目
  shacho:  { map: 'suit', b: '#0a0a0e', p: '#08080c', t: '#7a0a0a', h: '#e2e2e2', s: '#a86a3a', e: '#ff2a2a' },
  kyaku:  { map: 'suit', b: '#8a5a34', p: '#73492a', t: '#c0392b', h: '#3a2a1a' }, // 客: 茶スーツ赤ネクタイ
  vendor: { map: 'suit', b: '#37506e', p: '#2f4660', t: '#aeb4bc', h: '#241c14' }, // ベンダー: 紺スーツ灰ネクタイ
  boss1:  { map: 'worker', h: '#2a4f8a' },                                  // 生産部長: 青ヘルメット
  boss2:  { map: 'worker', h: '#7a3db0' },                                  // 技師長: 紫ヘルメット
  boss3:  { map: 'worker', h: '#c79a3a' },                                  // 工場長: 金ヘルメット
  boss4:  { map: 'suit', b: '#1c1c24', p: '#16161c', t: '#8a1a1a', h: '#15110c' }, // 事業部長: 黒スーツ赤ネクタイ
};

// 頭上に出す役職ラベル（ボス以外の識別用。ボスはボスHPバーで表示）
export const TYPE_LABEL = {
  buka: '部下', senpai: '先輩', staff: 'スタッフ', dr: '設計審査', exctrl: '輸出管理', missile: 'ミサイル', kyaku: '客', vendor: 'ベンダー', ally: '味方',
  pmr_seisan: '生産部長', pmr_seizou: '製造部長', pmr_choutatsu: '調達部長', pmr_gijutsu: '技術管理部長', pmr_hinshou: '品証部長',
  kanren: '関連社員', shukkou: '出向先上長',
};
export const TYPE_COLOR = {
  buka: '#cfe6f5', senpai: '#f2c53d', staff: '#aab0b8', dr: '#ff5a5a', exctrl: '#8c9eff', missile: '#c2cf5e', kyaku: '#e0736a', vendor: '#7fa8d0', ally: '#46c47e',
  pmr_seisan: '#6a9ad8', pmr_seizou: '#5cc28a', pmr_choutatsu: '#d8a45c', pmr_gijutsu: '#9a8ce0', pmr_hinshou: '#d87ab0',
  kanren: '#9ad8b8', shukkou: '#d8b07a',
};

function bake(map, base, overrides) {
  const palette = { ...base, ...overrides };
  const w = map[0].length, h = map.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = palette[map[y][x]];
      if (!color) continue;
      cx.fillStyle = color;
      cx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

const REGISTRY = {};
export function buildSprites() {
  for (const m of [WORKER_MAP, SUIT_MAP]) {
    for (const row of m) {
      if (row.length !== SPRITE_W) throw new Error(`sprite row length mismatch: "${row}"`);
    }
  }
  for (const [key, ov] of Object.entries(CHAR_PALETTES)) {
    const { map, ...colors } = ov;
    const base = map === 'suit' ? SUIT_BASE : WORKER_BASE;
    const baseMap = map === 'suit' ? SUIT_MAP : WORKER_MAP;
    REGISTRY[key] = bake(baseMap, base, colors);
  }
}

export function getSprite(key) { return REGISTRY[key] || REGISTRY.buka; }

// 足元(footX, footY)基準に scale倍・facingで左右反転して描く
export function drawSprite(ctx, key, footX, footY, facing, scale, blink) {
  if (blink) return;
  const sp = getSprite(key);
  const w = sp.width * scale, h = sp.height * scale;
  const dx = Math.round(footX - w / 2), dy = Math.round(footY - h);
  ctx.save();
  if (facing < 0) {
    ctx.translate(dx + w, dy); ctx.scale(-1, 1);
    ctx.drawImage(sp, 0, 0, w, h);
  } else {
    ctx.drawImage(sp, dx, dy, w, h);
  }
  ctx.restore();
}

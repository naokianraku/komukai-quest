// ドット絵（12x18の文字配列）を押し出してボクセルのジオメトリに変換する。
//
// 2Dの sprites.js と同じ WORKER_MAP / SUIT_MAP / CHAR_PALETTES をそのまま使うので、
// キャラを描き直す必要がない。2形状 × パレット差し替えで全キャラが3D化できる。
// three.js には依存せず、素の配列（positions/normals/colors/indices）を返す。
import { WORKER_MAP, WORKER_CAP_MAP, SUIT_MAP, WORKER_BASE, SUIT_BASE, CHAR_PALETTES } from './sprites.js';

export const DEPTH = 4; // 奥行き（ボクセル数）。薄い板にならない程度

// '#rrggbb' → リニア色（three の outputColorSpace=sRGB と合わせると2D版と同じ色になる）
function toLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
}

// 立方体の6面。[法線, 面を構成する4頂点のオフセット]
const FACES = [
  { n: [1, 0, 0],  d: [1, 0, 0],  v: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [-1, 0, 0], d: [-1, 0, 0], v: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
  { n: [0, 1, 0],  d: [0, 1, 0],  v: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { n: [0, -1, 0], d: [0, -1, 0], v: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { n: [0, 0, 1],  d: [0, 0, 1],  v: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
  { n: [0, 0, -1], d: [0, 0, -1], v: [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]] },
];

/**
 * 文字配列 + パレットから、面カリング済みのボクセルジオメトリを作る。
 * 原点は「足元の中央」。y+ が上、z が奥行き。
 */
export function buildVoxel(map, palette) {
  const W = map[0].length, H = map.length, D = DEPTH;
  const solid = (cx, cy, cz) => {
    if (cx < 0 || cx >= W || cy < 0 || cy >= H || cz < 0 || cz >= D) return false;
    return palette[map[cy][cx]] != null; // 行 cy は上から数える
  };

  const positions = [], normals = [], colors = [], indices = [];
  let vi = 0;
  const ox = -W / 2, oy = 0, oz = -D / 2;

  for (let cy = 0; cy < H; cy++) {
    for (let cx = 0; cx < W; cx++) {
      const key = map[cy][cx];
      const hex = palette[key];
      if (hex == null) continue;
      const rgb = toLinear(hex);
      // 足元が y=0 になるよう、行を上下反転して積む
      const baseY = (H - 1 - cy);
      for (let cz = 0; cz < D; cz++) {
        for (const f of FACES) {
          // 隣が埋まっている面は描かない（内部ポリゴンを省いて1/3程度に減る）
          const nx = cx + f.d[0];
          const ny = cy - f.d[1]; // 配列の行方向は y と逆
          const nz = cz + f.d[2];
          if (solid(nx, ny, nz)) continue;
          for (const v of f.v) {
            positions.push(ox + cx + v[0], oy + baseY + v[1], oz + cz + v[2]);
            normals.push(f.n[0], f.n[1], f.n[2]);
            colors.push(rgb[0], rgb[1], rgb[2]);
          }
          // 外から見て反時計回りになる順。逆にすると全面がバックフェースカリングされ、
      // 物体の内側（反対側の面）だけが見える状態になる。
      indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
          vi += 4;
        }
      }
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    width: W, height: H, depth: D,
  };
}

/** sprites.js の CHAR_PALETTES のキー（player / buka / boss4 …）から直接作る */
export function buildVoxelForType(key) {
  const ov = CHAR_PALETTES[key];
  if (!ov) return null;
  const { map, ...colors } = ov;
  const base = map === 'suit' ? SUIT_BASE : WORKER_BASE;
  const srcMap = map === 'suit' ? SUIT_MAP : map === 'cap' ? WORKER_CAP_MAP : WORKER_MAP;
  return buildVoxel(srcMap, { ...base, ...colors });
}

export function allTypeKeys() { return Object.keys(CHAR_PALETTES); }

// ===== 3D専用の高解像度キャラ =====
//
// 2Dのドット絵(12x18)をそのまま押し出すと、3Dでは解像度が足りず輪郭線も重い。
// こちらは 20x30x12 のグリッドに立体として組み直したもの。パレットのキーは
// 2Dと共通なので、既存の30種のパレットがそのまま使える。
// 3Dでは陰影と影で形が出るため、黒の輪郭線('k')は使わない（暗く潰れるのを防ぐ）。
export const C3 = { W: 40, H: 60, D: 24, SCALE: 0.3 }; // SCALE: 2D版と同じ見た目サイズにする係数

// [x0,x1, y0,y1, z0,z1, キー] の直方体リスト。x=左右 / y=下から上 / z=奥から手前(23が正面)
//
// 比率は元のドット絵(12x18)に合わせる。あちらは 頭+かぶりもの が全高の約39%あり、
// その頭身がキャラの可愛げを作っている。等身を上げると途端に寸胴に見えるので、
// 解像度だけ上げて比率は変えない。
//   靴 0-10% / ズボン 10-28% / 胴 28-62% / 頭 62-85% / かぶりもの 85-100%
function charParts({ cap = false, suit = false, hair = 0, glasses = 0, beard = 0, build = 1 }) {
  // build: 0=細身 / 1=標準 / 2=がっしり / 3=小柄で太め。
  // メッシュを拡大縮小するだけでは差が出ないので、肩幅・胴まわり・腹の出方をモデル側で変える。
  // 胸ポケットやボタンなど胴の前面につくものは、bd と一緒に前へ出さないと腹に埋まる。
  const bw = [-1, 0, 1, 3][build] || 0;          // 胴の左右への張り出し
  const bd = [-1, 0, 1, 3][build] || 0;          // 胴の前後への厚み（腹）
  const P = [];
  const add = (x0, x1, y0, y1, z0, z1, k) => P.push([x0, x1, y0, y1, z0, z1, k]);

  // --- 脚まわり ---
  for (const [lx0, lx1] of [[11, 18], [21, 28]]) {
    add(lx0, lx1, 0, 5, 5, 20, 'f');          // 安全靴（前に長い）
    add(lx0, lx1, 6, 18, 7, 17, 'p');         // ズボン
  }
  add(11 - bw, 28 + bw, 15, 19, 7 - bd, 17 + bd, 'p');   // 腰
  add(11 - bw, 28 + bw, 18, 19, 6 - bd, 18 + bd, 'f');   // ベルト

  // --- 胴（袖は胴より浅くして段差で腕を分ける）---
  add(11 - bw, 28 + bw, 19, 37, 5 - bd, 19 + bd, 'b');   // 上衣
  // 袖は胴より奥行きを浅くする。段差ができて腕が胴に溶けない。
  add(6 - bw, 10 - bw, 22, 35, 8, 16, 'b');   // 左袖
  add(29 + bw, 33 + bw, 22, 35, 8, 16, 'b');  // 右袖
  add(6 - bw, 10 - bw, 18, 21, 8, 16, 's');   // 左手
  add(29 + bw, 33 + bw, 18, 21, 8, 16, 's');  // 右手

  if (suit) {
    add(19, 20, 20, 36, 19 + bd, 19 + bd, 't');            // ネクタイ
    add(15, 18, 35, 37, 5 - bd, 19 + bd, 'b');             // 襟（スーツ）
    add(21, 24, 35, 37, 5 - bd, 19 + bd, 'b');
  } else {
    add(9 - bw, 30 + bw, 33, 37, 5 - bd, 19 + bd, 'a');   // 肩ヨーク
    add(6 - bw, 10 - bw, 32, 35, 8, 16, 'a'); // 袖の肩側
    add(29 + bw, 33 + bw, 32, 35, 8, 16, 'a');
    add(6 - bw, 10 - bw, 22, 23, 8, 16, 'a'); // 袖口
    add(29 + bw, 33 + bw, 22, 23, 8, 16, 'a');
    add(19, 20, 20, 34, 19 + bd, 19 + bd, 'a'); // 前立て
    if (build >= 2) add(13, 26, 21, 30, 20 + bd, 21 + bd, 'b');  // 腹が前に出る
    for (const by of [23, 27, 31]) add(19, 20, by, by, 20 + bd, 20 + bd, 'b'); // ボタン
    add(12, 17, 26, 30, 19 + bd, 19 + bd, 'a');            // 胸ポケット
    add(12, 17, 30, 31, 19 + bd, 20 + bd, 'a');            // ポケットのフラップ
    add(15, 24, 37, 39, 5 - bd, 19 + bd, 'a');             // 襟
  }

  // --- 首・頭（ここを大きく取るのが要点）---
  add(17, 22, 36, 42, 9, 15, 's');            // 首
  // 頭は直方体だと箱に見えるので、上下の角を落として丸みを出す
  add(15, 24, 42, 42, 9, 15, 's');
  add(14, 25, 43, 43, 8, 16, 's');
  add(13, 26, 44, 50, 7, 17, 's');
  add(14, 25, 51, 51, 8, 16, 's');
  add(12, 12, 45, 48, 10, 14, 's');           // 左耳
  add(27, 27, 45, 48, 10, 14, 's');           // 右耳
  // 髭。顔の前面は y>=44 が z=17 なので、1ボクセル手前に出して影で見せる
  const beardKey = suit ? 'h' : 'r';           // スーツ型は 'h' が髪色（SUIT_BASE の規約）
  if (beard === 1) {                           // 口髭。厚みを持たせないと線に見える
    add(17, 22, 44, 44, 18, 18, beardKey);
    add(17, 22, 43, 43, 17, 17, beardKey);
  } else if (beard === 2) {                    // 無精髭。顎の縁だけに留める（面で塗ると付け髭になる）
    add(14, 25, 43, 43, 17, 17, beardKey);
    add(14, 15, 44, 44, 18, 18, beardKey);
    add(24, 25, 44, 44, 18, 18, beardKey);
  }

  if (glasses) {
    // 眼鏡。1=黒縁（下辺まである）/ 2=銀縁（下が開いたハーフリム）。
    // 左右を1本の横棒でつなぐとサングラスのバイザーに見えるので、レンズごとに囲む。
    const fr = glasses === 2 ? 'g' : 'e';
    for (const [a, b] of [[14, 18], [22, 26]]) {
      add(a, b, 48, 48, 17, 18, fr);          // レンズ上辺
      add(a, a, 46, 48, 17, 18, fr);          // 外側の縦枠
      add(b, b, 46, 48, 17, 18, fr);          // 鼻側の縦枠
      if (glasses === 1) add(a, b, 45, 45, 17, 18, fr);   // 黒縁だけ下辺がある
    }
    add(19, 21, 47, 47, 17, 18, fr);          // ブリッジ（上辺より1段下げて左右を分ける）
    add(13, 13, 46, 48, 14, 17, fr);          // 左つる
    add(26, 26, 46, 48, 14, 17, fr);          // 右つる
  }

  // --- 髪 / かぶりもの ---
  // 事務・技術の人はヘルメットをかぶらない（実物の執務室の写真どおり）。
  // 製造・現場だけ つば付きのキャップ。識別色(h)は髪に使うと不自然なので、
  // 作業着の人は「社員証のネックストラップ」に回している。
  if (cap) {
    add(14, 25, 51, 51, 8, 16, 'h');          // キャップ本体（丸み）
    add(15, 24, 52, 55, 9, 15, 'h');
    add(17, 22, 56, 56, 11, 14, 'h');
    add(13, 26, 51, 52, 17, 21, 'h');         // つば
    add(14, 25, 48, 50, 8, 10, 'r');          // 後ろ髪が少し覗く
  } else {
    const hairKey = suit ? 'h' : 'r';         // スーツ組は従来どおり h が髪色
    // 髪は頭の丸みに沿わせつつ、型を4種類用意して個体差を出す
    add(13, 26, 50, 50, 7, 17, hairKey);
    add(14, 25, 51, 51, 8, 16, hairKey);
    add(15, 24, 52, 52, 9, 15, hairKey);
    add(17, 22, 53, 53, 11, 14, hairKey);     // てっぺん
    add(14, 25, 45, 51, 8, 10, hairKey);      // 後ろ髪
    if (hair === 4) {                          // 襟足が長め
      add(13, 13, 46, 50, 8, 15, hairKey);
      add(26, 26, 46, 50, 8, 15, hairKey);
      add(14, 25, 41, 46, 7, 10, hairKey);     // 襟足
      add(14, 25, 50, 50, 16, 17, hairKey);
      add(14, 19, 49, 50, 16, 17, hairKey);
    } else if (hair === 5) {                   // オールバック（前髪を立てる）
      add(13, 13, 48, 50, 8, 14, hairKey);
      add(26, 26, 48, 50, 8, 14, hairKey);
      add(14, 25, 51, 52, 15, 17, hairKey);    // 前が盛り上がる
      add(15, 24, 53, 54, 12, 16, hairKey);
    } else if (hair === 1) {                   // 短髪・刈り上げ
      add(13, 13, 49, 50, 8, 13, hairKey);
      add(26, 26, 49, 50, 8, 13, hairKey);
      add(15, 24, 51, 51, 15, 17, hairKey);
    } else if (hair === 2) {                   // 七三分け
      add(13, 13, 47, 50, 8, 14, hairKey);
      add(26, 26, 47, 50, 8, 14, hairKey);
      add(14, 25, 50, 50, 16, 17, hairKey);
      add(14, 20, 48, 50, 16, 17, hairKey);   // 片側を長く
      add(21, 22, 49, 50, 16, 17, hairKey);   // 分け目
    } else if (hair === 3) {                   // 薄毛（頭頂が後退）
      add(13, 13, 46, 50, 8, 14, hairKey);
      add(26, 26, 46, 50, 8, 14, hairKey);
      add(13, 26, 50, 50, 7, 11, hairKey);
      add(14, 25, 45, 49, 8, 10, hairKey);
    } else {                                   // 0: 標準（前髪あり）
      add(13, 13, 47, 50, 8, 14, hairKey);
      add(26, 26, 47, 50, 8, 14, hairKey);
      add(14, 25, 50, 50, 16, 17, hairKey);
      add(14, 18, 49, 50, 16, 17, hairKey);
    }
  }

  // 社員証のネックストラップ（作業着の人の識別色。首から胸に下げる）
  if (!suit && !cap) {
    add(17, 17, 31, 39, 18, 19, 'h');         // ストラップ（長め）
    add(22, 22, 31, 39, 18, 19, 'h');
    add(18, 21, 27, 31, 19, 20, 'h');         // 社員証（識別色。ここで種別を見分ける）
  }
  if (cap) {                                   // キャップ組も同じ位置にストラップ
    add(17, 17, 31, 39, 18, 19, 'h');
    add(22, 22, 31, 39, 18, 19, 'h');
    add(18, 21, 27, 31, 19, 20, 'h');
  }

  return P;
}

// opts からボクセルのグリッドを組む。buildChar3D と分割版で共有する。
function charGrid(palette, opts) {
  const { W, H, D } = C3;
  const grid = new Array(W * H * D).fill(null);
  const at = (x, y, z) => x + y * W + z * W * H;
  for (const [x0, x1, y0, y1, z0, z1, k] of charParts(opts)) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) continue;
      grid[at(x, y, z)] = k;
    }
  }
  const solid = (x, y, z) => {
    if (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) return false;
    const k = grid[at(x, y, z)];
    return k != null && palette[k] != null;
  };
  return { grid, at, solid };
}

// グリッドを面カリングしてジオメトリの素を作る。
//   keep … この部品に含めるボクセルか
//   cull … 隣が埋まっていて面を省けるか
// cull を部品の範囲に限ると切り口に蓋がつく。グリッド全体で判定すると蓋がつかない
// （面が1枚も増えないので継ぎ目も出ない）。使い分けは buildChar3DSplit を参照。
function meshGrid(g, palette, keep, cull) {
  const { W, H, D } = C3;
  const positions = [], normals = [], colors = [], indices = [];
  let vi = 0;
  const ox = -W / 2, oz = -D / 2;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = g.grid[g.at(x, y, z)];
    if (k == null) continue;
    const hexv = palette[k];
    if (hexv == null) continue;
    if (!keep(x, y, z)) continue;
    const rgb = toLinear(hexv);
    for (const f of FACES) {
      if (cull(x + f.d[0], y + f.d[1], z + f.d[2])) continue;
      for (const v of f.v) {
        positions.push(ox + x + v[0], y + v[1], oz + z + v[2]);
        normals.push(f.n[0], f.n[1], f.n[2]);
        colors.push(rgb[0], rgb[1], rgb[2]);
      }
      // 外から見て反時計回りになる順。逆にすると全面がバックフェースカリングされ、
      // 物体の内側（反対側の面）だけが見える状態になる。
      indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
      vi += 4;
    }
  }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals),
    colors: new Float32Array(colors), indices: new Uint32Array(indices),
    width: W, height: H, depth: D,
  };
}

export function buildChar3D(palette, opts = {}) {
  const g = charGrid(palette, opts);
  return meshGrid(g, palette, () => true, g.solid);
}

// ===== 歩行アニメ用の分割 =====
// 1体を「腰より上 / 左脚 / 右脚」の3部品に切り分ける。脚だけを腰で前後に振るため。
// top までが脚。腰のブロック(y15-19)は胴側に残すので、振れるのは膝から下にあたる部分。
// pivot は切り口と同じ高さにしておく（切り口より上に回転軸を置くと、振ったときに
// 脚の上端が横にずれて腰の下から覗く）。
// cx は脚ごとの回転中心。体の中心で振ると、横にずれた脚が回転のぶん沈んで
// 両脚そろって屈伸しているように見えるので、脚ごとに軸を持たせる。
export const LEG = {
  top: 14,                     // 靴 0-5 + ズボン 6-14
  pivot: 15,
  mid: 20,                     // 左右の境目（脚は x 11-18 と 21-28、間は空洞）
  cxA: 14.5 - C3.W / 2,
  cxB: 24.5 - C3.W / 2,
};

export function buildChar3DSplit(palette, opts = {}) {
  const g = charGrid(palette, opts);
  const inA = (x, y) => y <= LEG.top && x < LEG.mid;
  const inB = (x, y) => y <= LEG.top && x >= LEG.mid;
  return {
    // 胴はグリッド全体で間引く。底面は腰の下＝カメラから見えないので蓋は不要。
    body: meshGrid(g, palette, (x, y) => y > LEG.top, g.solid),
    // 脚は自分の範囲だけで間引く＝上面に蓋がつき、振っても中が透けない。
    legA: meshGrid(g, palette, inA, (x, y, z) => inA(x, y) && g.solid(x, y, z)),
    legB: meshGrid(g, palette, inB, (x, y, z) => inB(x, y) && g.solid(x, y, z)),
  };
}

/** CHAR_PALETTES のキーから 3D用モデルを作る（輪郭線なし・高解像度） */
// 個体差のための色。全員同じ顔だと不自然なので、肌と髪に少し幅を持たせる
export const SKINS = ['#f1c79b', '#e6b88b', '#f7d7b2', '#d9a877', '#ecc296'];
export const HAIRS = [
  '#241c14', '#1a1512', '#3a2a1c', '#4a4038',   // 黒〜茶
  '#6a635c', '#9a958e', '#c8c4bf',              // ごま塩〜白髪（年齢差）
];

// パレットと charParts の引数を、キャラ種別＋個体差から決める
function charSpec(key, v) {
  const ov = CHAR_PALETTES[key] || CHAR_PALETTES.buka;
  const { map, ...colors } = ov;
  const base = map === 'suit' ? SUIT_BASE : WORKER_BASE;
  const pal = { ...base, ...colors };
  delete pal.k;                                   // 3Dでは黒の輪郭線を使わない
  pal.g = '#b9bec4';                              // 銀縁メガネ
  if (v.skin != null) pal.s = SKINS[v.skin % SKINS.length];
  // 髪色のキーは作業着が 'r'、スーツが 'h'（SUIT_BASE の規約）
  if (v.hairColor != null) pal[map === 'suit' ? 'h' : 'r'] = HAIRS[v.hairColor % HAIRS.length];
  return {
    pal,
    opts: {
      cap: map === 'cap', suit: map === 'suit',
      hair: v.hair || 0, glasses: v.glasses || 0, beard: v.beard || 0,
      build: v.build == null ? 1 : v.build,
    },
  };
}

export function buildChar3DForType(key, v = {}) {
  const { pal, opts } = charSpec(key, v);
  return buildChar3D(pal, opts);
}

/** 歩行アニメ用に3部品へ分けたもの（胴 / 左脚 / 右脚） */
export function buildChar3DSplitForType(key, v = {}) {
  const { pal, opts } = charSpec(key, v);
  return buildChar3DSplit(pal, opts);
}

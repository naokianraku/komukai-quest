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
function charParts({ cap = false, suit = false }) {
  const P = [];
  const add = (x0, x1, y0, y1, z0, z1, k) => P.push([x0, x1, y0, y1, z0, z1, k]);

  // --- 脚まわり ---
  for (const [lx0, lx1] of [[11, 18], [21, 28]]) {
    add(lx0, lx1, 0, 5, 5, 20, 'f');          // 安全靴（前に長い）
    add(lx0, lx1, 6, 18, 7, 17, 'p');         // ズボン
  }
  add(11, 28, 15, 19, 7, 17, 'p');            // 腰
  add(11, 28, 18, 19, 6, 18, 'f');            // ベルト

  // --- 胴（袖は胴より浅くして段差で腕を分ける）---
  add(11, 28, 19, 37, 5, 19, 'b');            // 上衣（腰幅に合わせて寸胴に見せない）
  // 袖は胴より奥行きを浅くする。段差ができて腕が胴に溶けない。
  add(6, 10, 22, 35, 8, 16, 'b');             // 左袖
  add(29, 33, 22, 35, 8, 16, 'b');            // 右袖
  add(6, 10, 18, 21, 8, 16, 's');             // 左手
  add(29, 33, 18, 21, 8, 16, 's');            // 右手

  if (suit) {
    add(19, 20, 20, 36, 19, 19, 't');         // ネクタイ
    add(15, 18, 35, 37, 5, 19, 'b');          // 襟（スーツ）
    add(21, 24, 35, 37, 5, 19, 'b');
  } else {
    add(9, 30, 33, 37, 5, 19, 'a');           // 肩ヨーク
    add(6, 10, 32, 35, 8, 16, 'a');           // 袖の肩側
    add(29, 33, 32, 35, 8, 16, 'a');
    add(6, 10, 22, 23, 8, 16, 'a');           // 袖口
    add(29, 33, 22, 23, 8, 16, 'a');
    add(19, 20, 20, 34, 19, 19, 'a');         // 前立て
    for (const by of [23, 27, 31]) add(19, 20, by, by, 20, 20, 'b'); // ボタン
    add(12, 17, 26, 30, 19, 19, 'a');         // 胸ポケット
    add(12, 17, 30, 31, 19, 20, 'a');         // ポケットのフラップ
    add(15, 24, 37, 39, 5, 19, 'a');          // 襟
  }

  // --- 首・頭（ここを大きく取るのが要点）---
  add(17, 22, 36, 40, 9, 15, 's');            // 首（襟から少し覗かせる）
  add(12, 27, 40, 52, 6, 18, 's');            // 頭（胴より少し細く）
  add(11, 11, 43, 47, 9, 14, 's');            // 左耳
  add(28, 28, 43, 47, 9, 14, 's');            // 右耳
  // 目は「窪み」にする。面一だと照明次第で肌に溶け、1ボクセル出すと側面が影になって
  // 括弧のように見える。2ボクセル彫り込むと光が入らず、どの角度でも目として読める。
  // 前髪が上から影を落とすので、目はやや下げて大きめに取る（小さいと影に沈んで消える）
  add(14, 16, 44, 45, 16, 18, 'e');
  add(23, 25, 44, 45, 16, 18, 'e');

  // --- 髪 / かぶりもの ---
  // 事務・技術の人はヘルメットをかぶらない（実物の執務室の写真どおり）。
  // 製造・現場だけ つば付きのキャップ。識別色(h)は髪に使うと不自然なので、
  // 作業着の人は「社員証のネックストラップ」に回している。
  if (cap) {
    add(13, 26, 51, 58, 7, 17, 'h');          // キャップ本体
    add(12, 27, 51, 52, 18, 22, 'h');         // つば
    add(13, 26, 49, 51, 6, 8, 'r');           // 後ろ髪が少し覗く
  } else {
    const hairKey = suit ? 'h' : 'r';         // スーツ組は従来どおり h が髪色
    add(12, 27, 49, 53, 6, 18, hairKey);      // 頭頂
    add(12, 27, 43, 52, 6, 8, hairKey);       // 後ろ髪
    add(12, 13, 45, 52, 6, 14, hairKey);      // 左の生え際
    add(26, 27, 45, 52, 6, 14, hairKey);      // 右の生え際
    add(12, 27, 49, 50, 17, 18, hairKey);     // 前髪（目にかからない高さに）
    add(12, 16, 48, 50, 17, 18, hairKey);     // 前髪の流れ（左を少し長く）
  }

  // 社員証のネックストラップ（作業着の人の識別色。首から胸に下げる）
  if (!suit && !cap) {
    add(17, 17, 34, 39, 18, 19, 'h');         // ストラップ（細く）
    add(22, 22, 34, 39, 18, 19, 'h');
    add(18, 21, 31, 34, 19, 20, 'h');         // 社員証（識別色。ここで種別を見分ける）
  }
  if (cap) {                                   // キャップ組も同じ位置にストラップ
    add(17, 17, 34, 39, 18, 19, 'h');
    add(22, 22, 34, 39, 18, 19, 'h');
    add(18, 21, 31, 34, 19, 20, 'h');
  }

  return P;
}

export function buildChar3D(palette, opts = {}) {
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

  const positions = [], normals = [], colors = [], indices = [];
  let vi = 0;
  const ox = -W / 2, oz = -D / 2;
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = grid[at(x, y, z)];
    if (k == null) continue;
    const hexv = palette[k];
    if (hexv == null) continue;
    const rgb = toLinear(hexv);
    for (const f of FACES) {
      if (solid(x + f.d[0], y + f.d[1], z + f.d[2])) continue;
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

/** CHAR_PALETTES のキーから 3D用モデルを作る（輪郭線なし・高解像度） */
export function buildChar3DForType(key) {
  const ov = CHAR_PALETTES[key] || CHAR_PALETTES.buka;
  const { map, ...colors } = ov;
  const base = map === 'suit' ? SUIT_BASE : WORKER_BASE;
  const pal = { ...base, ...colors };
  delete pal.k;                                   // 3Dでは黒の輪郭線を使わない
  return buildChar3D(pal, { cap: map === 'cap', suit: map === 'suit' });
}

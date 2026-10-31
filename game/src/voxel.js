// ドット絵（12x18の文字配列）を押し出してボクセルのジオメトリに変換する。
//
// 2Dの sprites.js と同じ WORKER_MAP / SUIT_MAP / CHAR_PALETTES をそのまま使うので、
// キャラを描き直す必要がない。2形状 × パレット差し替えで全キャラが3D化できる。
// three.js には依存せず、素の配列（positions/normals/colors/indices）を返す。
import { WORKER_MAP, SUIT_MAP, WORKER_BASE, SUIT_BASE, CHAR_PALETTES } from './sprites.js';

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
          indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
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
  const srcMap = map === 'suit' ? SUIT_MAP : WORKER_MAP;
  return buildVoxel(srcMap, { ...base, ...colors });
}

export function allTypeKeys() { return Object.keys(CHAR_PALETTES); }

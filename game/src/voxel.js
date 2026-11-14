// ドット絵（12x18の文字配列）を押し出してボクセルのジオメトリに変換する。
//
// 2Dの sprites.js と同じ WORKER_MAP / SUIT_MAP / CHAR_PALETTES をそのまま使うので、
// キャラを描き直す必要がない。2形状 × パレット差し替えで全キャラが3D化できる。
// three.js には依存せず、素の配列（positions/normals/colors/indices）を返す。
import { WORKER_MAP, WORKER_CAP_MAP, SUIT_MAP, WORKER_BASE, SUIT_BASE, CHAR_PALETTES, splitPalette } from './sprites.js';

export const DEPTH = 4; // 奥行き（ボクセル数）。薄い板にならない程度

// パレットから色を引く。本編のパレットは小文字1文字のキーしか使わないので、その場合は
// palette[k] そのもの（従来どおり）。3D専用の拡張が2つある:
//   大文字1文字 … 小文字と同じ色。ただし脚の部品に入れず胴と一緒に動く（上着の裾・小物）
//   '#rrggbb'   … その色そのもの（小物の色。パレットに足さずに済む）
function colorOf(palette, k) {
  if (k == null) return null;
  const c = palette[k];
  if (c !== undefined) return c;
  if (k.length === 7 && k[0] === '#') return k;
  if (k.length === 1 && k >= 'A' && k <= 'Z') return palette[k.toLowerCase()] ?? null;
  return null;
}
// 胴と一緒に動く“固い”キー（上の2つの拡張）。脚より下にあっても脚と一緒に振らない
const rigid = (k) => k != null && (k.length > 1 || (k >= 'A' && k <= 'Z'));

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
  const { map, colors } = splitPalette(ov);   // shirt など形の指定は色に混ぜない
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

// 自社の作業着とスーツの胴（本編の全員と、続編の自社の人）。中身は以前 charParts に
// 直に書いていたものをそのまま移しただけで、並び順も変えていない（後から足したものが勝つため）。
function defaultTorso(add, { bw, bd, build, suit, openShirt }) {
  // --- 胴（袖は胴より浅くして段差で腕を分ける）---
  add(11 - bw, 28 + bw, 19, 37, 5 - bd, 19 + bd, 'b');   // 上衣
  // 袖は胴より奥行きを浅くする。段差ができて腕が胴に溶けない。
  add(6 - bw, 10 - bw, 22, 35, 8, 16, 'b');   // 左袖
  add(29 + bw, 33 + bw, 22, 35, 8, 16, 'b');  // 右袖
  add(6 - bw, 10 - bw, 18, 21, 8, 16, 's');   // 左手
  add(29 + bw, 33 + bw, 18, 21, 8, 16, 's');  // 右手

  if (suit && openShirt) {
    // ネクタイなし。胸元をV字に開けてワイシャツを見せる。
    // 細い帯のままだと、色を変えても「白いネクタイ」にしか見えない。
    add(17, 22, 32, 36, 19 + bd, 19 + bd, 't');            // 胸元（いちばん広い）
    add(18, 21, 26, 31, 19 + bd, 19 + bd, 't');            // 中ほど
    add(19, 20, 20, 25, 19 + bd, 19 + bd, 't');            // 裾へ向けて細く
    add(16, 18, 35, 37, 5 - bd, 19 + bd, 't');             // ワイシャツの襟
    add(21, 23, 35, 37, 5 - bd, 19 + bd, 't');
    add(14, 15, 34, 37, 5 - bd, 19 + bd, 'b');             // ジャケットの襟（その外側）
    add(24, 25, 34, 37, 5 - bd, 19 + bd, 'b');
  } else if (suit) {
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
}

function charParts(opts) {
  const { cap = false, suit = false, hair = 0, glasses = 0, beard = 0, build = 1, openShirt = false } = opts;
  // 3D専用の形の指定（続編がパレットに書く outfit / headwear / pose / back / props など）。
  // 無ければ null で、下の分岐はすべて従来どおりに通る（本編の見た目はここで変わらない）。
  const look = opts.look || null;
  // build: 0=細身 / 1=標準 / 2=がっしり / 3=小柄で太め。
  // メッシュを拡大縮小するだけでは差が出ないので、肩幅・胴まわり・腹の出方をモデル側で変える。
  // 胸ポケットやボタンなど胴の前面につくものは、bd と一緒に前へ出さないと腹に埋まる。
  const bw = [-1, 0, 1, 3][build] || 0;          // 胴の左右への張り出し
  const bd = [-1, 0, 1, 3][build] || 0;          // 胴の前後への厚み（腹）
  const P = [];
  const add = (x0, x1, y0, y1, z0, z1, k) => P.push([x0, x1, y0, y1, z0, z1, k]);
  // 自社の作業着（outfit 無し or 'work'）以外の服を着ているか。社員証のストラップもこれで決まる
  const custom = !!(look && look.outfit && look.outfit !== 'work');

  // --- 脚まわり ---
  for (const [lx0, lx1] of [[11, 18], [21, 28]]) {
    add(lx0, lx1, 0, 5, 5, 20, 'f');          // 安全靴（前に長い）
    add(lx0, lx1, 6, 18, 7, 17, 'p');         // ズボン
  }
  add(11 - bw, 28 + bw, 15, 19, 7 - bd, 17 + bd, 'p');   // 腰
  add(11 - bw, 28 + bw, 18, 19, 6 - bd, 18 + bd, 'f');   // ベルト

  if (custom) outfitParts(add, look, { bw, bd });                 // 続編の服の型（下の関数）
  else defaultTorso(add, { bw, bd, build, suit, openShirt });     // 自社の作業着／スーツ（従来どおり）

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
  // 続編の自社の人（主人公・同期）だけは保護帽をかぶる（headwear: 'helmet'）。
  // 2Dのドット絵では h がヘルメットの色なので、3Dでも h をそのまま帽子の色にする。
  const hw = look ? look.headwear : null;
  if (hw === 'helmet') {
    helmetParts(add, suit ? 'h' : 'r');
  } else if (cap || hw === 'cap') {
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
  // 自社の社員証なので、続編で他社の服（custom）を着ている人には付けない。
  if (!suit && !cap && !custom) {
    add(17, 17, 31, 39, 18, 19, 'h');         // ストラップ（長め）
    add(22, 22, 31, 39, 18, 19, 'h');
    add(18, 21, 27, 31, 19, 20, 'h');         // 社員証（識別色。ここで種別を見分ける）
  }
  if (cap && !custom) {                        // キャップ組も同じ位置にストラップ
    add(17, 17, 31, 39, 18, 19, 'h');
    add(22, 22, 31, 39, 18, 19, 'h');
    add(18, 21, 27, 31, 19, 20, 'h');
  }

  if (look) lookExtras(add, look, { bw, bd }, suit ? 'h' : 'r', hw);   // 後ろ姿・小物（続編）
  return P;
}

// ===== 続編（ゴールデンエイジ編）の3D専用の形 =====
// どれもパレットの形の指定（sprites.js の SHAPE_KEYS）があるときだけ通る。本編は通らない。
//
// 色のキー: b=上衣（袖も） p=ズボン a=縁取り・切替 t=ネクタイ w=中に着たシャツ
//           v=ベスト・白衣 l=反射テープ x=差し色（腕章・身分証のひも・四騎士の光の色）
// 大文字は同じ色で“固い”部品（colorOf / rigid）。上着の裾や手に持つ物を脚より下まで
// 下ろしても、脚と一緒に振られず胴について動く。

// 服の型ごとの胴・腕・襟。o = { bw, bd }（build による胴の張り出し）
function outfitParts(add, look, o) {
  const { bw, bd } = o;
  const F = 19 + bd, B = 5 - bd;               // 胴の前面・背面のボクセル（+1 で1段浮かせる）
  const sh = look.shoulder || 0;               // 肩幅の上乗せ（スーツの肩。胸から上だけ広げる）
  const t = look.outfit;
  const top = t === 'labcoat' ? 'v' : (t === 'coverall' && look.roll) ? 'w' : 'b';   // 上に着ている物
  // 身頃。肩を張る型は胸から上だけ広げる（胴ごと太らせると寸胴に見える）
  add(11 - bw, 28 + bw, 19, 29, B, F, top);
  add(11 - bw - sh, 28 + bw + sh, 30, 37, B, F, top);
  const L = [6 - bw - sh, 10 - bw - sh], R = [29 + bw + sh, 33 + bw + sh];   // 袖の x
  const bare = t === 'polo' || (t === 'shirt' && look.roll) || (t === 'coverall' && look.roll);
  arms(add, look, o, L, R, top, bare);
  const crossed = look.pose === 'cross';
  // 袖口（腕組みのときは前腕が胸の前にあるので付けない）
  const cuff = (k, y0, y1) => {
    if (crossed) return;
    for (const [x0, x1] of [L, R]) add(x0, x1, y0, y1, 7, 17, k);
  };
  const skirt = (k, hem, flare) => {          // 上着の裾（腰から hem まで。固いキーで置く）
    add(10 - bw, 29 + bw, hem, 19, B - 1, F + 1, k);
    if (flare) add(9 - bw, 30 + bw, hem, hem + 1, B - 2, F + 2, k);   // 裾の広がり
  };
  const vee = () => {                         // 上着の胸元のV（中のシャツ）
    add(17, 22, 32, 36, F, F, 'w');
    add(18, 21, 29, 31, F, F, 'w');
  };
  const tie = () => {                         // ネクタイと結び目
    add(19, 20, 22, 34, F + 1, F + 1, 't');
    add(18, 21, 34, 36, F + 1, F + 1, 't');
  };

  switch (t) {
    case 'jumper':      // 作業ジャンパー。裾と袖口を絞り、前はファスナー、立ち襟
      add(11 - bw, 28 + bw, 19, 21, B - 1, F + 1, 'a');      // 裾のリブ
      if (look.tie) {                                         // 課長はファスナーを下ろしてネクタイを見せる
        vee(); tie();
        add(19, 20, 22, 28, F + 1, F + 1, 'a');
      } else add(19, 20, 22, 36, F + 1, F + 1, 'a');          // 前のファスナー
      add(15, 24, 37, 39, B + 1, F - 1, 'a');                 // 立ち襟（首のまわりを囲む）
      cuff('a', 22, 23);
      break;
    case 'coverall':    // つなぎ。上下が同じ布（ズボンの色はパレット側で上衣と揃える）
      add(11 - bw, 28 + bw, 18, 18, 6 - bd, 18 + bd, 'p');   // 黒い革ベルトは締めない
      if (look.roll) {
        // 上半身を脱いで袖を腰で結ぶ（中は肌着）。つなぎの上身頃が腰に溜まる
        add(10 - bw, 29 + bw, 17, 21, B - 2, F + 2, 'B');
        add(17, 19, 12, 18, F + 2, F + 3, 'B');               // 結んだ袖が前に垂れる
        add(20, 22, 13, 18, F + 2, F + 3, 'B');
        add(15, 24, 36, 37, B + 1, F - 1, 'w');               // 肌着の丸首
      } else {
        add(11 - bw, 28 + bw, 19, 20, B - 1, F + 1, 'a');    // 共布のベルト
        add(19, 20, 21, 36, F + 1, F + 1, 'a');               // 長いファスナー
        add(12, 16, 27, 31, F + 1, F + 1, 'a');               // 胸ポケット（左右）
        add(23, 27, 27, 31, F + 1, F + 1, 'a');
        add(15, 24, 37, 39, B, F, 'a');                       // 襟
        cuff('a', 22, 23);
      }
      break;
    case 'polo':        // ポロシャツ。半袖（肘から先は素肌）、寝かせた襟と短い前立て
      add(15, 24, 37, 38, B + 1, F - 1, 'a');                 // 襟（首まわり）
      add(16, 18, 35, 37, F, F + 1, 'a');                     // 襟先
      add(21, 23, 35, 37, F, F + 1, 'a');
      add(19, 20, 29, 36, F + 1, F + 1, 'a');                 // 前立て
      cuff('a', 28, 28);                                      // 袖口のリブ
      break;
    case 'shirt':       // ワイシャツ。tie でネクタイ、roll で腕まくり
      add(15, 24, 37, 38, B + 1, F - 1, 'a');                 // 襟まわり
      add(16, 18, 34, 37, F, F + 1, 'a');                     // 襟先
      add(21, 23, 34, 37, F, F + 1, 'a');
      if (look.tie) tie();
      else add(19, 20, 20, 34, F + 1, F + 1, 'a');            // 前立て
      if (look.roll) cuff(top, 27, 28);                       // まくり上げた袖の厚み
      else cuff('a', 22, 22);
      break;
    case 'vest':        // 安全ベスト。シャツの上から身頃を1段大きく包み、反射テープを2本巻く
      if (look.knit) {  // knit: ニットのベスト（中のシャツ＝上衣 b の上に着る。前をVに開けてシャツとネクタイを見せる）
        add(11 - bw, 28 + bw, 19, 34, B - 1, F + 1, 'v');
        add(13, 17, 35, 36, B - 1, F + 1, 'v');               // 肩
        add(22, 26, 35, 36, B - 1, F + 1, 'v');
        for (let y = 28; y <= 36; y++) {                      // Vの開き（下ほど狭い）
          const w = Math.floor((y - 28) / 3);
          add(19 - w, 20 + w, y, y, F + 1, F + 1, 'b');
        }
        if (look.tie) {                                       // ネクタイはVの中だけ見える
          add(19, 20, 28, 33, F + 1, F + 1, 't');
          add(18, 21, 34, 36, F + 1, F + 1, 't');
        }
        add(15, 24, 37, 38, B + 1, F - 1, 'a');               // シャツの襟
        add(16, 18, 35, 37, F, F + 1, 'a');
        add(21, 23, 35, 37, F, F + 1, 'a');
        cuff('a', 22, 22);
        break;
      }
      add(11 - bw, 28 + bw, 20, 35, B - 1, F + 1, 'v');
      add(11 - bw, 28 + bw, 24, 25, B - 1, F + 1, 'l');
      add(11 - bw, 28 + bw, 29, 30, B - 1, F + 1, 'l');
      add(18, 21, 20, 35, F + 1, F + 1, 'b');                 // 前の合わせ（中のシャツが覗く）
      add(13, 17, 35, 37, B - 1, F + 1, 'v');                 // 肩
      add(22, 26, 35, 37, B - 1, F + 1, 'v');
      add(15, 24, 37, 38, B, F, 'a');                         // シャツの襟
      cuff('a', 22, 22);
      break;
    case 'cardigan':    // カーディガン。前のVからシャツ、ボタンと腰ポケット、裾と袖口のリブ
      add(11 - bw, 28 + bw, 19, 20, B - 1, F + 1, 'a');
      vee();
      add(16, 18, 35, 37, F, F + 1, 'w');                     // シャツの襟
      add(21, 23, 35, 37, F, F + 1, 'w');
      for (const y of [21, 23, 25, 27]) add(19, 20, y, y, F + 1, F + 1, 'a');
      add(12, 16, 21, 24, F + 1, F + 1, 'a');
      add(23, 27, 21, 24, F + 1, F + 1, 'a');
      cuff('a', 22, 23);
      break;
    case 'suit':        // 上着。本編のスーツと違い胸元のV（シャツ）と襟の縁を見せて形を読ませる
      if (look.skirt) skirt('B', look.skirt, false);          // 丈の長い上着
      if (look.vest3) {                                       // 三つ揃い: Vの奥にベスト
        add(16, 23, 24, 36, F, F, 'v');
        add(17, 22, 32, 36, F, F, 'w');
      } else vee();
      if (look.tie !== false) tie();
      else { add(17, 22, 26, 31, F, F, 'w'); add(16, 23, 35, 37, F, F + 1, 'w'); }   // 開襟
      add(16, 16, 27, 36, F + 1, F + 1, 'a');                 // 襟（ラペル）の縁
      add(23, 23, 27, 36, F + 1, F + 1, 'a');
      if (look.blazer) {                                      // blazer: 替え上着。金ボタン2つ（差し色 x）
        add(17, 17, 24, 24, F + 1, F + 1, 'x');
        add(17, 17, 21, 21, F + 1, F + 1, 'x');
      } else add(17, 17, 23, 23, F + 1, F + 1, 'a');          // ボタン
      cuff('w', 22, 22);                                      // シャツの袖口が少し覗く
      break;
    case 'sweater':     // ニットのプルオーバー（ビジネスカジュアル）。裾と袖口はリブ。
      // 既定は丸首から中のシャツの襟先 / zip: ハーフジップ（立ち襟と胸元までのファスナー） /
      // collar: 'high' タートルネック（首を顎の下まで包む）
      add(11 - bw, 28 + bw, 19, 20, B - 1, F + 1, 'a');      // 裾のリブ
      if (look.collar === 'high') {
        add(14, 25, 37, 41, B + 1, F - 1, top);
        add(14, 25, 41, 41, B + 1, F - 1, 'a');               // 折り返しの縁
      } else if (look.zip) {
        add(15, 24, 37, 40, B + 1, F - 1, top);               // 立ち襟
        add(19, 20, 30, 40, F + 1, F + 1, 'a');               // ファスナー
        add(16, 18, 36, 37, F, F + 1, 'w');                   // 中のシャツの襟先が覗く
        add(21, 23, 36, 37, F, F + 1, 'w');
      } else {
        add(15, 24, 37, 38, B + 1, F - 1, 'a');               // 丸首のリブ
        add(16, 18, 35, 37, F, F + 1, 'w');                   // 中のシャツの襟先
        add(21, 23, 35, 37, F, F + 1, 'w');
      }
      cuff('a', 22, 23);
      break;
    case 'coat': {      // 丈の長い上着。collar: 'high' で顎まで立つ襟、そうでなければ胸元を開けてネクタイ
      skirt('B', look.skirt || 9, true);
      add(19, 20, look.skirt || 9, 30, F + 1, F + 1, 'A');    // 前の合わせ目
      for (const y of [16, 20, 24, 28]) {                     // ダブルのボタン2列
        add(16, 16, y, y, F + 2, F + 2, 'A');
        add(23, 23, y, y, F + 2, F + 2, 'A');
      }
      if (look.collar === 'high') add(14, 25, 37, 41, B + 1, F - 1, 'a');
      else { vee(); tie(); add(16, 16, 31, 36, F + 1, F + 1, 'a'); add(23, 23, 31, 36, F + 1, F + 1, 'a'); }
      cuff('a', 22, 23);
      break;
    }
    case 'labcoat':     // 白衣。前を開けて中の上着とネクタイを見せる。裾は膝まで
      skirt('V', look.skirt || 10, false);
      add(18, 21, look.skirt || 10, 18, F + 1, F + 1, 'P');  // 裾の合わせ目（中のズボンが覗く）
      add(16, 23, 20, 36, F, F, 'b');                         // 中の上着
      vee(); tie();
      add(15, 15, 20, 36, F + 1, F + 1, 'v');                 // 前身頃の縁
      add(24, 24, 20, 36, F + 1, F + 1, 'v');
      add(12, 14, 22, 25, F + 1, F + 1, 'a');                 // 腰ポケット
      add(25, 27, 22, 25, F + 1, F + 1, 'a');
      add(15, 24, 37, 39, B, F, 'v');                         // 襟
      break;
    case 'robe': {      // 法衣。足首までの裾と広い袖口、合わせと立ち襟を差し色で縁取る
      const hem = look.skirt || 6;
      skirt('B', hem, true);
      add(L[0] - 1, L[1], 21, 25, 7, 17, top);                // 袖口を広げる
      add(R[0], R[1] + 1, 21, 25, 7, 17, top);
      add(19, 20, hem, 36, F + 1, F + 1, 'X');                // 前の合わせ
      add(9 - bw, 30 + bw, hem, hem, B - 2, F + 2, 'X');      // 裾の縁
      add(15, 24, 37, 40, B + 1, F - 1, 'x');                 // 立ち襟
      break;
    }
  }
}

// 腕。垂らすのが基本。pose: 'cross' は腕組み（見ているだけの人）。
// bare（半袖・腕まくり）は肘から先を素肌にして、前腕を袖より細くする。
function arms(add, look, o, L, R, top, bare) {
  const F = 19 + o.bd;
  if (look.pose === 'cross') {
    // 上腕は脇に下ろし、前腕を胸の前で重ねる。x の大きい側の腕を1段手前・1段上に重ねて、
    // 組んでいるのが読めるようにする。手は反対側の腕の下に半分隠れる。
    const fk = bare ? 's' : top;
    add(L[0], L[1], 28, 35, 8, 16, top);                     // 上腕
    add(R[0], R[1], 30, 35, 8, 16, top);
    add(L[0], L[1], 25, 28, 8, F + 2, fk);                   // 肘から前へ
    add(R[0], R[1], 28, 31, 8, F + 3, fk);
    add(L[0], 26, 25, 27, F + 1, F + 2, fk);                 // 前腕（下の段）
    add(13, R[1], 28, 30, F + 2, F + 3, fk);                 // 前腕（上の段）
    add(24, 27, 26, 28, F + 2, F + 2, 's');                  // 手
    add(12, 15, 28, 30, F + 3, F + 3, 's');
    return;
  }
  for (const [x0, x1] of [L, R]) {
    if (bare) {
      add(x0, x1, 28, 35, 8, 16, top);                       // 袖（肘まで）
      add(x0, x1, 22, 27, 9, 15, 's');                       // 前腕
    } else add(x0, x1, 22, 35, 8, 16, top);
    add(x0, x1, 18, 21, 8, 16, 's');                         // 手
  }
}

// 保護帽。キャップと同じ高さ（頂上 y=56）に収める。段を細かく刻むと鉢巻を巻いた頭に見えるので、
// 「ぐるりと張り出した薄いつば＋まっすぐな側面＋丸い頂」の3つに絞り、つばの下の影で帽子だと読ませる。
// 髪は帽子の下から後ろ髪ともみあげだけ覗かせる（髪型は帽子に隠れる）。
function helmetParts(add, hairKey) {
  add(13, 26, 44, 48, 7, 8, hairKey);          // 後ろ髪（後頭部を覆う）
  add(13, 13, 45, 48, 9, 12, hairKey);         // もみあげ
  add(26, 26, 45, 48, 9, 12, hairKey);
  add(11, 28, 49, 49, 5, 19, 'h');             // つば（頭のまわりへ2つ張り出す）
  add(14, 25, 49, 49, 20, 21, 'h');            // 前のひさし
  add(13, 26, 50, 53, 6, 18, 'h');             // 側面
  add(14, 25, 54, 55, 7, 17, 'h');             // 肩（丸み）
  add(16, 23, 56, 56, 9, 15, 'h');             // 頂
  add(19, 20, 56, 56, 7, 17, 'h');             // 前後に通る稜線
}

// 小物（持ち物）。名前 → ボクセルの箱の並び（または o を受けて並びを返す関数）。
// 続編のファイル（game2-3d/src/chars2.js）が registerProps で登録し、パレットの props で持たせる。
// 色は '#rrggbb' か大文字のキー（どちらも胴と一緒に動く）。文字・社章・頭文字に見える記号は描かない。
// o = { bw, bd }。手の位置は x 6-bw..10-bw / 29+bw..33+bw、y 18-21（肩を張る型は外へ shoulder ぶん）。
const PROPS = {};
export function registerProps(map) { Object.assign(PROPS, map); }
export function propNames() { return Object.keys(PROPS); }

// 後ろ姿と小物
function lookExtras(add, look, o, hairKey, hw) {
  const { bw, bd } = o;
  const B = 5 - bd;
  // 背中を見せる人の後頭部。従来の髪は頭の後ろ面（z=7）より内側にしか無く、正面寄りの
  // カメラでは見えないので問題にならなかったが、背中を向けると肌の色の「顔」に見えてしまう。
  if ((look.back || look.faceAway) && hw !== 'helmet') {
    add(13, 26, 44, 50, 7, 8, hairKey);        // 後頭部を覆う
    add(13, 13, 45, 50, 8, 11, hairKey);       // 耳の後ろ
    add(26, 26, 45, 50, 8, 11, hairKey);
    add(15, 24, 43, 43, 8, 9, hairKey);        // 襟足（すぼめて首へつなぐ）
  }
  if (look.back && !(look.outfit && look.outfit !== 'work')) {
    // 自社の作業着の背中。後ろ姿しか見せない人（PM）の背中を平板にしないよう、肩のヨークを
    // 背中側だけ深くし、襟を後ろで立てる。縦の縫い目は入れない（文字や記号に見えるため）。
    add(11 - bw, 28 + bw, 30, 32, B, B, 'a');
    add(15, 24, 39, 40, 6, 8, 'a');
  }
  for (const name of look.props || []) {
    const def = PROPS[name];
    if (!def) continue;          // 登録の無い小物は描かない（続編のファイルを読まないページでも落ちない）
    for (const p of (typeof def === 'function' ? def({ ...o, sh: look.shoulder || 0 }) : def)) add(...p);
  }
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
  const key = (x, y, z) => (x < 0 || x >= W || y < 0 || y >= H || z < 0 || z >= D) ? null : grid[at(x, y, z)];
  const solid = (x, y, z) => colorOf(palette, key(x, y, z)) != null;
  return { grid, at, key, solid };
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
    const hexv = colorOf(palette, k);
    if (hexv == null) continue;
    if (!keep(x, y, z, k)) continue;
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
  // 固いキー（上着の裾・手に持つ物）は脚の高さにあっても胴の部品に入れる。脚と一緒に
  // 振られると裾が割れて見える。本編のパレットには固いキーが無いので、分け方は従来どおり。
  const inA = (x, y, k) => y <= LEG.top && x < LEG.mid && !rigid(k);
  const inB = (x, y, k) => y <= LEG.top && x >= LEG.mid && !rigid(k);
  return {
    // 胴はグリッド全体で間引く。底面は腰の下＝カメラから見えないので蓋は不要。
    body: meshGrid(g, palette, (x, y, z, k) => y > LEG.top || rigid(k), g.solid),
    // 脚は自分の範囲だけで間引く＝上面に蓋がつき、振っても中が透けない。
    legA: meshGrid(g, palette, (x, y, z, k) => inA(x, y, k), (x, y, z) => inA(x, y, g.key(x, y, z)) && g.solid(x, y, z)),
    legB: meshGrid(g, palette, (x, y, z, k) => inB(x, y, k), (x, y, z) => inB(x, y, g.key(x, y, z)) && g.solid(x, y, z)),
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
  const { map, shape, colors } = splitPalette(ov);   // 形の指定（shirt など）は色に混ぜない
  const base = map === 'suit' ? SUIT_BASE : WORKER_BASE;
  const pal = { ...base, ...colors };
  delete pal.k;                                   // 3Dでは黒の輪郭線を使わない
  pal.g = '#b9bec4';                              // 銀縁メガネ
  // keepSkinHair: 肌と髪はパレットのまま（四騎士の灰の肌と白髪を、個体差で人の色に戻さない）
  const keep = !!shape.keepSkinHair;
  if (v.skin != null && !keep) pal.s = SKINS[v.skin % SKINS.length];
  // 髪色のキーは作業着が 'r'、スーツが 'h'（SUIT_BASE の規約）
  if (v.hairColor != null && !keep) pal[map === 'suit' ? 'h' : 'r'] = HAIRS[v.hairColor % HAIRS.length];
  const opts = {
    cap: map === 'cap', suit: map === 'suit',
    hair: v.hair || 0, glasses: v.glasses || 0, beard: v.beard || 0,
    build: v.build == null ? 1 : v.build,
    openShirt: !!shape.shirt,
  };
  if (has3DLook(shape)) {
    opts.look = shape;
    // 3D専用の色の既定。縁取り a は自社の紺のヨーク（WORKER_BASE）を借りず、上着を沈めた色にする
    if (shape.outfit && shape.outfit !== 'work' && colors.a == null) pal.a = shade(pal.b, 0.68);
    if (pal.w == null) pal.w = '#eef0f2';         // 中に着たシャツ
    if (pal.v == null) pal.v = shade(pal.b, 0.8); // ベスト・白衣
    if (pal.l == null) pal.l = '#dfe4e8';         // 反射テープ
    if (pal.x == null) pal.x = '#8a9098';         // 差し色
  }
  return { pal, opts };
}

// map / shirt 以外の形の指定があるか（＝続編の3Dの見た目を使う種別か）
function has3DLook(shape) {
  for (const k in shape) if (k !== 'map' && k !== 'shirt') return true;
  return false;
}

// '#rrggbb' を k 倍に沈めた色
function shade(hexv, k) {
  const n = parseInt(hexv.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return '#' + c((n >> 16) & 255) + c((n >> 8) & 255) + c(n & 255);
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

/** 種別＋個体差で決まる3Dの色（光る目・攻撃の前腕の色を合わせるため） */
export function paletteOf(key, v = {}) { return charSpec(key, v).pal; }

// 攻撃のときに伸ばす前腕の色。描画エンジンは全員に作業着の空色の袖と肌色の手首を
// 付けていたが、続編の服（outfit を持つ種別）は本人の上衣と肌から取る。
// outfit の無い種別（本編の全員）は null を返し、エンジンは従来の袖のまま描く。
export function armColorsOf(key, v = {}) {
  const look = lookOf(key);
  if (!look.outfit) return null;
  const pal = paletteOf(key, v);
  const t = look.outfit;
  const bare = t === 'polo' || (t === 'shirt' && look.roll) || (t === 'coverall' && look.roll);
  const top = t === 'labcoat' ? 'v' : 'b';
  return { sleeve: bare ? pal.s : pal[top], skin: pal.s };
}

// ===== 種別ごとの3Dの見た目の指定（パレットの形の指定）=====
const NO_LOOK = Object.freeze({});
const lookCache = new WeakMap();   // パレットの実体ごと。registerPalettes で差し替わったら引き直す
export function lookOf(key) {
  const ov = CHAR_PALETTES[key];
  if (!ov) return NO_LOOK;
  let l = lookCache.get(ov);
  if (!l) { l = Object.freeze(splitPalette(ov).shape); lookCache.set(ov, l); }
  return l;
}

// ===== 個体差（どの顔・体格で出すか）=====
// 全員が同じ顔・同じ体型だと不自然なので、髪型・眼鏡・肌と髪の色・体格に幅を持たせる。
// エンティティIDから決めるので、同じキャラは画面にいる間ずっと同じ見た目になる。
// （以前は render3d.js にあった。Node のテストから確かめられるよう、形と同じここに置く）
//
// 見た目のプリセット20種。[髪型, 眼鏡, 髭, 肌, 髪色, 体格]
// 1軸だけ変えるとパッと見で同じ人に見えるので、1体ごとに複数軸をまとめて変える。
export const APPEARANCES = [
  [0, 0, 0, 0, 0, 1], [1, 1, 0, 1, 1, 0], [2, 0, 0, 2, 2, 2], [3, 2, 1, 3, 4, 3],
  [4, 0, 0, 0, 0, 0], [5, 1, 0, 1, 0, 2], [0, 0, 2, 4, 2, 1], [1, 2, 0, 2, 5, 3],
  [2, 1, 1, 0, 1, 1], [3, 0, 0, 3, 6, 2], [4, 1, 0, 2, 3, 1], [5, 0, 2, 1, 2, 0],
  [0, 2, 0, 3, 1, 2], [1, 0, 1, 4, 0, 1], [2, 0, 0, 1, 5, 0], [3, 1, 2, 0, 4, 1],
  [4, 2, 0, 4, 2, 2], [5, 0, 0, 3, 3, 3], [0, 1, 1, 2, 6, 3], [2, 2, 2, 4, 4, 0],
];
// ボスは小柄だと貫禄が出ないので、体格は標準以上に寄せた別表にする
export const BOSS_APPEARANCES = [
  [2, 1, 0, 1, 5, 2], [3, 2, 1, 2, 6, 2], [5, 0, 2, 0, 1, 2],
  [1, 1, 0, 3, 4, 1], [0, 2, 0, 2, 6, 2], [2, 0, 1, 4, 5, 2],
];
export const PLAYER_APPEARANCE = [0, 0, 0, 0, 0, 1];
// 若い人の表（パレットに age: 'young'）。上の表から薄毛・白混じり〜白髪・髭を除いたもの。
// 入社1年目の同期に白髪や薄毛が当たらないようにする。
export const YOUNG_APPEARANCES = APPEARANCES.filter((t) => t[0] !== 3 && t[4] < 4 && t[2] === 0);

// 見た目を固定するキャラ。個体差は e.id から選んでいるが、id は出現順で変わるので、
// 同じ人物でも遊ぶたびに（続編では章ごとにも）髪型・髪色・眼鏡が入れ替わってしまう。
// 看板キャラと、章をまたいで繰り返し出る人物はここで固定する。
// skin / hairColor を null にすると、個体差で上書きせず CHAR_PALETTES の指定が残る。
// 続編の人物は game2-3d/src/chars2.js が registerFixedAppearance で足す。
export const FIXED_APPEARANCE = {
  // 魔王Y下: 七三・黒縁眼鏡・髭なし。黒髪と日焼けはパレット側の指定をそのまま使う。
  maou: { hair: 2, glasses: 1, beard: 0, skin: null, hairColor: null, build: 2 },
};
export function registerFixedAppearance(map) { Object.assign(FIXED_APPEARANCE, map); }

// 1体ぶんの個体差を決める。isPlayer は「この面の自機か」（描画側が知っている）。
export function pickVariant(e, isPlayer) {
  const fixed = FIXED_APPEARANCE[e.spriteKey];
  if (fixed) return fixed;
  const t = isPlayer ? PLAYER_APPEARANCE
    : e.isBoss ? BOSS_APPEARANCES[e.id % BOSS_APPEARANCES.length]
    : lookOf(e.spriteKey).age === 'young' ? YOUNG_APPEARANCES[e.id % YOUNG_APPEARANCES.length]
    : APPEARANCES[e.id % APPEARANCES.length];
  return { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
}

// 3Dのモデルをどの種別のパレットで作るか。基本は e.spriteKey そのもの。
// 続編の第1章（研修）のように、同じ人物が場面によって着替える場合だけ、登録した関数が
// 別のキーを返す（顔＝個体差は e.spriteKey のまま。着ている物だけが変わる）。
const lookHooks = [];
export function registerLookHook(fn) { if (!lookHooks.includes(fn)) lookHooks.push(fn); }
export function modelKeyOf(e, stage) {
  for (const fn of lookHooks) { const k = fn(e, stage); if (k) return k; }
  return e.spriteKey;
}

// ===== 体の向き =====
// Y軸回転 θ で正面(+Z＝カメラ側)は x=sin(θ) へ向く。進行方向へ浅く(0.55rad)回して
// 顔はカメラ側に残すのが基本（真横まで回すと薄い板に見える）。
// away のときは進行方向へは同じだけ向けたまま、背中をカメラへ向ける（π − θ）。
export const FACE_TURN = 0.55;
export function faceYaw(dir, away = false) { return away ? Math.PI - dir * FACE_TURN : dir * FACE_TURN; }

// その1体の向き。look はパレットの形の指定（lookOf）、playerX は自機の位置。
//   faceAway: true      … いつも背中を向ける（続編の PM。顔を見せない）
//   faceAway: 'locked'  … ロジック側の faceLock がある間（＝まだ振り向いていない間）は、
//                         自機から顔を背けて背中を見せる。faceLock が外れたら通常に戻る
// 本編の種別は faceAway を持たないので dir * 0.55（従来と同じ値）。
export function bodyYaw(e, look, playerX) {
  const dir = e.facing >= 0 ? 1 : -1;
  if (look.faceAway === true) return faceYaw(dir, true);
  if (look.faceAway === 'locked' && e.faceLock != null) {
    // faceLock の符号はロジック側の都合で、自機の側を向いていることがある（続編の M菱・LM社の
    // プロマネは faceLock=-1 で右端に出るので、左から来る自機を向く）。見せ方は位置から決める。
    const away = Math.sign(e.x - playerX) || -dir;
    return faceYaw(away, true);
  }
  return faceYaw(dir, false);
}

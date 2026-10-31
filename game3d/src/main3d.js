// 小向クエスト — ボクセル3Dレンダラ（プロトタイプ）
//
// ゲームロジックは一切変更していない。既存の Stage をそのまま動かし、
// 描画だけ three.js に差し替えている（x=横 / y=奥行き / z=高さ の3軸がもともとあるため）。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PLAY, setPlay, playMid } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Char } from '../../game/src/entities.js';
import { Stage } from '../../game/src/main.js';
import { STAGES, defFor } from '../../game/src/stages.js';

import { buildChar3DForType, C3 } from '../../game/src/voxel.js';
import { TYPE_LABEL, TYPE_COLOR } from '../../game/src/sprites.js';
import { Audio } from '../../game/src/audio.js';

// 歩ける奥行きを2Dの2倍に広げる。2Dは帯76px(=25ワールドユニット≒キャラ2人分)で、
// 記号としては成立するが3Dの透視では窮屈に見えるため。216を中心に±75へ。
// あわせて奥行き許容も比例配分で広げる（18/76 ≒ 30/150）。
setPlay({ top: 141, bottom: 291, depthTol: 30 });

const S = 1 / 3;                               // ゲーム座標 → ワールド座標
const FLOOR_MID = playMid();
const wx = (gx) => gx * S;
const wz = (gy) => (gy - FLOOR_MID) * S;
const wy = (gz) => gz * S;

// ===== シーン =====
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c3d') });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const Q = new URLSearchParams(location.search);
renderer.shadowMap.enabled = Q.get('noshadow') !== '1';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 3000);

// ===== ジオメトリのキャッシュ（パレットキーごとに1つ。全キャラで共有）=====
const geoCache = new Map();
function geoFor(key) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = buildChar3DForType(key);   // 3D専用の高解像度モデル（40x60x24・輪郭線なし）
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(v.colors, 3));
  g.setIndex(new THREE.BufferAttribute(v.indices, 1));
  geoCache.set(key, g);
  return g;
}
const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const charMatHit = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x883311 });

// ===== ライト =====
// 室内/屋外で setLighting() が色と強さを切り替える（宣言はここ、値はシーン適用時）
const hemi = new THREE.HemisphereLight(0xeef5fa, 0x8a9198, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfdfeff, 0.95);
sun.position.set(-30, 70, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 420;
scene.add(sun);
scene.add(sun.target);
// フィルライト: 太陽が上方からなので、カメラを向いた面(法線+Z)に光が当たらず
// 作業着の色が沈む。正面から弱く当てて色が読めるようにする（影は落とさない）。
const fill = new THREE.DirectionalLight(0xeaf2fa, 0.75);
scene.add(fill);
scene.add(fill.target);

// ===== ステージの箱組み =====
// three は THREE.Color / material.color を自動で sRGB→作業色空間に変換する。
// ここで自前変換すると二重変換になって極端に暗くなるので、文字列をそのまま渡す。
// （voxel.js の頂点カラーは自動変換の対象外なので、あちらは手で linear 化している）
function hex(c) { return new THREE.Color(c); }
// 背景は group にまとめる。ボス戦で場面を切り替えるときにまとめて捨てられるようにするため。
const scenery = new THREE.Group();
scene.add(scenery);

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: hex(color), emissive: opts.emissive ? hex(opts.emissive) : 0x000000 }),
  );
  m.position.set(x, y, z);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  scenery.add(m);
  return m;
}

function clearScenery() {
  for (const m of [...scenery.children]) {
    scenery.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }
}

// 室内（蛍光灯で全体に明るく影は薄い）/ 屋外（空の青＋強い日射）で照明を切り替える
function setLighting(outdoor) {
  hemi.color.set(outdoor ? 0xbcd9f2 : 0xeef5fa);
  hemi.groundColor.set(outdoor ? 0x7a7259 : 0x8a9198);
  hemi.intensity = outdoor ? 1.35 : 2.1;
  sun.color.set(outdoor ? 0xfff1d8 : 0xfdfeff);
  sun.intensity = outdoor ? 2.0 : 0.95;
  fill.intensity = outdoor ? 0.5 : 1.0;   // 顔が自分の髪の影で潰れないよう正面から補う
}

// 3D用の室内パレット。2D版の bg（暗い青灰）は2Dの記号としてそのまま残し、
// 3Dは実際の執務室の見た目（白い天井・明るいキャビネット・濃いグレーの床・
// 青いパーティション・緑のデスクマット）に寄せる。
const ROOM = {
  // 執務室（60号7階Cゾーン）: 白い天井と直管蛍光灯、明るいキャビネット、
  // 濃いグレーのタイルカーペット、青いパーティション、緑のデスクマット。
  office_win: {
    ceiling: '#f3f6f8', wall: '#e6eaed', cabinet: '#dde2e6', cabinetLine: '#b9c0c6',
    floor: '#474c52', partition: '#4a7ab0', mat: '#2f9e68', desk: '#eef1f4',
    chair: '#3a5fa8', sky: '#bcd6ea', frame: '#aeb6bd',
  },
  // 食堂: 光沢のある明るい木目の床、白い天井、白天板のテーブルにピンクのパイプ椅子、
  // ベージュの配膳カウンターとステンレス、白いブラインドの窓。※ステージ未使用（素材として用意）
  // 構内の稲荷社（ボス戦用の屋外アリーナ）: 朱の鳥居、瓦屋根の社、玉垣、木立、
  // 借景に工場の白い建屋。空が見えるので天井は作らない。
  shrine: {
    sky: '#9ec8e8', ground: '#b4a992', path: '#d6d2c6', torii: '#d9451f', toriiDark: '#241d18',
    shrineWood: '#7d5f41', roof: '#3b4648', tree: '#2f5a35', treeDark: '#23462a',
    bldg: '#e7eaec', bldgWin: '#8fa8bc', stone: '#9a978d',
  },
  // 構内道路: 頭上の配管ラック、灰色の柱、白い建屋。工場らしさが一番出る場所
  yard: {
    sky: '#9ec8e8', ground: '#5c5f63', path: '#6a6e73', pipe: '#b6bcc2', post: '#9aa0a6',
    bldg: '#e3e6e8', bldgWin: '#8fa8bc', line: '#e8e8e4', tree: '#2f5a35',
  },
  shokudo: {
    ceiling: '#f4f5f2', wall: '#ece7de', cabinet: '#e0c9b8', cabinetLine: '#c4a894',
    floor: '#c08a42', partition: '#e0c9b8', mat: '#f2f3f0', desk: '#f2f3f0',
    chair: '#d8b3ae', sky: '#dfe6ea', frame: '#c9ccc8', steel: '#b9bcc0',
  },
};

// ===== 場面（シーン）=====
// どの場面も「歩行帯(±halfD)の外に奥ゾーンと手前ゾーンを作る」構成で統一する。
// 帯の中に物を置くとキャラと重なって奥行きが読めなくなるため。

function zones(halfD, backDepth, frontDepth) {
  return { BACK: -(halfD + backDepth), FRONT: halfD + frontDepth };
}

// --- 執務室（60号7階Cゾーン）---
function buildOffice(W, halfD) {
  const R = ROOM.office_win;
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 320, 900);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.08, 0.4, '#6b7178', W / 2, 0.02, halfD);
  box(W + 80, 0.08, 0.4, '#6b7178', W / 2, 0.02, -halfD);

  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  box(W + 80, 2, FRONT - BACK, R.ceiling, W / 2, 47, (FRONT + BACK) / 2);

  // 天井まわり: 直管蛍光灯の列 ＋ 空調の吹き出し口 ＋ 配線ダクト
  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 14; dz < FRONT - 10; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#cfe0ee', receive: false });
    }
  }
  for (let x = 24; x < W; x += 88) {
    for (const dz of [BACK + 28, BACK + 62]) box(9, 0.8, 9, '#c9ced3', x, 45.4, dz);  // 吹き出し口
  }
  box(W + 80, 1.2, 2.2, '#d9dee2', W / 2, 44.2, BACK + 8);                            // 配線ダクト

  // 吊り下げのゾーン表示（実物にある「D15」「D16」の札）
  for (let i = 0, x = 40; x < W; x += 150, i++) {
    box(0.3, 6, 0.3, '#aeb6bd', x, 41.5, BACK + 26);
    box(13, 5, 0.6, '#f4f6f8', x, 36, BACK + 26, { receive: false });
    box(9, 0.9, 0.8, '#3a5fa8', x, 36, BACK + 25.6, { receive: false });
  }

  // 壁面: 上部の連窓、ホワイトボード、掲示板、時計
  for (let x = 18; x < W; x += 62) {
    box(34, 15, 0.5, R.sky, x, 27, BACK + 0.5, { emissive: '#93b4ce' });
    box(36, 1, 1, R.frame, x, 35, BACK + 1.0);
    box(36, 1, 1, R.frame, x, 19, BACK + 1.0);
  }
  for (let x = 48; x < W; x += 124) {
    box(30, 11, 0.6, '#fbfcfd', x, 20, BACK + 0.6, { receive: false });                // ホワイトボード
    box(31, 1.0, 0.9, '#b9c0c6', x, 14.2, BACK + 0.9);
  }
  for (let x = 96; x < W; x += 124) {
    box(18, 9, 0.6, '#dfe3e6', x, 20, BACK + 0.6);                                     // 掲示板
    for (let i = 0; i < 3; i++) box(4.4, 3, 0.4, ['#f2f3f0', '#eaf2d8', '#f6e3d8'][i], x - 5 + i * 5, 20, BACK + 1.0, { receive: false });
  }
  for (let x = 150; x < W; x += 300) {
    box(5.5, 5.5, 0.7, '#f4f6f8', x, 31, BACK + 0.5);                                  // 時計
    box(3.6, 3.6, 0.3, '#2a3038', x, 31, BACK + 1.1, { receive: false });
  }

  // 壁ぎわのキャビネット列
  for (let x = -14; x < W + 24; x += 24) {
    box(22, 13, 5, R.cabinet, x, 6.5, BACK + 3.5, { cast: true });
    for (let i = 0; i < 3; i++) box(20, 0.35, 0.4, R.cabinetLine, x, 2.4 + i * 4.2, BACK + 6.1, { receive: false });
  }

  // 島デスク（奥）: 白天板 + 緑マット + 青パーティション + アクリル板
  const deskZ = -halfD - 9;
  for (let x = 6; x < W; x += 30) {
    box(24, 1.1, 12, R.desk, x, 8.4, deskZ, { cast: true });
    box(20, 0.25, 8, R.mat, x, 9.05, deskZ, { receive: false });
    box(24, 7, 0.9, R.partition, x, 12.5, deskZ - 6.6, { cast: true });
    box(24, 6, 0.3, '#dfeaf2', x, 19, deskZ - 6.6, { receive: false });               // アクリル板
    box(0.5, 6, 0.5, '#aeb6bd', x - 11.6, 19, deskZ - 6.6);
    box(0.5, 6, 0.5, '#aeb6bd', x + 11.6, 19, deskZ - 6.6);
    box(5, 4.2, 0.7, '#20262c', x + 6, 11.6, deskZ - 3, { emissive: '#14303f', cast: true });
    box(4.4, 5.5, 4.4, R.chair, x - 6, 2.7, deskZ + 9, { cast: true });
  }

  // 手前の島デスク（前景。足元ラインより低く）
  for (let x = -6; x < W + 24; x += 30) {
    box(26, 1.1, 12, R.desk, x, 3.4, halfD + 24, { cast: true });
    box(21, 0.25, 8, R.mat, x, 4.05, halfD + 24, { receive: false });
    box(26, 2.2, 0.8, R.partition, x, 5.6, halfD + 17.8);
  }
}

// --- 構内の稲荷社（ボス戦の屋外アリーナ）---
function buildShrine(W, halfD) {
  const R = ROOM.shrine;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(true);
  scene.background = hex(R.sky);
  scene.fog = new THREE.Fog(hex(R.sky), 340, 980);

  box(W + 80, 2, FRONT - BACK, R.ground, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.3, halfD * 2, R.path, W / 2, 0.1, 0, { receive: true });

  // 鳥居は正面から見える向きに。参道が奥へ伸びる配置にして背景として見せる。
  const sx0 = W * 0.72;
  const torii = (cz, scale) => {
    const half = 9 * scale, hP = 26 * scale;
    for (const px of [sx0 - half, sx0 + half]) {
      box(3.2 * scale, hP, 3.2 * scale, R.torii, px, hP / 2, cz, { cast: true });
      box(4.6 * scale, 1.2, 4.6 * scale, R.toriiDark, px, 0.6, cz);
    }
    box(half * 2 + 10 * scale, 2.0 * scale, 3.6 * scale, R.toriiDark, sx0, hP + 1.4, cz, { cast: true });
    box(half * 2 + 6 * scale, 1.4 * scale, 3.0 * scale, R.torii, sx0, hP - 0.4, cz, { cast: true });
    box(half * 2 - 2 * scale, 1.2 * scale, 2.4 * scale, R.torii, sx0, hP * 0.78, cz, { cast: true });
    box(2.4 * scale, 3.2 * scale, 1.0, '#d8cfa8', sx0, hP * 0.93, cz + 1.8);
  };
  torii(-halfD - 8, 1.0);
  torii(BACK + 34, 0.82);
  box(16, 0.3, (-halfD - 8) - (BACK + 10), R.path, sx0, 0.12, ((-halfD - 8) + (BACK + 10)) / 2);

  for (const sz of [-halfD - 6, halfD + 6]) {
    for (let x = -10; x < W + 20; x += 7) {
      box(1.1, 6, 1.1, R.torii, x, 3, sz);
      box(7, 0.8, 1.0, R.torii, x, 6.2, sz);
    }
  }

  box(26, 16, 18, R.shrineWood, sx0, 8, BACK + 16, { cast: true });
  box(34, 2.4, 26, R.roof, sx0, 17.4, BACK + 16, { cast: true });
  box(28, 2.0, 20, R.roof, sx0, 19.6, BACK + 16, { cast: true });
  for (let i = 0; i < 3; i++) box(18 - i * 2, 1.2, 3, R.stone, sx0, 0.6 + i * 1.2, BACK + 26 - i * 1.5);

  for (let x = -20; x < W + 40; x += 17) {
    const h = 26 + ((x * 7) % 18);
    box(3, h * 0.45, 3, '#4a3a2a', x, h * 0.22, BACK + 2, { cast: true });
    box(14, h * 0.6, 14, (x % 34 === 0) ? R.treeDark : R.tree, x, h * 0.72, BACK + 2, { cast: true });
  }
  for (let x = -40; x < W + 60; x += 120) {
    box(110, 54, 10, R.bldg, x, 27, BACK - 26);
    for (let f = 0; f < 5; f++) box(100, 3.4, 1.0, R.bldgWin, x, 10 + f * 9, BACK - 31);
  }
}

// --- 食堂 ---
function buildShokudo(W, halfD) {
  const R = ROOM.shokudo;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 340, 980);

  // 光沢のある明るい木目の床。板目を細い線で表す
  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  for (let z = BACK + 4; z < FRONT; z += 7) {
    box(W + 80, 0.06, 0.35, '#a87533', W / 2, 0.03, z, { receive: false });
  }

  box(W + 80, 60, 2, R.wall, W / 2, 30, BACK - 1);
  box(W + 80, 2, FRONT - BACK, R.ceiling, W / 2, 45, (FRONT + BACK) / 2);
  for (let x = 6; x < W; x += 42) {
    for (let dz = BACK + 14; dz < FRONT - 10; dz += 28) {
      box(30, 0.5, 2.0, '#ffffff', x, 43.6, dz, { emissive: '#dfe6ea', receive: false });
    }
  }

  // 配膳カウンター（奥）: ベージュの腰壁 ＋ ステンレス天板 ＋ ガラスケース
  const cz = -halfD - 11;
  box(W + 40, 11, 12, R.cabinet, W / 2, 5.5, cz, { cast: true });
  box(W + 40, 0.8, 13, R.steel, W / 2, 11.4, cz, { receive: false });
  box(W + 40, 7, 0.4, '#dfe9ee', W / 2, 15.4, cz - 5.6, { receive: false });   // ガラス
  for (let x = -10; x < W + 20; x += 9) box(0.5, 7, 0.5, R.steel, x, 15.4, cz - 5.6);

  // メニューの色札（実物は赤・青・緑・オレンジが並ぶ）
  const tag = ['#d8483c', '#3f7fc0', '#49a35c', '#e08a2e', '#d8483c'];
  for (let i = 0, x = 24; x < W; x += 34, i++) {
    box(0.3, 9, 0.3, '#c9ccc8', x, 31, cz - 7);
    box(11, 6, 0.5, tag[i % tag.length], x, 25, cz - 7, { receive: false });
  }

  // 壁の白いブラインド窓
  for (let x = 20; x < W; x += 58) {
    box(32, 14, 0.5, R.sky, x, 26, BACK + 0.5, { emissive: '#aebcc4' });
    for (let i = 0; i < 6; i++) box(32, 0.5, 0.8, '#f3f4f2', x, 20.5 + i * 2.2, BACK + 1.1, { receive: false });
  }

  // 白天板のテーブル＋ピンクのパイプ椅子（奥列と手前列）
  const table = (x, z) => {
    box(22, 0.9, 11, R.desk, x, 7.6, z, { cast: true });
    for (const [dx, dz] of [[-7, -4.6], [7, -4.6], [-7, 4.6], [7, 4.6]]) {
      box(0.7, 7.2, 0.7, R.steel, x + dx, 3.6, z + dz);
    }
    for (const dz of [-7.6, 7.6]) {
      for (const dx of [-5.5, 5.5]) {
        box(4.6, 0.7, 4.6, R.chair, x + dx, 4.4, z + dz, { cast: true });
        box(4.6, 5.2, 0.7, R.chair, x + dx, 7, z + dz + (dz > 0 ? 2.1 : -2.1), { cast: true });
      }
    }
  };
  for (let x = 10; x < W; x += 34) { table(x, -halfD - 26); table(x, halfD + 26); }
}

// --- 構内道路 ---
function buildYard(W, halfD) {
  const R = ROOM.yard;
  const { BACK, FRONT } = zones(halfD, 34, 60);
  setLighting(true);
  scene.background = hex(R.sky);
  scene.fog = new THREE.Fog(hex(R.sky), 320, 950);

  box(W + 80, 2, FRONT - BACK, R.ground, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.3, halfD * 2 + 6, R.path, W / 2, 0.1, 0);
  for (let x = -10; x < W + 20; x += 14) box(8, 0.1, 0.8, R.line, x, 0.3, 0);   // 車線

  // 両側の白い建屋（水平連窓）
  for (const sz of [BACK - 8, FRONT + 6]) {
    const far = sz < 0;
    for (let x = -30; x < W + 50; x += 90) {
      box(84, far ? 52 : 26, 16, R.bldg, x, far ? 26 : 13, sz, { cast: true });
      for (let f = 0; f < (far ? 5 : 2); f++) {
        box(76, 3.2, 1.0, R.bldgWin, x, 9 + f * 9, sz + (far ? 8.5 : -8.5), { receive: false });
      }
    }
  }

  // 頭上の配管ラック。工場らしさが一番出る要素
  for (let x = -10; x < W + 20; x += 26) {
    box(2.6, 34, 2.6, R.post, x, 17, -halfD - 5, { cast: true });               // 柱
    box(2.6, 34, 2.6, R.post, x, 17, halfD + 5, { cast: true });
    box(2.2, 2.2, halfD * 2 + 12, R.post, x, 34.5, 0, { cast: true });          // 梁
    box(1.6, 1.6, halfD * 2 + 8, '#8e949a', x, 37, 0);                          // 上段の梁
  }
  for (const pz of [-halfD - 2, -halfD + 3, halfD - 3, halfD + 2]) {
    box(W + 80, 1.8, 1.8, R.pipe, W / 2, 32.6, pz, { cast: true });             // 長手に走る配管
  }
  box(W + 80, 1.0, 1.0, '#c7ccd1', W / 2, 36.4, 0);

  // 標識・電柱・植栽
  for (let x = 30; x < W; x += 120) {
    box(0.7, 16, 0.7, '#b9bcc0', x, 8, halfD + 11);
    box(6, 6, 0.4, '#d8483c', x, 15, halfD + 11, { receive: false });           // 進入禁止
    box(4.4, 1.2, 0.5, '#f2f3f4', x, 15, halfD + 10.7, { receive: false });
  }
  for (let x = 80; x < W; x += 120) {
    box(0.7, 15, 0.7, '#b9bcc0', x, 7.5, -halfD - 11);
    box(6, 4, 0.4, '#3f7fc0', x, 14, -halfD - 11, { receive: false });          // 一方通行
  }
  for (let x = 14; x < W; x += 46) {
    box(2.2, 13, 2.2, '#8a7a62', x, 6.5, halfD + 16, { cast: true });           // 電柱
    box(7, 5, 7, R.tree, x + 20, 3, -halfD - 9, { cast: true });                // 刈り込みの植栽
  }
}

const SCENES = { office_win: buildOffice, shrine: buildShrine, shokudo: buildShokudo, yard: buildYard };

function applyScene(key, data) {
  clearScenery();
  const W = data.width * S;
  const halfD = (PLAY.bottom - PLAY.top) * S / 2 + 3;
  (SCENES[key] || buildOffice)(W, halfD);
}

function buildScenery(data) {
  const forced = new URLSearchParams(location.search).get('scene');
  applyScene(forced || data.bg.scene, data);
}

// ===== ゲーム本体（ロジックは2D版そのまま）=====
const game = {
  difficulty: 'normal', score: 0, lives: 4, over: false,
  state: 'title', stageIndex: 0, screenT: 0,
  toGameOver() { this.state = 'gameover'; this.screenT = 0; },
};
let stage = new Stage(STAGES[0], game);
buildScenery(STAGES[0]);

// 打撃フック: ヒットストップ＋カメラシェイク（案D）
let hitstop = 0, shake = 0, bossSceneApplied = false;
const origHit = stage.fx.hit.bind(stage.fx);
stage.fx.hit = (x, y, color) => { origHit(x, y, color); hitstop = 0.06; shake = 1.1; burst(x, y, color); };
// ダメージ数字は2D用のテキストではなく、投影したDOMで出す
const origText = stage.fx.text.bind(stage.fx);
stage.fx.text = (x, y, str, color) => { origText(x, y, str, color); addFloat(x, y, 0, str, color); };

// ===== ステージの読み込み =====
function clearStageObjects() {
  for (const [, m] of meshes) scene.remove(m);
  meshes.clear();
  for (const [, m] of projMeshes) scene.remove(m);
  projMeshes.clear();
  for (const p of parts) { p.m.visible = false; partPool.push(p.m); }
  parts.length = 0;
  for (const [, r] of tagEls) { r.tag.remove(); r.bubble.remove(); }
  tagEls.clear();
  for (const f of floats) f.el.remove();
  floats.length = 0;
}

function loadStage(i) {
  clearStageObjects();
  bossSceneApplied = false;
  stage = new Stage(STAGES[i], game);
  const origHit2 = stage.fx.hit.bind(stage.fx);
  stage.fx.hit = (x, y, color) => { origHit2(x, y, color); hitstop = 0.06; shake = 1.1; burst(x, y, color); };
  const origText2 = stage.fx.text.bind(stage.fx);
  stage.fx.text = (x, y, str, color) => { origText2(x, y, str, color); addFloat(x, y, 0, str, color); };
  buildScenery(STAGES[i]);
  camPos.set(wx(stage.player.x), CAM.height, wz(stage.player.y) + CAM.dist);
  camLook.set(wx(stage.player.x), CAM.lookY, wz(stage.player.y) - 3);
}

// ===== エンティティ ↔ メッシュ =====
const meshes = new Map();
function syncEntities() {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive) continue;
    seen.add(e.id);
    let m = meshes.get(e.id);
    if (!m) {
      m = new THREE.Mesh(geoFor(e.spriteKey), charMat);
      m.castShadow = true; m.receiveShadow = false;
      scene.add(m);
      meshes.set(e.id, m);
    }
    // C3.SCALE で 2D版と同じ見た目サイズに戻す（グリッドが細かいぶん1ボクセルが小さい）
    const sc = ((e.scale || 3) / 3) * C3.SCALE;
    m.scale.setScalar(sc);
    m.position.set(wx(e.x), wy(e.z), wz(e.y));
    // 真横を向くと薄い板に見えるので、向きは浅い角度だけ付ける（顔はカメラ側に残す）
    m.rotation.y = (e.facing >= 0 ? -1 : 1) * 0.42;
    m.visible = !(e.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0);
    m.material = e.hitstun > 0 ? charMatHit : charMat;
  }
  for (const [id, m] of meshes) {
    if (seen.has(id)) continue;
    scene.remove(m); meshes.delete(id);
  }
}

// ===== 飛び道具とヒットの粒子 =====
// 2D版の Fx（粒子）と Projectile を3Dの小さな箱で表現する。使い回しのプール。
const projGeo = new THREE.BoxGeometry(1.6, 1.2, 2.6);
const projMat = {
  paper:   new THREE.MeshLambertMaterial({ color: new THREE.Color('#f2f4f6') }),
  missile: new THREE.MeshLambertMaterial({ color: new THREE.Color('#5a6a2e'), emissive: new THREE.Color('#2a1a08') }),
};
const projMeshes = new Map();
function syncProjectiles() {
  const seen = new Set();
  for (const pr of stage.projectiles) {
    if (!pr.alive) continue;
    seen.add(pr.id);
    let m = projMeshes.get(pr.id);
    if (!m) {
      m = new THREE.Mesh(projGeo, projMat[pr.kind] || projMat.paper);
      m.castShadow = true;
      scene.add(m); projMeshes.set(pr.id, m);
    }
    m.position.set(wx(pr.x), wy(pr.z || 0) + 9, wz(pr.y));
    m.rotation.z += 0.35;                       // くるくる回る書類
    if (pr.kind === 'missile') { m.rotation.z = 0; m.rotation.y = pr.vx > 0 ? 0 : Math.PI; }
  }
  for (const [id, m] of projMeshes) {
    if (seen.has(id)) continue;
    scene.remove(m); projMeshes.delete(id);
  }
}

// 打撃の粒子
const partGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const partPool = [];
const parts = [];
function burst(gx, gy, color) {
  const col = new THREE.Color(color || '#ffd24a');
  for (let i = 0; i < 9; i++) {
    let m = partPool.pop();
    if (!m) { m = new THREE.Mesh(partGeo, new THREE.MeshLambertMaterial({ color: col })); scene.add(m); }
    else { m.material.color.copy(col); m.visible = true; }
    const a = (i / 9) * Math.PI * 2;
    parts.push({
      m, t: 0,
      x: wx(gx), y: wy(0) + 10, z: wz(gy),
      vx: Math.cos(a) * 16, vy: 10 + (i % 3) * 6, vz: Math.sin(a) * 10,
    });
    m.position.set(wx(gx), wy(0) + 10, wz(gy));
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t > 0.42) { p.m.visible = false; partPool.push(p.m); parts.splice(i, 1); continue; }
    p.vy -= 58 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.m.position.set(p.x, Math.max(0.4, p.y), p.z);
    const k = 1 - p.t / 0.42;
    p.m.scale.setScalar(0.5 + k);
  }
}

// ===== 画面に重ねる文字（吹き出し / 役職ラベル / ダメージ数字）=====
//
// 3Dの中に文字を置くとボケるので、キャラの位置をスクリーン座標に投影して
// DOM要素を頭上に置く。2D版の吹き出し・頭上ラベル・ダメージ数字をそのまま再現する。
const layer = document.getElementById('labels');
const projV = new THREE.Vector3();

function project(wxp, wyp, wzp) {
  projV.set(wxp, wyp, wzp).project(camera);
  if (projV.z > 1) return null;                       // カメラの後ろ
  const box = document.getElementById('stage');
  return {
    x: (projV.x * 0.5 + 0.5) * box.clientWidth,
    y: (-projV.y * 0.5 + 0.5) * box.clientHeight,
  };
}

const tagEls = new Map();   // entity.id → {tag, bubble}
function elFor(id) {
  let r = tagEls.get(id);
  if (!r) {
    const tag = document.createElement('div'); tag.className = 'tag';
    const bubble = document.createElement('div'); bubble.className = 'bubble';
    layer.appendChild(tag); layer.appendChild(bubble);
    r = { tag, bubble }; tagEls.set(id, r);
  }
  return r;
}

function syncLabels() {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive) continue;
    seen.add(e.id);
    const { tag, bubble } = elFor(e.id);
    const headY = wy(e.z) + 19 * ((e.scale || 3) / 3);     // 頭のすぐ上
    const p = project(wx(e.x), headY, wz(e.y));
    if (!p) { tag.style.display = bubble.style.display = 'none'; continue; }

    // 頭上の役職ラベル（ボスとプレイヤーは出さない。2D版と同じ）
    const label = e === stage.player ? null
      : e.betrayed ? '裏切り者'
      : (e.isBoss ? null : TYPE_LABEL[e.spriteKey]);
    if (label) {
      tag.textContent = label;
      tag.style.color = e.betrayed ? '#ff5a5a' : (TYPE_COLOR[e.spriteKey] || '#cfd6de');
      tag.style.display = 'block';
      tag.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
    } else if (e === stage.player) {
      tag.textContent = '▼';
      tag.style.color = '#ff7f0e';
      tag.style.display = 'block';
      tag.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
    } else tag.style.display = 'none';

    // セリフの吹き出し
    if (e.taunt && e.tauntT > 0) {
      bubble.textContent = e.taunt;
      bubble.classList.toggle('ally', e.team === 'ally');
      bubble.style.display = 'block';
      bubble.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y - 20}px)`;
    } else bubble.style.display = 'none';
  }
  for (const [id, r] of tagEls) {
    if (seen.has(id)) continue;
    r.tag.remove(); r.bubble.remove(); tagEls.delete(id);
  }
}

// ダメージ数字など、浮かんで消える文字
const floats = [];
function addFloat(gx, gy, gz, text, color) {
  const el = document.createElement('div');
  el.className = 'float'; el.textContent = text; el.style.color = color || '#ffe39a';
  layer.appendChild(el);
  floats.push({ el, gx, gy, gz, t: 0 });
}
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    if (f.t > 0.8) { f.el.remove(); floats.splice(i, 1); continue; }
    const p = project(wx(f.gx), wy(0) + 13 + f.t * 14, wz(f.gy));
    if (!p) { f.el.style.display = 'none'; continue; }
    f.el.style.display = 'block';
    f.el.style.opacity = String(1 - f.t / 0.8);
    f.el.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
  }
}

// ===== カメラ =====
// dist は「2D版と同じ範囲を映す」値。2Dは論理480x270=横160/縦90ワールドユニットを映すので、
// 水平fov 44.6° で横160になる実距離194.9 → 高さ差31を引いて dist_z=192。
// height を上げると俯角が付いて奥行きが読めるようになる。
// dist は「横160ワールドユニット＝2D版と同じ範囲」を保つ値（実距離194.9から高さ差を引く）。
const CAM = { dist: 188, height: 62, lookY: 13 };
const camPos = new THREE.Vector3(wx(stageStartX()), CAM.height, CAM.dist);
const camLook = new THREE.Vector3(wx(stageStartX()), CAM.lookY, -3);
function stageStartX() { return 60; }
function updateCamera(dt) {
  const p = stage.player;
  const bossOn = stage.bossStarted && stage.boss && stage.boss.alive;
  const dist = bossOn ? CAM.dist * 0.82 : CAM.dist;   // ボス戦は寄る（案D）
  const height = bossOn ? CAM.height * 0.86 : CAM.height;
  const tx = wx(p.x) + (bossOn ? 6 : 0);
  const a = Math.min(1, Math.max(0, 1 - Math.pow(0.0015, Math.max(0, dt))));
  camPos.lerp(new THREE.Vector3(tx, height, wz(p.y) + dist), a);
  camLook.lerp(new THREE.Vector3(tx, CAM.lookY, wz(p.y) - 3), a);
  const sh = shake * 1.8;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook);
  sun.target.position.set(camLook.x, 0, camLook.z);
  sun.position.set(camLook.x - 60, 120, camLook.z + 80);
  fill.target.position.set(camLook.x, 8, camLook.z);
  fill.position.set(camLook.x + 20, 34, camLook.z + 120);
}

// ===== HUD（案A: 高解像度レイヤー / 案B: 社内システムの語彙）=====
const hud = {
  rank: document.getElementById('rank'),
  hpFill: document.getElementById('hpFill'),
  hpNum: document.getElementById('hpNum'),
  lives: document.getElementById('lives'),
  score: document.getElementById('score'),
  bossWrap: document.getElementById('bossWrap'),
  bossName: document.getElementById('bossName'),
  bossFill: document.getElementById('bossFill'),
  banner: document.getElementById('banner'),
  loc: document.getElementById('loc'),
};
let hpShown = 1, bossShown = 1, scoreShown = 0;
function updateHUD(dt) {
  const p = stage.player;
  hpShown += ((p.hp / p.maxhp) - hpShown) * Math.min(1, dt * 7);   // バーを補間（案D）
  scoreShown += (game.score - scoreShown) * Math.min(1, dt * 6);
  hud.rank.textContent = stage.data.playerRank;
  hud.hpFill.style.width = (hpShown * 100).toFixed(1) + '%';
  hud.hpFill.style.background = hpShown < 0.3 ? '#c73333' : hpShown < 0.6 ? '#e0a030' : '#389451';
  hud.hpNum.textContent = Math.max(0, Math.round(p.hp)) + ' / ' + p.maxhp;
  hud.lives.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < game.lives ? 'on' : ''}"></i>`).join('');
  hud.score.textContent = String(Math.round(scoreShown)).padStart(6, '0');

  const b = stage.boss;
  if (b && b.alive) {
    bossShown += ((b.hp / b.maxhp) - bossShown) * Math.min(1, dt * 7);
    hud.bossWrap.classList.add('show');
    hud.bossName.textContent = b.typeName;
    hud.bossFill.style.width = (bossShown * 100).toFixed(1) + '%';
  } else {
    hud.bossWrap.classList.remove('show');
    bossShown = 1;
  }
  hud.loc.textContent = stage.data.location || '';
  if (stage.bannerT > 0 && stage.banner) {
    hud.banner.textContent = stage.banner;
    hud.banner.classList.add('show');
  } else hud.banner.classList.remove('show');
}

// ===== 画面（案B: 社内システムの語彙で統一）=====
const screenEl = document.getElementById('screen');
function showScreen(html) { screenEl.innerHTML = html; screenEl.style.display = 'flex'; }
function hideScreen() { screenEl.style.display = 'none'; }

const hint = (t) => `<p class="k">${t}</p>`;
function renderScreen() {
  const ch = STAGES[game.stageIndex];
  switch (game.state) {
    case 'title':
      showScreen(`<div class="sheet title">
        <div class="eyebrow">小向工場 業務支援システム　Ver 2.4</div>
        <h1>KOMUKAI QUEST</h1>
        <div class="jp">小 向 ク エ ス ト</div>
        <p class="lead">小向戦士となり、小向工場を生き残れ。</p>
        <div class="diff">難易度　<b id="dname">ふつう</b>　<span class="k">1 / 2 / 3 キーで変更</span></div>
        ${hint('Enter または画面タップで開始')}
      </div>`);
      break;
    case 'intro':
      showScreen(`<div class="sheet">
        <div class="eyebrow">作 業 指 示 書</div>
        <table class="form">
          <tr><th>件名</th><td>${ch.name}</td></tr>
          <tr><th>作業場所</th><td>${ch.location || ''}</td></tr>
          <tr><th>等級</th><td>${ch.playerRank}</td></tr>
          <tr><th>指示事項</th><td>${(ch.intro || '').replace(/\n/g, '<br>')}</td></tr>
        </table>
        ${hint('Enter で作業開始')}
      </div>`);
      break;
    case 'clear':
      showScreen(`<div class="sheet">
        <div class="eyebrow">作 業 報 告 書</div>
        <h2 class="ok">提出完了</h2>
        <table class="form">
          <tr><th>件名</th><td>${ch.name}</td></tr>
          <tr><th>結果</th><td>所定の作業を完了した</td></tr>
          <tr><th>評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter で次の作業へ')}
      </div>`);
      break;
    case 'gameover':
      showScreen(`<div class="sheet">
        <div class="eyebrow">休 職 願</div>
        <h2 class="ng">稼働率 0%</h2>
        <table class="form">
          <tr><th>事由</th><td>組織に敗れたため</td></tr>
          <tr><th>評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter でタイトルへ')}
      </div>`);
      break;
    case 'ending':
      showScreen(`<div class="sheet">
        <div class="eyebrow">辞 令</div>
        <h2>小 向 司 令 官</h2>
        <p class="lead">数々の困難と理不尽、そして裏切りを越え、小向の頂点に立った。</p>
        <table class="form">
          <tr><th>最終評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter でタイトルへ')}
      </div>`);
      break;
    default: hideScreen();
  }
}

// ===== ループ =====
function resize() {
  const box = document.getElementById('stage');
  const w = Math.max(16, box.clientWidth), h = Math.max(9, box.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = 16 / 9;   // 枠自体が16:9なので固定（2D版と画角を揃えるため）
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

Input.init();
Input.initTouch(document.getElementById('c3d'));
addEventListener('keydown', () => Audio.resume(), { once: true });
addEventListener('pointerdown', () => Audio.resume(), { once: true });

const STEP = 1 / 60;
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let frame = (now - last) / 1000; last = now;
  if (!(frame > 0)) frame = 0;        // 負 / NaN を潰す（補間の発散を防ぐ）
  if (frame > 0.25) frame = 0.25;     // スパイラル防止
  acc += frame;
  try {
  while (acc >= STEP) {
    game.screenT += STEP;
    switch (game.state) {
      case 'title':
        if (Input.pressed('Digit1')) game.difficulty = 'easy';
        if (Input.pressed('Digit2')) game.difficulty = 'normal';
        if (Input.pressed('Digit3')) game.difficulty = 'hell';
        if (Input.confirm) {
          Audio.resume();
          game.score = 0;
          game.lives = game.difficulty === 'easy' ? 12 : game.difficulty === 'hell' ? 2 : 4;
          game.stageIndex = 0; loadStage(0);
          game.state = 'intro'; game.screenT = 0; renderScreen();
        } else if (Input.pressed('Digit1', 'Digit2', 'Digit3')) renderScreen();
        break;
      case 'intro':
        if (game.screenT > 0.4 && Input.confirm) { game.state = 'playing'; hideScreen(); }
        break;
      case 'playing':
        if (hitstop > 0) hitstop -= STEP;        // 打撃の手応え（案D）
        else stage.update(STEP);
        if (stage.cleared) {
          game.state = game.stageIndex >= STAGES.length - 1 ? 'ending' : 'clear';
          game.screenT = 0; renderScreen();
        }
        break;
      case 'clear':
        if (game.screenT > 0.5 && Input.confirm) {
          game.stageIndex++; loadStage(game.stageIndex);
          game.state = 'intro'; game.screenT = 0; renderScreen();
        }
        break;
      case 'gameover':
      case 'ending':
        if (game.screenT > 0.6 && Input.confirm) { game.state = 'title'; game.screenT = 0; renderScreen(); }
        break;
    }
    Input.endFrame();
    acc -= STEP;
  }
  // ボス戦で場面が変わるステージ（工場長＝構内の稲荷社）。
  // Stage は本編のものをそのまま使っているため startBoss は書き換えず、
  // ここで bossStarted の立ち上がりを拾って背景だけ差し替える。
  if (stage.bossStarted && !bossSceneApplied && stage.data.bossScene
      && !new URLSearchParams(location.search).get('scene')) {
    bossSceneApplied = true;
    applyScene(stage.data.bossScene, stage.data);
    stage.banner = stage.data.bossLocation || '';
    stage.bannerColor = 'rgba(150,40,20,0.92)';
    stage.bannerT = 3.0;
  }

  shake = Math.max(0, shake - frame * 4.5);
  syncEntities();
  updateCamera(frame);
  updateHUD(frame);
  renderer.render(scene, camera);
  syncProjectiles();
  updateParts(frame);
  syncLabels();
  updateFloats(frame);
  if (!window.__once && Q.get('dbg') === '1') { window.__once = 1; window.__dbg && window.__dbg(
    'OK frame1 / meshes=' + meshes.size + ' / children=' + scene.children.length +
    ' / cam=' + camera.position.toArray().map(n=>n.toFixed(1)).join(',') +
    ' / look=' + camLook.toArray().map(n=>n.toFixed(1)).join(',')); }
  } catch (e) { window.__dbg && window.__dbg('LOOP: ' + (e.stack || e.message)); throw e; }
}
renderScreen();
requestAnimationFrame(loop);

// ?cast=1 … 主要キャラを一列に並べて見るビュー（作業着・帽子など見た目の確認用）
if (new URLSearchParams(location.search).get('cast') === '1') {
  const { defFor2 } = await import('../../game2/src/stages2.js');
  const { registerPalettes, registerTypeMeta } = await import('../../game/src/sprites.js');
  const g2 = await import('../../game2/src/stages2.js');
  registerPalettes(g2.PALETTES2); registerTypeMeta(g2.LABELS2, g2.COLORS2);
  for (const e of [...stage.entities]) if (e !== stage.player) e.alive = false;
  stage.sweepDead();
  const cast = [
    ['1', 'ally'], ['1', 'buka'], ['1', 'senpai'], ['1', 'staff'], ['1', 'dr'],
    ['2', 'douki_sekkei'], ['2', 'douki_genba'], ['2', 'douki_hinsho'],
    ['2', 'gr_seizo'], ['2', 'm_gisou'], ['1', 'kyaku'],
  ];
  const baseX = stage.player.x + 46;
  cast.forEach(([which, type], i) => {
    const def = which === '1' ? defFor(type) : defFor2(type);
    const c = new Char(baseX + i * 34, playMid(), { ...def, team: 'mob', passive: true });
    stage.entities.push(c);
  });
  stage.currentWave = 99; stage.lockX = stage.width - 40;
  game.state = 'playing'; hideScreen();
}

// ?demo=N … 指定x地点まで進めて波を出す（スクリーンショット確認用）
{
  const d = parseFloat(new URLSearchParams(location.search).get('demo') || '0');
  if (d > 0) {
    game.state = 'playing'; hideScreen();
    // 進行ロック(lockX)を外してから移動する。Player.update が maxX=lockX で引き戻すため、
    // 外さないと指定した地点までカメラが行かない。
    stage.currentWave = stage.data.waves.length;
    stage.lockX = stage.width - 40;
    stage.player.x = d;
    stage.spawnWave(stage.data.waves[0]);   // 指定地点のまわりに敵を出す
    camPos.x = wx(d); camLook.x = wx(d);
  }
}

// デバッグ: ボスまで一気に進める
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') { stage.player.x = stage.width - 230; stage.currentWave = 99; }
});

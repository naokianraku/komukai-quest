// 小向クエスト — ボクセル3Dレンダラ（プロトタイプ）
//
// ゲームロジックは一切変更していない。既存の Stage をそのまま動かし、
// 描画だけ three.js に差し替えている（x=横 / y=奥行き / z=高さ の3軸がもともとあるため）。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PLAY, setPlay, playMid } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Char } from '../../game/src/entities.js';
import { Stage } from '../../game/src/main.js';
import { STAGES, SHUKKOU_STAGE, URA_STAGE, defFor } from '../../game/src/stages.js';

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
// 個体差。全員が同じ顔・同じ体型だと不自然なので、髪型・眼鏡・肌と髪の色・体格に幅を持たせる。
// エンティティIDから決めるので、同じキャラは画面にいる間ずっと同じ見た目になる。
const BUILDS = [            // 身長と横幅。bw/bd（胴の厚み）はボクセル側で効かせる
  { w: 0.96, h: 1.08 },     // 0 細身で背が高い
  { w: 1.00, h: 1.00 },     // 1 標準
  { w: 1.03, h: 1.04 },     // 2 背が高くてがっしり
  { w: 1.04, h: 0.90 },     // 3 小柄で太め
];

// 見た目のプリセット20種。[髪型, 眼鏡, 髭, 肌, 髪色, 体格]
// 1軸だけ変えるとパッと見で同じ人に見えるので、1体ごとに複数軸をまとめて変える。
const APPEARANCES = [
  [0, 0, 0, 0, 0, 1], [1, 1, 0, 1, 1, 0], [2, 0, 0, 2, 2, 2], [3, 2, 1, 3, 4, 3],
  [4, 0, 0, 0, 0, 0], [5, 1, 0, 1, 0, 2], [0, 0, 2, 4, 2, 1], [1, 2, 0, 2, 5, 3],
  [2, 1, 1, 0, 1, 1], [3, 0, 0, 3, 6, 2], [4, 1, 0, 2, 3, 1], [5, 0, 2, 1, 2, 0],
  [0, 2, 0, 3, 1, 2], [1, 0, 1, 4, 0, 1], [2, 0, 0, 1, 5, 0], [3, 1, 2, 0, 4, 1],
  [4, 2, 0, 4, 2, 2], [5, 0, 0, 3, 3, 3], [0, 1, 1, 2, 6, 3], [2, 2, 2, 4, 4, 0],
];
// ボスは小柄だと貫禄が出ないので、体格は標準以上に寄せた別表にする
const BOSS_APPEARANCES = [
  [2, 1, 0, 1, 5, 2], [3, 2, 1, 2, 6, 2], [5, 0, 2, 0, 1, 2],
  [1, 1, 0, 3, 4, 1], [0, 2, 0, 2, 6, 2], [2, 0, 1, 4, 5, 2],
];
const PLAYER_APPEARANCE = [0, 0, 0, 0, 0, 1];

function variantOf(e) {
  const t = e === stage.player ? PLAYER_APPEARANCE
    : e.isBoss ? BOSS_APPEARANCES[e.id % BOSS_APPEARANCES.length]
    : APPEARANCES[e.id % APPEARANCES.length];
  return { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
}
const variantKey = (v) => `${v.hair}${v.glasses}${v.beard}${v.skin}${v.hairColor}${v.build}`;

const geoCache = new Map();
function geoFor(key, vari) {
  const ck = key + '|' + variantKey(vari);
  if (geoCache.has(ck)) return geoCache.get(ck);
  const v = buildChar3DForType(key, vari);   // 3D専用の高解像度モデル（40x60x24・輪郭線なし）
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(v.colors, 3));
  g.setIndex(new THREE.BufferAttribute(v.indices, 1));
  geoCache.set(ck, g);
  return g;
}
const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const charMatHit = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x883311 });
// 予備動作（telegraph）。2D版の「敵は予備動作のあとに攻撃してくる」を読めるようにする
const charMatTele = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x241202 });

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
  // 内側のゾーン（技術管理部・関連会社）。窓がなく、壁一面が書類棚。
  // 窓のあるCゾーンより古くて色が沈んでいる。
  office: {
    ceiling: '#eceeec', wall: '#d9d5cc', cabinet: '#cdc8bd', cabinetLine: '#a9a496',
    floor: '#4a4f55', partition: '#6a7f94', mat: '#2f6f9e', desk: '#e4e1d9',
    chair: '#55606c', frame: '#a9a496', steel: '#b2b6ba',
    binder: ['#8f3a2e', '#2f5a8f', '#4a7a3e', '#8a7a2e', '#6a3a6a', '#3a6a6a'],
  },
  // 出向先の関連会社。同じ造りだが、もっと古くて色が沈んでいる。
  kanren: {
    ceiling: '#e2e0d6', wall: '#c6bda9', cabinet: '#b8ae99', cabinetLine: '#908771',
    floor: '#5a5244', partition: '#7a7256', mat: '#4a6a4a', desk: '#d6d0c0',
    chair: '#6a6252', frame: '#908771', steel: '#a8a89e',
    binder: ['#7a3a2a', '#2e4a72', '#44663a', '#7a6a2a', '#5a3a5a', '#36605e'],
  },
  // 会議フロア（60号5階）。白板とスクリーン、長机と積み重ね椅子。
  meeting: {
    ceiling: '#eef0ec', wall: '#b9c2b6', cabinet: '#aab4a6', cabinetLine: '#7d877a',
    floor: '#4e544e', partition: '#5f7a66', mat: '#2f6f5a', desk: '#ebeee6',
    chair: '#48604f', frame: '#4a5248', screen: '#fbfcf8', steel: '#b2b6ba',
  },
  // 本社の役員フロア。木目の腰壁・厚い絨毯・光る長机。金の額縁だけが明るい。
  boardroom: {
    ceiling: '#342f3c', wall: '#3d3442', wood: '#6a4a34', woodDark: '#483324',
    floor: '#4a3d52', cabinet: '#4a3a2c', cabinetLine: '#7a5e44', desk: '#3a2c22',
    deskTop: '#6a4e38', chair: '#241e2c', gold: '#e0b254', frame: '#a8822e',
    glass: '#2a3e52',
  },
  // 裏ステージ。Aゾーンが燃えている。執務室と同じ骨格を炭化させて残り火を入れる。
  hellfire: {
    ceiling: '#1a1210', wall: '#2a1a14', cabinet: '#30201a', cabinetLine: '#50302080',
    floor: '#241612', partition: '#3a201a', mat: '#401c10', desk: '#2e1d16',
    chair: '#241612', frame: '#4a2a1e', ember: '#ff6a1e', emberHot: '#ffc24a',
    smoke: '#1a0e0a',
  },
};

// ===== 場面（シーン）=====
// どの場面も「歩行帯(±halfD)の外に奥ゾーンと手前ゾーンを作る」構成で統一する。
// 帯の中に物を置くとキャラと重なって奥行きが読めなくなるため。
//
// 画面に入る高さの目安（CAM: dist 188 / height 62 / lookY 13 / fov 26°）:
// カメラは天井(y=47)より上にあるので、画面の上1/3は天井スラブの上面で埋まる。
// 奥の壁で実際に見えるのは おおよそ y=0〜22 の帯で、さらに奥ゾーンの家具が
// 下から 10 くらいを隠す。壁に貼るものは y=10〜22 に置かないと見えない。

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

  // 島デスク（奥）。天板だけだと宙に浮いて見えるので、脚・貫・椅子まで作る
  const deskZ = -halfD - 10, DT = 8.4;
  for (let x = 6; x < W; x += 30) {
    box(24, 1.1, 12, R.desk, x, DT, deskZ, { cast: true });
    box(20, 0.25, 8, R.mat, x, DT + 0.65, deskZ, { receive: false });
    // 脚ではなく脇板＋幕板。ただし椅子のある側は足が入るので開けておく。
    // この列は椅子が手前(+z)にあるので、幕板は奥(-z)側。
    const PH = DT - 1.4;
    box(1.2, PH, 11, R.cabinet, x - 11.4, PH / 2, deskZ, { cast: true });      // 左の脇板
    box(1.2, PH, 11, R.cabinet, x + 11.4, PH / 2, deskZ, { cast: true });      // 右の脇板
    box(22.6, PH, 1.2, R.cabinet, x, PH / 2, deskZ - 5.4, { cast: true });     // 幕板
    box(23, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, deskZ, { receive: false }); // 天板下の見切り
    box(24, 7, 0.9, R.partition, x, DT + 4.1, deskZ - 6.6, { cast: true });
    box(24, 6, 0.3, '#dfeaf2', x, DT + 10.6, deskZ - 6.6, { receive: false }); // アクリル板
    box(0.5, 6, 0.5, '#aeb6bd', x - 11.6, DT + 10.6, deskZ - 6.6);
    box(0.5, 6, 0.5, '#aeb6bd', x + 11.6, DT + 10.6, deskZ - 6.6);
    box(5, 4.2, 0.7, '#20262c', x + 6, DT + 3.2, deskZ - 3, { emissive: '#14303f', cast: true });
    chair(x - 6, deskZ + 10, R.chair);
  }

  // 手前の島デスク（前景）。同じく脚と椅子をつける
  const fz = halfD + 26;
  for (let x = -6; x < W + 24; x += 30) {
    box(26, 1.1, 12, R.desk, x, DT, fz, { cast: true });
    box(21, 0.25, 8, R.mat, x, DT + 0.65, fz, { receive: false });
    // この列は椅子が奥(-z)にあるので、幕板は手前(+z)側
    const PH2 = DT - 1.4;
    box(1.2, PH2, 11, R.cabinet, x - 12.4, PH2 / 2, fz, { cast: true });
    box(1.2, PH2, 11, R.cabinet, x + 12.4, PH2 / 2, fz, { cast: true });
    box(24.6, PH2, 1.2, R.cabinet, x, PH2 / 2, fz + 5.4, { cast: true });
    box(25, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, fz, { receive: false });
    box(26, 6, 0.9, R.partition, x, DT + 3.6, fz + 6.6);
    chair(x - 7, fz - 10, R.chair);
  }
}

// 事務椅子: 座面・背もたれ・支柱・五本脚
function chair(x, z, color) {
  box(6.5, 0.9, 6.5, color, x, 5.4, z, { cast: true });           // 座面
  box(6.5, 7.0, 0.8, color, x, 9.2, z - 3.0, { cast: true });     // 背もたれ
  box(1.2, 4.8, 1.2, '#8f959b', x, 2.7, z);                       // 支柱
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = box(4.6, 0.5, 0.9, '#8f959b', x + Math.cos(a) * 2.3, 0.45, z + Math.sin(a) * 2.3);
    leg.rotation.y = -a;
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

  // 配膳カウンター（奥）: ベージュの腰壁 ＋ ステンレス天板 ＋ ガラスケース。
  // 壁ぎわまで下げて、手前にテーブルの列を通す
  const cz = -halfD - 30;
  box(W + 40, 11, 12, R.cabinet, W / 2, 5.5, cz, { cast: true });
  box(W + 40, 0.8, 13, R.steel, W / 2, 11.4, cz, { receive: false });
  box(W + 40, 7, 0.4, '#dfe9ee', W / 2, 15.4, cz - 5.6, { receive: false });   // ガラス
  for (let x = -10; x < W + 20; x += 9) box(0.5, 7, 0.5, R.steel, x, 15.4, cz - 5.6);

  // メニューの色札（実物は赤・青・緑・オレンジが並ぶ）。
  // カウンターより上、かつ画面に入る高さ（y=13〜21）に吊る
  const tag = ['#d8483c', '#3f7fc0', '#49a35c', '#e08a2e', '#d8483c'];
  for (let i = 0, x = 24; x < W; x += 34, i++) {
    box(0.3, 7, 0.3, '#c9ccc8', x, 24, cz + 6.5);
    box(11, 7, 0.5, tag[i % tag.length], x, 17, cz + 6.5, { receive: false });
    box(8, 0.6, 0.6, '#f6f7f4', x, 18.4, cz + 6.9, { receive: false });
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
  for (let x = 10; x < W; x += 34) { table(x, -halfD - 13); table(x, halfD + 26); }
  // 返却口のワゴンと、床に置かれた番重（奥ゾーンの隙間を埋める）
  for (let x = 26; x < W; x += 68) {
    box(13, 7, 9, R.steel, x, 3.5, -halfD - 24, { cast: true });
    for (let i = 0; i < 3; i++) box(11, 1.1, 7, '#cfd4d8', x, 7.8 + i * 1.3, -halfD - 24, { receive: false });
  }
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
    // 手前側は低くする。背の高い建屋を置くと画面の下半分が無地の灰色で埋まる
    for (let x = -30; x < W + 50; x += 90) {
      box(84, far ? 52 : 19, 16, R.bldg, x, far ? 26 : 9.5, sz, { cast: true });
      for (let f = 0; f < (far ? 5 : 1); f++) {
        box(76, 3.2, 1.0, R.bldgWin, x, far ? 9 + f * 9 : 15, sz + (far ? 8.5 : -8.5), { receive: false });
      }
      if (!far) {
        box(84, 2.0, 1.2, '#9aa0a6', x, 18.4, sz - 8.2, { receive: false });      // 庇
        box(12, 11, 1.0, '#6e747a', x - 24, 5.5, sz - 8.3, { receive: false });   // シャッター
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

// --- 執務室（内側のゾーン／関連会社）---
// 窓がないぶん、壁一面の書類棚で埋める。実際この手のフロアは棚で視界が切れている。
function buildOfficeInner(W, halfD, R = ROOM.office) {
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 320, 900);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.08, 0.4, '#5f646a', W / 2, 0.02, halfD);
  box(W + 80, 0.08, 0.4, '#5f646a', W / 2, 0.02, -halfD);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  box(W + 80, 2, FRONT - BACK, R.ceiling, W / 2, 47, (FRONT + BACK) / 2);

  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 14; dz < FRONT - 10; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#d5dde2', receive: false });
    }
  }
  box(W + 80, 1.2, 2.2, '#cdc8bd', W / 2, 44.2, BACK + 8);

  // 壁一面の書類棚。背表紙の色が並ぶだけで一気に事務所になる
  for (let x = -12; x < W + 24; x += 26) {
    box(24, 34, 6, R.cabinet, x, 17, BACK + 4, { cast: true });
    for (let f = 0; f < 5; f++) {
      box(23, 0.5, 0.6, R.cabinetLine, x, 2.5 + f * 6.6, BACK + 7.2, { receive: false });
      for (let i = 0; i < 9; i++) {
        const c = R.binder[Math.abs(x * 3 + f * 5 + i) % R.binder.length];
        box(1.9, 5.0, 0.7, c, x - 10 + i * 2.5, 5.6 + f * 6.6, BACK + 7.1, { receive: false });
      }
    }
  }

  // 棚の上の段ボール箱と、天井から下がるゾーン札
  for (let x = 8; x < W; x += 52) box(11, 7, 5, '#b89a72', x, 37.5, BACK + 4, { cast: true });
  for (let x = 40; x < W; x += 150) {
    box(0.3, 6, 0.3, '#a9a496', x, 41.5, BACK + 26);
    box(13, 5, 0.6, '#f0f1ee', x, 36, BACK + 26, { receive: false });
    box(9, 0.9, 0.8, R.partition, x, 36, BACK + 25.6, { receive: false });
  }

  // 島デスク。窓側フロアと違って向かい合わせの2列組
  const DT = 8.4, PH = DT - 1.4;
  const island = (x, z, chairSide) => {
    box(24, 1.1, 12, R.desk, x, DT, z, { cast: true });
    box(20, 0.25, 8, R.mat, x, DT + 0.65, z, { receive: false });
    box(1.2, PH, 11, R.cabinet, x - 11.4, PH / 2, z, { cast: true });
    box(1.2, PH, 11, R.cabinet, x + 11.4, PH / 2, z, { cast: true });
    box(22.6, PH, 1.2, R.cabinet, x, PH / 2, z - 5.4 * chairSide, { cast: true });  // 幕板は椅子と反対側
    box(23, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, z, { receive: false });
    box(5, 4.2, 0.7, '#20262c', x + 6, DT + 3.2, z - 3 * chairSide, { emissive: '#14303f', cast: true });
    box(7, 5, 5, '#e6e3db', x - 7, DT + 3.0, z, { cast: true });                    // 書類の山
    chair(x - 6, z + 10 * chairSide, R.chair);
  };
  const bz = -halfD - 12;
  for (let x = 6; x < W; x += 30) {
    island(x, bz, 1);
    box(24, 7, 0.9, R.partition, x, DT + 4.1, bz - 6.6, { cast: true });
    island(x, bz - 24, -1);                       // 背中合わせのもう1列
  }
  const fz = halfD + 26;
  for (let x = -6; x < W + 24; x += 30) {
    island(x, fz, -1);
    box(26, 6, 0.9, R.partition, x, DT + 3.6, fz + 6.6);
  }
}

// --- 会議フロア（60号5階 生産管理・生産企画）---
function buildMeeting(W, halfD) {
  const R = ROOM.meeting;
  const { BACK, FRONT } = zones(halfD, 38, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 330, 920);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  box(W + 80, 2, FRONT - BACK, R.ceiling, W / 2, 47, (FRONT + BACK) / 2);
  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 16; dz < FRONT - 10; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#dde3dc', receive: false });
    }
  }

  // 壁は白板とスクリーンの連続。審査会で詰められる場所という見た目にする。
  // 壁と白板が同系色だと溶けるので、濃い枠で縁取る。
  for (let x = 14; x < W; x += 120) {
    box(58, 18, 0.9, R.frame, x, 17, BACK + 0.5, { receive: false });                // 濃い枠
    box(55, 15, 0.5, '#fbfcfa', x, 17.5, BACK + 1.1, { receive: false });            // ホワイトボード
    box(57, 1.4, 1.6, R.frame, x, 9.2, BACK + 1.4);                                  // ペン受け
    box(10, 0.9, 1.0, '#d8483c', x - 18, 9.8, BACK + 1.9, { receive: false });        // 赤ペン
    for (let i = 0; i < 4; i++) {                                                     // 書き殴りの線
      box(14 + (i % 3) * 9, 0.7, 0.3, ['#3a4a5a', '#8f3a2e', '#2f5a8f'][i % 3],
          x - 13 + (i % 2) * 13, 22 - i * 3, BACK + 1.5, { receive: false });
    }
  }
  for (let x = 74; x < W; x += 120) {
    box(44, 20, 0.9, R.frame, x, 18, BACK + 0.5, { receive: false });
    box(40, 17, 0.5, R.screen, x, 18, BACK + 1.1, { emissive: '#aeb8b2', receive: false }); // スクリーン
    box(28, 8, 0.3, '#5a7fa8', x, 19, BACK + 1.6, { emissive: '#2e4a68', receive: false }); // 投影中の資料
    box(44, 1.6, 1.4, '#6a7268', x, 28.6, BACK + 1.2);
    box(7, 4, 9, '#2e3430', x, 41, BACK + 30, { cast: true });                        // 天吊りプロジェクタ
    box(1.0, 4, 1.0, '#8a9088', x, 44.6, BACK + 30);
  }

  // 長机の列（奥）。審査会の「ひな壇」側
  const longTable = (x, z, back) => {
    box(46, 1.0, 13, R.desk, x, 8.2, z, { cast: true });
    box(44, 0.25, 9, R.mat, x, 8.8, z, { receive: false });
    box(46, 6.6, 0.9, R.cabinet, x, 4.4, z + 6.0 * back, { cast: true });             // 前幕板
    for (const dx of [-21, 21]) box(0.9, 7.2, 11, R.cabinet, x + dx, 3.8, z, { cast: true });
    for (const dx of [-15, -5, 5, 15]) chair(x + dx, z - 9 * back, R.chair);
    for (const dx of [-16, 0, 16]) {                                                   // 書類とペットボトル
      box(6, 0.3, 4, '#f6f7f4', x + dx, 8.9, z, { receive: false });
      box(1.6, 4.0, 1.6, '#cfe0e8', x + dx + 4, 10.7, z + 2, { cast: true });
    }
  };
  for (let x = 24; x < W; x += 58) longTable(x, -halfD - 9, 1);
  for (let x = 10; x < W; x += 58) longTable(x, halfD + 26, -1);

  // 壁ぎわの積み重ね椅子とフリップチャート
  for (let x = 40; x < W; x += 140) {    // 積み重ねた椅子（壁ぎわ。白板を隠さない高さに留める）
    for (let i = 0; i < 5; i++) box(5.2, 0.6, 5.2, R.chair, x, 1.2 + i * 1.4, BACK + 13, { cast: true });
    box(5.6, 7.5, 5.6, R.chair, x, 4.2, BACK + 13);
  }
  for (let x = 100; x < W; x += 140) {
    box(0.6, 20, 0.6, '#9aa096', x - 5, 10, halfD + 12);
    box(0.6, 20, 0.6, '#9aa096', x + 5, 10, halfD + 12);
    box(13, 16, 0.4, '#fbfcfa', x, 22, halfD + 12, { receive: false });
  }
}

// --- 本社 役員フロア ---
function buildBoardroom(W, halfD) {
  const R = ROOM.boardroom;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(false);
  // 役員フロアだけは蛍光灯の白ではなく、暗く落とした間接照明にする
  hemi.color.set(0x6a6074); hemi.groundColor.set(0x322a38); hemi.intensity = 1.5;
  sun.color.set(0xffe2a8); sun.intensity = 1.05; fill.intensity = 0.8;
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 250, 760);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);   // 厚い絨毯
  for (let z = BACK + 6; z < FRONT; z += 24) {
    box(W + 80, 0.06, 0.5, '#4a3d50', W / 2, 0.03, z, { receive: false });
  }
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  box(W + 80, 2, FRONT - BACK, R.ceiling, W / 2, 47, (FRONT + BACK) / 2);

  // 腰壁と縦の木目パネル（格を見せる要素）。見える帯に収める
  box(W + 80, 11, 1.6, R.wood, W / 2, 5.5, BACK + 0.4);
  box(W + 80, 1.2, 2.2, R.woodDark, W / 2, 11.6, BACK + 0.8);
  for (let x = -10; x < W + 20; x += 14) {
    box(2.0, 14, 1.0, R.woodDark, x, 19, BACK + 0.7);
  }

  // 金の額縁（歴代の事業部長）と社章。暗い部屋で唯一明るいもの
  for (let x = 30; x < W; x += 72) {
    box(13, 13, 0.9, R.frame, x, 18, BACK + 1.1, { emissive: '#4a3a10', receive: false });
    box(10, 10, 0.4, '#5a4a52', x, 18, BACK + 1.7, { receive: false });
    box(5.5, 5.5, 0.3, '#8a7a74', x, 20, BACK + 2.0, { receive: false });   // 顔のあたり
  }
  for (let x = 96; x < W; x += 216) {
    box(12, 12, 0.6, R.gold, x, 19, BACK + 1.2, { emissive: '#4a3614', receive: false });
    box(7.5, 7.5, 0.5, R.wall, x, 19, BACK + 1.6, { receive: false });
  }

  // ペンダント照明。長机の上に低く吊るす（高いと天井に隠れて見えない）
  for (let x = 20; x < W; x += 38) {
    box(0.5, 26, 0.5, R.gold, x, 33, -halfD - 8);
    box(13, 2.4, 7, R.gold, x, 19.0, -halfD - 8, { emissive: '#7a5a1e', receive: false });
    box(11, 0.8, 5.5, '#ffe6b0', x, 17.6, -halfD - 8, { emissive: '#ffdca0', receive: false });
  }

  // 磨き上げた長机と背の高い革椅子
  const boardTable = (x, z, back) => {
    box(54, 1.3, 16, R.deskTop, x, 9.0, z, { cast: true });
    box(50, 0.3, 12, '#5c4430', x, 9.7, z, { receive: false });                       // 艶のある天板
    box(50, 7.5, 10, R.desk, x, 4.8, z, { cast: true });                              // 台輪
    // 椅子は必ず歩行帯側（手前）に置く。机の向こうに置くと壁を隠してしまう
    for (const dx of [-19, -6, 7, 20]) {
      box(7.5, 1.0, 7.5, R.chair, x + dx, 6.2, z + 11 * back, { cast: true });        // 座面
      box(7.5, 13, 1.2, R.chair, x + dx, 12.7, z + 14 * back, { cast: true });        // 高い背もたれ
      box(1.4, 5.4, 1.4, '#6a6270', x + dx, 3.0, z + 11 * back);
      box(7.0, 0.6, 7.0, '#6a6270', x + dx, 0.5, z + 11 * back);
    }
    for (const dx of [-18, 0, 18]) {
      box(7, 0.3, 5, '#e8e4dc', x + dx, 9.9, z, { receive: false });                  // 資料
      box(3.2, 3.6, 3.2, R.glass, x + dx + 6, 11.4, z + 3, { emissive: '#0e1a26', cast: true });
    }
  };
  for (let x = 30; x < W; x += 66) boardTable(x, -halfD - 22, 1);
  for (let x = 10; x < W; x += 66) boardTable(x, halfD + 30, -1);
}

// --- 裏ステージ: 業火の60号7階Aゾーン ---
// 執務室と同じ骨格を炭にして、残り火と非常灯だけが光る状態にする。
function buildHellfire(W, halfD) {
  const R = ROOM.hellfire;
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  hemi.color.set(0x5a2a16); hemi.groundColor.set(0x1a0c08); hemi.intensity = 1.0;
  sun.color.set(0xff8a3a); sun.intensity = 1.1; fill.intensity = 0.4;
  scene.background = hex(R.smoke);
  scene.fog = new THREE.Fog(hex(R.smoke), 180, 620);          // 煙で奥が見えない

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);

  // 天井は落ちている。残った野縁と、垂れ下がった蛍光灯だけ
  for (let x = -10; x < W + 20; x += 9) {
    if (Math.abs((x * 7) % 29) < 11) continue;                           // 抜け落ちた区画
    box(8, 1.2, FRONT - BACK, R.ceiling, x, 47, (FRONT + BACK) / 2);
  }
  for (let x = 16; x < W; x += 76) {                           // 垂れ下がった照明器具
    box(0.4, 26, 0.4, '#3a2a22', x, 33, -halfD - 8);
    const t = box(26, 0.8, 2.0, '#4a3a30', x, 20.4, -halfD - 8, { receive: false });
    t.rotation.z = 0.35;                                       // 片側が外れて斜めに垂れる
  }

  // 床の残り火。手前と奥のゾーンにだけ置いて歩行帯は空けておく。
  // 同じ箱を等間隔に並べると燃えている物ではなく荷物に見えるので、
  // 幅を変えながら3段に細らせ、位置も間隔もずらす。
  const rnd = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  let seed = 0;
  for (let x = -6; x < W + 20; x += 11 + rnd(seed++) * 9) {
    for (const z0 of [-halfD - 22, -halfD - 7, halfD + 9, halfD + 28]) {
      const r = rnd(seed++);
      if (r < 0.3) continue;                                     // 抜け（炎の列が揃わないように）
      const z = z0 + (rnd(seed++) - 0.5) * 7;
      const w = 3.2 + r * 3.4, h = 3.0 + rnd(seed++) * 6;
      box(w + 1.6, 0.6, w + 1.6, '#120a08', x, 0.3, z, { receive: false });            // 焦げた跡
      box(w, h * 0.5, w * 0.9, '#c2340c', x, h * 0.25, z, { emissive: '#c2340c', receive: false });
      box(w * 0.68, h * 0.4, w * 0.6, R.ember, x, h * 0.62, z, { emissive: R.ember, receive: false });
      box(w * 0.34, h * 0.34, w * 0.3, R.emberHot, x, h * 0.9, z, { emissive: R.emberHot, receive: false });
    }
  }

  // 焼け残った壁ぎわのキャビネットと、倒れた机
  for (let x = -14; x < W + 24; x += 24) {
    const hgt = 6 + Math.abs((x * 11) % 7);
    box(22, hgt, 5, R.cabinet, x, hgt / 2, BACK + 3.5, { cast: true });
    box(21, 0.5, 0.6, R.ember, x, hgt - 0.4, BACK + 6.1, { emissive: R.ember, receive: false });
  }
  for (let x = 8; x < W; x += 34) {
    const d = box(24, 1.1, 12, R.desk, x, 3.2, -halfD - 12, { cast: true });
    d.rotation.z = Math.abs((x * 5) % 7) * 0.09 - 0.27;                // ひっくり返っている
    box(22, 7, 0.9, R.partition, x, 2.0, -halfD - 18, { cast: true }).rotation.x = 1.2;
    const f = box(24, 1.1, 12, R.desk, x + 12, 3.0, halfD + 26, { cast: true });
    f.rotation.z = 0.22;
  }

  // 非常灯（緑）と、壁に残った誘導標識
  for (let x = 34; x < W; x += 112) {                          // 非常灯（煙の中で唯一の緑）
    box(7, 3.4, 0.8, '#1e4a2a', x, 18, BACK + 1.0, { receive: false });
    box(5.4, 2.2, 0.4, '#3ad46a', x, 18, BACK + 1.5, { emissive: '#3ad46a', receive: false });
  }
}

const SCENES = {
  office_win: buildOffice, office: buildOfficeInner, meeting: buildMeeting,
  kanren: (W, halfD) => buildOfficeInner(W, halfD, ROOM.kanren),
  boardroom: buildBoardroom, hellfire: buildHellfire,
  shrine: buildShrine, shokudo: buildShokudo, yard: buildYard,
};

function applyScene(key, data) {
  clearScenery();
  const W = data.width * S;
  const halfD = (PLAY.bottom - PLAY.top) * S / 2 + 3;
  (SCENES[key] || buildOffice)(W, halfD);
}

// ステージ内で場面が変わる区間。data.scenes3d は 3D専用のキーで、
// 「このx以降はこの場面」という切り替え点だけを並べる（手前は bg.scene）。
// 2D版はこのキーを見ないので、2Dの背景は変わらない。
function sceneAt(data, x) {
  let cur = { scene: data.bg.scene, label: null };
  for (const seg of data.scenes3d || []) if (x >= seg.x) cur = seg;
  return cur;
}

let curScene = null;
function buildScenery(data) {
  const forced = new URLSearchParams(location.search).get('scene');
  curScene = forced || sceneAt(data, stage ? stage.player.x : 0).scene;
  applyScene(curScene, data);
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
  for (const [, r] of weapons) { scene.remove(r.group); scene.remove(r.flash); }
  weapons.clear();
  for (const p of parts) { p.m.visible = false; partPool.push(p.m); }
  parts.length = 0;
  for (const [, r] of tagEls) { r.tag.remove(); r.bubble.remove(); }
  tagEls.clear();
  for (const f of floats) f.el.remove();
  floats.length = 0;
}

// 本編・出向・裏ステージで共通のロード処理。fx のフックを張り直すのを忘れると
// 打撃の手応えと数字が出なくなるので、必ずここを通す。
function attachStage(st, data) {
  clearStageObjects();
  bossSceneApplied = false;
  stage = st;
  const origHit2 = stage.fx.hit.bind(stage.fx);
  stage.fx.hit = (x, y, color) => { origHit2(x, y, color); hitstop = 0.06; shake = 1.1; burst(x, y, color); };
  const origText2 = stage.fx.text.bind(stage.fx);
  stage.fx.text = (x, y, str, color) => { origText2(x, y, str, color); addFloat(x, y, 0, str, color); };
  stage.player.ranged = (game.difficulty === 'easy');   // 2D版の applyDifficulty と同じ
  buildScenery(data);
  camPos.set(wx(stage.player.x), CAM.height, wz(stage.player.y) + CAM.dist);
  camLook.set(wx(stage.player.x), CAM.lookY, wz(stage.player.y) - 3);
}

function loadStage(i) { attachStage(new Stage(STAGES[i], game), STAGES[i]); }

// 「出向」の扉 → 関連会社サブステージ。クリアで本社（Stage3）へ帰還する。
let savedStage = null;
function enterDetour() {
  const hp = stage.player.hp;
  savedStage = stage;
  const st = new Stage(SHUKKOU_STAGE, game);
  st.isDetour = true;
  attachStage(st, SHUKKOU_STAGE);
  stage.player.hp = Math.max(5, Math.min(hp, stage.player.maxhp));   // HPを引き継ぐ
  game.state = 'intro'; game.screenT = 0; renderScreen();
}
function returnFromDetour() {
  const hp = stage.player.hp;
  const back = savedStage; savedStage = null;
  back.player.hp = Math.max(5, hp);
  back.player.x = back.door.x + 34;      // 扉の先へ
  back.player.invuln = 1.4;
  back.detourRequested = false;
  attachStage(back, back.data);
  back.banner = '出向先を制圧！' + (back.data.location || '本社') + 'へ帰還';
  back.bannerColor = 'rgba(22,42,74,0.92)'; back.bannerT = 2.6;
  game.state = 'playing'; hideScreen();
}
// 事業部長を倒した“その先”——業火の裏ステージへ（帰還なし。クリアでエンディング）
function enterTrueFinal() {
  const st = new Stage(URA_STAGE, game);
  attachStage(st, URA_STAGE);
  stage.player.hp = stage.player.maxhp;  // 真の最終決戦は全快で
  game.state = 'intro'; game.screenT = 0; renderScreen();
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
      e._v = e._v || variantOf(e);   // _v が先に入っていればそれを使う（?looks=1 の確認用）
      m = new THREE.Mesh(geoFor(e.spriteKey, e._v), charMat);
      m.castShadow = true; m.receiveShadow = false;
      scene.add(m);
      meshes.set(e.id, m);
    }
    // C3.SCALE で 2D版と同じ見た目サイズに戻す（グリッドが細かいぶん1ボクセルが小さい）
    const sc = ((e.scale || 3) / 3) * C3.SCALE;
    const bd = BUILDS[(e._v && e._v.build) ?? 1];
    m.scale.set(sc * bd.w, sc * bd.h, sc * bd.w);   // 体格の差
    // 攻撃中は前に踏み込む。棒立ちで当たり判定だけ出るのを避ける（手応えの演出）
    const lunge = e.attackActive ? 3.2 * sc : (e.state === 'attack' ? 1.4 * sc : 0);
    m.position.set(wx(e.x) + lunge * (e.facing >= 0 ? 1 : -1), wy(e.z), wz(e.y));
    // 進行方向へ向ける。真横(90°)まで回すと薄い板に見えるので浅めに留め、顔はカメラ側に残す。
    // 符号に注意: Y軸回転 θ で正面(+Z)は x=sin(θ) へ向く。右(+X)を向かせるには θ>0。
    m.rotation.y = (e.facing >= 0 ? 1 : -1) * 0.55;
    // 予備動作でのけぞり、攻撃で前に倒す。動きを読めるようにする。
    m.rotation.x = e.state === 'telegraph' ? -0.12 : (e.attackActive ? 0.16 : 0);
    m.visible = !(e.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0);
    m.material = e.hitstun > 0 ? charMatHit : (e.state === 'telegraph' ? charMatTele : charMat);
  }
  for (const [id, m] of meshes) {
    if (seen.has(id)) continue;
    scene.remove(m); meshes.delete(id);
  }
}

// ===== 攻撃の見た目 =====
// プレイヤーは拳（2D版の drawFist と同じ）。敵は職種ごとの道具で殴る。
// インパクトの閃光。2D版は星形のバーストを描いていたので、3Dでも尖らせる。
// 球にすると「大きな玉」に見えて拳と紛らわしかった。
const flashSpikeGeo = new THREE.BoxGeometry(9.0, 1.3, 1.3);
const flashCoreGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
const flashMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#ffd98a'), transparent: true, opacity: 0.62,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
function makeFlash() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(flashSpikeGeo, flashMat);
    m.rotation.z = (i / 4) * Math.PI;      // 45度ずつ交差させて星形にする
    g.add(m);
  }
  g.add(new THREE.Mesh(flashCoreGeo, flashMat));
  return g;
}

const mat = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), ...opts });
// 各武器は「主パーツ＋補助パーツ」の最大2つで形を作る
const WEAPON_SPEC = {
  fist:   { a: [new THREE.BoxGeometry(2.8, 2.8, 2.8), mat('#f1c79b'), [0, 0, 0]] },
  roll:   { a: [new THREE.CylinderGeometry(1.7, 1.7, 12, 8), mat('#eceee8'), [0, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(1.8, 1.8, 1.2, 8), mat('#c8ccc4'), [-4, 0, 0], [0, 0, Math.PI / 2]] },
  wrench: { a: [new THREE.BoxGeometry(13, 2.0, 2.0), mat('#b9bec4'), [0, 0, 0]],
            b: [new THREE.BoxGeometry(4.5, 5.0, 2.2), mat('#9aa0a6'), [6, 0, 0]] },
  binder: { a: [new THREE.BoxGeometry(2.0, 11, 9), mat('#2e4a7a'), [0, 0, 0]],
            b: [new THREE.BoxGeometry(0.9, 10, 8), mat('#f2f4f6'), [1.2, 0, 0]] },
  stamp:  { a: [new THREE.CylinderGeometry(2.2, 2.2, 6, 10), mat('#8a6a46'), [0, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(2.4, 2.4, 1.0, 10), mat('#c0352a'), [3.4, 0, 0], [0, 0, Math.PI / 2]] },
};

// 職種 → 武器。書類仕事は丸めた資料やバインダー、現場はレンチ、管理は判子。
const WEAPON_OF = {
  player: 'fist',
  ally: 'roll', douki_sekkei: 'roll', douki_hinsho: 'binder', douki_genba: 'wrench', shutantou: 'binder',
  buka: 'roll', senpai: 'roll', dr: 'roll', staff: 'binder', exctrl: 'stamp',
  kyaku: 'binder', vendor: 'binder', missile: 'wrench', kanren: 'wrench', shukkou: 'binder',
  pmr_seisan: 'binder', pmr_seizou: 'wrench', pmr_choutatsu: 'binder',
  pmr_gijutsu: 'roll', pmr_hinshou: 'stamp', seikikaku: 'roll', kanrik: 'stamp',
};
const weaponOf = (e) => (e === stage.player ? 'fist' : (WEAPON_OF[e.spriteKey] || (e.isBoss ? 'fist' : 'roll')));

const weapons = new Map();   // entity.id → {group, flash, kind}
const armMat = mat('#a8c4de');   // 作業着の袖
const wristMat = mat('#f1c79b');
const armGeo = new THREE.BoxGeometry(7.0, 2.2, 2.2);
const wristGeo = new THREE.BoxGeometry(1.4, 2.4, 2.4);

function makeWeapon(kind) {
  const spec = WEAPON_SPEC[kind] || WEAPON_SPEC.fist;
  const g = new THREE.Group();
  // 前腕。道具だけが宙に浮いて見えるのを防ぐため、必ず胴側へ伸ばす
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(-5.0, 0, 0); arm.castShadow = true; g.add(arm);
  const wrist = new THREE.Mesh(wristGeo, wristMat);
  wrist.position.set(-1.6, 0, 0); wrist.castShadow = true; g.add(wrist);
  for (const key of ['a', 'b']) {
    const part = spec[key];
    if (!part) continue;
    const [geo, material, pos, rot] = part;
    const m = new THREE.Mesh(geo, material);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function syncWeapons() {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive || !e.attackActive) continue;
    seen.add(e.id);
    const kind = weaponOf(e);
    let r = weapons.get(e.id);
    if (!r || r.kind !== kind) {
      if (r) { scene.remove(r.group); scene.remove(r.flash); }
      const group = makeWeapon(kind);
      const flash = makeFlash();
      scene.add(group); scene.add(flash);
      r = { group, flash, kind }; weapons.set(e.id, r);
    }
    const sc = (e.scale || 3) / 3;
    const dir = e.facing >= 0 ? 1 : -1;
    const px = wx(e.x) + 9.5 * sc * dir, py = wy(e.z) + 10 * sc, pz = wz(e.y);
    r.group.position.set(px, py, pz);
    r.group.scale.set(sc * dir, sc, sc);          // 向きで左右反転
    // 閃光は拳の少し手前・少し外側に。拳が埋もれないよう小さめにして回す
    r.flash.position.set(px + 3.5 * sc * dir, py, pz + 3);
    r.flash.rotation.z = Math.random() * Math.PI;
    r.flash.scale.setScalar(sc * (0.34 + Math.random() * 0.14));
    r.group.visible = r.flash.visible = true;
  }
  for (const [id, r] of weapons) {
    if (seen.has(id)) continue;
    scene.remove(r.group); scene.remove(r.flash); weapons.delete(id);
  }
}

// ===== 飛び道具とヒットの粒子 =====
// 2D版の Projectile を3Dの小物で表現する。
// 当たり判定・ダメージは2D版のまま（kind は 'paper' か 'missile' の2種類）で、
// 見た目だけ 書類 / マグカップ / キーボード から選んで変化をつける。
// 2D版の描画には一切影響しない。
const THROWN = {
  paper: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 4.2), mat('#f4f6f8')));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 0.5), mat('#9aa6b2')));
    return g;
  },
  mug: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.8, 4.4, 10), mat('#f2f4f6'));
    g.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 6, 10), mat('#f2f4f6'));
    handle.position.set(2.4, 0, 0); handle.rotation.y = Math.PI / 2;
    g.add(handle);
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 10), mat('#5a3a22'));
    coffee.position.y = 2.0; g.add(coffee);
    return g;
  },
  keyboard: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.1, 3.8), mat('#e4e7ea')));
    const keys = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 3.0), mat('#3c424a'));
    keys.position.y = 0.7; g.add(keys);
    return g;
  },
  missile: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 1.8), mat('#5a6a2e', { emissive: new THREE.Color('#2a1a08') })));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), mat('#8a3a1a'));
    tip.position.x = 4.2; tip.rotation.z = -Math.PI / 2; g.add(tip);
    return g;
  },
};
const LOOKS = ['paper', 'mug', 'keyboard'];

const projMeshes = new Map();
function syncProjectiles() {
  const seen = new Set();
  for (const pr of stage.projectiles) {
    if (!pr.alive) continue;
    seen.add(pr.id);
    let r = projMeshes.get(pr.id);
    if (!r) {
      // 同じ弾が毎フレーム見た目を変えないよう、IDから決める
      const look = pr.kind === 'missile' ? 'missile' : LOOKS[pr.id % LOOKS.length];
      const group = THROWN[look]();
      group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(group);
      r = { group, look, spin: (pr.id % 2 ? 1 : -1) * 0.26 };
      projMeshes.set(pr.id, r);
    }
    r.group.position.set(wx(pr.x), wy(pr.z || 0) + 9, wz(pr.y));
    if (r.look === 'missile') {
      r.group.rotation.set(0, pr.vx > 0 ? 0 : Math.PI, 0);       // 誘導弾は진行方向を向く
    } else {
      r.group.rotation.z += r.spin;                               // 投げ物はくるくる回る
      r.group.rotation.x += r.spin * 0.6;
    }
  }
  for (const [id, r] of projMeshes) {
    if (seen.has(id)) continue;
    scene.remove(r.group); projMeshes.delete(id);
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
    p.m.scale.setScalar(0.5 + (1 - p.t / 0.42));
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
  // 出向・裏ステージは STAGES に入っていないので、今読み込んでいるステージのデータを使う
  const ch = (stage && stage.data) || STAGES[game.stageIndex];
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
// ?shot=秒 … その秒数ぶんまとめて進めて1枚だけ描き、ループを止める。
// 描き続けているとヘッドレスブラウザの仮想時間が終わらずスクリーンショットが撮れない。
const SHOT = parseFloat(new URLSearchParams(location.search).get('shot') || '0');
let shotDone = false;
let acc = 0, last = performance.now();
function loop(now) {
  if (!shotDone) requestAnimationFrame(loop);
  let frame = (now - last) / 1000; last = now;
  if (!(frame > 0)) frame = 0;        // 負 / NaN を潰す（補間の発散を防ぐ）
  if (frame > 0.25) frame = 0.25;     // スパイラル防止
  if (SHOT > 0) frame = shotDone ? 0 : Math.min(SHOT, 30);
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
        // ?atk=1 … 攻撃の見た目を確認するために攻撃状態を固定する（開発用）
        // 開発用。向きは固定しない（固定すると左へ攻撃できなくなる）
        if (Q.get('atk') === '1') stage.player.attackActive = true;
        if (stage.detourRequested && !stage.isDetour) {
          enterDetour();                         // 「出向」の扉に触れた → 関連会社へ
        } else if (stage.cleared) {
          if (stage.isDetour) {
            returnFromDetour();                  // 関連会社を制圧 → 本社(Stage3)へ帰還
          } else if (stage.data.trueFinal) {
            enterTrueFinal();                    // 事業部長撃破 → 業火の裏ステージへ
          } else {
            game.state = game.stageIndex >= STAGES.length - 1 ? 'ending' : 'clear';
            game.screenT = 0; renderScreen();
          }
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
  // 区間で場面が変わるステージ（執務室→食堂→執務室 / 会議フロア→構内道路）。
  // ボス場面に入ったあとは戻さない。
  if (!bossSceneApplied && stage.data.scenes3d && !Q.get('scene')) {
    const seg = sceneAt(stage.data, stage.player.x);
    if (Q.get('dbg') === '1' && !window.__segdbg) { window.__segdbg = 1; window.__dbg &&
      window.__dbg('SEG x=' + stage.player.x.toFixed(0) + ' cur=' + curScene + ' -> ' + seg.scene +
                   ' segs=' + JSON.stringify(stage.data.scenes3d)); }
    if (seg.scene !== curScene) {
      curScene = seg.scene;
      applyScene(curScene, stage.data);
      if (seg.label) {
        stage.banner = seg.label;
        stage.bannerColor = 'rgba(28,58,86,0.92)';
        stage.bannerT = 2.4;
      }
    }
  }

  // ボス戦で場面が変わるステージ（工場長＝構内の稲荷社）。
  // Stage は本編のものをそのまま使っているため startBoss は書き換えず、
  // ここで bossStarted の立ち上がりを拾って背景だけ差し替える。
  if (stage.bossStarted && !bossSceneApplied && stage.data.bossScene
      && !new URLSearchParams(location.search).get('scene')) {
    bossSceneApplied = true;
    curScene = stage.data.bossScene;
    applyScene(curScene, stage.data);
    stage.banner = stage.data.bossLocation || '';
    stage.bannerColor = 'rgba(150,40,20,0.92)';
    stage.bannerT = 3.0;
  }

  shake = Math.max(0, shake - frame * 4.5);
  syncEntities();
  updateCamera(frame);
  updateHUD(frame);
  renderer.render(scene, camera);
  syncWeapons();
  syncProjectiles();
  updateParts(frame);
  syncLabels();
  updateFloats(frame);
  if (!window.__once && Q.get('dbg') === '1') { window.__once = 1; window.__dbg && window.__dbg(
    'OK frame1 / meshes=' + meshes.size + ' / children=' + scene.children.length +
    ' / cam=' + camera.position.toArray().map(n=>n.toFixed(1)).join(',') +
    ' / look=' + camLook.toArray().map(n=>n.toFixed(1)).join(',')); }
  } catch (e) { window.__dbg && window.__dbg('LOOP: ' + (e.stack || e.message)); throw e; }
  // 武器や投擲物は render の後に同期しているので、1フレーム目には写らない。
  // ?shot では2フレーム目まで描いてから止める。
  if (SHOT > 0) { if (window.__shot1) shotDone = true; window.__shot1 = 1; }
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

// ?looks=1 … 同じ役職の20体を並べて、個体差だけを見るビュー
if (new URLSearchParams(location.search).get('looks') === '1') {
  for (const e of [...stage.entities]) if (e !== stage.player) e.alive = false;
  stage.sweepDead();
  const baseX = stage.player.x + 40;
  APPEARANCES.forEach((t, i) => {
    const row = i % 10, col = (i / 10) | 0;
    const c = new Char(baseX + row * 30, PLAY.top + col * 70, { ...defFor('buka'), team: 'mob', passive: true });
    c._v = { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
    stage.entities.push(c);
  });
  stage.currentWave = 99; stage.lockX = stage.width - 40;
  game.state = 'playing'; hideScreen();
}

// ?stage=N … 第Nステージから始める（場面の確認用）
{
  const sg = new URLSearchParams(location.search).get('stage') || '';
  if (sg === 'shukkou') { const st = new Stage(SHUKKOU_STAGE, game); st.isDetour = true; attachStage(st, SHUKKOU_STAGE); }
  else if (sg === 'ura') attachStage(new Stage(URA_STAGE, game), URA_STAGE);
  else if (+sg >= 1 && +sg <= STAGES.length) { game.stageIndex = +sg - 1; loadStage(+sg - 1); }
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

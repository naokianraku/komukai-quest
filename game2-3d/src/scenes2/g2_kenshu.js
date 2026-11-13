// 小向クエスト2 ゴールデンエイジ編 — 第1章 研修センターの実習場と、配属面談を待つ廊下（g2_kenshu）
//
// 第1章の2つの区間で張る（game2/src/stages2.js の scenes3d）:
//   x 500〜859  … 安全衛生講習・ビジネスマナー研修の実習場
//   x 1150〜    … 配属面談の待合。実習室が並ぶ廊下で、今日は実習室が面談室になっている
// 同じ建物なので、床（淡い灰緑のリノリウム）・壁・天井は通しで同じにし、左に実習場、右に廊下を並べる。
// 境目は2つの区間のあいだ（寮の区間）に来るよう、章データの切り替え点から決める。
//
// この章の背景が言うのは「全員同じ」。同じ白いヘルメットの棚、同じ練習机、同じパイプ椅子の列、
// 整列の足形。文字は描かない（番号札も呼び出しの表示も、無地の札と灯りの色だけ）。
// 講堂（g2_kodo）と見分けがつくよう、段々の客席も壇も無い、平らで明るい実務の部屋にする。
// 第1章は6章でいちばん明るく暖かい（坂 0.0）。実習場の窓の外は春（桜）。
import {
  THREE, wx, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill,
} from '../../../game3d/src/render3d.js';

const KEY = 'g2_kenshu';

const C = {
  wall: '#efe7d6', haze: '#efe9dc', ceiling: '#f4f0e6', base: '#7a7468',
  floor: '#abbfb4', floorAlt: '#a1b5aa', seam: '#98ada2', border: '#8ea196',
  pilaster: '#e7dfcd', wainscot: '#ccd2c0', rail: '#b38d60',
  frame: '#b7bcbb', sill: '#ddd8cb', curtain: '#e9d8b2', curtainDark: '#d6c08f', cornice: '#d2cab6',
  steel: '#8b969b', steelDark: '#646e73', panel: '#5b7384',
  helmet: '#f7f6f0', glove: '#efe9d6', cuff: '#d8a838', shoe: '#2e3135', lens: '#a3c4d4', lensFrame: '#2f3438',
  yellow: '#e2bf38', black: '#2c2c2a', white: '#f4f4ef',
  table: '#f2f0e9', leg: '#a0a6aa', card: '#fbfbf7', cardCase: '#6b4a32',
  board: '#fbfbf8', marker: '#2f4f8f', markerRed: '#c0392b',
  door: '#bf9563', doorFrame: '#8d7a62', lever: '#c9cdcf', kick: '#c5c9c8',
  slat: '#e8e1cf', roomLight: '#fff3d8', frosted: '#eef1ee',
  vinyl: '#4b6286', pipe: '#c6cacd',                 // パイプ椅子の座面は青（講堂の赤い客席と見分ける）
  cork: '#c39b64', paper: ['#fbfaf4', '#f3eedc', '#e3edf4', '#f6e6dc'],
  wood: '#c29a68', pot: '#d8d2c4', plant: '#4f8a4a', plantDark: '#3c6e3a',
  cone: '#ee7a2a', coneBand: '#f4f2ea', red: '#c8352b', hose: '#26292c',
  guideA: '#4a7bc4', guideB: '#5a9f70', plateBar: '#4f78a8',
};
// 窓の外（春の朝）。光の計算をしない材質で描くので、面の向きの陰は色に焼き込む
const OUT = {
  sky: '#bfe0f4', cloud: '#f7f9fb', hill: '#a3c2ab', hillFar: '#b7cdc6',
  bldg: '#efe9de', bldgWin: '#a7bfcc', roof: '#9aa4a8',
  lawn: '#a9c97f', path: '#ddd3bd', leaf: '#9cc96e',
  trunk: '#5c4636', blossom: ['#f6c9d5', '#f0b4c6', '#fadde5', '#eebdcc'],
};
// 色の変わる灯り
const LAMP = { off: '#5b4d40', on: '#ffb444' };                      // 面談室の扉の上の呼出灯
const BOARD = { off: '#3b403b', done: '#7f7342', on: '#ffe07a' };    // 呼出表示盤（番号は描かず、灯りの位置だけ）
const SIG = [                                                        // 指差呼称の練習用の信号（左から青・黄・赤）
  { on: '#3ce68e', off: '#21402f' }, { on: '#ffd23c', off: '#4a4122' }, { on: '#ff4f3c', off: '#4a221d' },
];
const CALL_ORDER = [1, 3, 0, 2, 4, 1, 0, 3];                         // 呼ばれる扉の順（まばらに見せる）

// 床に描く模様の天面の高さ。帯の上に置けるのは y=0.02〜0.16 の薄い箱だけ。
// 色の違う模様が同じ高さで重なると点滅するので、重なりうる物は段を分ける。
const L1 = 0.03;   // 市松・継ぎ目
const L2 = 0.06;   // 壁ぎわの見切り・机の下の陰
const L4 = 0.12;   // 区画線・誘導線・待機位置の枠
const L5 = 0.15;   // 足形・誘導線の枝・境目の金物

// ===== 動かす物（build のたびに作り直す。前の章の参照を残さない）=====
let lampMesh = null;          // 色だけ差し替える灯りを1つのメッシュにまとめたもの
let doorLamps = [], boardLamps = [], signalLamps = [];
let clocks = [];              // 掛け時計の針 {h, m, s}
let lampKey = '';

// ===== 道具 =====
// 箱以外の形（ヘルメット・コーン・消火器・時計の文字盤）や、光る物・窓ガラス・灯りを、
// 材質ごとに1つのメッシュへまとめる（boxBatch と同じ頂点カラー方式。描画は1回で済む）。
// shade を付けた物は、面の向きで色を落として焼き込む（光の計算をしない材質でも形が読めるように）。
function meshBatch() {
  const parts = [];
  const api = {
    geo(g, color, x, y, z, o = {}) {
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      parts.push([g, color, o.shade || false]);
      return parts.length - 1;
    },
    box(w, h, d, color, x, y, z, o) { return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    done(material, { receive = true, dynamic = false } = {}) {
      if (!parts.length) { material.dispose(); return null; }
      const pos = [], nor = [], col = [], idx = [], ranges = [];
      const c = new THREE.Color();
      for (const [g, color, shade] of parts) {
        c.set(color);
        const base = pos.length / 3;
        const P = g.attributes.position, N = g.attributes.normal;
        for (let i = 0; i < P.count; i++) {
          const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
          pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(nx, ny, nz);
          let k = 1;
          if (shade === 'soft') k = 0.76 + 0.24 * ny + 0.04 * nz;                      // 丸い物（樹冠）はなだらかに
          else if (shade) k = ny > 0.5 ? 1 : ny < -0.5 ? 0.62 : (Math.abs(nz) >= Math.abs(nx) ? 0.9 : 0.8);
          col.push(c.r * k, c.g * k, c.b * k);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.array[i]);
        else for (let i = 0; i < P.count; i++) idx.push(base + i);
        ranges.push([base, P.count]);
        g.dispose();
      }
      parts.length = 0;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      const ca = new THREE.Float32BufferAttribute(col, 3);
      if (dynamic) ca.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('color', ca);
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, material);
      m.castShadow = false; m.receiveShadow = receive;
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.userData.ranges = ranges;
      addScenery(m);
      return m;
    },
  };
  return api;
}

const tmpC = new THREE.Color();
function setLamp(i, color) {
  const r = lampMesh && lampMesh.userData.ranges[i];
  if (!r) return;
  const a = lampMesh.geometry.attributes.color;
  tmpC.set(color);
  for (let v = r[0]; v < r[0] + r[1]; v++) a.setXYZ(v, tmpC.r, tmpC.g, tmpC.b);
  a.needsUpdate = true;
}

// 床の模様。下半分は床に埋まり、天面だけが top の高さに出る
function flat(b, w, d, color, x, z, top) { b.box(w, top * 2, d, color, x, 0, z); }

// 足形1組。dx, dz はつま先の向き（どちらか一方が ±1）
function feet(b, x, z, dx, dz, color) {
  const along = dx !== 0;
  for (const s of [-0.8, 0.8]) {
    const fx = along ? x : x + s, fz = along ? z + s : z;
    flat(b, along ? 1.8 : 0.72, along ? 0.72 : 1.8, color, fx, fz, L5);                       // 足の裏
    flat(b, along ? 0.8 : 0.92, along ? 0.92 : 0.8, color, fx + dx * 0.55, fz + dz * 0.55, L5); // つま先側を広く
  }
}

// 実習場と廊下の境目（ワールド x）。この場面を使う2つの区間のちょうどあいだ（寮の区間）に置くと、
// どちらの区間からも境目は画面の端にしか入らない。章データが無いとき（場面を強制した確認など）は割合で決める。
function boundaryX(data, W) {
  const segs = (data && data.scenes3d) || [];
  const mine = [];
  segs.forEach((s, i) => {
    if (s.scene === KEY) mine.push([s.x, i + 1 < segs.length ? segs[i + 1].x : data.width]);
  });
  if (mine.length >= 2) return wx((mine[0][1] + mine[1][0]) / 2);
  return W * 0.59;
}

// ===== 場面 =====
export function build(W, halfD, ctx = {}) {
  lampMesh = null; doorLamps = []; boardLamps = []; signalLamps = []; clocks = []; lampKey = '';
  const { BACK, FRONT } = zones(halfD, 36, 74);
  const X0 = -40, X1 = W + 40;
  const B = boundaryX(ctx && ctx.data, W);

  // 春の朝。蛍光灯の白より少し暖かく、明るく
  setLighting(false);
  hemi.color.set(0xfff1dc); hemi.groundColor.set(0xa49a84); hemi.intensity = 2.2;
  sun.color.set(0xffe2b6); sun.intensity = 1.1;
  fill.intensity = 1.0;
  scene.background = hex(C.wall);
  scene.fog = new THREE.Fog(hex(C.haze), 330, 1000);

  const doors = [];
  for (let d = B + 30; d < X1 - 6; d += 58) doors.push(d);
  const K = {
    b: boxBatch(), sh: meshBatch(), glow: meshBatch(), glass: meshBatch(), lamp: meshBatch(),
    W, BACK, FRONT, X0, X1, B, doors,
  };

  buildFloor(K);
  buildBackWall(K);
  ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  buildHallBack(K);
  buildCorridorBack(K);
  buildHallFront(K);
  buildCorridorFront(K);
  buildOutside(K);

  K.b.done();
  K.sh.done(new THREE.MeshLambertMaterial({ vertexColors: true }));
  K.glow.done(new THREE.MeshBasicMaterial({ vertexColors: true }), { receive: false });
  K.glass.done(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false }),
    { receive: false });
  lampMesh = K.lamp.done(new THREE.MeshBasicMaterial({ vertexColors: true }), { receive: false, dynamic: true });
  onEvent('tick', { t: 0 });
}

// 出来事。この場面が張られている間に届くのは毎フレームの tick だけ（ボス戦は講堂に移る）。
//  ・面談室の扉の上の呼出灯が、7秒ごとに別の扉で点く（点いた直後は少し点滅）。表示盤の灯りも1つ進む
//  ・実習場の練習用の信号が 赤 → 青 → 黄 と変わる（指差呼称の「信号よし！」の相手）
//  ・掛け時計の秒針が回る
export function onEvent(name, arg) {
  if (name !== 'tick') return;
  const t = (arg && arg.t) || 0;
  if (clocks.length) {
    const sec = t % 60, min = 40 + t / 60, hr = 9 + min / 60;
    for (const c of clocks) {
      c.s.rotation.z = -(sec / 60) * Math.PI * 2;
      c.m.rotation.z = -((min % 60) / 60) * Math.PI * 2;
      c.h.rotation.z = -((hr % 12) / 12) * Math.PI * 2;
    }
  }
  if (!lampMesh) return;
  const n = Math.floor(t / 7), ph = t - n * 7;
  const called = doorLamps.length ? CALL_ORDER[n % CALL_ORDER.length] % doorLamps.length : -1;
  const blink = ph < 1.3 && Math.floor(ph * 5) % 2 === 1;
  const cell = boardLamps.length ? n % boardLamps.length : -1;
  const cyc = t % 9, sig = cyc < 3.6 ? 2 : cyc < 7.8 ? 0 : 1;
  const key = `${called}|${blink}|${cell}|${sig}`;
  if (key === lampKey) return;
  lampKey = key;
  doorLamps.forEach((idx, i) => setLamp(idx, i === called && !blink ? LAMP.on : LAMP.off));
  boardLamps.forEach((idx, i) => setLamp(idx, i === cell ? BOARD.on : i < cell ? BOARD.done : BOARD.off));
  signalLamps.forEach((idx, i) => setLamp(idx, i === sig ? SIG[i].on : SIG[i].off));
}

// ===== 床 =====
function buildFloor(K) {
  const { b, BACK, FRONT, X0, X1, B, doors } = K;
  // 床の模様は床の手前端まで敷く（自機が帯の手前端にいると、画面の下端は z≈93 まで来る）
  const ZF = FRONT;
  b.box(X1 - X0, 2, FRONT - BACK, C.floor, (X0 + X1) / 2, -1, (FRONT + BACK) / 2);

  // --- 実習場: 大判タイルの市松（ごく淡く）---
  const T = 8;
  for (let i = 0, x = X0; x < B; x += T, i++) {
    const w = Math.min(T, B - x);
    for (let j = 0, z = BACK; z < ZF; z += T, j++) {
      if ((i + j) % 2) flat(b, w, T, C.floorAlt, x + w / 2, z + T / 2, L1);
    }
  }
  // 区画線（黄）: 歩く所と作業する所の境。工場と同じ引き方
  for (const z of [-27, 27]) flat(b, B - 1 - X0, 0.9, C.yellow, (X0 + B - 1) / 2, z, L4);
  // 歩行者通路: 白線2本と、歩く向きの足形
  for (const z of [-10.5, 10.5]) flat(b, B - 1 - X0, 0.5, C.white, (X0 + B - 1) / 2, z, L4);
  for (let x = X0 + 24; x < B - 12; x += 40) feet(b, x, 0, 1, 0, C.white);
  // 指差呼称の練習線（奥ゾーン）: 白い線に、整列して立つ足形が等間隔に並ぶ。正面の壁ぎわが指差す相手
  const p0 = B - 128, p1 = B - 8;
  flat(b, p1 - p0, 0.7, C.white, (p0 + p1) / 2, -33, L4);
  for (let x = p0 + 5; x < p1 - 2; x += 9.5) feet(b, x, -30.4, 0, -1, C.yellow);

  // --- 廊下: 長尺シートの継ぎ目と、壁ぎわの見切り ---
  for (let z = BACK + 7; z < ZF; z += 12) flat(b, X1 - B, 0.22, C.seam, (B + X1) / 2, z, L1);
  flat(b, X1 - B, 2.2, C.border, (B + X1) / 2, BACK + 1.1, L2);
  // 誘導線（青と緑）。面談室の扉の前まで枝が伸びる（文字の代わりに色で行き先を示す）
  const gz = [-15.2, -13.9], gc = [C.guideA, C.guideB];
  for (let k = 0; k < 2; k++) flat(b, X1 - B - 8, 0.6, gc[k], (B + 8 + X1) / 2, gz[k], L4);
  doors.forEach((d, i) => {
    const k = i % 2, z1 = BACK + 12.4;
    // 枝の付け根は本線の上に重ねる。緑の枝は青の本線をまたぐので段を上げる
    flat(b, 0.6, gz[k] + 0.3 - z1, gc[k], d - 4.6, (gz[k] + 0.3 + z1) / 2, k ? L5 : L4);
    // 待機位置（扉の前）: 黄色の枠と白い足形
    const mz = BACK + 9.6;
    flat(b, 8, 0.45, C.yellow, d, mz - 1.8, L4);
    flat(b, 8, 0.45, C.yellow, d, mz + 1.8, L4);
    flat(b, 0.45, 3.15, C.yellow, d - 3.78, mz, L4);
    flat(b, 0.45, 3.15, C.yellow, d + 3.78, mz, L4);
    feet(b, d, mz, 0, -1, C.white);
  });
  // 境目の金物（実習場の市松と廊下のシートの見切り）
  flat(b, 1.2, ZF - BACK, '#9aa3a6', B, (BACK + ZF) / 2, L5);
}

// ===== 奥の壁 =====
// 実習場（x < B）: 腰壁＋連窓。窓は本物の開口にして、外の春を見せる。
// 廊下（x > B）: 開口の無い壁に、実習室（今日は面談室）の扉と窓が並ぶ。
const WB = 18, WT = 35, WW = 34, WP = 44;
function buildBackWall(K) {
  const { b, BACK, X0, X1, B } = K;
  b.box(B - X0, WB, 2, C.wall, (X0 + B) / 2, WB / 2, BACK - 1);                       // 腰壁
  b.box(B - X0, 64 - WT, 2, C.wall, (X0 + B) / 2, (64 + WT) / 2, BACK - 1);           // 垂れ壁
  const wins = [];
  for (let cx = B - 30; cx - WW / 2 > X0; cx -= WP) wins.push(cx);
  wins.sort((a, c) => a - c);
  let px = X0;
  for (const cx of wins) {                                                             // 方立（窓と窓の間）
    const l = cx - WW / 2;
    if (l > px) b.box(l - px, WT - WB, 2, C.wall, (px + l) / 2, (WB + WT) / 2, BACK - 1);
    px = cx + WW / 2;
  }
  if (B > px) b.box(B - px, WT - WB, 2, C.wall, (px + B) / 2, (WB + WT) / 2, BACK - 1);
  for (const cx of wins) hallWindow(K, cx);

  b.box(X1 - B, 64, 2, C.wall, (B + X1) / 2, 32, BACK - 1);                           // 廊下の壁
  b.box(X1 - X0, 1.2, 0.6, C.base, (X0 + X1) / 2, 0.6, BACK + 0.3);                    // 巾木（通し）
  b.box(7, 64, 3.2, C.pilaster, B, 32, BACK + 1.6, { cast: true });                    // 境目の柱型
}

function hallWindow(K, cx) {
  const { b, glass, BACK } = K;
  const zc = BACK - 0.9, my = (WB + WT) / 2;
  b.box(WW, 1.2, 1.4, C.frame, cx, WT - 0.6, zc);                                      // 上枠
  b.box(WW, 1.2, 1.4, C.frame, cx, WB + 0.6, zc);                                      // 下枠
  b.box(1.2, WT - WB - 2.4, 1.4, C.frame, cx - WW / 2 + 0.6, my, zc);                  // 縦枠
  b.box(1.2, WT - WB - 2.4, 1.4, C.frame, cx + WW / 2 - 0.6, my, zc);
  b.box(1.0, WT - WB - 2.4, 1.3, C.frame, cx, my, zc);                                 // 召し合わせ
  b.box(WW - 2.4, 0.9, 1.3, C.frame, cx, WB + 11.5, zc);                               // 無目（欄間との境）
  b.box(WW + 3, 0.6, 2.6, C.sill, cx, WB - 0.2, BACK + 0.3);                           // 窓台
  glass.box(WW - 2.4, WT - WB - 2.4, 0.2, '#e4f1f8', cx, my, BACK - 1.7);
  // 生成りのカーテン。左右に束ねてある
  for (const s of [-1, 1]) {
    const x = cx + s * (WW / 2 - 1.2);
    b.box(3.4, WT - WB + 2, 1.2, C.curtain, x, my + 0.6, BACK + 2.4);
    b.box(1.0, WT - WB + 1.4, 1.2, C.curtainDark, x - s * 1.0, my + 0.6, BACK + 2.7);  // ひだの陰
  }
  b.box(WW + 6, 1.0, 1.4, C.cornice, cx, WT + 1.8, BACK + 2.2);                        // カーテンボックス
}

// ===== 実習場の奥ゾーン =====
function buildHallBack(K) {
  const { BACK, B } = K;
  // ---- ビジネスマナー研修（左）----
  for (const x of [B - 254, B - 241, B - 228]) mirror(K, x, BACK + 9);                // 身だしなみの姿見（同じ物が3台）
  seatChart(K, B - 192);                                                              // 席次の図を描いた白板
  for (const x of [B - 186, B - 164]) cardTable(K, x, -41.5, true);                   // 名刺交換の練習机（低い）
  // ---- 安全衛生講習（右）----
  for (const x of [B - 121, B - 103, B - 85]) ppeCabinet(K, x);                       // 保護具の展示棚
  toolBoard(K, B - 62);                                                               // 5S の姿置き（掃除道具の定位置）
  gaugePipe(K, B - 50, B - 26);                                                       // 指差呼称の相手: バルブと圧力計
  signalPost(K, B - 14, BACK + 12);                                                   // 指差呼称の相手: 信号
  // 壁: 方立の時計と 5S の掲示、吊り下げの区画札
  clock(K, B - 140, 27, BACK);
  poster5S(K, B - 52);
  hangSign(K, B - 205, -40, '#4a74b8');
  hangSign(K, B - 82, -40, '#3e9a5e');
}

// 身だしなみの姿見（キャスター付き）
function mirror(K, x, z) {
  const { b, glow } = K;
  const o = { cast: true };
  b.box(6.6, 16.6, 0.8, C.frame, x, 10.6, z, o);                                      // 枠（y 2.3〜18.9）
  glow.box(5.8, 15.8, 0.2, '#dce7eb', x, 10.6, z + 0.5);                              // 鏡面
  glow.box(0.6, 7.5, 0.1, '#ffffff', x - 0.8, 12.2, z + 0.65, { rz: 0.55 });          // 映り込み
  glow.box(0.35, 4.5, 0.1, '#ffffff', x + 0.6, 10.4, z + 0.65, { rz: 0.55 });
  for (const s of [-1, 1]) {
    b.box(0.7, 2.4, 0.7, C.steel, x + s * 2.6, 1.15, z, o);                           // 支柱
    b.box(0.9, 0.6, 5.4, C.steel, x + s * 2.6, 0.75, z, o);                           // 脚
    for (const t of [-1, 1]) b.box(0.7, 0.75, 0.7, '#3a3d40', x + s * 2.6, 0.375, z + t * 2.2);    // キャスター
  }
}

// 席次（上座・下座）の図を描いた白板。机の輪郭と席の四角だけ、上座の席が赤い
function seatChart(K, x) {
  const { b, BACK } = K;
  const zf = BACK + 0.8;                                                              // 白板の面
  b.box(27, 12, 0.5, C.frame, x, 10, BACK + 0.25);                                    // 枠（y 4〜16）
  b.box(25.6, 10.6, 0.3, C.board, x, 10, BACK + 0.65);
  b.box(25.6, 0.7, 1.6, C.frame, x, 4.4, BACK + 1.3);                                 // ペン受け
  b.box(3.6, 0.5, 0.6, C.marker, x - 8, 5.0, BACK + 1.6);
  b.box(3.6, 0.5, 0.6, C.markerRed, x - 3.5, 5.0, BACK + 1.6);
  // 机（長方形の輪郭）
  const tx = x - 4, ty = 10.4, tw = 9, th = 3.4, lw = 0.32, m = C.marker;
  b.box(tw, lw, 0.1, m, tx, ty + th / 2, zf + 0.05);
  b.box(tw, lw, 0.1, m, tx, ty - th / 2, zf + 0.05);
  b.box(lw, th, 0.1, m, tx - tw / 2, ty, zf + 0.05);
  b.box(lw, th, 0.1, m, tx + tw / 2, ty, zf + 0.05);
  // 席
  for (let i = 0; i < 3; i++) {
    b.box(1.3, 1.3, 0.1, m, tx - 3 + i * 3, ty + th / 2 + 1.5, zf + 0.05);
    b.box(1.3, 1.3, 0.1, m, tx - 3 + i * 3, ty - th / 2 - 1.5, zf + 0.05);
  }
  b.box(1.3, 1.3, 0.1, C.markerRed, tx - tw / 2 - 1.6, ty, zf + 0.05);                // 上座
  b.box(1.3, 1.3, 0.1, m, tx + tw / 2 + 1.6, ty, zf + 0.05);
  // 右側: お辞儀の角度（縦の線から、線を3本扇に開く）
  const px = x + 7.5, py = 6.4, len = 6.2;
  b.box(lw, len, 0.1, m, px, py + len / 2, zf + 0.05);
  [0.26, 0.52, 0.79].forEach((a, i) => {
    K.sh.box(lw, len, 0.1, i === 2 ? C.markerRed : m,
      px + Math.sin(a) * len / 2, py + Math.cos(a) * len / 2, zf + 0.07 + i * 0.02, { rz: -a });
  });
}

// 名刺交換の練習机（低い）。向かい合って立つ位置に足形
function cardTable(K, x, z, back) {
  const { b } = K;
  const o = back ? { cast: true } : {};
  b.box(13, 0.6, 6.4, C.table, x, 6.4, z, o);                                         // 天板（y 6.1〜6.7）
  for (const [dx, dz] of [[-5.9, -2.6], [5.9, -2.6], [-5.9, 2.6], [5.9, 2.6]]) {
    b.box(0.5, 6.1, 0.5, C.leg, x + dx, 3.05, z + dz, o);
  }
  for (const s of [-1, 1]) {
    b.box(11.3, 0.4, 0.4, C.leg, x, 1.4, z + s * 2.6);                                // 貫
    b.box(2.0, 0.35, 1.2, C.cardCase, x + s * 3.0, 6.88, z + s * 1.5);                // 名刺入れ
    b.box(1.5, 0.25, 0.9, C.card, x - s * 1.4, 6.83, z + s * 1.7);                    // 名刺
  }
  feet(b, x, z - 6.4, 0, 1, C.yellow);
  feet(b, x, z + 6.4, 0, -1, C.yellow);
}

// 保護具の展示棚。上段に白いヘルメット（全員同じ）、中段に保護眼鏡、下段に軍手と安全靴
function ppeCabinet(K, x) {
  const { b, sh, BACK } = K;
  const D = 5.6, zc = BACK + D / 2, H = 14.4, o = { cast: true };
  b.box(16.2, H - 0.8, 0.4, C.panel, x, H / 2, BACK + 0.3);                           // 背板
  for (const s of [-1, 1]) b.box(0.6, H, D, C.steel, x + s * 8.2, H / 2, zc, o);      // 側板
  b.box(17, 0.6, D, C.steel, x, H - 0.3, zc, o);                                      // 天板
  b.box(15.8, 1.6, D - 0.2, C.steelDark, x, 0.8, zc, o);                              // 台輪
  for (const y of [5.4, 9.9]) b.box(15.8, 0.4, D - 0.4, C.steel, x, y, zc - 0.1, o);  // 棚板
  b.box(17.4, 1.6, 0.3, C.white, x, 15.6, BACK + 0.15);                               // 棚の札（無地）
  b.box(12, 0.5, 0.2, '#3e9a5e', x, 15.6, BACK + 0.4);
  for (let i = 0; i < 4; i++) helmet(sh, x - 5.7 + i * 3.8, 10.1, zc + 0.2);
  for (let i = 0; i < 4; i++) {
    const gx = x - 5.7 + i * 3.8;
    b.box(2.8, 1.0, 0.25, C.lens, gx, 6.15, zc + 1.6);                                // 保護眼鏡のレンズ
    b.box(3.0, 0.35, 0.4, C.lensFrame, gx, 6.8, zc + 1.6);
    b.box(0.3, 0.3, 2.2, C.lensFrame, gx - 1.35, 6.8, zc + 0.4);                      // つる
    b.box(0.3, 0.3, 2.2, C.lensFrame, gx + 1.35, 6.8, zc + 0.4);
  }
  for (let i = 0; i < 2; i++) {                                                       // 軍手（2組）
    const gx = x - 5.4 + i * 4.2;
    for (const s of [-0.75, 0.75]) {
      b.box(1.2, 2.5, 0.5, C.glove, gx + s, 2.85, zc + 1.2);
      b.box(1.3, 0.6, 0.6, C.cuff, gx + s, 1.9, zc + 1.2);
    }
  }
  for (const s of [-0.85, 0.85]) {                                                    // 安全靴（1足）
    b.box(1.4, 1.4, 3.2, C.shoe, x + 4.6 + s, 2.3, zc + 0.6);
    b.box(1.5, 0.5, 1.0, '#555a5e', x + 4.6 + s, 1.85, zc + 1.8);
  }
}

function helmet(sh, x, y, z) {
  sh.geo(new THREE.SphereGeometry(1.6, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), C.helmet, x, y, z);
  sh.geo(new THREE.CylinderGeometry(1.95, 1.95, 0.22, 14), C.helmet, x, y + 0.11, z + 0.25);   // つば
  sh.box(0.45, 0.5, 2.7, '#ecebe4', x, y + 1.45, z);                                            // 中央の筋
}

// 5S の姿置き: 掃除道具の形を描いた板に、道具がその形どおりに掛かっている。1本だけ出払って形だけ残る
function toolBoard(K, x) {
  const { b, BACK } = K;
  b.box(15, 12, 0.4, '#f1efe6', x, 9, BACK + 0.2);                                    // 板（y 3〜15）
  // 柄と頭は重なるので、頭を少し手前に出す（同じ面に色違いが重なると点滅する）
  const tool = (tx, w, h, y, color, dz = 0) => {
    b.box(w + 0.7, h + 0.7, 0.1, '#6a6f70', tx, y, BACK + 0.45);                      // 姿（形の縁取り）
    if (color) b.box(w, h, 0.4, color, tx, y, BACK + 0.7 + dz);
  };
  tool(x - 5.2, 0.5, 8.5, 9.6, '#b07a3c'); tool(x - 5.2, 3.4, 1.6, 4.9, '#6b8f4a', 0.15);   // ほうき（柄と穂）
  tool(x - 1.6, 0.5, 8.5, 9.6, null); tool(x - 1.6, 3.4, 1.6, 4.9, null);                   // 出払ったほうき
  tool(x + 2.4, 3.2, 2.8, 11.6, '#3f6fb0'); tool(x + 2.4, 0.5, 3.2, 8.6, '#3f6fb0');          // ちりとり
  tool(x + 5.6, 0.5, 9, 9.2, '#c9cdcf'); tool(x + 5.6, 2.6, 2.2, 4.5, '#e8e4d8', 0.15);       // モップ
}

// 指差呼称の相手その1: 壁ぎわの配管に、赤いバルブと圧力計
function gaugePipe(K, x0, x1) {
  const { b, sh, BACK } = K;
  const z = BACK + 1.6;
  sh.geo(new THREE.CylinderGeometry(0.55, 0.55, x1 - x0, 10), '#9aa3a8', (x0 + x1) / 2, 7.2, z, { rz: Math.PI / 2 });
  for (const x of [x0 + 1, x1 - 1]) b.box(1.4, 1.6, 1.6, '#7d868b', x, 7.2, BACK + 0.8);   // 支持金物
  const vx = x0 + 7;                                                                   // バルブ
  sh.geo(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 8), '#7d868b', vx, 8.7, z);
  sh.geo(new THREE.TorusGeometry(1.5, 0.3, 6, 14), C.red, vx, 10.2, z + 0.5);
  b.box(2.6, 0.35, 0.3, C.red, vx, 10.2, z + 0.5);
  const gx = x0 + 17, gy = 12.4;                                                      // 圧力計
  sh.geo(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 8), '#7d868b', gx, 9.5, z);
  sh.geo(new THREE.CylinderGeometry(2.1, 2.1, 0.7, 18), '#3a3f43', gx, gy, z + 0.35, { rx: Math.PI / 2 });
  sh.geo(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 18), C.white, gx, gy, z + 0.75, { rx: Math.PI / 2 });
  sh.box(1.1, 0.5, 0.1, '#3ca066', gx + 0.9, gy + 0.9, z + 0.95, { rz: -0.8 });        // 緑の範囲
  sh.box(1.1, 0.5, 0.1, C.red, gx + 1.2, gy - 0.4, z + 0.95, { rz: 0.4 });             // 赤の範囲
  sh.geo(new THREE.BoxGeometry(0.22, 1.5, 0.1).translate(0, 0.6, 0), '#222628', gx, gy, z + 1.0, { rz: -0.45 });  // 針
}

// 指差呼称の相手その2: 信号（灯りは onEvent が替える）
function signalPost(K, x, z) {
  const { b, lamp } = K;
  const o = { cast: true }, dark = '#2b2f33';
  b.box(4.4, 0.8, 4.4, '#4a4f53', x, 0.4, z, o);
  b.box(0.9, 13.2, 0.9, C.steel, x, 7.4, z, o);                                       // 柱
  b.box(8.2, 2.8, 1.8, dark, x, 15.2, z, o);                                          // 灯器（y 13.8〜16.6）
  for (let i = 0; i < 3; i++) {
    const lx = x - 2.6 + i * 2.6;
    b.box(2.3, 0.4, 1.3, dark, lx, 16.45, z + 1.5);                                   // ひさし
    signalLamps.push(lamp.box(1.9, 1.9, 0.3, SIG[i].off, lx, 15.1, z + 1.05));
  }
}

// 掛け時計。文字盤と縁はまとめ描き、針だけ別のメッシュ（onEvent が回す）
function clock(K, x, y, z) {
  const { sh } = K;
  sh.geo(new THREE.CylinderGeometry(2.9, 2.9, 0.6, 22), '#4a4f53', x, y, z + 0.3, { rx: Math.PI / 2 });
  sh.geo(new THREE.CylinderGeometry(2.55, 2.55, 0.3, 22), C.white, x, y, z + 0.65, { rx: Math.PI / 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
    sh.box(big ? 0.32 : 0.18, big ? 0.7 : 0.4, 0.1, '#33373a', x + Math.sin(a) * 2.1, y + Math.cos(a) * 2.1, z + 0.85, { rz: -a });
  }
  const hand = (w, L, color, dz) => {
    const g = new THREE.BoxGeometry(w, L, 0.12);
    g.translate(0, L / 2 - 0.35, 0);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: hex(color) }));
    m.position.set(x, y, z + dz);
    addScenery(m);
    return m;
  };
  clocks.push({ h: hand(0.42, 1.55, '#2b2e31', 0.95), m: hand(0.3, 2.15, '#2b2e31', 1.07), s: hand(0.12, 2.25, '#c0392b', 1.19) });
}

// 5S の掲示（方立に貼る）。5つの色の四角が縦に並ぶだけ
function poster5S(K, x) {
  const { b, BACK } = K;
  b.box(7.2, 10, 0.25, C.white, x, 25, BACK + 0.125);
  const cs = ['#d8483c', '#e08a2e', '#d9b63a', '#49a35c', '#3f7fc0'];
  cs.forEach((c, i) => b.box(2.0, 1.4, 0.15, c, x - 1.6, 28.6 - i * 1.8, BACK + 0.32));
  for (let i = 0; i < 5; i++) b.box(2.4, 0.5, 0.15, '#c9c6bb', x + 1.4, 28.6 - i * 1.8, BACK + 0.32);
}

// 天井から吊った区画札（無地の板＋色の棒）
function hangSign(K, x, z, bar) {
  const { b } = K;
  for (const s of [-1, 1]) b.box(0.3, 8, 0.3, '#9aa0a3', x + s * 5, 42, z);
  b.box(14, 4.6, 0.6, C.white, x, 36, z);
  b.box(10, 1.0, 0.2, bar, x, 36, z + 0.4);
}

// ===== 廊下の奥ゾーン =====
// 1部屋ぶんの並び（扉の中心 d から）: 扉 → 室名札 → 窓（ブラインド）とその前のパイプ椅子4脚 → 方立
function buildCorridorBack(K) {
  const { b, BACK, B, X1, doors } = K;
  // 腰壁と手すり（椅子の背が当たる高さ）。扉のところで切る
  const segs = [];
  let px = B + 3.5;
  for (const d of doors) { segs.push([px, d - 6]); px = d + 6; }
  segs.push([px, X1]);
  for (const [a, c] of segs) {
    if (c <= a) continue;
    b.box(c - a, 8.9, 0.4, C.wainscot, (a + c) / 2, 4.45, BACK + 0.2);
    b.box(c - a, 1.0, 1.2, C.rail, (a + c) / 2, 9.4, BACK + 0.6);
  }
  doors.forEach((d, i) => {
    door(K, d);
    const wx0 = d + 14, wx1 = d + 44;
    if (wx1 > X1 - 2) return;
    if (i === 2) {
      noticeBoard(K, d + 29, 17.4);
      hydrant(K, d + 48);
    } else {
      blindWindow(K, wx0, wx1);
    }
    for (let k = 0; k < 4; k++) {
      pipeChair(K, d + 20 + k * 6, BACK + 4.0, 1, true);
      if ((i + k) % 4 === 1) b.box(2.6, 0.35, 3.4, '#c8a774', d + 20 + k * 6 - 0.2, 5.05, BACK + 4.5);  // 置いていった封筒
    }
    if (i === 0) callBoard(K, d + 29, 28.6);
    if (i === 1) clock(K, d, 29.6, BACK);
  });
  reception(K, B + 15, -44);
  b.box(10, 6.4, 0.3, C.white, B + 14, 17.4, BACK + 0.15);                            // 受付の案内板（無地）
  b.box(7, 1.0, 0.2, '#d0883e', B + 14, 19.2, BACK + 0.4);
  plant(K, B + 79, BACK + 4.6);
  hangSign(K, B + 52, -40, '#d0883e');
}

function door(K, d) {
  const { b, glow, lamp, BACK } = K;
  b.box(12, 22, 0.8, C.doorFrame, d, 11, BACK + 0.4);                                 // 枠
  b.box(10, 20.8, 0.5, C.door, d, 10.6, BACK + 1.05);                                 // 扉（閉じている）
  glow.box(1.6, 6.5, 0.2, C.frosted, d + 2.6, 14.4, BACK + 1.4);                      // 細い覗き窓（すりガラス）
  b.box(2.2, 0.5, 0.7, C.lever, d - 3.3, 10.2, BACK + 1.65);                          // レバー
  b.box(0.6, 1.3, 0.4, C.lever, d - 4.2, 10.2, BACK + 1.5);
  b.box(9.6, 2.0, 0.2, C.kick, d, 1.3, BACK + 1.38);                                  // 蹴り板
  b.box(3.2, 1.8, 0.6, '#5d6366', d, 23.6, BACK + 0.3);                               // 呼出灯の台
  doorLamps.push(lamp.box(2.4, 1.1, 0.5, LAMP.off, d, 23.6, BACK + 0.85));
  b.box(5.2, 1.9, 0.3, C.white, d + 9, 18.6, BACK + 0.15);                            // 室名札（無地）
  b.box(3.6, 0.5, 0.2, C.plateBar, d + 9, 18.6, BACK + 0.4);
}

// ブラインドを下ろした実習室の窓。羽根の隙間から部屋の明かりが漏れる
function blindWindow(K, x0, x1) {
  const { b, glow, BACK } = K;
  const cx = (x0 + x1) / 2, w = x1 - x0, y0 = 12.4, y1 = 24.4, cy = (y0 + y1) / 2;
  b.box(w + 1.6, y1 - y0 + 1.6, 0.5, C.frame, cx, cy, BACK + 0.25);
  glow.box(w, y1 - y0, 0.2, C.roomLight, cx, cy, BACK + 0.62);
  for (let y = y0 + 0.55; y < y1 - 0.3; y += 1.15) b.box(w - 0.2, 0.8, 0.25, C.slat, cx, y, BACK + 0.93);
  b.box(1.0, y1 - y0, 0.4, C.frame, cx, cy, BACK + 1.25);                             // 中央の方立
  b.box(w + 0.6, 1.0, 1.1, C.frame, cx, y1 + 0.2, BACK + 0.75);                       // ヘッドレール
  b.box(w + 2.4, 0.6, 2.0, C.sill, cx, y0 - 1.0, BACK + 1.0);                         // 窓台
}

// パイプ椅子。dir=+1 で手前（カメラ）を向き、-1 で奥を向く（背中がこちら）。背に無地の番号札
function pipeChair(K, x, z, dir, cast) {
  const { b } = K;
  const o = cast ? { cast: true } : {}, sy = 4.6;
  b.box(4.6, 0.55, 4.4, C.vinyl, x, sy, z, o);                                        // 座面
  b.box(4.6, 2.8, 0.45, C.vinyl, x, sy + 3.6, z - dir * 2.15, o);                     // 背もたれ
  for (const sx of [-2.0, 2.0]) {
    b.box(0.35, sy, 0.35, C.pipe, x + sx, sy / 2, z + dir * 1.9);                     // 前脚
    b.box(0.35, sy + 4.6, 0.35, C.pipe, x + sx, (sy + 4.6) / 2, z - dir * 2.0);       // 後ろ脚（背もたれまで）
  }
  b.box(3.65, 0.3, 0.3, C.pipe, x, 1.2, z + dir * 1.9);                               // 前の横棒
  // 番号札（無地）。こちらに見える面に付ける
  const tz = dir > 0 ? z - 2.15 + 0.3 : z + 2.15 + 0.3;
  b.box(1.6, 1.1, 0.15, C.white, x, sy + 4.3, tz);
}

// 呼出表示盤。番号は描かず、灯りの位置で「何番まで呼ばれたか」を示す
function callBoard(K, x, y) {
  const { b, lamp, BACK } = K;
  b.box(26, 3.8, 0.8, '#2d3235', x, y, BACK + 0.4);
  for (let i = 0; i < 8; i++) boardLamps.push(lamp.box(2.2, 2.2, 0.3, BOARD.off, x - 9.8 + i * 2.8, y, BACK + 0.95));
}

function noticeBoard(K, x, y) {
  const { b, BACK } = K;
  b.box(29, 11.5, 0.4, C.rail, x, y, BACK + 0.2);
  b.box(27.6, 10.1, 0.5, C.cork, x, y, BACK + 0.25);
  const sheets = [[-9.5, 0.6, 5, 6.6], [-2.6, 0.2, 6, 7.4], [4.4, 1.0, 5, 6], [10.4, -0.6, 4.4, 5.8]];
  sheets.forEach(([dx, dy, w, h], i) => {
    b.box(w, h, 0.15, C.paper[i % C.paper.length], x + dx, y + dy, BACK + 0.58);
    b.box(0.45, 0.45, 0.3, C.red, x + dx, y + dy + h / 2 - 0.6, BACK + 0.75);         // 画鋲
  });
}

function hydrant(K, x) {
  const { b, glow, BACK } = K;
  b.box(6.6, 9.4, 1.8, C.red, x, 12.2, BACK + 0.9);                                   // 消火栓の箱
  b.box(0.3, 8.6, 0.2, '#9e2a22', x, 12.2, BACK + 1.9);                               // 扉の合わせ目
  glow.box(1.9, 1.9, 0.9, '#ff5a3c', x, 18.6, BACK + 0.6);                            // 表示灯（いつも点いている）
}

// 受付の机（白い布を掛けた長机）。番号札の掛け台、名簿、呼び鈴
function reception(K, x, z) {
  const { b, sh } = K;
  const o = { cast: true };
  b.box(18, 0.6, 7, C.table, x, 7.4, z, o);
  b.box(18.4, 6.9, 0.3, C.white, x, 3.65, z + 3.65, o);                               // 白布（前）
  for (const s of [-1, 1]) b.box(0.3, 6.9, 7, C.white, x + s * 9.05, 3.65, z, o);
  b.box(8.4, 5.2, 0.5, C.wood, x - 3.5, 10.3, z - 2.0, o);                            // 番号札の掛け台
  b.box(8.4, 0.5, 2.2, C.wood, x - 3.5, 7.95, z - 1.2);
  const gone = new Set([3, 7, 8, 12]);                                                // 札が出ている（もう呼ばれた／待っている人の分）
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const k = r * 5 + c;
      b.box(0.25, 0.25, 0.3, '#8a6a42', x - 6.3 + c * 1.4, 12.5 - r * 1.65, z - 1.6);  // 掛け釘
      if (!gone.has(k)) b.box(1.1, 1.3, 0.15, C.white, x - 6.3 + c * 1.4, 11.8 - r * 1.65, z - 1.67);
    }
  }
  b.box(5, 0.4, 3.6, C.card, x + 4.5, 7.9, z + 0.6);                                  // 名簿
  b.box(4.6, 0.25, 3.2, '#e9e5d6', x + 4.6, 8.2, z + 0.55);
  sh.geo(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 8), '#3a4a5a', x + 7.6, 8.6, z - 1.6);   // ペン立て
  sh.geo(new THREE.SphereGeometry(0.75, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#c9b26a', x + 1.0, 7.7, z + 1.9);  // 呼び鈴
}

function plant(K, x, z) {
  const { b } = K;
  const o = { cast: true };
  b.box(3.6, 4.0, 3.6, C.pot, x, 2.0, z, o);
  b.box(5.6, 3.6, 5.0, C.plant, x, 6.6, z, o);
  b.box(4.2, 3.6, 4.0, C.plantDark, x + 0.6, 9.6, z - 0.4, o);
  b.box(2.8, 3.0, 2.6, C.plant, x - 0.5, 12.2, z + 0.6, o);
}

// ===== 手前ゾーン（低い物だけ。帯の手前端に立つ人を隠さない）=====
// いちばん引いたカメラ（z=213）から帯の手前端の足元を見る線より下に収まる奥行きに置く。
// 線の高さは 0.33·(z−25)。高さ7前後の物なら z≥46、背もたれ（9.6）なら z≥55 で足に掛からない。
function buildHallFront(K) {
  const { b, sh, B } = K;
  // マナー研修: 名刺交換の練習机（低い）が一列。机の上に研修のテキスト
  for (let x = B - 240, i = 0; x <= B - 150; x += 22, i++) {
    cardTable(K, x, 53, false);
    if (i % 2 === 0) textbooks(b, x - 4.2, 6.7, 53.6, 3 + (i % 3));
  }
  // 安全衛生: 立入禁止の区画（黄と黒の縁取り）をコーンとコーンバーで囲う。中は持ち上げ練習の箱
  const x0 = B - 120, x1 = B - 64, z0 = 46, z1 = 56;
  hazardEdge(b, x0, x1, z0, z1);
  const xm = (x0 + x1) / 2;
  for (const [x, z] of [[x0, z0], [xm, z0], [x1, z0], [x0, z1], [x1, z1]]) cone(K, x, z);
  for (const [a, c] of [[x0, xm], [xm, x1]]) coneBar(b, a, c, z0);
  b.box(10, 1.2, 7, '#a07a48', xm - 8, 0.6, 51.5);                                    // パレット
  b.box(6, 4.2, 5, '#c9a46a', xm - 9, 3.3, 51.5);                                     // 段ボール
  b.box(6.2, 0.4, 1.0, '#b88f55', xm - 9, 5.4, 51.5);
  // 消火器の訓練用（低い台に3本）
  const ex = B - 30, ez = 56;
  b.box(11, 0.8, 4, C.steelDark, ex, 0.4, ez);
  for (let i = -1; i <= 1; i++) extinguisher(sh, b, ex + i * 3.4, ez);
}

// 研修のテキスト（紙の冊子）を平積みにする
function textbooks(b, x, y, z, n) {
  const cs = ['#f2efe4', '#e6e9ee', '#efe6d2'];
  for (let i = 0; i < n; i++) {
    b.box(3.4, 0.42, 2.5, cs[i % cs.length], x + (i % 2) * 0.25, y + 0.21 + i * 0.44, z - (i % 2) * 0.2);
    b.box(3.45, 0.12, 0.6, '#4f78a8', x + (i % 2) * 0.25, y + 0.38 + i * 0.44, z - (i % 2) * 0.2 - 0.6);  // 背の色帯
  }
}

function hazardEdge(b, x0, x1, z0, z1) {
  const seg = 2.2, w = 1.0;
  const run = (len, horiz, fx, fz) => {
    for (let s = 0, k = 0; s < len; s += seg, k++) {
      const l = Math.min(seg, len - s), col = k % 2 ? C.black : C.yellow;
      if (horiz) flat(b, l, w, col, fx + s + l / 2, fz, L4);
      else flat(b, w, l, col, fx, fz + s + l / 2, L4);
    }
  };
  run(x1 - x0, true, x0, z0); run(x1 - x0, true, x0, z1);
  run(z1 - z0 - w, false, x0, z0 + w / 2); run(z1 - z0 - w, false, x1, z0 + w / 2);
}

function cone(K, x, z) {
  const { b, sh } = K;
  b.box(3.6, 0.5, 3.6, C.black, x, 0.25, z);
  sh.geo(new THREE.CylinderGeometry(0.3, 1.5, 6.4, 10), C.cone, x, 3.7, z);
  sh.geo(new THREE.CylinderGeometry(0.88, 1.12, 1.3, 10), C.coneBand, x, 3.4, z);
}

function coneBar(b, a, c, z) {
  const len = c - a, n = Math.max(2, Math.round(len / 3));
  for (let i = 0; i < n; i++) {
    b.box(len / n, 0.6, 0.6, i % 2 ? C.black : C.yellow, a + (i + 0.5) * (len / n), 5.6, z);
  }
}

function extinguisher(sh, b, x, z) {
  sh.geo(new THREE.CylinderGeometry(0.95, 0.95, 5.0, 12), C.red, x, 3.3, z);           // 本体（y 0.8〜5.8）
  sh.geo(new THREE.CylinderGeometry(0.5, 0.95, 0.7, 12), C.red, x, 6.15, z);
  b.box(0.7, 1.0, 0.7, '#2f3336', x, 6.9, z);                                         // 弁
  b.box(1.8, 0.35, 0.5, '#2f3336', x + 0.6, 7.4, z);                                  // レバー
  b.box(0.35, 3.6, 0.35, C.hose, x + 1.1, 4.4, z + 0.7);                              // ホース
}

function buildCorridorFront(K) {
  const { b, B, X1 } = K;
  // 待合の椅子の列（背中がこちら、扉の方を向いて待つ）。背もたれの上端（9.6）が
  // 帯の手前端に立つ人の足元を見る線より下に来る奥行き（z=58）に置く
  for (let g = B + 40, n = 0; g + 15 < X1; g += 62, n++) {
    for (let k = -2; k <= 2; k++) {
      pipeChair(K, g + k * 6, 58, -1, false);
      if ((k + n) % 3 === 0) b.box(2.6, 0.35, 3.4, '#c8a774', g + k * 6 + 0.3, 5.05, 58.4);   // 座面に置いた封筒
    }
    flat(b, 31, 6.4, '#9fb2a7', g, 58, L2);                                           // 椅子の下の陰（影は落とさない）
  }
}

// ===== 窓の外（春の朝）=====
// 窓は y=18〜35。カメラは見下ろしているので、窓には遠くの地面と桜の花、建物の上半分と空が入る。
// 外は実習場の窓（x < B）からしか見えない。いちばん右の窓を斜めに覗いても B を少し越える程度なので、
// 木と建物は B の手前で止める（廊下の壁の裏には置かない）。
function buildOutside(K) {
  const { glow, BACK, X0, B } = K;
  const xa = X0, xb = B + 8, xc = (xa + xb) / 2, wd = xb - xa;
  const s = { shade: true };
  glow.box(wd + 300, 170, 2, OUT.sky, xc, 50, BACK - 212);                            // 空
  for (const [x, y, w] of [[xa + 20, 14, 46], [xa + 150, 18, 60], [xa + 290, 12, 40], [xa + 400, 17, 54]]) {
    glow.box(w, 3.2, 2, OUT.cloud, x, y, BACK - 208);                                 // 雲
    glow.box(w * 0.6, 2.4, 2, OUT.cloud, x + w * 0.1, y + 2.4, BACK - 208);
  }
  for (let i = 0, x = xa - 40; x < xb + 40; x += 66, i++) {                           // 遠くの山なみ（隣どうしは奥行きをずらす）
    const h = 18 + (i % 3) * 6;
    glow.box(96, h, 10, i % 2 ? OUT.hill : OUT.hillFar, x, h / 2, BACK - 192 - (i % 2) * 6, s);
  }
  for (let i = 0, x = xa + 10; x < xb + 20; x += 88 + (i % 2) * 22, i++) {             // 研修センターの別棟・寮
    const h = 12 + (i % 3) * 3, w = 54 + (i % 2) * 18;
    glow.box(w, h, 16, OUT.bldg, x, h / 2, BACK - 128, s);
    glow.box(w + 2, 1.2, 17, OUT.roof, x, h + 0.6, BACK - 128, s);
    for (let f = 0; f < 2; f++) glow.box(w - 6, 1.6, 0.6, OUT.bldgWin, x, 4 + f * 5, BACK - 119.6);
  }
  glow.box(wd + 300, 0.4, 200, OUT.lawn, xc, -0.2, BACK - 2.2 - 100);                 // 芝生（山すそまで）
  glow.box(wd + 300, 0.2, 9, OUT.path, xc, 0.1, BACK - 52);                           // 小道
  // 桜並木。木と木の間を空けて、窓ごとに空と芝生がのぞくようにする（詰めると桃色の壁になる）
  for (let i = 0, x = xa + 6; x < xb; x += 62, i++) {
    sakura(glow, x + (i % 2) * 10, BACK - 26 - (i % 3) * 3, 1 + (i % 3) * 0.08, i);
  }
  // 奥の列は小さく、若葉の木を混ぜる
  for (let i = 0, x = xa + 38; x < xb; x += 62, i++) {
    if (i % 3 === 1) greenTree(glow, x, BACK - 74, 0.8);
    else sakura(glow, x, BACK - 74, 0.72, i + 2);
  }
}

function sakura(glow, x, z, k, seed) {
  glow.box(2.0 * k, 16 * k, 2.0 * k, OUT.trunk, x, 8 * k, z, { shade: true });
  glow.box(1.2 * k, 6 * k, 1.2 * k, OUT.trunk, x - 2.4 * k, 15 * k, z, { shade: true, rz: 0.6 });
  glow.box(1.2 * k, 6 * k, 1.2 * k, OUT.trunk, x + 2.4 * k, 15.5 * k, z, { shade: true, rz: -0.6 });
  const blobs = [[0, 21, 0, 7.2], [-5.6, 18.5, 1.5, 5.2], [5.4, 19, -1, 5.6], [-1.5, 25, -1, 4.8], [3.2, 16.5, 3, 4.2]];
  blobs.forEach(([dx, y, dz, r], i) => {
    glow.geo(new THREE.IcosahedronGeometry(r * k, 1), OUT.blossom[(i + seed) % OUT.blossom.length],
      x + dx * k, y * k, z + dz * k, { shade: 'soft' });
  });
}

function greenTree(glow, x, z, k) {
  glow.box(1.8 * k, 12 * k, 1.8 * k, OUT.trunk, x, 6 * k, z, { shade: true });
  for (const [dx, y, r] of [[0, 17, 6.4], [-3.6, 13.5, 4.6], [3.8, 14, 4.4]]) {
    glow.geo(new THREE.IcosahedronGeometry(r * k, 1), OUT.leaf, x + dx * k, y * k, z, { shade: 'soft' });
  }
}

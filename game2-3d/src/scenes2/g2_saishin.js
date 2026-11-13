// 小向クエスト2 ゴールデンエイジ編 — 最終章 発注官庁編「5階の審査室」
//
// 自社60号の5階。本編の PMR 審査会と同じ会議フロア（render3d.js の buildMeeting）の骨格
// ——淡い緑灰の壁、濃い枠の白板と投影スクリーンの繰り返し、白い天板に緑のマットの長机——を残し、
// 置き物を最終章のものに入れ替える。終わらない再設計審査。入社5年目、解散の日の夕方。
//
// 区間（ワールドの x。W=633）:
//   〜-36     資料庫の一角。スチール棚いっぱいの審査資料（同じ背表紙が何巻も）と、床に積んだ文書箱
//   -36〜476  審査室。奥は審査する側のひな壇（床の長机と、一段上がった台の長机の2列）。
//             壁の白板は工程表。右の白板ほど納期の線が何度も引き直され、赤い延長の線が白板から
//             はみ出して、壁に貼り足した紙へ伸びていく（tick で少しずつ伸びる）。
//             スクリーンは 指摘事項の一覧 → 延びていく節目 → 性能（要求の線に届かない）→ 原価（予算の線を越える）
//   320〜375  ひな壇の前に、台車に載った装置と測定器のラック。緑の灯りは点いている（動く）が、
//             測定の棒は要求の赤い線の手前で止まり、また落ちる
//   476〜     西向きの窓。日が沈んだばかりの空が、四騎士と戦うあいだに夜になる。構内の建屋に灯りが増える
// 手前（こちらの席＝下座）: 長机に「納期の延長を願い出る資料の束」。同じ表紙の束が、右へ行くほど増える。
// こちらの椅子はまばら（もう人が少ない）。審査する側の椅子はぎっしり並ぶ。
//
// 光: 6章でいちばん冷たく暗い。青白い蛍光灯の地明かりで、奥へ進むほど（日が暮れるほど）さらに落ちる。
// 文字・ロゴ・社章は描かない。人に見える物は置かない。手前は低い物だけ（フリップチャートは置かない）。
import { THREE, S, wx, wz, box, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, chair, fireRow, scene, hemi, sun, fill, ROOM } from '../../../game3d/src/render3d.js';

const R = ROOM.meeting;   // 本編の会議フロアの色をそのまま借りる（同じ階だと分かるように）

const C = {
  bg: '#1d232b',
  wall: R.wall, column: '#a7b1a5', base: '#454d46',
  ceiling: '#3a404c', upper: '#2c313b',   // 天井の上面と、天井より上の壁（画面のいちばん上の帯。暮れた色にする）
  floor: R.floor, floorB: '#535953',
  frame: R.frame, board: '#f0f3f1', boardHead: '#d5ddd9', tray: '#5a6258', tape: '#e6dfb8',
  desk: R.desk, mat: R.mat, skirt: R.cabinet, chair: R.chair, chairLeg: '#868c92',
  dais: '#454c53', riser: '#394046', nosing: '#a2a9ae',
  card: '#f5f6f2', paper: '#eceee6', paperB: '#e1e3da', paperLine: '#c7cac0',
  mic: '#25292e', cup: '#e6e9e4', bottle: '#c9dfe7',
  cover: '#e8da92',          // 延長を願い出る資料の表紙（どの束も同じ色＝同じ願い出を何度も）
  clip: '#1d2024',
  navy: '#2c466c', navyB: '#36507a', grey: '#5d6670', label: '#e7e5da',
  docBox: '#d6d0bf', docLid: '#c9c2ae', cardboard: '#a5845a', dark: '#23272b',
  shelf: '#9aa2a8', shelfPost: '#7f878e',
  cartDeck: '#45515d', cartMat: '#2a2f35', cartPipe: '#a0a8b0', wheel: '#1c1f23',
  devBody: '#a9b2ba', devPanel: '#2e343a', devFin: '#8a939b', devTop: '#959ea6',
  array: '#c8cdd1', arrayEl: '#7f8a94', conn: '#c49e3c', cable: '#1f2327', cableB: '#3a3f45',
  rack: '#2d3339', instr: '#bfc5c9', knob: '#3b4046',
  sash: '#99a2a9', sill: '#bfc6c2', blind: '#c6cac5', glass: '#cfe0ee',
  laptop: '#3a3f45',
};
// 白板の工程表の色。予定（青）・済み（緑）・延長（赤）・引き直す前の納期（薄い赤）・今の納期（濃い赤）
const BAR = { plan: '#4f7db3', done: '#5b9870', late: '#c9473b', oldDl: '#d9a19b', dl: '#8f1d16', grid: '#dde3e0', head: '#9aa6a2' };
const TABS = ['#f0d44a', '#ef8f9e', '#8fd08a', '#f0d44a', '#7fb8e8'];
const SERIES = ['#2c466c', '#2c466c', '#2c466c', '#36507a', '#5d6670', '#2c466c', '#6e3a34'];

// 決まった乱数（毎回同じ部屋になるように）
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => { const k = clamp01(u); return k * k * (3 - 2 * k); };

// ===== 形をまとめて1メッシュにする（頂点カラー。色ごとに分けない）=====
// 置き方: 形を tilt で傾ける → at だけずらす → X・Z・Y の順に回す → 拡縮（世界の軸）→ x,y,z へ動かす
function batch() {
  const L = { cast: [], plain: [] };
  const api = {
    geo(g, color, x, y, z, o = {}) {
      if (o.tilt) g.rotateX(o.tilt);                 // 形そのものを傾ける（at でずらす前）
      if (o.at) g.translate(o.at[0], o.at[1], o.at[2]);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      if (o.sx || o.sy || o.sz) g.scale(o.sx || 1, o.sy || 1, o.sz || 1);
      g.translate(x, y, z);
      (o.cast ? L.cast : L.plain).push([g, color]);
    },
    box(w, h, d, color, x, y, z, o) { api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    cyl(r, h, color, x, y, z, o = {}) {
      api.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 12), color, x, y, z, o);
    },
    done(mat, receive = true) {
      const out = [];
      for (const [kind, list] of Object.entries(L)) {
        if (!list.length) continue;
        const m = new THREE.Mesh(merge(list), out.length ? mat.clone() : mat);
        m.castShadow = kind === 'cast';
        m.receiveShadow = receive;
        m.matrixAutoUpdate = false; m.updateMatrix();
        addScenery(m);
        out.push(m);
      }
      L.cast.length = 0; L.plain.length = 0;
      return out;
    },
  };
  return api;
}
function merge(list) {
  const pos = [], nor = [], col = [], idx = [];
  const c = new THREE.Color();
  for (const [g, color] of list) {
    c.set(color);   // ColorManagement で linear になる。頂点カラーにそのまま入れてよい
    const base = pos.length / 3;
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

// ===== 動かす小物は InstancedMesh 1つずつにまとめる（照明が当たる物／光る物）=====
// 形は「底が原点の 1x1x1 の箱」。rz で z 軸まわりに回す（-π/2 で「上」が「右」になる＝右へ伸びる棒）。
const dummy = new THREE.Object3D();
function place(im, i, it, len) {
  const on = len > 0.0001;
  dummy.position.set(it.x, it.y, it.z);
  dummy.rotation.set(0, 0, it.rz || 0);
  dummy.scale.set(on ? it.w : 0, on ? len : 0, on ? it.d : 0);
  dummy.updateMatrix();
  im.setMatrixAt(i, dummy.matrix);
}
function instanced(list, mat) {
  if (!list.length) return null;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.frustumCulled = false;            // 行列を毎フレーム書き換えるので、境界球に頼らない
  im.castShadow = false;
  im.receiveShadow = false;
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const c = new THREE.Color();
  list.forEach((it, i) => { im.setColorAt(i, c.set(it.color)); place(im, i, it, it.len); });
  addScenery(im);
  return im;
}

// ===== 窓の外の空（日が落ちたあと → 夜）=====
// 段ごとの色を、進み具合 p で夕暮れ（A）から夜（B）へ寄せる。頂点カラーを書き換えるだけ（1回の描画）
const SKY_Y = [-40, 0, 4, 8, 12, 17, 23, 60];
const SKY_A = ['#33283a', '#6c4452', '#d48357', '#dc9868', '#98738f', '#56649a', '#2f3d70', '#18213f'].map((c) => new THREE.Color(c));
const SKY_B = ['#0b0d15', '#17121c', '#3a2632', '#2e2440', '#20223f', '#171d38', '#10172e', '#090d1d'].map((c) => new THREE.Color(c));
const OUT_A = new THREE.Color('#ffffff'), OUT_B = new THREE.Color('#5f6778');
function skyMesh(x0, x1, z) {
  const pos = [], col = [], idx = [];
  for (const y of SKY_Y) { pos.push(x0, y, z, x1, y, z); col.push(0, 0, 0, 0, 0, 0); }
  for (let i = 0; i < SKY_Y.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  m.matrixAutoUpdate = false; m.updateMatrix();
  m.frustumCulled = false;
  addScenery(m);
  return m;
}
const tmpC = new THREE.Color();
function paintSky(m, p) {
  const a = m.geometry.attributes.color;
  for (let i = 0; i < SKY_Y.length; i++) {
    tmpC.copy(SKY_A[i]).lerp(SKY_B[i], p);
    a.setXYZ(i * 2, tmpC.r, tmpC.g, tmpC.b);
    a.setXYZ(i * 2 + 1, tmpC.r, tmpC.g, tmpC.b);
  }
  a.needsUpdate = true;
}

// ===== 光 =====
// 6章でいちばん冷たく暗い。帰社（g2_jisha）の第5章よりさらに下げる。
// 奥へ進むほど（日が落ちるほど）もう一段落ちる。fill の色は他の場面が戻さないので触らない。
const LIGHT = {
  hemiA: new THREE.Color('#b4c5df'), hemiB: new THREE.Color('#9db0d0'),
  gndA: new THREE.Color('#3c4450'), gndB: new THREE.Color('#2c323e'),
  sunA: new THREE.Color('#cbd8ee'), sunB: new THREE.Color('#b6c6e6'),
};
function applyLight(p) {
  hemi.color.copy(LIGHT.hemiA).lerp(LIGHT.hemiB, p);
  hemi.groundColor.copy(LIGHT.gndA).lerp(LIGHT.gndB, p);
  hemi.intensity = 1.32 - 0.2 * p;
  sun.color.copy(LIGHT.sunA).lerp(LIGHT.sunB, p);
  sun.intensity = 0.64 - 0.1 * p;
  fill.intensity = 0.8 - 0.06 * p;
}
// 進み具合（0〜1）。自機のワールド x が 40 → 520（ボスの手前）。部屋の明かりはこれで落とす
function progressOf(st) {
  if (!st || !st.player) return 0;
  return clamp01((st.player.x * S - 40) / 480);
}
// 空の暮れ方（0〜1）。窓が見え始める所（自機 x≈380）から暮れ始め、ボスの手前（550）で夜になる。
// 部屋と同じ進み具合にすると、窓が見える頃にはもう夜で、夕焼けを一度も見ないまま終わるため
function skyOf(st) {
  if (!st || !st.player) return 0;
  return clamp01((st.player.x * S - 380) / 170);
}

// 動かす物。build のたびに作り直す（前の章のメッシュを掴んだままにしない）
let anim = null;

export function build(W, halfD, ctx = {}) {
  anim = null;
  const st = (ctx && ctx.stage) || null;
  const { BACK, FRONT } = zones(halfD, 38, 70);   // 奥 -66 / 手前 98（本編の会議フロアと同じ）
  const p0 = progressOf(st);
  setLighting(false);
  applyLight(p0);
  scene.background = hex(C.bg);
  scene.fog = new THREE.Fog(hex(C.bg), 300, 950);

  // 開始位置のカメラは左へ x≈-85 まで、ボスの手前で右へ x≈665 まで見える
  const XL = -140, XR = W + 140, XM = (XL + XR) / 2, XW = XR - XL;
  const STORE = -36;          // ここより左は資料庫の一角
  const WIN0 = 476;           // ここより右は窓
  const B = batch();          // 照明が当たる・動かない物（影を落とすのは cast の付いた奥の大物だけ）
  const U = batch();          // 光る面（スクリーン・計器の画面・灯り）。照明に左右されない色
  const O = batch();          // 窓の外の書き割り（夜になると暗くする）
  const Gl = batch();         // ガラス（半透明）
  const LAM = [];             // 動かす物（照明が当たる）: 延びる工程の線・時計の針
  const BAS = [];             // 動かす物（光る）: 測定の棒・装置の灯り・航空障害灯・建屋の窓の灯り

  // ===== 床 =====
  // 本編の会議フロアと同じ濃い緑灰のタイルカーペット。市松はごく薄く
  B.box(XW, 2, FRONT - BACK, C.floor, XM, -1, (FRONT + BACK) / 2);
  for (let i = 0, x = XL + 6; x < XR; x += 12, i++) {
    for (let j = 0, z = BACK + 6; z < 80; z += 12, j++) if ((i + j) % 2) B.box(12, 0.04, 12, C.floorB, x, 0.02, z);
  }

  // ===== 奥の壁 =====
  const WB = 8, WT = 40;      // 窓の下端・上端（上端は天井に隠れる）
  B.box(WIN0 - XL, 46, 2, C.wall, (XL + WIN0) / 2, 23, BACK - 1);
  B.box(XR - WIN0, WB, 2, C.wall, (WIN0 + XR) / 2, WB / 2, BACK - 1);                 // 腰壁
  B.box(XR - WIN0, 46 - WT, 2, C.wall, (WIN0 + XR) / 2, (46 + WT) / 2, BACK - 1);     // 垂れ壁
  B.box(XW, 18, 2, C.upper, XM, 55, BACK - 1);                                         // 天井より上（画面の上の縁）
  B.box(XW, 1.0, 0.3, C.base, XM, 0.5, BACK + 0.15);                                  // 幅木
  const column = (x) => B.box(6, 46, 4, C.column, x, 23, BACK);                       // 柱（壁から2だけ出す。天井まで）
  column(STORE);
  for (let x = WIN0 + 3; x < XR; x += 64) column(x);

  // 天井（手前は z=40 で切る）。本編の ceilingSlab に、左右の延長を足す
  const CEIL = ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  B.box(-40 - XL, 2, CEIL - BACK, C.ceiling, (XL - 40) / 2, 47, (CEIL + BACK) / 2);
  B.box(XR - W - 40, 2, CEIL - BACK, C.ceiling, (W + 40 + XR) / 2, 47, (CEIL + BACK) / 2);

  // ===== 壁の白板: 工程表（延びていく線）=====
  // 本編と同じ枠の白板。k が大きい（右の）白板ほど、納期の線が何度も引き直されている。
  // 引き直す前の納期は薄い赤の縦線に「×」。今の納期は濃い赤。延長の赤い線は白板の右端からはみ出して、
  // 壁に貼り足した紙の上まで伸びる（その先端が tick で少しずつ伸びる）。
  const BOARDS = [0, 128, 256, 384], SCREENS = [64, 192, 320, 448];
  // 白板の上の層。同じ面に色違いを2枚重ねると点滅するので、描く物ごとに前へ 0.05 ずつずらす。
  // 層の前面は BACK+1.42+0.05n（白板の面は BACK+1.35）。厚み 0.1 の箱を置く z を返す
  const zl = (n) => BACK + 1.37 + 0.05 * n;
  BOARDS.forEach((bx, k) => {
    const yC = 19.5;
    B.box(58, 18, 0.9, C.frame, bx, 19, BACK + 0.5);                // 濃い枠
    B.box(55, 15, 0.5, C.board, bx, yC, BACK + 1.1);                // 白板（前面 BACK+1.35）
    B.box(57, 1.4, 1.6, C.tray, bx, 10.6, BACK + 1.4);              // ペン受け
    B.box(9, 0.8, 0.9, '#c8322a', bx - 18, 11.7, BACK + 1.9);       // 赤ペン
    B.box(9, 0.8, 0.9, '#2a3a4a', bx - 7, 11.7, BACK + 1.9);        // 黒ペン
    B.box(6, 1.5, 1.6, '#e8e8e2', bx + 14, 12.0, BACK + 1.9);       // 白板消し
    // 層0: 日付の帯・行の見出し（無地の色の札）・行の区切り
    const rowY = (r) => 24.6 - r * 2.5;
    B.box(48, 0.9, 0.1, C.boardHead, bx + 3, 26.3, zl(0));
    for (let r = 0; r < 5; r++) {
      B.box(4.6, 1.3, 0.1, ['#c9d3dd', '#d9d2c3', '#c9d8cc', '#dccbc8', '#d2cde0'][r], bx - 24.6, rowY(r), zl(0));
      B.box(48, 0.12, 0.1, BAR.grid, bx + 3, rowY(r) - 1.25, zl(0));
    }
    // 納期の線。最初の納期は時間の帯の 55% の所、引き直すたびに右へ 7
    const t0x = bx - 21, tw = 48, dl = (j) => t0x + tw * 0.55 + j * 7;
    // 層1: 行ごとの棒（済み・予定・遅れ）
    for (let r = 0; r < 5; r++) {
      const y = rowY(r);
      const s = t0x + 1 + r * 4.2 + rnd(k * 7 + r) * 2.5;              // 始まり
      const e = Math.min(dl(0) - (4 - r) * 1.6, s + 9 + rnd(k + r * 3) * 8);   // 元の予定の終わり
      const doneEnd = Math.min(e, t0x + tw * (0.22 + k * 0.05));
      if (doneEnd > s + 0.5) B.box(doneEnd - s, 1.25, 0.1, BAR.done, (s + doneEnd) / 2, y, zl(1));
      const ps = Math.max(s, doneEnd);
      if (e > ps + 0.3) B.box(e - ps, 1.25, 0.1, BAR.plan, (ps + e) / 2, y, zl(1));
      if (k > 0 && r >= 1) {
        // 引き直しの延長（赤）。後ろの行ほど遅れが積もる
        const lateEnd = Math.min(dl(k) - (4 - r) * 1.1, bx + 26.5);
        if (lateEnd > e + 0.4) B.box(lateEnd - e - 0.05, 1.25, 0.1, BAR.late, (e + lateEnd + 0.05) / 2, y, zl(1));
        // まだ伸びている線（下の2行）。今の納期の手前から右へ、白板の外の紙まで（層4）
        if (r >= 3) {
          const start = Math.max(e, lateEnd - 0.6);
          LAM.push({ kind: 'ext', x: start, y, z: zl(4), rz: -Math.PI / 2, w: 1.25, d: 0.1,
            len: 0, min: Math.max(1, (bx + 22.5 + k * 1.5) - start), max: (bx + 37) - start, color: BAR.late, ph: r * 0.37 + k * 0.29 });
        }
      } else if (r === 4) {
        LAM.push({ kind: 'ext', x: e - 0.3, y, z: zl(4), rz: -Math.PI / 2, w: 1.25, d: 0.1,
          len: 0, min: 2.5, max: 9, color: BAR.late, ph: 0.2 });
      }
      // 層3: 節目の菱形（ときどき）
      if (rnd(k * 11 + r * 5) < 0.45) B.box(0.95, 0.95, 0.1, '#2c3238', e + 0.7, y, zl(3), { rz: Math.PI / 4 });
    }
    // 層2: 日付の目盛りと、納期の縦線。層3: 今の納期の菱形と、引き直す前の納期の「×」
    for (let x = bx - 20; x < bx + 27; x += 4) B.box(0.18, 0.7, 0.1, BAR.head, x, 26.3, zl(2));
    for (let j = 0; j <= k; j++) {
      const x = dl(j), cur = j === k;
      B.box(cur ? 0.5 : 0.3, 13.2, 0.1, cur ? BAR.dl : BAR.oldDl, x, 19.4, zl(2));
      if (cur) B.box(1.3, 1.3, 0.1, BAR.dl, x, 26.3, zl(3), { rz: Math.PI / 4 });          // 今の納期の菱形
      else {
        B.box(1.7, 0.3, 0.1, BAR.late, x, 26.3, zl(3), { rz: 0.8 });                          // ×
        B.box(1.7, 0.3, 0.1, BAR.late, x, 26.3, zl(3) + 0.02, { rz: -0.8 });
      }
    }
    // 層5: 付箋（いちばん手前）
    for (let i = 0; i < 3 + k * 2; i++) {
      const x = bx - 18 + rnd(k * 17 + i * 3) * 42, y = 13.6 + rnd(k * 5 + i * 7) * 11;
      B.box(1.8, 1.8, 0.1, TABS[(i + k) % TABS.length], x, y, zl(5) + (i % 3) * 0.02, { rz: (rnd(i + k) - 0.5) * 0.3 });
    }
    // 白板の右に貼り足した紙（k>0）。テープで留めてある
    if (k > 0) {
      const px = bx + 33.6;
      B.box(8.6, 7.4, 0.08, '#f4f3ec', px, 16.2, BACK + 1.0);                                // 前面 BACK+1.04
      for (const [dx, dy] of [[-3.9, 3.3], [3.9, 3.3], [-3.9, -3.3], [3.9, -3.3]]) {
        B.box(1.4, 0.7, 0.06, C.tape, px + dx, 16.2 + dy, BACK + 1.08, { rz: dx * dy > 0 ? 0.6 : -0.6 });
      }
      // 紙の上の日付の目盛りと、紙の続きの納期（引き直した納期が紙の上にも1本）
      for (let x = px - 2.5; x < px + 3; x += 2) B.box(0.14, 0.6, 0.06, BAR.head, x, 18.6, BACK + 1.14);
      if (k >= 2) B.box(0.4, 5.6, 0.06, k >= 3 ? BAR.dl : BAR.oldDl, px + 1.2 + (k - 2) * 1.0, 15.6, BACK + 1.2);
    }
  });

  // ===== 壁のスクリーン（投影中の資料。光る面）=====
  SCREENS.forEach((sx, k) => {
    const yC = 20, zs = BACK + 1.36, z2 = BACK + 1.46;
    B.box(44, 20, 0.9, C.frame, sx, yC, BACK + 0.5);
    B.box(44.6, 1.6, 1.4, '#59615a', sx, 30.6, BACK + 1.2);         // 巻き取りの箱（枠より少し長く。端の面を枠と揃えない）
    U.box(40, 17, 0.4, '#d9e2e8', sx, yC, BACK + 1.1);              // 映っている面（前面 BACK+1.3）
    const L0 = sx - 18.5, B0 = 12.5;                                // 資料の左端・下端
    if (k === 0) {
      // 指摘事項の一覧。見出しの帯と行。状態の欄はほとんど赤（未完了）
      U.box(37, 1.6, 0.1, '#2f4f7a', sx, 27.2, zs);
      for (let r = 0; r < 8; r++) {
        const y = 25.2 - r * 1.62;
        U.box(37, 1.3, 0.1, r % 2 ? '#c9d3db' : '#e9eef1', sx, y, zs);
        U.box(1.6, 0.9, 0.1, '#6e7a86', L0 + 1.6, y, z2);
        U.box(14 + rnd(r) * 8, 0.32, 0.1, '#56616c', L0 + 4 + (14 + rnd(r) * 8) / 2, y + 0.2, z2);
        U.box(6 + rnd(r * 3) * 6, 0.32, 0.1, '#7d8893', L0 + 4 + (6 + rnd(r * 3) * 6) / 2, y - 0.3, z2);
        const st = rnd(r * 7 + 1);
        U.box(4.2, 0.95, 0.1, st < 0.68 ? '#d0463a' : st < 0.9 ? '#e0b83a' : '#5a9c6a', sx + 15.4, y, z2);
      }
    } else if (k === 1) {
      // 延びていく節目。予定の位置（灰）から、引き直した位置（赤）へ矢印。全部が右へずれる
      U.box(35, 0.3, 0.1, '#4a535c', sx + 0.5, B0 + 0.8, zs);
      for (let i = 0; i < 9; i++) U.box(0.18, 0.7, 0.1, '#4a535c', L0 + 2 + i * 4.2, B0 + 0.8, z2);
      for (let r = 0; r < 5; r++) {
        const y = 25.4 - r * 2.6, x0 = L0 + 4 + r * 3.6 + rnd(r + 4) * 2;
        const x1 = Math.min(x0 + 7 + rnd(r * 9) * 9 + r * 1.5, sx + 17.5);
        U.box(x1 - x0, 0.5, 0.1, '#d0463a', (x0 + x1) / 2, y, zs);
        U.box(1.5, 1.5, 0.1, '#9aa5ae', x0, y, z2, { rz: Math.PI / 4 });
        U.box(1.7, 1.7, 0.1, '#c23a2e', x1, y, z2, { rz: Math.PI / 4 });
        U.box(1.2, 0.3, 0.1, '#d0463a', x1 - 1.6, y + 0.45, zs + 0.03, { rz: -0.6 });
        U.box(1.2, 0.3, 0.1, '#d0463a', x1 - 1.6, y - 0.45, zs + 0.05, { rz: 0.6 });
      }
    } else if (k === 2) {
      // 性能。要求の線（赤の破線）の手前で、どの棒も止まる。右端の1本は測定中（tick で上下する）
      U.box(0.3, 13.5, 0.1, '#4a535c', L0 + 1.5, B0 + 6.75, zs);
      U.box(35, 0.3, 0.1, '#4a535c', sx + 0.5, B0, zs);
      const req = B0 + 11.6;
      for (let x = L0 + 2.6; x < sx + 18; x += 2.6) U.box(1.6, 0.42, 0.1, '#d23a2e', x, req, z2 + 0.12);
      for (let i = 0; i < 7; i++) {
        const h = 6.2 + rnd(i * 5 + 2) * 3.6 + i * 0.25;
        U.box(2.8, h, 0.1, '#6f8fb0', L0 + 5 + i * 4.3, B0 + 0.15 + h / 2, z2);
      }
      BAS.push({ kind: 'gauge', x: L0 + 5 + 7 * 4.3, y: B0 + 0.15, z: z2, w: 2.8, d: 0.1, len: 6, max: 11.6 - 0.15 - 1.7, color: '#7ed08a', ph: 0.6 });
    } else {
      // 原価。予算の線（濃い破線）を、右の棒ほど越えていく
      U.box(0.3, 13.5, 0.1, '#4a535c', L0 + 1.5, B0 + 6.75, zs);
      U.box(35, 0.3, 0.1, '#4a535c', sx + 0.5, B0, zs);
      const bud = B0 + 7.4;
      for (let x = L0 + 2.6; x < sx + 18; x += 2.6) U.box(1.6, 0.36, 0.1, '#33404c', x, bud, z2 + 0.12);
      for (let i = 0; i < 8; i++) {
        const h = Math.min(4 + i * 1.45 + rnd(i * 3) * 0.8, 13.6);
        U.box(2.8, h, 0.1, h > 7.4 ? '#c8402e' : '#d68a4a', L0 + 4.6 + i * 3.9, B0 + 0.15 + h / 2, z2);
      }
    }
  });

  // ===== 壁の時計（白板とスクリーンの間）。会議は終わらない（tick で針が速く回る）=====
  const clock = (x, y) => {
    B.cyl(3.0, 0.4, C.frame, x, y, BACK + 0.2, { rx: Math.PI / 2, seg: 22 });
    B.cyl(2.6, 0.3, '#eef0ec', x, y, BACK + 0.5, { rx: Math.PI / 2, seg: 22 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      B.box(i % 3 ? 0.18 : 0.32, i % 3 ? 0.42 : 0.8, 0.06, '#353b42', x + Math.sin(a) * 2.15, y + Math.cos(a) * 2.15, BACK + 0.68, { rz: -a });
    }
    LAM.push({ kind: 'hour', x, y, z: BACK + 0.76, w: 0.42, d: 0.1, len: 1.45, color: '#25292e' });
    LAM.push({ kind: 'min', x, y, z: BACK + 0.88, w: 0.26, d: 0.08, len: 2.15, color: '#25292e' });
    B.cyl(0.3, 0.3, '#25292e', x, y, BACK + 0.98, { rx: Math.PI / 2, seg: 8 });
  };
  clock(92.5, 22.5);
  clock(348.5, 22.5);

  // ===== 資料庫の一角（x < STORE）: 審査資料の山 =====
  // スチール棚に同じ背表紙のバインダーが何巻も（第1回、第2回…の審査資料）。上と床に文書箱
  const shelf = (x, i) => {
    const z = BACK + 4.2, H = 31.5;
    for (const dx of [-11.6, 11.6]) for (const dz of [-3.1, 3.1]) B.box(0.8, H, 0.8, C.shelfPost, x + dx, H / 2, z + dz, { cast: true });
    for (let f = 0; f < 6; f++) B.box(23.4, 0.5, 6.8, C.shelf, x, 0.8 + f * 6.1, z, { cast: true });   // 端は支柱の中に収める
    for (let f = 0; f < 5; f++) {
      const y = 1.05 + f * 6.1;
      if ((i * 3 + f) % 5 === 4) {
        for (const dx of [-5.6, 5.6]) {
          B.box(10.4, 5.0, 6.2, C.docBox, x + dx, y + 2.5, z);
          B.box(2.6, 0.8, 0.1, C.dark, x + dx, y + 3.4, z + 3.12);
        }
      } else {
        const lean = (i + f) % 3 === 0;      // 段の右端が欠けて、残りが倒れかかっている
        const n = lean ? 7 : 9;
        for (let k = 0; k < n; k++) {
          const h = 4.7 + rnd(i * 31 + f * 7 + k) * 0.5;
          const bx = x - 10.3 + k * 2.55;
          const col = SERIES[(i * 5 + f * 3 + Math.floor(k / 3)) % SERIES.length];
          B.box(2.35, h, 6, col, bx, y + h / 2, z);
          B.box(1.3, 1.0, 0.08, C.label, bx, y + h * 0.66, z + 3.04);                 // 背のラベル（無地）
          if (rnd(i * 13 + f * 5 + k) < 0.35) B.box(0.5, 0.8, 0.12, TABS[k % TABS.length], bx + 0.4, y + h + 0.3, z + 1.6);
        }
        if (lean) B.box(2.35, 4.9, 5.8, SERIES[(i + f) % SERIES.length], x + 8.0, y + 2.3, z - 0.1, { rz: -0.42 });
      }
    }
    for (let k = 0; k < 2; k++) B.box(10.4, 5.0, 6.2, k ? C.cardboard : C.docBox, x - 5.6 + k * 11.2, 34.3, z, { ry: (rnd(i + k) - 0.5) * 0.1 });
  };
  for (let i = 0, x = STORE - 15.7; x > XL - 6; x -= 26, i++) shelf(x, i);

  // 文書箱（保存箱）。蓋と手かけの穴
  const docBox = (x, y, z, ry = 0, cb = false) => {
    B.box(9, 6, 6.4, cb ? C.cardboard : C.docBox, x, y, z, { at: [0, 3, 0], ry, cast: true });
    if (!cb) B.box(9.2, 0.7, 6.6, C.docLid, x, y, z, { at: [0, 5.75, 0], ry });
    else B.box(9.02, 0.12, 0.5, '#c9b48a', x, y, z, { at: [0, 6.02, 0], ry });           // ガムテープ
    B.box(2.6, 0.9, 0.1, C.dark, x, y, z, { at: [0, 3.9, 3.25], ry });
  };
  const pile = (x, z, n, s) => {
    for (let i = 0; i < n; i++) docBox(x + (rnd(s + i) - 0.5) * 1.4, i * 6.1, z, (rnd(s * 3 + i) - 0.5) * 0.18, rnd(s * 7 + i) < 0.3);
  };
  pile(-49, -48, 3, 1); pile(-60, -49, 4, 2); pile(-88, -47, 2, 3); pile(-99, -49, 4, 4); pile(-124, -48, 3, 5);
  pile(-54, -38.5, 1, 6); pile(-111, -39, 2, 7);

  // 台車（平台車）。資料庫では文書箱を、審査室では装置を載せる
  const cart = (x, z, side) => {
    for (const dx of [-9.6, 9.6]) for (const dz of [-4.8, 4.8]) {
      B.cyl(0.85, 0.7, C.wheel, x + dx, 0.85, z + dz, { rx: Math.PI / 2, seg: 10 });
      B.box(1.4, 0.6, 1.3, C.cartPipe, x + dx, 1.95, z + dz);
    }
    B.box(24, 1.0, 13, C.cartDeck, x, 2.7, z, { cast: true });
    B.box(23, 0.15, 12, C.cartMat, x, 3.27, z);
    const hx = x + side * 11.3;
    for (const dz of [-5.2, 5.2]) B.box(0.7, 11.4, 0.7, C.cartPipe, hx, 8.9, z + dz, { cast: true });
    B.box(0.8, 0.8, 11.2, C.cartPipe, hx, 14.6, z, { cast: true });
    return 3.345;
  };
  {
    const y = cart(-76, -34.5, -1);
    docBox(-80, y, -34.5, 0.04); docBox(-70.5, y, -34.5, -0.05, true); docBox(-75, y + 6.1, -34.5, 0.12);
  }

  // ===== 奥: 審査する側のひな壇 =====
  // 床の長机（1段目）と、一段上がった台の長机（2段目）。椅子は机の向こう側で、こちら（帯）を向く。
  // 席ごとに無地の席札・マイク・審査資料の山。席はぎっしり埋まっている（こちらの席はまばら）。
  const PL0 = -26, PL1 = 444, PH = 2.6, PZ = -47;
  B.box(PL1 - PL0, PH, PZ - BACK, C.dais, (PL0 + PL1) / 2, PH / 2, (BACK + PZ) / 2, { cast: true });
  B.box(PL1 - PL0, PH - 0.5, 0.1, C.riser, (PL0 + PL1) / 2, (PH - 0.5) / 2, PZ + 0.05);
  B.box(PL1 - PL0 + 0.2, 0.5, 0.7, C.nosing, (PL0 + PL1) / 2, PH - 0.2, PZ + 0.1);    // 段鼻
  B.box(0.7, 0.5, PZ - BACK - 0.4, C.nosing, PL1 + 0.1, PH - 0.2, (BACK + PZ - 0.4) / 2);

  const T1 = -37, T1D = 11, T2 = -52.4, T2D = 10;
  const table = (x, z, y0, w, d) => {
    B.box(w, 1.0, d, C.desk, x, y0 + 8.2, z, { cast: true });
    B.box(w - 2, 0.25, d - 3.5, C.mat, x, y0 + 8.83, z);
    B.box(w - 0.6, 6.4, 0.8, C.skirt, x, y0 + 4.5, z + d / 2 - 0.6, { cast: true });     // 幕板（帯の側）
    for (const dx of [-(w / 2 - 0.8), w / 2 - 0.8]) B.box(0.9, 7.7, d - 1, C.skirt, x + dx, y0 + 3.85, z, { cast: true });
  };
  // 会議椅子。dir=1 で背もたれが奥（-z）＝こちらを向いて座る
  const seat = (x, z, y0, dir, col = C.chair, turn = 0) => {
    const o = (ax, ay, az) => ({ at: [ax, ay, az], ry: turn, cast: true });
    B.box(6.0, 0.9, 6.0, col, x, y0, z, o(0, 5.4, 0));
    B.box(6.0, 6.0, 0.8, col, x, y0, z, { ...o(0, 9.1, -3.0 * dir), tilt: -0.08 * dir });
    B.box(1.0, 4.6, 1.0, C.chairLeg, x, y0 + 2.75, z);
    B.box(5.2, 0.5, 0.9, C.chairLeg, x, y0 + 0.45, z, { ry: 0.4 + turn });
    B.box(5.2, 0.5, 0.9, C.chairLeg, x, y0 + 0.45, z, { ry: 0.4 + turn + Math.PI / 2 });
  };
  // 願い出の束（同じ表紙・同じクリップ）
  const bundle = (x, y, z, ry, h = 1.15) => {
    B.box(4.8, h, 3.6, C.paper, x, y, z, { at: [0, h / 2, 0], ry });
    B.box(4.9, 0.1, 3.7, C.cover, x, y, z, { at: [0, h + 0.05, 0], ry });
    B.box(1.3, 0.55, 0.6, C.clip, x, y, z, { at: [-1.4, h - 0.1, 1.75], ry });
    return h + 0.1;
  };
  // 審査員の席の上
  let seatNo = 0;
  const reviewerSeat = (sx, z, y0, d, allowTall) => {
    const i = seatNo++, ys = y0 + 8.96, front = z + d / 2;
    B.box(4.2, 1.9, 0.3, C.card, sx, ys + 0.9, front - 1.3, { rx: -0.25 });                  // 席札（無地）
    // 審査資料の山。ときどき見上げるほど高い
    const tall = allowTall && rnd(i * 3.7 + 1) < 0.34;
    const h = tall ? 4.6 + rnd(i * 1.3) * 4.6 : 0.8 + rnd(i * 1.9) * 2.2;
    const ry = (rnd(i * 5) - 0.5) * 0.14;
    B.box(5.0, h, 3.6, (i % 3) ? C.paper : C.paperB, sx + 1.3, ys + h / 2, z - 1.4, { ry, cast: tall });
    for (let k = 1; k * 1.6 < h; k++) B.box(5.06, 0.12, 3.66, C.paperLine, sx + 1.3, ys + k * 1.6, z - 1.4, { ry });
    if (tall) B.box(4.8, 0.9, 3.4, C.paperB, sx + 1.1, ys + h + 0.45, z - 1.5, { ry: ry + 0.2 });   // ずれて載った束
    // 付箋だらけのバインダー
    if (rnd(i * 2.3) < 0.55) {
      const n = 2 + Math.floor(rnd(i * 4.1) * 3);
      for (let k = 0; k < n; k++) {
        const bx = sx - 5.9 + k * 1.05;
        B.box(0.95, 4.2, 3.3, k % 2 ? C.navyB : C.navy, bx, ys + 2.1, z - 1.9);
        B.box(0.5, 0.9, 0.12, TABS[(i + k) % TABS.length], bx, ys + 4.55, z - 1.0);
        if (rnd(i + k * 7) < 0.5) B.box(0.5, 0.9, 0.12, TABS[(i + k + 2) % TABS.length], bx, ys + 4.5, z - 2.6);
      }
    }
    // マイク
    B.box(1.8, 0.4, 1.2, C.mic, sx - 2.4, ys + 0.2, z + 0.9);
    B.box(0.22, 3.0, 0.22, C.mic, sx - 2.4, ys + 1.5, z + 1.5, { rx: 0.55 });
    B.box(0.6, 0.6, 0.9, C.mic, sx - 2.4, ys + 2.85, z + 2.3);
    // 湯のみ／ペットボトル
    if (i % 2) B.cyl(0.62, 1.7, C.cup, sx + 4.7, ys + 0.85, z + 0.3, { seg: 10 });
    else B.cyl(0.58, 3.6, C.bottle, sx + 4.7, ys + 1.8, z + 0.3, { seg: 10 });
  };

  const TX = (k) => 4 + 58 * k;
  const DEVK = 6;                     // この机の場所に、装置の台車を出す
  for (let k = 0; TX(k) < W + 40; k++) {
    const x = TX(k);
    // 1段目（床）
    if (k !== DEVK) {
      table(x, T1, 0, 52, T1D);
      for (const dx of [-19.5, -6.5, 6.5, 19.5]) {
        const j = k * 4 + dx;                          // 椅子は少しずつ向きと引き具合が違う（判で押したように並べない）
        seat(x + dx + (rnd(j) - 0.5) * 0.8, T1 - 8.2 - rnd(j * 3) * 0.9, 0, 1, C.chair, (rnd(j * 7) - 0.5) * 0.22);
        reviewerSeat(x + dx, T1, 0, T1D, true);
      }
      // 右の机ほど、こちらから出した願い出の束が審査する側の机に溜まっている
      const nb = Math.max(0, Math.floor((x - 120) / 90));
      for (let i = 0; i < nb; i++) bundle(x + (i % 2) * 0.3, 8.96 + i * 1.25, T1 + 3.1, (rnd(k * 3 + i) - 0.5) * 0.3);
    }
    // 2段目（台の上）。台のある所だけ
    if (x + 26 <= PL1) {
      table(x, T2, PH, 54, T2D);
      for (const dx of [-20, -6.7, 6.7, 20]) {
        const j = k * 5 + dx + 100;
        seat(x + dx + (rnd(j) - 0.5) * 0.8, T2 - 8.1 + rnd(j * 3) * 0.4, PH, 1, C.chair, (rnd(j * 7) - 0.5) * 0.18);
        reviewerSeat(x + dx, T2, PH, T2D, false);
      }
    }
  }

  // ===== ひな壇の前: 台車に載った装置と測定器 =====
  // 動く（緑の灯りが点滅）。だが測定の棒は要求の赤い線に届かない。札は赤（不適合）。文字は書かない
  {
    const DX = 336, DZ = -36.5;
    const y0 = cart(DX, DZ, -1);
    B.box(14, 8.4, 10, C.devBody, DX + 1.5, y0 + 4.2, DZ, { cast: true });                 // 本体（x 329.5〜343.5）
    B.box(12.4, 5.6, 0.3, C.devPanel, DX + 1.5, y0 + 4.5, DZ + 5.15);                      // 前面パネル
    for (let i = 0; i < 4; i++) B.box(5.2, 0.28, 0.1, '#4a5258', DX - 1.4, y0 + 2.6 + i * 0.9, DZ + 5.33);   // 通風口
    for (let i = 0; i < 3; i++) B.cyl(0.55, 0.7, C.conn, DX + 3.2 + i * 1.6, y0 + 2.6, DZ + 5.4, { rx: Math.PI / 2, seg: 10 });
    U.box(0.9, 0.55, 0.12, '#ffb43a', DX + 3.4, y0 + 6.3, DZ + 5.36);                       // 灯り（橙・点きっぱなし）
    BAS.push({ kind: 'led', x: DX + 5.0, y: y0 + 6.05, z: DZ + 5.36, w: 0.9, d: 0.12, len: 0.55, color: '#5dff95' });
    for (let i = 0; i < 6; i++) B.box(0.4, 1.2, 9, C.devFin, DX - 4.0 + i * 1.9, y0 + 9.0, DZ);   // 放熱フィン
    B.box(6.6, 3.2, 6.4, C.devTop, DX + 5.0, y0 + 10.2, DZ - 0.9, { cast: true });           // 上の箱
    // アレイ面（傾けた平板に格子の目）。抽象のまま
    {
      const ax = DX - 3.4, ay = y0 + 8.4 + 3.05, az = DZ - 1.2, tilt = -0.32;
      B.box(9.6, 6.4, 0.6, C.array, ax, ay, az, { rx: tilt, cast: true });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        B.box(1.6, 1.4, 0.14, C.arrayEl, ax, ay, az, { at: [-3.45 + c * 2.3, -1.9 + r * 1.9, 0.36], rx: tilt });
      }
      B.box(1.2, 3.0, 1.2, C.devFin, ax, y0 + 9.9, az - 1.1);                               // 支え
    }
    // 不適合の赤い札を、紐で下げる
    B.box(0.1, 1.8, 0.1, '#dcd8cc', DX - 4.6, y0 + 7.3, DZ + 5.38);
    B.box(1.9, 2.8, 0.1, '#c8322a', DX - 4.6, y0 + 5.0, DZ + 5.46, { rz: 0.08 });
    // ケーブル: 本体の右の側面から出て、台車の縁の外を床へ下り、ラックへ
    B.box(4.9, 0.5, 0.5, C.cable, DX + 9.95, y0 + 5.0, DZ + 2.2);
    B.box(4.9, 0.42, 0.42, C.cableB, DX + 9.95, y0 + 3.9, DZ + 0.6);
    B.box(0.5, y0 + 5.0, 0.5, C.cable, DX + 12.6, (y0 + 5.0) / 2, DZ + 2.2);
    B.box(0.42, y0 + 3.9, 0.42, C.cableB, DX + 12.6, (y0 + 3.9) / 2, DZ + 0.6);
    B.box(10.9, 0.5, 0.5, C.cable, DX + 18.1, 0.25, DZ + 2.2);
    B.box(10.9, 0.42, 0.42, C.cableB, DX + 18.1, 0.21, DZ + 0.6);
    // 台車の前の床に、巻いた延長のケーブル。床の配線カバーへつながる
    B.geo(new THREE.TorusGeometry(2.4, 0.32, 6, 18), C.cable, DX - 4, 0.33, DZ + 7.6, { rx: Math.PI / 2 });
    B.geo(new THREE.TorusGeometry(1.8, 0.28, 6, 16), C.cableB, DX - 3.4, 0.95, DZ + 7.2, { rx: Math.PI / 2 });
    B.box(8.6, 0.45, 0.45, C.cable, DX + 2.4, 0.23, DZ + 6.9, { ry: 0.14 });
    // こちらの机まで、床の配線カバー（帯を横切る。床の模様の高さ）
    B.box(1.6, 0.12, 80.5, '#30353b', DX + 6.5, 0.06, 7.75);
    for (let z = -28; z < 46; z += 6) B.box(1.7, 0.03, 0.2, '#3d434a', DX + 6.5, 0.135, z);

    // 測定器のラック（キャスター付き）
    const RX = 365, RZ = -38.5;
    for (const dx of [-4.6, 4.6]) for (const dz of [-3.6, 3.6]) B.cyl(0.75, 0.6, C.wheel, RX + dx, 0.75, RZ + dz, { rx: Math.PI / 2, seg: 10 });
    B.box(11, 17, 8.4, C.rack, RX, 10.5, RZ, { cast: true });
    for (let i = 0; i < 3; i++) {
      const y = 4.9 + i * 5.3, zf = RZ + 4.4;
      B.box(10.2, 4.7, 0.4, C.instr, RX, y, zf);
      U.box(5.2, 3.3, 0.1, '#0d1914', RX - 1.9, y + 0.1, zf + 0.25);                       // 画面
      for (let k = 0; k < 3; k++) B.cyl(0.42, 0.4, C.knob, RX + 2.4 + (k % 2) * 1.6, y + 1.2 - k * 1.1, zf + 0.35, { rx: Math.PI / 2, seg: 8 });
      if (i === 2) {
        // 上: 波形と、その上の要求の線（赤）
        U.box(4.6, 0.12, 0.08, '#e0473a', RX - 1.9, y + 1.15, zf + 0.33);
        for (let s = 0; s < 8; s++) {
          const h = 0.3 + rnd(s * 3) * 1.4;
          U.box(0.5, h, 0.08, '#57e08a', RX - 4.0 + s * 0.6, y - 1.2 + h / 2, zf + 0.33);
        }
      } else if (i === 1) {
        // 中: 棒の計器。要求の線の手前で止まる（tick）
        U.box(4.6, 0.14, 0.08, '#e0473a', RX - 1.9, y + 1.3, zf + 0.33);
        for (let c = 0; c < 3; c++) {
          BAS.push({ kind: 'gauge', x: RX - 3.4 + c * 1.5, y: y - 1.4, z: zf + 0.31, w: 1.0, d: 0.08, len: 1, max: 2.45, color: c === 2 ? '#e6d05a' : '#5fe08f', ph: c * 0.8 });
        }
      } else {
        U.box(2.4, 0.9, 0.08, '#ffb43a', RX - 2.6, y + 0.6, zf + 0.33);
      }
    }
    // ラックの上のノートPC（開いて、グラフを映している）
    B.box(7, 0.5, 5, C.laptop, RX, 19.25, RZ + 0.6);
    B.box(7, 4.6, 0.3, C.laptop, RX, 19.5, RZ - 1.8, { at: [0, 2.3, 0], rx: -0.22 });
    U.box(6.2, 3.8, 0.08, '#1e3a52', RX, 19.5, RZ - 1.8, { at: [0, 2.35, 0.2], rx: -0.22 });
    U.box(4.6, 0.12, 0.08, '#e0473a', RX, 19.5, RZ - 1.8, { at: [0, 3.5, 0.26], rx: -0.22 });
    for (let s = 0; s < 6; s++) U.box(0.6, 0.6 + s * 0.28, 0.08, '#7fb8e8', RX, 19.5, RZ - 1.8, { at: [-2.2 + s * 0.85, 1.0 + (0.6 + s * 0.28) / 2, 0.26], rx: -0.22 });
  }

  // ===== 西の窓（x > WIN0）: 日が沈んだばかりの空 → 夜（skyOf）=====
  {
    // 窓まわりの横材は柱の中から始める（柱の側面・前面と同じ面に重ねない）
    const w0 = WIN0 + 2, mid = (w0 + XR) / 2, len = XR - w0;
    B.box(len, 0.9, 1.4, C.sash, mid, 29, BACK - 0.6);                                     // 無目
    B.box(len, 0.7, 3.0, C.sill, mid, WB + 0.35, BACK + 0.3);                               // 窓台（前面 BACK+1.8。柱の前面より奥）
    for (let c = WIN0 + 3; c < XR; c += 64) {
      for (let i = 1; i < 4; i++) if (c + i * 16 < XR) B.box(0.9, WT - WB, 1.4, C.sash, c + i * 16, (WB + WT) / 2, BACK - 0.6);   // 方立
    }
    Gl.box(len, WT - WB, 0.15, C.glass, mid, (WB + WT) / 2, BACK - 1.1);
    // ブラインド。ところどころ半分まで下ろしてある（羽根の隙間から残照がのぞく）
    // 柱と柱の間（c+3〜c+61）を、方立で 13・16・16・13 の4枚に分ける
    const bays = [[3.4, 15.6], [16.4, 31.6], [32.4, 47.6], [48.4, 60.6]];
    for (let c = WIN0 + 3, j = 0; c < XR - 10; c += 64, j++) {
      bays.forEach(([a, b], i) => {
        const low = [24, 31, 0, 27, 0, 22, 33][(j * 4 + i) % 7];
        if (!low || c + b > XR) return;
        const bx = c + (a + b) / 2, bw = b - a;
        B.box(bw, 0.9, 1.0, C.sash, bx, WT - 0.5, BACK + 0.3);
        for (let y = WT - 1.6; y > low; y -= 0.95) B.box(bw - 0.2, 0.3, 0.95, C.blind, bx, y, BACK + 0.3, { rx: 0.5 });
        B.box(bw, 0.5, 1.1, C.sash, bx, low - 0.2, BACK + 0.3);                              // 下の重り
      });
    }

    // 窓の外。カメラは窓より高い所から見下ろすので、本物の距離に置くと窓には屋上しか入らない。
    // 書き割りにする: 手前に隣の棟の屋上、その奥に構内の建屋の影、遠くの低い山並み、空。
    const OUT = (d) => BACK - 2 - d;
    const ox0 = WIN0 - 100, ox1 = XR + 260, om = (ox0 + ox1) / 2, ow = ox1 - ox0;
    // 隣の棟の屋上（奥へ上がる板）と、屋上の設備
    O.box(ow, 0.6, 31, '#2c323a', om, 7.0, OUT(19), { rx: 0.1 });
    O.box(ow - 2, 1.4, 1.0, '#3a414a', om, 7.4, OUT(3.5));
    for (let x = WIN0 - 60, i = 0; x < XR + 200; x += 37 + (i % 3) * 11, i++) {
      const dz = 12 + (i % 3) * 6;
      O.box(6 + (i % 2) * 3, 3.0, 4.5, '#363d46', x, 6.9 + dz * 0.1, OUT(dz));
      O.box(3.6, 0.6, 3.6, '#2a3038', x + 1, 8.7 + dz * 0.1, OUT(dz));
    }
    // 構内の建屋（影）。窓の灯りは夜が深まるほど増える（BAS の閾値）
    const bldg = (x, d, w, h, seed) => {
      const z = OUT(d), y0 = 2;
      O.box(w, h, 10, '#1d232c', x, y0 + h / 2, z);
      O.box(w + 0.4, 0.8, 10.4, '#2a313b', x, y0 + h + 0.4, z);
      const rows = Math.floor((h - 3) / 2.6), cols = Math.floor((w - 2) / 3.2);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const s = seed * 97 + r * 13 + c * 7;
        if (rnd(s) < 0.42) continue;
        const th = rnd(s + 5) * 1.25 - 0.3;                    // この窓が点く進み具合（負なら初めから点いている）
        BAS.push({ kind: 'win', x: x - w / 2 + 2.4 + c * 3.2, y: y0 + 2.2 + r * 2.6, z: z + 5.1, w: 1.9, d: 0.1, len: 1.2,
          color: rnd(s + 9) < 0.7 ? '#ffd88a' : '#cfe4ff', th });
      }
    };
    bldg(512, 44, 34, 15, 1); bldg(556, 58, 26, 19, 2); bldg(604, 46, 40, 13, 3); bldg(660, 60, 30, 21, 4);
    bldg(708, 44, 36, 16, 5); bldg(760, 56, 28, 18, 6); bldg(470, 60, 30, 17, 7); bldg(812, 48, 40, 14, 8);
    // 煙突と、てっぺんの航空障害灯（赤く明滅）
    O.box(3.6, 22, 3.6, '#262c35', 632, 2 + 11, OUT(70));
    O.box(4.4, 1.2, 4.4, '#323a44', 632, 24.4, OUT(70));
    BAS.push({ kind: 'blink', x: 632, y: 25.0, z: OUT(70) + 2.3, w: 1.2, d: 0.2, len: 1.0, color: '#ff3a2a', ph: 0 });
    // 試験塔（格子の塔と、てっぺんの白い球）。最後の残照を受けて、いちばん明るい影
    {
      const tx = 548, d = 76, z = OUT(d);
      for (const dx of [-2.0, 2.0]) O.box(0.6, 15, 0.6, '#2b323c', tx + dx, 2 + 7.5, z);
      for (let i = 0, y = 4; y < 16.5; y += 3.0, i++) O.box(4.6, 0.35, 0.4, '#2b323c', tx, y, z, { rz: i % 2 ? 0.55 : -0.55 });
      O.box(5.2, 0.6, 5.2, '#2b323c', tx, 17.2, z);
      O.geo(new THREE.SphereGeometry(3.6, 14, 10), '#a99aa8', tx, 20.8, z);
      BAS.push({ kind: 'blink', x: tx, y: 24.4, z: z + 0.2, w: 0.8, d: 0.8, len: 0.8, color: '#ff3a2a', ph: 0.7 });
    }
    // 遠くの低い山並み（地平線の残照の手前）
    for (let i = 0, x = WIN0 - 80; x < XR + 260; x += 46 + (i % 3) * 17, i++) {
      O.cyl(30 + (i % 4) * 8, 2, i % 2 ? '#2a2c40' : '#30304a', x, 1.2 + (i % 3) * 0.9, OUT(98) - (i % 2), { rx: Math.PI / 2, seg: 18, sy: 0.14 });
    }
    anim = { sky: skyMesh(ox0, ox1, OUT(110)) };
  }

  // ===== 手前: こちらの席（下座）=====
  // 本編と同じ長机。願い出の束が、右へ行くほど増える（何度も、何度も）。椅子はまばら。
  // 手前は低い物だけ（帯の手前端の人の足元より上に、幅の広い物を出さない）
  const FZ = halfD + 26;      // 54
  for (let k = 0, x = 10; x < XR - 30; x += 58, k++) {
    const w = 46, d = 12;
    B.box(w, 1.0, d, C.desk, x, 8.2, FZ);
    B.box(w - 2, 0.25, d - 4, C.mat, x, 8.83, FZ);
    B.box(w - 0.6, 6.4, 0.8, C.skirt, x, 4.5, FZ - d / 2 + 0.6);                            // 幕板（帯の側）
    for (const dx of [-(w / 2 - 0.8), w / 2 - 0.8]) B.box(0.9, 7.7, d - 1, C.skirt, x + dx, 3.85, FZ);
    // 椅子（2脚の机、1脚の机、無い机）
    const nc = [2, 1, 2, 0, 1, 2, 1, 0, 1, 1, 0, 1][k % 12];
    for (let i = 0; i < nc; i++) seat(x - 10 + i * 17 + (rnd(k * 5 + i) - 0.5) * 3, FZ + 9.5, 0, -1, C.chair, (rnd(k + i * 9) - 0.5) * 0.5);
    // 願い出の束。帯の側の半分に並べ、2段まで（手前の線より上に出さない）。右の机ほど多い
    const n = Math.min(8, 2 + k);
    for (let i = 0; i < n; i++) {
      const col = i % 4, layer = Math.floor(i / 4);
      bundle(x - 18 + col * 6.2 + (rnd(k * 9 + i) - 0.5) * 1.0, 8.96 + layer * 1.25, 51.8 + (rnd(k + i * 3) - 0.5) * 0.8,
        (rnd(i * 7 + k) - 0.5) * 0.3);
    }
    // 奥の半分: 図面（広げた図面か、丸めた図面）・寝かせたバインダー・赤の入った下書き
    const yt = 8.96, zb = 56.9;
    if (k % 2 === 0) {
      B.box(13, 0.06, 6.6, '#dce6ee', x - 13, yt + 0.03, zb, { ry: 0.06 });                 // 広げた図面
      for (let i = 0; i < 5; i++) B.box(7 + rnd(k + i) * 4, 0.04, 0.16, '#5679a6', x - 14 + rnd(i * 3 + k), yt + 0.08, zb - 2.4 + i * 1.2, { ry: 0.06 });
      B.box(0.16, 0.04, 4.6, '#5679a6', x - 17.5, yt + 0.08, zb, { ry: 0.06 });
      B.box(4.2, 0.04, 2.2, '#8fa9c4', x - 9.5, yt + 0.12, zb + 1.9, { ry: 0.06 });          // 表題欄（無地。線より一段上）
    } else {
      for (let i = 0; i < 3; i++) B.cyl(0.5, 9.5, i === 1 ? '#cfe0ee' : '#e6edf2', x - 13 + i * 0.3, yt + 0.5 + (i === 2 ? 0.92 : 0), zb - 1.6 + i * 1.05, { rz: Math.PI / 2, ry: 0.12 * (i - 1), seg: 10 });
    }
    for (let i = 0, nb = 1 + (k % 3); i < nb; i++) B.box(3.4, 0.85, 4.6, SERIES[(k + i * 2) % SERIES.length], x - 1.5, yt + 0.43 + i * 0.86, zb + 0.4, { ry: (rnd(k * 5 + i) - 0.5) * 0.3 });
    if (k % 3 !== 1) {                                                                     // 赤の入った下書き
      B.box(4.4, 0.05, 3.2, '#f4f4ee', x + 5, yt + 0.03, zb + 0.6, { ry: -0.15 });
      for (let i = 0; i < 3; i++) B.box(1.8 + rnd(k + i) * 1.6, 0.04, 0.16, '#cc3a30', x + 4.4 + rnd(i * 5 + k), yt + 0.08, zb - 0.4 + i * 0.8, { ry: -0.15 });
    }
    // 机ごとに少しずつ違う物（閉じたノートPC・紙コップ・ペン）
    if (k % 3 === 1) B.box(6.4, 0.5, 4.4, C.laptop, x + 12, yt + 0.25, zb, { ry: 0.1 });
    if (k % 2 === 0) B.cyl(0.6, 1.6, '#f2f2ee', x + 19, yt + 0.8, zb - 0.8, { seg: 10 });
    B.box(3.2, 0.25, 0.3, '#2a3a4a', x + 9 + rnd(k) * 3, yt + 0.13, zb + 2.6, { ry: rnd(k * 3) });
  }
  // 帯と机の間の床に、低い文書箱（1段だけ）
  for (const [x, z, s] of [[-58, 44, 21], [-94, 41, 22], [-122, 46, 23], [150, 41, 24], [298, 43, 25], [544, 42, 26]]) {
    docBox(x, 0, z, (rnd(s) - 0.5) * 0.4, rnd(s * 3) < 0.5);
  }

  // ===== まとめて描く =====
  B.done(new THREE.MeshLambertMaterial({ vertexColors: true }));
  U.done(new THREE.MeshBasicMaterial({ vertexColors: true }), false);
  const outMesh = O.done(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), false)[0];
  Gl.done(new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.1, depthWrite: false, emissive: 0x16243a,
  }), false);
  const lam = instanced(LAM, new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const bas = instanced(BAS, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));

  const s0 = skyOf(st);
  anim = { ...anim, out: outMesh, lam, bas, LAM, BAS, stage: st, p: p0, ps: s0, t0: null };
  paintSky(anim.sky, s0);
  tint(s0);
  step(0, 1);
}

// 夜が深まるほど、窓の外の影を暗くする
function tint(p) {
  if (anim && anim.out) anim.out.material.color.copy(OUT_A).lerp(OUT_B, p);
}

// 動く物を t（この場面に入ってからの秒）で置き直す
function step(tt, kouki) {
  const a = anim;
  if (a.lam) {
    // 延長の線: 残工期が少ないほど初めから長い。そこから数秒ごとに一目盛りずつ伸びる（引き直すたび）
    const base = 0.25 + 0.45 * (1 - clamp01(kouki));
    a.LAM.forEach((it, i) => {
      if (it.kind === 'ext') {
        const u = tt / 5.5 + (it.ph % 1), n = Math.floor(u), f = ease((u - n) / 0.12);
        const k = clamp01(base + (n + f) * 0.06);
        place(a.lam, i, it, it.min + (it.max - it.min) * k);
      } else if (it.kind === 'hour' || it.kind === 'min') {
        // 17:30 から、ゲームの1秒で2分進む
        const minutes = 17 * 60 + 30 + tt * 2;
        const ang = it.kind === 'min' ? (minutes % 60) / 60 * Math.PI * 2 : (minutes / 60 % 12) / 12 * Math.PI * 2;
        it.rz = -ang;
        place(a.lam, i, it, it.len);
      }
    });
    a.lam.instanceMatrix.needsUpdate = true;
  }
  if (a.bas) {
    a.BAS.forEach((it, i) => {
      if (it.kind === 'gauge') {
        // 測っては落ちる。いちばん上（要求の線）の手前で止まって震える
        const T = 4.6, u = (tt + it.ph * T) % T;
        let lv;
        if (u < 1.4) lv = ease(u / 1.4) * 0.9;
        else if (u < 3.7) lv = 0.9 + 0.035 * Math.sin(tt * 11 + it.ph * 5);
        else lv = 0.9 * (1 - ease((u - 3.7) / 0.9));
        place(a.bas, i, it, Math.max(0.05, it.max * lv));
      } else if (it.kind === 'led') {
        place(a.bas, i, it, (tt % 1.0) < 0.55 ? it.len : 0);
      } else if (it.kind === 'blink') {
        place(a.bas, i, it, ((tt + it.ph) % 1.6) < 0.55 ? it.len : 0);
      } else if (it.kind === 'win') {
        place(a.bas, i, it, a.ps > it.th ? it.len : 0);
      }
    });
    a.bas.instanceMatrix.needsUpdate = true;
  }
}

export function onEvent(name, arg) {
  if (!anim) return;
  if (name !== 'tick') return;
  const t = (arg && arg.t) || 0, dt = Math.min(0.1, (arg && arg.dt) || 0);
  if (anim.t0 == null) anim.t0 = t;
  const tt = t - anim.t0;
  // 進み具合（日の暮れ方）。自機の位置に、ゆっくり追いつかせる
  // 歩いているあいだは追いかける。途中から始めた（場面を張った後に自機が飛んだ）ときは、すぐ合わせる
  const follow = (cur, target) => (Math.abs(target - cur) > 0.15 ? target : cur + (target - cur) * Math.min(1, dt * 1.2));
  const tp = progressOf(anim.stage), ts = skyOf(anim.stage);
  if (Math.abs(tp - anim.p) > 0.0005) {
    anim.p = follow(anim.p, tp);
    applyLight(anim.p);
  }
  if (Math.abs(ts - anim.ps) > 0.0005) {
    anim.ps = follow(anim.ps, ts);
    paintSky(anim.sky, anim.ps);
    tint(anim.ps);
  }
  step(tt, arg && arg.kouki != null ? arg.kouki : 1);
}

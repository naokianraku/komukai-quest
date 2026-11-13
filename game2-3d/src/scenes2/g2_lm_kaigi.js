// 小向クエスト2 ゴールデンエイジ編 — 第5章 LM社編 ボス戦「試験台の見える会議室」
//
// 巨大な相手の、格の高い会議室。濃紺と金の内装で、奥の壁が一面の窓になっている。
// 窓の向こうは試験場。加振機（振動試験台）の上に試験品（抽象の装置）が載り、試験中の緑の灯りが点いている。
// 「設計は通る。だが試験で裏切られる」を、窓越しに見せる場面。
//
// 間取り（ワールドの x。W=633 のとき）:
//   〜PX(=W-88)  廊下。紺の腰壁に金の見切り、額（文字なし）、展示棚。単騎のボス戦で見ている同期と主担当はここ
//                （仕切りを W-100 より少し右に置くのは、?boss=1 で見物の2人が x=533/541 に立つため）
//   PX           ガラスの仕切り（帯を横切るので見た目だけ。細い枠と、ごく薄いガラス）
//   PX〜         会議室。奥に長い会議机（クリーム色の天板・金の縁・紺の革椅子）、その奥が窓
//   窓の奥       試験場。加振機と試験品（TX=W-36）、計測ラック、信号灯、環境試験槽、予備の試験品、天井クレーン
// 試験台の正面にあたる机の向こう側には椅子を置かない（相手は窓ぎわで試験を見ていた、の見立て。試験台を隠さないため）。
// 自機の頭の後ろ（画面の高さ px300〜340）にはクリーム色の天板が来るようにして、暗い椅子を背負わせない。
//
// 出来事:
//   revive（1回目）… 試験品が壊れる。閃光と火花、灰色の煙。円盤が垂れ、横の筒が台に落ちる。灯りが赤の点滅に
//   revive（2回目）… さらに壊れる。円盤がもげて台に落ち、本体が傾き、前の蓋が外れる。黒い煙が太くなる
//   kuchidashi     … 会議机の上の変更要求の紙の山が高くなる（紙がボスの方から飛んできて積もる）
//   defeated       … 試験が止まる（揺れが止まる）
// build のたびに、試験品は無傷・紙の山は少しの状態から始まる。動く物は build の頭で作り直す。
//
// 描画の回数: 動かない物は4回（影あり・なし・光る物・ガラス）＋天井。動く物は試験品の4部品・紙の山・
// 信号灯・火花と煙（それぞれインスタンス1回）など。壊れていないときは合わせて15回ほど。
//
// 文字・ロゴ・社章・旗・地名は描かない。相手先は「巨大な防衛メーカー」の類型で、実在企業の色には寄せない。
import { THREE, S, wx, wz, box, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, chair, fireRow, scene, hemi, sun, fill, ROOM } from '../../../game3d/src/render3d.js';

// ===== 色 =====
const C = {
  fog: '#8e98aa',
  // 会議室（濃紺と金）
  carpet: '#404b74', carpetB: '#3b456c', rug: '#323b62', navy: '#27315b', navyDark: '#1b2241',
  mullion: '#1e2646', gold: '#c9a54e', goldPale: '#d8c48e', ceiling: '#eef0f3', glass: '#dbe8f3',
  top: '#ece7dc', base: '#232b4f', chair: '#1f2848', chairHi: '#2b3661', chrome: '#aeb4bc',
  paper: '#f7f6f1', paperB: '#e9e7de', cup: '#f4f4f1', water: '#cddfea', phone: '#2c3038',
  binder: '#2b3667', ours: '#8ea6bd', plant: '#3f6e48', plantB: '#4f8255', pot: '#27315b',
  tabs: ['#f0d24a', '#f08aa2', '#7ab2ea', '#8fd27a'],
  // 廊下
  hall: '#676b79', wallUp: '#e2e2e7', wallTrim: '#c9cad2', door: '#2c3764', wood: '#8a6a48',
  // 試験場（白く明るい）
  bayFloor: '#c4c8cd', bayJoint: '#b1b6bc', bayLine: '#e2bb2e', bayWall: '#d7dbe0', bayRib: '#c4c9cf', bayDado: '#a9afb7',
  concrete: '#a9abaa', hazard: '#e2b92e', black: '#25272b',
  shakerBase: '#2f3642', shaker: '#3c4452', shakerBand: '#2a313c', armature: '#8e97a4', plate: '#bcc3cb',
  article: '#d9dde3', articleDk: '#a5acb6', panel: '#4b5878', fin: '#5a616c', disc: '#eef0f2', canister: '#c6ccbf',
  sensor: '#3d7fd8', board: '#2f7a4a', rack: '#2b313b', steel: '#8d949e', steelDk: '#4b525d',
  crane: '#d3ab36', chamber: '#e6e8ea',
};

// 決まった乱数（毎回同じ部屋になるように）
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ===== 形をまとめて1メッシュにする =====
// render3d の boxBatch と同じ考え（頂点カラーで色ごとに分けない）で、円柱も混ぜられ、回し方も選べる版。
// 置き方: at だけずらす → X・Z・Y の順に回す → 拡縮 → x,y,z へ動かす → post の手順（椅子ごと回す等）。
function shapes() {
  const list = [];
  let idx = 0;
  const api = {
    add(g, color, steps) {
      for (const s of steps) {
        if (s[0] === 't') g.translate(s[1], s[2], s[3]);
        else if (s[0] === 'rx') g.rotateX(s[1]);
        else if (s[0] === 'ry') g.rotateY(s[1]);
        else if (s[0] === 'rz') g.rotateZ(s[1]);
        else if (s[0] === 's') g.scale(s[1], s[2], s[3]);
      }
      list.push([g, color]);
      idx += g.index ? g.index.count : g.attributes.position.count;
      return api;
    },
    box(w, h, d, color, x, y, z, o = {}) { return api.add(new THREE.BoxGeometry(w, h, d), color, steps(o, x, y, z)); },
    // 円柱（軸は y。寝かせるなら rx / rz）。r2 で上の半径、seg で角の数（3 なら三角柱）
    cyl(r, h, color, x, y, z, o = {}) {
      return api.add(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 14), color, steps(o, x, y, z));
    },
    get indexCount() { return idx; },
    get size() { return list.length; },
    geometry() { const g = merge(list); list.length = 0; idx = 0; return g; },
  };
  return api;
}
function steps(o, x, y, z) {
  const s = [];
  if (o.at) s.push(['t', o.at[0], o.at[1], o.at[2]]);
  if (o.rx) s.push(['rx', o.rx]);
  if (o.rz) s.push(['rz', o.rz]);
  if (o.ry) s.push(['ry', o.ry]);
  if (o.sx || o.sy || o.sz) s.push(['s', o.sx || 1, o.sy || 1, o.sz || 1]);
  s.push(['t', x, y, z]);
  if (o.post) s.push(...o.post);
  return s;
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
const litMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });
// 動かない物を1つのメッシュにして置く（影を落とすのは cast を付けた物だけ）
function addStatic(sh, mat, cast = false, receive = true) {
  if (!sh.size) return null;
  const m = new THREE.Mesh(sh.geometry(), mat);
  m.castShadow = cast; m.receiveShadow = receive;
  m.matrixAutoUpdate = false; m.updateMatrix();
  addScenery(m);
  return m;
}
// 単色の光る板・灯り（照明に左右されない）。点滅させる物に使う
function lampMesh(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: hex(color), transparent: !!opts.additive, opacity: 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.additive,
  }));
  m.castShadow = false; m.receiveShadow = false;
  return m;
}

// ===== 動く物と状態。build のたびに作り直す（前の章のメッシュを掴んだままにしない）=====
let A = null;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function build(W, halfD, ctx = {}) {
  A = null;
  const { BACK, FRONT } = zones(halfD, 38, 70);          // 奥 -66 / 手前 98
  setLighting(false);
  // 第5章（坂 0.82）: 冷たく、少し暗い。部屋は濃紺で沈み、窓の向こうの試験場だけが白く明るい
  hemi.color.set('#d8e0ee'); hemi.groundColor.set('#485068'); hemi.intensity = 1.78;
  sun.color.set('#e9effa'); sun.intensity = 0.86; fill.intensity = 0.9;
  scene.background = hex(C.fog);
  scene.fog = new THREE.Fog(hex(C.fog), 300, 1000);

  // ボス戦のカメラは右端へ寄ると奥の壁で x=W+90 まで見える。左は廊下が続く
  const XL = -150, XR = W + 160, XM = (XL + XR) / 2, XW = XR - XL;
  const PX = W - 88;              // ガラスの仕切り
  const HZ = -42;                 // 廊下の壁の面（部屋の窓より手前）
  const WB = 5, WT = 44;          // 窓の下端・上端（上端は天井に隠れる）
  const TX = W - 36, TZ = -102;   // 試験台の中心（窓の奥 36）
  const TY = 12.7;                // 試験品の載る面（加振機の頭の板の上面）
  const T = { x0: PX + 12, x1: W + 55, z: -41, d: 15, y: 8.6 };   // 会議机
  const TT = T.y + 0.55;          // 天板の上面
  const PILE_X = PX + 22, PILE_Z = -37.2;   // 代理店（x=W-50）の頭に隠れない、机の左寄り

  const B = shapes();    // 照明が当たる・動かない・影を落とさない
  const BC = shapes();   // 同・影を落とす（奥ゾーンの大物だけ）
  const G = shapes();    // 光る物（照明に左右されない色）
  const GL = shapes();   // ガラス

  // ===== 床 =====
  // 会議室: 紺の絨毯に、ごく薄い市松。机の下に一段濃い敷物と金の縁
  B.box(XR - PX, 2, FRONT - BACK, C.carpet, (PX + XR) / 2, -1, (FRONT + BACK) / 2);
  for (let i = 0, x = PX + 6; x < XR; x += 12, i++) {
    for (let j = 0, z = BACK + 6; z < 74; z += 12, j++) if ((i + j) % 2) B.box(12, 0.04, 12, C.carpetB, x, 0.02, z);
  }
  {
    const r0 = T.x0 - 9, r1 = T.x1 + 9, z0 = -61, z1 = -29;
    B.box(r1 - r0, 0.06, z1 - z0, C.rug, (r0 + r1) / 2, 0.03, (z0 + z1) / 2);
    B.box(r1 - r0, 0.04, 0.6, C.gold, (r0 + r1) / 2, 0.07, z1 - 1.2);
    B.box(r1 - r0, 0.04, 0.6, C.gold, (r0 + r1) / 2, 0.07, z0 + 1.2);
    B.box(0.6, 0.04, z1 - z0 - 1.8, C.gold, r0 + 1.2, 0.07, (z0 + z1) / 2);
    B.box(0.6, 0.04, z1 - z0 - 1.8, C.gold, r1 - 1.2, 0.07, (z0 + z1) / 2);
  }
  // 廊下: 灰色のタイルカーペット。壁ぎわに紺の帯
  B.box(PX - XL, 2, FRONT - HZ, C.hall, (XL + PX) / 2, -1, (FRONT + HZ) / 2);
  B.box(PX - XL, 0.05, 3, C.navy, (XL + PX) / 2, 0.025, HZ + 1.5);
  for (let x = XL + 10; x < PX - 2; x += 10) B.box(0.2, 0.03, FRONT - HZ - 3, '#626672', x, 0.015, (FRONT + HZ + 3) / 2);
  // 仕切りの下枠（金の見切り。帯を横切る床の線）
  B.box(1.0, 0.14, 40 - HZ, C.gold, PX, 0.07, (HZ + 40) / 2);

  // ===== 奥の壁 =====
  // 廊下の壁（z=HZ）: 紺の腰壁・金の見切り・明るい上壁。見切りは扉のところで切る（扉の位置は下で決める）
  const doors = [];
  for (let x = PX - 70; x > XL + 8; x -= 96) doors.push(x);
  B.box(PX - XL, 11, 2, C.navy, (XL + PX) / 2, 5.5, HZ - 1);
  B.box(PX - XL, 53, 2, C.wallUp, (XL + PX) / 2, 37.5, HZ - 1);
  B.box(PX - XL, 0.9, 0.5, C.navyDark, (XL + PX) / 2, 0.45, HZ + 0.25);   // 幅木
  B.box(PX - XL, 1.2, 0.6, C.wallTrim, (XL + PX) / 2, 41.2, HZ + 0.3);    // 天井ぎわの見切り
  {
    let x = PX;
    for (const d of doors) {                                               // 右から左へ、扉と扉の間に見切り
      const a = d + 7, len = x - a;
      if (len > 0.5) B.box(len, 0.9, 0.8, C.gold, a + len / 2, 11.2, HZ + 0.4);
      x = d - 7;
    }
    if (x - XL > 0.5) B.box(x - XL, 0.9, 0.8, C.gold, (XL + x) / 2, 11.2, HZ + 0.4);
  }
  // 部屋の左の壁（仕切りの奥。窓の壁と廊下の壁をつなぐ）
  B.box(2, 64, HZ - BACK + 2, C.navy, PX + 1, 32, (HZ + BACK) / 2 - 1);
  // 窓の壁（z=BACK）: 腰と垂れ壁は紺、窓台は金。床から天井までの大きな窓
  B.box(XR - PX, WB, 2, C.navy, (PX + XR) / 2, WB / 2, BACK - 1);
  B.box(XR - PX, 64 - WT, 2, C.navy, (PX + XR) / 2, (64 + WT) / 2, BACK - 1);
  B.box(XR - PX - 2, 0.7, 3.0, C.gold, (PX + 2 + XR) / 2, WB + 0.35, BACK - 0.5);
  for (let x = PX + 2.6; x <= XR + 0.1; x += 19) B.box(1.3, WT - WB, 1.8, C.mullion, x, (WB + WT) / 2, BACK - 0.6);
  GL.box(XR - PX - 2, WT - WB, 0.2, C.glass, (PX + 2 + XR) / 2, (WB + WT) / 2, BACK - 1.0);
  for (const [x, y] of [[PX + 40, 24], [W + 8, 21], [W + 62, 26], [W + 120, 22]]) {     // ガラスの映り込み（斜めの筋）
    GL.box(1.4, 26, 0.04, '#ffffff', x, y, BACK - 0.86, { rz: 0.5 });
    GL.box(0.6, 20, 0.04, '#ffffff', x + 3.2, y - 1, BACK - 0.86, { rz: 0.5 });
  }
  // 天井（手前は z=40 で切る）。本編の ceilingSlab に、左右の延長を足す
  ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  B.box(-40 - XL, 2, 40 - BACK, C.ceiling, (XL - 40) / 2, 47, (40 + BACK) / 2);
  B.box(XR - W - 40, 2, 40 - BACK, C.ceiling, (W + 40 + XR) / 2, 47, (40 + BACK) / 2);

  // ===== ガラスの仕切り（帯を横切る。見た目だけの細い枠と、ごく薄いガラス）=====
  GL.box(0.2, 40, 40 - HZ, C.glass, PX, 20, (HZ + 40) / 2);
  B.box(0.9, 1.2, 40 - HZ, C.navyDark, PX, 40.6, (HZ + 40) / 2);          // 上枠
  B.box(1.0, 0.3, 40 - HZ, C.gold, PX, 39.85, (HZ + 40) / 2);
  B.box(1.2, 40, 1.2, C.navyDark, PX, 20, HZ + 0.6);                       // 壁ぎわの方立
  B.box(0.24, 0.7, 40 - HZ - 1.2, C.goldPale, PX, 9.2, (HZ + 1.2 + 40) / 2);   // ぶつからないための帯
  for (const z of [-15, 15]) B.box(0.22, 38.5, 0.22, '#5d6680', PX, 19.6, z);   // ガラス扉の縁

  // ===== 廊下: 額・壁の灯り・扉（左へ同じ並びの繰り返し）=====
  const picture = (x, kind) => {
    const y = 22, w = 16, h = 10, z = HZ;
    B.box(w + 1.4, h + 1.4, 0.5, C.gold, x, y, z + 0.25);
    if (kind === 0) {             // 試験場の写真（空・遠い山・荒れ地・滑走路）。文字なし
      B.box(w, h * 0.56, 0.2, '#a9c6de', x, y + h * 0.22, z + 0.6);
      B.box(w, h * 0.16, 0.2, '#8e9aa6', x, y - h * 0.08, z + 0.62);
      B.box(w, h * 0.3, 0.2, '#bba986', x, y - h * 0.35, z + 0.6);
      B.box(w * 0.7, 0.5, 0.1, '#6f7377', x - 1.5, y - h * 0.3, z + 0.75);
      B.box(4, 1.2, 0.1, '#8e9aa6', x + 3.5, y + 0.1, z + 0.75, { rz: 0.25 });
    } else {                      // 図面の額（紺地に白い線）
      B.box(w, h, 0.2, '#22305c', x, y, z + 0.6);
      for (let i = 0; i < 4; i++) B.box(9 - i * 1.6, 0.2, 0.08, '#c9d6ea', x - 1 + i * 0.5, y + 3 - i * 1.9, z + 0.74);
      B.box(0.2, 7, 0.08, '#c9d6ea', x - 5.5, y, z + 0.74);
      B.box(5.5, 0.2, 0.08, '#c9d6ea', x + 3.5, y - 2.5, z + 0.74, { rz: 0.6 });
      B.box(3, 3, 0.08, '#3b4a78', x + 4.5, y + 1.8, z + 0.72);
    }
  };
  const sconce = (x) => {
    B.box(1.6, 3.2, 0.4, C.gold, x, 25, HZ + 0.2);
    G.box(2.6, 1.6, 1.4, '#fff0d4', x, 26.4, HZ + 1.1);
    B.box(2.8, 0.4, 1.6, C.gold, x, 25.4, HZ + 1.1);
  };
  const door = (x) => {
    B.box(13, 24, 0.6, C.navyDark, x, 12, HZ + 0.3);
    B.box(11, 22.6, 0.4, C.door, x, 11.3, HZ + 0.8);
    B.box(11, 2.4, 0.1, C.gold, x, 1.4, HZ + 1.05);                        // 蹴り板
    B.box(2.6, 0.5, 0.7, C.gold, x + 3.6, 10.6, HZ + 1.3);                 // 取っ手
    B.box(1.6, 2.6, 0.5, C.black, x + 9.2, 14.5, HZ + 0.25);               // カード読み取り機
    G.box(0.5, 0.5, 0.1, '#ff4a3a', x + 9.2, 15.3, HZ + 0.55);
  };
  for (let k = 0, x = PX; x > XL; x -= 96, k++) {
    if (x - 26 > XL + 9) picture(x - 26, k % 2);
    if (x - 48 > XL) sconce(x - 48);
    if (x - 92 > XL) sconce(x - 92);
  }
  for (const d of doors) door(d);
  // ガラス扉の脇のカード読み取り機
  B.box(1.6, 2.6, 0.5, C.black, PX - 6, 14.5, HZ + 0.25);
  G.box(0.5, 0.5, 0.1, '#46e07a', PX - 6, 15.3, HZ + 0.55);
  // 展示棚（腰の高さ）。中に試験品の縮尺模型。説明札は無地
  {
    const x = PX - 46, z = -37.5;
    BC.box(16, 7, 6, C.navy, x, 3.5, z);
    B.box(16.4, 0.5, 6.4, C.gold, x, 7.25, z);
    GL.box(15.4, 6, 5.4, C.glass, x, 10.5, z);
    for (const dx of [-7.6, 7.6]) for (const dz of [-2.6, 2.6]) B.box(0.3, 6, 0.3, C.gold, x + dx, 10.5, z + dz);
    B.box(15.8, 0.4, 5.8, C.gold, x, 13.7, z);
    B.box(4, 2.4, 3, C.article, x - 3, 8.7, z);
    B.cyl(0.4, 1.2, C.articleDk, x - 3, 10.5, z, { seg: 8 });
    B.cyl(1.9, 0.3, C.disc, x - 3, 12.3, z + 0.3, { rx: Math.PI / 2 - 0.42, seg: 18 });
    B.box(2.6, 0.9, 1.6, C.steelDk, x + 3.5, 7.95, z);
    B.box(3.2, 1.2, 0.15, C.gold, x + 4, 8.6, z + 2.0, { rx: -0.5 });
  }
  // 仕切りの脇の背の高い鉢植え
  const plant = (x, z, h, sh = B) => {
    sh.cyl(2.5, 4.6, C.pot, x, 2.3, z, { seg: 12 });
    sh.box(5.4, 0.4, 5.4, C.gold, x, 4.7, z, { ry: 0.4 });
    sh.box(0.6, h * 0.6, 0.6, '#5a4a38', x, 4.6 + h * 0.3, z);
    for (let i = 0; i < 5; i++) {
      sh.box(5.6 - i * 0.6, 3.2, 5.6 - i * 0.6, i % 2 ? C.plant : C.plantB, x + (rnd(i + x) - 0.5) * 2,
        6.5 + i * (h - 7) / 5, z + (rnd(i * 3 + x) - 0.5) * 1.6, { ry: i * 0.7 });
    }
  };
  plant(PX - 12, -36.5, 17);
  // 手前（低い物だけ）: 待つためのベンチと低い鉢
  for (let x = PX - 52; x > XL; x -= 192) {
    B.box(22, 1, 6, C.wood, x, 4.0, 42);
    for (const dx of [-9.5, 9.5]) B.box(1, 3.5, 5, C.chrome, x + dx, 1.75, 42);
  }
  for (let x = PX - 20; x > XL; x -= 192) {
    B.cyl(2.2, 3.6, C.pot, x, 1.8, 40, { seg: 12 });
    for (let i = 0; i < 4; i++) B.box(3.6 - i * 0.5, 1.6, 3.6 - i * 0.5, i % 2 ? C.plant : C.plantB, x, 4.2 + i * 1.0, 40, { ry: i * 0.8 });
  }

  // ===== 会議室: 長い会議机（クリーム色の天板・金の縁・紺の脚）=====
  {
    const tl = T.x1 - T.x0, tc = (T.x0 + T.x1) / 2;
    BC.box(tl, 1.1, T.d, C.top, tc, T.y, T.z);
    B.box(tl + 0.3, 0.55, 0.25, C.gold, tc, T.y, T.z + T.d / 2 + 0.12);
    B.box(0.25, 0.55, T.d, C.gold, T.x0 - 0.12, T.y, T.z);
    B.box(0.25, 0.55, T.d, C.gold, T.x1 + 0.12, T.y, T.z);
    for (const px of [T.x0 + 14, tc, T.x1 - 14]) {
      BC.box(14, T.y - 0.55, 8, C.base, px, (T.y - 0.55) / 2, T.z);
      B.box(14.4, 0.5, 8.4, C.gold, px, 0.25, T.z);
    }
  }
  // 紺の革張りの椅子。f=+1 は手前を向く（背もたれが奥）、f=-1 は奥を向く
  const execChair = (x, z, f, ry = 0) => {
    const post = [['ry', ry], ['t', x, 0, z]];
    BC.box(6.8, 1.3, 6.4, C.chair, 0, 5.6, 0, { post });
    const back = (w, h, d, col, ay) => BC.box(w, h, d, col, 0, 6.2, -3.4 * f, { at: [0, ay, 0], rx: -0.15 * f, post });
    back(7.0, 8.4, 1.5, C.chair, 4.2);
    back(6.2, 3.0, 1.6, C.chairHi, 9.6);
    back(7.1, 0.35, 1.7, C.gold, 8.2);
    for (const dx of [-3.7, 3.7]) B.box(0.8, 0.8, 5.0, C.chrome, dx, 8.3, 0.2 * f, { post });
    B.box(1.1, 4.4, 1.1, C.chrome, 0, 2.6, 0, { post });
    B.cyl(3.0, 0.5, C.chrome, 0, 0.35, 0, { seg: 5, post });
  };
  // 向こう側（窓を背にする側）。試験台の正面（x≈W-56〜W-14）は空けてある
  for (const x of [PX + 21, W + 1, W + 21, W + 41]) execChair(x, T.z - 14, 1, (rnd(x) - 0.5) * 0.16);
  execChair(W + 35, T.z + 11, -1, -0.38);          // こちら側は1脚だけ（右の端。引いて斜めに）

  // 机の上。相手の席はきちんと揃い、こちらの端は図面と変更要求の紙
  {
    const seat = (x, kind) => {
      const z = T.z - 4;
      B.cyl(0.5, 1.6, C.water, x - 2.6, TT + 0.8, z - 0.6, { seg: 10 });                         // 水のグラス
      B.box(3.6, 1.8, 0.15, C.paper, x, TT + 0.85, T.z - 1.2, { rx: -0.35 });                    // 席札（無地）
      if (kind === 0) {                                                                            // 綴じた資料（紺）
        for (let k = 0; k < 3; k++) B.box(3.6, 0.7, 4.6, k === 1 ? '#34407a' : C.binder, x + 1.2, TT + 0.35 + k * 0.72, z, { ry: (rnd(x + k) - 0.5) * 0.1 });
        B.box(0.3, 2.1, 4.4, C.gold, x + 3.05, TT + 1.08, z);
      } else if (kind === 1) {                                                                     // 開いたノートPC（画面は向こう向き）
        B.box(4.6, 0.25, 3.2, '#2a2d33', x + 1, TT + 0.13, z + 0.4);
        B.box(4.6, 3.2, 0.2, '#2a2d33', x + 1, TT + 1.6, z + 2.0, { rx: -0.3 });
      } else {                                                                                     // 受け皿とカップ
        B.cyl(1.3, 0.2, C.cup, x + 1.2, TT + 0.1, z, { seg: 14 });
        B.cyl(0.75, 1.1, C.cup, x + 1.2, TT + 0.75, z, { seg: 12 });
        B.box(4.2, 0.12, 3.0, C.paper, x - 1.5, TT + 0.06, z + 1.4, { ry: 0.1 });
      }
    };
    seat(PX + 21, 2); seat(W + 1, 0); seat(W + 21, 1); seat(W + 41, 0);
    // 三角の会議用スピーカーフォン（机の真ん中より右。ボスの頭に隠れない位置）
    B.cyl(2.6, 0.7, C.phone, W + 9, TT + 0.35, T.z + 0.5, { seg: 3, ry: 0.3 });
    B.cyl(1.0, 0.3, '#5a606a', W + 9, TT + 0.85, T.z + 0.5, { seg: 12 });
    B.box(1.4, 0.06, 0.7, '#7d8c7a', W + 9, TT + 0.73, T.z + 2.0);
    // 水差しと盆（金）
    B.box(6, 0.25, 4, C.gold, W - 14, TT + 0.13, T.z - 1);
    B.cyl(0.95, 3.8, C.water, W - 15.5, TT + 2.15, T.z - 1, { seg: 12 });
    B.cyl(1.0, 0.5, C.steelDk, W - 15.5, TT + 4.3, T.z - 1, { seg: 12 });
    for (const dx of [0.4, 2.0]) B.cyl(0.45, 1.4, C.water, W - 14 + dx, TT + 0.95, T.z - 0.2, { seg: 10 });
    // こちらの端: 広げた図面・ペン・こちらのバインダー（紙の山は動く物として下で作る）
    B.box(11, 0.06, 7, '#e3ecf5', PILE_X + 15, TT + 0.03, T.z + 2.6, { ry: 0.06 });
    for (let k = 0; k < 4; k++) B.box(8 - k * 1.3, 0.04, 0.22, '#4f78a8', PILE_X + 14 + k * 0.4, TT + 0.08, T.z + 0.6 + k * 1.3, { ry: 0.06 });
    B.box(0.22, 0.04, 4.6, '#4f78a8', PILE_X + 10.5, TT + 0.08, T.z + 2.6, { ry: 0.06 });
    B.box(0.3, 0.3, 3.2, '#1c1f24', PILE_X + 19, TT + 0.2, T.z + 4.4, { ry: 0.8 });
    B.box(3.4, 0.9, 4.4, C.ours, PILE_X + 12, TT + 0.45, T.z - 3.6, { ry: -0.15 });
    B.box(3.4, 0.9, 4.4, '#7d93a8', PILE_X + 12.2, TT + 1.35, T.z - 3.5, { ry: -0.08 });
  }
  // 部屋の左右の鉢植え（窓ぎわ）と、右の低い棚
  plant(PX + 8, BACK + 6, 19);
  plant(W + 72, BACK + 7, 21);
  BC.box(22, 8, 6, C.navy, W + 104, 4, BACK + 4);
  B.box(22.4, 0.5, 6.4, C.gold, W + 104, 8.25, BACK + 4);

  // ===== 手前: 低いクレデンザ（紺・金の縁）。上にコーヒーの用意と資料。背の高い物は置かない =====
  {
    const K0 = PX + 12, K1 = W + 62, kc = (K0 + K1) / 2, KZ = 37, KH = 5.2, KT = KH + 0.4;
    B.box(K1 - K0, KH, 7, C.navy, kc, KH / 2, KZ);
    B.box(K1 - K0 + 0.4, 0.4, 7.4, '#3d2e25', kc, KH + 0.2, KZ);                 // 天板（濃い胡桃）
    B.box(K1 - K0 + 0.5, 0.22, 0.1, C.gold, kc, KH + 0.2, KZ + 3.75);           // 金の縁（手前の面だけ）
    for (const [x, col] of [[K0 + 26, '#b9bec4'], [K0 + 30, '#2a2d33']]) {          // 保温ポット
      B.cyl(1.1, 4.0, col, x, KT + 2.0, KZ - 1, { seg: 12 });
      B.cyl(0.8, 0.7, '#202226', x, KT + 4.35, KZ - 1, { seg: 10 });
    }
    for (let i = 0; i < 4; i++) B.cyl(0.7, 0.85, C.cup, K0 + 35, KT + 0.43 + i * 0.75, KZ - 0.5, { seg: 10, r2: 0.78 });
    // ドーナツの箱（無地のクラフト紙。外した蓋は横に寝かせてある）
    {
      const x = kc + 20;
      B.box(7, 0.9, 6, '#c9a878', x, KT + 0.45, KZ);
      B.box(7, 0.2, 6, '#d4b688', x + 7.6, KT + 0.1, KZ + 0.3, { ry: 0.12 });
      const top = ['#d9a56a', '#e7a2b5', '#6a4a3a', '#d9a56a', '#f2ead8', '#e7a2b5'];
      for (let i = 0; i < 6; i++) B.cyl(0.95, 0.6, top[i], x - 2.2 + (i % 3) * 2.2, KT + 1.15, KZ - 1.3 + Math.floor(i / 3) * 2.6, { seg: 10 });
    }
    for (let k = 0; k < 3; k++) B.box(3.6, 0.7, 4.6, k === 1 ? '#34407a' : C.binder, K0 + 10, KT + 0.35 + k * 0.72, KZ, { ry: (rnd(k) - 0.5) * 0.2 });
    B.box(8, 1.8, 4, C.pot, K1 - 10, KT + 0.9, KZ);
    for (let i = 0; i < 6; i++) B.box(1.8, 1.4 + rnd(i) * 1.0, 1.8, i % 2 ? C.plant : C.plantB, K1 - 13 + i * 1.2, KT + 2.3, KZ + (rnd(i + 5) - 0.5), { ry: i * 0.6 });
    // 右の端の低い鉢
    for (let x = K1 + 16; x < XR; x += 44) {
      B.cyl(2.4, 4.0, C.pot, x, 2.0, 38, { seg: 12 });
      for (let i = 0; i < 4; i++) B.box(4 - i * 0.6, 1.6, 4 - i * 0.6, i % 2 ? C.plant : C.plantB, x, 4.6 + i * 1.0, 38, { ry: i * 0.8 });
    }
  }

  // ===== 窓の奥: 試験場（白く明るい）=====
  const BX0 = PX - 100, BX1 = XR + 170, bxc = (BX0 + BX1) / 2, bxw = BX1 - BX0;
  const FAR = BACK - 106;                                   // 奥の壁の面（z=-172）
  B.box(bxw, 2, BACK - FAR + 4, C.bayFloor, bxc, -1, (BACK + FAR - 4) / 2);
  for (let z = FAR + 20; z < BACK - 2; z += 20) B.box(bxw, 0.03, 0.25, C.bayJoint, bxc, 0.015, z);   // 目地
  for (let x = BX0 + 10; x < BX1; x += 20) B.box(0.25, 0.03, BACK - FAR, C.bayJoint, x, 0.015, (BACK + FAR) / 2);
  B.box(bxw, 0.05, 0.9, C.bayLine, bxc, 0.04, FAR + 24);                                            // 通路の黄線
  {
    const x0 = TX - 27, x1 = TX + 27, z0 = TZ - 20, z1 = TZ + 19;                                   // 試験区画の黄線
    B.box(x1 - x0, 0.05, 0.8, C.bayLine, TX, 0.045, z0); B.box(x1 - x0, 0.05, 0.8, C.bayLine, TX, 0.045, z1);
    B.box(0.8, 0.05, z1 - z0, C.bayLine, x0, 0.045, (z0 + z1) / 2); B.box(0.8, 0.05, z1 - z0, C.bayLine, x1, 0.045, (z0 + z1) / 2);
  }
  // 奥の壁: 明るい金属パネルに縦のリブ、腰に濃い帯。大きな巻き上げ扉と、壁付けの灯り
  B.box(bxw, 70, 2, C.bayWall, bxc, 35, FAR - 1);
  B.box(bxw, 9, 0.6, C.bayDado, bxc, 4.5, FAR + 0.3);
  for (let x = BX0 + 3; x < BX1; x += 7) B.box(0.7, 61, 0.5, C.bayRib, x, 39.5, FAR + 0.25);
  {
    const dx = TX + 62;
    B.box(30, 26, 0.5, '#a7adb5', dx, 13, FAR + 0.75);
    for (let i = 0; i < 13; i++) B.box(30, 0.3, 0.2, '#8d939b', dx, 1 + i * 2, FAR + 1.1);
    B.box(32, 3.4, 3.2, C.steel, dx, 27.7, FAR + 1.6);
    for (const s of [-1, 1]) {
      B.box(1.2, 27, 1.2, C.steelDk, dx + s * 15.6, 13.5, FAR + 0.9);
      B.cyl(0.9, 5, C.hazard, dx + s * 17.8, 2.5, FAR + 4, { seg: 10 });
      B.cyl(0.95, 0.8, C.black, dx + s * 17.8, 3.5, FAR + 4, { seg: 10 });
    }
  }
  for (let x = BX0 + 24; x < BX1; x += 46) {
    B.box(5, 2.4, 0.6, C.steelDk, x, 27, FAR + 0.4);
    G.box(4.2, 1.6, 0.4, '#f6f8ff', x, 27, FAR + 0.75);
  }
  B.cyl(0.8, 3.2, '#c8352b', TX - 20, 3.6, FAR + 1.0, { seg: 10 });                               // 消火器（赤）
  // 天井クレーンの桁（黄）と巻上機。窓の上の端に入る高さ
  B.box(bxw, 2.6, 2.4, C.crane, bxc, 35.8, FAR + 40);
  B.box(6, 2.4, 4.6, '#c49c30', TX + 30, 33.3, FAR + 40);
  B.box(0.2, 5.6, 0.2, C.black, TX + 30, 29.3, FAR + 40);
  B.box(1.6, 2.2, 1.2, C.black, TX + 30, 25.6, FAR + 40);
  // 高天井の灯り（吊り下げ）
  for (let x = BX0 + 20; x < BX1; x += 44) {
    B.box(7, 1.4, 7, '#4a525e', x, 34.6, FAR + 30);
    G.box(6, 0.4, 6, '#f4f7ff', x, 33.7, FAR + 30);
  }

  // --- 試験台: コンクリートの台座・加振機（胴・可動部・頭の板）---
  B.box(44, 1.6, 30, C.concrete, TX, 0.8, TZ);
  for (let i = 0, x = TX - 22; x < TX + 21.9; x += 2.2, i++) B.box(2.2, 1.0, 0.12, i % 2 ? C.black : C.hazard, x + 1.1, 0.9, TZ + 15.06);
  B.box(18, 2.4, 12, C.shakerBase, TX, 2.8, TZ);
  for (const s of [-1, 1]) B.box(2.6, 8.6, 9, C.shakerBase, TX + s * 8.0, 5.9, TZ);
  B.cyl(6.5, 7.0, C.shaker, TX, 7.5, TZ, { seg: 22 });
  B.cyl(6.65, 0.8, C.shakerBand, TX, 7.6, TZ, { seg: 22 });
  B.cyl(5.0, 0.7, C.armature, TX, 11.35, TZ, { seg: 20 });
  B.box(20, 1.0, 15, C.plate, TX, TY - 0.5, TZ);
  for (const dx of [-7.9, 7.9]) for (const dz of [-3.6, 3.6]) B.box(1.4, 1.3, 2.2, C.steelDk, TX + dx, TY + 0.65, TZ + dz);   // 取付け金具
  for (let i = -2; i <= 2; i++) B.cyl(0.35, 0.14, C.steelDk, TX + i * 4.2, TY + 0.07, TZ + 6.6, { seg: 8 });
  // ケーブルの束（試験品の左の角 → 台座 → 計測ラック）
  const RX = TX - 36, RZ = TZ + 7;
  for (const [i, col] of [[0, C.black], [1, '#5a5f66'], [2, '#3a5a8a']]) {
    const o = i * 0.45;
    B.box(0.35, TY - 0.3, 0.35, col, TX - 7.6 - o, (TY + 2.1) / 2, TZ + 7.8);    // 板の縁から台座まで垂れる
    B.box(0.35, 0.35, 2.5, col, TX - 7.6 - o, 1.8, TZ + 8.6);
    B.box(15 + o, 0.35, 0.35, col, TX - 15 - o / 2, 1.8, TZ + 9.6 + o);
    B.box(0.35, 1.6, 0.35, col, TX - 22.4 - o, 1.0, TZ + 9.6 + o);
    B.box(12, 0.35, 0.35, col, TX - 28.5, 0.2, TZ + 9.6 + o);
  }
  // 計測ラック（画面は緑の波形と青の棒。壊れると上の画面が赤くなる）
  B.box(7, 19, 6, C.rack, RX, 9.5, RZ);
  B.box(7.4, 0.6, 6.4, C.steelDk, RX, 19.3, RZ);
  B.box(6.6, 0.4, 3.2, C.steelDk, RX, 7.6, RZ + 4.4);
  G.box(5.4, 3.8, 0.1, '#0b241c', RX, 15.2, RZ + 3.05);
  for (let i = 0; i < 7; i++) G.box(0.72, 0.2, 0.06, '#5df59a', RX - 2.2 + i * 0.72, 15.2 + [0, 1, -0.6, 1.2, -1, 0.5, -0.2][i], RZ + 3.12);
  G.box(5.4, 3.0, 0.1, '#0b1c2a', RX, 10.8, RZ + 3.05);
  for (let i = 0; i < 5; i++) { const h = 0.8 + rnd(i + 3) * 1.8; G.box(0.6, h, 0.06, '#48b6ff', RX - 2.0 + i * 1.0, 9.5 + h / 2, RZ + 3.12); }
  for (let i = 0; i < 6; i++) G.box(0.35, 0.35, 0.06, i % 3 ? '#62ff9a' : '#ffbe3a', RX - 2.4 + i * 0.95, 5.6, RZ + 3.06);
  B.cyl(0.9, 1.3, '#d89a2a', RX, 20.25, RZ, { seg: 10 });
  // 信号灯の柱（灯りの点き方は下の動く物）
  const SLX = TX - 21, SLZ = TZ + 12;
  B.box(2.4, 0.6, 2.4, C.steelDk, SLX, 1.9, SLZ);
  B.cyl(0.32, 18, C.steel, SLX, 10.6, SLZ, { seg: 8 });
  B.cyl(1.0, 1.5, '#2c5a3c', SLX, 20.4, SLZ, { seg: 14 });
  B.cyl(1.0, 1.5, '#6a5626', SLX, 22.0, SLZ, { seg: 14 });
  B.cyl(1.0, 1.5, '#5c2626', SLX, 23.6, SLZ, { seg: 14 });
  B.cyl(1.05, 0.5, C.black, SLX, 24.6, SLZ, { seg: 14 });
  // 環境試験槽（左）。丸い覗き窓の扉と操作盤
  {
    const x = TX - 52, z = TZ - 20;
    B.box(22, 24, 16, C.chamber, x, 12, z);
    B.box(22.4, 1.2, 16.4, C.steelDk, x, 0.6, z);
    B.box(12, 15, 0.6, '#d9dcdf', x - 2, 11.5, z + 8.3);
    B.cyl(2.8, 0.3, '#2a3340', x - 2, 13, z + 8.7, { rx: Math.PI / 2, seg: 18 });
    B.box(0.6, 4, 0.8, C.steel, x + 3, 11.5, z + 8.9);
    B.box(5, 8, 0.4, '#3a404a', x + 7.5, 14, z + 8.2);
    for (let i = 0; i < 4; i++) G.box(0.5, 0.5, 0.1, i % 2 ? '#62ff9a' : '#ff6a4a', x + 6.2 + (i % 2) * 2.4, 15.5 - Math.floor(i / 2) * 2, z + 8.45);
  }
  // 予備の試験品を載せた台車（作り直しの用意。右奥）
  {
    const x = TX + 46, z = TZ - 20;
    B.box(18, 0.8, 10, C.steel, x, 6.2, z);
    B.box(18, 0.6, 10, C.steel, x, 2.0, z);
    for (const dx of [-8.6, 8.6]) for (const dz of [-4.6, 4.6]) {
      B.box(0.6, 6, 0.6, C.steelDk, x + dx, 3.6, z + dz);
      B.cyl(0.6, 0.5, C.black, x + dx, 0.6, z + dz, { rx: Math.PI / 2, seg: 10 });
    }
    B.box(11, 6.8, 8, C.article, x - 2, 10.0, z);
    B.box(11.3, 0.4, 8.3, C.articleDk, x - 2, 13.6, z);
    for (let i = 0; i < 6; i++) B.box(0.3, 4.8, 1.0, C.fin, x + 0.4 + i * 0.6, 10.2, z + 4.4);
    B.cyl(4.0, 0.6, C.disc, x + 3, 2.6, z, { seg: 20 });
  }
  // 工具箱（右）
  B.box(8, 9, 5, '#3c4a66', TX + 31, 4.5, TZ - 2);
  for (let i = 0; i < 4; i++) B.box(7.6, 0.25, 0.1, '#232c3e', TX + 31, 2 + i * 2, TZ + 0.55);

  // ===== 動く物: 試験品（加振機の頭の板の上。4つの部品に分けて、壊れるときに別々に動かす）=====
  const art = new THREE.Group();
  art.position.set(TX, TY, TZ);
  addScenery(art);
  const part = (sh, x, y, z) => {
    const m = new THREE.Mesh(sh.geometry(), litMat());
    m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
    art.add(m);
    return { m, tw: null };
  };
  // 本体。右下の角を軸に傾けるので、形は軸（x=+7）から見た位置で作る
  const sb = shapes(), bo = -7;
  sb.box(14, 8.6, 10, C.article, bo, 4.3, 0);
  sb.box(14.4, 0.5, 10.4, C.articleDk, bo, 8.85, 0);
  sb.box(14.4, 0.6, 10.4, C.articleDk, bo, 0.3, 0);
  for (let i = 0; i < 8; i++) sb.box(0.35, 6.2, 1.2, C.fin, bo + 1.4 + i * 0.75, 4.4, 5.6);       // 放熱フィン
  sb.box(2.4, 1.0, 6, C.steelDk, bo - 7.6, 3.6, 0);                                                // 筒の取付け金具
  sb.box(6.0, 4.6, 0.1, '#20252c', bo - 3.2, 4.7, 5.05);                                            // 蓋の奥（外れると見える）
  sb.box(4.2, 2.6, 0.2, C.board, bo - 3.4, 4.9, 5.15);
  for (let i = 0; i < 3; i++) sb.box(0.8, 0.5, 0.15, ['#c9a54e', '#2a2d33', '#d8483c'][i], bo - 4.6 + i * 1.3, 4.3 + (i % 2) * 1.2, 5.25);
  for (let i = 0; i < 3; i++) sb.cyl(0.45, 1.0, i === 2 ? '#2a2d33' : C.steelDk, bo - 5.4 + i * 1.2, 1.3, 5.5, { rx: Math.PI / 2, seg: 10 });
  for (const [x, z] of [[-6.2, 4.2], [6.2, 4.2], [0.5, -4.2]]) {                                    // 加速度計（青）と線
    sb.box(0.9, 0.9, 0.9, C.sensor, bo + x, 9.55, z);
    if (z > 0) sb.box(0.18, 4.4, 0.18, C.black, bo + (x > 0 ? x : -6.75), 7.0, x > 0 ? 6.4 : 5.2);   // 前へ垂れる線（蓋と重ねない）
  }
  const body = part(sb, 7, 0, 0);
  // 前の蓋（2回目で外れる）
  const sp = shapes();
  sp.box(6.4, 5.0, 0.4, C.panel, 0, 0, 0);
  for (const dx of [-2.8, 2.8]) for (const dy of [-2.1, 2.1]) sp.cyl(0.22, 0.2, C.steel, dx, dy, 0.28, { rx: Math.PI / 2, seg: 6 });
  sp.box(2.4, 0.5, 0.5, C.steel, 0, 0.7, 0.42);
  sp.box(1.6, 0.9, 0.06, C.hazard, 1.8, -1.5, 0.23);
  const panel = part(sp, -3.2, 4.7, 5.2);
  // 横の筒（1回目で落ちる）
  const sc = shapes();
  sc.cyl(2.2, 8.4, C.canister, 0, 0, 0, { rx: Math.PI / 2, seg: 16 });
  for (const dz of [-2.6, 2.6]) sc.cyl(2.32, 0.55, C.articleDk, 0, 0, dz, { rx: Math.PI / 2, seg: 16 });
  sc.cyl(1.4, 0.5, C.steelDk, 0, 0, 4.4, { rx: Math.PI / 2, seg: 12 });
  sc.box(0.5, 0.5, 6.4, '#3a3f47', 1.5, 1.6, 0);
  const can = part(sc, -9.6, 3.6, 0);
  // 上の円盤（1回目で垂れ、2回目でもげる）。首の付け根が軸
  const sd = shapes(), DA = 0.42, DY = 7.2, DR = 5.6, face = { rx: Math.PI / 2 - DA, seg: 28 };
  sd.cyl(1.1, 2.6, C.articleDk, 0, 1.3, 0, { seg: 12 });
  sd.box(4.4, 2.6, 2.4, C.steelDk, 0, 3.6, 0);
  sd.box(1.2, 3.0, 1.2, C.steelDk, 0, 6.0, 0);
  sd.cyl(DR + 0.25, 0.6, C.articleDk, 0, DY, 0.4, face);
  sd.cyl(DR, 0.95, C.disc, 0, DY, 0.4, face);
  sd.cyl(DR * 0.6, 1.05, '#dfe3e8', 0, DY, 0.4, face);
  sd.cyl(1.2, 1.7, C.steel, 0, DY, 0.4, { rx: Math.PI / 2 - DA, seg: 12 });
  const disc = part(sd, 0, 9.1, -1);
  // 壊れた所の照り返し（橙。ちらつかせる）
  const ember = lampMesh(new THREE.BoxGeometry(1.8, 1.1, 1.8), '#ff8a3a', { additive: true });
  ember.position.set(0, 9.6, -1); ember.visible = false; art.add(ember);

  // 信号灯の灯り（緑＝試験中 → 赤の点滅 → 赤の早い点滅と黄）
  const lampGeo = () => new THREE.CylinderGeometry(1.07, 1.07, 1.42, 14);
  const lamps = { g: lampMesh(lampGeo(), '#62f59a'), a: lampMesh(lampGeo(), '#ffc43a'), r: lampMesh(lampGeo(), '#ff3b30') };
  lamps.g.position.set(SLX, 20.4, SLZ); lamps.a.position.set(SLX, 22.0, SLZ); lamps.r.position.set(SLX, 23.6, SLZ);
  for (const k of ['g', 'a', 'r']) addScenery(lamps[k]);
  lamps.a.visible = false; lamps.r.visible = false;
  const rackRed = lampMesh(new THREE.BoxGeometry(5.4, 3.8, 0.1), '#ff3b30');
  rackRed.position.set(RX, 15.2, RZ + 3.2); rackRed.visible = false; addScenery(rackRed);
  const flash = lampMesh(new THREE.BoxGeometry(1, 1, 1), '#ffe0a0', { additive: true });
  flash.position.set(TX, TY + 10, TZ); flash.visible = false; addScenery(flash);

  // 火花と煙（それぞれインスタンス1回で描く。出ていないときは描かない）
  const inst = (geo, mat, n, color) => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.visible = false; m.castShadow = false; m.receiveShadow = false;
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, c); }
    addScenery(m);
    return m;
  };
  const SPN = 56, SMN = 30;
  const sparks = inst(new THREE.BoxGeometry(0.75, 0.75, 0.75), new THREE.MeshBasicMaterial({ color: 0xffffff }), SPN, '#ffd34a');
  const smoke = inst(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.58, depthWrite: false }), SMN, '#777c84');

  // ===== 動く物: 変更要求の紙の山。全部の段を先に作っておき、見せる段数（drawRange）で高さを変える =====
  const pile = shapes();
  const stacks = [
    { x: PILE_X - 5.4, z: PILE_Z - 0.3, ry: 0.07, max: 30 },
    { x: PILE_X + 0.1, z: PILE_Z + 0.4, ry: -0.05, max: 38 },
    { x: PILE_X + 5.6, z: PILE_Z - 0.5, ry: 0.12, max: 23 },
  ];
  const LMAX = 38, LAY = 0.42, idxAt = [];
  for (let l = 0; l < LMAX; l++) {
    stacks.forEach((s, si) => {
      const n0 = Math.floor(l * s.max / LMAX), n1 = Math.floor((l + 1) * s.max / LMAX);
      if (n1 <= n0) return;
      const k = n0, y = k * LAY + LAY / 2, q = si * 100 + k;
      pile.box(5.0, LAY - 0.03, 3.6, k % 3 === 2 ? C.paperB : C.paper, s.x + (rnd(q) - 0.5) * 0.5, y, s.z + (rnd(q + 7) - 0.5) * 0.4,
        { ry: s.ry + (rnd(q + 3) - 0.5) * 0.12 });
      if (k % 4 === 1) pile.box(0.9, 0.3, 0.7, C.tabs[(k + si) % 4], s.x + (rnd(q + 11) - 0.5) * 3, y, s.z + 2.0, { ry: s.ry });
    });
    idxAt.push(pile.indexCount);
  }
  const pileMesh = new THREE.Mesh(pile.geometry(), litMat());
  pileMesh.position.y = TT; pileMesh.castShadow = false; pileMesh.receiveShadow = true;
  addScenery(pileMesh);
  const sheets = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 3.2), new THREE.MeshLambertMaterial({ color: hex(C.paper) }));
    m.visible = false; m.castShadow = false; m.receiveShadow = false;
    addScenery(m);
    sheets.push({ m, on: false, t: 0, dur: 0.5, spin: 0, from: new THREE.Vector3(), to: new THREE.Vector3() });
  }

  // ===== まとめて描く =====
  addStatic(BC, litMat(), true);
  addStatic(B, litMat(), false);
  addStatic(G, new THREE.MeshBasicMaterial({ vertexColors: true }), false, false);
  addStatic(GL, new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, emissive: 0x1a2f40,
  }), false, false);

  A = {
    t: 0, level: 0, running: true, TY, art, body, disc, can, panel, ember, lamps, rackRed,
    flash, flashT: 0, flashDur: 0.3, flashScale: 10, hemiBase: hemi.intensity,
    sparks, sp: Array.from({ length: SPN }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 1, s: 1 })),
    smoke, sm: Array.from({ length: SMN }, () => ({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 1, s0: 1, s1: 4, rot: 0, vr: 0, c: new THREE.Color() })),
    smokeT: 0, smokeEvery: 0.3, sparkT: 1, pad: { x: TX, z: TZ },
    fade: new THREE.Color(C.bayWall), sparkCols: ['#fff3b0', '#ffc34a', '#ff8a2a'].map((c) => new THREE.Color(c)),
    pile: { mesh: pileMesh, idxAt, lv: 4, target: 4, hold: 0, max: LMAX, lay: LAY, x: PILE_X, z: PILE_Z, top: TT },
    sheets, queue: [], lastLaunch: 0, stage: ctx.stage || null,
  };
  setPile(A.pile);
}

// ===== 出来事 =====
export function onEvent(name, arg) {
  if (!A) return;
  if (name === 'tick') tick(arg);
  else if (name === 'revive') breakTest();
  else if (name === 'kuchidashi') kuchidashi();
  else if (name === 'defeated') A.running = false;   // 試験が止まる
}

// 紙の山の高さ（見せる段数）
function setPile(p) {
  const n = Math.max(0, Math.min(p.max, Math.floor(p.lv)));
  p.mesh.geometry.setDrawRange(0, n > 0 ? p.idxAt[n - 1] : 0);
}

// 部品を今の姿勢から目標へ動かす。drop＝放り出されて落ちる（最後に小さく跳ねる）、swing＝勢いよく振れて揺れながら止まる
function tween(p, to, dur, kind, o = {}) {
  const m = p.m, P = m.position, R = m.rotation;
  p.tw = {
    t: -(o.delay || 0), dur, kind, kick: o.kick || 0, bounce: o.bounce || 0, wob: o.wob || 0,
    f: { x: P.x, y: P.y, z: P.z, rx: R.x, ry: R.y, rz: R.z },
    g: { x: to.x ?? P.x, y: to.y ?? P.y, z: to.z ?? P.z, rx: to.rx ?? R.x, ry: to.ry ?? R.y, rz: to.rz ?? R.z },
  };
}
function stepTween(p, dt) {
  const w = p.tw;
  if (!w) return;
  w.t += dt;
  if (w.t < 0) return;
  const m = p.m, f = w.f, g = w.g, u = Math.min(1, w.t / w.dur);
  if (w.kind === 'drop') {
    m.position.set(f.x + (g.x - f.x) * u, f.y + (g.y - f.y) * u * u + w.kick * 4 * u * (1 - u), f.z + (g.z - f.z) * u);
    m.rotation.set(f.rx + (g.rx - f.rx) * u, f.ry + (g.ry - f.ry) * u, f.rz + (g.rz - f.rz) * u);
    if (u >= 1) {
      const v = (w.t - w.dur) / 0.32;
      if (v < 1) m.position.y = g.y + Math.sin(v * Math.PI) * w.bounce * (1 - v);
      else { m.position.y = g.y; p.tw = null; }
    }
  } else {
    const e = 1 - Math.pow(1 - u, 3) + Math.sin(u * Math.PI * 3) * (1 - u) * w.wob;
    m.position.set(f.x + (g.x - f.x) * e, f.y + (g.y - f.y) * e, f.z + (g.z - f.z) * e);
    m.rotation.set(f.rx + (g.rx - f.rx) * e, f.ry + (g.ry - f.ry) * e, f.rz + (g.rz - f.rz) * e);
    if (u >= 1) p.tw = null;
  }
}

// 作り直し（ボスの復活）。試験で裏切られる＝試験品が壊れる。2回目はさらに壊れる
function breakTest() {
  const ax = A.art.position.x, ay = A.TY, az = A.art.position.z;
  const top = [ax, ay + 9.8, az - 1];
  if (A.level >= 2) { sparksAt(top, 16, 0.9); flashAt(top, 0.25, 8); return; }
  A.level++;
  A.running = false;
  A.ember.visible = true;
  if (A.level === 1) {
    tween(A.disc, { rx: 0.95, rz: 0.35, y: 8.6 }, 0.45, 'swing', { wob: 0.3 });
    tween(A.can, { x: -15.2, y: -8.9, z: 2.4, rx: 0.1, ry: 0.5, rz: 1.6 }, 0.5, 'drop', { delay: 0.05, kick: 2.6, bounce: 1.1 });
    A.ember.position.set(0, 9.9, 0.4); A.ember.scale.set(1.5, 1.3, 1.5);
    flashAt(top, 0.35, 12);
    sparksAt(top, 36, 1);
    sparksAt([ax - 7.6, ay + 3.6, az], 14, 0.7);
    for (let i = 0; i < 7; i++) emitSmoke(top, 1, true);
    A.smokeEvery = 0.2;
  } else {
    tween(A.disc, { x: 15.5, y: -10.3, z: 5.5, rx: 1.42, ry: 0.6, rz: -0.3 }, 0.6, 'drop', { kick: 3.2, bounce: 1.3 });
    tween(A.body, { y: -0.3, rz: -0.2 }, 0.4, 'swing', { delay: 0.05, wob: 0.5 });
    tween(A.panel, { x: -3.0, y: -10.9, z: 10.2, rx: -1.5, ry: 0.35, rz: 0.08 }, 0.45, 'drop', { delay: 0.12, kick: 1.4, bounce: 0.6 });
    A.ember.position.set(2, 10.2, -0.5); A.ember.scale.set(2.2, 1.4, 2.0);
    flashAt(top, 0.4, 16);
    sparksAt(top, 40, 1.25);
    sparksAt([ax - 3, ay + 5, az + 5.5], 14, 0.8);
    for (let i = 0; i < 10; i++) emitSmoke(top, 2, true);
    A.smokeEvery = 0.13;
  }
  A.smokeT = A.smokeEvery;
  A.sparkT = 0.5;
}
function flashAt(p, dur, scale) {
  A.flash.position.set(p[0], p[1], p[2] + 1);
  A.flashT = dur; A.flashDur = dur; A.flashScale = scale;
  A.flash.visible = true;
}
function smokeOrigin() {
  const ax = A.art.position.x, ay = A.TY, az = A.art.position.z, r = Math.random;
  if (A.level === 1) return [ax + (r() - 0.5) * 2, ay + 9.8, az - 1 + (r() - 0.5) * 2];
  return r() < 0.7 ? [ax + 1 + (r() - 0.5) * 6, ay + 10, az + (r() - 0.5) * 5] : [ax - 3 + (r() - 0.5) * 3, ay + 5, az + 5.6];
}
function sparksAt(p, n, power) {
  const r = Math.random;
  for (let i = 0, k = 0; i < A.sp.length && k < n; i++) {
    const s = A.sp[i];
    if (s.on) continue;
    s.on = true; s.age = 0; s.life = 0.5 + r() * 0.65; s.s = 0.9 + r() * 0.7;
    s.p.set(p[0] + (r() - 0.5) * 1.5, p[1] + (r() - 0.5) * 1.5, p[2] + (r() - 0.5) * 1.5);
    s.v.set((r() - 0.5) * 22 * power, (7 + r() * 17) * power, (r() * 12 - 3) * power);
    A.sparks.setColorAt(i, A.sparkCols[(r() * 3) | 0]);
    k++;
  }
  A.sparks.instanceColor.needsUpdate = true;
}
function emitSmoke(p, level, burst) {
  const s = A.sm.find((q) => !q.on);
  if (!s) return;
  const r = Math.random;
  s.on = true; s.age = 0; s.life = (level === 2 ? 2.6 : 2.2) + r() * 1.1;
  s.p.set(p[0] + (r() - 0.5) * (burst ? 4 : 1.5), p[1] + (r() - 0.5) * (burst ? 2 : 1), p[2] + (r() - 0.5) * (burst ? 3 : 1.5));
  const k = burst ? 1.5 : 1;
  s.v.set((1.0 + r() * 2.0) * k, (5.5 + r() * 3.5) * k, (r() - 0.5) * 1.6 * k);
  s.s0 = (level === 2 ? 2.8 : 2.0) + (burst ? 1.6 : 0); s.s1 = (level === 2 ? 10 : 7) + r() * 2;
  s.rot = r() * 6; s.vr = (r() - 0.5) * 1.6;
  s.c.set(level === 2 ? '#303338' : '#555b63').offsetHSL(0, 0, (r() - 0.5) * 0.08);
}

function tick(arg) {
  const dt = Math.min(0.25, Math.max(0, (arg && arg.dt) || 0));   // シェルと同じ上限（遅い端末でも実時間で進む）
  A.t += dt;
  const t = A.t;
  // 試験中は加振機が細かく揺らしている。壊れたら・倒したら止まる
  A.art.position.y = A.TY + (A.running && A.level === 0 ? Math.sin(t * 43) * 0.1 : 0);
  for (const p of [A.body, A.disc, A.can, A.panel]) stepTween(p, dt);
  // 信号灯と計測ラックの画面
  const L = A.lamps;
  L.g.visible = A.level === 0;
  L.a.visible = A.level === 2;
  L.r.visible = A.level === 1 ? (t * 2.4) % 2 < 1.4 : A.level === 2 ? (t * 5) % 2 < 1.3 : false;
  A.rackRed.visible = A.level === 1 || (A.level === 2 && (t * 4) % 2 < 1.3);
  if (A.level >= 1) A.ember.material.opacity = Math.min(1, 0.5 + 0.3 * Math.abs(Math.sin(t * 9.3)) + 0.2 * Math.sin(t * 23.7));
  // 閃光（部屋もほんの一瞬明るくなる）
  if (A.flashT > 0) {
    A.flashT = Math.max(0, A.flashT - dt);
    const k = A.flashT / A.flashDur;
    A.flash.material.opacity = 0.95 * k;
    const s = 2.5 + (1 - k) * A.flashScale;
    A.flash.scale.set(s, s, s);
    A.flash.visible = A.flashT > 0;
    hemi.intensity = A.hemiBase + 0.28 * k * k;
  }
  // 壊れたあとは煙が昇り続け、ときどき火花が散る
  if (A.level >= 1) {
    A.smokeT -= dt;
    while (A.smokeT <= 0) { emitSmoke(smokeOrigin(), A.level, false); A.smokeT += A.smokeEvery; }
    A.sparkT -= dt;
    if (A.sparkT <= 0) {
      sparksAt(smokeOrigin(), 3 + Math.floor(Math.random() * (A.level === 2 ? 6 : 4)), 0.55);
      A.sparkT = (A.level === 2 ? 0.35 : 0.6) + Math.random() * (A.level === 2 ? 0.8 : 1.3);
    }
  }
  updateSparks(dt);
  updateSmoke(dt);
  stepPile(dt);
  stepSheets(dt);
}

function updateSparks(dt) {
  let any = false, dirty = false;
  const pad = A.pad;
  for (let i = 0; i < A.sp.length; i++) {
    const s = A.sp[i];
    if (!s.on) continue;
    dirty = true;
    s.age += dt;
    if (s.age >= s.life) { s.on = false; A.sparks.setMatrixAt(i, ZERO); continue; }
    any = true;
    s.v.y -= 36 * dt;
    s.p.addScaledVector(s.v, dt);
    const fy = Math.abs(s.p.x - pad.x) < 22 && Math.abs(s.p.z - pad.z) < 15 ? 1.6 : 0;
    if (s.p.y < fy) { s.p.y = fy; s.v.y = Math.abs(s.v.y) * 0.35; s.v.x *= 0.6; s.v.z *= 0.6; }
    _s.setScalar(s.s * (0.35 + 0.65 * (1 - s.age / s.life)));
    _m4.compose(s.p, _q.identity(), _s);
    A.sparks.setMatrixAt(i, _m4);
  }
  if (dirty) A.sparks.instanceMatrix.needsUpdate = true;
  A.sparks.visible = any;
}
function updateSmoke(dt) {
  let any = false, dirty = false;
  const c = new THREE.Color();
  for (let i = 0; i < A.sm.length; i++) {
    const s = A.sm[i];
    if (!s.on) continue;
    dirty = true;
    s.age += dt;
    if (s.age >= s.life) { s.on = false; A.smoke.setMatrixAt(i, ZERO); continue; }
    any = true;
    const u = s.age / s.life;
    s.p.addScaledVector(s.v, dt);
    s.v.y *= 1 - 0.22 * dt;
    s.v.x += 0.7 * dt;
    s.rot += s.vr * dt;
    let size = s.s0 + (s.s1 - s.s0) * (1 - (1 - u) * (1 - u));
    if (u > 0.75) size *= 1 - (u - 0.75) / 0.25 * 0.55;
    _e.set(s.rot * 0.4, s.rot, s.rot * 0.25);
    _q.setFromEuler(_e);
    _s.setScalar(size);
    _m4.compose(s.p, _q, _s);
    A.smoke.setMatrixAt(i, _m4);
    A.smoke.setColorAt(i, c.copy(s.c).lerp(A.fade, u * u * 0.6));
  }
  if (dirty) { A.smoke.instanceMatrix.needsUpdate = true; A.smoke.instanceColor.needsUpdate = true; }
  A.smoke.visible = any;
}

// 設計に口を出した（E）。out of scope と言われ、変更要求の紙がボスの方から飛んできて山が高くなる
function kuchidashi() {
  const p = A.pile;
  p.target = Math.min(p.max, p.target + 13);
  p.hold = Math.max(p.hold, 0.25);
  let fx = p.x + 40, fy = 26, fz = -6;
  const b = A.stage && A.stage.boss;
  if (b && b.alive && typeof b.x === 'number') { fx = wx(b.x) - 3; fy = 24; fz = wz(b.y); }
  const base = Math.max(A.t, A.lastLaunch) + 0.02;
  for (let i = 0; i < 4; i++) {
    const r = Math.random;
    A.queue.push({ at: base + i * 0.09, from: [fx + (r() - 0.5) * 2, fy + r() * 2, fz + (r() - 0.5) * 2] });
  }
  A.lastLaunch = base + 4 * 0.09;
}
function stepPile(dt) {
  const p = A.pile;
  if (p.hold > 0) { p.hold -= dt; return; }
  if (p.lv < p.target) { p.lv = Math.min(p.target, p.lv + 32 * dt); setPile(p); }
}
function stepSheets(dt) {
  const p = A.pile;
  for (let i = A.queue.length - 1; i >= 0; i--) {
    const q = A.queue[i];
    if (A.t < q.at) continue;
    A.queue.splice(i, 1);
    const s = A.sheets.find((x) => !x.on);
    if (!s) continue;
    s.on = true; s.t = 0; s.dur = 0.36 + Math.random() * 0.1; s.spin = 5 + Math.random() * 6;
    s.from.set(q.from[0], q.from[1], q.from[2]);
    s.to.set(p.x + (Math.random() - 0.5) * 8, p.top + Math.min(p.max, p.lv + 5) * p.lay + 0.3, p.z + (Math.random() - 0.5) * 2);
    s.m.visible = true;
  }
  for (const s of A.sheets) {
    if (!s.on) continue;
    s.t += dt;
    const u = Math.min(1, s.t / s.dur);
    s.m.position.lerpVectors(s.from, s.to, u);
    s.m.position.y += Math.sin(u * Math.PI) * 9;
    const r = (1 - u) * s.spin;
    s.m.rotation.set(r * 0.5, r, r * 0.3);
    if (u >= 1) { s.on = false; s.m.visible = false; }
  }
}

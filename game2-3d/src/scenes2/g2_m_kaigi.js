// 小向クエスト2 ゴールデンエイジ編 — 第2章 M菱重工編「相手先の大会議室」
//
// 機体を作る側の、格の高い大会議室。白〜銀の内装に大きな窓、窓の外は飛行場と格納庫（類型）。
// 日本式の会議で座る場所が決まっている:
//   奥（窓側）＝相手の上座。背の高い革張りの椅子、一人ずつの席札とマイクと水。
//   手前（扉側）＝こちらの下座。折りたたみの机に積み重ね椅子、書類と図面の山。席札は無い。
// 契約上は同格。それでも席はこうなる、を家具の差だけで見せる。
//
// 区間（ワールドの x。W=600 のとき）:
//   〜52       廊下。同じ扉の会議室が並び、どの部屋も「使用中」の灯り（会議が会議を呼ぶ）
//   60〜160    部屋に入ってすぐの大きな窓
//   172〜W-104 壁一面の工程表。「今日」の赤い線は残工期（tick の kouki）で右へ動く
//   W-92〜     上座の窓。一段上がった上座の席と、展示台の模型（ボス戦はここ）
// 展示台: 開口部のある胴体の断面の模型と、そこに入らない箱（こちらの装置）。箱は秤に載り、
// 秤の灯りが赤く点滅している——重量超過と、開口部の寸法が合わないを1枚の絵で。
// ボス（x=W-20）の真後ろは低い段だけにして空けてある。窓の外を向いて立てる余白。
//
// 文字・ロゴ・社章・旗は描かない。看板・席札・予約表は無地の板と色の棒だけ。
import { THREE, S, wx, wz, box, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, chair, fireRow, scene, hemi, sun, fill, ROOM } from '../../../game3d/src/render3d.js';

// 配色。相手先は白〜銀。実在企業の色には寄せない（無彩色と青灰だけ）
const C = {
  wall: '#f1eee8', base: '#b4bcc4', ceiling: '#f6f4ef', column: '#e8e6e1',
  carpet: '#7d7972', carpetB: '#837f77', dais: '#5b6470', daisEdge: '#c6cdd4',
  tile: '#b2b7bb', grout: '#9aa0a6',
  frame: '#c3cad1', frameDark: '#98a1aa',
  top: '#f4f5f6', edge: '#b9c0c7', skirt: '#d2d7dc', leg: '#a0a8b0',
  exec: '#2f353d', execHi: '#3d444d', steel: '#aab1b8', headPanel: '#7a5a40',
  ourTop: '#d3d5d0', ourLeg: '#868c92', ourChair: '#5b6571',
  card: '#fbfbf9', paper: '#f4f4ef', paperB: '#ebeae2', mic: '#2a2e33', cup: '#d3e5ee',
  door: '#9da5ad', plate: '#f4f5f3',
  board: '#fafbfb', boardFrame: '#a8b0b8', boardHead: '#d3d9df', grid: '#e1e5e9',
  ours: '#93aec4',            // こちらの装置の色（作業着と同じ系統の水色）
};
// 工程表の棒。予定（青）・済み（緑）・こちら（水色）・相手（銀）・遅れ（赤）
const BAR = { plan: '#4f7db3', done: '#5b9870', ours: '#7fb0d6', theirs: '#a2abb5', late: '#c9473b' };
const BINDER = ['#2f5a8f', '#8f3a2e', '#3f6f4a', '#7a6a2e', '#4a4f6e', '#2e6466', '#6a6f75'];

// 決まった乱数（毎回同じ部屋になるように）
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ===== 形をまとめて1メッシュにする =====
// render3d の boxBatch と同じ考え（頂点カラーで色ごとに分けない）で、円柱や押し出し形も混ぜられる版。
// 置き方: 形を at だけずらす → X・Z・Y の順に回す → 拡縮（世界の軸で）→ x,y,z へ動かす。
// at を使うと「箱の正面に貼った物」を箱ごと回せる。
function batch() {
  const L = { cast: [], plain: [] };
  const api = {
    geo(g, color, x, y, z, o = {}) {
      if (o.at) g.translate(o.at[0], o.at[1], o.at[2]);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      if (o.sx || o.sy || o.sz) g.scale(o.sx || 1, o.sy || 1, o.sz || 1);
      g.translate(x, y, z);
      (o.cast ? L.cast : L.plain).push([g, color]);
      return api;
    },
    box(w, h, d, color, x, y, z, o) { return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    // 円柱（軸は y。寝かせるなら rx / rz）。r2 で上の半径、t0/tl で欠けた円柱
    cyl(r, h, color, x, y, z, o = {}) {
      return api.geo(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 14, 1, false, o.t0 ?? 0, o.tl ?? Math.PI * 2),
        color, x, y, z, o);
    },
    done(mat, receive = true) {
      for (const [kind, list] of Object.entries(L)) {
        if (!list.length) continue;
        const m = new THREE.Mesh(merge(list), kind === 'cast' ? mat : mat.clone());
        m.castShadow = kind === 'cast';
        m.receiveShadow = receive;
        m.matrixAutoUpdate = false; m.updateMatrix();
        addScenery(m);
      }
      L.cast.length = 0; L.plain.length = 0;
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

// 動かす物。build のたびに作り直す（前の章のメッシュを掴んだままにしない）
let anim = null;

// ボス戦の光。窓を背にした上座が少し冷たく締まる（色と強さだけ。灯りは増やさない）
function bossLight() {
  hemi.color.set(0xf1eee8); hemi.groundColor.set(0x8a939d); hemi.intensity = 1.95;
  sun.color.set(0xf4f6fa); sun.intensity = 1.12;
}

export function build(W, halfD, ctx = {}) {
  anim = null;
  const { BACK, FRONT } = zones(halfD, 38, 70);          // 奥 -66 / 手前 98
  setLighting(false);
  // 第2章（坂 0.2）: まだ明るい。春の暖かさが抜けて、晴れた昼の白い光
  hemi.color.set(0xf9f3e8); hemi.groundColor.set(0x9f998e); hemi.intensity = 2.15;
  sun.color.set(0xffebd2); sun.intensity = 1.0; fill.intensity = 1.0;
  scene.background = hex(C.wall);
  scene.fog = new THREE.Fog(hex(C.wall), 360, 1150);

  // 開始位置のカメラは左へ x=-85 まで、ボス戦で右端へ寄ると x=W+90 まで見える
  const XL = -140, XR = W + 140, XM = (XL + XR) / 2, XW = XR - XL;
  const HALL = 52, HZ = -40;            // 廊下はここまで。廊下の壁の面（部屋の奥の壁より手前）
  const WA0 = 60, WA1 = 160;            // 部屋に入ってすぐの窓
  const G0 = 172, G1 = W - 104;         // 壁一面の工程表
  const WB0 = W - 92;                   // 上座の窓（右端まで）
  const DAIS = W - 122, DH = 1.0;       // 一段上がった上座
  const WB = 3.5, WT = 42, TRANS = 31.5;   // 窓の下端・上端（上端は天井に隠れる）・無目
  const TZ = -37;                       // 相手の長机（奥）の中心
  const FZ = 51;                        // こちらの机（手前）の中心

  const B = batch();     // 照明が当たる・動かない物（影を落とすのは cast を付けた奥の大物だけ）
  const O = batch();     // 窓の外の景色と灯り（照明に左右されない色）
  const Gl = batch();    // ガラス（半透明）

  // ===== 床 =====
  B.box(XW, 2, FRONT - BACK, C.carpet, XM, -1, (FRONT + BACK) / 2);
  // タイルカーペットの市松（ごく薄く）。廊下と上座の段の下には敷かない
  for (let i = 0, x = HALL + 5; x < XR; x += 10, i++) {
    for (let j = 0, z = BACK + 5; z < 78; z += 10, j++) {
      if ((i + j) % 2 && !(x > DAIS && z < -29)) B.box(10, 0.04, 10, C.carpetB, x, 0.02, z);
    }
  }
  // 廊下の床は石目のタイル。部屋との境に銀の見切り
  B.box(HALL - XL, 0.06, FRONT - HZ, C.tile, (XL + HALL) / 2, 0.03, (FRONT + HZ) / 2);
  for (let x = XL + 9; x < HALL; x += 9) B.box(0.25, 0.03, FRONT - HZ, C.grout, x, 0.075, (FRONT + HZ) / 2);
  for (let z = HZ + 9; z < FRONT; z += 9) B.box(HALL - XL, 0.03, 0.25, C.grout, (XL + HALL) / 2, 0.075, z);
  B.box(1.4, 0.12, FRONT - HZ, C.frame, HALL, 0.06, (FRONT + HZ) / 2);

  // ===== 奥の壁 =====
  // 廊下の壁（手前寄り）と、部屋の壁。間を部屋の左の壁でつなぐ
  B.box(HALL - XL, 64, 2, C.wall, (XL + HALL) / 2, 32, HZ - 1);
  B.box(2, 64, HZ - BACK + 2, C.wall, HALL - 1, 32, (HZ + BACK) / 2 - 1);
  const solid = (a, b) => B.box(b - a, 64, 2, C.wall, (a + b) / 2, 32, BACK - 1);
  // 大きな窓。腰壁・垂れ壁に分け、間を本当に開けて外の景色を見せる（箱はくり抜けない）
  const windows = (a, b, colEvery) => {
    const m = (a + b) / 2;
    B.box(b - a, WB, 2, C.wall, m, WB / 2, BACK - 1);
    B.box(b - a, 64 - WT, 2, C.wall, m, (64 + WT) / 2, BACK - 1);
    B.box(b - a, 0.8, 2.6, C.frame, m, WB + 0.1, BACK + 0.4);               // 窓台
    B.box(b - a, 1.0, 1.4, C.frame, m, TRANS, BACK - 0.5);                  // 無目
    for (let i = 0, x = a; x <= b + 0.01; x += 12.5, i++) {
      if (colEvery && i % colEvery === 0) B.box(3.6, WT - WB, 2.6, C.column, x, (WB + WT) / 2, BACK - 0.2);
      else B.box(1.0, WT - WB, 1.6, C.frame, x, (WB + WT) / 2, BACK - 0.6);  // 方立（銀）
    }
    Gl.box(b - a, WT - WB, 0.15, '#e3f0f9', m, (WB + WT) / 2, BACK - 1.2);
  };
  solid(HALL, WA0);
  windows(WA0, WA1, 0);
  solid(WA1, WB0);
  windows(WB0, XR, 4);
  // 幅木（銀）
  B.box(XR - HALL, 0.9, 0.3, C.base, (HALL + XR) / 2, 0.45, BACK + 0.15);
  B.box(HALL - XL, 0.9, 0.3, C.base, (XL + HALL) / 2, 0.45, HZ + 0.15);

  // 天井（手前は z=40 で切る）。本編の ceilingSlab に、左右の延長を足す
  ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  B.box(-40 - XL, 2, 40 - BACK, C.ceiling, (XL - 40) / 2, 47, (40 + BACK) / 2);
  B.box(XR - W - 40, 2, 40 - BACK, C.ceiling, (W + 40 + XR) / 2, 47, (40 + BACK) / 2);

  // ===== 窓の外: 飛行場と格納庫（類型）=====
  // カメラは窓より高い所から見下ろすので、本物の距離に置くと窓には地面しか入らない。
  // 本編の窓と同じく書き割りにする: 地面を奥へ向かって上げ、滑走路・格納庫・空を近くに詰める。
  {
    const OUT = (d) => BACK - 2 - d;                     // 壁の外側から d 奥
    const k = 17 / 90, ang = Math.atan(k);
    const yg = (d) => -8 + (d - 2) * k;                  // 書き割りの地面の高さ
    const strip = (d0, d1, color, lift = 0, x0 = XL - 260, x1 = XR + 260) => {
      const dc = (d0 + d1) / 2;
      O.box(x1 - x0, 0.4, (d1 - d0) / Math.cos(ang), color, (x0 + x1) / 2, yg(dc) - 0.2 + lift, OUT(dc), { rx: ang });
    };
    strip(2, 50, '#c4c7c3');                 // 手前のエプロン（コンクリート）
    strip(50, 58, '#a3b18e');                // 芝
    strip(58, 67, '#6b7177');                // 滑走路
    strip(58.6, 59.2, '#eef0ee', 0.12);      // 縁の白線
    strip(65.8, 66.4, '#eef0ee', 0.12);
    for (let x = XL - 240; x < XR + 240; x += 15) strip(62.1, 62.9, '#f2f3f0', 0.14, x, x + 7);   // 中心線
    strip(67, 73, '#a7b48f');                // 芝
    strip(73, 82, '#c9ccc7');                // 格納庫の前のエプロン
    strip(82, 96, '#a9b593');                // 格納庫の裏
    // 格納庫。かまぼこ屋根と大きな扉。前の面は明るく、扉は濃く（照明なしで形を読ませる）
    const hangar = (x, w, h, d = 86) => {
      const y0 = yg(d - 4) - 0.6, z = OUT(d);
      O.box(w, h, 14, '#d9dee2', x, y0 + h / 2, z);
      O.box(w + 0.6, h, 0.4, '#e9ecee', x, y0 + h / 2, z + 7.1);                       // 正面の壁
      O.cyl(w / 2, 14, '#b9c2ca', x, y0 + h, z, { rx: Math.PI / 2, t0: Math.PI / 2, tl: Math.PI, seg: 22, sy: 0.32 });
      O.box(w * 0.8, h * 0.82, 0.4, '#8b97a2', x, y0 + h * 0.41, z + 7.4);            // 扉
      for (let i = 1; i < 6; i++) O.box(0.35, h * 0.82, 0.3, '#a6b0b9', x - w * 0.4 + i * w * 0.8 / 6, y0 + h * 0.41, z + 7.7);
      O.box(w * 0.86, 0.9, 0.5, '#7a8590', x, y0 + h * 0.84, z + 7.6);                // 扉の上の梁
    };
    // 塔（管制塔の類型）と、駐機している機体（特定の機種に見えない、ただの細長い胴と直線翼）
    const tower = (x, d) => {
      const y0 = yg(d) - 0.5, z = OUT(d);
      O.box(3.0, 16, 3.0, '#e4e7ea', x, y0 + 8, z);
      O.box(6.4, 2.8, 6.4, '#4e6476', x, y0 + 17.4, z);
      O.box(7.2, 0.7, 7.2, '#d0d5da', x, y0 + 19.1, z);
      O.box(0.3, 2.6, 0.3, '#9aa3ab', x + 1.5, y0 + 20.7, z);
    };
    const plane = (x, d, s = 1) => {
      const y = yg(d) + 1.6 * s, z = OUT(d);
      O.cyl(1.1 * s, 13 * s, '#d5dadf', x, y, z, { rz: Math.PI / 2, seg: 12 });
      O.cyl(0.05, 2.6 * s, '#cdd3d8', x + 7.8 * s, y, z, { r2: 1.1 * s, rz: -Math.PI / 2, seg: 12 });   // 機首
      O.box(3.0 * s, 0.3 * s, 13 * s, '#b4bcc4', x + 0.6 * s, y - 0.3 * s, z);           // 主翼
      O.box(2.6 * s, 3.0 * s, 0.35 * s, '#b9c1c8', x - 5.6 * s, y + 1.9 * s, z);         // 垂直尾翼
      O.box(1.8 * s, 0.25 * s, 5.0 * s, '#b4bcc4', x - 5.8 * s, y + 0.3 * s, z);         // 水平尾翼
      O.box(0.35, 1.4 * s, 0.35, '#5a6168', x + 5 * s, y - 1.4 * s, z);                  // 脚
    };
    // 部屋に入ってすぐの窓（道中のカメラから見える）
    hangar(92, 42, 11); hangar(150, 30, 9, 88); tower(196, 84); plane(118, 77, 0.9);
    hangar(30, 34, 10, 88);
    // 上座の窓（ボス戦のカメラから見える）
    hangar(W - 74, 50, 12); hangar(W + 8, 40, 11, 88); hangar(W + 84, 46, 12); tower(W + 140, 84);
    plane(W + 40, 76, 1.0); plane(W - 30, 62, 0.8);
    // 遠くの丘と空。空は地平線ほど白く霞ませる
    for (let i = 0, x = XL - 200; x < XR + 240; x += 70 + (i % 3) * 22, i++) {
      O.cyl(36 + (i % 4) * 9, 2, i % 2 ? '#b3c4d0' : '#bccbd6', x, 9.6 + (i % 3) * 0.8, OUT(98), { rx: Math.PI / 2, seg: 18, sy: 0.16 + (i % 3) * 0.05 });
    }
    O.box(XW + 520, 15, 1, '#d8e7f2', XM, 7.5, OUT(104));
    O.box(XW + 520, 8, 1, '#c2dbee', XM, 19, OUT(104));
    O.box(XW + 520, 90, 1, '#a6cbea', XM, 68, OUT(104));
    for (const [x, y, w] of [[60, 21, 34], [140, 24, 22], [W - 40, 27, 40], [W + 70, 22, 28], [W - 140, 23, 26]]) {
      O.box(w, 2.2, 0.6, '#f1f6fa', x, y, OUT(102));
      O.box(w * 0.55, 1.6, 0.6, '#f6f9fb', x + w * 0.12, y + 1.6, OUT(102));
    }
  }

  // ===== 廊下: 同じ扉の会議室が並ぶ（どの部屋も使用中）=====
  for (let x = -112; x < HALL - 30; x += 38) {
    B.box(0.8, 22.4, 0.9, C.frame, x - 5.8, 11.2, HZ + 0.45);
    B.box(0.8, 22.4, 0.9, C.frame, x + 5.8, 11.2, HZ + 0.45);
    B.box(12.4, 0.8, 0.9, C.frame, x, 22.4, HZ + 0.45);
    B.box(10.8, 22.0, 0.5, C.door, x, 11.0, HZ + 0.25);                 // 扉
    B.box(1.4, 7.5, 0.1, '#5f7182', x - 3.0, 14.5, HZ + 0.52);          // 細いガラス
    B.box(2.4, 0.5, 0.7, C.steel, x + 3.6, 10.5, HZ + 0.75);            // レバー
    B.box(5.4, 2.4, 0.3, C.plate, x - 10, 16.5, HZ + 0.15);             // 室名札（無地）
    B.box(3.6, 0.5, 0.1, '#5d6d80', x - 10, 16.5, HZ + 0.35);
    B.box(2.2, 1.5, 0.4, '#e9ecee', x - 10, 19.6, HZ + 0.2);            // 使用中の灯り
    O.box(1.5, 0.9, 0.12, '#ff5a46', x - 10, 19.6, HZ + 0.46);
  }
  // 会議室の予約表。升目が全部埋まっている
  {
    const bx = 27, by = 16.5;
    B.box(16, 11.4, 0.4, C.boardFrame, bx, by, HZ + 0.2);
    B.box(15, 10.4, 0.3, C.board, bx, by, HZ + 0.45);
    B.box(15, 1.2, 0.1, C.boardHead, bx, by + 4.4, HZ + 0.65);
    const cols = ['#7fb0d6', '#a2abb5', '#4f7db3', '#c9a24a', '#7fb0d6', '#a2abb5', '#c9473b'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      B.box(2.1, 1.3, 0.1, cols[(r * 3 + c * 5) % cols.length], bx - 5.9 + c * 2.36, by + 2.6 - r * 1.75, HZ + 0.65);
    }
  }
  // 廊下の壁の上半分: 銀の見切りと、扉の間に額（飛行場の写真と、図面の写し。どちらも文字なし）
  B.box(HALL - XL, 1.0, 0.7, C.frame, (XL + HALL) / 2, 28.6, HZ + 0.35);
  for (let i = 0, x = -112 + 17.5; x < HALL - 40; x += 38, i++) {
    B.box(13, 8.6, 0.5, C.frameDark, x, 16.5, HZ + 0.25);
    if (i % 2 === 0) {
      B.box(12, 4.2, 0.2, '#a9cdea', x, 18.5, HZ + 0.6);                // 空
      B.box(12, 3.4, 0.2, '#b3bc9f', x, 14.6, HZ + 0.6);                // 地面
      B.box(6.5, 2.4, 0.2, '#eef1f3', x + 1.5, 16.9, HZ + 0.7);         // 白い建屋
      B.box(12, 0.7, 0.2, '#6f767c', x, 13.6, HZ + 0.7);                // 滑走路
    } else {
      B.box(12, 7.6, 0.2, '#e8eef4', x, 16.5, HZ + 0.6);                // 図面の写し
      for (let k = 0; k < 5; k++) B.box(3 + rnd(k + i) * 7, 0.22, 0.1, '#5a7fa8', x - 1.5 + rnd(k * 3 + i) * 3, 13.8 + k * 1.3, HZ + 0.72);
      B.box(0.22, 5.5, 0.1, '#5a7fa8', x - 3.5, 16.2, HZ + 0.72);
    }
  }
  // 部屋の扉は開け放して、部屋の左の壁に寄せてある
  B.box(0.6, 22, 11, C.door, HALL + 0.4, 11, HZ + 6.5);
  B.box(1.0, 23, 0.9, C.frame, HALL + 0.5, 11.5, HZ + 0.45);

  // ===== 時計（工程表の両脇の柱）=====
  const clocks = [];
  const clock = (x, y, ph) => {
    const z = BACK;
    B.cyl(3.0, 0.4, C.frameDark, x, y, z + 0.2, { rx: Math.PI / 2, seg: 24 });
    B.cyl(2.6, 0.3, '#fbfcfc', x, y, z + 0.5, { rx: Math.PI / 2, seg: 24 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      B.box(i % 3 ? 0.18 : 0.32, i % 3 ? 0.45 : 0.85, 0.06, '#3a4048', x + Math.sin(a) * 2.15, y + Math.cos(a) * 2.15, z + 0.68, { rz: -a });
    }
    const hour = box(0.42, 1.5, 0.12, '#2a2e33', x, y, z + 0.78, { receive: false });
    hour.geometry.translate(0, 0.55, 0);
    const min = box(0.28, 2.2, 0.1, '#2a2e33', x, y, z + 0.9, { receive: false });
    min.geometry.translate(0, 0.9, 0);
    clocks.push({ hour, min, ph });
  };
  clock((WA1 + G0) / 2, 27, 0.6);
  clock((G1 + WB0) / 2, 27, 1.9);

  // ===== 壁一面の工程表 =====
  // 文字は書かない。日付の帯の目盛り、行ごとの色の棒、菱形の節目、赤い遅れ、付箋。
  // 上の行が相手（機体・銀）、下の行がこちら（レーダー・水色）。その継ぎ目に赤が溜まる。
  let today = null, gDead = G1 - 18;
  {
    const yB = 11, yT = 32, m = (G0 + G1) / 2, yC = (yB + yT) / 2;
    B.box(G1 - G0 + 2.4, yT - yB + 2.4, 0.5, C.boardFrame, m, yC, BACK + 0.25);
    B.box(G1 - G0, yT - yB, 0.3, C.board, m, yC, BACK + 0.65);
    B.box(G1 - G0, 1.8, 0.1, C.boardHead, m, yT - 1.1, BACK + 0.85);
    for (let x = G0 + 6.5; x < G1 - 1; x += 6.5) B.box(0.22, 1.4, 0.08, '#8e98a2', x, yT - 1.1, BACK + 0.94);
    for (let x = G0 + 26; x < G1 - 2; x += 26) B.box(0.2, yT - yB - 3, 0.06, C.grid, x, (yB + yT - 2.2) / 2, BACK + 0.83);
    for (let x = G0 + 82; x < G1 - 20; x += 82) B.box(0.7, yT - yB, 0.2, C.boardFrame, x, yC, BACK + 0.9);  // 紙の継ぎ目
    // 行。上4行が相手（機体）、下4行がこちら（レーダー）。間に濃い仕切りの線
    const rows = 8, pitch = 2.2, yRow = (r) => yT - 3.4 - r * pitch;
    B.box(G1 - G0 - 1, 0.28, 0.08, '#6f7a86', m, (yRow(3) + yRow(4)) / 2, BACK + 0.86);
    for (let r = 0; r < rows; r++) {
      const y = yRow(r), mine = r >= 4;
      for (let x = G0; x < G1 - 20; x += 82) B.box(5.2, 1.2, 0.1, mine ? '#b9cfe0' : '#c9ced4', x + 3.4, y, BACK + 0.9);   // 行の見出し（無地）
      let x = G0 + 7.5 + rnd(r) * 5 + (r % 4) * 3, n = 0;
      while (x < gDead - 5 && n < 22) {
        const len = 9 + rnd(r * 31 + n) * 20;
        const end = Math.min(x + len, gDead - 0.8);
        const col = end < G0 + 46 ? BAR.done : mine ? BAR.ours : (r % 2 ? BAR.theirs : BAR.plan);
        B.box(end - x, 1.3, 0.1, col, (x + end) / 2, y, BACK + 0.92);
        // 遅れ（赤）。あとから継ぎ足した棒。こちらの行ほど多く、納期に近いほど多い
        const late = (mine ? 0.32 : 0.14) + (x - G0) / (G1 - G0) * 0.35;
        let tail = end;
        if (rnd(r * 13 + n * 3) < late) {
          tail = Math.min(end + 2.5 + rnd(r + n * 5) * 7, gDead + 9);
          B.box(tail - end, 1.3, 0.1, BAR.late, (end + tail) / 2, y, BACK + 0.94);
        }
        if (rnd(r * 17 + n) < 0.3) B.box(1.1, 1.1, 0.1, '#2c3238', tail + 0.8, y, BACK + 0.98, { rz: Math.PI / 4 });
        // ときどき次の行へつながる線（前の作業が終わらないと始められない）
        if (r < rows - 1 && rnd(r * 23 + n * 7) < 0.22) B.box(0.18, pitch, 0.06, '#59636e', tail, y - pitch / 2, BACK + 0.97);
        x = tail + 1.8 + rnd(r * 3 + n * 11) * 6; n++;
      }
    }
    // 納期の線（濃い赤）と、それを越えて伸びる赤い棒
    B.box(0.6, yT - yB - 2.6, 0.12, '#7a1d18', gDead, (yB + yT - 2.4) / 2, BACK + 1.0);
    B.box(1.5, 1.5, 0.12, '#7a1d18', gDead, yT - 2.7, BACK + 1.0, { rz: Math.PI / 4 });
    for (const r of [4, 5, 6, 7, 2]) B.box(7 + rnd(r) * 5, 1.3, 0.1, BAR.late, gDead + 4 + rnd(r) * 2, yRow(r), BACK + 0.96);
    // 付箋
    for (let i = 0; i < 16; i++) {
      const x = G0 + 14 + rnd(i * 7 + 2) * (G1 - G0 - 24), y = yB + 2.6 + rnd(i * 5 + 1) * (yT - yB - 6);
      B.box(1.9, 1.9, 0.06, ['#f2df6e', '#f2a8b6', '#a9dba2', '#f2df6e'][i % 4], x, y, BACK + 1.04, { rz: (rnd(i) - 0.5) * 0.3 });
    }
    // 「今日」の線。残工期が減るほど右（納期）へ寄る（onEvent の tick で動かす）
    today = box(0.42, yT - yB - 2.6, 0.12, '#e3372b', G0 + 46, (yB + yT - 2.4) / 2, BACK + 1.12,
      { emissive: '#7a120a', receive: false });
  }

  // ===== 奥: 相手の長机（上座の側）=====
  // 机の向こうに背の高い革張りの椅子。一人ずつ席札・マイク・資料・水。きちんと揃っている。
  // 背もたれは「下が広く上が細い」2段＋頭もたれ。1枚の板だと黒い衝立に見えるので、
  // 段の継ぎ目に明るい縫い目を通し、全体を後ろへ傾ける（上面に光が乗って椅子と読める）
  const execChair = (x, z, y0, tall) => {
    B.box(6.6, 1.2, 6.4, C.exec, x, y0 + 5.6, z, { cast: true });                                // 座面
    const back = (w, h, d, col, ay, az = 0) =>
      B.box(w, h, d, col, x, y0 + 6.2, z - 3.4, { at: [0, ay, az], rx: -0.16, cast: true });
    back(6.8, tall * 0.6, 1.4, C.exec, tall * 0.3);
    back(6.0, tall * 0.4, 1.5, C.execHi, tall * 0.8);
    back(6.9, 0.3, 1.0, '#6b737d', tall * 0.6, 0.35);                                            // 縫い目
    back(4.8, 1.7, 1.7, C.exec, tall + 0.85, -0.1);                                              // 頭もたれ
    for (const dx of [-3.5, 3.5]) B.box(0.8, 0.8, 5.0, C.steel, x + dx, y0 + 8.1, z - 0.3);       // 肘掛け
    B.box(1.1, 4.4, 1.1, C.steel, x, y0 + 2.6, z);
    B.box(5.4, 0.5, 5.4, C.steel, x, y0 + 0.35, z, { ry: 0.4 });
  };
  const seatItems = (x, y0, z0, big) => {
    B.box(big ? 5.4 : 4.4, big ? 2.6 : 2.3, 0.5, C.card, x, y0 + 1.2, z0 + 3.4, { rx: -0.22 });   // 席札（無地）
    B.box(2.0, 0.5, 1.4, C.mic, x - 2.4, y0 + 0.25, z0 - 1.2);                                    // マイク
    B.box(0.25, 3.0, 0.25, C.mic, x - 2.4, y0 + 1.7, z0 - 1.9, { rx: -0.5 });
    B.box(0.7, 0.7, 1.0, '#3c4148', x - 2.4, y0 + 3.0, z0 - 2.7);
    B.box(4.6, 0.12, 3.4, C.paper, x + 1.4, y0 + 0.06, z0 - 1.3, { ry: 0.06 });                  // 資料
    B.cyl(0.55, 1.8, C.cup, x + 3.6, y0 + 0.9, z0 - 2.4, { seg: 10 });                           // 水
  };
  // 低い生け花（机の上。椅子と椅子の間）
  const ikebana = (x, y0, z) => {
    B.box(6.4, 1.3, 2.4, '#eff0f1', x, y0 + 0.65, z);
    for (let i = 0; i < 7; i++) {
      B.box(1.2 + rnd(i + x) * 1.1, 1.1 + rnd(i + 9 + x) * 2.0, 0.8, i % 3 ? '#56844c' : '#6c9c58',
        x - 2.6 + i * 0.85, y0 + 2.0 + rnd(i + 3 + x) * 1.1, z, { rz: (rnd(i * 5 + x) - 0.5) * 0.9 });
    }
    for (let i = 0; i < 4; i++) {
      B.box(0.95, 0.95, 0.95, ['#f6f2ea', '#e9b6c2', '#f6f2ea', '#eed77e'][i], x - 2.2 + i * 1.5, y0 + 3.3 + rnd(i * 7 + x) * 1.3, z + 0.2);
    }
  };
  for (let s = 0, x0 = 66; x0 < DAIS - 40; x0 += 51, s++) {
    const x = x0 + 25;
    B.box(50, 0.9, 10, C.top, x, 8.35, TZ, { cast: true });
    B.box(50, 1.0, 0.4, C.edge, x, 8.35, TZ + 5.15);
    B.box(49, 6.2, 0.6, C.skirt, x, 4.7, TZ + 4.5, { cast: true });                              // 幕板
    for (const dx of [-24.2, 24.2]) B.box(1.2, 7.9, 9.4, C.leg, x + dx, 3.95, TZ, { cast: true });
    for (let i = 0; i < 4; i++) {
      const sx = x - 18.75 + i * 12.5;
      execChair(sx, TZ - 10, 0, 8.6);
      seatItems(sx, 8.8, TZ, false);
    }
    // 机ごとに少しずつ違う物: 生け花／水差しと盆／綴じた報告書の束（相手の資料はきちんと揃っている）
    if (s % 3 === 1) ikebana(x, 8.8, TZ + 1.6);
    else if (s % 3 === 0) {
      B.box(5.6, 0.3, 3.6, '#c9ced3', x, 8.95, TZ + 1.2);
      B.cyl(0.9, 3.0, '#d9e6ee', x - 1.2, 10.6, TZ + 1.2, { seg: 12 });
      for (const dx of [0.8, 2.0]) B.cyl(0.45, 1.3, C.cup, x + dx, 9.75, TZ + 1.6, { seg: 8 });
    } else {
      for (let k = 0; k < 3; k++) B.box(4.2, 0.7, 3.0, ['#e9ebee', '#d5dbe2', '#e9ebee'][k], x, 9.15 + k * 0.72, TZ + 0.8);
    }
  }
  // 窓ぎわの鉢植え（背の高い観葉植物）
  const plant = (x, z, y0 = 0, h = 20) => {
    B.cyl(2.8, 5.0, '#e8eaec', x, y0 + 2.5, z, { seg: 14, cast: true });
    B.box(0.7, h * 0.6, 0.7, '#6b5a44', x, y0 + 5 + h * 0.3, z);
    for (let i = 0; i < 5; i++) {
      B.box(5.2 - i * 0.5, 3.4, 5.2 - i * 0.5, i % 2 ? '#4c7a48' : '#5e8f52', x + (rnd(i + x) - 0.5) * 2.2,
        y0 + 7 + i * (h - 8) / 5, z + (rnd(i * 3 + x) - 0.5) * 2, { ry: i * 0.7, cast: true });
    }
  };
  plant(WA0 + 4, BACK + 6); plant(WA1 - 4, BACK + 6, 0, 18);

  // ===== 右端: 一段上がった上座 =====
  const DZ = -29.5;                     // 段の手前の縁（奥ゾーンの中）
  B.box(XR - DAIS, DH, DZ - BACK, C.dais, (DAIS + XR) / 2, DH / 2, (BACK + DZ) / 2);
  B.box(XR - DAIS, DH + 0.1, 0.5, C.daisEdge, (DAIS + XR) / 2, DH / 2 + 0.05, DZ - 0.1);
  B.box(0.5, DH + 0.1, DZ - BACK, C.daisEdge, DAIS, DH / 2 + 0.05, (BACK + DZ) / 2);
  // 上座の机。正面の幕板を濃くして、ほかの机と格を分ける。椅子は一回り大きい
  {
    const hx = W - 78, hz = -40;
    B.box(58, 1.0, 12, C.top, hx, DH + 8.6, hz, { cast: true });
    B.box(58, 1.1, 0.4, C.edge, hx, DH + 8.6, hz + 6.2);
    B.box(56, 7.4, 0.8, C.headPanel, hx, DH + 4.4, hz + 5.4, { cast: true });
    B.box(56, 0.35, 0.2, C.steel, hx, DH + 6.9, hz + 5.9);
    for (const dx of [-27.4, 27.4]) B.box(1.4, 8.1, 11, C.leg, hx + dx, DH + 4.05, hz, { cast: true });
    execChair(hx - 17, hz - 10.5, DH, 11);
    execChair(hx, hz - 10.5, DH, 13);
    execChair(hx + 17, hz - 10.5, DH, 11);
    for (const dx of [-17, 0, 17]) seatItems(hx + dx, DH + 9.1, hz, true);
    ikebana(hx + 8.5, DH + 9.1, hz + 2.4);   // 上座の机の真ん中に生け花（低く）
  }
  // 展示台の模型: 開口部のある胴体の断面と、そこに入らない箱（こちらの装置）
  let lamp = null;
  {
    // ボス（x=W-20）のすぐ右。自機が押し戻されてカメラが左へ寄っても（自機 x≈W-60）右端に切れない位置
    const px = W + 8, pz = -46, top = DH + 8;
    B.box(38, 8, 15, '#f1f3f4', px, DH + 4, pz, { cast: true });                 // 展示台
    B.box(38.6, 0.6, 15.6, C.steel, px, DH + 0.3, pz);
    B.box(7, 1.4, 0.2, '#c9d0d6', px, DH + 5.5, pz + 7.6);                        // 説明札（無地）
    B.box(4.6, 0.3, 0.1, '#8a949e', px, DH + 5.5, pz + 7.75);
    // 胴体の断面。下の左に開口部（ここに装置を入れる）。床と、床下の区画
    const R1 = 7.4, R0 = 6.4, cx = px + 6.5, cy = top + 0.4 + R1, gc = Math.PI * 1.25, gh = 0.44;
    const ring = new THREE.Shape();
    ring.absarc(0, 0, R1, gc + gh, gc - gh + Math.PI * 2, false);
    ring.absarc(0, 0, R0, gc - gh + Math.PI * 2, gc + gh, true);
    ring.closePath();
    const skin = new THREE.ExtrudeGeometry(ring, { depth: 12, bevelEnabled: false, curveSegments: 30 });
    B.geo(skin, '#e2e6ea', cx, cy, pz, { at: [0, 0, -6], ry: 0.22, cast: true });
    const face = new THREE.ExtrudeGeometry(ring, { depth: 0.4, bevelEnabled: false, curveSegments: 30 });
    B.geo(face, '#7f8a95', cx, cy, pz, { at: [0, 0, 6.0], ry: 0.22 });           // 切り口（濃く塗って断面と分かるように）
    // 客室の窓の列（カメラ側の左上の外板）。これで「管」ではなく「胴体」に見える
    for (const zi of [-4.2, -1.4, 1.4, 4.2]) {
      B.box(0.35, 1.1, 1.3, '#3b4855', cx, cy, pz, { at: [R1 + 0.06, 0, zi], rz: Math.PI * 0.83, ry: 0.22 });
    }
    B.box(11.8, 0.5, 11.6, '#c4ccd3', cx, cy, pz, { at: [0, -1.9, 0], ry: 0.22 }); // 客室の床
    for (const dz of [-3, 3]) B.box(0.5, 3.8, 0.5, '#9aa4ae', cx, cy, pz, { at: [0, -4.0, dz], ry: 0.22 });
    B.box(10, 1.4, 7, C.steel, cx, top + 0.5, pz, { ry: 0.22 });                  // 受け台
    // 開口部の縁を黄色と黒で縁取る（寸法の基準の印）
    for (const s of [-1, 1]) {
      const a = gc + s * gh;
      B.box(0.5, 1.6, 12.4, '#e2c23a', cx, cy, pz, { at: [Math.cos(a) * (R0 + R1) / 2, Math.sin(a) * (R0 + R1) / 2, 0], ry: 0.22 });
    }
    // 秤と、その上の箱。箱は開口部よりずっと大きい
    const bx = px - 10.5, by = top;
    B.box(13, 0.7, 10, '#9aa2aa', bx, by + 0.35, pz);
    B.box(4.6, 2.2, 1.4, '#2a2f35', bx, by + 1.1, pz + 5.6);
    lamp = box(2.6, 0.9, 0.2, '#ff3b2f', bx, by + 1.3, pz + 6.35, { emissive: '#ff2a1a', receive: false });
    const unit = (w, h, d, col, at) => B.box(w, h, d, col, bx + 0.6, by + 0.7, pz, { at, ry: 0.14, cast: true });
    unit(10.5, 7.4, 8.6, C.ours, [0, 3.7, 0]);
    for (let i = 0; i < 4; i++) unit(9, 0.35, 0.2, '#6d879c', [0, 1.8 + i * 1.5, 4.35]);   // 放熱の溝
    unit(4.2, 0.7, 1.2, '#6d879c', [0, 7.75, 0]);                                         // 取っ手
    unit(1.6, 2.4, 0.15, '#c8352b', [-4.6, 5.0, 4.45]);                                   // 赤い札
  }
  plant(W + 64, BACK + 7, DH, 22);

  // ===== 手前: こちらの机（下座）=====
  // 折りたたみの机と積み重ね椅子。席札もマイクも無い（マイクは3台に1本を回して使う）。
  // 書類の山・バインダー・丸めた図面。背の高い物は置かない（手前の線より低く）
  const ourEnd = W - 140;   // ボス戦が始まるときのカメラに机が入らないように（自機の足元が机に隠れた）
  for (let s = 0, x0 = HALL + 6; x0 + 40 <= ourEnd + 0.1; x0 += 40, s++) {
    const x = x0 + 20;
    B.box(39, 0.6, 9, C.ourTop, x, 7.3, FZ);
    for (const dx of [-18.6, 18.6]) for (const dz of [-3.8, 3.8]) B.box(0.7, 7.0, 0.7, C.ourLeg, x + dx, 3.5, FZ + dz);
    B.box(37, 0.5, 0.5, C.ourLeg, x, 1.6, FZ + 3.8);
    for (let i = 0; i < 4; i++) {
      const cx = x - 15 + i * 10;
      B.box(5.4, 0.7, 5.2, C.ourChair, cx, 4.5, 59.5);
      B.box(5.4, 3.6, 0.6, C.ourChair, cx, 8.0, 62.0);
      for (const dx of [-2.6, 2.6]) B.box(0.4, 4.3, 5.0, C.ourLeg, cx + dx, 2.15, 59.6);
    }
    // 書類の山
    const yT = 7.6;
    for (let k = 0; k < 3; k++) {
      const h = 0.8 + rnd(s * 9 + k) * 2.6, xx = x - 14 + k * 11 + rnd(s + k * 3) * 3;
      B.box(4.6, h, 3.4, k % 2 ? C.paperB : C.paper, xx, yT + h / 2, FZ - 1.5 + rnd(s * 2 + k), { ry: (rnd(k + s) - 0.5) * 0.3 });
    }
    // 立てたバインダーの列と、寝かせたバインダー
    const nb = 3 + Math.floor(rnd(s * 5) * 4), bx0 = x + 5 + rnd(s) * 4;
    for (let k = 0; k < nb; k++) B.box(0.95, 4.2, 3.4, BINDER[(s * 3 + k) % BINDER.length], bx0 + k * 1.05, yT + 2.1, FZ + 2.2);
    B.box(0.4, 3.0, 3.0, C.ourLeg, bx0 + nb * 1.05 + 0.2, yT + 1.5, FZ + 2.2);
    B.box(3.4, 0.9, 4.4, BINDER[(s + 2) % BINDER.length], x - 4, yT + 0.45, FZ + 2.0, { ry: 0.2 });
    // 丸めた図面と、広げた図面
    if (s % 2 === 0) {
      B.cyl(0.55, 9, '#e7edf2', x + 9, yT + 0.55, FZ - 2.6, { rz: Math.PI / 2, ry: 0.2, seg: 10 });
      B.cyl(0.5, 8, '#cfe0ee', x + 8, yT + 1.5, FZ - 2.2, { rz: Math.PI / 2, ry: -0.1, seg: 10 });
    } else {
      B.box(12, 0.06, 7, '#dbe7f1', x - 3, yT + 0.03, FZ - 1.0, { ry: 0.05 });
      for (let k = 0; k < 4; k++) B.box(8 - k, 0.03, 0.2, '#4f78a8', x - 3.6 + k * 0.4, yT + 0.08, FZ - 3.0 + k * 1.3, { ry: 0.05 });
    }
    if (s % 3 === 1) {   // 回して使うマイク
      B.box(2.0, 0.5, 1.4, C.mic, x - 8, yT + 0.25, FZ + 2.4);
      B.box(0.25, 3.0, 0.25, C.mic, x - 8, yT + 1.7, FZ + 1.7, { rx: -0.5 });
    }
  }
  // 廊下の手前: 待つための低いベンチと鉢植え（低い物だけ）
  for (const x of [-92, -10]) {
    B.box(26, 1.0, 6, '#c7ad86', x, 4.4, 50);
    for (const dx of [-11, 11]) B.box(1.0, 3.9, 5, C.steel, x + dx, 1.95, 50);
  }
  B.cyl(2.6, 4.6, '#e6e8ea', -50, 2.3, 48, { seg: 14 });
  B.box(4.4, 2.4, 4.4, '#4f7a4c', -50, 5.4, 48, { ry: 0.4 });
  B.box(3.4, 2.2, 3.4, '#5f8c55', -50, 6.6, 48, { ry: 1.1 });
  // 上座の側の手前は低い植え込みだけ（ボス戦の画面の下の縁に入る）
  B.box(30, 3.6, 5, '#e3e6e9', W + 8, 1.8, 55);
  for (let i = 0; i < 7; i++) B.box(3.6, 1.6 + rnd(i * 3) * 1.2, 3.4, i % 2 ? '#4f7a4c' : '#5f8c55', W - 5 + i * 4.3, 4.2, 55 + (rnd(i) - 0.5), { ry: i * 0.5 });

  // ===== まとめて描く =====
  B.done(new THREE.MeshLambertMaterial({ vertexColors: true }));
  O.done(new THREE.MeshBasicMaterial({ vertexColors: true }), false);
  Gl.done(new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.13, depthWrite: false, emissive: 0x1a2f40,
  }), false);

  anim = { clocks, today, lamp, g0: G0 + 46, gDead, steady: false };   // 「今日」は済み（緑）の棒の終わりから
  if (ctx.stage && ctx.stage.bossStarted) bossLight();   // ?boss=1 では bossStart が来ないので、ここで
}

export function onEvent(name, arg) {
  if (!anim) return;
  if (name === 'tick') {
    const t = (arg && arg.t) || 0;
    // 時計は会議の長さぶん回る（ゲームの20秒で1時間）
    for (const c of anim.clocks) {
      c.min.rotation.z = -t * 0.314;
      c.hour.rotation.z = -c.ph - t * 0.026;
    }
    // 「今日」の線: 残工期が減るほど納期へ寄る
    const k = Math.max(0, Math.min(1, arg && arg.kouki != null ? arg.kouki : 1));
    if (anim.today) anim.today.position.x = anim.g0 + (1 - k) * (anim.gDead - anim.g0);
    // 秤の赤い灯り。倒しても重さは変わらないので、点きっぱなしになる
    if (anim.lamp) anim.lamp.visible = anim.steady || (t * 2.4) % 2 < 1.25;
  } else if (name === 'bossStart') {
    bossLight();
  } else if (name === 'defeated') {
    anim.steady = true;
  }
}

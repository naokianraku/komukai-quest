// 小向クエスト2 ゴールデンエイジ編 — 第1章 配属編「独身寮」（x 860〜1149。寮長が中ボス）
//
// 研修センター（講堂・実習場）とはっきり違う「生活の場所」。夕方の暖かい光。
//   奥（左から）: 玄関（ガラス戸の向こうに夕焼け・土間と下駄箱・上がり框に揃えたスリッパ）
//               → 寮監室の受付窓・在寮札・門限の掛け時計・掲示板 → 同じ扉が並ぶ廊下
//   手前（低い物だけ）: 引っ越しの段ボール・スリッパラック・腰掛け → 洗濯物の物干し
//               → 寮の食堂の一角（トレーの並ぶ長机・湯呑・やかん・配膳台の炊飯ジャー）
// 掛け時計は、寮長が出る地点（x=1080）で門限の10時ちょうどを指す。進んだぶんだけ針が進み、
// 秒針は刻む（onEvent の tick）。
//
// 描画回数を抑えるため、動かない箱は boxBatch、円柱や傾いた物・光って見える物・ガラス・
// 差し込む夕日はそれぞれ1つのメッシュにまとめる（場面ぜんぶで本描画 13 回・影 1 回。針3本を含む）。
// 床と壁の見える面は穴あきの1枚板にする（箱を突き合わせると継ぎ目が点線に見えるため）。
// 文字・ロゴは描かない。札や掲示物はすべて無地。
import { THREE, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill } from '../../../game3d/src/render3d.js';

// ---- 配置（ワールド座標）----
const FZ = -36;                   // 扉の並ぶ壁の中心。表面は z=-35（奥ゾーンの手前寄り＝狭い廊下）
const ENT0 = 212, ENT1 = 298;     // 玄関の凹み（内法）。土間は一段低い
const SF0 = 238, SF1 = 272, SF_TOP = 30;   // 玄関のガラス戸（欄間込みの開口）
const KW0 = 307, KW1 = 329;       // 寮監室の受付窓の開口
const ZAI_X = 342;                // 在寮札（その上に掛け時計）
const KEIJI_X = 364;              // 掲示板
const CLOCK_Y = 28.6;
const DOOR0 = 386, PITCH = 26;    // 扉の列
const DW = 4.75, DH = 21.5;       // 扉の開口（半幅・高さ）。扉・枠・壁の穴で共通
const OPEN_X = 412;               // 開いている扉（寮長が出る辺りの背中に、西日の部屋が見える）
const DIN0 = 350, DIN1 = 545;     // 手前の食堂の床（Pタイル）
// 時計: 寮に入った地点 → 寮長が出る地点（ゲーム座標）で 21:38 → 22:00
const RYO_X0 = 860, RYOCHO_X = 1080;

const P = {
  bg: '#e3d3ba', wall: '#ebe0cb', ceiling: '#eee3cf',
  wains: '#8e6a46', rail: '#6c4a2f', base: '#4b3322',
  floor: '#9c7552', floorLine: '#7f5b3d',
  doma: '#a39b8e', domaLine: '#8a8276', kamachi: '#6a4529', domaSkirt: '#b9af9f',
  door: '#b3834f', doorFrame: '#6b4b31', brass: '#c6a55f', plate: '#f3eee2', dark: '#2c2420',
  geta: '#b78f62', getaIn: '#3b2b1f',
  alu: '#5c4b3c', silver: '#a9a69d',
  tile: '#c9b58d', tileDark: '#b39c74',
  table: '#c8a06c', tableEdge: '#9a7448', steel: '#8e8f8b', seat: '#9b3b2e',
  cardboard: '#b88d5d', tape: '#d9c49b',
};

// 決まった乱数（作り直しても同じ並びになる）
const rnd = (n) => { const s = Math.sin(n * 91.7 + 47.3) * 43758.5453; return s - Math.floor(s); };

// ---- まとめ描きの道具 ----
// boxBatch は軸に沿った箱しか置けない。円柱・傾いた箱・光る物・ガラスはこれで1メッシュにまとめる。
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
function batch(material, { cast = false, receive = true } = {}) {
  const parts = [];
  const api = {
    add(g, color, x, y, z, rx = 0, ry = 0, rz = 0) {
      _e.set(rx, ry, rz); _q.setFromEuler(_e);
      g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _one));
      parts.push([g, color]);
      return api;
    },
    box(w, h, d, color, x, y, z, rx, ry, rz) { return api.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz); },
    cyl(r0, r1, h, color, x, y, z, rx, ry, rz, seg = 14) {
      return api.add(new THREE.CylinderGeometry(r0, r1, h, seg), color, x, y, z, rx, ry, rz);
    },
    done() {
      if (!parts.length) { material.dispose(); return null; }
      let nv = 0, ni = 0;
      for (const [g] of parts) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
      const idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const [g, color] of parts) {
        const P3 = g.attributes.position, N3 = g.attributes.normal;
        pos.set(P3.array.subarray(0, P3.count * 3), vo * 3);
        nor.set(N3.array.subarray(0, N3.count * 3), vo * 3);
        _c.set(color);   // ColorManagement が効いているので linear。頂点カラーにそのまま入れてよい
        for (let i = 0; i < P3.count; i++) { col[(vo + i) * 3] = _c.r; col[(vo + i) * 3 + 1] = _c.g; col[(vo + i) * 3 + 2] = _c.b; }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = vo + g.index.array[i];
        else for (let i = 0; i < P3.count; i++) idx[io++] = vo + i;
        vo += P3.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const m = new THREE.Mesh(geo, material);
      m.castShadow = cast; m.receiveShadow = receive;
      m.matrixAutoUpdate = false; m.updateMatrix();
      parts.length = 0;
      return addScenery(m);
    },
  };
  return api;
}

// 頂点ごとに色を変える四角形の集まり（夕焼けの空のグラデーション・床に差し込む光）
function quads(list, material) {
  const pos = [], col = [], idx = [];
  for (const q of list) {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) { pos.push(q.p[i][0], q.p[i][1], q.p[i][2]); _c.set(q.c[i]); col.push(_c.r, _c.g, _c.b); }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.matrixAutoUpdate = false; m.updateMatrix();
  return addScenery(m);
}

// 見える面だけの板（穴あき可）。箱を並べた壁や床は、隣の箱の内側の面と深度が競って
// 継ぎ目が点線に見える。見える面はこれで1枚にし、箱の本体は少し奥へ下げて隠す。
// outline / holes は板の座標（x, y）。rx / ry で向きを変え、(px, py, pz) へ置く
function skin(sh, outline, holes, color, px, py, pz, rx = 0, ry = 0) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  sh.add(new THREE.ShapeGeometry(shape), color, px, py, pz, rx, ry, 0);
}
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// [x0,x1] から穴（[a,b] の並び）を除いた区間
function spans(x0, x1, holes) {
  const out = []; let s = x0;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (b <= s || a >= x1) continue;
    if (a > s) out.push([s, a]);
    s = Math.max(s, b);
  }
  if (s < x1) out.push([s, x1]);
  return out;
}

// ---- 出来事で動かす物（build のたびに作り直す）----
let clk = null;   // { hour, min, sec, stage, maxX, t1, shown }

export function build(W, halfD, ctx = {}) {
  clk = null;
  const { BACK, FRONT } = zones(halfD, 34, 70);   // 奥の壁 z=-62、手前の端 z=98
  const X0 = -40, X1 = W + 40;

  // ---- 光: 春の夕方。暖かく、まだ明るい（第1章は坂の値 0）----
  setLighting(false);
  hemi.color.set('#ffe6c6'); hemi.groundColor.set('#8c7461'); hemi.intensity = 1.95;
  sun.color.set('#ffc48a'); sun.intensity = 1.1;
  fill.intensity = 0.9;
  scene.background = hex(P.bg);
  scene.fog = new THREE.Fog(hex(P.bg), 300, 950);

  const b = boxBatch();                                                      // 動かない箱
  const sh = batch(new THREE.MeshLambertMaterial({ vertexColors: true }));   // 円柱・傾いた物
  const lit = batch(new THREE.MeshBasicMaterial({ vertexColors: true }));    // 光って見える物
  const glass = batch(new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.1, depthWrite: false,
  }), { receive: false });
  const sunQuads = [];                                                       // 差し込む夕日

  // ================= 床 =================
  // 板張りの廊下。玄関の凹みだけは土間（一段低い）。
  // 床と壁の「見える面」は穴あきの1枚板（skin）にする。箱を並べると、隣の箱の内側の面が
  // 斜めから深度で競り勝って継ぎ目が点線に見える（MSAA のサンプル単位）。裏側はカメラから
  // 見えないので本体の箱は置かず、開口の縁（見込み）だけ薄い板で足す
  skin(sh, [[X0, -FRONT], [X1, -FRONT], [X1, -BACK], [ENT1, -BACK], [ENT1, 31], [ENT0, 31], [ENT0, -BACK], [X0, -BACK]],
    [], P.floor, 0, 0, 0, -Math.PI / 2);
  // 板目は廊下に沿って横へ流す（長い廊下に見える）。継ぎ目は互い違い
  for (let z = -33.6, row = 0; z < FRONT - 4; z += 3.2, row++) {
    if (z < -31) {
      b.box(ENT0 - X0, 0.06, 0.2, P.floorLine, (X0 + ENT0) / 2, 0.03, z);
      b.box(X1 - ENT1, 0.06, 0.2, P.floorLine, (ENT1 + X1) / 2, 0.03, z);
    } else b.box(X1 - X0, 0.06, 0.2, P.floorLine, (X0 + X1) / 2, 0.03, z);
    for (let x = 60 + rnd(row) * 24; x < 620; x += 20 + rnd(row * 7 + x) * 18) {
      if (z < -31 && x > ENT0 - 2 && x < ENT1 + 2) continue;
      b.box(0.2, 0.06, 3.0, P.floorLine, x, 0.03, z + 1.6);
    }
  }

  // ================= 奥の壁（高さ64）。玄関のガラス戸の開口だけ空ける =================
  skin(sh, rect(X0, -2, X1, 64.5), [rect(SF0, -1.5, SF1, SF_TOP)], P.wall, 0, 0, BACK);

  // ================= 扉の並ぶ壁（玄関の凹み・受付窓・開いている扉だけ抜く）=================
  const HOLES = [[KW0, KW1, 8.5, 20.5], [OPEN_X - DW, OPEN_X + DW, 0, DH]];
  skin(sh, rect(ENT1, -1.5, X1, 47), HOLES.map(([a, c, d, e]) => rect(a, d, c, e)), P.wall, 0, 0, -35);
  for (const [a, c, d, e] of HOLES) {   // 開口の見込み（壁の厚み）。表の縁は枠の陰に隠れる
    b.box(0.3, e - d, 1.95, P.wall, a - 0.15, (d + e) / 2, -36.025);
    b.box(0.3, e - d, 1.95, P.wall, c + 0.15, (d + e) / 2, -36.025);
    b.box(c - a + 0.6, 0.3, 1.95, P.wall, (a + c) / 2, e + 0.15, -36.025);
  }
  b.box(ENT0 - 0.05 - X0, 48.5, 2, P.wall, (X0 + ENT0 - 0.05) / 2, 22.75, FZ);
  // 玄関の袖壁（内側の面だけ）と出隅の木の見切り
  skin(sh, rect(35, -1.5, -BACK, 47), [], P.wall, ENT0, 0, 0, 0, Math.PI / 2);
  skin(sh, rect(BACK, -1.5, -35, 47), [], P.wall, ENT1, 0, 0, 0, -Math.PI / 2);
  for (const x of [ENT0, ENT1]) b.box(0.8, 48.5, 0.8, P.rail, x, 22.75, -35);

  ceilingSlab(W, halfD, BACK, P.ceiling, 47);

  // ================= 玄関 =================
  entrance(b, sh, lit, glass, sunQuads, BACK);

  // ================= 扉の列 =================
  const doors = [];
  for (let x = ENT0 - 14; x > X0 + 2; x -= PITCH) doors.push(x);
  for (let x = DOOR0; x < X1 - 6; x += PITCH) doors.push(x);
  // 扉の前に置いてある物（見える範囲は手で決める。新入寮生の段ボール・サンダル・傘）。
  // OPEN_X の扉だけ開いていて、西日の入る部屋が見える（廊下の床へ夕日がこぼれる）
  const STUFF = { 198: 'sandal', 172: 'slipper', 146: 'umbrella', 120: 'sandal', 68: 'boxes',
    386: 'boxes', 438: 'sandal', 464: 'slipper', 516: 'umbrella', 542: 'boxes', 594: 'sandal' };
  const DARK = { 386: 1, 490: 1, 542: 1, 172: 1, 94: 1 };   // 灯りの消えた部屋（まだ誰も帰っていない／入寮前）
  for (const x of doors) roomDoor(b, sh, lit, x, !DARK[x], STUFF[x] || '', x === OPEN_X);
  openRoom(b, lit, sunQuads, OPEN_X);

  // 腰板・見切り・幅木・長押（扉の枠のところは抜く）
  const holes = doors.map((x) => [x - 5.75, x + 5.75]);
  for (const [s0, s1] of [[X0, ENT0], [ENT1, X1]]) {
    for (const [a, c] of spans(s0, s1, holes)) {
      const w = c - a, xm = (a + c) / 2;
      b.box(w, 8, 0.4, P.wains, xm, 4, -34.8);
      b.box(w, 0.8, 0.65, P.rail, xm, 8.2, -34.675);
      b.box(w, 1.1, 0.2, P.base, xm, 0.55, -34.5);
    }
    const w = s1 - s0, xm = (s0 + s1) / 2;
    b.box(w, 0.7, 0.5, P.rail, xm, 29.95, -34.75);   // 長押
    // 古い建物なので配管が露出している
    sh.cyl(0.7, 0.7, w, '#e3d9c6', xm, 36.6, -33.9, 0, 0, Math.PI / 2, 10);
    sh.cyl(0.55, 0.55, w, '#a9a398', xm, 38.7, -34.1, 0, 0, Math.PI / 2, 10);
    for (let x = s0 + 9; x < s1 - 2; x += 26) b.box(0.6, 3.6, 1.6, '#8f897e', x, 37.6, -34.2);
  }
  // 換気口（いくつかの扉の上）
  for (const x of doors) if (rnd(x) < 0.45) {
    b.box(4.6, 2.2, 0.3, '#d8d1c2', x, 32.2, -34.85);
    for (let i = 0; i < 3; i++) b.box(3.8, 0.25, 0.12, '#8d8678', x, 31.5 + i * 0.7, -34.65);
  }
  // 消火器（扉と扉の間）と赤い無地の標示板
  {
    const x = 425, z = -32.6;
    b.box(2.6, 3.4, 0.2, '#c9352b', x, 12.6, -34.9);
    b.box(2.6, 0.35, 2.6, '#2a2624', x, 0.18, z);
    sh.cyl(0.95, 0.95, 5.0, '#c9352b', x, 2.85, z);
    sh.cyl(0.55, 0.7, 0.6, '#2a2624', x, 5.65, z);
    sh.box(1.8, 0.3, 0.5, '#2a2624', x + 0.3, 6.15, z, 0, 0, 0.15);
    sh.box(0.3, 3.6, 0.3, '#2a2624', x - 1.15, 3.9, z + 0.3, 0, 0, 0.12);
  }

  // ================= 寮監室（受付窓・在寮札・掛け時計・掲示板）=================
  kanri(b, sh, lit, glass, sunQuads);
  clk = buildClock(ZAI_X, CLOCK_Y, -35);
  clk.stage = ctx.stage || null;

  // ================= 手前（低い物だけ）=================
  front(b, sh, X0, X1);

  // ---- まとめて出す ----
  b.done();
  sh.done();
  lit.done();
  glass.done();
  quads(sunQuads, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
}

// ---------------------------------------------------------------------------
// 玄関: 土間・上がり框・ガラス戸と夕焼け・下駄箱・傘立て・靴とスリッパ
function entrance(b, sh, lit, glass, sunQuads, BACK) {
  const cx = (ENT0 + ENT1) / 2, w = ENT1 - ENT0;
  // 土間（一段低い石張り）と目地、上がり框、袖壁の腰の石
  b.box(w, 2, 31, P.doma, cx, -2.5, -46.5);
  for (let z = -58; z < -31; z += 4) b.box(w, 0.05, 0.18, P.domaLine, cx, -1.48, z);
  for (let x = ENT0 + 4; x < ENT1; x += 4) b.box(0.18, 0.05, 30, P.domaLine, x, -1.48, -46.5);
  b.box(w, 1.8, 1.6, P.kamachi, cx, -0.6, -31);
  b.box(0.6, 1.8, 4.0, P.kamachi, ENT0 + 0.3, -0.6, -33);   // 袖壁の前の段の縁
  b.box(0.6, 1.8, 4.0, P.kamachi, ENT1 - 0.3, -0.6, -33);
  b.box(0.4, 7.5, -35 - BACK, P.domaSkirt, ENT0 + 0.2, 2.25, (BACK - 35) / 2);
  b.box(0.4, 7.5, -35 - BACK, P.domaSkirt, ENT1 - 0.2, 2.25, (BACK - 35) / 2);

  // --- ガラス戸（ブロンズのアルミ枠。両開き＋袖ガラス＋欄間）---
  const zG = BACK + 0.4, AL = P.alu;
  b.box(1.2, 31.5, 1.4, AL, SF0 + 0.6, 14.25, zG);
  b.box(1.2, 31.5, 1.4, AL, SF1 - 0.6, 14.25, zG);
  b.box(SF1 - SF0, 1.2, 1.4, AL, (SF0 + SF1) / 2, 29.4, zG);
  b.box(SF1 - SF0, 1.2, 1.4, AL, (SF0 + SF1) / 2, 21.6, zG);
  for (const x of [244, 266]) b.box(1.0, 31.5, 1.4, AL, x, 14.25, zG);
  b.box(1.0, 6.6, 1.4, AL, 255, 25.5, zG);
  for (const [x0, x1] of [[244.5, 254.5], [255.5, 265.5]]) {
    const xm = (x0 + x1) / 2, ww = x1 - x0;
    b.box(1.0, 21.5, 1.0, AL, x0 + 0.5, 9.25, zG + 0.1);
    b.box(1.0, 21.5, 1.0, AL, x1 - 0.5, 9.25, zG + 0.1);
    b.box(ww, 1.0, 1.0, AL, xm, 19.5, zG + 0.1);
    b.box(ww, 2.6, 1.0, AL, xm, -0.2, zG + 0.1);
    b.box(ww - 3, 0.6, 0.6, '#cfd0ca', xm, 9.5, zG + 0.9);    // 押し棒
  }
  b.box(SF1 - SF0, 0.3, 1.6, '#7d7b74', (SF0 + SF1) / 2, -1.35, zG);   // 沓摺
  const panes = [
    [239.2, 243.5, -1.5, 21], [266.5, 270.8, -1.5, 21],          // 袖ガラス
    [245.5, 253.5, 1.1, 19], [256.5, 264.5, 1.1, 19],            // 扉
    [239.2, 254.5, 22.2, 28.8], [255.5, 270.8, 22.2, 28.8],      // 欄間
  ];
  for (const [x0, x1, y0, y1] of panes) glass.box(x1 - x0, y1 - y0, 0.15, '#fff1d6', (x0 + x1) / 2, (y0 + y1) / 2, zG);

  // --- ガラスの向こう（夕焼け）。開口から見える範囲だけ。逆光なので光に左右されない色で置く ---
  const OX0 = 150, OX1 = 360, ox = (OX0 + OX1) / 2, ow = OX1 - OX0;
  lit.box(ow, 2, 26, '#c9a585', ox, -2.5, -75);                   // アプローチ（夕日で暖色）
  for (let x = OX0; x < OX1; x += 6) lit.box(0.2, 0.05, 26, '#b08e70', x, -1.45, -75);
  lit.box(ow, 6.5, 5, '#5f6438', ox, 1.75, -90);                  // 生け垣
  for (let x = OX0 + 3; x < OX1; x += 7) lit.box(5.5, 1.2, 5.4, '#6c7240', x + rnd(x) * 2, 5.1, -90);
  lit.box(ow, 2, 70, '#a08270', ox, -2.5, -128);                  // 道の向こう
  // 向かいの家並み（屋根の線と、灯りのついた窓）
  for (let i = 0, x = OX0; x < OX1; x += 17 + (i % 3) * 6, i++) {
    const h = 7 + (i % 3) * 2.5, ww = 14 + (i % 2) * 5, z = -122 - (i % 2) * 6;
    lit.box(ww, h, 8, i % 2 ? '#a7807a' : '#9a7674', x, h / 2 - 1.5, z);
    lit.add(new THREE.BoxGeometry(ww * 0.62, 1.2, 9), '#6e5254', x - ww * 0.22, h - 0.6, z, 0, 0, 0.45);
    lit.add(new THREE.BoxGeometry(ww * 0.62, 1.2, 9), '#6e5254', x + ww * 0.22, h - 0.6, z, 0, 0, -0.45);
    if (i % 2 === 0) lit.box(2.2, 1.6, 0.3, '#ffd585', x - 2.5, h * 0.55, z + 4.2);
    if (i % 3 === 1) lit.box(2.2, 1.6, 0.3, '#ffe3a0', x + 3, h * 0.45, z + 4.2);
  }
  // 門の脇の桜（春。夕日を受けて桃色が暖かい）。ガラス戸の欄間と扉の上の方から見える
  lit.box(1.4, 16, 1.4, '#4e3a32', 252, 6.5, -97);
  lit.add(new THREE.BoxGeometry(0.9, 8, 0.9), '#4e3a32', 255, 15, -97, 0, 0, -0.5);
  lit.add(new THREE.BoxGeometry(0.8, 7, 0.8), '#4e3a32', 249, 15.5, -97, 0, 0, 0.55);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39, r = 3 + (i % 4) * 2.2;
    lit.box(6 + (i % 3) * 1.5, 3.6 + (i % 2), 5, i % 3 === 0 ? '#f7c3b8' : i % 3 === 1 ? '#efaab0' : '#f9d2c4',
      253 + Math.cos(a) * r * 1.5, 19 + Math.sin(a) * r * 0.55, -97 - (i % 3) * 1.6);
  }
  // 電柱と電線、門の街灯
  lit.box(1.3, 60, 1.3, '#4a3b36', 262, 28, -104);
  lit.box(9, 0.8, 0.8, '#4a3b36', 262, 31, -104);
  for (const y of [30.2, 31.6]) lit.box(ow, 0.18, 0.18, '#3e322e', ox, y, -104.5);
  lit.box(0.7, 21, 0.7, '#55473f', 247, 9, -86);
  lit.box(3.0, 1.0, 1.4, '#ffe2a6', 248.4, 19.2, -86);
  // 空（地平線ほど明るい金色、上へ行くほど茜〜藤色）
  quads([
    { p: [[OX0 - 80, -3, -175], [OX1 + 80, -3, -175], [OX1 + 80, 16, -175], [OX0 - 80, 16, -175]], c: ['#ffd99a', '#ffd99a', '#f6a878', '#f6a878'] },
    { p: [[OX0 - 80, 16, -175], [OX1 + 80, 16, -175], [OX1 + 80, 66, -175], [OX0 - 80, 66, -175]], c: ['#f6a878', '#f6a878', '#c98fa2', '#c98fa2'] },
  ], new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  lit.add(new THREE.CircleGeometry(5.2, 28), '#fff4d2', 236, 10.5, -174);   // 沈みかけの日

  // --- 差し込む夕日（ガラス戸の形のまま、土間から廊下へ長く伸びる）---
  const TAN_E = 0.62, KX = 0.3;
  for (const [x0, x1, y0, y1] of panes) {
    const top = y0 > 21;
    const zN = zG + (y0 + 1.5) / TAN_E, zF = zG + (y1 + 1.5) / TAN_E;
    const c0 = top ? '#5a3816' : '#8a5824', c1 = top ? '#26160a' : '#3a2410';
    const at = (z) => {
      const k = (z - zN) / (zF - zN);
      _c.set(c0).lerp(new THREE.Color(c1), Math.max(0, Math.min(1, k)));
      return '#' + _c.getHexString();
    };
    const quad = (za, zb, y) => {
      if (zb <= za) return;
      const xa = KX * (za - zG), xb = KX * (zb - zG);
      sunQuads.push({ p: [[x0 + xa, y, za], [x1 + xa, y, za], [x1 + xb, y, zb], [x0 + xb, y, zb]], c: [at(za), at(za), at(zb), at(zb)] });
    };
    quad(Math.max(zN, -61), Math.min(zF, -31.9), -1.2);   // 土間
    quad(Math.max(zN, -30.1), zF, 0.09);                   // 廊下の床
  }

  // --- 下駄箱（扉のない棚。左右に1台ずつ）---
  getabako(b, ENT0 + 2, 236, BACK, 1);
  getabako(b, 274, ENT1 - 2, BACK, 2);
  // 下駄箱の上: 鉢植え（左）と落とし物の箱（右）
  {
    const y = 19.4, z = BACK + 3.2;
    sh.cyl(1.4, 1.05, 2.2, '#b0603c', 219, y + 1.1, z);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      sh.box(1.6, 0.35, 2.6, i % 2 ? '#4f7a3a' : '#3f6a30', 219 + Math.cos(a) * 1.4, y + 2.6 + (i % 3) * 0.4, z + Math.sin(a) * 1.4, 0.4 * Math.sin(a), a, 0.4 * Math.cos(a));
    }
    sh.box(0.5, 4.5, 0.35, '#4f7a3a', 217.6, y - 1.2, z + 3.4, 0.1, 0, 0.1);   // 前へ垂れる蔓
    sh.box(0.5, 3.2, 0.35, '#3f6a30', 220.3, y - 0.6, z + 3.4, 0.1, 0, -0.08);
    b.box(6, 3.4, 4.4, P.cardboard, 287, y + 1.7, z);
    b.box(6.05, 0.06, 0.9, P.tape, 287, y + 3.43, z);
  }

  // --- 傘立てと傘 ---
  {
    const x = 291, z = -49.5, y0 = -1.5;
    sh.cyl(1.9, 1.9, 5, '#b8b9b4', x, y0 + 2.5, z, 0, 0, 0, 16);
    const um = [['#2b3a5c', -0.7, -0.5, 0.1, -0.08], ['#e3e8e8', 0.6, -0.4, -0.12, 0.06], ['#7a2a32', 0.1, 0.7, 0.06, 0.12],
      ['#2a2a2c', -0.8, 0.6, -0.08, -0.12], ['#3e6a4c', 0.9, 0.5, 0.1, 0.1]];
    for (const [c, dx, dz, rx, rz] of um) {
      sh.box(1.0, 6.8, 1.0, c, x + dx + rz * -4, y0 + 7.4, z + dz + rx * 4, rx, 0, rz);
      sh.box(0.35, 1.6, 0.35, '#5a3c26', x + dx + rz * -8.6, y0 + 11.6, z + dz + rx * 8.6, rx, 0, rz);
    }
  }
  // --- 玄関マット ---
  b.box(22.4, 0.2, 7.4, '#4e2a22', 255, -1.4, -57.6);
  b.box(20.6, 0.24, 6.0, '#6b3b2e', 255, -1.36, -57.6);

  // --- 土間の靴（揃えてあるのと、脱ぎ散らかしたの）---
  const SH = [
    [224, -36, 0.08, '#e8e4dc', '#2f3d5c'], [232.5, -38.5, -0.25, '#2a221e', '#2a221e'],
    [279, -35.5, 0.2, '#6b452a', '#6b452a'], [288, -41, 3.05, '#80807b', '#55524c'],
    [241, -45, 2.6, '#e8e4dc', '#b43a32'], [272, -47, 0.55, '#2f3d5c', '#e8e4dc'],
    [221, -50, 1.4, '#4a3a2c', '#4a3a2c'], [262, -40, -0.1, '#2a221e', '#2a221e'],
  ];
  for (const [x, z, a, up, acc] of SH) shoePair(b, x, -1.5, z, a, up, acc);
  // 戸を開けたときに吹き込んだ桜の花びら
  for (let i = 0; i < 16; i++) {
    const x = 246 + rnd(i * 3.1) * 26 - (i % 4) * 2, z = -59 + rnd(i * 5.7) * 22;
    const onMat = x > 244.3 && x < 265.7 && z > -60.8 && z < -54.4;
    b.box(0.6, 0.05, 0.45, i % 2 ? '#f4c6cf' : '#efb3bf', x, onMat ? -1.2 : -1.44, z, { rotY: rnd(i) * 3 });
  }
  // --- 上がり框のスリッパ（来客用。つま先を廊下へ揃えてある）---
  const SC = ['#7a5236', '#5d6a44', '#33405e', '#7a5236', '#5d6a44', '#33405e'];
  for (let i = 0; i < 6; i++) slipperPair(b, 237 + i * 6.2, -28.6, SC[i]);
}

// 下駄箱（扉のない棚。マスごとに無地の名札、靴の踵が見える）
function getabako(b, x0, x1, BACK, seed) {
  const w = x1 - x0, cx = (x0 + x1) / 2, y0 = -1.5, H = 20, zf = BACK + 6;
  b.box(w, H, 6, P.getaIn, cx, y0 + H / 2, BACK + 3, { cast: true });
  b.box(w + 0.6, 0.9, 6.6, P.geta, cx, y0 + H + 0.45, BACK + 3.3, { cast: true });   // 天板
  b.box(w, 1.8, 0.6, P.geta, cx, y0 + 0.9, zf + 0.3);                                 // 台輪
  const cols = 4, rows = 6, cw = (w - 0.8) / cols, rh = (H - 1.8) / rows;
  for (let r = 1; r < rows; r++) b.box(w, 0.45, 0.6, P.geta, cx, y0 + 1.8 + r * rh, zf + 0.3);
  for (let c = 0; c <= cols; c++) {
    const xx = x0 + 0.4 + c * cw;
    b.box(c === 0 || c === cols ? 0.8 : 0.5, H - 1.8, 0.6, P.geta, xx, y0 + 1.8 + (H - 1.8) / 2, zf + 0.3);
  }
  const SHOE = ['#e8e4dc', '#2f3d5c', '#2a221e', '#6b452a', '#80807b', '#e8e4dc', '#2a221e', '#b43a32'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mx = x0 + 0.4 + (c + 0.5) * cw, my = y0 + 1.8 + r * rh;
      b.box(1.8, 0.42, 0.1, P.plate, mx - cw * 0.18, my + rh - 0.02, zf + 0.65);   // 名札（無地）
      const k = rnd(seed * 100 + r * 7 + c);
      if (k < 0.22) continue;                                                     // 空き
      const col = SHOE[Math.floor(rnd(seed * 31 + r * 5 + c * 3) * SHOE.length)];
      const hh = k > 0.93 ? 2.3 : 1.2;                                            // たまに長靴
      for (const dx of [-1.0, 1.0]) b.box(1.75, hh, 1.6, col, mx + dx, my + 0.25 + hh / 2, zf - 0.45);
    }
  }
}

// 靴1足（つま先が +z'。a は y 軸まわりの向き）
function shoePair(b, x, y, z, a, up, acc) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const put = (w, h, d, col, ox, oy, oz) => b.box(w, h, d, col, x + ox * ca + oz * sa, y + oy, z - ox * sa + oz * ca, { rotY: a });
  for (const dx of [-0.85, 0.85]) {
    put(1.35, 0.35, 3.0, '#d8d4ca', dx, 0.175, 0);
    put(1.25, 0.8, 2.3, up, dx, 0.75, -0.3);
    put(0.5, 0.3, 0.5, acc, dx, 1.2, -1.2);
  }
}
// スリッパ1足（つま先を +z へ）
function slipperPair(b, x, z, col) {
  for (const dx of [-0.85, 0.85]) {
    b.box(1.35, 0.4, 3.0, col, x + dx, 0.2, z);
    b.box(1.45, 0.55, 1.5, col, x + dx, 0.62, z + 0.6);
  }
}

// ---------------------------------------------------------------------------
// 部屋の扉（同じ扉が並ぶ）。枠・扉・新聞受け・ノブ・ドアスコープ・名札入れ・部屋番号の札・欄間
function roomDoor(b, sh, lit, cx, on, stuff, open = false) {
  const F = P.doorFrame, JX = DW + 0.5;   // 竪枠の中心（内側の面が開口の端にそろう）
  b.box(1.0, 27.9, 1.0, F, cx - JX, 13.95, -34.6);
  b.box(1.0, 27.9, 1.0, F, cx + JX, 13.95, -34.6);
  b.box(2 * JX + 1, 1.0, 1.0, F, cx, DH + 0.5, -34.6);              // 扉の上枠
  b.box(2 * JX + 1, 1.0, 1.0, F, cx, 27.4, -34.6);                  // 欄間の上枠
  (on ? lit : b).box(2 * DW, 4.4, 0.2, on ? '#ffd890' : '#cbc2ae', cx, 24.7, -34.8);   // 欄間（灯りがつくと光る）
  b.box(0.5, 4.4, 0.4, F, cx, 24.7, -34.6);
  b.box(2.6, 1.1, 0.2, P.brass, cx + 7.9, 18.4, -34.9);             // 部屋番号の札（無地）
  if (open) {
    // 内開き（左吊り）で部屋の中へ開いている。沓摺だけ廊下側に見える
    const phi = 1.25, hx = cx - DW, hz = -34.85;
    b.box(2 * DW, DH, 0.5, P.door, hx + DW * Math.cos(phi), DH / 2, hz - DW * Math.sin(phi), { rotY: phi });
    b.box(2 * DW, 0.3, 2.0, '#7a5a3a', cx, 0.15, -36);
    return;
  }
  b.box(2 * DW, DH, 0.5, P.door, cx, DH / 2, -34.85);
  b.box(8.3, 0.25, 0.1, '#9a6c40', cx, 14.6, -34.55);               // 扉の目地（化粧の線）
  b.box(3.8, 1.0, 0.1, P.brass, cx, 6.6, -34.55);                   // 新聞受け
  b.box(3.0, 0.35, 0.08, P.dark, cx, 6.6, -34.47);
  b.box(1.3, 1.3, 0.2, P.brass, cx + 3.4, 10.2, -34.5);             // ノブ
  b.box(0.9, 0.9, 0.7, P.brass, cx + 3.4, 10.2, -34.05);
  b.box(0.5, 0.5, 0.12, P.dark, cx, 16.4, -34.54);                  // ドアスコープ
  b.box(3.8, 1.5, 0.12, '#b9b6ad', cx, 18.6, -34.54);               // 名札入れ（無地）
  b.box(3.4, 1.1, 0.06, P.plate, cx, 18.6, -34.45);
  // 扉の前
  const z = -31.2;
  if (stuff === 'sandal') {
    for (const dx of [-0.85, 0.85]) {
      b.box(1.35, 0.4, 3.0, '#3a3a38', cx + 2.2 + dx, 0.2, z);
      b.box(1.45, 0.5, 1.4, '#5a6f86', cx + 2.2 + dx, 0.62, z + 0.6);
    }
  } else if (stuff === 'slipper') {
    slipperPair(b, cx - 1.5, z, '#8a6a3a');
  } else if (stuff === 'umbrella') {
    const x = cx + 8.8;
    sh.box(1.0, 7.6, 1.0, '#2b3a5c', x, 4.4, -33.4, -0.13, 0, 0.05);
    sh.box(0.3, 1.0, 0.3, '#2a2624', x + 0.2, 0.45, -32.9, -0.13, 0, 0.05);
    sh.box(0.35, 1.6, 0.35, '#5a3c26', x - 0.4, 8.8, -34.0, -0.13, 0, 0.05);
    shoePair(b, cx - 1.8, 0, z + 0.4, 0.05, '#e8e4dc', '#2f3d5c');
  } else if (stuff === 'boxes') {
    b.box(7.2, 5.6, 5.6, P.cardboard, cx - 1.8, 2.8, -31.6, { cast: true });
    b.box(7.25, 0.06, 0.9, P.tape, cx - 1.8, 5.63, -31.6);
    b.box(6.0, 4.4, 5.0, '#c39a68', cx - 1.4, 7.8, -31.8, { rotY: 0.12, cast: true });
    b.box(0.9, 0.06, 5.05, P.tape, cx - 1.4, 10.03, -31.8, { rotY: 0.12 });
  }
}

// 開いている扉の奥の部屋（6畳の寮室）。西向きの窓から夕日が入り、廊下の床へこぼれる。
// 扉の開口からしか見えないので、見える面（奥の壁の窓・カーテン・ベランダの洗濯物の影）だけ作る
function openRoom(b, lit, sunQuads, cx) {
  const x0 = cx - 13, x1 = cx + 17, xm = (x0 + x1) / 2, zB = -60.4, zF = -37;
  lit.box(x1 - x0, 30, 0.5, '#f0c48e', xm, 15, zB);                  // 奥の壁（夕日で染まっている）
  lit.box(1, 30, zF - zB, '#e2ad7c', x0, 15, (zF + zB) / 2);         // 左右の壁
  lit.box(1, 30, zF - zB, '#e8b483', x1, 15, (zF + zB) / 2);
  // 靴脱ぎと、一段上がった畳（縁は濃い緑）
  b.box(2 * DW + 2, 0.2, 4, '#9a9284', cx, 0.1, -39);
  b.box(x1 - x0 - 1, 1.2, -41 - zB, '#c9bf86', xm, 0.6, (zB - 41) / 2);
  b.box(x1 - x0 - 1, 1.2, 0.5, '#7a5434', xm, 0.6, -41.2);
  for (const z of [-48, -55]) b.box(x1 - x0 - 1, 0.06, 0.4, '#3e4a3a', xm, 1.23, z);
  b.box(0.4, 0.06, 19, '#3e4a3a', cx + 2, 1.23, -50.7);
  // 窓（引き違い）。向こうは夕焼けの空と、ベランダの物干しの影
  const wx = cx + 7, wy = 12.5, ww = 12, wh = 11, zw = zB + 0.3;
  quads([
    { p: [[wx - ww / 2, wy - wh / 2, zw], [wx + ww / 2, wy - wh / 2, zw], [wx + ww / 2, wy + wh / 2, zw], [wx - ww / 2, wy + wh / 2, zw]],
      c: ['#ffe2a0', '#ffe2a0', '#f7a676', '#f7a676'] },
  ], new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const S = '#8e5a3e', z1 = zw + 0.12;
  lit.box(ww, 0.3, 0.1, S, wx, wy + 3.6, z1);                                   // 物干し竿
  lit.box(2.6, 3.4, 0.1, S, wx - 3.4, wy + 1.8, z1);                            // タオル
  lit.box(2.6, 3.0, 0.1, S, wx + 0.6, wy + 2.0, z1);                            // シャツ
  lit.box(1.0, 1.0, 0.1, S, wx - 0.9, wy + 3.0, z1);
  lit.box(1.0, 1.0, 0.1, S, wx + 2.1, wy + 3.0, z1);
  for (let i = 0; i < 3; i++) lit.box(0.5, 1.4, 0.1, S, wx + 3.6 + i * 0.8, wy + 2.7, z1);   // 靴下
  const FR = '#6a4630', z2 = zw + 0.25;
  lit.box(ww + 1, 0.7, 0.2, FR, wx, wy + wh / 2, z2);
  lit.box(ww + 1, 0.7, 0.2, FR, wx, wy - wh / 2, z2);
  lit.box(0.7, wh, 0.2, FR, wx - ww / 2, wy, z2);
  lit.box(0.7, wh, 0.2, FR, wx + ww / 2, wy, z2);
  lit.box(0.6, wh, 0.2, FR, wx, wy, z2);
  // カーテン（夕日が透けて明るい）
  lit.box(2.4, wh + 2, 0.4, '#d9844c', wx - ww / 2 - 1.0, wy, zw + 0.5);
  lit.box(2.4, wh + 2, 0.4, '#cf7a44', wx + ww / 2 + 1.0, wy, zw + 0.5);
  // 窓の下の座卓と座布団（逆光で沈む）
  b.box(9, 0.6, 5, '#6a4a32', wx - 1, 3.6, zB + 6);
  b.box(0.6, 2.2, 0.6, '#5a3c28', wx - 5, 2.3, zB + 4); b.box(0.6, 2.2, 0.6, '#5a3c28', wx + 3, 2.3, zB + 4);
  b.box(4.4, 0.5, 4.4, '#8a3a34', wx - 6, 1.45, zB + 11);
  // 廊下へこぼれる夕日（扉の開口の形のまま、手前へ伸びて薄れる）
  const L = 21, K = 0.3;
  sunQuads.push({ p: [[cx - DW, 0.09, -35], [cx + DW, 0.09, -35], [cx + DW + K * L, 0.09, -35 + L], [cx - DW + K * L, 0.09, -35 + L]],
    c: ['#7a4a1c', '#7a4a1c', '#000000', '#000000'] });
}

// ---------------------------------------------------------------------------
// 寮監室: 受付窓（少し開いたガラス戸と、灯りのついた室内）・受付台・在寮札・掲示板
function kanri(b, sh, lit, glass, sunQuads) {
  const cx = (KW0 + KW1) / 2;
  // 額縁と受付台
  b.box(1.0, 13, 1.0, P.doorFrame, KW0 - 0.5, 15, -34.6);
  b.box(1.0, 13, 1.0, P.doorFrame, KW1 + 0.5, 15, -34.6);
  b.box(KW1 - KW0 + 2, 1.0, 1.0, P.doorFrame, cx, 21, -34.6);
  b.box(KW1 - KW0 + 4, 0.8, 4.6, '#8f6238', cx, 8.5, -33.3, { cast: true });
  for (const x of [KW0 + 3, KW1 - 3]) b.box(0.6, 2.6, 3.0, P.doorFrame, x, 6.8, -33.6);
  // 引き違いのガラス戸。右の戸を左へ寄せて、少し開けてある
  const pane = (x0, x1, z) => {
    const xm = (x0 + x1) / 2, w = x1 - x0;
    b.box(0.7, 11.6, 0.5, P.silver, x0 + 0.35, 14.7, z);
    b.box(0.7, 11.6, 0.5, P.silver, x1 - 0.35, 14.7, z);
    b.box(w, 0.7, 0.5, P.silver, xm, 20.15, z);
    b.box(w, 0.7, 0.5, P.silver, xm, 9.25, z);
    glass.box(w - 1.4, 10.2, 0.1, '#f4f0e4', xm, 14.7, z);
  };
  pane(KW0 + 0.2, 318.6, -35.5);
  pane(312.4, 323.8, -36.3);
  // 室内（灯りがついている）。窓から見えるのは奥の壁の y=5〜18 あたりと机の上
  lit.box(28, 30, 1, '#ecd3a2', cx, 15, -48.5);
  lit.box(1, 30, 11, '#d9bc8a', KW0 - 1.5, 15, -42.5);
  lit.box(1, 30, 11, '#d9bc8a', KW1 + 1.5, 15, -42.5);
  b.box(28, 0.1, 11, '#7a5a3e', cx, 0.05, -42.5);
  b.box(22, 0.8, 5, '#9aa595', cx, 7.6, -40.5);                    // 事務机
  b.box(22, 7.2, 0.5, '#87927f', cx, 3.6, -38.3);
  b.box(3.0, 0.5, 2.2, '#2f4a6a', cx - 6, 8.25, -40.8);             // 台帳
  b.box(2.4, 1.0, 2.0, '#d9d0bd', cx + 7, 8.5, -41);                // 電話
  sh.cyl(0.5, 0.45, 1.1, '#a9bfa2', cx + 2.5, 8.55, -40.2);         // 湯呑
  b.box(0.4, 3.0, 0.4, '#3a3a3a', cx - 1.5, 9.5, -42);              // 卓上灯
  lit.box(2.6, 1.0, 1.6, '#fff1c4', cx - 1.0, 11.2, -41.6);
  b.box(8, 6, 0.4, '#9a7048', cx - 5, 13.5, -47.8);                 // キーボックス
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) b.box(0.45, 1.0, 0.2, P.brass, cx - 8 + c * 1.5, 15.2 - r * 1.8, -47.5);
  b.box(4.6, 6.2, 0.2, '#f6f3ea', cx + 6, 13.6, -47.9);             // カレンダー（無地のマス目）
  for (let i = 0; i < 4; i++) b.box(4.0, 0.12, 0.1, '#b9b3a5', cx + 6, 11.6 + i * 1.2, -47.75);
  for (let i = 0; i < 3; i++) b.box(0.12, 4.6, 0.1, '#b9b3a5', cx + 4.8 + i * 1.2, 13.2, -47.75);
  b.box(11, 0.5, 2.2, '#9a7048', cx + 2, 18.2, -47);                // 棚と背表紙
  for (let i = 0; i < 7; i++) b.box(1.1, 3.6, 2.0, ['#8f3a2e', '#2f5a8f', '#4a7a3e', '#8a7a2e'][i % 4], cx - 2.5 + i * 1.45, 20.25, -47);
  // 受付台の上: 呼び鈴・来訪者の帳面・ボールペン
  sh.cyl(0.65, 0.75, 0.45, '#d0b062', cx + 6, 9.15, -32.4, 0, 0, 0, 16);
  sh.cyl(0.18, 0.18, 0.3, '#2a2624', cx + 6, 9.5, -32.4);
  sh.box(2.3, 0.18, 3.0, '#f6f3ea', cx - 6.2, 9.0, -32.6, 0, 0, 0.05);
  sh.box(2.3, 0.18, 3.0, '#f6f3ea', cx - 3.9, 9.0, -32.6, 0, 0, -0.05);
  sh.box(0.25, 0.25, 2.6, '#2f5a8f', cx - 1.8, 9.2, -32.3, 0, 0.5, 0);
  // 窓の上の札（無地の板＋色の棒）
  b.box(10, 2.2, 0.5, '#f1eadb', cx, 23.6, -34.75);
  b.box(6.5, 0.45, 0.08, '#8a5a3a', cx, 23.6, -34.46);
  // 室内の灯りが受付台の前の床にこぼれる
  sunQuads.push({ p: [[KW0, 0.09, -34.9], [KW1, 0.09, -34.9], [KW1 + 5, 0.09, -26.5], [KW0 - 5, 0.09, -26.5]],
    c: ['#3a2a14', '#3a2a14', '#000000', '#000000'] });

  // --- 在寮札（入寮者の札。黒＝在寮、赤＝外出。札は無地）---
  {
    const x = ZAI_X, y = 16;
    b.box(14, 13, 0.5, '#c7a173', x, y, -34.75);
    for (const [w, h, dx, dy] of [[14, 0.6, 0, 6.2], [14, 0.6, 0, -6.2], [0.6, 13, -6.7, 0], [0.6, 13, 6.7, 0]]) {
      b.box(w, h, 0.3, '#6e4c30', x + dx, y + dy, -34.4);
    }
    b.box(12.2, 1.5, 0.1, '#f1ead8', x, y + 5.1, -34.45);
    b.box(6, 0.4, 0.06, '#8a5a3a', x, y + 5.1, -34.37);
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 3; c++) {
        const out = rnd(r * 3 + c + 11) < 0.2 || (r === 6 && c === 2);   // 右下はまだ帰っていない（主人公）
        b.box(3.7, 1.0, 0.2, out ? '#b3352b' : '#2a2624', x - 4.3 + c * 4.3, y - 5.4 + r * 1.42, -34.4);
      }
    }
  }

  // --- 掲示板（コルク。紙はすべて無地）---
  {
    const x = KEIJI_X, y = 16.25;
    b.box(18, 12.5, 0.5, '#b88a5c', x, y, -34.75);
    for (const [w, h, dx, dy] of [[18, 0.6, 0, 5.95], [18, 0.6, 0, -5.95], [0.6, 12.5, -8.7, 0], [0.6, 12.5, 8.7, 0]]) {
      b.box(w, h, 0.3, '#6e4c30', x + dx, y + dy, -34.4);
    }
    const papers = [
      [-5.6, 2.4, 3.4, 4.6, '#f7f5ee', 0.04], [-0.9, 3.2, 4.6, 3.3, '#fbf1cf', -0.03], [4.6, 2.1, 3.4, 4.6, '#f6f6f2', 0.02],
      [-4.8, -2.8, 4.4, 3.2, '#d9e6f0', -0.05], [0.4, -2.3, 3.2, 4.2, '#f4d9d9', 0.03], [5.3, -2.9, 4.2, 4.0, '#f8f8f4', 0],
    ];
    const pins = ['#d0392f', '#2f5fbf', '#e0b82f', '#3a9a4a', '#d0392f', '#2f5fbf'];
    papers.forEach(([dx, dy, w, h, col, rz], i) => {
      const z = -34.44 + i * 0.03;
      sh.box(w, h, 0.06, col, x + dx, y + dy, z, 0, 0, rz);
      sh.box(0.45, 0.45, 0.3, pins[i], x + dx - Math.sin(rz) * (h / 2 - 0.5), y + dy + Math.cos(rz) * (h / 2 - 0.5), -34.2);
    });
    // 当番表（線だけのマス目）
    for (let i = 0; i < 4; i++) b.box(3.6, 0.1, 0.06, '#9a9488', x + 5.3, y - 4.4 + i * 1.0, -34.2);
    for (let i = 0; i < 3; i++) b.box(0.1, 3.4, 0.06, '#9a9488', x + 4.2 + i * 1.1, y - 2.9, -34.2);
  }
}

// ---------------------------------------------------------------------------
// 掛け時計。枠と文字盤は1つにまとめ、針（時・分・秒）だけ別のメッシュにして tick で回す
function buildClock(x, y, zWall) {
  const g = batch(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const RX = Math.PI / 2;
  g.cyl(4.5, 4.5, 0.8, '#4a3626', x, y, zWall + 0.4, RX, 0, 0, 32);
  g.cyl(3.95, 3.95, 0.3, '#f8f4ea', x, y, zWall + 0.95, RX, 0, 0, 32);
  g.add(new THREE.TorusGeometry(4.1, 0.42, 8, 40), '#3a2a1e', x, y, zWall + 1.0);
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, big = h % 3 === 0;
    g.box(big ? 0.5 : 0.26, big ? 1.0 : 0.6, 0.1, '#2a2420', x + Math.sin(a) * 3.25, y + Math.cos(a) * 3.25, zWall + 1.13, 0, 0, -a);
  }
  g.cyl(0.35, 0.35, 0.2, '#2a2420', x, y, zWall + 1.55, RX);
  g.done();
  const hand = (w, len, tail, color, dz) => {
    const geo = new THREE.BoxGeometry(w, len + tail, 0.12);
    geo.translate(0, (len - tail) / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: hex(color) }));
    m.position.set(x, y, zWall + dz);
    return addScenery(m);
  };
  const c = {
    hour: hand(0.55, 2.2, 0.4, '#1f1a17', 1.25),
    min: hand(0.38, 3.2, 0.5, '#1f1a17', 1.35),
    sec: hand(0.14, 3.4, 0.9, '#c0392b', 1.45),
    stage: null, maxX: 0, t1: null, shown: null,
  };
  setHands(c, 21 * 60 + 38, 0);
  return c;
}
function setHands(c, minutes, t) {
  c.min.rotation.z = -((minutes % 60) / 60) * Math.PI * 2;
  c.hour.rotation.z = -(((minutes / 60) % 12) / 12) * Math.PI * 2;
  c.sec.rotation.z = -((Math.floor(t) % 60) / 60) * Math.PI * 2;
}

// ---------------------------------------------------------------------------
// 手前（帯の手前は「足元の線＋数ユニット」まで。高い物は置かない）
function front(b, sh, X0, X1) {
  // --- 引っ越しの段ボール（新入寮生）---
  b.box(9, 5.5, 7, P.cardboard, 226, 2.75, 43, { rotY: 0.06 });
  b.box(9.05, 0.06, 1.0, P.tape, 226, 5.53, 43, { rotY: 0.06 });
  b.box(7.5, 2.2, 6, '#c39a68', 226.5, 6.6, 43.2, { rotY: -0.1 });
  b.box(7, 5, 6, P.cardboard, 237, 2.5, 41.5, { rotY: 0.22 });
  b.box(1.0, 0.06, 6.05, P.tape, 237, 5.03, 41.5, { rotY: 0.22 });
  for (const [x, z] of [[150, 44], [176, 40]]) {
    b.box(8, 5, 6.5, P.cardboard, x, 2.5, z, { rotY: rnd(x) * 0.3 });
    b.box(8.05, 0.06, 1.0, P.tape, x, 5.03, z, { rotY: rnd(x) * 0.3 });
  }

  // --- スリッパラック（2段。つま先を下に斜めに掛ける）---
  {
    const x = 251, z = 40, TH = 0.4;
    for (const [dx, dz] of [[-5.8, -2.0], [5.8, -2.0], [-5.8, 2.0], [5.8, 2.0]]) b.box(0.3, 7.2, 0.3, '#b5b5ae', x + dx, 3.6, z + dz);
    const C = ['#7a5236', '#5d6a44', '#33405e', '#8a3a3a'];
    // 棚板と同じだけ傾けた座標（x 軸まわり）での置き場所
    const cs = Math.cos(TH), sn = Math.sin(TH);
    const on = (oy, oz) => [oy * cs - oz * sn, oy * sn + oz * cs];
    for (const [ty, n0] of [[2.6, 0], [5.6, 1]]) {
      sh.box(12, 0.2, 4.4, '#c4c4bd', x, ty, z, TH, 0, 0);
      for (let i = 0; i < 4; i++) {
        const col = C[(i + n0) % 4];
        for (const dx of [-0.75, 0.75]) {
          const px = x - 4.4 + i * 2.95 + dx;
          const [sy, sz] = on(0.3, 0), [uy, uz] = on(0.62, 0.8);
          sh.box(1.3, 0.4, 3.0, col, px, ty + sy, z + sz, TH, 0, 0);     // 底
          sh.box(1.4, 0.5, 1.3, col, px, ty + uy, z + uz, TH, 0, 0);     // 甲（つま先が下・手前）
        }
      }
    }
  }

  // --- 腰掛け（靴を履くためのベンチ）と新聞 ---
  b.box(18, 1.0, 5, '#8d6440', 272, 5.0, 46);
  for (const dx of [-7.5, 7.5]) b.box(1.0, 4.5, 4.4, '#6c4a2f', 272 + dx, 2.25, 46);
  b.box(4.2, 0.22, 3.0, '#ece8dc', 277, 5.62, 46, { rotY: 0.22 });
  b.box(4.2, 0.05, 0.12, '#b8b2a4', 277, 5.75, 46, { rotY: 0.22 });

  // --- 物干し（タオル・Tシャツ・靴下のピンチハンガー）---
  {
    const z = 60, top = 9.6, x0 = 294, x1 = 330, xm = (x0 + x1) / 2;   // 足元の線（z=60 で 11.6）より低く
    for (const x of [x0 + 1, x1 - 1]) {
      sh.box(0.4, 10.2, 0.4, '#b9bcbe', x, 4.9, z + 1.3, -0.25, 0, 0);
      sh.box(0.4, 10.2, 0.4, '#b9bcbe', x, 4.9, z - 1.3, 0.25, 0, 0);
    }
    sh.cyl(0.22, 0.22, x1 - x0, '#c4c6c4', xm, top, z + 0.6, 0, 0, Math.PI / 2, 8);
    sh.cyl(0.22, 0.22, x1 - x0, '#c4c6c4', xm, top, z - 0.6, 0, 0, Math.PI / 2, 8);
    // タオル（竿に掛けて前に垂れる）
    const towel = (x, col, stripe) => {
      b.box(6.2, 5.0, 0.22, col, x, top - 2.5, z + 0.95);
      b.box(6.2, 0.5, 1.7, col, x, top + 0.2, z + 0.05);
      if (stripe) for (const yy of [top - 4.2, top - 3.6]) b.box(6.25, 0.3, 0.25, stripe, x, yy, z + 0.97);
    };
    towel(298.5, '#f2efe8', '#c9b98a');
    towel(305.5, '#8fc0dc', '#f2efe8');
    // Tシャツ（ハンガー）
    {
      const x = 313;
      sh.box(0.15, 1.0, 0.15, '#c4c6c4', x, top + 0.2, z + 0.6);
      sh.box(2.4, 0.22, 0.22, '#d8d0c0', x - 1.0, top - 0.75, z + 0.9, 0, 0, 0.35);
      sh.box(2.4, 0.22, 0.22, '#d8d0c0', x + 1.0, top - 0.75, z + 0.9, 0, 0, -0.35);
      b.box(4.2, 5.4, 0.3, '#2f3f62', x, top - 4.0, z + 1.05);
      sh.box(1.7, 1.9, 0.3, '#2f3f62', x - 2.6, top - 2.4, z + 1.05, 0, 0, 0.55);
      sh.box(1.7, 1.9, 0.3, '#2f3f62', x + 2.6, top - 2.4, z + 1.05, 0, 0, -0.55);
    }
    // ピンチハンガーの靴下
    {
      const x = 321.5;
      sh.box(0.15, 1.2, 0.15, '#c4c6c4', x, top - 0.3, z - 0.6);
      b.box(6, 0.25, 3.6, '#d6d8d6', x, top - 1.0, z + 0.2);
      const SOCK = ['#f2efe8', '#55595e', '#2f3f62', '#f2efe8', '#2a2624', '#8a8f96'];
      for (let i = 0; i < 6; i++) {
        b.box(0.35, 0.5, 0.35, '#e0b82f', x - 2.5 + i, top - 1.35, z + 1.9);
        b.box(0.8, 2.5, 0.4, SOCK[i], x - 2.5 + i, top - 2.85, z + 1.95);
      }
    }
    towel(326.5, '#f0d77a', '#d8a64a');
  }
  // --- 洗濯かご ---
  b.box(7, 3.8, 5.2, '#8ab6d2', 340, 1.9, 47);
  b.box(7.4, 0.5, 5.6, '#6f9cbc', 340, 3.9, 47);
  b.box(3, 0.8, 2.4, '#f1eee6', 338.6, 4.1, 46.4, { rotY: 0.3 });
  b.box(2.6, 0.7, 2.2, '#e3a3ad', 341.6, 4.15, 47.6, { rotY: -0.4 });
  b.box(2.2, 0.6, 1.8, '#8a8f96', 340.5, 4.3, 45.9);

  // ================= 食堂の一角 =================
  // 床はPタイル（市松）。廊下の板張りとの境に見切り
  {
    const w = DIN1 - DIN0, xm = (DIN0 + DIN1) / 2, z0 = 30, z1 = 96;
    b.box(w, 0.08, z1 - z0, P.tile, xm, 0.04, (z0 + z1) / 2);
    for (let i = 0, x = DIN0; x < DIN1 - 0.1; x += 6.4, i++) {
      for (let j = 0, z = z0; z < z1 - 0.1; z += 6.4, j++) {
        if ((i + j) % 2) b.box(Math.min(6.4, DIN1 - x), 0.04, Math.min(6.4, z1 - z), P.tileDark, x + Math.min(6.4, DIN1 - x) / 2, 0.1, z + Math.min(6.4, z1 - z) / 2);
      }
    }
    b.box(w, 0.14, 0.5, '#8a6a42', xm, 0.07, z0);
    b.box(0.5, 0.14, z1 - z0, '#8a6a42', DIN0, 0.07, (z0 + z1) / 2);
  }
  // 配膳台（ステンレス）: 炊飯ジャー・重ねたトレー・伏せた茶碗
  {
    // 天板は 7.0。炊飯ジャーの頭（10.5）が足元の線（z=58 で 10.9）を越えないように低めの台にする
    const x = 364, z = 58, T = 7.0;
    b.box(14, 0.6, 9, '#b9bcbc', x, T - 0.3, z);
    b.box(13, 0.4, 8, '#a6a9a9', x, 2.0, z);
    for (const [dx, dz] of [[-6.6, -4.1], [6.6, -4.1], [-6.6, 4.1], [6.6, 4.1]]) b.box(0.6, T - 0.6, 0.6, '#9a9d9d', x + dx, (T - 0.6) / 2, z + dz);
    sh.cyl(2.0, 2.15, 3.0, '#efeee8', x - 3.2, T + 1.5, z, 0, 0, 0, 20);
    sh.cyl(1.85, 2.0, 0.5, '#c9cac4', x - 3.2, T + 3.25, z, 0, 0, 0, 20);
    b.box(1.6, 0.4, 0.6, '#55595e', x - 3.2, T + 3.65, z);
    for (let i = 0; i < 6; i++) b.box(5.8, 0.3, 4.0, i % 2 ? '#cdb08a' : '#8a5a34', x + 2.9, T + 0.15 + i * 0.32, z - 1.6 + (i % 2) * 0.15);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) sh.cyl(0.5, 0.78, 0.7, '#ece8df', x + 1.6 + i * 1.7, T + 0.35 + j * 0.62, z + 2.4, 0, 0, 0, 12);
    b.box(5, 2.4, 4, '#3d6a8a', x, 3.4, z);   // 下段のプラスチックケース
  }
  // 長机（トレーが並ぶ）と椅子
  const table = (x, z, kettle) => {
    b.box(40, 0.9, 11, P.table, x, 7.6, z);
    b.box(40.2, 0.3, 11.2, P.tableEdge, x, 7.05, z);
    for (const [dx, dz] of [[-18.8, -4.6], [18.8, -4.6], [-18.8, 4.6], [18.8, 4.6]]) b.box(0.8, 7.0, 0.8, P.steel, x + dx, 3.5, z + dz);
    // 丸椅子（赤いビニールの座面）。背もたれが無いので、帯の手前に立つ人の足元を隠さない
    for (const side of [-1, 1]) {
      for (const dx of side < 0 ? [-15, -5, 5, 15] : [-12, 0, 12]) {
        const sx = x + dx, sz = z + side * 7.4;
        sh.cyl(1.35, 1.6, 0.3, '#8f918f', sx, 0.15, sz, 0, 0, 0, 12);
        sh.cyl(0.32, 0.32, 3.6, '#b9bbb9', sx, 2.1, sz, 0, 0, 0, 8);
        sh.cyl(1.9, 1.75, 0.8, P.seat, sx, 4.3, sz, 0, 0, 0, 16);
      }
    }
    // トレー（帯の側に4枚・手前に3枚）と、ご飯・汁椀・皿・箸・湯呑
    const tray = (tx, tz, side, k) => {
      const ty = 8.35;
      b.box(5.8, 0.3, 4.0, k % 2 ? '#cdb08a' : '#8a5a34', tx, 8.2, tz);
      sh.cyl(0.78, 0.5, 0.72, '#ece8df', tx - 1.5, ty + 0.36, tz - side * 0.7, 0, 0, 0, 12);
      sh.cyl(0.66, 0.66, 0.14, '#fbfaf4', tx - 1.5, ty + 0.74, tz - side * 0.7, 0, 0, 0, 12);
      sh.cyl(0.78, 0.52, 0.66, '#5e1f1a', tx + 0.3, ty + 0.33, tz - side * 0.7, 0, 0, 0, 12);
      sh.cyl(0.66, 0.66, 0.1, '#9a6a34', tx + 0.3, ty + 0.62, tz - side * 0.7, 0, 0, 0, 12);
      sh.cyl(1.25, 1.05, 0.16, '#f4f2ec', tx + 0.2, ty + 0.08, tz + side * 0.9, 0, 0, 0, 14);
      b.box(1.6, 0.45, 0.8, k % 3 ? '#c08a4a' : '#a8743a', tx + 0.2, ty + 0.38, tz + side * 0.9, { rotY: 0.3 });
      b.box(3.2, 0.12, 0.14, '#3c2a1c', tx - 0.2, ty + 0.06, tz - side * 1.65);
      b.box(3.2, 0.12, 0.14, '#3c2a1c', tx - 0.2, ty + 0.06, tz - side * 1.85);
      sh.cyl(0.52, 0.45, 1.15, k % 2 ? '#a9bfa2' : '#b89a72', tx + 3.6, 8.05 + 0.58, tz + side * 0.4, 0, 0, 0, 10);
    };
    let k = Math.floor(x);
    for (const dx of [-15, -5, 5, 15]) tray(x + dx, z - 2.9, -1, k++);
    for (const dx of [-12, 0, 12]) tray(x + dx, z + 2.9, 1, k++);
    // 醤油差しと箸立て
    sh.cyl(0.38, 0.42, 1.3, '#efece4', x - 6, 8.7, z + 0.1);
    sh.cyl(0.25, 0.3, 0.35, '#b8322a', x - 6, 9.5, z + 0.1);
    sh.cyl(0.6, 0.6, 1.7, '#5a3a22', x + 6, 8.9, z + 0.1);
    for (let i = 0; i < 5; i++) sh.box(0.12, 2.6, 0.12, '#c9a46a', x + 5.7 + (i % 3) * 0.3, 10.0, z - 0.2 + (i % 2) * 0.4, 0.06 * (i - 2), 0, 0.05 * (i - 2));
    if (kettle) kettleAt(sh, x + 17, z + 0.2);
  };
  table(396, 54, true);
  table(452, 54, true);
  table(508, 54, false);
  // 机の端の急須と伏せた湯呑
  {
    const x = 380.5, z = 54.3;
    b.box(5.4, 0.3, 4.0, '#cdb08a', x, 8.2, z);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) sh.cyl(0.45, 0.52, 1.0, '#b89a72', x - 1.5 + i * 1.5, 8.85, z - 0.9 + j * 1.8, 0, 0, 0, 10);
  }
  // 端の食堂の外（帯の外の手前を埋める）
  for (const x of [120, 190]) {
    sh.cyl(1.8, 1.4, 3.2, '#b0603c', x, 1.6, 52, 0, 0, 0, 12);
    for (let i = 0; i < 6; i++) sh.box(1.0, 4.0, 0.3, i % 2 ? '#4f7a3a' : '#3f6a30', x + Math.cos(i) * 0.8, 4.6, 52 + Math.sin(i) * 0.8, 0.35 * Math.sin(i * 2), i, 0.35 * Math.cos(i * 2));
  }
}

// やかん（アルマイトの金色）
function kettleAt(sh, x, z) {
  const y = 8.05, G = '#d6b46c';
  sh.cyl(1.35, 1.8, 2.0, G, x, y + 1.0, z, 0, 0, 0, 16);
  sh.cyl(0.95, 1.35, 0.45, G, x, y + 2.22, z, 0, 0, 0, 16);
  sh.cyl(0.28, 0.32, 0.4, '#2a2420', x, y + 2.62, z, 0, 0, 0, 8);
  sh.box(0.5, 2.4, 0.5, G, x - 2.0, y + 1.7, z, 0, 0, 0.8);
  sh.add(new THREE.TorusGeometry(1.25, 0.14, 6, 14, Math.PI), '#2a2420', x, y + 2.35, z, 0, Math.PI / 2, 0);
}

// ---------------------------------------------------------------------------
// 出来事: tick で時計の針を回す。分と時は「寮でどこまで進んだか」で決まり、
// 寮長の出る地点で門限の10時ちょうど。そこから先はゆっくり（6秒で1分）進み続ける。秒針は刻む。
export function onEvent(name, a) {
  if (name !== 'tick' || !clk) return;
  const t = (a && a.t) || 0, dt = (a && a.dt) || 0;
  const p = clk.stage && clk.stage.player;
  if (p && p.x > clk.maxX) clk.maxX = p.x;
  const k = Math.min(1, Math.max(0, (clk.maxX - RYO_X0) / (RYOCHO_X - RYO_X0)));
  let target = 21 * 60 + 38 + 22 * k;
  if (k >= 1) { if (clk.t1 == null) clk.t1 = t; target += (t - clk.t1) / 6; }
  if (clk.shown == null) clk.shown = target;
  clk.shown += (target - clk.shown) * Math.min(1, dt * 2.5);
  setHands(clk, clk.shown, t);
}

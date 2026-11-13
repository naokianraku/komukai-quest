// 小向クエスト2 ゴールデンエイジ編 — 第5章 LM社編「巨大な組立工場」（ゲーム座標 x 0〜1379）
//
// 米国の巨大な元請けの組立工場。技術力も設計も人もある。それでも完成しない。
// 6章でいちばん広く、明るく、格が違う場所にする（GR社の古く暗い工場・L3社の閉じた藍と並べて一目で分かる）。
// 色は「濃紺と金」: 構造（柱・治具・試験の枠・腰壁）が濃紺、手すり・治具の当て板・床の線・吊り具が金。
// 床は明るい樹脂塗りで、汚れも錆もない。光は第5章（坂 0.82）なので冷たい白にして、暖かさは置かない。
// 明るさは灯りの強さではなく、白い床・高窓・大扉から入る外の光で出す（灯り自体は坂に沿って冷たく抑える）。
//
// 区間の流れ（ワールド x。ゲーム座標の 1/3）:
//   −110〜0   翼の組立治具（縦に立てた翼の外板と2段の足場）。始まりの画面で工場の大きさを見せる
//   0〜150    設計レビュー: 吊った大画面（青い線の図面）、長机と椅子、平置きの図面棚、プロッタ、赤入れした図面の掲示
//   150〜315  試験: 計測卓とラック、荷重試験の枠（翼の箱桁を引き上げる → 折れる → 据え直す、をくり返す）、恒温槽
//   315〜388  契約管理: 変更要求の紙の束が積み上がった机、バインダーの棚、変更要求を貼り出した壁、複合機
//   388〜480  胴体の組立（作り直し）: 治具に据えた半径17の胴体（手前の外板を2か所外してある）、天井クレーンが外板を運ぶ
//   480〜560  大扉（開いていて、外の光が床に差し込む。この少し手前で帰社の場面に替わる）
//
// 作法は render3d.js の本編の場面と同じ。歩行帯 z=−25〜+25 には床の模様（薄い板）しか置かない。
// 手前ゾーンは遮蔽の線より低い物だけ（柱は立てない）。背の高い物（治具・試験の枠・恒温槽）は奥ゾーンに置く。
// 文字・ロゴ・社章・旗は描かない。看板は無地の板に色の棒だけ。人に見える物も置かない。
// 描画回数を抑えるため、動かない物はまとめ描き（boxBatch と、円柱・回転・自発光・加算を扱うここの batch）にし、
// 動く物（試験の翼・アクチュエータの棒・表示灯・クレーンの吊り荷）だけを別のメッシュにして onEvent('tick') で動かす。
import { THREE, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill } from '../../../game3d/src/render3d.js';

// ===== 色 =====
const C = {
  fog: '#808ba0',
  ceil: '#1a2134',
  // 床（明るい樹脂塗り。帯＝主通路は一段沈めた灰青）
  floor: '#bfc6d0', aisle: '#aab3bf', joint: '#a3acb8',
  cellRev: '#b6bfcd', cellTest: '#a6afbc', cellCr: '#b9c0cb', cellAsm: '#afb8c5',
  plate: '#8d95a1', slot: '#717986',
  white: '#e9ecef', gold: '#c49b40', goldLt: '#e0bd5e', goldDk: '#8e6f2c',
  hazY: '#d8ad3a', hazK: '#2b2f37',
  // 壁・構造
  wall: '#c7ced8', rib: '#b6bec9', sill: '#dadfe6',
  navy: '#1f2a47', navyMid: '#2a3960', navyLt: '#3b4d79', navyDk: '#151c30',
  steel: '#98a1ad', steelDk: '#5c6571', steelLt: '#c3c9d1', grate: '#b4bbc5', chrome: '#dfe4ea', rubber: '#2a2d33',
  glaze: '#dde9f6', mullion: '#2c3858',
  // 機体の部品（抽象。下塗りの緑と地の銀）
  primer: '#a5b28c', primerDk: '#86937a', alum: '#c8cdd5', alumDk: '#9aa2ad', inner: '#6e7c66', frameIn: '#8e9a80',
  // 書類・事務
  paper: '#f4f4f0', paper2: '#e9e8e1', paper3: '#f1ede1', ink: '#4a74b8', red: '#c8372d', textLn: '#a3a9b1',
  desk: '#d7dbe1', chair: '#26345a', chairDk: '#1b2542',
  binder: ['#1f2a47', '#e8e6de', '#c49b40', '#3a5f9e', '#7a2e36', '#8d96a3', '#2f4f7a', '#e8e6de'],
  flag: ['#e6c34a', '#5a8fd6', '#5aa874', '#d0574a', '#e08a3a'],
  box: '#e6dfcc', boxLid: '#d2c9b1', copier: '#dcdfe3',
  // 画面（自発光）
  scrBg: '#0b1833', scrGrid: '#183462', scrHi: '#1d4378', scrLine: '#6db6ff', scrLt: '#c4e4ff', scrRed: '#ff6a5a',
  dataBg: '#07140f', wave: '#56dd86', waveB: '#ffbe48', mon: '#cddbee', monLn: '#8fa3bd',
  // 外（大扉の向こう）
  sky: '#dde8f3', skyHi: '#b8cde4', apron: '#cdd3d8', apronFar: '#b6c0ca', apronLn: '#e6e9ec',
  bldgFar: '#b3bfcd', bldgFar2: '#a3b2c3', fence: '#9aa6b4',
};
const DOOR = { x0: 480, x1: 560 };   // 大扉の開口（ワールド x）

// ===== 動く物 =====
// build のたびに作り直す（前の章のメッシュを指したまま残さない）
let A = null;
const COL = {
  green: new THREE.Color('#58e08c'), greenOff: new THREE.Color('#1f3a2a'),
  amber: new THREE.Color('#ffc247'), amberOff: new THREE.Color('#4a3a1c'),
  red: new THREE.Color('#ff4a3a'), redOff: new THREE.Color('#4a1e1c'),
  barOk: new THREE.Color('#1f5a3a'), barNg: new THREE.Color('#e8402c'),
};

// ===== まとめ描き（円柱・回転・自発光・加算）=====
// boxBatch は軸に沿った箱と Y 回転だけなので、円柱・傾いた物・自前の形はここでまとめる。
// 光る物（画面・高窓・外の景色）は照明を受けない材質、光の帯と床に落ちた光は加算でまとめる。
const ORDER = 'YXZ';
const _E = new THREE.Euler(), _M = new THREE.Matrix4(), _Q = new THREE.Quaternion();
const _UP = new THREE.Vector3(0, 1, 0), _D = new THREE.Vector3();
const matLit = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const matLit2 = () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const matGlow = () => new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
const matHaze = () => new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

function batch(makeMat) {
  const L = { cast: [], plain: [] };
  const add = (g, color, x, y, z, o) => { (o.cast ? L.cast : L.plain).push([g, color, x, y, z, o]); };
  return {
    box(w, h, d, color, x, y, z, o = {}) { add(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    cyl(rt, rb, h, color, x, y, z, o = {}) {
      add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open, o.ts || 0, o.tl ?? Math.PI * 2), color, x, y, z, o);
    },
    geo(g, color, x = 0, y = 0, z = 0, o = {}) { add(g, color, x, y, z, o); },
    // parent を渡すとそこへ入れる（動く物）。渡さなければ場面に置いて行列を固定する
    done(parent = null) {
      const out = [];
      const c = new THREE.Color();
      for (const kind of ['cast', 'plain']) {
        const list = L[kind];
        if (!list.length) continue;
        const pos = [], nor = [], col = [], idx = [];
        for (const [g, color, x, y, z, o] of list) {
          const P = g.attributes.position;
          let local = null;
          if (o.vc) local = Array.from({ length: P.count }, (_, i) => [P.getX(i), P.getY(i), P.getZ(i)]);
          else c.set(color);
          if (o.rx || o.ry || o.rz) g.applyMatrix4(_M.makeRotationFromEuler(_E.set(o.rx || 0, o.ry || 0, o.rz || 0, ORDER)));
          g.translate(x, y, z);
          const N = g.attributes.normal, base = pos.length / 3;
          for (let i = 0; i < P.count; i++) {
            pos.push(P.getX(i), P.getY(i), P.getZ(i));
            nor.push(N.getX(i), N.getY(i), N.getZ(i));
            if (local) c.set(typeof o.vc === 'function' ? o.vc(i, ...local[i]) : o.vc[i]);
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
        const m = new THREE.Mesh(geo, makeMat());
        m.castShadow = kind === 'cast';
        m.receiveShadow = true;
        if (parent) parent.add(m);
        else { m.matrixAutoUpdate = false; m.updateMatrix(); addScenery(m); }
        out.push(m);
      }
      L.cast.length = 0; L.plain.length = 0;
      return out;
    },
  };
}

// 2点を結ぶ棒（ワイヤ・吊り具・斜めの腕・手すり）
function rod(B, x0, y0, z0, x1, y1, z1, t, color, o = {}) {
  _D.set(x1 - x0, y1 - y0, z1 - z0);
  const len = _D.length();
  if (len < 1e-4) return;
  _Q.setFromUnitVectors(_UP, _D.normalize());
  _E.setFromQuaternion(_Q, ORDER);
  const g = o.round ? new THREE.CylinderGeometry(t / 2, t / 2, len, o.seg || 6) : new THREE.BoxGeometry(t, len, t);
  B.geo(g, color, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { ...o, rx: _E.x, ry: _E.y, rz: _E.z });
}

// 画面や壁の上の線（z を向いた面に引く）
function line2(B, x0, y0, x1, y1, z, t, color) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  if (len < 1e-3) return;
  B.box(len + t, t, 0.04, color, (x0 + x1) / 2, (y0 + y1) / 2, z, { rz: Math.atan2(dy, dx) });
}

// 4点の板（加算の光の帯・床の光）。色は頂点ごと（黒は「光らない」）
function quad(B, pts, cols) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  B.geo(g, null, 0, 0, 0, { vc: cols });
}

// 内側を向いた面にする（胴体の内張り）
function flip(g) {
  const N = g.attributes.normal;
  for (let i = 0; i < N.count; i++) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i));
  const a = g.index.array;
  for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
  return g;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (u) => { const v = Math.min(1, Math.max(0, u)); return v * v * (3 - 2 * v); };

// ===== 場面 =====
export function build(W, halfD /* , ctx */) {
  A = null;
  const { BACK, FRONT } = zones(halfD, 46, 70);   // BACK −74 / FRONT 98（6章でいちばん奥が深い）

  // 光: 第5章（坂 0.82）。灯りは冷たい白で、強さは GR社（0.4）より少し下げる。
  // 明るく見せるのは床と壁の白さと、高窓・大扉の外光（自発光）に任せる
  setLighting(false);
  hemi.color.set('#d3def0'); hemi.groundColor.set('#5a6478'); hemi.intensity = 1.72;
  sun.color.set('#e2ebfb'); sun.intensity = 0.92;
  fill.intensity = 0.82;   // fill の色は他の場面が戻さないので触らない
  scene.background = hex(C.fog);
  scene.fog = new THREE.Fog(hex(C.fog), 260, 820);

  const K = {
    W, halfD, BACK, FRONT, XL: -130, XR: W + 130, R: rng(0x5c11),
    b: boxBatch(), X: batch(matLit), G: batch(matGlow), H: batch(matHaze),
  };
  // 壁の柱（48ごと）。大扉の開口には立てない
  K.cols = [];
  for (let x = -120; x <= K.XR - 10; x += 48) if (x < DOOR.x0 - 6 || x > DOOR.x1 + 6) K.cols.push(x);

  buildFloor(K);
  buildWall(K);
  buildOutside(K);
  ceilingSlab(W, halfD, BACK, C.ceil, 47);
  ceilingEnds(K);
  // 奥ゾーン（左から）
  wingJig(K);
  review(K);
  testArea(K);
  contractArea(K);
  assembly(K);
  staging(K);
  doorLight(K);
  signs(K);
  // 手前ゾーン（低い物だけ）
  front(K);

  K.b.done(); K.X.done(); K.G.done(); K.H.done();

  A = { t: 0, rig: makeRig(K), crane: makeCrane(K) };
}

// ----- 床 -----
function buildFloor(K) {
  const { b, XL, XR, BACK, FRONT } = K;
  const cx = (XL + XR) / 2, len = XR - XL, zc = (FRONT + BACK) / 2;
  b.box(len, 2, FRONT - BACK + 4, C.floor, cx, -1, zc - 2);                         // 上面 0（壁の下まで）
  // 主通路（歩行帯）: 一段沈めた灰青。金と紺の二重線で縁取る
  b.box(len, 0.04, 49.4, C.aisle, cx, 0.02, 0);                                      // 上面 0.04
  for (const s of [-1, 1]) {
    b.box(len, 0.06, 1.0, C.gold, cx, 0.05, s * 25.6);                               // 上面 0.08
    b.box(len, 0.06, 0.45, C.navy, cx, 0.05, s * 26.75);
  }
  // 奥の区画（上面 0.04）と縁取り（上面 0.08）
  cell(K, -14, 152, C.cellRev, C.white);       // 設計レビュー
  cell(K, 186, 278, C.cellTest, null);         // 試験（縁は黄黒）
  cell(K, 316, 386, C.cellCr, C.white);        // 契約管理
  cell(K, 388, 478, C.cellAsm, C.gold);        // 胴体の組立
  hazardEdge(K, 186, 278, -29.5, BACK + 2);
  // 目地（上面 0.06）
  for (let x = XL + 8; x < XR; x += 24) b.box(0.22, 0.04, FRONT - BACK, C.joint, x, 0.04, zc);
  for (const z of [-50, 50, 76]) b.box(len, 0.04, 0.22, C.joint, cx, 0.04, z);
  // 横断歩道（区画の切れ目。帯の縁の線には掛けない）
  for (const xc of [150, 315, 387]) {
    for (let z = -22.5; z <= 22.6; z += 3) b.box(7, 0.06, 1.5, C.white, xc, 0.05, z);
  }
  // 手前の歩行者通路の線
  b.box(len, 0.06, 0.6, C.white, cx, 0.05, 41.5);
}

function cell(K, x0, x1, fillC, lineC) {
  const { b, BACK } = K;
  const z0 = -29.5, z1 = BACK + 2, cx = (x0 + x1) / 2, zm = (z0 + z1) / 2;
  b.box(x1 - x0, 0.04, z0 - z1, fillC, cx, 0.02, zm);
  if (!lineC) return;
  b.box(x1 - x0, 0.06, 0.7, lineC, cx, 0.05, z0 - 0.35);
  b.box(0.7, 0.06, z0 - z1, lineC, x0 + 0.35, 0.05, zm);
  b.box(0.7, 0.06, z0 - z1, lineC, x1 - 0.35, 0.05, zm);
}

// 黄黒の縁（試験の区画）
function hazardEdge(K, x0, x1, z0, z1) {
  const { b } = K;
  for (let x = x0, i = 0; x < x1 - 0.01; x += 2.4, i++) {
    const w = Math.min(2.4, x1 - x);
    b.box(w, 0.06, 1.4, i % 2 ? C.hazK : C.hazY, x + w / 2, 0.05, z0 - 0.7);
  }
  for (const xs of [x0 + 0.7, x1 - 0.7]) {
    for (let z = z0 - 1.4, i = 0; z > z1 + 0.01; z -= 2.4, i++) {
      const d = Math.min(2.4, z - z1);
      b.box(1.4, 0.06, d, i % 2 ? C.hazY : C.hazK, xs, 0.05, z - d / 2);
    }
  }
}

// ----- 奥の壁（紺の腰壁・明るい壁板・高窓・H形鋼の柱・クレーンのランウェイ）-----
function buildWall(K) {
  const { b, G, XL, XR, BACK } = K;
  for (const [x0, x1] of [[XL, DOOR.x0 - 4], [DOOR.x1 + 4, XR]]) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    b.box(w, 64, 2, C.wall, cx, 32, BACK - 1);                                    // 壁（面 BACK）
    b.box(w, 9, 0.5, C.navy, cx, 4.5, BACK + 0.25);                               // 腰の紺
    b.box(w, 0.7, 0.8, C.gold, cx, 9.35, BACK + 0.4);                            // 金の見切り
    b.box(w, 1.0, 1.4, C.sill, cx, 21.7, BACK + 0.7);                             // 窓台
    b.box(w, 0.8, 1.2, C.sill, cx, 31.0, BACK + 0.6);                            // 窓の上枠
    for (let x = x0 + 2; x < x1 - 1; x += 4.2) b.box(0.5, 11.5, 0.3, C.rib, x, 15.55, BACK + 0.15);   // 壁板のリブ
    b.box(w, 30, 0.3, C.navyDk, cx, 49, BACK + 0.15);   // 高窓より上は暗い（天井スラブの向こう、画面のいちばん上に少し覗く）
  }
  // 高窓（柱と柱の間）。外は冬の曇り空で、冷たい白に光る
  for (let i = 0; i < K.cols.length - 1; i++) {
    const a = K.cols[i], c = K.cols[i + 1];
    if (c - a > 60) continue;                       // 大扉のところ
    const x0 = a + 2.6, x1 = c - 2.6, w = x1 - x0, cx = (x0 + x1) / 2;
    G.box(w, 9.0, 0.2, C.glaze, cx, 26.3, BACK + 0.1);
    for (let k = 1; k < 6; k++) b.box(0.5, 9, 0.5, C.mullion, x0 + (w * k) / 6, 26.3, BACK + 0.35);
    b.box(w, 0.4, 0.5, C.mullion, cx, 26.3, BACK + 0.35);
  }
  for (const x of K.cols) column(K, x);
  // 大扉の門柱と上の梁（梁は天井の陰で見えない）。梁より上は壁でふさぐ（天井の向こうから空が覗かないように）
  for (const x of [DOOR.x0 - 2, DOOR.x1 + 2]) {
    b.box(4.4, 46, 5, C.navy, x, 23, BACK + 0.5, { cast: true });
    b.box(4.8, 0.7, 5.4, C.gold, x, 9.35, BACK + 0.5);
  }
  b.box(DOOR.x1 - DOOR.x0 + 8, 12, 5, C.navy, (DOOR.x0 + DOOR.x1) / 2, 40, BACK + 0.5);
  b.box(DOOR.x1 - DOOR.x0 + 8, 18, 2, C.navyDk, (DOOR.x0 + DOOR.x1) / 2, 55, BACK - 1);
  b.box(DOOR.x1 - DOOR.x0, 0.1, 1.6, C.steelDk, (DOOR.x0 + DOOR.x1) / 2, 0.07, BACK + 0.8); // 扉のレール（上面 0.12）
  // クレーンのランウェイ（柱の持ち送りに載る。上に金のレール）
  b.box(XR - XL, 2.6, 2.4, C.navy, (XL + XR) / 2, 31.6, BACK + 5.2, { cast: true });
  b.box(XR - XL, 0.5, 0.8, C.goldLt, (XL + XR) / 2, 33.15, BACK + 5.2);
  // 開いた大扉の扉体（右へ引き込んで重ねてある）
  for (const [x, dz, k] of [[DOOR.x1 + 25, 4.6, 0], [DOOR.x1 + 29, 6.8, 1]]) {     // 柱（BACK+3.7 まで）より手前
    b.box(40, 45.6, 1.2, k ? C.navyMid : C.navy, x, 22.8, BACK + dz, { cast: true });
    for (let y = 4; y < 34; y += 4) b.box(39.4, 0.4, 0.3, k ? C.navyLt : C.navyMid, x, y, BACK + dz + 0.7);
    b.box(39.4, 1.2, 0.4, C.gold, x, 2.2, BACK + dz + 0.8);
  }
}

// H形鋼の柱（フランジ2枚とウェブ）、ベースプレート、ランウェイの持ち送り、腰の金の帯
function column(K, x) {
  const { b, BACK } = K;
  // 天井スラブ（y 46〜48）を突き抜けないよう 46 で止める（上は天井の向こう）
  b.box(4.2, 46, 0.6, C.navy, x, 23, BACK + 0.6, { cast: true });
  b.box(4.2, 46, 0.6, C.navy, x, 23, BACK + 3.4, { cast: true });
  b.box(0.6, 46, 2.2, C.navyMid, x, 23, BACK + 2.0, { cast: true });
  b.box(5.2, 0.8, 5.0, C.steel, x, 0.4, BACK + 2.2);
  b.box(3.4, 2.6, 4.2, C.navy, x, 29.3, BACK + 4.4, { cast: true });
  b.box(3.8, 0.6, 0.6, C.gold, x, 9.35, BACK + 4.0);
}

// 大扉の向こう（屋外）。屋内の灯りとは別の明るさなので、照明を受けない材質で明るく描く
function buildOutside(K) {
  const { G, BACK } = K;
  const zW = BACK - 2;
  const near = new THREE.Color(C.apron), far = new THREE.Color(C.apronFar), tmp = new THREE.Color();
  // 開口から見える範囲だけ（この場面のカメラは x 330〜460。奥ほど右へ広がる）
  G.box(230, 1, 118, null, 585, -0.5, zW - 59, { vc: (i, x, y, z) => tmp.copy(near).lerp(far, Math.min(1, (59 - z) / 118)) });
  for (let x = 476; x < 700; x += 46) G.box(0.5, 0.06, 34, C.apronLn, x, 0.03, zW - 26);          // 駐機の白線
  G.box(220, 0.06, 0.6, C.apronLn, 585, 0.03, zW - 44);
  // 金網の柵
  G.box(230, 0.4, 0.4, C.fence, 585, 4.6, zW - 72);
  for (let x = 472; x < 700; x += 7) G.box(0.35, 4.8, 0.35, C.fence, x, 2.4, zW - 72);
  // 遠くの建屋（特定できない低い格納庫）と照明塔
  G.box(120, 15, 22, C.bldgFar, 530, 7.5, zW - 92);
  G.box(120, 2.4, 22.6, C.bldgFar2, 530, 15.6, zW - 92);
  G.box(80, 10, 18, C.bldgFar2, 640, 5, zW - 86);
  for (const x of [512, 626]) { G.box(0.6, 26, 0.6, C.fence, x, 13, zW - 56); G.box(3.2, 1.2, 1.6, C.fence, x, 26.4, zW - 56); }
  // 空（下ほど白く霞む）
  const lo = new THREE.Color(C.sky), hi = new THREE.Color(C.skyHi);
  G.box(260, 120, 1, null, 590, 58, zW - 120, { vc: (i, x, y) => tmp.copy(lo).lerp(hi, Math.min(1, Math.max(0, (y + 30) / 90))) });
}

// 天井スラブは x −40〜W+40 しかない。始まりの画面（自機 x=20）では左がはみ出すので、同じ高さで継ぎ足す
function ceilingEnds(K) {
  const { b, W, halfD, BACK, XL, XR } = K;
  const front = halfD + 12, d = front - BACK, cz = (front + BACK) / 2;
  b.box(-40 - XL, 2, d, C.ceil, (XL - 40) / 2, 47, cz);
  b.box(XR - (W + 40), 2, d, C.ceil, (W + 40 + XR) / 2, 47, cz);
}

// ----- 翼の組立治具（区間の左端）-----
// 翼（抽象の台形。根元が左、先が右）を前縁を下にして縦に立て、紺の塔で挟む。足場は2段で手すりは金。
function wingJig(K) {
  const { b, X } = K;
  const O = 12;                                     // 始まりの画面（自機 x=20）で左の帳票に隠れすぎないよう右へ寄せる
  const zc = -63, T = 3, zf = zc + T / 2;
  const xa = -110 + O, xb = -30 + O;                // 根元と先端
  const yB = (x) => 6 + ((x - xa) * 4.5) / 80;      // 前縁（下）
  const yT = (x) => 39 - ((x - xa) * 9) / 80;       // 後縁（上）
  for (const x of [xa - 6, xb + 6]) {
    b.box(4.4, 46, 4.4, C.navy, x, 23, zc, { cast: true });
    b.box(7, 1.0, 7, C.steel, x, 0.5, zc);
    b.box(4.8, 0.6, 4.8, C.gold, x, 9.35, zc);
  }
  b.box(92, 3, 6, C.navyMid, (xa + xb) / 2, 1.5, zc, { cast: true });
  const sh = new THREE.Shape();
  sh.moveTo(xa, yB(xa)); sh.lineTo(xb, yB(xb)); sh.lineTo(xb, yT(xb)); sh.lineTo(xa, yT(xa)); sh.lineTo(xa, yB(xa));
  X.geo(new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false }), C.primer, 0, 0, zc - T / 2, { cast: true });
  // 下塗りの済んでいない外板（地の銀）
  for (const [x0, x1, y0, y1] of [[-86, -72, 13, 22], [-58, -47, 17, 26], [-104, -95, 25, 33]]) {
    b.box(x1 - x0, y1 - y0, 0.1, C.alum, (x0 + x1) / 2 + O, (y0 + y1) / 2, zf + 0.05);
  }
  // 外板の継ぎ目（リブ＝縦、ストリンガ＝横）
  for (let x = xa + 10; x <= xb - 10; x += 10) b.box(0.35, yT(x) - yB(x) - 0.8, 0.3, C.primerDk, x, (yT(x) + yB(x)) / 2, zf + 0.15);
  for (let y = 9; y <= 36; y += 3.4) {
    const xr = Math.min(xb, xa + ((y - 6) * 80) / 4.5, xa + ((39 - y) * 80) / 9) - 0.6, xl = xa + 0.6;
    if (xr - xl < 3) continue;
    b.box(xr - xl, 0.22, 0.24, C.primerDk, (xr + xl) / 2, y, zf + 0.12);
  }
  // 前縁の銀の帯・後縁の帯
  X.box(80.4, 1.4, T + 0.5, C.alum, (xa + xb) / 2, (yB(xa) + yB(xb)) / 2 + 0.3, zc, { rz: Math.atan2(4.5, 80) });
  X.box(80.8, 1.2, T + 0.4, C.primerDk, (xa + xb) / 2, (yT(xa) + yT(xb)) / 2 - 0.3, zc, { rz: -Math.atan2(9, 80) });
  // 治具の当て板（金）と腕（紺）
  for (const x of [xa + 10, xa + 30, xa + 50, xa + 70]) {
    const y = yB(x);
    b.box(2.4, 1.6, T + 1.4, C.gold, x, y - 0.6, zc);
    b.box(1.2, y - 4.4, 1.2, C.navyLt, x, (y - 1.4 + 3) / 2, zc);
  }
  for (const y of [13, 24, 33]) { b.box(4.2, 1.6, 2, C.navyLt, xa - 1.9, y, zc); b.box(1.6, 2.2, T + 1.2, C.gold, xa - 0.2, y, zc); }
  for (const y of [15, 25]) { b.box(3.8, 1.6, 2, C.navyLt, xb + 1.9, y, zc); b.box(1.6, 2.2, T + 1.2, C.gold, xb + 0.2, y, zc); }
  // 足場（2段）と階段
  platform(K, xa - 2, xb, 12, -58.4, -52.6);
  platform(K, xa + 4, xb - 24, 24, -58.4, -52.6);
  stairs(K, xb, 12, xb + 18, -55.5, 5);
}

// 足場: 床（グレーチング）・幅木（紺）・手すり（金）・脚
function platform(K, x0, x1, y, z0, z1) {
  const { b } = K;
  const cx = (x0 + x1) / 2, w = x1 - x0, cz = (z0 + z1) / 2, d = z1 - z0;
  b.box(w, 0.7, d, C.grate, cx, y - 0.35, cz, { cast: true });
  b.box(w, 0.9, 0.3, C.navy, cx, y + 0.45, z1 - 0.15);
  b.box(w, 0.45, 0.45, C.gold, cx, y + 4.2, z1 - 0.25);
  b.box(w, 0.35, 0.35, C.gold, cx, y + 2.2, z1 - 0.25);
  const n = Math.max(1, Math.round(w / 8));
  for (let i = 0; i <= n; i++) b.box(0.4, 4.2, 0.4, C.gold, x0 + 0.3 + ((w - 0.6) * i) / n, y + 2.1, z1 - 0.25);
  const m = Math.max(1, Math.round(w / 16));
  for (let i = 0; i <= m; i++) {
    const x = x0 + 0.6 + ((w - 1.2) * i) / m;
    for (const z of [z0 + 0.5, z1 - 0.6]) b.box(0.7, y - 0.7, 0.7, C.steelDk, x, (y - 0.7) / 2, z);
  }
}

// 階段（x0 の高さ y0 から x1 の床へ降りる）
function stairs(K, x0, y0, x1, zc, wd) {
  const { b, X } = K;
  const n = Math.round(y0 / 1.5), run = (x1 - x0) / n, rise = y0 / n;
  for (let i = 0; i < n - 1; i++) b.box(Math.abs(run) + 0.2, 0.4, wd, C.grate, x0 + run * (i + 1), y0 - rise * (i + 1) - 0.2, zc);
  for (const s of [-1, 1]) {
    rod(X, x0, y0 - 0.6, zc + s * (wd / 2 + 0.2), x1, -0.2, zc + s * (wd / 2 + 0.2), 0.5, C.navy);
    rod(X, x0, y0 + 4.2, zc + s * (wd / 2 + 0.3), x1, 4.2, zc + s * (wd / 2 + 0.3), 0.4, C.gold);
  }
}

// ----- 設計レビュー -----
function review(K) {
  const { b, X, R } = K;
  // 吊った大画面2枚（机の向こうで、こちらを向く）。図面は美しい
  bigScreen(K, 46, 22.5, -63, 58, 18, 'section');
  bigScreen(K, 97, 22.5, -65, 26, 13, 'wing');
  // 長机と椅子（座る人は画面の方＝奥を向く）
  const top = 8.2, tz = -46;
  b.box(60, 0.7, 10, C.desk, 46, top - 0.35, tz, { cast: true });
  b.box(60.2, 0.3, 0.3, C.gold, 46, top - 0.55, tz + 5.05);
  for (const x of [19, 73]) b.box(1.2, top - 0.7, 8.5, C.navy, x, (top - 0.7) / 2, tz, { cast: true });
  b.box(52, 4.5, 0.6, C.navy, 46, top - 3.2, tz - 3.8);
  for (const x of [24, 37, 50, 63]) chair(K, x, -38.4, 1);
  // 机の上: 広げた図面・ノートPC・マグ・丸めた図面
  sheet(K, 22, top, tz + 0.6, 10, 7, 0.12, true);
  sheet(K, 37, top, tz - 0.4, 9, 6.5, -0.08);
  sheet(K, 54, top, tz + 0.8, 10, 7, 0.05, true);
  sheet(K, 67, top, tz - 0.6, 8.5, 6, -0.15);
  for (const x of [30, 44, 61]) laptop(K, x, top, tz + 1.6);
  for (const [x, z] of [[27.5, -43], [48.5, -42.6], [70, -43.2]]) X.cyl(0.55, 0.5, 1.2, '#f2f2f0', x, top + 0.6, z, { seg: 10 });
  for (let i = 0; i < 3; i++) X.cyl(0.42, 0.42, 7, i % 2 ? C.paper : '#dfe8f3', 41 + i * 0.9, top + 0.42, tz - 3.2, { rz: Math.PI / 2, ry: 0.1 * i, seg: 8 });
  // 発表者の立ち机（奥の端）
  b.box(4, 10.5, 3, C.navy, 79, 5.25, -55, { cast: true });
  b.box(5, 0.5, 3.6, C.desk, 79, 10.75, -55);
  // 壁ぎわ: 平置きの図面棚・プロッタ・図面の吊り棚・赤入れした図面の掲示
  flatFile(K, 4, -67, 20);
  flatFile(K, 137, -67, 18);
  plotter(K, 101, -50);
  drawingRack(K, 116, -58);
  pinBoard(K, 124.5, 150, 11, 21.5, 'draw');   // 柱（120・168）の間
  // 足もとの丸めた図面のかご
  X.cyl(1.8, 1.6, 4.2, C.navy, 9, 2.1, -50, { seg: 12 });
  for (let i = 0; i < 6; i++) X.cyl(0.38, 0.38, 6.5 + R() * 1.5, i % 2 ? C.paper : '#dfe8f3', 8.4 + (i % 3) * 0.7, 4.6, -50.4 + Math.floor(i / 3) * 0.8, { rx: (R() - 0.5) * 0.2, rz: (R() - 0.5) * 0.2, seg: 8 });
}

// 吊った大画面。紺の筐体に金の線、画面は暗い紺に青い線の図面（文字なし）
function bigScreen(K, cx, cy, z, w, h, kind) {
  const { b, X, G } = K;
  b.box(w + 2, h + 2, 1.4, C.navy, cx, cy, z - 0.7, { cast: true });
  b.box(w + 2.2, 0.35, 0.3, C.gold, cx, cy - h / 2 - 1.1, z + 0.1);
  G.box(w, h, 0.1, C.scrBg, cx, cy, z + 0.05);
  const yw = cy + h / 2 + 1;
  for (const s of [-1, 1]) X.box(0.25, 46 - yw, 0.25, C.steelDk, cx + s * w * 0.35, (46 + yw) / 2, z - 0.7);
  // 方眼（ごく薄く）
  for (let u = -w / 2 + 3; u < w / 2 - 0.5; u += 3) G.box(0.07, h - 0.4, 0.04, C.scrGrid, cx + u, cy, z + 0.12);
  for (let v = -h / 2 + 3; v < h / 2 - 0.5; v += 3) G.box(w - 0.4, 0.07, 0.04, C.scrGrid, cx, cy + v, z + 0.12);
  const zl = z + 0.17;
  const L = (u0, v0, u1, v1, t = 0.14, c = C.scrLine) => line2(G, cx + u0, cy + v0, cx + u1, cy + v1, zl, t, c);
  const O = (u, v, r, t = 0.14, c = C.scrLine) => G.geo(new THREE.RingGeometry(r - t / 2, r + t / 2, 44), c, cx + u, cy + v, zl + 0.03);
  if (kind === 'section') {
    // 胴体の一区画の側面図（外形・フレーム・ストリンガ・中心線・寸法線）
    G.box(2.8, 10, 0.03, C.scrHi, cx - 10.6, cy, z + 0.145);              // 審査中の区画（塗り）
    L(-26, 5, 2, 5, 0.22, C.scrLt); L(-26, -5, 2, -5, 0.22, C.scrLt);
    L(-26, -5, -26, 5, 0.22, C.scrLt); L(2, -5, 2, 5, 0.22, C.scrLt);
    for (let u = -23.2; u < 1.9; u += 2.8) L(u, -5, u, 5, 0.07);
    for (const v of [-3, -1, 1, 3]) L(-26, v, 2, v, 0.06);
    for (let u = -28.5; u < 4; u += 2.2) L(u, 0, u + 1.3, 0, 0.07, C.scrLt);
    L(-26, -7, 2, -7, 0.07); L(-26, -7.8, -26, -6.2, 0.07); L(2, -7.8, 2, -6.2, 0.07);
    L(-26.6, -7.6, -25.4, -6.4, 0.07); L(1.4, -7.6, 2.6, -6.4, 0.07);
    // 断面図（外板・内側の線・床梁・中心線）
    O(15, 0.5, 6.5, 0.22, C.scrLt); O(15, 0.5, 5.7, 0.08);
    L(9.88, -2, 20.12, -2, 0.12); L(7.5, 0.5, 22.5, 0.5, 0.06); L(15, -7.2, 15, 8.2, 0.06);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      L(15 + Math.cos(a) * 5.7, 0.5 + Math.sin(a) * 5.7, 15 + Math.cos(a) * 6.5, 0.5 + Math.sin(a) * 6.5, 0.07);
    }
    // 吹き出しの丸（番号は描かない）と引出線
    O(5.6, 6.6, 0.9, 0.1); L(4.9, 6.0, 1.2, 3.4, 0.06);
    O(24.4, -6.0, 0.9, 0.1); L(23.7, -5.4, 20.3, -3.2, 0.06);
    O(-17, 7.2, 0.9, 0.1); L(-17, 6.3, -17, 5.2, 0.06);
    // 赤入れ（審査の指摘）
    O(-10.6, 2.6, 2.4, 0.16, C.scrRed);
    // 表題欄（右下）
    L(20, -8.6, 28, -8.6, 0.08); L(20, -5.4, 28, -5.4, 0.08); L(20, -8.6, 20, -5.4, 0.08); L(28, -8.6, 28, -5.4, 0.08);
    L(20, -7, 28, -7, 0.05); L(24, -8.6, 24, -7, 0.05);
  } else {
    // 翼の平面図（前縁は後退角つき。桁とリブ）
    const le = (u) => 4.5 + ((u + 11) / 21) * (3.0 - 4.5), te = (u) => -5 + ((u + 11) / 21) * 4.5;
    L(-11, le(-11), 10, le(10), 0.18, C.scrLt); L(-11, te(-11), 10, te(10), 0.18, C.scrLt);
    L(-11, te(-11), -11, le(-11), 0.18, C.scrLt); L(10, te(10), 10, le(10), 0.18, C.scrLt);
    L(-11, 2.6, 10, 2.3, 0.08); L(-11, -2.8, 10, 0.3, 0.08);
    for (const u of [-7, -3, 1, 5]) L(u, te(u), u, le(u), 0.06);
    L(11.6, te(10), 11.6, le(10), 0.06);
    L(-11, -6, 10, -6, 0.06);
    O(-8, 5.6, 0.7, 0.09); L(-8, 4.9, -7.2, 4.2, 0.05);
  }
}

// 机の上に広げた図面（白い紙に青い線。ときどき赤入れ）
function sheet(K, x, y, z, w, d, rot = 0, red = false) {
  const { b, X, R } = K;
  b.box(w, 0.05, d, C.paper, x, y + 0.025, z, { rotY: rot });
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const ln = (u0, v0, u1, v1) => {
    const u = (u0 + u1) / 2, v = (v0 + v1) / 2;
    b.box(Math.abs(u1 - u0) || 0.1, 0.03, Math.abs(v1 - v0) || 0.1, C.ink, x + u * cs + v * sn, y + 0.065, z - u * sn + v * cs, { rotY: rot });
  };
  const m = 0.5;
  ln(-w / 2 + m, -d / 2 + m, w / 2 - m, -d / 2 + m); ln(-w / 2 + m, d / 2 - m, w / 2 - m, d / 2 - m);
  ln(-w / 2 + m, -d / 2 + m, -w / 2 + m, d / 2 - m); ln(w / 2 - m, -d / 2 + m, w / 2 - m, d / 2 - m);
  for (let i = 0; i < 3; i++) {
    const v = -d / 2 + 1.3 + R() * (d - 2.6);
    ln(-w / 2 + 1.2, v, -w / 2 + 1.2 + (w - 2.4) * (0.4 + R() * 0.6), v);
  }
  ln(w * 0.1, -d / 2 + 1, w * 0.1, d / 2 - 1);
  if (red) {
    const u = (R() - 0.5) * w * 0.4, v = (R() - 0.5) * d * 0.4;
    X.geo(new THREE.RingGeometry(0.75, 0.95, 20), C.red, x + u * cs + v * sn, y + 0.1, z - u * sn + v * cs, { rx: -Math.PI / 2 });
  }
}

function laptop(K, x, y, z) {
  const { b, X, G } = K;
  b.box(4.2, 0.25, 2.9, C.rubber, x, y + 0.125, z);
  X.box(4.2, 2.8, 0.18, C.rubber, x, y + 1.55, z - 1.45, { rx: -0.25 });
  G.box(3.8, 2.4, 0.05, '#b8cfeb', x, y + 1.55, z - 1.33, { rx: -0.25 });
}

// 事務椅子（紺）。dir=+1 なら背もたれが手前（+z）＝座る人は奥を向く
function chair(K, x, z, dir = 1) {
  const { b } = K;
  b.box(4.6, 0.8, 4.4, C.chair, x, 5.0, z);
  b.box(4.4, 5.2, 0.7, C.chair, x, 8.3, z + dir * 2.25);
  b.box(4.6, 0.4, 0.8, C.chairDk, x, 10.9, z + dir * 2.25);
  b.box(0.8, 4.0, 0.8, C.steelDk, x, 2.6, z);
  b.box(5.0, 0.5, 0.8, C.steelDk, x, 0.5, z);
  b.box(0.8, 0.5, 5.0, C.steelDk, x, 0.5, z);
}

// 平置きの図面棚（引き出し5段）
function flatFile(K, x, z, w) {
  const { b, X, R } = K;
  b.box(w, 9, 7, '#ccd2da', x, 4.5, z, { cast: true });
  for (let i = 0; i < 5; i++) {
    b.box(w - 1, 0.18, 0.2, '#9aa2ae', x, 1.0 + i * 1.65, z + 3.55);
    b.box(w * 0.5, 0.35, 0.3, C.chrome, x, 1.75 + i * 1.65, z + 3.6);
  }
  b.box(w + 0.4, 0.4, 7.4, C.navy, x, 9.2, z);
  for (let i = 0; i < 4; i++) X.cyl(0.45, 0.45, w * 0.6, i % 2 ? C.paper : '#dfe8f3', x - w * 0.1 + R() * 2, 9.85, z - 2 + i * 1.2, { rz: Math.PI / 2, seg: 8 });
}

// 大判のプロッタ（出てきた図面が受けかごへ垂れる）
function plotter(K, x, z) {
  const { b, X, G } = K;
  b.box(22, 4.2, 5, '#d4d8de', x, 9.4, z, { cast: true });
  b.box(22.4, 0.8, 5.4, C.navy, x, 11.9, z);
  b.box(3, 2, 0.4, C.navyMid, x + 8, 10, z + 2.6);
  G.box(1.6, 0.8, 0.1, '#7fd0ff', x + 8, 10.3, z + 2.85);
  for (const s of [-1, 1]) { b.box(0.8, 7.3, 0.8, C.steelDk, x + s * 10, 3.65, z); b.box(0.8, 0.5, 5, C.steelDk, x + s * 10, 0.4, z); }
  X.box(19, 0.06, 6.4, C.paper, x - 1, 5.0, z + 4.0, { rx: 0.95 });
  for (const v of [-1.5, 0.2, 1.6]) X.box(15, 0.02, 0.12, C.ink, x - 1, 5.0 + v * Math.sin(0.95) * 0.95, z + 4.0 + v * Math.cos(0.95) * 0.95 + 0.04, { rx: 0.95 });
  b.box(20, 0.4, 0.4, C.steelDk, x - 1, 2.2, z + 5.2);
}

// 図面の吊り棚（キャスター付き）
function drawingRack(K, x, z) {
  const { b, R } = K;
  for (const s of [-1, 1]) { b.box(0.6, 14, 0.6, C.steelDk, x + s * 7, 7, z); b.box(0.6, 0.5, 6, C.steelDk, x + s * 7, 0.6, z); }
  b.box(14.4, 0.8, 1.6, C.navy, x, 14, z);
  for (let i = 0; i < 6; i++) {
    const h = 7.5 + R() * 2;
    b.box(12, h, 0.08, i % 3 ? C.paper : '#e5edf7', x, 13.6 - h / 2, z - 0.55 + i * 0.22);
  }
  for (const v of [11, 9.5, 8]) b.box(9, 0.12, 0.05, C.ink, x, v, z + 0.62);
  b.box(0.12, 4.5, 0.05, C.ink, x - 2, 9.5, z + 0.62);
}

// 壁の掲示（文字なし）。draw: 赤入れした図面 / cr: 付箋の付いた変更要求
function pinBoard(K, x0, x1, y0, y1, kind) {
  const { b, X, R, BACK } = K;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  b.box(x1 - x0 + 0.8, y1 - y0 + 0.8, 0.2, C.navy, cx, cy, BACK + 0.4);
  b.box(x1 - x0, y1 - y0, 0.3, '#eef0f2', cx, cy, BACK + 0.55);
  const zs = BACK + 0.75;
  if (kind === 'draw') {
    const n = Math.floor((x1 - x0 - 1) / 5.6);
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
      const x = x0 + 3.3 + i * 5.6, y = y0 + 2.8 + j * 5;
      b.box(5, 3.6, 0.06, C.paper, x, y, zs);
      b.box(4.2, 0.1, 0.05, C.ink, x, y + 1.3, zs + 0.06);
      b.box(4.2, 0.1, 0.05, C.ink, x, y - 1.3, zs + 0.06);
      b.box(0.1, 2.6, 0.05, C.ink, x - (R() - 0.5) * 2, y, zs + 0.06);
      if (R() < 0.45) X.geo(new THREE.RingGeometry(0.55, 0.72, 18), C.red, x + (R() - 0.5) * 2, y + (R() - 0.5) * 1.2, zs + 0.1);
    }
  } else {
    for (let x = x0 + 2.2; x < x1 - 1.8; x += 4.4) for (let j = 0; j < 2; j++) {
      const y = y0 + 2.9 + j * 5 + (R() - 0.5) * 0.5, xx = x + (R() - 0.5) * 0.4;
      b.box(3.6, 4.4, 0.06, R() < 0.8 ? C.paper : C.paper3, xx, y, zs + j * 0.02);
      for (let k = 0; k < 4; k++) b.box(2.6 - (k === 3 ? 1.2 : 0), 0.12, 0.04, C.textLn, xx - (k === 3 ? 0.6 : 0), y + 1.3 - k * 0.75, zs + 0.06 + j * 0.02);
      b.box(0.9, 0.9, 0.04, C.red, xx + 1.0, y - 1.5, zs + 0.06 + j * 0.02);
      if (R() < 0.6) b.box(0.7, 1.2, 0.05, C.flag[Math.floor(R() * C.flag.length)], xx + 1.3, y + 2.5, zs + 0.03 + j * 0.02);
    }
  }
}

// ----- 試験 -----
function testArea(K) {
  const { b, X } = K;
  // 計測卓（3面の画面）と計測ラック
  const top = 8.2, cz = -40;
  b.box(26, top, 7, C.navy, 163, top / 2, cz, { cast: true });
  b.box(26.6, 0.6, 8.2, C.desk, 163, top + 0.3, cz + 0.3);
  b.box(26.8, 0.3, 0.3, C.gold, 163, top - 0.1, cz + 4.5);
  const mons = [];
  for (const x of [154.5, 163, 171.5]) mons.push(monitor(K, x, top + 0.6, cz - 1.8, 7.4, 4.6, C.dataBg));
  K.mon = mons[1];
  for (const x of [154.5, 163, 171.5]) b.box(5, 0.3, 1.8, C.rubber, x, top + 0.75, cz + 2.2);
  chair(K, 158, -32.6, 1); chair(K, 169, -32.6, 1);
  rack(K, 157, -52); rack(K, 168.5, -52);
  // 床のケーブルカバー（ラック → 試験の枠）
  b.box(30, 0.5, 2.4, C.hazK, 189, 0.25, -45.5);
  b.box(30, 0.06, 0.5, C.hazY, 189, 0.53, -45.5);
  // 油圧ユニット（紺のタンクと金の配管）
  b.box(18, 7, 10, C.navy, 186, 3.5, -66, { cast: true });
  X.cyl(2.2, 2.2, 6.5, C.steel, 181, 9.4, -66, { rz: Math.PI / 2, seg: 14 });
  X.cyl(1.3, 1.3, 1.4, C.gold, 185, 9.4, -66, { rz: Math.PI / 2, seg: 12 });
  b.box(5, 4, 4, C.steelDk, 189.5, 9, -66);
  for (const [z, y] of [[-63.2, 4.5], [-64.6, 3.4]]) X.cyl(0.35, 0.35, 8, C.goldLt, 199, y, z, { rz: Math.PI / 2, seg: 8 });
  // 試験の床（鋼の定盤と T 溝）
  b.box(78, 0.05, 35, C.plate, 237, 0.045, -53.5);
  for (let z = -70; z <= -37; z += 3.5) b.box(77, 0.04, 0.35, C.slot, 237, 0.085, z);
  // 荷重試験の枠: 翼の根元を固定する紺の塊、右の柱、上の梁、アクチュエータ2本
  b.box(10, 35, 18, C.navy, 207, 17.5, -53, { cast: true });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) b.box(0.8, 0.8, 0.3, C.gold, 203.5 + i * 3.5, 9 + j * 3.2, -43.85);
  b.box(1.4, 6, 14.5, C.gold, 212.6, 15, -53);
  b.box(4, 35, 4, C.navy, 270, 17.5, -53, { cast: true });
  b.box(72, 4, 4, C.navy, 236, 33, -53, { cast: true });
  b.box(72.4, 0.4, 0.4, C.gold, 236, 30.9, -50.9);
  for (const x of [230, 256]) {
    X.cyl(1.35, 1.35, 6.5, C.navyLt, x, 27.75, -53, { seg: 14, cast: true });
    X.cyl(1.55, 1.55, 0.8, C.gold, x, 30.4, -53, { seg: 14 });
    X.cyl(0.9, 0.9, 0.8, C.steelDk, x, 24.2, -53, { seg: 10 });
    rod(X, x + 1.2, 29, -52, 206, 26, -46, 0.3, C.goldDk);            // 油圧ホース
  }
  b.box(2.2, 6, 1.2, C.navyMid, 270, 28, -50.6);                       // 表示灯の台
  // 受け台（折れた先端が落ちる所。紺のマット）
  b.box(28, 3.6, 14, C.steelDk, 254, 1.8, -53, { cast: true });
  b.box(27, 0.8, 13, '#33508a', 254, 4.0, -53);
  // ひずみゲージの線（翼の根元 → 床 → 計測ラック）
  for (const [k, c] of [[0, '#c8372d'], [1, '#e6c34a'], [2, '#3a5f9e']]) {
    rod(X, 213 + k * 0.6, 13.4, -46.5 + k * 0.5, 214 + k * 0.7, 0.5, -42.6, 0.22, c);
  }
  // 立入の柵（黄黒のポールと鎖）
  for (let x = 190; x <= 274.1; x += 9.33) {
    X.cyl(1.3, 1.5, 0.6, C.rubber, x, 0.3, -31, { seg: 10 });
    for (let k = 0; k < 4; k++) X.cyl(0.42, 0.42, 1.5, k % 2 ? C.hazK : C.hazY, x, 1.35 + k * 1.5, -31, { seg: 8 });
    if (x + 9.33 <= 274.2) {
      rod(X, x, 5.6, -31, x + 4.66, 4.7, -31, 0.25, C.hazY);
      rod(X, x + 4.66, 4.7, -31, x + 9.33, 5.6, -31, 0.25, C.hazY);
    }
  }
  chamber(K);
  // 計測卓の画面（波形）
  wave(K, mons[0], [C.wave, '#9ef0bd'], 3.1);
  wave(K, mons[1], [C.waveB], 2.2);
  bars(K, mons[2]);
}

// 卓上の画面（ベゼルと自発光の面）
function monitor(K, x, y, z, w, h, scr) {
  const { b, G } = K;
  b.box(1.0, 2.0, 0.8, C.rubber, x, y + 1.0, z - 0.2);
  b.box(2.8, 0.3, 2.0, C.rubber, x, y + 0.15, z);
  b.box(w, h, 0.7, C.rubber, x, y + 2.0 + h / 2, z - 0.3);
  G.box(w - 0.6, h - 0.6, 0.1, scr, x, y + 2.0 + h / 2, z + 0.1);
  return { x, y: y + 2.0 + h / 2, z: z + 0.2, w: w - 0.6, h: h - 0.6 };
}

function wave(K, m, cols, f) {
  const { G } = K;
  cols.forEach((c, k) => {
    const yb = m.y + (k === 0 ? 0.5 : -0.9), amp = k === 0 ? 0.8 : 0.45;
    let px = m.x - m.w / 2 + 0.3, py = yb;
    for (let u = 0.35; u <= m.w - 0.6; u += 0.35) {
      const x = m.x - m.w / 2 + 0.3 + u;
      const y = yb + amp * Math.sin(u * f + k) * (0.55 + 0.45 * Math.sin(u * 0.9 + 2 * k));
      line2(G, px, py, x, y, m.z, 0.09, c);
      px = x; py = y;
    }
  });
  G.box(m.w - 0.4, 0.05, 0.03, '#1d3b2c', m.x, m.y - 1.6, m.z - 0.02);
}

function bars(K, m) {
  const { G, R } = K;
  for (let i = 0; i < 8; i++) {
    const h = 0.6 + R() * 2.6, x = m.x - m.w / 2 + 0.6 + i * 0.8;
    G.box(0.5, h, 0.03, h > 2.6 ? C.waveB : C.wave, x, m.y - 1.7 + h / 2, m.z);
  }
}

// 計測ラック（表示灯の列と小さな表示）
function rack(K, x, z) {
  const { b, G } = K;
  const h = 19, zf = z + 4;
  b.box(10.5, h, 8, C.navyDk, x, h / 2, z, { cast: true });
  b.box(10.8, 0.5, 8.3, C.navy, x, h + 0.25, z);
  const led = ['#58e08c', '#58e08c', '#ffc247', '#58e08c', '#ff5a4a', '#58e08c'];
  for (let k = 0; k < 5; k++) {
    const y = 2.4 + k * 3.25;
    b.box(9.4, 2.6, 0.3, k % 2 ? '#34405c' : '#465270', x, y + 1.3, zf + 0.15);
    for (let i = 0; i < 6; i++) G.box(0.42, 0.42, 0.1, led[(i + k) % led.length], x - 3.6 + i * 0.85, y + 2.0, zf + 0.35);
    if (k === 2 || k === 4) G.box(3.2, 1.3, 0.1, k === 2 ? C.wave : '#7fd0ff', x + 2.4, y + 1.1, zf + 0.35);
  }
}

// 恒温槽（白い箱に紺の帯。扉の丸窓の中は冷たい青に光る。霜）
function chamber(K) {
  const { b, X, G } = K;
  const cx = 296, cz = -61, z1 = -52, H = 25;
  b.box(32, H - 1.5, 18, '#d9dee5', cx, 1.5 + (H - 1.5) / 2, cz, { cast: true });
  b.box(32.4, 1.5, 18.4, C.navy, cx, 0.75, cz);
  b.box(32.4, 1.4, 18.4, C.navy, cx, H + 0.7, cz, { cast: true });
  b.box(20.6, 19.6, 0.6, '#b4bcc7', 294, 12.5, z1 + 0.3);
  b.box(20, 19, 1.0, '#e8ecf1', 294, 12.5, z1 + 0.5, { cast: true });
  X.geo(new THREE.RingGeometry(3.0, 3.8, 30), C.chrome, 294, 14.5, z1 + 1.06);
  X.geo(new THREE.RingGeometry(3.8, 4.5, 30), '#f6f9fc', 294, 14.5, z1 + 1.04);   // 霜
  G.geo(new THREE.CircleGeometry(3.0, 30), '#9fd2ff', 294, 14.5, z1 + 1.03);
  G.box(3.2, 1.8, 0.02, '#3d5f86', 294, 13.6, z1 + 1.08);                            // 中の試験品の影
  for (const [x, y, w] of [[288, 4.2, 5], [297, 3.8, 6], [300.5, 20.5, 3]]) b.box(w, 0.5, 0.1, '#f6f9fc', x, y, z1 + 1.05);
  b.box(0.8, 6, 0.6, C.chrome, 302.4, 13, z1 + 1.3);                                 // 取っ手
  for (const y of [6, 19]) b.box(1.0, 2.2, 0.8, C.chrome, 284.2, y, z1 + 1.1);         // 蝶番
  b.box(5, 10, 0.6, C.navy, 308, 13, z1 + 0.3);                                      // 操作盤
  G.box(3.6, 2.2, 0.1, '#56dd86', 308, 15.8, z1 + 0.65);
  for (let i = 0; i < 3; i++) G.box(0.6, 0.6, 0.1, ['#58e08c', '#ffc247', '#ff5a4a'][i], 306.6 + i * 1.4, 11.5, z1 + 0.65);
  b.box(5, 19.6, 5, C.steelLt, 288, 36.2, -64);                                      // 天井へのダクト（46 まで）
  // 冷凍機（横）と表示灯の柱
  b.box(8, 13, 10, '#c9cfd7', 316, 6.5, -63, { cast: true });
  X.geo(new THREE.CircleGeometry(2.6, 20), '#3a4250', 316, 7, -57.94);
  X.geo(new THREE.RingGeometry(2.6, 3.0, 20), C.steelDk, 316, 7, -57.93);
  X.cyl(0.25, 0.25, 3, C.steelDk, 309, H + 2.9, -57);
  G.cyl(0.6, 0.6, 1, '#58e08c', 309, H + 4.6, -57, { seg: 10 });
  X.cyl(0.6, 0.6, 1, '#5a4a26', 309, H + 5.7, -57, { seg: 10 });
}

// ----- 契約管理 -----
function contractArea(K) {
  pinBoard(K, 363.5, 386, 11, 21.5, 'cr');      // 柱（360）の右
  bookcase(K, 328, -64);
  bookcase(K, 346, -64);
  desk(K, 333, -47, [[-6.5, -0.8, 11], [-1.5, 1.0, 16], [6.5, 1.2, 6]]);
  desk(K, 357, -47, [[-6.5, 0.6, 14], [-1.2, -0.6, 7], [6.2, 1.0, 17]]);
  chair(K, 333, -38.6, 1);
  chair(K, 357, -38.6, 1);
  copier(K, 377, -46);
  // 床に直に積んだ束（机に載りきらない）
  pile(K, 342, -56.5, 11); pile(K, 347, -57.8, 15); pile(K, 352.5, -56, 8); pile(K, 338, -58.6, 5);
}

// 机（天板・紺の袖・画面・束の山）。piles: [dx, dz, 段数]
function desk(K, x, z, piles) {
  const { b, G } = K;
  const top = 8.2;
  b.box(20, 0.7, 9, C.desk, x, top - 0.35, z, { cast: true });
  b.box(20.2, 0.3, 0.3, C.gold, x, top - 0.55, z + 4.55);
  b.box(6, top - 0.7, 8.4, C.navy, x + 6.6, (top - 0.7) / 2, z, { cast: true });
  for (let i = 0; i < 3; i++) b.box(3.2, 0.3, 0.3, C.gold, x + 6.6, 1.8 + i * 2.2, z + 4.3);
  b.box(1.0, top - 0.7, 8.4, C.navy, x - 9.4, (top - 0.7) / 2, z, { cast: true });
  b.box(16, 4, 0.5, C.navy, x - 1.5, top - 2.8, z - 3.9);
  const m = monitor(K, x + 1, top, z - 3.2, 6.4, 4.2, C.mon);
  for (let k = 0; k < 4; k++) G.box(m.w - 1.4 - (k % 2) * 1.2, 0.18, 0.03, C.monLn, m.x - 0.4, m.y + 1.2 - k * 0.8, m.z);
  for (const [dx, dz, n] of piles) pile(K, x + dx, z + dz, n, top);
  // 書類受けの3段
  for (let i = 0; i < 3; i++) {
    b.box(4.6, 0.3, 3.4, C.steelDk, x - 7, top + 0.6 + i * 1.4, z - 2.2);
    b.box(4.0, 0.5, 2.9, C.paper, x - 7, top + 1.0 + i * 1.4, z - 2.2);
  }
}

// 変更要求の紙の束（帯で縛り、付箋が飛び出している）
function pile(K, x, z, n, y0 = 0) {
  const { b, R } = K;
  let y = y0;
  for (let i = 0; i < n; i++) {
    const h = 0.85 + R() * 0.45, rot = (R() - 0.5) * 0.3;
    const px = x + (R() - 0.5) * 0.4, pz = z + (R() - 0.5) * 0.4;
    b.box(4.2, h, 3.0, [C.paper, C.paper2, C.paper3][Math.floor(R() * 3)], px, y + h / 2, pz, { rotY: rot });
    if (R() < 0.55) b.box(4.32, h + 0.06, 0.2, '#8a6f3c', px, y + h / 2, pz, { rotY: rot });
    if (R() < 0.4) b.box(0.6, 0.12, 1.0, C.flag[Math.floor(R() * C.flag.length)], px + 2.25, y + h * 0.6, pz + (R() - 0.5), { rotY: rot });
    y += h;
  }
  return y;
}

// バインダーの棚（紺の枠。背表紙は紺・白・金・青・えんじ）
function bookcase(K, x, z) {
  const { b, R } = K;
  const w = 16, d = 6, h = 17;
  b.box(w - 1.4, h - 0.3, 0.5, C.navyDk, x, (h - 0.3) / 2, z - d / 2 + 0.25, { cast: true });   // 背板は側板の内側（面を重ねない）
  for (const s of [-1, 1]) b.box(0.6, h, d, C.navy, x + s * (w / 2 - 0.3), h / 2, z, { cast: true });
  for (let k = 0; k < 5; k++) b.box(w - 1.2, 0.5, d, C.navy, x, 0.25 + k * 4.1, z);
  for (let k = 0; k < 4; k++) {
    let bx = x - w / 2 + 0.8;
    const y = 0.5 + k * 4.1;
    while (bx < x + w / 2 - 1.6) {
      const bw = 0.9 + R() * 0.5, bh = 3.0 + R() * 0.45;
      b.box(bw - 0.08, bh, 4.4, C.binder[Math.floor(R() * C.binder.length)], bx + bw / 2, y + bh / 2, z + 0.4);
      bx += bw;
    }
  }
  for (const dx of [-3.8, 3.6]) {
    b.box(6.8, 4.2, 5.4, C.box, x + dx, h + 2.1, z);
    b.box(7.1, 0.6, 5.7, C.boxLid, x + dx, h + 4.2, z);
  }
}

// 複合機
function copier(K, x, z) {
  const { b, G } = K;
  b.box(12, 7, 9, C.copier, x, 3.5, z, { cast: true });
  for (let i = 0; i < 3; i++) b.box(11.4, 0.16, 0.12, '#a9b0b9', x, 1.6 + i * 1.8, z + 4.52);
  b.box(12, 1.6, 8.6, '#c3c8cf', x, 7.8, z - 0.2);
  b.box(11.4, 0.5, 8.0, '#9ea5ae', x, 8.85, z - 0.3);
  b.box(4, 0.6, 2.4, C.navy, x + 3.4, 8.9, z + 3.6);
  G.box(1.8, 0.1, 1.2, '#7fd0ff', x + 3.0, 9.25, z + 3.6);
  b.box(4, 0.3, 5, '#b4bbc4', x - 7.6, 5.4, z);
  b.box(3.6, 1.1, 4.4, C.paper, x - 7.6, 6.1, z);
}

// ----- 胴体の組立（作り直し）-----
// 胴体は半径 17（人の背丈の2倍近い）。上は天井の陰に切れて、どこまで大きいか分からないくらいにする
const FUS = { x0: 396, x1: 470, yc: 21, zc: -55.5, R: 17 };
function assembly(K) {
  const { b, X } = K;
  const { x0, x1, yc, zc, R: Rr } = FUS;
  const N = 8, seg = (x1 - x0) / N, AX = { rz: Math.PI / 2 };   // 円柱の軸を x へ（θ=0 が手前、π/2 が上）
  // 内張り（外板を外した所と、開いた端から見える）
  X.geo(flip(new THREE.CylinderGeometry(Rr - 0.4, Rr - 0.4, x1 - x0, 44, 1, true)), C.inner, (x0 + x1) / 2, yc, zc, AX);
  // 外板。区切りごとに下塗りの緑と地の銀。手前の2か所は外してある（作り直し）
  for (let i = 0; i < N; i++) {
    const cx = x0 + seg * (i + 0.5), col = i % 2 ? C.alum : C.primer;
    const gap = i === 2 ? [-0.45, 0.62] : i === 5 ? [-0.2, 0.8] : null;
    const g = gap
      ? new THREE.CylinderGeometry(Rr, Rr, seg - 0.1, 44, 1, true, gap[1], Math.PI * 2 - (gap[1] - gap[0]))
      : new THREE.CylinderGeometry(Rr, Rr, seg - 0.1, 44, 1, true);
    X.geo(g, col, cx, yc, zc, { ...AX, cast: true });
    if (gap) {     // 外板の無い所から見えるストリンガ
      for (let a = gap[0] + 0.1; a < gap[1] - 0.04; a += 0.17) {
        X.box(seg - 0.2, 0.4, 0.4, C.frameIn, cx, yc + (Rr - 0.8) * Math.sin(a), zc + (Rr - 0.8) * Math.cos(a));
      }
    }
  }
  for (let i = 0; i <= N; i++) {
    X.geo(new THREE.TorusGeometry(Rr + 0.05, i === 0 ? 0.6 : 0.24, 6, 56), C.alumDk, x0 + seg * i, yc, zc, { ry: Math.PI / 2 });
  }
  for (let i = 0; i <= N * 2; i++) {
    X.geo(new THREE.TorusGeometry(Rr - 0.8, 0.42, 6, 56), C.frameIn, x0 + (seg / 2) * i + (i === 0 ? 0.7 : 0), yc, zc, { ry: Math.PI / 2 });
  }
  b.box(x1 - x0 - 0.8, 0.6, 31, C.frameIn, (x0 + x1) / 2, yc - 5.5, zc);   // 客室の床梁
  // 受け台（紺）と金の当て
  for (const xc of [409, 457]) {
    b.box(6, 3.2, 24, C.navy, xc, 1.6, zc, { cast: true });
    b.box(5, 0.75, 7, C.gold, xc, 3.55, zc);
    for (const s of [-1, 1]) b.box(6, 2.2, 3, C.navyMid, xc, 4.3, zc + s * 7.5);
  }
  // 両端の門形の治具（紺。上は天井の陰）と、胴体を抱える金のリング
  const zF = -36, zB = -72.6;
  for (const [xf, xr] of [[x0 - 4, x0 + 1.2], [x1 + 4, x1 - 1.2]]) {
    b.box(3.6, 46, 3.6, C.navy, xf, 23, zF, { cast: true });
    b.box(3.6, 46, 3.0, C.navy, xf, 23, zB, { cast: true });
    b.box(3.4, 3.4, zF - zB, C.navy, xf, 42, (zF + zB) / 2, { cast: true });
    b.box(3.4, 1.4, zF - zB, C.navyMid, xf, 0.7, (zF + zB) / 2);
    X.geo(new THREE.TorusGeometry(Rr + 0.75, 0.55, 8, 56), C.gold, xr, yc, zc, { ry: Math.PI / 2, cast: true });
    const r = (Rr + 0.75) * Math.SQRT1_2;
    for (const [dy, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      rod(X, xr, yc + dy * r, zc + dz * r, xf, dy > 0 ? 40.5 : 1.6, dz > 0 ? zF - 1.8 : zB + 1.5, 0.9, C.gold);
    }
  }
  b.box(x1 - x0 + 14, 3, 3, C.navy, (x0 + x1) / 2, 33.6, zF, { cast: true });
  b.box(x1 - x0 + 14, 0.4, 0.4, C.gold, (x0 + x1) / 2, 31.9, zF + 1.75);   // 柱の面より少し手前
  // 胴体の手前の足場と、手前へ降りる移動式の階段
  platform(K, x0 + 2, x1 - 2, 9, -42.9, -38.4);
  {
    const sx = 441;
    for (let i = 0; i < 5; i++) b.box(5, 0.4, 1.5, C.grate, sx, 7.5 - i * 1.5 - 0.2, -37.6 + i * 1.6);
    for (const s of [-1, 1]) {
      rod(X, sx + s * 2.7, 8.6, -38.4, sx + s * 2.7, -0.1, -30.2, 0.45, C.navy);
      rod(X, sx + s * 2.9, 13, -38.4, sx + s * 2.9, 4.2, -30.2, 0.35, C.gold);
      X.cyl(0.5, 0.5, 0.4, C.rubber, sx + s * 2.7, 0.5, -30.4, { rz: Math.PI / 2, seg: 8 });
    }
  }
}

// 大扉の右（区間の外。帰社に替わる手前で少しだけ見える）: 外した外板の置き場
function staging(K) {
  const { b, X } = K;
  for (const x of [620, 668, 716]) {
    b.box(30, 1.2, 14, C.navy, x, 0.6, -50);
    for (let i = 0; i < 3; i++) {
      X.geo(new THREE.CylinderGeometry(17, 17, 24, 16, 1, true, Math.PI / 2 - 0.3, 0.6), i % 2 ? C.alum : C.primer,
        x, 1.4 + i * 1.4 - 17 * Math.cos(0.3) + 1.0, -50, { rz: Math.PI / 2 });
    }
  }
}

// 大扉から入る外の光（床に落ちた光と、斜めの光の帯）。あわせて、高天井の灯りが床に落とす淡い光
function doorLight(K) {
  const { H, BACK } = K;
  for (let x = -96; x < K.XR; x += 48) {
    if (x > DOOR.x0 - 30 && x < DOOR.x1 + 20) continue;
    const g = new THREE.CircleGeometry(1, 28);
    g.rotateX(-Math.PI / 2); g.scale(16, 1, 6.5); g.translate(x, 0.13, -37);
    H.geo(g, null, 0, 0, 0, { vc: (i) => (i === 0 ? '#1a2029' : '#000000') });
  }
  const x0 = DOOR.x0, x1 = DOOR.x1, k = '#000000';
  quad(H, [[x0, 0.14, BACK + 0.4], [x1, 0.14, BACK + 0.4], [x1 + 18, 0.14, -4], [x0 - 4, 0.14, -4]],
    ['#4c5868', '#4c5868', k, k]);
  for (const [a, c2, s] of [[482, 507, 1], [512, 532, 0.75], [537, 558, 0.9]]) {
    const col = new THREE.Color('#222c3a').multiplyScalar(s);
    quad(H, [[a, 42, BACK + 0.4], [c2, 42, BACK + 0.4], [c2 + 8, 0.3, -27], [a + 8, 0.3, -27]], [col, col, k, k]);
  }
}

// 区画の吊り札（無地の紺の板に色の棒。文字は描かない）。高窓の帯の前に吊って、機械と重ねない
function signs(K) {
  const { b } = K;
  for (const [x, bar] of [[122, '#7fb0e0'], [181, '#e2a33e'], [338, C.goldLt]]) {
    for (const s of [-1, 1]) b.box(0.22, 10.3, 0.22, C.steelDk, x + s * 5, 40.85, -30);
    b.box(13, 4.4, 0.5, C.navy, x, 33.5, -30);
    b.box(13.4, 0.35, 0.6, C.gold, x, 31.25, -30);
    b.box(9.5, 0.9, 0.12, bar, x, 33.7, -29.69);
  }
  // 組立の札は治具の梁に付ける
  b.box(11, 3.6, 0.5, C.navy, 404, 30.1, -34.0);
  b.box(8, 0.8, 0.12, '#86c49a', 404, 30.3, -33.69);
}

// ----- 手前ゾーン（遮蔽の線より低い物だけ）-----
function front(K) {
  const { b, X, G, R } = K;
  // 部品を揃えた台車
  {
    const x = -52, z = 50;
    b.box(18, 0.6, 7, C.steelDk, x, 3.4, z);
    b.box(18, 0.5, 7, C.steelDk, x, 1.0, z);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.box(0.5, 3.4, 0.5, C.steelDk, x + s * 8.7, 2.0, z + t * 3.2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.box(5, 1.8, 3, C.navyMid, x - 5.8 + i * 5.8, 4.6, z - 1.6 + j * 3.2);
    b.box(0.5, 3.2, 6, C.gold, x + 9.2, 5.2, z);
  }
  // 図面を広げた大机（上から図面がよく見える）
  {
    const x = 46, z = 53, top = 7.2;
    b.box(54, 0.6, 11, '#e4e7eb', x, top - 0.3, z, { cast: true });
    b.box(54.2, 0.3, 0.3, C.gold, x, top - 0.45, z + 5.55);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.box(0.9, top - 0.6, 0.9, C.navy, x + s * 25.5, (top - 0.6) / 2, z + t * 4.6);
    b.box(52, 0.6, 0.6, C.navy, x, 1.4, z);
    const sx = x - 3, sz = z - 0.2, sw = 40, sd = 8.6, y = top + 0.05;
    b.box(sw, 0.05, sd, C.paper, sx, y - 0.025, sz);
    const ln = (u0, v0, u1, v1, c = C.ink) => b.box(Math.abs(u1 - u0) || 0.12, 0.03, Math.abs(v1 - v0) || 0.12, c, sx + (u0 + u1) / 2, y + 0.015, sz + (v0 + v1) / 2);
    ln(-19.5, -3.9, 19.5, -3.9); ln(-19.5, 3.9, 19.5, 3.9); ln(-19.5, -3.9, -19.5, 3.9); ln(19.5, -3.9, 19.5, 3.9);
    ln(-17, -2.6, 4, -2.6); ln(-17, 2.6, 4, 2.6); ln(-17, -2.6, -17, 2.6); ln(4, -2.6, 4, 2.6);
    for (let u = -14.9; u < 4; u += 2.1) ln(u, -2.6, u, 2.6);
    for (let u = -18.5; u < 6; u += 1.6) ln(u, 0, u + 0.9, 0);
    ln(14.5, -3.9, 14.5, -1.8); ln(14.5, -1.8, 19.5, -1.8);
    X.geo(new THREE.RingGeometry(2.45, 2.65, 40), C.ink, sx + 10, y + 0.045, sz + 0.6, { rx: -Math.PI / 2 });
    X.geo(new THREE.RingGeometry(1.95, 2.05, 40), C.ink, sx + 10, y + 0.045, sz + 0.6, { rx: -Math.PI / 2 });
    X.geo(new THREE.RingGeometry(1.25, 1.5, 24), C.red, sx - 8.6, y + 0.06, sz + 1.2, { rx: -Math.PI / 2 });
    b.box(16, 0.18, 0.9, C.chrome, x + 16, top + 0.12, z + 3.6, { rotY: 0.1 });
    b.box(6, 0.4, 1.0, C.navyLt, x - 20, top + 0.2, z + 3.8, { rotY: -0.3 });
    sheet(K, x + 21, top, z - 2, 7, 5, 0.2);
  }
  // 丸めた図面の筒立て
  {
    const x = 102, z = 51;
    X.cyl(2.6, 2.4, 4.6, C.navy, x, 2.3, z, { seg: 14 });
    X.cyl(2.7, 2.7, 0.4, C.gold, x, 4.5, z, { seg: 14 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      X.cyl(0.42, 0.42, 6.5 + R() * 2, i % 3 ? C.paper : '#dfe8f3', x + Math.cos(a) * 1.4, 4.4, z + Math.sin(a) * 1.4, { rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12, seg: 8 });
    }
  }
  // 計測器の台車
  {
    const x = 161, z = 51;
    for (const y of [1.2, 4.8]) b.box(16, 0.5, 7, C.steelDk, x, y, z);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.box(0.5, 4.8, 0.5, C.steelDk, x + s * 7.7, 2.6, z + t * 3.2);
    b.box(9, 3, 5, '#5c6878', x - 2, 6.6, z);
    G.box(4.4, 1.9, 0.1, C.dataBg, x - 3.2, 6.7, z + 2.55);
    for (let u = 0; u < 3.8; u += 0.4) line2(G, x - 5.1 + u, 6.7 + Math.sin(u * 2.4) * 0.6, x - 4.7 + u, 6.7 + Math.sin((u + 0.4) * 2.4) * 0.6, z + 2.62, 0.08, C.wave);
    for (let i = 0; i < 3; i++) G.box(0.5, 0.5, 0.1, ['#58e08c', '#ffc247', '#58e08c'][i], x + 0.6 + i * 1.1, 6.7, z + 2.55);
    X.geo(new THREE.TorusGeometry(2.2, 0.3, 6, 20), C.navyLt, x + 3, 1.75, z, { rx: Math.PI / 2 });
  }
  // 壊れた試験品の置き場（黄黒の柵と赤札）
  {
    const x = 229, z = 52;
    b.box(30, 1.2, 10, '#4a5468', x, 0.6, z);
    X.box(14, 2.2, 8, C.primer, x - 7, 2.3, z - 0.5, { ry: 0.12, rz: 0.06 });
    X.box(9, 2.0, 7.4, C.primer, x + 4.5, 2.6, z + 0.4, { ry: -0.3, rz: -0.35 });
    X.box(1.2, 2.3, 7.6, C.alum, x + 8.6, 4.0, z + 1.6, { ry: -0.3, rz: -0.35 });
    X.box(8, 0.4, 5, C.alum, x + 10, 1.6, z - 2.6, { ry: 0.5, rx: 0.25 });
    X.box(5, 0.4, 4, C.alum, x - 12, 1.5, z + 3.2, { ry: -0.7, rz: 0.3 });
    for (const [dx, dz] of [[-9, 2.5], [3, -1], [10, -2.8]]) {
      b.box(1.2, 0.1, 1.8, C.red, x + dx, 3.6 + (dx > 0 ? 0.6 : 0), z + dz);
    }
    const px = [x - 17, x + 17], pz = [z - 7.5, z + 7.5];
    for (const a of px) for (const c of pz) {
      X.cyl(1.0, 1.2, 0.5, C.rubber, a, 0.25, c, { seg: 10 });
      for (let k = 0; k < 4; k++) X.cyl(0.35, 0.35, 1.3, k % 2 ? C.hazK : C.hazY, a, 1.15 + k * 1.3, c, { seg: 8 });
    }
    for (const c of pz) { rod(X, px[0], 4.6, c, x, 3.9, c, 0.22, C.hazY); rod(X, x, 3.9, c, px[1], 4.6, c, 0.22, C.hazY); }
    for (const a of px) { rod(X, a, 4.6, pz[0], a, 3.9, z, 0.22, C.hazY); rod(X, a, 3.9, z, a, 4.6, pz[1], 0.22, C.hazY); }
  }
  // 屑入れ（赤札）
  {
    const x = 277, z = 50;
    b.box(16, 4.6, 8, C.steel, x, 2.3, z, { cast: true });
    b.box(15, 0.2, 7, '#3c4048', x, 4.55, z);
    for (let i = 0; i < 8; i++) b.box(16.2 / 8 - 0.05, 0.6, 8.2, i % 2 ? C.hazK : C.hazY, x - 8.1 + (i + 0.5) * (16.2 / 8), 4.75, z);
    for (let i = 0; i < 5; i++) X.box(2 + R() * 3, 0.4, 1 + R() * 2, i % 2 ? C.alum : C.primerDk, x - 5 + i * 2.4, 5.1, z + (R() - 0.5) * 3, { ry: R() * 3, rz: (R() - 0.5) * 0.6 });
    b.box(1.6, 2.2, 0.1, C.red, x + 4, 3.0, z + 4.06);
  }
  // 変更要求の束を積んだパレット
  {
    const x = 330, z = 51;
    b.box(20, 1.2, 9, '#4a5468', x, 0.6, z);
    pile(K, x - 6, z - 2, 4, 1.2); pile(K, x - 1, z + 2, 3, 1.2); pile(K, x + 5, z - 1.5, 4, 1.2); pile(K, x + 1, z - 2.2, 2, 1.2);
  }
  // 保存箱の手押し車
  {
    const x = 357, z = 56;
    b.box(7.4, 0.5, 6, C.steelDk, x, 0.6, z);
    for (const s of [-1, 1]) X.cyl(1.0, 1.0, 0.8, C.rubber, x + s * 3.0, 1.0, z - 2.6, { rz: Math.PI / 2, seg: 10 });
    for (const s of [-1, 1]) b.box(0.5, 8, 0.5, C.steelDk, x + s * 3.2, 4.4, z - 2.8);
    for (let i = 0; i < 2; i++) { b.box(6.4, 3.0, 5.2, C.box, x, 2.4 + i * 3.1, z + 0.2); b.box(6.6, 0.5, 5.4, C.boxLid, x, 3.7 + i * 3.1, z + 0.2); }
  }
  // 外した外板を載せた台車（作り直し）
  {
    const x = 431, z = 52;
    b.box(40, 1.6, 11, C.steelDk, x, 1.6, z);
    for (const s of [-1, 1]) for (const t of [-1, 1]) X.cyl(0.8, 0.8, 0.8, C.rubber, x + s * 17, 0.8, z + t * 4.6, { rx: Math.PI / 2, seg: 10 });
    for (const dx of [-14, 0, 14]) b.box(3, 0.8, 10, C.navyMid, x + dx, 2.8, z);
    for (let i = 0; i < 3; i++) {
      X.geo(new THREE.CylinderGeometry(17, 17, 30 - i * 3, 18, 1, true, Math.PI / 2 - 0.29, 0.58), i % 2 ? C.alum : C.primer,
        x + (i - 1) * 1.5, 3.2 + i * 0.9 - 17 * Math.cos(0.29), z, { rz: Math.PI / 2, cast: true });
      b.box(1.2, 0.12, 1.8, C.red, x - 8 + i * 7, 3.35 + i * 0.9 + 0.4, z + 2.2);
    }
  }
  // リベットの台車
  {
    const x = 471, z = 50;
    b.box(9, 4.6, 6, C.navy, x, 2.9, z, { cast: true });
    for (let i = 0; i < 3; i++) b.box(8.4, 0.25, 0.25, C.gold, x, 1.6 + i * 1.5, z + 3.05);
    b.box(9.4, 0.4, 6.4, C.navyMid, x, 5.4, z);
    for (let i = 0; i < 4; i++) b.box(1.8, 0.8, 2.4, '#aab2bd', x - 3 + i * 2, 6.0, z - 1);
    b.box(3, 1.0, 1.0, C.rubber, x + 1.5, 6.1, z + 1.8, { rotY: 0.4 });
    for (const s of [-1, 1]) X.cyl(0.55, 0.55, 0.5, C.rubber, x + s * 3.8, 0.55, z + 2.6, { rz: Math.PI / 2, seg: 8 });
  }
  // 牽引車（金の車体に紺の帯）
  {
    const x = 509, z = 55;
    b.box(20, 3.6, 9, C.goldDk, x, 2.6, z, { cast: true });
    b.box(20.2, 0.8, 9.2, C.navy, x, 3.0, z);
    b.box(8, 2.0, 8, C.gold, x + 5, 5.4, z);
    b.box(4.2, 0.9, 4.4, C.rubber, x - 3.5, 5.0, z);
    b.box(4.2, 3.2, 0.8, C.rubber, x - 5.4, 6.4, z);
    rod(X, x - 0.5, 4.4, z, x + 0.6, 7.2, z, 0.4, C.rubber);
    X.cyl(1.3, 1.3, 0.4, C.rubber, x + 0.8, 7.4, z, { rz: 0.4, seg: 14 });
    for (const s of [-1, 1]) for (const t of [-1, 1]) X.cyl(1.9, 1.9, 1.4, C.rubber, x + s * 6.8, 1.9, z + t * 4.6, { rx: Math.PI / 2, seg: 14 });
    b.box(2.4, 1.0, 1.0, C.steelDk, x - 11, 1.6, z);
  }
  // 消火器の台
  {
    const x = 548, z = 44;
    b.box(3, 0.4, 3, C.steelDk, x, 0.2, z);
    b.box(0.5, 6, 0.5, C.steelDk, x, 3.2, z - 1.2);
    X.cyl(0.9, 0.9, 4.0, '#c8372d', x, 2.5, z, { seg: 12 });
    X.cyl(0.35, 0.35, 0.8, C.rubber, x, 4.9, z, { seg: 8 });
  }
  // 置き場の白線
  for (const [x, z, w, d] of [[-52, 50, 22, 10], [161, 51, 20, 10], [357, 56, 11, 10], [431, 52, 44, 14], [509, 55, 26, 14]]) {
    const o = { y: 0.05 };
    b.box(w, 0.06, 0.5, C.white, x, o.y, z - d / 2);
    b.box(w, 0.06, 0.5, C.white, x, o.y, z + d / 2);
    b.box(0.5, 0.06, d, C.white, x - w / 2, o.y, z);
    b.box(0.5, 0.06, d, C.white, x + w / 2, o.y, z);
  }
}

// ===== 動く物 =====
// 荷重試験: 翼の箱桁を根元で固定し、2本のアクチュエータで先を引き上げる。
// 周期 12 秒: 0〜7 秒で少しずつ反る（黄が点滅）→ 7 秒で外側が折れて受け台に落ち、破片が散る（赤・警報）
// → 10.5 秒から据え直す（緑）。「設計は通る。だが試験で裏切られる」を背景でくり返す。
function makeRig(K) {
  const root = new THREE.Group(); root.position.set(212, 15, -53); addScenery(root);
  const tip = new THREE.Group(); tip.position.set(30, 0, 0); root.add(tip);
  const B1 = batch(matLit);
  B1.box(30, 3.0, 12.5, C.primer, 15, 0, 0, { cast: true });
  B1.box(29.9, 3.3, 1.2, C.alum, 15, 0, 6.6, { cast: true });     // 端の面を本体と揃えない（折れたとき見える）
  B1.box(29.9, 2.6, 0.8, C.primerDk, 15, 0, -6.6);
  for (let x = 4; x < 29; x += 5) B1.box(0.3, 0.1, 12.3, C.primerDk, x, 1.55, 0);
  B1.box(0.5, 3.1, 12.6, '#56604f', 29.8, 0, 0);               // 継ぎ目（折れると破断面になる）
  B1.box(4, 1.0, 6, C.rubber, 18, 2.0, 0);
  B1.box(3, 1.2, 2.5, C.steelDk, 18, 3.1, 0);
  B1.done(root);
  const B2 = batch(matLit);
  B2.box(22, 2.5, 10.5, C.primer, 11, 0, 0, { cast: true });
  B2.box(21.9, 2.8, 1.1, C.alum, 11, 0, 5.6, { cast: true });
  B2.box(21.9, 2.2, 0.7, C.primerDk, 11, 0, -5.6);
  for (let x = 3; x < 21; x += 5) B2.box(0.3, 0.1, 10.3, C.primerDk, x, 1.3, 0);
  B2.box(1.4, 2.6, 10.6, C.alum, 21.5, 0, 0);
  B2.box(4, 1.0, 5.5, C.rubber, 14, 1.75, 0);
  B2.box(3, 1.2, 2.5, C.steelDk, 14, 2.85, 0);
  B2.done(tip);
  const mkRod = (x) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 8), new THREE.MeshLambertMaterial({ color: hex(C.chrome) }));
    m.position.set(x, 21, -53); addScenery(m); return m;
  };
  const lamp = (y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), new THREE.MeshBasicMaterial({ color: COL.greenOff.clone() }));
    m.position.set(270, y, -49.9); addScenery(m); return m;
  };
  // 赤の照り返し（加算の円板。折れている間だけ出す）
  const hg = new THREE.CircleGeometry(4.2, 24);
  const hc = []; for (let i = 0; i < hg.attributes.position.count; i++) hc.push(...(i === 0 ? [0.55, 0.12, 0.08] : [0, 0, 0]));
  hg.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
  const halo = new THREE.Mesh(hg, matHaze());
  halo.position.set(270, 29.5, -49.0); halo.visible = false; addScenery(halo);
  // 破片
  const sh = new THREE.Group(); addScenery(sh);
  const SB = batch(matLit);
  for (let i = 0; i < 7; i++) SB.box(0.6 + K.R() * 0.9, 0.3, 0.5 + K.R() * 0.8, i % 2 ? C.primer : C.alum, (K.R() - 0.5) * 3.4, (K.R() - 0.5) * 1.6, (K.R() - 0.5) * 7);
  SB.done(sh);
  sh.visible = false;
  // 計測卓の画面: 警報の帯と、走査の縦線
  const m = K.mon;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(m.w - 0.3, 0.55, 0.05), new THREE.MeshBasicMaterial({ color: COL.barOk.clone(), fog: false }));
  bar.position.set(m.x, m.y + m.h / 2 - 0.45, m.z + 0.04); addScenery(bar);
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.12, m.h - 0.9, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a0'), fog: false }));
  scan.position.set(m.x, m.y - 0.25, m.z + 0.05); addScenery(scan);
  return {
    root, tip, rods: [mkRod(230), mkRod(256)], lamps: [lamp(26.4), lamp(28.0), lamp(29.6)], halo, sh, bar, scan,
    off: 0, mon: m, v: new THREE.Vector3(),
  };
}

// 天井クレーン: 桁は天井の向こうで見えないので、ワイヤ・フックブロック・吊り具・外板だけを見せる。
// 胴体の前を左右にゆっくり行き来する（周期 46 秒）。吊り荷は少し遅れて揺れ、黄の回転灯が点滅する。
function makeCrane(K) {
  const g = new THREE.Group(); g.position.set(433, 0, -31); addScenery(g);
  const U = batch(matLit);
  for (const s of [-1, 1]) U.box(0.22, 11.4, 0.22, C.steelDk, s * 0.7, 40.3, 0);   // ワイヤ（天井の下 46 まで）
  U.box(3.0, 3.4, 1.9, C.goldLt, 0, 33.1, 0, { cast: true });
  U.box(3.2, 1.0, 2.1, C.navy, 0, 35.2, 0);
  for (const s of [-1, 1]) U.box(0.3, 2.6, 2.0, C.navy, s * 1.6, 33.1, 0);
  U.done(g);
  const low = new THREE.Group(); low.position.set(0, 31.4, 0); g.add(low);
  const L = batch(matLit2);
  L.box(0.8, 1.4, 0.8, C.steelDk, 0, -0.7, 0);
  L.geo(new THREE.TorusGeometry(0.7, 0.24, 6, 14, Math.PI * 1.4), C.steelDk, 0, -2.0, 0, { rz: -0.9 });
  L.box(15, 0.9, 0.9, C.goldLt, 0, -3.0, 0, { cast: true });
  for (const s of [-1, 1]) rod(L, s * 0.6, -1.6, 0, s * 6.8, -3.0, 0, 0.18, C.steelDk);
  const a = 0.22, yAx = -25.4, ye = yAx + 17 * Math.cos(a), ze = 17 * Math.sin(a);   // 胴体と同じ半径の外板（奥行き ±3.7）
  for (const s of [-1, 1]) for (const t of [-1, 1]) rod(L, s * 6.8, -3.4, 0, s * 6.6, ye + 0.1, t * ze, 0.16, C.steelDk);
  L.geo(new THREE.CylinderGeometry(17, 17, 14, 16, 1, true, Math.PI / 2 - a, 2 * a), C.primer, 0, yAx, 0, { rz: Math.PI / 2, cast: true });
  for (const t of [-1, 1]) L.box(14, 0.35, 0.4, C.primerDk, 0, ye, t * ze);
  L.done(low);
  const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), new THREE.MeshBasicMaterial({ color: COL.amberOff.clone() }));
  lampM.position.set(0, 36.05, 0); g.add(lampM);
  return { g, low, lamp: lampM };
}

// ===== 出来事 =====
export function onEvent(name, arg) {
  if (!A) return;
  if (name === 'revive') {          // 作り直し（ボスの復活）: 試験をその場で折る（この場面がボス戦に使われたとき用）
    A.rig.off = 7 - (A.t % 12);
    return;
  }
  if (name !== 'tick') return;
  const t = (arg && arg.t) || 0;
  A.t = t;
  rigTick(A.rig, t);
  craneTick(A.crane, t);
}

function rigTick(r, t) {
  const p = (((t + r.off) % 12) + 12) % 12;
  let th = 0, tp = 0, broken = false, red = false, amber = false, green = false;
  if (p < 7) {
    th = 0.075 * smooth(p / 7);
    amber = (p % 0.8) < 0.4;
  } else if (p < 10.5) {
    const u = p - 7;
    broken = true; red = true;
    th = 0.014 + 0.05 * Math.exp(-u * 5) * Math.cos(u * 22);           // 根元側は荷が抜けて跳ね戻る
    tp = -0.48 * Math.min(1, u / 0.32) + 0.04 * Math.exp(-u * 6) * Math.sin(u * 30) * (u > 0.32 ? 1 : 0);
  } else {
    const u = (p - 10.5) / 1.5;
    th = 0.014 * (1 - smooth(u));
    tp = -0.48 * (1 - smooth(u));
    green = true;
  }
  r.root.rotation.z = th;
  r.tip.rotation.z = tp;
  // アクチュエータの棒（胴の下端 y=24.5 から翼の金具まで）
  r.root.updateMatrixWorld(true);
  const p1 = r.v.set(18, 3.6, 0); r.root.localToWorld(p1);
  setRod(r.rods[0], p1.y);
  const p2 = r.v.set(14, 3.35, 0); r.tip.localToWorld(p2);
  setRod(r.rods[1], broken ? Math.min(23.4, p2.y + 6 * Math.min(1, (p - 7) / 0.25)) : p2.y);
  // 表示灯
  r.lamps[0].material.color.copy(green || p < 0.4 ? COL.green : COL.greenOff);
  r.lamps[1].material.color.copy(amber ? COL.amber : COL.amberOff);
  r.lamps[2].material.color.copy(red ? COL.red : COL.redOff);
  r.halo.visible = red;
  if (red) { const s = 0.85 + 0.15 * Math.sin(t * 12); r.halo.scale.set(s, s, s); }
  r.bar.material.color.copy(red && (t % 0.5) < 0.3 ? COL.barNg : COL.barOk);
  // 破片（折れた所から落ちて受け台で止まる）
  if (broken) {
    const u = p - 7, y = Math.max(5.1, 15 - 15 * u * u);
    r.sh.visible = true;
    r.sh.position.set(242 + u * 2.2, y, -53 + u * 1.2);
    r.sh.rotation.set(u * 5, u * 3, u * 7);
    if (y <= 5.1) r.sh.rotation.set(0.2, 1.1, 0.1);
  } else r.sh.visible = false;
  // 走査線（画面の左から右へ）
  const m = r.mon;
  r.scan.position.x = m.x - m.w / 2 + 0.3 + ((t * 1.6) % (m.w - 0.6));
}

function setRod(m, yb) {
  const top = 24.5, h = Math.max(0.4, top - yb);
  m.position.y = top - h / 2;
  m.scale.y = h;
}

function craneTick(c, t) {
  const ph = (t / 46) * Math.PI * 2;
  c.g.position.x = 433 + 112 * Math.sin(ph);
  c.low.rotation.z = 0.035 * Math.sin(ph + 1.1) + 0.006 * Math.sin(t * 1.9);
  c.lamp.material.color.copy((t % 1.1) < 0.55 ? COL.amber : COL.amberOff);
}

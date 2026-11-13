// 小向クエスト2 ゴールデンエイジ編 — 第3章 GR社編「古い工場」（ゲーム座標 x 440〜1159）
//
// 主要機器の供給元・GR社の工場。技術力が低く、モノが完成しない。作っては壊れ、作り直し、また壊れる。
// 前日譚（入社3年目）なので新しい物は置かない。塗装は「褪せた黄土」、灯りはところどころ切れている。
//
// 区間の流れ（ワールド x。ゲーム座標の 1/3）:
//   〜130    現場事務所（待合室から出てきた扉）
//   140〜260 不具合説明: 作業台の壊れた試作品、不具合を貼り出した板、試験台（ときどき火花と煙を出して壊れる）
//   260〜340 再試作: 同じ試作品の山（作り直すたびに増える）、赤い不良札、スクラップのかご
//   340〜440 製造部門（中ボス）: 古い旋盤・フライス盤・プレス・ボール盤、天井クレーンのフック
//   440〜490 搬出口のシャッター（少し開いて外の光が入る。この先で帰社の場面に替わる）
//
// 作法は render3d.js の本編の場面と同じ。歩行帯 z=−25〜+25 には床の模様しか置かない。
// 手前ゾーンは遮蔽の線より低い物だけ（柱は立てない）。クレーンの桁など帯の上に掛ける物は y≥40。
// 描画回数を抑えるため、動かない物はまとめ描き（boxBatch と、回転・円柱を扱うここの batch）にし、
// 動く物（ちらつく灯り・揺れるフック・試験台）だけを別のメッシュにして onEvent('tick') で動かす。
import { THREE, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill } from '../../../game3d/src/render3d.js';

// ===== 色 =====
// 黄土は彩度を落として「褪せた」側に寄せる。機械は古い灰緑とクリーム、試作品だけ冷たい灰青にして
// 「同じ物がいくつもある」ことが黄土の地から浮いて読めるようにする。
const C = {
  fog: '#6d6c64',
  ochre: '#ab8d50', ochreDk: '#84703f', ochrePale: '#b7a77f',
  cream: '#bbb08f', creamDk: '#a29777', grime: '#867b62',
  roof: '#4c473d', roofDk: '#38342c',
  floor: '#7a756b', floorLt: '#847e72', floorDk: '#6e695f', joint: '#615c53',
  oil: '#4b463d', oilDk: '#3a362f',
  line: '#b89e4b', lineFade: '#9f9471', black: '#2c2924',
  rust: '#7a4b2d', rustDk: '#583626',
  steel: '#86847b', steelDk: '#4d4b45', iron: '#37352f', base: '#8a8478',
  mach: '#67705e', machDk: '#4a5044', machLt: '#848a74', machCream: '#b5aa88',
  proto: '#69777b', protoDk: '#394144', protoLt: '#8f9a9b', protoGauge: '#cfd3c2', protoDust: '#888d88',
  tag: '#c03a2b', tagLt: '#ddcba0',
  wood: '#87693f', woodDk: '#664d31', card: '#a3875a', cardDk: '#876d48',
  paper: '#e3ded0', print: '#c3cfd2', ink: '#5a5f66',
  glass: '#c2c6be', glassDim: '#a3a8a1', glassDark: '#34312b', ply: '#89704a',
  office: '#d8cca4', blind: '#cfc7ae', outside: '#d2d9db',
  lampOn: '#ffe2a2', lampOff: '#5a564c', shade: '#48503f',
  tarp: '#6a6d56', tarpDk: '#565946',
  shutter: '#8c8672', shutterDk: '#77715f',
  board: '#d3ccb6', sign: '#d9d3bf', dark: '#26231f',
};
const BINDER = ['#7a4334', '#3f5672', '#4d6a43', '#8a7838', '#5c4a63', '#40625f'];
const PU = { w: 6, h: 4.4, d: 4.6 };   // 試作品（主要機器）の大きさ。どこに置いても同じ形

// ===== 動く物 =====
// build のたびに作り直す（前の章のメッシュを指したまま残さない）
let A = null;
const COL = {
  on: new THREE.Color(C.lampOn), off: new THREE.Color(C.lampOff),
  amber: new THREE.Color('#f2b33d'), red: new THREE.Color('#e8402c'), dark: new THREE.Color('#3a2d26'),
};

// ===== まとめ描き（回転・円柱つき）=====
// boxBatch は軸に沿った箱と Y 回転だけなので、円柱（ドラム缶・はずみ車・配管）と傾いた物はここでまとめる。
// 光る物（窓・点いている灯り）は照明を受けない材質で、霞（灯りの円錐・床の光）は加算でまとめる。
const ORDER = 'YXZ';   // 傾けてから向きを変える（ry が最後に効く）
const _E = new THREE.Euler(), _M = new THREE.Matrix4(), _P = new THREE.Vector3();
const _Q = new THREE.Quaternion(), _UP = new THREE.Vector3(0, 1, 0), _D = new THREE.Vector3();
const lit = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const glow = () => new THREE.MeshBasicMaterial({ vertexColors: true });
const haze = () => new THREE.MeshBasicMaterial({
  vertexColors: true, transparent: true, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

function batch(makeMat, dynamic = false) {
  const L = { cast: [], plain: [] };
  const add = (g, color, x, y, z, o) => { (o.cast ? L.cast : L.plain).push([g, color, x, y, z, o]); };
  return {
    box(w, h, d, color, x, y, z, o = {}) { add(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    cyl(rt, rb, h, color, x, y, z, o = {}) {
      add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open), color, x, y, z, o);
    },
    geo(g, color, o = {}) { add(g, color, 0, 0, 0, o); },
    done() {
      const out = [];
      const c = new THREE.Color(), c0 = new THREE.Color(), c1 = new THREE.Color();
      for (const kind of ['cast', 'plain']) {
        const list = L[kind];
        if (!list.length) continue;
        const pos = [], nor = [], col = [], idx = [];
        for (const [g, color, x, y, z, o] of list) {
          const P = g.attributes.position;
          let ly = null, lo = 0, span = 1;
          if (o.grad) {          // 下→上のグラデーション（回す前の高さで決める）
            ly = Float32Array.from({ length: P.count }, (_, i) => P.getY(i));
            lo = Math.min(...ly); span = (Math.max(...ly) - lo) || 1;
            c0.set(o.grad[0]); c1.set(o.grad[1]);
          } else if (!o.vcol) c.set(color);
          if (o.rx || o.ry || o.rz) g.applyMatrix4(_M.makeRotationFromEuler(_E.set(o.rx || 0, o.ry || 0, o.rz || 0, ORDER)));
          g.translate(x, y, z);
          const N = g.attributes.normal, base = pos.length / 3;
          for (let i = 0; i < P.count; i++) {
            pos.push(P.getX(i), P.getY(i), P.getZ(i));
            nor.push(N.getX(i), N.getY(i), N.getZ(i));
            if (ly) c.copy(c0).lerp(c1, (ly[i] - lo) / span);
            else if (o.vcol) c.set(o.vcol[Math.min(i, o.vcol.length - 1)]);   // 頂点0（円の中心）だけ別の色
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
        if (!dynamic) { m.matrixAutoUpdate = false; m.updateMatrix(); }
        addScenery(m);
        out.push(m);
      }
      L.cast.length = 0; L.plain.length = 0;
      return out;
    },
  };
}

// 2点を結ぶ細い棒（ケーブル・鎖・取っ手）
function rod(B, x0, y0, z0, x1, y1, z1, t, color, o = {}) {
  _D.set(x1 - x0, y1 - y0, z1 - z0);
  const len = _D.length();
  if (len < 1e-4) return;
  _Q.setFromUnitVectors(_UP, _D.normalize());
  _E.setFromQuaternion(_Q, ORDER);
  B.box(t, len, t, color, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { ...o, rx: _E.x, ry: _E.y, rz: _E.z });
}

// 親の向きで回した位置に部品を置く道具。傾いた試作品・開いた蓋などに使う。
// o.lx / o.ly / o.lz を渡すと、その部品だけ親の中でさらに傾ける。
function placer(B, x, y, z, rx = 0, ry = 0, rz = 0, base = {}) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, ORDER));
  const rot = (o) => {
    if (!(o.lx || o.ly || o.lz)) return { rx, ry, rz };
    const ql = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.lx || 0, o.ly || 0, o.lz || 0, ORDER));
    const e = new THREE.Euler().setFromQuaternion(ql.premultiply(q), ORDER);
    return { rx: e.x, ry: e.y, rz: e.z };
  };
  const at = (dx, dy, dz) => _P.set(dx, dy, dz).applyQuaternion(q);
  const put = (w, h, d, color, dx, dy, dz, o = {}) => {
    const p = at(dx, dy, dz);
    B.box(w, h, d, color, x + p.x, y + p.y, z + p.z, { ...base, ...o, ...rot(o) });
  };
  put.cyl = (rt, rb, h, color, dx, dy, dz, o = {}) => {
    const p = at(dx, dy, dz);
    B.cyl(rt, rb, h, color, x + p.x, y + p.y, z + p.z, { ...base, ...o, ...rot(o) });
  };
  put.rod = (x0, y0, z0, x1, y1, z1, t, color) => {
    const a = at(x0, y0, z0).clone(), e = at(x1, y1, z1).clone();
    rod(B, x + a.x, y + a.y, z + a.z, x + e.x, y + e.y, z + e.z, t, color, base);
  };
  return put;
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
const frac = (v) => v - Math.floor(v);

// ===== 場面 =====
export function build(W, halfD /* , ctx */) {
  A = { hooks: [], flick: null, test: null, dust: null };
  const { BACK, FRONT } = zones(halfD, 44, 70);

  // 光: 第3章（坂 0.4）。春の明るさから一段冷えて暗い。暖かさは褪せた塗装と切れかけの電球だけに持たせ、
  // 窓からの光も天井の光も白く冷たくする（同じ章の待合室の冷たさと揃える）
  setLighting(false);
  hemi.color.set('#d8dfe2'); hemi.groundColor.set('#646055'); hemi.intensity = 1.95;
  sun.color.set('#e8edf0'); sun.intensity = 0.95;
  fill.intensity = 0.95;
  // 少し埃っぽい。霧を近めにして、奥の壁の端がかすむくらい
  scene.background = hex(C.fog);
  scene.fog = new THREE.Fog(hex(C.fog), 255, 620);

  const K = { W, halfD, BACK, FRONT, R: rng(0x3a71), b: boxBatch(), X: batch(lit), G: batch(glow), H: batch(haze) };
  K.cols = [];
  for (let x = -40; x <= W + 40; x += 48) K.cols.push(x);

  buildFloor(K);
  buildWall(K);
  ceilingSlab(W, halfD, BACK, C.roof, 47);
  buildOverhead(K);
  buildOffice(K);
  buildDefect(K);
  buildRework(K);
  buildMachines(K);
  buildExit(K);
  buildFront(K);

  K.b.done(); K.X.done(); K.G.done(); K.H.done();
}

// ----- 床 -----
function buildFloor(K) {
  const { b, R, W, halfD, BACK, FRONT } = K;
  const zc = (FRONT + BACK) / 2, zl = FRONT - BACK;
  b.box(W + 80, 2, zl, C.floor, W / 2, -1, zc);
  // 打ち直した跡（色違いのコンクリート）。重ねると点滅するので升目ひとつに1枚まで
  const bands = [[BACK + 3, -halfD - 3], [-halfD + 1, halfD - 1], [halfD + 4, halfD + 58]];
  for (let x = -40; x < W + 40; x += 26) {
    for (const [z0, z1] of bands) {
      if (R() < 0.45) continue;
      const w = 7 + R() * 15, d = Math.min(z1 - z0 - 1, 5 + R() * 14);
      const px = x + w / 2 + R() * (26 - w), pz = z0 + d / 2 + R() * (z1 - z0 - d);
      b.box(w, 0.06, d, R() < 0.5 ? C.floorLt : C.floorDk, px, 0, pz);          // 上面 0.03
    }
  }
  for (const x of K.cols) b.box(0.3, 0.08, zl - 1, C.joint, x, 0.01, zc);       // 目地（柱の通り）0.05
  // 通路の線。褪せて途切れ途切れ
  for (const z of [-halfD - 1.5, halfD + 1.5]) {
    for (let x = -40; x < W + 40;) {
      const len = 5 + R() * 22, gap = R() < 0.25 ? 3 + R() * 8 : 0.5 + R();
      b.box(len, 0.06, 0.95, R() < 0.6 ? C.line : C.lineFade, x + len / 2, 0.05, z);   // 上面 0.08
      x += len + gap;
    }
  }
  // 油の染み（帯の中は少しだけ。機械のまわりに多い）
  for (const [x, z, r, sx] of [[178, 9, 2.6, 1.6], [262, -15, 2.0, 1.3], [331, 13, 3.0, 1.2], [404, -7, 2.4, 1.8],
    [446, 14, 1.8, 1.4], [214, -19, 1.4, 1.2], [300, 4, 1.2, 1.0], [372, 19, 1.6, 1.5]]) stain(K, x, z, r, sx);
  // フォークリフトのタイヤ跡（弧を描く2本の筋）
  tireMarks(K, 222, -27, -0.9, 0.012, 88);
  tireMarks(K, 378, 24, 0.5, -0.008, 64);
  // ピットにかぶせた鋼板（ボルト留め）
  for (const [x, z] of [[158, -10], [345, 6]]) {
    b.box(10, 0.1, 7, '#64635d', x, 0.06, z);                                   // 上面 0.11
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.45, 0.05, 0.45, '#46453f', x + sx * 4.4, 0.135, z + sz * 2.9);
  }
}

// タイヤ跡。少しずつ向きを変えながら短い筋を並べる（上面 0.13。染み・線より上の層）
// ang は進む向き（rotY と同じ。x+ が 0、z− 側へ正）。2本の筋は進む向きと直角に振り分ける
function tireMarks(K, x, z, ang, bend, len) {
  for (let s = 0; s < len; s += 2.2) {
    const nx = Math.sin(ang) * 2.1, nz = Math.cos(ang) * 2.1;
    // 継ぎ目で少し重なるので色は1つにする（色違いを重ねると点滅する）
    for (const k of [-1, 1]) K.b.box(2.4, 0.04, 0.55, '#6a655b', x + k * nx, 0.11, z + k * nz, { rotY: ang });
    x += Math.cos(ang) * 2.2; z -= Math.sin(ang) * 2.2;
    ang += bend * 2.2;
  }
}

// 油の染み。縁をぎざぎざにした平たい円（まとめ描きの1枚に入れる）
function stain(K, x, z, r, sx = 1, dark = false) {
  const n = 12, g = new THREE.CircleGeometry(r, n);
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, s = K.R() * 100;
  for (let i = 1; i < P.count; i++) {
    const k = 0.6 + 0.55 * frac(Math.sin(((i - 1) % n) * 12.99 + s) * 43758.5);
    P.setX(i, P.getX(i) * k * sx); P.setZ(i, P.getZ(i) * k);
  }
  g.translate(x, 0.11, z);
  K.X.geo(g, dark ? C.oilDk : C.oil);
}

// 床に落ちた光（中心が明るく縁で消える楕円）。加算で重ねる
function pool(K, x, z, rx, rz, color) {
  const g = new THREE.CircleGeometry(1, 24);
  g.rotateX(-Math.PI / 2);
  g.scale(rx, 1, rz);
  g.translate(x, 0.14, z);
  K.H.geo(g, null, { vcol: [color, '#000000'] });
}

// ----- 奥の壁（鉄骨の柱・クレーンのランウェイ・スチールサッシの窓）-----
const SHUT = { x: 464, w: 38 };   // 搬出口のシャッター（柱 440 と 488 の間）

function buildWall(K) {
  const { b, X, R, W, BACK } = K;
  b.box(W + 80, 64, 2, C.cream, W / 2, 32, BACK - 1);
  b.box(W + 80, 16, 0.3, C.roofDk, W / 2, 56, BACK + 0.15);     // 天井より上は暗い小屋裏
  // 腰の黄土の塗装・見切り・配管。搬出口のところで切る
  for (const [x0, x1] of [[-40, SHUT.x - SHUT.w / 2 - 1.5], [SHUT.x + SHUT.w / 2 + 1.5, W + 40]]) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    b.box(w, 10, 0.4, C.ochre, cx, 5, BACK + 0.2);
    b.box(w, 0.8, 0.7, C.ochreDk, cx, 10.3, BACK + 0.35);
    X.cyl(0.5, 0.5, w, C.rust, cx, 11.7, BACK + 1.1, { rz: Math.PI / 2, seg: 8 });
    X.cyl(0.36, 0.36, w, C.steelDk, cx, 12.85, BACK + 1.0, { rz: Math.PI / 2, seg: 8 });
  }
  // 配管はシャッターの脇で上へ逃がす
  for (const s of [-1, 1]) {
    const x = SHUT.x + s * (SHUT.w / 2 + 2.6);
    X.cyl(0.5, 0.5, 26, C.rust, x, 24.2, BACK + 1.1, { seg: 8 });
  }
  // 剥げた塗装と錆の垂れ
  for (let x = -36; x < W + 40; x += 9 + R() * 16) {
    if (Math.abs(x - SHUT.x) < SHUT.w / 2 + 3) continue;
    if (R() < 0.5) b.box(1.5 + R() * 4, 0.8 + R() * 2.5, 0.04, C.creamDk, x, 1.6 + R() * 6.5, BACK + 0.42);
    else { const h = 2 + R() * 4; b.box(0.4 + R() * 0.6, h, 0.04, C.rustDk, x, 9.6 - h / 2, BACK + 0.42); }
  }
  for (const x of K.cols) column(K, x);
  b.box(W + 80, 2.4, 2.2, C.ochreDk, W / 2, 31.2, BACK + 5.6, { cast: true });   // クレーンのランウェイ
  b.box(W + 80, 0.6, 0.8, C.iron, W / 2, 32.7, BACK + 5.6);                       // レール
  for (let i = 0; i < K.cols.length - 1; i++) {
    const cx = (K.cols[i] + K.cols[i + 1]) / 2;
    if (Math.abs(cx - SHUT.x) > 1) windowBay(K, cx);
  }
  // 区画の札（ランウェイから吊る）。文字は描かず、無地の板に色の棒だけ: 不具合=赤、再試作=青、製造=緑
  for (const [x, bar] of [[186, '#a8483a'], [310, '#4f6b86'], [362, '#55704a']]) {
    for (const s of [-1, 1]) b.box(0.2, 2.2, 0.2, C.iron, x + s * 4.5, 29, BACK + 6.6);
    b.box(11, 3.8, 0.3, C.sign, x, 26, BACK + 6.6);
    b.box(8, 0.9, 0.12, bar, x, 26, BACK + 6.81);
  }
}

// H形鋼の柱。前後のフランジとウェブ、コンクリートの基礎、根元の錆、ランウェイの持ち送り
function column(K, x) {
  const { b, R, BACK } = K;
  const z = BACK + 2.2, H = 46;
  b.box(3.4, H, 0.6, C.ochre, x, H / 2, z + 1.3, { cast: true });
  b.box(3.4, H, 0.6, C.ochre, x, H / 2, z - 1.3, { cast: true });
  b.box(0.6, H, 2.0, C.ochreDk, x, H / 2, z, { cast: true });
  b.box(5.4, 1.2, 5.0, C.base, x, 0.6, z + 0.2);
  const rh = 1.5 + R() * 3;
  b.box(3.6, rh, 3.4, C.rust, x, 1.2 + rh / 2, z);
  b.box(3.2, 2.0, 4.4, C.ochreDk, x, 29, z + 2.6, { cast: true });
}

// スチールサッシの窓。網入りの曇ったガラスを1枚ずつ（汚れ・割れ・板でふさいだ跡でばらす）
function windowBay(K, cx) {
  const { b, G, R, BACK } = K;
  const w = 36, y0 = 15, y1 = 29, cols = 9, rows = 4, pw = w / cols, ph = (y1 - y0) / rows;
  const boarded = R() < 0.1;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const px = cx - w / 2 + pw * (i + 0.5), py = y0 + ph * (j + 0.5), r = R();
    if (boarded || r < 0.05) b.box(pw, ph, 0.3, C.ply, px, py, BACK + 0.25);
    else if (r < 0.09) G.box(pw, ph, 0.2, C.glassDark, px, py, BACK + 0.1);
    else G.box(pw, ph, 0.2, r < 0.5 ? C.glassDim : C.glass, px, py, BACK + 0.1);
  }
  for (let i = 0; i <= cols; i++) b.box(0.45, y1 - y0 + 0.45, 0.5, C.iron, cx - w / 2 + pw * i, (y0 + y1) / 2, BACK + 0.45);
  for (let j = 0; j <= rows; j++) b.box(w + 0.45, 0.45, 0.5, C.iron, cx, y0 + ph * j, BACK + 0.45);
  b.box(w + 2, 0.7, 1.6, C.creamDk, cx, y0 - 0.6, BACK + 0.8);                    // 窓台
  for (let k = 0; k < 4; k++) {                                                    // 窓の下の汚れの筋
    const h = 2 + R() * 3;
    b.box(0.5 + R() * 0.8, h, 0.06, C.grime, cx - w / 2 + 3 + R() * (w - 6), y0 - 1 - h / 2, BACK + 0.03);
  }
}

// ----- 天井まわり（天井の手前の梁・吊り灯・天井クレーン）-----
function buildOverhead(K) {
  const { b, W } = K;
  b.box(W + 80, 1.6, 1.2, C.ochreDk, W / 2, 45.2, 39.4);     // 天井の切り口に通す梁
  // 吊り灯。ところどころ切れていて、製造部門の1つはちらつく。どこで止まっても画面に切れた灯りが1つは入る並び
  const states = ['on', 'off', 'on', 'off', 'on', 'off', 'flicker', 'on', 'off', 'on', 'off', 'on'];
  let i = 0;
  const spots = [];
  for (let x = 22; x < W + 40; x += 56, i++) {
    lamp(K, x, -35, states[i % states.length]);
    if (states[i % states.length] === 'on') spots.push({ x, z: -35, rx: 3.6, rz: 3, y0: 3, y1: 30 });
  }
  crane(K, 212, -52, 13, null);
  crane(K, 384, -45, 11, 'die');
  // 光の中を漂う埃（灯りの円錐と、シャッターのすき間から差す光）
  dustMotes(K, [...spots, { x: SHUT.x, z: K.BACK + 8, rx: 15, rz: 5, y0: 0.8, y1: 9 }]);
}

// 埃。小さな四角を1つのメッシュにまとめ、onEvent で頂点を動かす（描画1回）
function dustMotes(K, sources) {
  const R = K.R, seeds = [];
  for (const s of sources) for (let i = 0; i < 12; i++) {
    seeds.push({ x: s.x + (R() - 0.5) * 2 * s.rx, y: s.y0 + R() * (s.y1 - s.y0), z: s.z + (R() - 0.5) * 2 * s.rz,
      ph: R() * 6.283, sp: 0.25 + R() * 0.35, r: 0.13 + R() * 0.12 });
  }
  const idx = [];
  for (let i = 0; i < seeds.length; i++) { const v = i * 4; idx.push(v, v + 1, v + 2, v, v + 2, v + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seeds.length * 12), 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: '#6a6454', transparent: true, depthWrite: false, fog: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.frustumCulled = false;   // 頂点を毎フレーム動かすので、作った時の外接球で切られないように
  addScenery(m);
  A.dust = { m, seeds };
  moveDust(0);
}

function moveDust(t) {
  const { m, seeds } = A.dust, P = m.geometry.attributes.position;
  const a = P.array;
  seeds.forEach((s, i) => {
    const x = s.x + Math.sin(t * s.sp * 0.7 + s.ph * 1.7) * 0.9;
    const y = s.y + Math.sin(t * s.sp + s.ph) * 1.4;
    const r = s.r, o = i * 12;
    a[o] = x - r; a[o + 1] = y - r; a[o + 2] = s.z;
    a[o + 3] = x + r; a[o + 4] = y - r; a[o + 5] = s.z;
    a[o + 6] = x + r; a[o + 7] = y + r; a[o + 8] = s.z;
    a[o + 9] = x - r; a[o + 10] = y + r; a[o + 11] = s.z;
  });
  P.needsUpdate = true;
}

function lamp(K, x, z, state) {
  const { b, X, G, H } = K;
  const y = 34.5;   // 笠の下端
  b.box(0.2, 46 - y - 2, 0.2, C.iron, x, (46 + y + 2) / 2, z);           // 吊りコード
  X.cyl(0.9, 3.0, 2.1, C.shade, x, y + 1.05, z, { seg: 12 });             // ほうろうの笠
  X.cyl(0.55, 0.55, 0.9, C.iron, x, y + 2.5, z, { seg: 8 });              // 口金
  // 光の円錐は淡く（後ろの掲示や機械が透けて読めるくらい）。下へ行くほど消える
  const cone = (B) => B.cyl(2.6, 5.4, y - 1.2, null, x, (y - 1.2) / 2, z, { seg: 16, open: true, grad: ['#000000', '#1a1813'] });
  if (state === 'on') {
    G.cyl(0.95, 1.25, 1.5, C.lampOn, x, y - 0.6, z, { seg: 10 });
    cone(H);
    pool(K, x, z, 6.5, 4.5, '#17150f');
  } else if (state === 'off') {
    X.cyl(0.95, 1.25, 1.5, C.lampOff, x, y - 0.6, z, { seg: 10 });
  } else {
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 1.5, 10), new THREE.MeshBasicMaterial({ color: C.lampOff }));
    bulb.position.set(x, y - 0.6, z);
    addScenery(bulb);
    const hb = batch(haze, true);
    cone(hb);
    const [c] = hb.done();
    c.visible = false;
    A.flick = { bulb, cone: c };
  }
}

// 天井クレーン。桁は奥のランウェイから天井の切り口（z=40）まで y≥40 で渡す。
// 天井に隠れて見えるのは手前の端と、奥ゾーンに下りているフックだけ。
function crane(K, x, hz, len, load) {
  const { b, BACK } = K;
  const z0 = BACK + 3.6, z1 = 40, zc = (z0 + z1) / 2, L = z1 - z0;
  b.box(4.4, 4.0, L, C.ochre, x, 42.5, zc);
  b.box(5.4, 0.6, L, C.ochreDk, x, 40.3, zc);
  for (let i = 0; i < 4; i++) b.box(1.1, 4.0, 0.12, i % 2 ? C.black : C.line, x - 1.65 + i * 1.1, 42.5, z1 + 0.06);   // 端の虎縞
  b.box(8, 7.6, 4, C.ochreDk, x, 36.8, BACK + 5.6, { cast: true });   // サドル（ランウェイに乗る）
  // トロリーは天井の陰で見えないので置かない。ワイヤとペンダントスイッチだけ下りてくる
  b.box(0.16, 28, 0.16, C.iron, x + 2.4, 26, hz - 2.6);                // ペンダントスイッチ
  b.box(1.6, 3.2, 1.3, '#b39d55', x + 2.4, 10.4, hz - 2.6);
  // フック（揺れる）。原点＝トロリーの下の吊り元
  const hk = batch(lit, true);
  hk.box(0.24, len, 0.24, C.iron, -0.55, -len / 2, 0);
  hk.box(0.24, len, 0.24, C.iron, 0.55, -len / 2, 0);
  const y = -len;
  hk.box(3.4, 3.8, 2.2, C.ochre, 0, y - 1.9, 0);                 // フックブロック
  hk.box(0.6, 3.8, 0.12, C.black, -0.9, y - 1.9, 1.16);
  hk.box(0.6, 3.8, 0.12, C.black, 0.9, y - 1.9, 1.16);
  hk.box(1.0, 1.4, 1.0, C.steelDk, 0, y - 4.5, 0);
  hk.box(0.9, 2.8, 0.9, C.iron, 0, y - 6.6, 0);
  hk.box(3.0, 0.9, 0.9, C.iron, 1.05, y - 8.0, 0);
  hk.box(0.9, 1.7, 0.9, C.iron, 2.1, y - 7.2, 0);
  if (load === 'die') {   // 2本吊りの鎖で金型を吊っている
    rod(hk, 0.8, y - 7.7, 0, -3.4, y - 14.2, 0, 0.3, C.iron);
    rod(hk, 0.8, y - 7.7, 0, 4.8, y - 14.2, 0, 0.3, C.iron);
    hk.box(10, 3.2, 6, C.steelDk, 0.7, y - 15.8, 0);
    hk.box(10.2, 0.6, 6.2, C.rust, 0.7, y - 14.3, 0);
  }
  const [m] = hk.done();
  m.position.set(x, 40, hz);
  A.hooks.push({ m, a: load ? 0.012 : 0.028, w: 0.8 + K.R() * 0.4, ph: K.R() * 6 });
}

// ----- 現場事務所（区間の左端。待合室から出てきた扉）-----
function buildOffice(K) {
  const { b, X, G, BACK } = K;
  const x0 = 30, x1 = 126, zf = -46, h = 24, dx0 = 110;
  const cx = (x0 + x1) / 2, zc = (zf - 1 + BACK) / 2, d = zf - 1 - BACK;
  b.box(1, h, d, C.cream, x0 + 0.5, h / 2, zc, { cast: true });                       // 側壁
  b.box(1, h, d, C.cream, x1 - 0.5, h / 2, zc, { cast: true });
  b.box(x1 - x0 + 1.2, 0.9, zf - BACK + 0.6, C.creamDk, cx, h + 0.45, (zf + BACK) / 2 + 0.3, { cast: true });   // 屋根
  b.box(x1 - x0 + 1.4, 1.2, 0.5, C.ochreDk, cx, h + 0.4, zf + 0.6);                   // 鼻隠し（屋根より少し高く）
  // 正面の窓（明かりの点いた室内にブラインド）
  const wc = (x0 + dx0) / 2, ww = dx0 - x0;
  b.box(ww, 8, 1, C.ochrePale, wc, 4, zf - 0.5, { cast: true });
  b.box(ww, h - 18, 1, C.cream, wc, (18 + h) / 2, zf - 0.5, { cast: true });
  G.box(ww, 10, 0.2, C.office, wc, 13, zf - 0.8);
  const nW = 4, pw = ww / nW;
  for (let i = 0; i <= nW; i++) b.box(0.8, 10, 0.7, C.ochreDk, x0 + i * pw, 13, zf - 0.3);
  b.box(ww, 0.6, 0.9, C.ochreDk, wc, 8.2, zf - 0.2);
  [0.8, 0.35, 1.0, 0.5].forEach((down, i) => {
    for (let k = 0; k < Math.round(down * 10); k++) b.box(pw - 0.8, 0.32, 0.12, C.blind, x0 + (i + 0.5) * pw, 17.6 - k * 0.95, zf - 0.6);
  });
  // 扉のある壁と、内開きに開いた扉（奥は暗い廊下）
  const dc = (dx0 + x1) / 2, dw = 7;
  b.box(dc - dw / 2 - dx0, h, 1, C.cream, (dx0 + dc - dw / 2) / 2, h / 2, zf - 0.5, { cast: true });
  b.box(x1 - dc - dw / 2, h, 1, C.cream, (dc + dw / 2 + x1) / 2, h / 2, zf - 0.5, { cast: true });
  b.box(dw, h - 13.5, 1, C.cream, dc, (13.5 + h) / 2, zf - 0.5, { cast: true });
  b.box(dw, 13.5, 0.4, C.dark, dc, 6.75, zf - 3);
  b.box(dw + 1.2, 0.8, 1.3, C.ochreDk, dc, 13.9, zf - 0.35);
  for (const s of [-1, 1]) b.box(0.6, 13.5, 1.3, C.ochreDk, dc + s * (dw / 2 + 0.3), 6.75, zf - 0.35);
  const ang = 1.1, lw = dw - 0.3;
  b.box(lw, 13, 0.4, C.woodDk, dc - dw / 2 + Math.cos(ang) * lw / 2, 6.6, zf - 1 - Math.sin(ang) * lw / 2, { rotY: ang });
  b.box(8, 2.2, 0.3, C.sign, dc, 17, zf + 0.15);                    // 無地の室名札＋色の棒
  b.box(5.6, 0.6, 0.12, '#4f6b86', dc, 17, zf + 0.36);
  // 壁の時計（止まっている）
  X.cyl(2.5, 2.5, 0.3, C.iron, 70, 21, zf + 0.15, { rx: Math.PI / 2, seg: 16 });
  X.cyl(2.2, 2.2, 0.4, C.paper, 70, 21, zf + 0.2, { rx: Math.PI / 2, seg: 16 });
  b.box(0.3, 1.5, 0.1, C.iron, 70, 21.7, zf + 0.45);
  X.box(0.22, 1.9, 0.1, C.iron, 70.6, 20.4, zf + 0.45, { rz: 2.2 });
  // 屋根の上の物置（段ボール・丸めた図面）
  b.box(9, 4, 7, C.card, 44, h + 2.9, -58, { cast: true });
  b.box(7, 3, 6, C.cardDk, 45, h + 6.4, -58.5, { rotY: 0.2, cast: true });
  b.box(10, 3.5, 7, C.cardDk, 92, h + 2.65, -60, { cast: true });
  for (let i = 0; i < 4; i++) X.cyl(0.45, 0.45, 9, C.paper, 66, h + 1.35 + i * 0.05, -56 - i * 1.0, { rz: Math.PI / 2, seg: 8 });
  // 事務所の前: 長椅子と消火器
  b.box(16, 0.8, 4, C.wood, 64, 4.2, -41, { cast: true });
  for (const s of [-1, 1]) b.box(0.8, 3.8, 3.4, C.steelDk, 64 + s * 7, 1.9, -41);
  X.cyl(1.0, 1.0, 4.8, C.tag, 103, 2.4, -43.5, { seg: 10 });
  b.box(0.8, 0.8, 0.8, C.iron, 103, 5.2, -43.5);
}

// ----- 不具合説明（作業台・貼り出し板・試験台）-----
function buildDefect(K) {
  const { b, X, G, R } = K;
  // 壁ぎわの低い棚（窓の下）
  shelf(K, 139, -67.2, 20, 12.5);
  shelf(K, 176, -67.2, 40, 12.5);
  shelf(K, 224, -67.2, 40, 12.5);
  b.box(4, 6, 2.2, C.machDk, 152, 14, -66.2);                        // 柱の分電盤
  b.box(3, 1.4, 0.2, '#3d423b', 152, 15.4, -65.0);
  // 作業台1: 蓋の開いた試作品と部品・書類
  bench(K, 168, -37, 26, 10);
  protoOpen(K, 160.5, 8.6, -37.5, 0.18, { tag: true });
  partsTray(K, 169.5, 8.6, -35.8);
  papers(K, 176, 8.6, -38.8, 7, 0.1);
  papers(K, 176.4, 8.6, -35.2, 3, -0.3);
  b.box(3.2, 2.4, 2.6, C.iron, 180, 9.8, -34.6);                     // 万力
  b.box(1.2, 0.6, 3.6, C.steel, 180, 11.3, -34.6);
  binders(K, 154.5, 8.6, -41, 6);
  // 不具合を貼り出した板（文字なし。写真の代わりの灰色と、赤い印）
  board(K, 196, -47);
  // 作業台2: 分解した試作品。部品を並べ、図面を広げる
  bench(K, 224, -37, 26, 10);
  {
    const put = placer(X, 215.5, 8.6, -37.6, 0, -0.12, 0);
    put(PU.w, PU.h - 1.2, PU.d, C.proto, 0, (PU.h - 1.2) / 2, 0);         // 外した筐体（下半分）
    put(PU.w - 0.5, 0.06, PU.d - 0.5, C.protoDk, 0, PU.h - 1.17, 0);
    put(PU.w + 0.12, 0.3, PU.d + 0.12, C.protoLt, 3.0, 0.15 + 2.6, -1.4, { lx: -1.25, lz: 0.1 });   // 立てかけた蓋
    put.rod(-2.2, 2.6, -1.2, -2.7, 4.6, 0.6, 0.2, '#b8402e');
    put.rod(-1.6, 2.6, -1.0, -0.9, 5.0, -0.2, 0.2, '#d8c25a');
  }
  drawing(K, 226.5, 8.62, -37.8, 0.08);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {           // 並べた部品（ねじ・板・ブロック）
    const col = ['#8f9a9b', C.iron, '#9a6232', C.steelDk][(i + j) % 4];
    b.box(1.0 + (j % 2) * 0.6, 0.5 + (i % 2) * 0.4, 1.0, col, 230 + i * 1.9, 9.05 + (i % 2) * 0.2, -35.4 + j * 1.6);
  }
  papers(K, 234.5, 8.6, -39.6, 5, 0.25);
  // 試験台（作っては壊れる）
  testStand(K, 246, -38);
  // 足もとの段ボールと、捨てられた部品
  b.box(6, 4.2, 5, C.card, 190, 2.1, -36, { rotY: 0.15 });
  b.box(5, 3.0, 4.4, C.cardDk, 190.4, 5.7, -36.2, { rotY: -0.1 });
  proto(X, 203.5, 0, -39, { ry: -0.5, rz: 0.06, tag: true });
  stain(K, 247, -31.5, 2.2, 1.4);
  stain(K, 166, -30.5, 1.4, 1.6);
  for (let i = 0; i < 6; i++) b.box(0.6 + R() * 0.8, 0.3, 0.6 + R() * 0.6, C.steelDk, 236 + R() * 8, 0.15, -33 + R() * 3);   // 落ちたねじ
}

function bench(K, x, z, w = 26, d = 10, top = 8.6) {
  const { b } = K;
  b.box(w, 0.9, d, C.wood, x, top - 0.45, z, { cast: true });
  b.box(w - 0.6, 0.6, d - 0.6, C.steelDk, x, top - 1.2, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(0.9, top - 1.5, 0.9, C.steelDk, x + sx * (w / 2 - 0.9), (top - 1.5) / 2, z + sz * (d / 2 - 0.9), { cast: true });
  }
  b.box(w - 2, 0.5, d - 2, C.steelDk, x, 2.2, z);
  b.box(w - 4, 1.6, d - 3, C.cardDk, x - 1, 3.25, z - 0.5);   // 下段の箱
}

// 試作品。同じ物を作り直しているので、どこに置いても同じ形（灰青の箱・濃い操作面・メーターの小窓・つまみ）
function proto(B, x, y, z, o = {}) {
  const { w, h, d } = PU;
  const put = placer(B, x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, { cast: !!o.cast });
  put(w, h, d, o.dust ? C.protoDust : C.proto, 0, h / 2, 0);
  put(w + 0.12, 0.3, d + 0.12, o.dust ? '#a3a7a1' : C.protoLt, 0, h - 0.1, 0);
  if (o.front === false) return;
  put(w - 1.0, h - 1.3, 0.2, C.protoDk, 0, h * 0.47, d / 2 + 0.1);
  put(1.7, 1.0, 0.14, C.protoGauge, -1.3, h * 0.62, d / 2 + 0.25);
  put(0.6, 0.6, 0.36, C.black, 0.9, h * 0.38, d / 2 + 0.3);
  put(0.6, 0.6, 0.36, C.black, 1.8, h * 0.38, d / 2 + 0.3);
  if (o.tag) {   // 赤い不良札
    put(1.0, 1.5, 0.12, C.tag, -w / 2 + 0.9, h * 0.3, d / 2 + 0.42);
    put(0.12, 0.7, 0.1, C.tagLt, -w / 2 + 0.9, h * 0.3 + 1.05, d / 2 + 0.33);
  }
}

// 蓋を開けて中を見せている試作品。中に基板・コイル・はみ出した配線
function protoOpen(K, x, y, z, ry = 0, o = {}) {
  const { w, h, d } = PU;
  const put = placer(K.X, x, y, z, 0, ry, 0);
  const lo = h - 1.0;
  put(w, lo, d, C.proto, 0, lo / 2, 0);
  put(w, 1.0, 0.24, C.proto, 0, lo + 0.5, d / 2 - 0.12);
  put(w, 1.0, 0.24, C.proto, 0, lo + 0.5, -d / 2 + 0.12);
  put(0.24, 1.0, d - 0.48, C.proto, -w / 2 + 0.12, lo + 0.5, 0);
  put(0.24, 1.0, d - 0.48, C.proto, w / 2 - 0.12, lo + 0.5, 0);
  put(w - 0.5, 0.06, d - 0.5, C.protoDk, 0, lo + 0.03, 0);
  put(2.4, 2.2, 0.18, '#3e6b4a', -1.1, lo + 1.0, -0.8);                    // 基板
  put(0.6, 0.35, 0.22, '#c9b46a', -1.6, lo + 1.5, -0.66);
  put.cyl(0.85, 0.85, 1.5, '#9a6232', 1.3, lo + 0.75, 0.4, { seg: 10 });  // コイル
  put(1.4, 1.1, 1.2, C.black, 1.5, lo + 0.55, -1.3);                       // トランス
  put.rod(0.2, lo + 0.4, 0.2, -0.8, lo + 2.4, 1.6, 0.18, '#b8402e');      // はみ出した配線
  put.rod(0.6, lo + 0.4, -0.2, 1.4, lo + 2.1, 1.9, 0.18, '#d8c25a');
  put.rod(-0.4, lo + 0.4, 0.6, -2.4, lo + 1.6, 2.2, 0.18, C.iron);
  put(w - 1.0, lo - 1.0, 0.2, C.protoDk, 0, lo * 0.5, d / 2 + 0.1);
  put(1.7, 1.0, 0.14, C.protoGauge, -1.3, lo * 0.68, d / 2 + 0.25);
  // 蓋。後ろの縁を蝶番にして、立ち上がって少し後ろへ倒れている
  const th = -(Math.PI / 2 + 0.28), ld = d + 0.12;
  const cy = 0.15 * Math.cos(th) - (ld / 2) * Math.sin(th), cz = 0.15 * Math.sin(th) + (ld / 2) * Math.cos(th);
  put(w + 0.12, 0.3, ld, C.protoLt, 0, h + cy, -d / 2 + cz, { lx: th });
  if (o.tag) {
    put(1.0, 1.5, 0.12, C.tag, -w / 2 + 0.9, lo * 0.32, d / 2 + 0.42);
    put(0.12, 0.7, 0.1, C.tagLt, -w / 2 + 0.9, lo * 0.32 + 1.05, d / 2 + 0.33);
  }
}

function partsTray(K, x, y, z) {
  const { b, R } = K;
  b.box(6, 0.8, 4, C.steelDk, x, y + 0.4, z);
  b.box(5.4, 0.1, 3.4, C.iron, x, y + 0.82, z);
  for (let i = 0; i < 7; i++) b.box(0.5 + R() * 0.5, 0.3, 0.5 + R() * 0.4, ['#a9a79c', '#9a6232', C.steel][i % 3], x - 2.2 + R() * 4.4, y + 1.0, z - 1.2 + R() * 2.4);
}

function papers(K, x, y, z, n, ry = 0) {
  const { b, R } = K;
  for (let i = 0; i < n; i++) {
    b.box(4.2, 0.22, 3.0, i % 3 === 2 ? C.print : C.paper, x + (R() - 0.5) * 0.5, y + 0.11 + i * 0.24, z + (R() - 0.5) * 0.4,
      { rotY: ry + (R() - 0.5) * 0.18 });
  }
}

// 広げた図面（青焼き）。線は部品の輪郭だけ（文字は描かない）
function drawing(K, x, y, z, ry) {
  const put = placer(K.X, x, y, z, 0, ry, 0);
  put(9, 0.06, 6.2, C.print, 0, 0, 0);
  put(5, 0.04, 0.14, C.ink, -0.6, 0.05, -1.2);
  put(5, 0.04, 0.14, C.ink, -0.6, 0.05, 1.4);
  put(0.14, 0.04, 2.6, C.ink, -3.1, 0.05, 0.1);
  put(0.14, 0.04, 2.6, C.ink, 1.9, 0.05, 0.1);
  put(2.2, 0.04, 0.14, C.ink, 2.8, 0.05, -2.2);
  put(1.2, 0.04, 1.2, C.tag, 1.0, 0.06, 0.6);    // 赤で囲った所
  put(0.9, 0.05, 0.9, C.print, 1.0, 0.07, 0.6);
}

// バインダーの列。端の1冊は倒れかけている
function binders(K, x, y, z, n) {
  const { b, X, R } = K;
  for (let i = 0; i < n; i++) b.box(0.75, 3.0, 3.2, BINDER[Math.floor(R() * BINDER.length)], x + i * 0.82, y + 1.5, z);
  X.box(0.75, 3.0, 3.2, BINDER[2], x + n * 0.82 + 0.55, y + 1.42, z, { rz: -0.35 });
}

// スチール棚。段ごとに段ボール・バインダー・書類・部品を詰める
function shelf(K, x, z, w, h) {
  const { b, R } = K;
  const d = 5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.5, h, 0.5, C.steelDk, x + sx * (w / 2 - 0.25), h / 2, z + sz * (d / 2 - 0.25));
  const n = Math.max(2, Math.round(h / 4.3)), step = (h - 0.9) / n, room = step - 0.5;
  for (let i = 0; i <= n; i++) {
    const y = 0.6 + i * step;
    b.box(w, 0.3, d, C.steel, x, y, z);
    if (i === n) break;
    const end = x + w / 2 - 0.4;
    for (let px = x - w / 2 + 0.7; px < end;) {
      const r = R();
      if (r < 0.3) {
        const bw = 3 + R() * 3, bh = Math.min(room, 2.2 + R() * 1.2);
        if (px + bw > end) break;
        b.box(bw, bh, d - 1, R() < 0.5 ? C.card : C.cardDk, px + bw / 2, y + 0.15 + bh / 2, z);
        px += bw + 0.3;
      } else if (r < 0.58) {
        const nb = 3 + Math.floor(R() * 5), bh = Math.min(room, 3.0);
        if (px + nb * 0.8 > end) break;
        for (let k = 0; k < nb; k++) b.box(0.75, bh, 3.2, BINDER[Math.floor(R() * BINDER.length)], px + 0.4 + k * 0.8, y + 0.15 + bh / 2, z + 0.6);
        px += nb * 0.8 + 0.4;
      } else if (r < 0.78) {
        const ph = 0.6 + R() * Math.min(room - 0.6, 1.8);
        if (px + 4 > end) break;
        b.box(4, ph, 3.2, C.paper, px + 2, y + 0.15 + ph / 2, z + 0.4);
        px += 4.4;
      } else if (r < 0.9) {
        if (px + 3.4 > end) break;
        b.box(3.4, 1.6, 2.8, C.proto, px + 1.7, y + 0.95, z);
        px += 3.8;
      } else px += 1.5 + R() * 2;
    }
  }
}

// 不具合を貼り出した板（キャスター付きの掲示板）。紙は無地、写真の代わりの灰色と赤い印だけ
function board(K, x, z) {
  const { b } = K;
  for (const s of [-1, 1]) {
    b.box(0.7, 22, 0.7, C.steelDk, x + s * 10.6, 11, z, { cast: true });
    b.box(0.7, 0.6, 6, C.steelDk, x + s * 10.6, 0.3, z);
  }
  b.box(22.4, 13.4, 0.6, C.ochreDk, x, 15, z + 0.4, { cast: true });
  b.box(21.2, 12.2, 0.3, C.board, x, 15, z + 0.75);
  [[-7, 18.2], [0, 18.6], [7, 18], [-6.5, 11.8], [0.5, 12], [7.2, 11.6]].forEach(([dx, dy], i) => {
    b.box(5.2, 4.6, 0.08, C.paper, x + dx, dy, z + 0.94);
    if (i % 2 === 0) b.box(2.6, 1.8, 0.06, '#7d847f', x + dx - 0.7, dy + 0.3, z + 1.01);
    b.box(1.1, 1.1, 0.06, C.tag, x + dx + 1.5, dy - 0.9, z + 1.01);
  });
  b.box(17, 0.5, 0.08, C.tag, x, 21.0, z + 0.96);
}

// 試験台。試作品を載せ、古い測定器のラックとケーブルでつないである。
// ときどき火花が出て蓋が跳ね、煙が上がる（onEvent）。状態灯は 試験中=黄の点滅 → 壊れた=赤 → 作り直し=消灯
function testStand(K, x, z) {
  const { b, X, G } = K;
  const top = 8.4, { w, h, d } = PU, bh = h - 0.3;
  b.box(14, 0.8, 8, C.steel, x, top - 0.4, z, { cast: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.8, top - 0.8, 0.8, C.steelDk, x + sx * 6.2, (top - 0.8) / 2, z + sz * 3.2, { cast: true });
  b.box(12.4, 0.5, 6.4, C.steelDk, x, 2, z);
  b.box(w, bh, d, C.proto, x, top + bh / 2, z, { cast: true });
  b.box(w - 1.0, h - 1.3, 0.2, C.protoDk, x, top + h * 0.47, z + d / 2 + 0.1);
  b.box(1.7, 1.0, 0.14, C.protoGauge, x - 1.3, top + h * 0.62, z + d / 2 + 0.25);
  b.box(2.2, 1.3, 0.06, '#2a2622', x + 1.4, top + h - 1.2, z + d / 2 + 0.24);    // 焦げ跡
  // 測定器のラック
  const rx = x + 12.5, rz = z - 5;
  b.box(8, 19, 7, C.machDk, rx, 9.5, rz, { cast: true });
  b.box(8.2, 0.6, 7.2, C.mach, rx, 19.3, rz);
  for (const [yy, hh] of [[15.5, 4.2], [10.6, 4], [5.6, 4.2]]) b.box(7.2, hh, 0.2, '#3d423b', rx, yy, rz + 3.6);
  G.box(3.0, 2.2, 0.1, '#7fc79a', rx - 1.6, 15.6, rz + 3.75);     // ブラウン管
  G.box(0.5, 0.5, 0.1, '#e8b04a', rx + 2.2, 16.4, rz + 3.75);
  G.box(0.5, 0.5, 0.1, '#9fd27a', rx + 2.2, 15.0, rz + 3.75);
  G.box(2.6, 0.8, 0.1, '#e9a24a', rx - 1.0, 10.8, rz + 3.75);     // 数字の窓（数字は描かない）
  for (let i = 0; i < 4; i++) b.box(0.7, 0.7, 0.3, C.black, rx - 2.4 + i * 1.6, 6.2, rz + 3.8);
  // ケーブル（たるませる）
  rod(X, rx - 3.6, 12.5, rz + 2.2, x + 5.6, 7.4, z - 2.6, 0.28, C.iron);
  rod(X, x + 5.6, 7.4, z - 2.6, x + 2.2, top + 2.2, z - d / 2, 0.28, C.iron);
  rod(X, rx - 3.6, 8.5, rz + 2.6, x + 6.8, 6.0, z - 1.0, 0.24, '#7a3a2a');
  rod(X, x + 6.8, 6.0, z - 1.0, x + w / 2, top + 1.2, z + 0.6, 0.24, '#7a3a2a');
  // 動く物
  const lidGeo = new THREE.BoxGeometry(w + 0.12, 0.3, d + 0.12);
  lidGeo.translate(0, 0.15, (d + 0.12) / 2);                       // 原点＝後ろの縁（蝶番）
  const lid = new THREE.Mesh(lidGeo, new THREE.MeshLambertMaterial({ color: C.protoLt }));
  lid.position.set(x, top + bh, z - (d + 0.12) / 2);
  lid.receiveShadow = true;
  addScenery(lid);
  const sb = batch(glow, true);
  sb.box(3.4, 0.16, 0.16, '#fff3c0', 0, 0, 0);
  sb.box(0.16, 3.4, 0.16, '#fff3c0', 0, 0, 0);
  sb.box(0.16, 0.16, 3.2, '#ffd36a', 0, 0, 0);
  sb.box(2.4, 0.16, 0.16, '#ffd36a', 0, 0, 0, { rz: 0.8 });
  sb.box(2.4, 0.16, 0.16, '#ffe9a0', 0, 0, 0, { rz: -0.7, ry: 0.6 });
  const [spark] = sb.done();
  spark.position.set(x + 1.4, top + h + 0.5, z + 0.9);
  spark.visible = false;
  const smoke = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8),
      new THREE.MeshLambertMaterial({ color: '#8a857a', transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    addScenery(m);
    return m;
  });
  b.box(0.4, 1.8, 0.4, C.iron, rx + 2.4, 20.5, rz + 1);
  const lampM = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshBasicMaterial({ color: C.lampOff }));
  lampM.position.set(rx + 2.4, 22.0, rz + 1);
  addScenery(lampM);
  A.test = { lid, spark, smoke, lamp: lampM, x, y: top + h, z, ph: 1.7 };
}

// ----- 再試作（同じ試作品の山）-----
function buildRework(K) {
  const { b, X, R } = K;
  // 壁ぎわ: 前の作り直しの山（埃をかぶっている）と、シートをかけた山
  stack(K, 261, -62, 5, { dust: true });
  stack(K, 279, -62, 4, { dust: true });
  tarpStack(K, 298, -62.5, 16);
  stack(K, 317, -62, 5, { dust: true });
  stack(K, 335, -62, 3, { dust: true });
  // その手前: 今回作り直した同じ試作品の山（赤札まじり）
  stack(K, 271, -50, 4, { tags: 0.2 });
  stack(K, 289, -50, 3, { tags: 0.3 });
  stack(K, 307, -50, 5, { tags: 0.15 });
  stack(K, 325, -50, 3, { tags: 0.4 });
  // 作業台（また組み直している）
  bench(K, 278, -37, 24, 10);
  protoOpen(K, 272.5, 8.6, -37.4, -0.08);
  proto(X, 280.5, 8.6, -37.6, { ry: 0.05 });
  papers(K, 286.6, 8.6, -39, 9, -0.15);
  partsTray(K, 286.2, 8.6, -34.8);
  // 床に置いた不良品（赤札の列）
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    proto(X, 297.6 + i * 6.5 + (R() - 0.5) * 0.6, 0, -40.2 + j * 5.0 + (R() - 0.5) * 0.4,
      { ry: (R() - 0.5) * 0.16, tag: j === 1, front: j === 1, cast: true });
  }
  proto(X, 301, PU.h + 0.05, -37.6, { ry: 0.35, rz: 0.04, tag: true, cast: true });
  // スクラップのかご
  cage(K, 328, -38);
  stain(K, 304, -31.2, 1.8, 1.5, true);
}

function pallet(K, x, z, w = 14, d = 11, y0 = 0, cast = true) {
  const { b } = K;
  b.box(w, 0.5, d, C.wood, x, y0 + 1.15, z, { cast });
  for (const dz of [-d / 2 + 0.8, 0, d / 2 - 0.8]) b.box(w, 0.9, 1.4, C.woodDk, x, y0 + 0.45, z + dz, { cast });
}

// パレットに積んだ試作品（2×2 を layers 段）。前の列だけ操作面を作る（後ろは見えない）
function stack(K, x, z, layers, o = {}) {
  const { X, R } = K;
  pallet(K, x, z);
  let y = 1.4;
  for (let L = 0; L < layers; L++) {
    for (const dx of [-3.1, 3.1]) for (const dz of [-2.4, 2.4]) {
      const front = dz > 0;
      proto(X, x + dx + (R() - 0.5) * 0.4, y, z + dz + (R() - 0.5) * 0.3,
        { ry: (R() - 0.5) * 0.06, cast: true, dust: o.dust, front, tag: front && R() < (o.tags || 0) });
    }
    y += PU.h + 0.05;
  }
}

// シートをかけた古い山
function tarpStack(K, x, z, H) {
  const { b } = K;
  pallet(K, x, z);
  b.box(14.6, H - 1.6, 11.6, C.tarp, x, 1.6 + (H - 1.6) / 2, z, { cast: true });
  b.box(15.0, 1.4, 12.0, C.tarpDk, x, 2.4, z);
  for (const dx of [-3.5, 3.5]) b.box(0.3, 0.3, 11.9, C.black, x + dx, H + 0.05, z);
  for (const dx of [-5.2, -1.4, 2.6, 5.8]) b.box(0.25, H - 4.5, 0.2, C.tarpDk, x + dx, 3.2 + (H - 4.5) / 2, z + 5.85);
}

// 網のスクラップかご。壊れた試作品を投げ込んである
function cage(K, x, z) {
  const { b, X } = K;
  const w = 14, d = 10, h = 9;
  b.box(w, 0.6, d, C.steelDk, x, 0.8, z, { cast: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.6, h, 0.6, C.steelDk, x + sx * w / 2, h / 2, z + sz * d / 2, { cast: true });
  for (let i = -w / 2 + 1.4; i < w / 2 - 0.5; i += 1.4) b.box(0.22, h - 1.1, 0.22, C.steel, x + i, 1.1 + (h - 1.1) / 2, z + d / 2);
  for (let y = 2.4; y < h; y += 1.6) b.box(w, 0.22, 0.22, C.steel, x, y, z + d / 2);
  for (const sx of [-1, 1]) {
    for (let i = -d / 2 + 1.4; i < d / 2 - 0.5; i += 1.4) b.box(0.22, h - 1.1, 0.22, C.steel, x + sx * w / 2, 1.1 + (h - 1.1) / 2, z + i);
    for (let y = 2.4; y < h; y += 1.6) b.box(0.22, 0.22, d, C.steel, x + sx * w / 2, y, z);
  }
  b.box(w + 0.6, 0.5, 0.5, C.steelDk, x, h, z + d / 2);
  b.box(w + 0.6, 0.5, 0.5, C.steelDk, x, h, z - d / 2);
  b.box(w, h - 1.1, 0.3, C.steel, x, 1.1 + (h - 1.1) / 2, z - d / 2);   // 奥の面は板
  proto(X, x - 3, 1.1, z - 1.5, { rx: 0.22, ry: 0.6, rz: -0.32, cast: true });
  proto(X, x + 3, 1.1, z + 1.2, { rx: -0.2, ry: -0.4, rz: 0.45, tag: true, cast: true });
  proto(X, x - 0.5, 4.8, z, { rx: 0.5, ry: 1.2, rz: 0.2, cast: true });
  X.box(4, 0.3, 3, C.protoLt, x + 2.5, 6.6, z - 1, { rx: 0.7, rz: 0.3 });   // 外れた蓋
  rod(X, x - 4, 5.5, z + 1, x - 1.5, 8.5, z + 3, 0.2, '#b8402e');
}

// ----- 製造部門（古い工作機械）-----
function buildMachines(K) {
  const { b, X, R } = K;
  shelf(K, 368, -67.2, 40, 12.5);
  lathe(K, 357, -50);
  mill(K, 386, -51);
  press(K, 410, -58);
  drill(K, 433, -45);
  grinder(K, 344, -36);
  // 工具箱（低い）
  b.box(10, 6, 5, C.mach, 366, 3, -36, { cast: true });
  for (let i = 0; i < 4; i++) b.box(9, 0.2, 0.1, C.machDk, 366, 1.2 + i * 1.3, -33.45);
  b.box(10.2, 0.4, 5.2, C.machLt, 366, 6.2, -36);
  b.box(3, 1.2, 2, C.tag, 363, 7.0, -36);                         // 工具（赤い柄）
  b.box(2.6, 1.0, 1.6, C.steel, 368.6, 6.9, -36.6);
  drum(K, 392, -37.2, true); drum(K, 398.4, -35.4, true);
  // 機械のまわりの油と虎縞
  for (const [x, z, r, sx] of [[350, -43.5, 3.2, 2.0], [362, -44.6, 2.4, 1.6], [384, -43.2, 2.2, 1.4], [412, -48.5, 3.4, 2.2], [431, -39.5, 1.8, 1.3]]) stain(K, x, z, r, sx, R() < 0.5);
  for (let i = 0; i < 18; i++) b.box(1.6, 0.06, 1.1, i % 2 ? C.black : C.line, 397 + i * 1.65, 0.05, -49.6);
}

function lathe(K, x, z) {
  const { b, X } = K;
  const L = 32, zb = z - 0.5;
  b.box(6, 9, 7, C.machDk, x - L / 2 + 4, 4.5, z, { cast: true });
  b.box(6, 9, 7, C.machDk, x + L / 2 - 4, 4.5, z, { cast: true });
  b.box(L - 2, 0.8, 8, C.steelDk, x, 9.3, z + 0.5, { cast: true });         // 切粉受け
  b.box(L, 3, 5, C.mach, x, 11.2, zb, { cast: true });                       // ベッド
  b.box(L - 8, 0.3, 5.2, C.steel, x + 3, 12.85, zb);                         // 摺動面（地金が出ている）
  b.box(9, 9, 7, C.mach, x - L / 2 + 4.5, 17.2, zb, { cast: true });         // 主軸台
  b.box(9.2, 0.6, 7.2, C.machLt, x - L / 2 + 4.5, 21.9, zb);
  b.box(2.5, 1.8, 0.4, C.machDk, x - L / 2 + 3, 18.6, zb + 3.7);            // 変速レバーの台
  rod(X, x - L / 2 + 3, 18.6, zb + 3.8, x - L / 2 + 2.2, 21.2, zb + 5.0, 0.35, C.iron);
  X.cyl(2.6, 2.6, 2.4, C.steel, x - L / 2 + 10.2, 17, zb, { rz: Math.PI / 2, seg: 10, cast: true });   // チャック
  X.cyl(0.9, 0.9, 13, C.steelDk, x + 1.5, 17, zb, { rz: Math.PI / 2, seg: 8 });                      // 削りかけの丸棒
  b.box(4.5, 6, 5, C.mach, x + L / 2 - 4, 16, zb, { cast: true });          // 心押し台
  X.cyl(0.8, 0.8, 4, C.steel, x + L / 2 - 7.5, 17, zb, { rz: Math.PI / 2, seg: 8 });
  b.box(6, 3.4, 7.5, C.machDk, x + 2, 14.6, z + 0.2, { cast: true });       // 往復台
  b.box(2.4, 1.6, 2.4, C.iron, x + 2, 17.1, z + 0.5);
  b.box(L - 4, 0.4, 0.4, C.steel, x, 10.2, z + 3.2);                         // 送り軸
  X.cyl(1.3, 1.3, 0.4, C.iron, x + 2, 14.4, z + 4.15, { rx: Math.PI / 2, seg: 10 });
  b.box(3.4, 2.2, 0.15, C.rust, x + L / 2 - 4, 3.8, z + 3.55);              // 脚の錆
  b.box(2.2, 3.6, 0.15, C.rust, x - L / 2 + 2.8, 2.6, z + 3.55);
}

function mill(K, x, z) {
  const { b, X } = K;
  b.box(10, 1, 12, C.machDk, x, 0.5, z, { cast: true });
  b.box(8, 24, 8, C.machCream, x, 13, z - 2, { cast: true });                // コラム
  b.box(8.5, 6, 7, C.machCream, x, 9, z + 3.5, { cast: true });              // ニー
  b.box(18, 1.4, 5.5, C.steel, x, 12.7, z + 4.5, { cast: true });            // テーブル
  b.box(5, 4, 13, C.machCream, x, 27, z + 0.5, { cast: true });              // ラム
  b.box(4.5, 7, 4.5, C.machCream, x, 22.6, z + 5.2, { cast: true });         // 主軸頭
  X.cyl(0.6, 0.6, 3.2, C.steel, x, 17.5, z + 5.2, { seg: 8 });
  X.cyl(1.1, 1.1, 0.4, C.iron, x + 9.4, 12.7, z + 4.5, { rz: Math.PI / 2, seg: 10 });   // ハンドル
  b.box(9, 0.3, 0.1, C.machDk, x, 11, z + 7.05);
  b.box(3.2, 2.4, 0.15, C.rust, x - 2.2, 7.5, z + 7.05);
  b.box(4, 3, 3, C.card, x + 6, 14.9, z + 4.4);                             // テーブルの上の箱
}

function press(K, x, z) {
  const { b, X } = K;
  b.box(26, 7, 13, C.ochreDk, x, 3.5, z, { cast: true });                   // ベッド
  b.box(20, 1.2, 10, C.steelDk, x, 7.6, z + 0.5);                            // ボルスタ
  for (const s of [-1, 1]) b.box(5, 24, 11, C.ochre, x + s * 10.5, 19, z, { cast: true });   // 柱
  b.box(27, 7, 13, C.ochre, x, 34.5, z, { cast: true });                    // クラウン
  b.box(15, 5, 9, C.ochreDk, x, 21, z + 0.5, { cast: true });               // ラム
  b.box(13, 2.5, 8, C.iron, x, 9.45, z + 0.5);                               // 金型
  b.box(13, 2.5, 8, C.iron, x, 17.25, z + 0.5);
  for (let i = 0; i < 6; i++) b.box(2.4, 1.2, 0.15, i % 2 ? C.black : C.line, x - 6 + i * 2.4, 19.3, z + 5.06);
  X.cyl(6.5, 6.5, 1.6, C.ochreDk, x + 9, 30.5, z + 7.5, { rx: Math.PI / 2, seg: 18, cast: true });   // はずみ車
  X.cyl(5.2, 5.2, 1.7, C.iron, x + 9, 30.5, z + 7.5, { rx: Math.PI / 2, seg: 18 });
  X.cyl(1.4, 1.4, 2.4, C.steel, x + 9, 30.5, z + 7.5, { rx: Math.PI / 2, seg: 8 });
  for (let i = 0; i < 3; i++) X.box(0.9, 10.4, 1.9, C.ochreDk, x + 9, 30.5, z + 7.5, { rz: i * Math.PI / 3 });   // 腕
  b.box(4, 6, 2.5, C.machDk, x - 15.5, 11, z + 4.5, { cast: true });        // 押しボタン箱
  b.box(0.8, 0.8, 0.3, C.tag, x - 15.5, 12.4, z + 5.9);
  b.box(0.8, 0.8, 0.3, '#3f7a4a', x - 15.5, 10.6, z + 5.9);
  b.box(4, 2.2, 0.15, C.rust, x - 9, 5.2, z + 6.55);
  b.box(3, 3.5, 0.15, C.rust, x + 7, 3.8, z + 6.55);
  b.box(3.6, 3.0, 0.3, C.line, x - 6.5, 27.2, z + 6.6);                     // 注意の板（無地）
  b.box(2.6, 0.5, 0.12, C.black, x - 6.5, 27.2, z + 6.8);
}

function drill(K, x, z) {
  const { b, X } = K;
  b.box(7, 1, 7, C.machDk, x, 0.5, z, { cast: true });
  X.cyl(0.8, 0.8, 22, C.steel, x, 12, z - 2, { seg: 10, cast: true });
  b.box(6, 1, 6, C.machCream, x, 9, z + 0.6, { cast: true });
  b.box(1.8, 1.6, 2, C.machCream, x, 9, z - 1.4);
  b.box(5, 5, 8, C.machCream, x, 22, z, { cast: true });
  b.box(3.5, 3, 3, C.machDk, x, 25.6, z - 2.5);
  X.cyl(0.4, 0.4, 3, C.steel, x, 18.2, z + 2.4, { seg: 8 });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + 0.4;
    rod(X, x + 2.5, 21, z + 1, x + 2.5 + 0.3 * Math.cos(a), 21 + 2.6 * Math.sin(a), z + 1 + 2.6 * Math.cos(a), 0.3, C.iron);
  }
}

function grinder(K, x, z) {
  const { b, X } = K;
  b.box(3, 9, 3, C.mach, x, 4.5, z, { cast: true });
  b.box(5, 3, 3.2, C.machLt, x, 10.5, z, { cast: true });
  for (const s of [-1, 1]) {
    X.cyl(1.8, 1.8, 0.8, '#9a968a', x + s * 3.3, 10.5, z, { rz: Math.PI / 2, seg: 12 });
    b.box(1.3, 2.6, 2.8, C.mach, x + s * 3.3, 11.3, z - 0.4);
  }
}

function drum(K, x, z, cast) {
  const { X } = K;
  X.cyl(2.8, 2.8, 8.6, C.rust, x, 4.3, z, { seg: 14, cast });
  for (const y of [2.9, 5.7]) X.cyl(2.9, 2.9, 0.35, C.rustDk, x, y, z, { seg: 14 });
  X.cyl(2.7, 2.7, 0.2, C.rustDk, x, 8.68, z, { seg: 14 });
}

// ----- 搬出口（少し開いたシャッター）-----
function buildExit(K) {
  const { b, G, BACK } = K;
  const cx = SHUT.x, w = SHUT.w, top = 30, gap = 6.5;
  G.box(w, gap, 0.2, C.outside, cx, gap / 2, BACK + 0.1);                    // すき間の外の光
  b.box(w, top - gap, 0.4, C.shutter, cx, (top + gap) / 2, BACK + 0.3);
  for (let y = gap + 1.2; y < top - 0.5; y += 1.3) b.box(w, 0.32, 0.6, C.shutterDk, cx, y, BACK + 0.5);
  b.box(w + 0.4, 0.8, 0.9, C.iron, cx, gap + 0.4, BACK + 0.6);
  for (const s of [-1, 1]) b.box(1.4, top + 2, 1.4, C.ochreDk, cx + s * (w / 2 + 0.7), (top + 2) / 2, BACK + 0.8);
  b.box(w + 4, 4.4, 3, C.ochreDk, cx, top + 2.2, BACK + 1.6, { cast: true });
  pool(K, cx, BACK + 7, 21, 8, '#30332f');
  for (const s of [-1, 1]) {                                                 // 車止め（虎縞のポール）
    for (let i = 0; i < 4; i++) b.box(1.6, 1.5, 1.6, i % 2 ? C.black : C.line, cx + s * (w / 2 + 3.5), 0.75 + i * 1.5, BACK + 6);
  }
  // 空パレットの山とドラム缶
  for (let i = 0; i < 6; i++) pallet(K, 502 + (i % 2) * 0.6, -60, 14, 11, i * 1.42);
  drum(K, 512, -48, true); drum(K, 518, -45, true);
  shelf(K, 512, -67.2, 40, 12.5);
}

// ----- 手前ゾーン（遮蔽の線より低い物だけ）-----
function buildFront(K) {
  const { b, X, R } = K;
  // 事務所の前: 段ボールとホースリール
  b.box(7, 3.4, 5.5, C.card, 92, 1.7, 44);
  b.box(6, 3.0, 5, C.cardDk, 92.6, 4.9, 44.2, { rotY: 0.12 });
  b.box(6.5, 3.2, 5.2, C.card, 100.5, 1.6, 47, { rotY: -0.2 });
  X.cyl(3.0, 3.0, 1.2, C.ochre, 122, 3.2, 47.6, { rx: Math.PI / 2, seg: 16 });
  X.cyl(2.2, 2.2, 3.0, '#5a5f4c', 122, 3.2, 46.2, { rx: Math.PI / 2, seg: 16 });
  X.cyl(3.0, 3.0, 1.2, C.ochre, 122, 3.2, 44.8, { rx: Math.PI / 2, seg: 16 });
  b.box(5.2, 0.6, 4.4, C.steelDk, 122, 0.3, 46.2);
  // 不具合説明の前: 低い台車に載った壊れた試作品、部品箱
  cart(K, 172, 46);
  for (let i = 0; i < 3; i++) {
    const x = 205 + i * 6.4;
    b.box(5.6, 3.4, 4.4, ['#7a8a8f', '#a58a48', '#7a8a8f'][i], x, 1.7, 39.8);
    b.box(4.8, 0.2, 3.6, C.dark, x, 3.35, 39.8);
    if (i !== 1) for (let k = 0; k < 3; k++) b.box(0.8, 0.5, 0.8, ['#a9a79c', '#9a6232', C.steel][k], x - 1.4 + k * 1.3, 3.7, 39.6 + (k % 2) * 0.8);
  }
  X.cyl(3.4, 3.4, 1.4, C.iron, 239, 0.7, 58, { seg: 16 });                    // 巻いたケーブル
  X.cyl(2.2, 2.2, 1.5, C.floorDk, 239, 0.75, 58, { seg: 16 });
  // 再試作の前: 1段だけ並べた同じ試作品、スクラップの箱
  pallet(K, 270, 48, 20, 11, 0, false);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    proto(X, 263.5 + i * 6.5, 1.4, 45.6 + j * 4.9, { ry: (R() - 0.5) * 0.06, front: j === 1, tag: j === 1 && i === 1 });
  }
  skip(K, 312, 57);
  // 製造部門の前: 丸棒の束、横にしたドラム缶、立てたドラム缶
  for (const dx of [-8, 8]) b.box(1.2, 3.8, 6, C.steelDk, 356 + dx, 1.9, 44);
  for (let i = 0; i < 7; i++) {   // 丸棒の束（長さも色もそろっていない。錆びた棒まじり）
    const len = 22 + (i * 7) % 6, off = ((i * 5) % 7 - 3) * 0.6;
    X.cyl(0.5, 0.5, len, [C.steel, C.rust, C.steelDk][i % 3], 356 + off, 4.3 + (i % 2) * 0.55, 41.6 + i * 0.75, { rz: Math.PI / 2, seg: 8 });
  }
  for (const [x, z] of [[396, 49], [403.6, 50.6]]) {
    X.cyl(2.8, 2.8, 8.6, C.rust, x, 2.8, z, { rx: Math.PI / 2, seg: 14 });
    for (const dz of [-1.4, 1.4]) X.cyl(2.9, 2.9, 0.35, C.rustDk, x, 2.8, z + dz, { rx: Math.PI / 2, seg: 14 });
  }
  drum(K, 424, 64, false);
  // 搬出口の前: ハンドリフトと空パレット
  b.box(5, 0.9, 12, C.tag, 452, 0.9, 46);
  b.box(1.4, 0.9, 12, C.iron, 450, 0.9, 46);
  b.box(1.4, 0.9, 12, C.iron, 454, 0.9, 46);
  rod(X, 452, 1.4, 52, 452, 7.8, 55.5, 0.4, C.iron);
  b.box(3.2, 0.5, 0.5, C.iron, 452, 7.9, 55.6);
  for (let i = 0; i < 4; i++) pallet(K, 484 + (R() - 0.5) * 0.8, 52, 14, 11, i * 1.42, false);
  // 床を這うエアホース（ゴムの赤茶）
  let px = 146, pz = 38;
  for (let i = 0; i < 6; i++) {
    const nx = px + 6.5, nz = 38 + Math.sin(i * 1.4) * 2.4;
    rod(X, px, 0.35, pz, nx, 0.35, nz, 0.6, '#6d3b2c');
    px = nx; pz = nz;
  }
  // 置き場の区画線（褪せた黄色。上面 0.08 の層）
  zoneLines(K, 258, 40.5, 282, 55.5);
  zoneLines(K, 300, 49.5, 324, 64.5);
  zoneLines(K, 389, 43, 410, 56);
  zoneLines(K, 474, 44, 494, 60);
  // 手前の端（帯の手前を歩くときだけ見える）
  pallet(K, 150, 80, 14, 11, 0, false);
  b.box(6, 3.6, 5, C.cardDk, 330, 1.8, 78, { rotY: 0.3 });
  pallet(K, 380, 84, 14, 11, 0, false);
  stain(K, 300, 40, 2.6, 1.6); stain(K, 392, 58, 2.0, 1.3);
}

// 床の区画線（長方形）。塗りが剥げて途切れ途切れ
function zoneLines(K, x0, z0, x1, z1) {
  const { b, R } = K;
  const dash = (a0, a1, along) => {
    for (let a = a0; a < a1;) {
      const len = Math.min(a1 - a, 3 + R() * 7), gap = R() < 0.3 ? 1 + R() * 2.5 : 0.3;
      along(a + len / 2, len, R() < 0.55 ? C.line : C.lineFade);
      a += len + gap;
    }
  };
  for (const z of [z0, z1]) dash(x0, x1, (m, len, c) => b.box(len, 0.06, 0.6, c, m, 0.05, z));
  for (const x of [x0, x1]) dash(z0 + 0.3, z1 - 0.3, (m, len, c) => b.box(0.6, 0.06, len, c, x, 0.05, m));
}

function cart(K, x, z) {
  const { b, X } = K;
  b.box(14, 0.6, 8, C.steelDk, x, 3.2, z);
  b.box(14.2, 0.8, 0.3, C.steelDk, x, 3.8, z + 4.1);
  b.box(14.2, 0.8, 0.3, C.steelDk, x, 3.8, z - 4.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) X.cyl(1.1, 1.1, 0.7, C.black, x + sx * 5.5, 1.1, z + sz * 3, { rx: Math.PI / 2, seg: 10 });
  rod(X, x - 7, 3.5, z - 3.6, x - 8.4, 8.2, z - 3.6, 0.35, C.iron);
  rod(X, x - 7, 3.5, z + 3.6, x - 8.4, 8.2, z + 3.6, 0.35, C.iron);
  rod(X, x - 8.4, 8.2, z - 3.6, x - 8.4, 8.2, z + 3.6, 0.35, C.iron);
  proto(X, x + 1.5, 3.5, z, { ry: 0.12, tag: true });
  b.box(4, 0.3, 3, C.paper, x - 3.6, 3.65, z + 0.6, { rotY: -0.2 });
}

// スクラップ箱（低い）。壊れた試作品がはみ出している
function skip(K, x, z) {
  const { b, X } = K;
  b.box(18, 6.4, 10, C.ochreDk, x, 3.4, z);
  b.box(17, 0.3, 9, C.dark, x, 6.5, z);
  b.box(18.4, 0.6, 10.4, C.rustDk, x, 6.7, z);
  b.box(4, 2.6, 0.15, C.rust, x - 4, 3.0, z + 5.06);
  proto(X, x - 3.5, 4.6, z - 1, { rx: 0.25, ry: 0.4, rz: -0.3, front: false });
  proto(X, x + 4, 4.4, z + 0.5, { rx: -0.3, ry: -0.6, rz: 0.2, tag: true });
  X.box(4.2, 0.3, 3, C.protoLt, x + 0.5, 7.4, z + 2, { rx: 0.4, rz: -0.5 });
}

// ===== 出来事 =====
// 'tick' だけ使う（この場面のあいだにボス戦は始まらない）。
export function onEvent(name, arg) {
  if (name !== 'tick' || !A) return;
  const t = (arg && arg.t) || 0;
  // ちらつく灯り: ほとんど消えていて、ときどき点こうとする
  if (A.flick) {
    const p = t % 5.7;
    let on = false;
    if (p > 3.3 && p < 4.2) on = Math.sin(t * 61.0) + Math.sin(t * 37.3) > 0.5;
    else if (p >= 4.2 && p < 4.75) on = true;
    else if (p > 4.85 && p < 5.15) on = Math.sin(t * 83.0) > 0.1;
    A.flick.bulb.material.color.copy(on ? COL.on : COL.off);
    A.flick.cone.visible = on;
  }
  for (const h of A.hooks) {
    h.m.rotation.z = Math.sin(t * h.w + h.ph) * h.a;
    h.m.rotation.x = Math.sin(t * h.w * 0.71 + h.ph * 1.3) * h.a * 0.6;
  }
  if (A.dust) moveDust(t);
  // 試験台: 試験中（黄の点滅）→ 火花・蓋が跳ねる・煙（赤）→ 作り直し（消灯）→ また試験
  const ts = A.test;
  if (ts) {
    const p = (t + ts.ph) % 6.8;
    let ang = 0;
    if (p > 4.5 && p < 5.05) ang = -0.62 * Math.sin(Math.PI * (p - 4.5) / 0.55);
    else if (p >= 5.05 && p < 5.3) ang = -0.13 * Math.sin(Math.PI * (p - 5.05) / 0.25);
    ts.lid.rotation.x = ang;
    const sp = (p > 4.46 && p < 4.6) || (p > 4.68 && p < 4.76) || (p > 4.92 && p < 4.97);
    ts.spark.visible = sp;
    if (sp) {
      ts.spark.rotation.set(t * 23, t * 37, t * 11);
      const s = 0.6 + Math.random() * 0.7;
      ts.spark.scale.set(s, s, s);
    }
    ts.smoke.forEach((m, i) => {   // 寿命 1.6 秒。最後の1つも周期（6.8）の前に消える
      const u = p - 4.55 - i * 0.3;
      m.visible = u > 0 && u < 1.6;
      if (!m.visible) return;
      m.position.set(ts.x + 0.6 + u * 1.1 + Math.sin(u * 2 + i) * 0.5, ts.y + 0.8 + u * 5.0, ts.z + (i - 1) * 0.6);
      const s = 0.6 + u * 1.5;
      m.scale.set(s, s, s);
      m.rotation.set(u * 0.7, u * 1.1 + i, 0);
      m.material.opacity = 0.55 * (1 - u / 1.6);
    });
    ts.lamp.material.color.copy(p < 4.5 ? ((p % 0.9) < 0.45 ? COL.amber : COL.dark) : p < 6.3 ? COL.red : COL.dark);
  }
}

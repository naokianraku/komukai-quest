// 小向クエスト2 ゴールデンエイジ編 — 第4章 L3社 立入制限区域（g2_l3_kuiki）
//
// 技術力は高いが、規制で情報を出さない会社。窓のない、天井の低い、閉じた区域。「藍。閉じている」。
// 章の始まり x 0〜1119（ワールド 0〜373）に張られる。波は 380 輸出管理 → 740 技術問合せ（回答不可）→
// 1020 輸出管理責任者。カメラが映す奥の壁は、およそ x −100〜480（ワールド）。
//
// 入構ゲートが区間ごとに繰り返す（ワールド x 55 / 190 / 325 / 460 / 612）。1か所の作り:
//   奥ゾーン … 回転ゲートの枠（屋根・回転する腕・櫛・手前の弧の格子）、カード読み取りの柱、帯の奥の縁の柱（下に黄黒の縞）
//   帯の上   … 天井から下がる細い梁（y≥41）。正面に縞の板と状態灯、下にドームカメラ
//   床       … 帯を横切る黄黒の縞。帯の手前は低いカードの柱だけ（胴の線より低い）
// 区画の色（壁の帯と区画の札）は奥へ進むほど 青→黄→橙→赤 と制限が強くなる。
//
//   入構（〜55）       施錠された両開きの扉、手荷物の検査機と注意の掲示、金属探知の枠、守衛所。
//                      手前に携帯電話の預けロッカーと仕切りのポール
//   輸出管理（55〜190）金網の檻。中に覆いを掛けた機材（中身は見えない）。檻の扉は南京錠。手前に黒いケースのパレット
//   技術問合せ（〜325）曇りガラスの試験室（向こうに何かあるが分からない）、作業台の黒い箱、黒いラック、黒いケース
//   輸出管理責任者（〜460）曇りガラスの輸出管理室。前に黒塗りの書類の束を載せた台車、施錠された回収箱、書類箱の山
//   その先（460〜）     小さな詰所と、もう1つの檻（区間の外。場面を強制したときだけ見える）
//   壁: 低く下がった天井の縁に冷たい線の灯、高い所の監視カメラ、カードの読み取り機、色と記号だけの注意書き
//
// 出来事:
//   tick … 監視カメラが自機の方へ首を振る。自機がゲートの梁の下を通るあいだだけ、そのゲートの灯が緑になり、
//           過ぎるとまた赤に戻る（後ろで閉じる）。読み取り機と機材の小さな灯が瞬く
//   reveal / defeated … （ボス戦でこの場面を ?scene= で強制したときだけ届く）灯が全部緑になり、カメラが下を向く
//
// 文字・ロゴ・社章・旗は描かない（看板は無地の板＋色の棒、注意書きは色と記号だけ）。人に見える物も置かない。
// 描画の数: 動かない物は頂点カラーで束ねる（影を落とす物・落とさない物・自分で光る物・縞・金網・照り返し・小さな灯2組）。
// 1つずつ描くのは、首を振る監視カメラと、色の変わるゲートの灯だけ。PointLight は使わない。
import {
  THREE, wx, wz, hex, zones, setLighting, scene, hemi, sun, fill, addScenery,
} from '../../../game3d/src/render3d.js';

// ===== 配色: 暗めの藍。注意は黄黒の縞と赤い灯 =====
const P = {
  // 大きな面は藍のまま明るさを上げ、彩度を少し落とした（第4章が最終章より暗く冷たくなっていた。
  // 床が暗いと、この章の敵の藍のポロシャツが床に溶けて胴の輪郭が読めない）
  bg: '#2e3245',
  wall: '#52597f', wallLo: '#414764', wallLine: '#414661', trim: '#6a74ae',
  soffit: '#3c415b', ceiling: '#303446',
  floor: '#565c7b', band: '#616889', joint: '#474c6b', escort: '#c4443b', chevron: '#6b78b4',
  frame: '#3c4159', frameLt: '#606893', panel: '#7179a6', panelDk: '#595f86',
  steel: '#a5adc6', steelDk: '#5a6283',
  tint: '#16213b', tintHi: '#203259', screen: '#35558f',
  tarp: '#6b77a3', tarpLt: '#8c97c2', tarpDk: '#4d5884', tarpBk: '#16181f', tarpBkLt: '#2b2f3c', tarpGy: '#8d93a8', tarpGyLt: '#aab0c4',
  strap: '#c99d33',
  contact: '#272d4a',
  black: '#14151b', blackLt: '#22242d', handle: '#6a6f80',
  paper: '#e4e6ec', paperDk: '#c3c7d2', redact: '#0c0d11', ink: '#8e93a3', manila: '#b39560', carton: '#a38a5e',
  yellow: '#e0b22a', hazBk: '#19191e', signRed: '#c8322c', signBlue: '#2f5cb4', signWhite: '#eceef3',
  glass: '#5c6c98', glassHi: '#7486b2', glassDim: '#4d5c87', glassShade: '#414f78', mullion: '#262d4b',
  clear: '#1f2846', clearHi: '#2a3559',
  red: '#ff3b30', green: '#36e07a', amber: '#ffae2e', light: '#dce6ff',
  wash: '#26304e', pool: '#2a3558',
  zone: ['#4a78cc', '#d4ad38', '#d6742d', '#c23a34', '#8c2c28'],
};

// ===== 光（第4章は坂0.6: 第3章より冷たく暗い。蛍光灯ではなく、低い天井の冷たい線の灯）=====
const LIGHT = { hemi: '#bccbed', ground: '#545972', hi: 1.8, sun: '#cdd8f4', si: 0.82, fi: 0.9 };

// ゲートの位置（ワールド x）と、回転ゲートの組み方。区間の色は gate[i-1]〜gate[i] の間
const GATES = [
  { x: 55, kind: 'twin' }, { x: 190, kind: 'fence', post: true }, { x: 325, kind: 'twin', post: true },
  { x: 460, kind: 'twin' }, { x: 612, kind: 'fence', post: true },
];

const HZ = 3.2;          // 黄黒の縞の1周期（ワールド単位）
const HOLES = [[200.5, 290]];   // 壁の帯を切る所（試験室の曇りガラス）
const CELL = 2.4;        // 金網の目の大きさ

// 今張られている場面の動く物。build のたびに作り直す（前の章の参照を残さない）
let S = null;

// ===== 模様（場面をまたいで使い回す。clearScenery は材質を捨てるが、模様は捨てない）=====
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const make = (n, paint) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    paint(cv.getContext('2d'), n);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  TEX = {
    // 45°の黄黒の縞。(x+y) の剰余で塗るので、上下左右どちらへ並べても継ぎ目が出ない
    hazard: make(64, (g, n) => {
      const img = g.createImageData(n, n), d = img.data;
      const Y = [0xe0, 0xb2, 0x2a], K = [0x19, 0x19, 0x1e];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const c = ((x + y) % n) < n / 2 ? Y : K, i = (y * n + x) * 4;
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }),
    // 金網（菱形の目）。線を太めに描いておくと、遠くで縮んでも網が消えずに灰色の霞になる
    mesh: make(64, (g, n) => {
      g.clearRect(0, 0, n, n);
      g.strokeStyle = '#8c93ab';   // 金網は少し落とす（明るいと奥の覆いを掛けた機材が消える）
      g.lineWidth = 4.5;
      for (const o of [-n, 0, n]) {
        g.beginPath(); g.moveTo(o, 0); g.lineTo(o + n, n); g.stroke();
        g.beginPath(); g.moveTo(o + n, 0); g.lineTo(o, n); g.stroke();
      }
    }),
  };
  return TEX;
}

// ===== 束ね描き =====
// boxBatch と同じ考え方（頂点カラーで1つのメッシュにまとめる）だが、回転を3軸とも受け、
// 箱以外の形（円柱・半球・円盤）と、模様の座標（uv）と、上下の色の移り（o.top）・中心から外への移り（o.fan）も扱う。
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _mx = new THREE.Matrix4(), _c = new THREE.Color(), _c2 = new THREE.Color();

function batch() {
  const P3 = [], N3 = [], C3 = [], U2 = [], I1 = [];
  const api = {
    geo(g, color, x, y, z, o = {}) {
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, n = pa.count;
      _c.set(color);
      const grad = o.top != null || o.fan;
      let y0 = 0, y1 = 1;
      if (grad) {
        _c2.set(o.fan ? '#000000' : o.top);
        if (!o.fan) {
          y0 = Infinity; y1 = -Infinity;
          for (let i = 0; i < n; i++) { const v = pa.getY(i); if (v < y0) y0 = v; if (v > y1) y1 = v; }
        }
      }
      for (let i = 0; i < n; i++) {
        const k = !grad ? 0 : o.fan ? (i === 0 ? 0 : 1) : (pa.getY(i) - y0) / Math.max(1e-6, y1 - y0);
        C3.push(_c.r + (_c2.r - _c.r) * k, _c.g + (_c2.g - _c.g) * k, _c.b + (_c2.b - _c.b) * k);
      }
      _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
      _mx.compose(_p.set(x, y, z), _q.setFromEuler(_e), _one);
      g.applyMatrix4(_mx);
      const base = P3.length / 3;
      for (let i = 0; i < n; i++) {
        P3.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        N3.push(na.getX(i), na.getY(i), na.getZ(i));
        if (ua) U2.push(ua.getX(i), ua.getY(i)); else U2.push(0, 0);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I1.push(base + g.index.getX(i));
      else for (let i = 0; i < n; i++) I1.push(base + i);
      g.dispose();
    },
    box(w, h, d, color, x, y, z, o) { api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    done(mat, o = {}) {
      if (!P3.length) { mat.dispose(); return null; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(N3, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
      geo.setIndex(I1);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = !!o.cast;
      m.receiveShadow = o.receive !== false;
      if (o.order != null) m.renderOrder = o.order;
      if (o.add !== false) { m.matrixAutoUpdate = false; m.updateMatrix(); addScenery(m); }
      return m;
    },
  };
  return api;
}
const lambert = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
const basic = (o = {}) => new THREE.MeshBasicMaterial({ vertexColors: true, ...o });

// 模様の座標を実寸に合わせた箱（縞の幅が箱の大きさで伸び縮みしない）。面の並びは +x,−x,+y,−y,+z,−z
function uvBox(w, h, d, T) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / T, uv.getY(i) * dims[f][1] / T);
    }
  }
  return g;
}
const hz = (B, w, h, d, x, y, z, o) => B.haz.geo(uvBox(w, h, d, HZ), '#ffffff', x, y, z, o);

// 金網の1枚。ry=0 なら x 方向に張る（面は ±z）、ry=π/2 なら z 方向に張る
function meshPanel(B, w, h, x, y, z, ry = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / CELL, uv.getY(i) * h / CELL);
  B.fence.geo(g, '#ffffff', x, y, z, { ry });
}

// 決まった乱数（建て直しても同じ形になるように）
function hash(i, j) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul((j | 0) + 977, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ===== 小物 =====
// 壁のカード読み取り機。赤い点は瞬く組（ledA）
function wallReader(B, x, y, z) {
  B.lit.box(1.5, 2.4, 0.4, P.black, x, y, z + 0.2);
  B.lit.box(1.0, 1.0, 0.12, '#2c3140', x, y - 0.35, z + 0.46);
  B.ledA.box(0.4, 0.28, 0.12, P.red, x, y + 0.75, z + 0.46);
}

// 注意（黄色の菱形に黒い縁と「！」）。記号だけで文字は無い
function cautionSign(L, x, y, z, s = 1) {
  L.box(4.4 * s, 4.4 * s, 0.2, P.hazBk, x, y, z + 0.1, { rz: Math.PI / 4 });
  L.box(3.7 * s, 3.7 * s, 0.2, P.yellow, x, y, z + 0.22, { rz: Math.PI / 4 });
  L.box(0.55 * s, 1.75 * s, 0.1, P.hazBk, x, y + 0.42 * s, z + 0.36);
  L.box(0.55 * s, 0.55 * s, 0.1, P.hazBk, x, y - 0.95 * s, z + 0.36);
}
// 禁止（赤い輪と斜線）。glyph: 'phone' 携帯電話 / 'camera' 撮影
function noSign(L, x, y, z, glyph) {
  L.geo(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 20), P.signRed, x, y, z + 0.1, { rx: Math.PI / 2 });
  L.geo(new THREE.CylinderGeometry(1.9, 1.9, 0.2, 20), P.signWhite, x, y, z + 0.2, { rx: Math.PI / 2 });
  if (glyph === 'phone') {
    L.box(1.1, 1.9, 0.1, '#2a2d36', x, y, z + 0.34);
    L.box(0.7, 1.1, 0.06, '#6b7390', x, y + 0.15, z + 0.4);
  } else {
    L.box(2.0, 1.3, 0.1, '#2a2d36', x, y - 0.1, z + 0.34);
    L.box(0.8, 0.8, 0.06, '#6b7390', x, y - 0.1, z + 0.4);
    L.box(0.7, 0.35, 0.1, '#2a2d36', x - 0.4, y + 0.7, z + 0.34);
  }
  L.box(0.42, 4.0, 0.1, P.signRed, x, y, z + 0.47, { rz: -Math.PI / 4 });
}
// 指示（青い円に白い入館証）
function badgeSign(L, x, y, z) {
  L.geo(new THREE.CylinderGeometry(2.4, 2.4, 0.2, 20), P.signBlue, x, y, z + 0.1, { rx: Math.PI / 2 });
  L.box(1.5, 1.9, 0.1, P.signWhite, x, y - 0.3, z + 0.24);
  L.box(0.9, 0.5, 0.1, P.signBlue, x, y - 0.2, z + 0.3);
  L.box(0.35, 1.0, 0.1, P.signWhite, x, y + 0.95, z + 0.24);
}
// 区画の札（区画の色の板に、5つの升の目盛り。奥の区画ほど白く埋まる。数字には見せない）
function zonePlate(L, x, y, z, k) {
  L.box(7.4, 5.0, 0.3, P.frame, x, y, z + 0.15);
  L.box(6.8, 4.4, 0.2, P.zone[k], x, y, z + 0.32);
  for (let i = 0; i < 5; i++) L.box(0.9, 0.9, 0.1, i <= k ? P.signWhite : P.frame, x - 2.4 + i * 1.2, y - 1.0, z + 0.46);
}

// 監視カメラ（高い所）。腕は動かない組、首から先は1つのメッシュにして首を振らせる
function secCam(B, x, y, z, ph) {
  B.lit.box(0.7, 2.0, 0.7, P.steelDk, x, y + 1.3, z);
  B.lit.box(1.8, 0.35, 1.8, P.steelDk, x, y + 2.35, z);
  const hb = batch();
  hb.box(1.6, 1.5, 4.4, '#d5d9e4', 0, -0.25, 1.35);       // 胴
  hb.box(2.0, 0.28, 5.0, '#b3b9c8', 0, 0.68, 1.55);       // 日よけ
  hb.box(1.2, 1.1, 0.25, '#0b0c10', 0, -0.25, 3.6);       // 前面
  hb.box(0.55, 0.55, 0.15, '#4a5d92', 0, -0.25, 3.78);    // レンズ
  hb.box(0.75, 0.9, 0.75, '#7d849a', 0, 0.2, 0);          // 首
  const head = hb.done(lambert(), { add: false, receive: false });
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation.order = 'YXZ';
  pivot.add(head);
  addScenery(pivot);
  B.ledA.box(0.32, 0.32, 0.32, P.red, x + 0.75, y + 1.7, z + 0.4);
  const yaw0 = (hash(x | 0, 3) - 0.5) * 1.2;
  pivot.rotation.set(0.45, yaw0, 0);
  B.cams.push({ pivot, x, y, z, ph, yaw: yaw0, pitch: 0.45 });
}

// ===== 部屋の殻: 床・奥の壁・下がった天井の縁と線の灯・天井 =====
function shell(B, XL, XR) {
  const { lit: L, un: U, glow: G } = B, BACK = B.BACK, FRONT = B.FRONT;
  const XC = (XL + XR) / 2, XW = XR - XL, ZC = (FRONT + BACK) / 2, ZD = FRONT - BACK;

  // 床: 藍がかった樹脂の床。人の通る帯は少し明るく擦れている。目地は 24 ごと
  L.box(XW, 2, ZD, P.floor, XC, -1, ZC);
  L.box(XW, 0.04, 50, P.band, XC, 0.02, 0);
  for (let x = Math.ceil(XL / 24) * 24; x < XR; x += 24) L.box(0.22, 0.04, ZD, P.joint, x, 0.04, ZC);
  for (const z of [-47, 50, 74]) L.box(XW, 0.04, 0.22, P.joint, XC, 0.04, z);
  // 付き添いが要る区画の線（帯の両縁の赤）と、進む向きの矢羽（記号だけ）
  for (const z of [-23.4, 23.4]) L.box(XW, 0.04, 0.7, P.escort, XC, 0.06, z);
  for (let x = Math.ceil(XL / 45) * 45 + 22; x < XR - 10; x += 45) {
    for (const s of [-1, 1]) L.box(3.6, 0.04, 0.8, P.chevron, x - 1, 0.07, s * 1.5, { ry: s * 0.98 });
  }

  // 奥の壁: 断熱パネルの継ぎ目、濃い腰、見切り
  L.box(XW, 64, 2, P.wall, XC, 32, BACK - 1);
  L.box(XW, 9, 0.3, P.wallLo, XC, 4.5, BACK + 0.15);
  L.box(XW, 0.7, 0.5, P.trim, XC, 9.35, BACK + 0.25);
  for (let x = Math.ceil(XL / 12) * 12; x < XR; x += 12) L.box(0.22, 19.8, 0.1, P.wallLine, x, 19.6, BACK + 0.05);

  // 下がった天井の縁（天井が低く見える）。下端に冷たい線の灯、その下の壁に薄い照り返し
  L.box(XW, 16.5, 7, P.soffit, XC, 29.5 + 8.25, BACK + 3.5);
  for (let x = XL + 12; x < XR; x += 30) {
    L.box(26, 0.7, 0.5, '#3a4268', x, 29.75, BACK + 7.2);
    U.box(24, 0.42, 0.3, P.light, x, 29.55, BACK + 7.45);
    G.geo(new THREE.PlaneGeometry(27, 11), '#000000', x, 24, BACK + 0.27, { top: P.wash });
  }
  // 天井（手前の端は z=40）
  L.box(XW, 2, 40 - BACK, P.ceiling, XC, 47, (40 + BACK) / 2);
}

// 区画の色の帯（壁）と区画の札
function zoneBands(B, XL, XR) {
  const L = B.lit, BACK = B.BACK;
  const edges = [XL, ...GATES.map((g) => g.x).filter((x) => x < XR), XR];
  for (let i = 0; i < edges.length - 1; i++) {
    const k = Math.min(i, P.zone.length - 1);
    const runs = [[edges[i] + 3, edges[i + 1] - 3]];
    for (const [a, b] of HOLES) {           // 曇りガラスの窓の所は帯を切る
      const r = runs.pop();
      if (a > r[0] && b < r[1]) runs.push([r[0], a], [b, r[1]]); else runs.push(r);
    }
    for (const [x0, x1] of runs) {
      L.box(x1 - x0, 1.3, 0.24, P.zone[k], (x0 + x1) / 2, 22.6, BACK + 0.12);
      L.box(x1 - x0, 0.3, 0.2, P.zone[k], (x0 + x1) / 2, 21.4, BACK + 0.1);
    }
  }
}

// ===== ゲート =====
function turnstile(B, cx, cz, lamp, a0) {
  const L = B.lit, C = B.cast;
  L.box(12.4, 0.3, 12.4, P.steelDk, cx, 0.15, cz);                          // 床の台
  C.box(13, 1.4, 13, P.frame, cx, 23.3, cz);                                 // 屋根
  L.box(13.3, 0.35, 13.3, P.steelDk, cx, 22.45, cz);                         // 屋根の縁
  lamp.box(1.8, 0.8, 0.3, '#ffffff', cx, 23.3, cz + 6.65);                   // 状態灯
  C.box(0.9, 22.3, 0.9, P.steel, cx, 11.45, cz);                             // 回転軸
  for (let k = 0; k < 3; k++) {                                              // 回転する腕（3本 × 7段）
    const a = a0 + k * Math.PI * 2 / 3;
    for (let j = 0; j < 7; j++) {
      L.box(5.4, 0.45, 0.45, P.steel, cx + Math.cos(a) * 3.2, 3 + j * 2.8, cz + Math.sin(a) * 3.2, { ry: -a });
    }
  }
  C.box(1.0, 22.3, 1.0, P.steelDk, cx, 11.45, cz - 6.1);                     // 奥の櫛（固定の腕）
  for (let j = 0; j < 7; j++) L.box(0.45, 0.45, 3.0, P.steel, cx, 4.4 + j * 2.8, cz - 4.6);
  // 手前の弧の格子
  const R = 6.3, N = 9;
  let prev = null;
  for (let i = 0; i < N; i++) {
    const t = (25 + i * (130 / (N - 1))) * Math.PI / 180;
    const x = cx + Math.cos(t) * R, z = cz + Math.sin(t) * R;
    L.box(0.45, 22.3, 0.45, P.steel, x, 11.45, z);
    if (prev) {
      const dx = x - prev[0], dz = z - prev[1], len = Math.hypot(dx, dz);
      const ang = Math.atan2(dz, dx);
      for (const y of [0.8, 11.6, 21.9]) L.box(len, 0.4, 0.4, P.steel, (x + prev[0]) / 2, y, (z + prev[1]) / 2, { ry: -ang });
    }
    prev = [x, z];
  }
  C.box(0.8, 22.3, 0.8, P.frame, cx - 6, 11.45, cz - 6);                     // 奥の角の柱
  C.box(0.8, 22.3, 0.8, P.frame, cx + 6, 11.45, cz - 6);
}

// ゲートの出口の脇の小さな詰所（立ち机に画面と受付の板、背の低い色付きの衝立）
function guardPost(B, x, z) {
  const L = B.lit, C = B.cast, U = B.un;
  C.box(8.4, 9.2, 5, P.panel, x, 4.6, z);
  L.box(9.4, 0.7, 6.2, P.steelDk, x, 9.55, z + 0.4);
  L.box(8.4, 0.5, 0.2, P.trim, x, 6.8, z + 2.6);
  U.box(8.8, 6.2, 0.2, P.tint, x, 13.3, z - 2.3, { top: P.tintHi });      // 背の色付きの衝立
  L.box(9.2, 0.5, 0.5, P.frame, x, 16.6, z - 2.3);
  L.box(0.5, 6.8, 0.5, P.frame, x - 4.4, 13.3, z - 2.3);
  L.box(0.5, 6.8, 0.5, P.frame, x + 4.4, 13.3, z - 2.3);
  L.box(3.6, 2.6, 0.5, '#1a1c24', x + 1.6, 11.4, z - 0.6, { rx: -0.2 });   // 画面（裏向き）
  L.box(2.6, 0.08, 3.4, P.paper, x - 2.2, 9.95, z + 0.8, { ry: 0.12 });     // 受付の板
  L.box(1.2, 0.12, 0.6, '#2a2d36', x - 2.2, 10.05, z - 0.6, { ry: 0.12 });
  B.ledA.box(0.3, 0.3, 0.12, P.red, x + 3.4, 8.2, z + 2.62);
}

function gate(B, gi) {
  const { x: gx, kind } = GATES[gi];
  const L = B.lit, C = B.cast;
  const lamp = batch();
  // 帯の奥の縁の柱。下に黄黒の縞を巻き、帯の側にカード読み取り機
  C.box(4, 46, 4, P.frameLt, gx, 23, -31.5);
  hz(B, 4.3, 9, 4.3, gx, 4.5, -31.5);
  L.box(1.5, 2.4, 0.4, P.black, gx - 0.6, 12.5, -29.3);
  lamp.box(0.42, 0.3, 0.12, '#ffffff', gx - 0.6, 13.3, -29.04);
  // 帯の上の梁（天井から下がる）。正面に縞の板と状態灯、その下にドームカメラ
  L.box(3.6, 4.9, 70.2, P.frame, gx, 43.45, 1.9);
  hz(B, 4.2, 1.8, 0.3, gx, 41.9, 37.15);
  lamp.box(2.6, 1.2, 0.35, '#ffffff', gx, 44.3, 37.2);
  L.box(1.6, 0.6, 1.6, P.steelDk, gx, 40.7, 32.5);
  L.geo(new THREE.SphereGeometry(1.1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#101219', gx, 40.4, 32.5);
  // 床: 帯を横切る縞（この線から先は別の区画）
  hz(B, 2.6, 0.06, 50, gx, 0.09, 0);
  // 帯の手前の低いカードの柱（胴の線より低い）
  L.box(1.8, 9, 1.8, P.frameLt, gx - 3.2, 4.5, 31.5);
  L.box(1.9, 0.5, 1.9, P.steelDk, gx - 3.2, 9.2, 31.5);
  L.box(0.3, 2.2, 1.3, P.black, gx - 4.2, 7.0, 31.5);
  lamp.box(0.12, 0.3, 0.5, '#ffffff', gx - 4.38, 8.4, 31.5);
  hz(B, 4.2, 0.06, 4.2, gx - 3.2, 0.09, 31.5);

  // 奥ゾーン: 回転ゲート（柱の左＝入る側）とカード読み取りの柱
  const tx = gx - 8.5;
  turnstile(B, tx, -41.2, lamp, 0.25 + gi * 0.4);
  C.box(1.7, 11.5, 1.7, P.frameLt, tx - 9.2, 5.75, -36.5);
  L.box(1.4, 2.2, 0.35, P.black, tx - 9.2, 9.6, -35.5);
  lamp.box(0.4, 0.28, 0.1, '#ffffff', tx - 9.2, 10.4, -35.28);
  if (kind === 'twin') {
    turnstile(B, tx, -54.4, lamp, 0.9 + gi * 0.3);
    meshPanel(B, 7, 24, tx, 12, -64.4, Math.PI / 2);                           // 奥の壁まで金網
    L.box(0.7, 25, 0.7, P.steelDk, tx, 12.5, -61.2);
  } else {
    // 回転ゲートの奥は金網の仕切りと、南京錠の掛かった扉
    const z0 = -47.8, z1 = B.BACK;
    meshPanel(B, z0 - z1, 26, tx, 13, (z0 + z1) / 2, Math.PI / 2);
    for (const z of [z0, (z0 + z1) / 2, z1 + 0.5]) C.box(0.8, 27, 0.8, P.steelDk, tx, 13.5, z);
    L.box(0.6, 0.6, z0 - z1, P.steelDk, tx, 26.6, (z0 + z1) / 2);
    L.box(0.6, 0.6, z0 - z1, P.steelDk, tx, 13, (z0 + z1) / 2);
  }
  if (GATES[gi].post) guardPost(B, gx + 9.5, -40.5);
  const m = lamp.done(new THREE.MeshBasicMaterial({ color: hex(P.red) }), { receive: false });
  B.gates.push({ x: gx, mat: m.material, open: false });
  // 梁の下の床に、冷たい明かりの溜まり
  B.glow.geo(new THREE.CircleGeometry(21, 24), P.pool, gx, 0.2, 2, { rx: -Math.PI / 2, fan: true });
}

// ===== 入構（〜55）=====
function entry(B) {
  const L = B.lit, C = B.cast, U = B.un, BACK = B.BACK;
  // 施錠された両開きの扉（来た道）。磁気錠の帯と赤い灯、横に読み取り機
  const dx = -78;
  L.box(23, 23.5, 0.4, P.frame, dx, 11.75, BACK + 0.2);
  for (const s of [-1, 1]) {
    L.box(10.3, 22, 0.3, '#3a4372', dx + s * 5.3, 11, BACK + 0.45);
    L.box(0.6, 7, 0.9, P.steel, dx + s * 1.3, 11, BACK + 0.9);                // 縦の取っ手
    L.box(7.6, 0.4, 0.2, '#2f3762', dx + s * 5.3, 4, BACK + 0.65);
  }
  L.box(0.3, 22, 0.2, P.frame, dx, 11, BACK + 0.66);
  L.box(14, 1.4, 1.2, '#2a2d38', dx, 21.45, BACK + 0.9);                     // 磁気錠
  U.box(2.4, 1.0, 0.3, P.red, dx, 25, BACK + 0.4);
  wallReader(B, dx + 15, 11.5, BACK);
  L.box(1.4, 1.4, 0.3, '#2b8a4a', dx + 15, 15.2, BACK + 0.15);              // 退出のボタン（緑の四角）

  // 手荷物の検査機（通路は x の向き）と、上の壁の注意の掲示
  const xx = -40, xz = -46;
  C.box(15, 10, 9, '#58638d', xx, 5, xz);
  L.box(15.3, 1.3, 9.3, '#46507a', xx, 10.6, xz);
  for (const s of [-1, 1]) {
    L.box(0.2, 5.6, 6.6, '#0d0f15', xx + s * 7.6, 5.4, xz);                  // 口（暗い）
    for (let k = 0; k < 5; k++) L.box(0.1, 5.2, 1.2, '#1c1f29', xx + s * 7.75, 5.5, xz - 2.6 + k * 1.3);  // 鉛の暖簾
    L.box(7.5, 0.8, 7, P.steelDk, xx + s * 11.5, 6.0, xz);                   // ローラー台
    for (let k = 0; k < 5; k++) L.box(0.55, 0.55, 6.6, P.steel, xx + s * (8.6 + k * 1.4), 6.6, xz);
    for (const sz of [-1, 1]) L.box(0.6, 5.6, 0.6, P.steelDk, xx + s * 14.6, 2.8, xz + sz * 3);
  }
  L.box(5.2, 1.7, 4.6, '#7a86ad', xx - 12.5, 7.75, xz);                        // 手荷物のトレー
  L.box(4.6, 0.3, 4.0, '#59648c', xx - 12.5, 8.65, xz);
  L.box(0.5, 4.0, 0.5, P.steelDk, xx + 3, 13.2, xz - 3.2);                     // 操作卓の画面
  L.box(5, 3.4, 0.5, '#1a1c24', xx + 3, 16.2, xz - 3.2, { rx: -0.15 });
  U.box(4.2, 2.6, 0.1, '#2b4677', xx + 3, 16.2, xz - 2.9, { rx: -0.15 });
  cautionSign(L, xx - 4, 6, xz + 4.5, 0.6);                                  // 機械の横腹にも小さく
  // 掲示板（色と記号だけ: 携帯禁止・撮影禁止・注意・入館証）
  L.box(30, 11, 0.4, '#5a649a', xx, 21, BACK + 0.2);
  L.box(29, 10, 0.3, '#1d2342', xx, 21, BACK + 0.45);
  noSign(L, xx - 10.5, 21, BACK + 0.6, 'phone');
  noSign(L, xx - 3.5, 21, BACK + 0.6, 'camera');
  cautionSign(L, xx + 3.5, 21, BACK + 0.6, 0.95);
  badgeSign(L, xx + 10.5, 21, BACK + 0.6);

  // 金属探知の枠（ここから奥へ通される）。上に待機中の緑の帯
  const mx = -12, mz = -45;
  for (const s of [-1, 1]) {
    C.box(1.8, 21, 5.6, '#8a92ad', mx + s * 5.6, 10.5, mz);
    L.box(0.2, 18, 3.6, '#6b7393', mx + s * 4.62, 10.5, mz);
    L.box(2.4, 0.5, 6.4, P.steelDk, mx + s * 5.6, 0.25, mz);
  }
  C.box(13, 3, 5.6, '#6b7393', mx, 22.5, mz);
  U.box(4, 0.6, 0.2, P.green, mx, 22.6, mz + 2.9);
  // 枠の奥の扉（検査室へ）
  steelDoor(B, mx, 11, 21);

  // 守衛所。色の付いたガラスの向こうは見えない（画面の小さな光だけ）
  const b0 = 0, b1 = 32, bz0 = -36, bz1 = -58, bc = (b0 + b1) / 2, bzc = (bz0 + bz1) / 2;
  C.box(b1 - b0, 22, bz0 - bz1, P.panel, bc, 11, bzc);
  L.box(b1 - b0 + 3, 1.6, bz0 - bz1 + 3, P.frame, bc, 22.8, bzc);           // 屋根
  L.box(b1 - b0 + 3.2, 0.4, bz0 - bz1 + 3.2, P.trim, bc, 22.0, bzc);
  L.box(b1 - b0, 9.5, 0.3, P.panelDk, bc, 4.75, bz0 + 0.15);                // 腰
  U.box(b1 - b0 - 3, 9.6, 0.2, P.tint, bc, 15.2, bz0 + 0.1, { top: P.tintHi });   // 正面のガラス
  for (const k of [0, 1, 2]) U.box(3.2, 1.6, 0.1, P.screen, bc - 8 + k * 6.5, 12.3 + (k % 2) * 0.6, bz0 + 0.24);
  for (let x = b0 + 1.5; x <= b1 - 1.4; x += (b1 - b0 - 3) / 3) L.box(0.7, 10.2, 0.5, P.frame, x, 15.2, bz0 + 0.3);
  L.box(b1 - b0, 0.7, 0.6, P.frame, bc, 20.3, bz0 + 0.3);
  L.box(b1 - b0 - 2, 0.8, 3.0, P.steelDk, bc, 9.9, bz0 + 1.5);              // 受け渡しの台
  L.box(5, 0.6, 2.2, '#2a2e3a', bc + 6, 10.5, bz0 + 1.4);                    // 受け渡しの引き出し
  L.box(2.2, 1.6, 0.3, '#2a2e3a', bc - 9, 11.5, bz0 + 0.45);                 // 通話口
  U.box(0.2, 8.6, bz0 - bz1 - 3, P.tint, b1 + 0.1, 15.2, bzc, { top: P.tintHi });  // 横のガラス（ゲート側）
  L.box(0.4, 0.6, bz0 - bz1, P.frame, b1 + 0.25, 19.8, bzc);
  secCam(B, b1 - 3, 21.2, bz0 + 0.8, 0.7);
  // 守衛所の前の床: 「ここで待つ」の黄色い枠（帯の奥寄り）
  for (const [w, d, x, z] of [[14, 0.7, bc, -21], [14, 0.7, bc, -11], [0.7, 10.7, bc - 7, -16], [0.7, 10.7, bc + 7, -16]]) {
    L.box(w, 0.04, d, P.yellow, x, 0.08, z);
  }
  B.glow.geo(new THREE.CircleGeometry(15, 24), P.pool, bc, 0.2, -14, { rx: -Math.PI / 2, fan: true });
  zonePlate(L, bc, 25.6, BACK, 0);
}

// 施錠された鋼製の扉（壁）。上に赤い灯、横に読み取り機
function steelDoor(B, x, w = 11, h = 21) {
  const L = B.lit, BACK = B.BACK;
  L.box(w + 1.6, h + 0.8, 0.4, P.frame, x, (h + 0.8) / 2, BACK + 0.2);
  L.box(w, h, 0.3, '#39427a', x, h / 2, BACK + 0.45);
  L.box(w - 1.4, h - 1.4, 0.1, '#333c6e', x, h / 2, BACK + 0.64);
  L.box(2.6, 0.6, 0.6, P.steel, x + w / 2 - 2.4, 10, BACK + 0.9);           // レバー
  L.box(1.0, 1.6, 0.3, P.steelDk, x + w / 2 - 1.4, 10, BACK + 0.7);
  L.box(3.2, 0.9, 1.0, '#2a2d38', x - w / 2 + 2.4, h - 0.8, BACK + 1.0);    // ドアクローザー
  B.un.box(2.2, 0.9, 0.3, P.red, x, h + 3.8, BACK + 0.45);
  L.box(3.0, 1.5, 0.2, P.frame, x, h + 3.8, BACK + 0.3);
  wallReader(B, x + w / 2 + 2.4, 11.5, BACK);
}

// ===== 輸出管理（55〜190）: 金網の檻と、覆いを掛けた機材 =====
function cage(B, x0, x1, doorX) {
  const L = B.lit, C = B.cast, BACK = B.BACK, zf = -35, H = 27;
  // 支柱（角パイプ）
  const n = Math.max(1, Math.round((x1 - x0) / 11));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n;
    if (Math.abs(x - doorX) < 7.5) continue;
    C.box(0.8, H, 0.8, P.steelDk, x, H / 2, zf);
  }
  for (const x of [x0, x1]) for (const z of [zf - 11, zf - 22, BACK + 0.5]) C.box(0.8, H, 0.8, P.steelDk, x, H / 2, z);
  // 横桟
  for (const y of [0.6, 13, H - 0.3]) {
    L.box(doorX - 6.4 - x0 - 0.5, 0.6, 0.6, P.steelDk, (x0 + 0.5 + doorX - 6.4) / 2, y, zf);
    L.box(x1 - 0.5 - doorX - 6.4, 0.6, 0.6, P.steelDk, (doorX + 6.4 + x1 - 0.5) / 2, y, zf);
    for (const x of [x0, x1]) L.box(0.6, 0.6, zf - 0.5 - BACK, P.steelDk, x, y, (zf - 0.5 + BACK) / 2);
  }
  // 金網
  meshPanel(B, doorX - 6.4 - x0, H - 1, (x0 + doorX - 6.4) / 2, H / 2, zf);
  meshPanel(B, x1 - doorX - 6.4, H - 1, (doorX + 6.4 + x1) / 2, H / 2, zf);
  for (const x of [x0, x1]) meshPanel(B, zf - BACK, H - 1, x, H / 2, (zf + BACK) / 2, Math.PI / 2);
  // 檻の扉。太い枠と、閉めた扉の金網、掛け金に南京錠と鎖
  for (const s of [-1, 1]) C.box(1.2, H + 1, 1.2, P.steelDk, doorX + s * 6.4, (H + 1) / 2, zf);
  L.box(14, 1.0, 1.2, P.steelDk, doorX, H + 0.6, zf);
  const dz = zf + 0.5;
  for (const s of [-1, 1]) L.box(0.6, 23.5, 0.6, P.steel, doorX + s * 5.5, 12.5, dz);
  for (const y of [1.0, 12.5, 24.0]) L.box(11.6, 0.6, 0.6, P.steel, doorX, y, dz);
  meshPanel(B, 10.4, 22.4, doorX, 12.5, dz);
  L.box(2.4, 1.2, 0.3, P.steel, doorX + 5.6, 12.5, dz + 0.45);                // 掛け金
  L.box(1.3, 1.5, 0.7, '#2b2e38', doorX + 5.6, 11.0, dz + 0.75);              // 南京錠
  L.box(0.9, 0.9, 0.25, P.steel, doorX + 5.6, 12.1, dz + 0.75);
  for (let k = 0; k < 6; k++) {                                               // 鎖
    L.box(0.7, 0.35, 0.35, '#8a90a2', doorX + 4.4 + (k % 2) * 0.6, 14.8 - k * 0.9, dz + 0.95, { rz: k % 2 ? 0.7 : -0.7 });
  }
  // 檻の前の床: 近寄るなの縞
  hz(B, x1 - x0, 0.06, 2.0, (x0 + x1) / 2, 0.09, -27.6);
}

// 覆いを掛けた機材。覆いの裾が床に溜まり、縦のひだと黄色の締め帯
function draped(B, x, z, w, h, d, tone, seed) {
  const L = B.lit, C = B.cast;
  const col = tone === 'black' ? P.tarpBk : tone === 'gray' ? P.tarpGy : P.tarp;
  const lt = tone === 'black' ? P.tarpBkLt : tone === 'gray' ? P.tarpGyLt : P.tarpLt;
  const dk = tone === 'black' ? '#0e0f14' : tone === 'gray' ? '#363d5a' : P.tarpDk;
  const body = h - 1;
  C.box(w, body, d, col, x, body / 2, z);
  C.box(w - 1.4, 1.0, d - 1.4, col, x, h - 0.5, z);                          // 角の丸み
  for (const s of [-1, 1]) L.box(1.6, 1.2, 1.6, lt, x + s * (w / 2 - 0.9), h - 0.9, z + d / 2 - 0.9);   // 角で寄った布
  L.box(w + 1.4, 2.4, d + 1.4, col, x, 1.2, z);                               // 裾
  const nf = Math.max(3, Math.round(w / 3.2));
  for (let i = 0; i < nf; i++) {
    const r = hash(seed, i), fx = x - w / 2 + (i + 0.5) * (w / nf) + (r - 0.5) * 1.2;
    const fh = Math.min(body * (0.55 + r * 0.4), body - 2.6);
    L.box(0.6, fh, 0.5, i % 2 ? lt : dk, fx, 2.2 + fh / 2, z + d / 2 + 0.15, { rz: (r - 0.5) * 0.08 });
    L.box(0.9, 1.75, 0.6, i % 2 ? lt : dk, fx + 0.2, 1.675, z + d / 2 + 0.85); // 裾のたるみ
  }
  for (let i = 0; i < 2; i++) {                                               // 横のひだ
    const fz = z - d / 2 + (i + 1) * d / 3;
    L.box(0.5, body * 0.7, 0.6, lt, x - w / 2 - 0.15, 2.2 + body * 0.35, fz);
    L.box(0.5, body * 0.7, 0.6, dk, x + w / 2 + 0.15, 2.2 + body * 0.35, fz);
  }
  if (w >= 12) {
    for (const sx of [x - w * 0.28, x + w * 0.28]) {                          // 締め帯（縦）
      L.box(0.9, body - 1.6, 0.25, P.strap, sx, 2.4 + (body - 1.6) / 2, z + d / 2 + 0.42);
      L.box(0.9, 0.25, d + 0.2, P.strap, sx, h + 0.05, z);
    }
  } else {
    L.box(w + 0.6, 0.8, d + 1.0, P.strap, x, body * 0.42, z);                  // 締め帯（横に一周）
    L.box(w + 0.6, 0.8, d + 1.0, P.strap, x, body * 0.78, z);
  }
}

function exportZone(B, x0, x1, doorX, kinds) {
  cage(B, x0, x1, doorX);
  const L = B.lit, BACK = B.BACK;
  for (const k of kinds) draped(B, ...k);
  steelDoor(B, x1 - 22, 11, 21);                                              // 檻の中の扉（壁）
  cautionSign(L, x0 + 12, 17, -34.75, 0.9);
  noSign(L, x1 - 11, 17, -34.75, 'camera');
  secCam(B, (x0 + x1) / 2 - 8, 26.9, BACK + 5.5, 1.9);
  zonePlate(L, x0 - 6, 24.5, BACK, 1);
  B.glow.geo(new THREE.CircleGeometry(26, 24), P.pool, (x0 + x1) / 2, 0.2, -50, { rx: -Math.PI / 2, fan: true });
}

// ===== 技術問合せ（190〜325）: 曇りガラスの試験室と、中身の分からない黒い箱 =====
function blackBox(B, x, y, z, w, h, d, led) {
  const L = B.lit;
  L.box(w, h, d, P.black, x, y + h / 2, z);
  L.box(w - 0.6, h - 0.6, 0.12, P.blackLt, x, y + h / 2, z + d / 2 + 0.06);
  for (const s of [-1, 1]) L.box(0.35, h * 0.55, 0.5, P.handle, x + s * (w / 2 - 0.7), y + h / 2, z + d / 2 + 0.36);
  if (w > 4) L.box(0.9, 0.9, 0.2, '#3a3d48', x - w * 0.16, y + h * 0.55, z + d / 2 + 0.2);
  L.box(w * 0.3, h * 0.16, 0.08, '#4d5262', x + w * 0.14, y + h * 0.72, z + d / 2 + 0.16);   // 無地の札
  if (led) B.ledB.box(0.32, 0.32, 0.1, led, x + w * 0.14, y + h * 0.4, z + d / 2 + 0.2);
}

function lab(B) {
  const L = B.lit, C = B.cast, U = B.un, BACK = B.BACK;
  // 曇りガラスの窓（壁にはめ込み）。向こうは明るいが、何があるかは分からない（暗い影の形だけ）
  const w0 = 202, bays = 6, bw = 14.4, y0 = 11.5, y1 = 26.5;
  const wc = w0 + bays * bw / 2;
  const yf = 22.4;                         // ここから上は曇っていない（向こうの暗い天井だけが見える）
  U.box(bays * bw, yf - y0, 0.2, P.glass, wc, (y0 + yf) / 2, BACK + 0.1, { top: P.glassHi });
  U.box(bays * bw, y1 - yf, 0.2, P.clear, wc, (yf + y1) / 2, BACK + 0.1, { top: P.clearHi });
  for (const [x, w, h] of [[209, 6, 9], [222, 3, 6], [244, 7, 10.4], [262, 12, 3], [281, 5, 8]]) {
    U.box(w, h, 0.08, P.glassShade, x, y0 + h / 2, BACK + 0.24, { top: P.glassDim });
  }
  L.box(bays * bw, 0.5, 0.3, P.mullion, wc, yf, BACK + 0.3);
  for (let i = 0; i <= bays; i++) L.box(0.9, y1 - y0 + 0.6, 0.5, P.mullion, w0 + i * bw, (y0 + y1) / 2, BACK + 0.4);
  L.box(bays * bw + 1, 0.8, 1.4, P.mullion, wc, y0 - 0.4, BACK + 0.7);
  L.box(bays * bw + 1, 0.8, 0.6, P.mullion, wc, y1 + 0.4, BACK + 0.35);
  steelDoor(B, 296, 11, 21);

  // 作業台（静電気の青いマット）と、その上下の黒い箱・垂れた線
  const bx = 238, bz = -44, len = 32;
  C.box(len, 0.9, 10, '#454f74', bx, 8.6, bz);
  L.box(len - 0.4, 0.15, 9.4, '#3a5684', bx, 9.12, bz);
  for (const s of [-1, 1]) for (const sz of [-1, 1]) L.box(0.9, 8.2, 0.9, P.steelDk, bx + s * (len / 2 - 0.8), 4.1, bz + sz * 4.2);
  L.box(len - 1, 0.6, 8.6, P.steelDk, bx, 2.4, bz);
  for (const s of [-1, 1]) L.box(0.8, 9.5, 0.8, P.steelDk, bx + s * (len / 2 - 0.75), 13.9, bz - 4.3);
  C.box(len, 0.7, 3.2, P.steelDk, bx, 17.2, bz - 3.4);                          // 計器の棚
  blackBox(B, bx - 9, 9.2, bz + 0.5, 8, 4.6, 6.5, P.green);
  blackBox(B, bx + 1, 9.2, bz + 1, 5, 6.2, 5.5, null);
  blackBox(B, bx + 9.5, 9.2, bz + 0.2, 7, 3.4, 6, P.amber);
  blackBox(B, bx + 9.5, 12.6, bz + 0.2, 6, 2.8, 5.4, null);
  blackBox(B, bx - 6, 17.55, bz - 3.4, 9, 4.4, 3, P.green);                   // 棚の上の計器（黒い箱）
  blackBox(B, bx + 7, 17.55, bz - 3.4, 6, 3.6, 3, null);
  blackBox(B, bx - 8, 3.0, bz, 9, 4, 7, null);                                // 下の段
  blackBox(B, bx + 6, 3.0, bz, 10, 3.2, 7, null);
  for (const [x, a] of [[bx - 5, 0.18], [bx + 3.5, -0.12], [bx + 12.5, 0.08]]) {   // 台の縁から垂れた線
    L.box(0.32, 6.5, 0.32, '#0e0f13', x, 5.9, bz + 5.25, { rz: a });
  }
  L.geo(new THREE.TorusGeometry(1.8, 0.28, 4, 14), '#0e0f13', bx + 2, 0.3, bz + 7.5, { rx: Math.PI / 2 });

  // 黒いラック（扉は閉じている。通気の穴の奥に小さな灯）
  const rx = 280, rz = -51, rh = 26;
  C.box(12, rh, 10, P.black, rx, rh / 2, rz);
  L.box(11, rh - 1.5, 0.2, '#1c1e26', rx, rh / 2, rz + 5.1);
  for (let y = 2.2; y < rh - 2; y += 1.25) L.box(8.6, 0.28, 0.1, '#0c0d11', rx - 0.5, y, rz + 5.25);
  L.box(0.4, 4, 0.5, P.handle, rx + 4.7, rh * 0.55, rz + 5.4);
  L.box(10, 0.4, 8, '#2a2c35', rx, rh + 0.2, rz);
  cautionSign(L, rx - 1, 20.5, rz + 5.3, 0.6);
  for (let i = 0; i < 8; i++) B.ledB.box(0.36, 0.26, 0.1, i % 3 ? P.green : P.amber, rx - 3.6 + (i % 4) * 1.1, 6 + Math.floor(i / 4) * 8.5, rz + 5.32);
  // 黒いケースの積み重ね（運搬用の頑丈な箱）
  for (const [y, w, h, d, dx] of [[0, 13, 4.6, 8.4, 0], [4.6, 12, 4.2, 8, 0.4], [8.8, 9, 3.6, 7, -0.6]]) {
    C.box(w, h, d, P.black, 214 + dx, y + h / 2, -51);
    L.box(w + 0.1, 0.35, d + 0.1, P.blackLt, 214 + dx, y + h - 0.6, -51);
    for (const s of [-1, 1]) L.box(1.2, 0.8, 0.5, P.handle, 214 + dx + s * (w / 2 - 2.2), y + h - 1.4, -51 + d / 2 + 0.2);
  }
  zonePlate(L, 197, 24.5, BACK, 2);
}

// ===== 輸出管理責任者（325〜460）: 曇りガラスの輸出管理室と、黒塗りの書類 =====
function paperStack(B, x, y, z, ry, n, seed, cover) {
  const L = B.lit;
  let top = y;
  for (let k = 0; k < n; k++) {
    const h = 1.1 + hash(seed, k) * 0.9, r = (hash(k, seed) - 0.5) * 0.24;
    L.box(4.2, h, 3.2, k % 2 ? P.paper : P.paperDk, x, top + h / 2, z, { ry: ry + r });
    top += h;
  }
  // 一番上の紙: 黒塗りの棒と、残った細い行
  const ry2 = ry + (hash(seed, 9) - 0.5) * 0.2;
  const c = Math.cos(ry2), s = Math.sin(ry2);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  if (cover) {
    const [cx2, cz2] = at(0, 0);
    L.box(4.0, 0.06, 3.0, cover, cx2, top + 0.03, cz2, { ry: ry2 });
    return top;
  }
  for (let i = 0; i < 6; i++) {
    const lz = -1.15 + i * 0.46, red = hash(seed, i + 20) < 0.62;
    const len = red ? 1.6 + hash(i, seed) * 1.8 : 2.4 + hash(seed, i) * 0.8;
    const lx = -1.6 + len / 2 + (red ? hash(seed + 3, i) * 0.6 : 0);
    const [px, pz] = at(lx, lz);
    L.box(len, red ? 0.05 : 0.03, red ? 0.34 : 0.12, red ? P.redact : P.ink, px, top + (red ? 0.03 : 0.018), pz, { ry: ry2 });
  }
  return top;
}

function docCart(B, x, z, ry, seed, noShadow) {
  const L = B.lit, C = noShadow ? B.lit : B.cast;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const put = (w, h, d, col, lx, y, lz, cast) => { const [px, pz] = at(lx, lz); (cast ? C : L).box(w, h, d, col, px, y, pz, { ry }); };
  put(13, 0.8, 7.2, '#3d4568', 0, 2.4, 0, true);                              // 荷台
  put(13.2, 0.4, 7.4, P.steelDk, 0, 2.95, 0);
  for (const lx of [-5.6, 5.6]) for (const lz of [-2.8, 2.8]) {               // 車輪
    put(0.8, 1.6, 1.6, P.black, lx, 0.8, lz);
    put(0.5, 0.6, 0.5, P.steelDk, lx, 1.8, lz);
  }
  for (const lz of [-3.1, 3.1]) put(0.6, 9.0, 0.6, P.steel, -6.2, 7.6, lz);    // 押し手
  put(0.7, 0.7, 7.0, P.steel, -6.2, 12.0, 0);
  // 書類の束（黒塗りの紙が上に。1つは赤い表紙＝扱い注意）
  const stacks = [[-3.2, -1.6], [1.4, -1.5], [-3.0, 1.8], [1.6, 1.7]];
  stacks.forEach(([lx, lz], i) => {
    const [px, pz] = at(lx, lz);
    paperStack(B, px, 3.15, pz, ry + (hash(seed, i) - 0.5) * 0.3, 2 + Math.floor(hash(i, seed) * 2), seed * 7 + i,
      i === 2 ? P.signRed : null);
  });
  const [bx, bz] = at(4.7, 0);
  L.box(2.4, 3.0, 6.4, P.manila, bx, 4.65, bz, { ry: ry + 0.04 });           // 綴じたファイル
  L.box(2.5, 0.5, 6.5, '#8f7546', bx, 6.4, bz, { ry: ry + 0.04 });
}

function exportOffice(B) {
  const L = B.lit, C = B.cast, U = B.un, BACK = B.BACK;
  const x0 = 342, x1 = 438, zf = -40, H = 27;
  const xc = (x0 + x1) / 2, zc = (zf + BACK) / 2, D = zf - BACK;
  // 腰壁＋曇りガラス。中は見えない（棚と机の影がぼんやり映るだけ）
  C.box(x1 - x0, 10, 1.2, P.panel, xc, 5, zf);
  L.box(x1 - x0 + 0.4, 0.6, 1.6, P.trim, xc, 10.1, zf);
  const yf = 22;
  U.box(x1 - x0, yf - 10.4, 0.2, P.glassDim, xc, (10.4 + yf) / 2, zf, { top: P.glass });
  U.box(x1 - x0, H - yf, 0.2, P.clear, xc, (yf + H) / 2, zf, { top: P.clearHi });
  L.box(x1 - x0, 0.5, 0.3, P.mullion, xc, yf, zf + 0.25);
  // ガラスに内側から貼られた通知（黒塗り）。文字は描かず、黒い棒と灰色の細い行だけ
  for (const [x, y, r] of [[349, 16.8, 0.03], [357.5, 17.4, -0.04], [419, 16.6, 0.02], [431, 17.2, -0.03]]) {
    L.box(3.4, 4.4, 0.06, P.paper, x, y, zf + 0.16, { rz: r });
    for (let i = 0; i < 6; i++) {
      const red = hash(x | 0, i) < 0.6, len = red ? 1.4 + hash(i, x | 0) * 1.2 : 2.4;
      L.box(len, red ? 0.36 : 0.14, 0.04, red ? P.redact : P.ink, x - 1.3 + len / 2, y + 1.6 - i * 0.62, zf + 0.21, { rz: r });
    }
  }
  for (const [x, w, h] of [[352, 8, 12], [366, 5, 9], [414, 9, 13], [428, 12, 4], [372, 4, 11]]) {
    U.box(w, h, 0.08, P.glassShade, x, 10.4 + h / 2, zf + 0.14, { top: P.glassDim });
  }
  const bays = 8, bw = (x1 - x0) / bays;
  for (let i = 0; i <= bays; i++) L.box(0.9, H - 10, 0.6, P.mullion, x0 + i * bw, (10 + H) / 2, zf + 0.35);
  L.box(x1 - x0 + 1, 1.6, 1.4, P.mullion, xc, H + 0.8, zf);
  // 横の面と屋根（閉じた部屋）
  for (const x of [x0, x1]) {
    L.box(1.2, 10, D, P.panel, x, 5, zc);
    U.box(0.2, yf - 10.4, D, P.glassDim, x, (10.4 + yf) / 2, zc, { top: P.glass });
    U.box(0.2, H - yf, D, P.clear, x, (yf + H) / 2, zc, { top: P.clearHi });
    L.box(0.6, H - 10, 0.6, P.mullion, x, (10 + H) / 2, zf + 0.2);
  }
  L.box(x1 - x0 + 2, 1.4, D + 1, P.frame, xc, H + 2.2, zc - 0.5);
  for (const x of [366, 410]) L.box(4.5, 2.4, D - 2, '#3a4064', x, H + 4.1, zc);   // 屋根の上の空調の箱
  // 扉（曇りガラスの扉に鍵）。扉の上の赤い灯、横の読み取り機
  const dx = 396;
  L.box(10.8, H - 9.6, 0.5, P.mullion, dx, (10 + H) / 2 - 4.6, zf + 0.42);
  U.box(9.4, 11.6, 0.12, P.glassDim, dx, 15.8, zf + 0.72, { top: P.glass });
  U.box(9.4, 2.4, 0.12, P.clear, dx, 22.9, zf + 0.72);
  L.box(9.4, 10, 0.3, P.panelDk, dx, 5, zf + 0.8);
  L.box(0.6, 3.8, 0.7, P.steel, dx + 3.6, 11.5, zf + 1.1);
  U.box(2.2, 0.8, 0.3, P.red, dx, H - 1.0, zf + 0.6);
  wallReader(B, dx - 7.6, 12, zf + 0.6);
  // 前に: 黒塗りの書類の台車、施錠された回収箱、書類箱の山
  docCart(B, 357, -32.4, 0.08, 3);
  docCart(B, 421, -32.0, -0.1, 5);
  // 回収箱（細い差し込み口と南京錠）
  C.box(6, 10.5, 5, '#4a5278', 377, 5.25, -33);
  L.box(6.3, 0.5, 5.3, '#3a4062', 377, 10.75, -33);
  L.box(3.6, 0.2, 0.8, P.redact, 377, 11.05, -32.3);
  L.box(0.9, 1.1, 0.5, '#2a2d36', 377, 8.2, -30.25);
  L.box(0.5, 0.6, 0.15, P.steel, 377, 9.0, -30.2);
  L.box(2.6, 2.6, 0.12, P.signBlue, 377, 5.5, -30.45);
  // 書類箱の山（段ボール。札は無地）
  const carton = (x, y, z, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    L.box(6.2, 4.0, 4.4, P.carton, x, y + 2.0, z, { ry });
    L.box(6.5, 0.9, 4.7, '#b59b6c', x, y + 3.6, z, { ry });
    const [hx, hz2] = at(0, 2.22), [lx, lz] = at(-1.6, 2.22);
    L.box(1.6, 0.6, 0.1, '#3a3020', hx, y + 2.6, hz2, { ry });                 // 手掛けの穴
    L.box(2.2, 1.2, 0.08, '#e6e2d6', lx, y + 1.6, lz, { ry });                 // 無地の札
  };
  carton(434, 0, -32.5, 0.03); carton(434.4, 4.1, -32.6, -0.06); carton(434.2, 8.2, -32.8, 0.1);
  zonePlate(L, 334, 24.5, BACK, 3);
  secCam(B, 381, 25.2, zf + 1.4, 4.3);                                       // 部屋の正面の上
}

// ===== 区間の外（460〜）: 詰所ともう1つの檻（場面を強制したときだけ見える）=====
function farSide(B) {
  const L = B.lit, C = B.cast, U = B.un;
  const b0 = 468, b1 = 486, bz0 = -36, bz1 = -52;
  C.box(b1 - b0, 20, bz0 - bz1, P.panel, (b0 + b1) / 2, 10, (bz0 + bz1) / 2);
  L.box(b1 - b0 + 2.4, 1.4, bz0 - bz1 + 2.4, P.frame, (b0 + b1) / 2, 20.7, (bz0 + bz1) / 2);
  U.box(b1 - b0 - 3, 8, 0.2, P.tint, (b0 + b1) / 2, 14.6, bz0 + 0.1, { top: P.tintHi });
  L.box(b1 - b0, 9.6, 0.3, P.panelDk, (b0 + b1) / 2, 4.8, bz0 + 0.15);
  exportZone(B, 500, 592, 546, [
    [520, -51, 20, 15, 12, 'navy', 41],
    [566, -50, 16, 9, 12, 'gray', 43],
  ]);
  zonePlate(L, 466, 24.5, B.BACK, 4);
}

// ===== 手前ゾーン（低い物だけ）=====
// 遮蔽の線（帯の手前端の人を、いちばん引いたカメラから見る線）: 足元 0.33·(z−25)、胴 9+0.28·(z−25)。
// 幅の広い物は手前の面（z0）で 足元の線＋3 まで、細い柱は 胴の線 まで。
// 手前の物は影を落とさない（影は奥ゾーンの大きな物だけ）。代わりに足元を床の濃い色で締める。
function front(B) {
  const L = B.lit;
  // 置き場の黄色い枠（床の線）と、置いた物の足元の濃い影
  const park = (x, z, w, d) => {
    for (const [bw, bd, bx, bz] of [[w, 0.6, x, z - d / 2], [w, 0.6, x, z + d / 2], [0.6, d, x - w / 2, z], [0.6, d, x + w / 2, z]]) {
      L.box(bw, 0.04, bd, P.yellow, bx, 0.08, bz);
    }
    L.box(w - 2.6, 0.02, d - 2.6, P.contact, x, 0.06, z);
  };
  park(102, 51, 19, 14); park(154, 55, 15, 12); park(250, 51, 18, 11.5); park(382, 51, 18, 11.5); park(536, 52, 19, 14);
  // 携帯電話の預けロッカー（z0=50: 足元の線 8.3 → 天板まで 8.8）
  const locker = (x, cols) => {
    const w = cols * 3.4 + 0.6, h = 8.4, z = 52;
    L.box(w, h, 4, '#4c567e', x, h / 2, z);
    L.box(w + 0.3, 0.4, 4.3, '#3a4268', x, h + 0.2, z);
    for (let c = 0; c < cols; c++) for (let r = 0; r < 3; r++) {
      const dx = x - w / 2 + 0.3 + 1.7 + c * 3.4, dy = 1.2 + r * 2.5;
      L.box(3.0, 2.2, 0.12, '#5a6590', dx, dy + 1.1, z + 2.06);
      L.box(0.35, 0.5, 0.12, '#1c1f28', dx + 0.9, dy + 1.2, z + 2.16);
      if (hash(c, r + cols) < 0.3) L.box(0.5, 0.9, 0.1, ['#d6742d', '#4a78cc'][(c + r) % 2], dx + 0.9, dy + 0.55, z + 2.2);
    }
  };
  locker(-62, 6); locker(-39, 5);
  L.box(46, 0.02, 7, P.contact, -50.5, 0.06, 52);
  // 仕切りのポールと帯（z=47: 胴の線 15.2 → 柱 9.9、帯 8.3〜9.1 は足元の線 7.3＋1.8）
  for (let i = 0, x = -22; x <= 26; x += 12, i++) {
    L.box(2.8, 0.5, 2.8, '#1c1f28', x, 0.25, 47);
    L.box(0.7, 9.0, 0.7, P.steel, x, 4.9, 47);
    L.box(1.0, 0.6, 1.0, '#c9cfdc', x, 9.6, 47);
    if (x + 12 <= 26) L.box(11.3, 0.8, 0.12, '#3456a6', x + 6, 8.7, 47);
  }
  // 黒いケースのパレット（z0=46: 足元の線 6.9 → 高さ 7.8）
  const pallet = (x, z) => {
    L.box(14, 1.2, 10, '#3a4058', x, 0.6, z);
    for (const lx of [-3.4, 3.4]) {
      L.box(6.2, 3.6, 9, P.black, x + lx, 3.0, z);
      L.box(6.3, 0.35, 9.1, P.blackLt, x + lx, 4.2, z);
      for (const s of [-1, 1]) L.box(1.1, 0.7, 0.4, P.handle, x + lx + s * 1.8, 3.6, z + 4.6);
    }
    L.box(7, 2.8, 8, P.black, x - 0.6, 6.2, z);
    L.box(1.0, 0.2, 10.2, P.strap, x - 2.5, 7.65, z);
    L.box(1.0, 0.2, 10.2, P.strap, x + 1.5, 7.65, z);
  };
  pallet(102, 51);
  pallet(536, 52);
  // 覆いを掛けた低い台車（z0=51: 足元の線 8.6 → 高さ 6.6）
  const dolly = (x, z, tone, seed) => {
    L.box(11, 0.8, 8, P.steelDk, x, 1.4, z);
    for (const lx of [-4.4, 4.4]) for (const lz of [-3, 3]) L.box(0.7, 1.0, 1.0, P.black, x + lx, 0.5, z + lz);
    const col = tone === 'black' ? P.tarpBk : P.tarp;
    L.box(9.6, 4.6, 6.6, col, x, 4.1, z);
    L.box(10.6, 1.4, 7.6, col, x, 2.4, z);
    for (let i = 0; i < 4; i++) L.box(0.5, 3.2, 0.4, i % 2 ? P.tarpLt : P.tarpDk, x - 3.6 + i * 2.4, 4.4, z + 3.4 + hash(seed, i) * 0.2);
    L.box(0.8, 0.2, 7.4, P.strap, x + 1.5, 6.5, z);
  };
  dolly(154, 55, 'navy', 11);
  // 黒い箱の台車（z0=47: 箱は 7.4、押し手の細い柱は 11.6）
  {
    const x = 250, z = 51;
    L.box(13, 0.8, 7.2, '#3d4568', x, 2.4, z);
    for (const lx of [-5.6, 5.6]) for (const lz of [-2.8, 2.8]) L.box(0.8, 1.6, 1.6, P.black, x + lx, 0.8, z + lz);
    for (const lz of [-3.1, 3.1]) L.box(0.6, 8.6, 0.6, P.steel, x + 6.2, 7.1, z + lz);
    L.box(0.7, 0.7, 7.0, P.steel, x + 6.2, 11.2, z);
    blackBox(B, x - 2.6, 2.8, z, 6.5, 3.6, 5.6, null);
    blackBox(B, x + 2.6, 2.8, z - 0.2, 3.8, 4.6, 5.2, null);
  }
  // 黒塗りの書類の台車（z0=47: 束は 9.2 まで、押し手の細い柱は 12.4）
  docCart(B, 382, 51, 3.14159 - 0.06, 9, true);
}

// ===== 場面を建てる =====
export function build(W, halfD, ctx = {}) {
  S = null;
  const stage = (ctx && ctx.stage) || null;
  const { BACK, FRONT } = zones(halfD, 40, 66);   // 奥の壁 z=−68、手前の端 z=94

  setLighting(false);
  hemi.color.set(LIGHT.hemi); hemi.groundColor.set(LIGHT.ground); hemi.intensity = LIGHT.hi;
  sun.color.set(LIGHT.sun); sun.intensity = LIGHT.si;
  fill.intensity = LIGHT.fi;                      // fill の色は他の場面が戻さないので触らない
  scene.background = hex(P.bg);
  scene.fog = new THREE.Fog(hex(P.bg), 280, 900);

  const T = textures();
  const B = {
    lit: batch(), cast: batch(), un: batch(), glow: batch(), haz: batch(), fence: batch(),
    ledA: batch(), ledB: batch(), cams: [], gates: [], BACK, FRONT,
  };
  const XL = -170, XR = Math.max(W + 90, 680);

  shell(B, XL, XR);
  zoneBands(B, XL, XR);
  entry(B);
  exportZone(B, 70, 170, 118, [
    [92, -51, 22, 16, 13, 'navy', 1],
    [129, -55, 11, 21, 9, 'black', 2],
    [154, -47, 14, 8, 10, 'gray', 3],
  ]);
  lab(B);
  exportOffice(B);
  farSide(B);
  GATES.forEach((_, i) => gate(B, i));
  front(B);
  // 高い所の監視カメラ（壁の下がった天井の縁）。区画の中のものは各区画で置いてある
  for (const [x, ph] of [[-112, 0.2], [-30, 1.1], [238, 2.4], [640, 2.2]]) {
    secCam(B, x, 26.9, BACK + 5.5, ph);
  }

  B.cast.done(lambert(), { cast: true });
  B.lit.done(lambert());
  B.un.done(basic(), { receive: false });
  B.haz.done(new THREE.MeshLambertMaterial({ map: T.hazard }));
  B.fence.done(new THREE.MeshLambertMaterial({
    map: T.mesh, transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.04,
  }), { receive: false, order: 1 });
  B.glow.done(basic({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    { receive: false, order: 2 });
  const ledA = B.ledA.done(basic(), { receive: false });
  const ledB = B.ledB.done(basic(), { receive: false });

  S = { stage, gates: B.gates, cams: B.cams, ledA, ledB, t: 0, opened: false };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function onEvent(name, arg) {
  const s = S;
  if (!s) return;
  if (name === 'reveal' || name === 'defeated') { s.opened = true; return; }
  if (name !== 'tick' || !arg) return;
  const dt = Math.min(0.1, Math.max(0, arg.dt || 0));
  s.t += dt;
  const p = s.stage && s.stage.player;
  const px = p ? wx(p.x) : null, pz = p ? wz(p.y) : 0;

  // ゲートの灯: 梁の下を通るあいだだけ緑。過ぎたらまた赤（後ろで閉じる）
  for (const g of s.gates) {
    const open = s.opened || (px != null && Math.abs(px - g.x) < 12);
    if (open !== g.open) { g.open = open; g.mat.color.set(open ? P.green : P.red); }
  }

  // 監視カメラ: 近ければ自機の方へ首を振る。遠ければゆっくり見回す。開いたら下を向いて止まる
  const k = Math.min(1, dt * 2.4);
  for (const c of s.cams) {
    let yaw, pitch;
    if (s.opened) { yaw = 0; pitch = 1.1; }
    else if (px != null && Math.abs(px - c.x) < 130) {
      const dx = px - c.x, dz = pz - c.z;
      yaw = clamp(Math.atan2(dx, dz), -1.25, 1.25);
      pitch = clamp(Math.atan2(c.y - 9, Math.hypot(dx, dz)), 0.12, 0.9);
    } else { yaw = Math.sin(s.t * 0.35 + c.ph) * 0.8; pitch = 0.42; }
    c.yaw += (yaw - c.yaw) * k;
    c.pitch += (pitch - c.pitch) * k;
    c.pivot.rotation.y = c.yaw;
    c.pivot.rotation.x = c.pitch;
  }

  // 小さな灯の瞬き（読み取り機・カメラは赤、機材は緑と橙。周期をずらす）
  if (s.ledA) s.ledA.visible = (s.t % 1.7) > 0.2;
  if (s.ledB) s.ledB.visible = ((s.t + 0.6) % 2.3) > 0.35;
}

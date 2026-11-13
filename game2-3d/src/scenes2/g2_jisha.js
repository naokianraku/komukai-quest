// 小向クエスト2 ゴールデンエイジ編 — 帰社（自社の執務室）。第2〜5章で共通に使う。
//
// 外で殴られ、帰ってきて中でも殴られる場所。「帰社 — PM（課長）」の区間の背景。
// 本編の執務室の数年前という見立てで、同じ会社の骨格（白い壁・連窓・灰色のタイルカーペット）に
// 古い道具を置く: 片袖のスチール机、箱型（ブラウン管）のモニター、電話、書類の山、バインダー、図面筒。
// 机のアクリル板はまだ無い。看板・白板・掲示物に文字は描かない（無地の板と色の棒だけ）。
//
// 見せ場は「自分と同期の4つの席」。島の手前の列に 自分・設計・現場・品証 の順で並べ、
// 残っている同期（game.roster）に入っていない人の席は、椅子を机に押し込み、机の上を空にする。
// 章が進むほど空席が増える（第4章で品証、第5章で現場）。居る人の椅子は引き出されて斜めを向き、
// 背もたれにその人の配属先の色のヘルメットが掛かっている（このカメラは奥行きが詰まって見えるので、
// 椅子の出し入れだけでは空席が読めない。ヘルメットの有無と机の上の有無で見せる）。
// 課長（PM）の机は島の右、窓を背にして置く。課長はそこから立って来る。
//
// 章ごとの違い（坂の値 slope 0.2→0.82 に沿う）:
//   光 … 第2章は普通の蛍光灯。先の章ほど少し暗く、冷たく
//   窓の外 … 昼 → 曇りの夕方 → 日暮れ → 夜（帰社がだんだん遅くなる）。時計も 15時台 → 22時台
//   ほかの島 … 遅い章ほど帰った人が増える（椅子が入り、画面が消えている）
//   書類の山 … 高くなる。白板の遅れ（赤い棒）も増える
// 動く物（onEvent の tick）: 時計の秒針と、白板の「遅れ」の赤い棒（残工期が減るほど伸びる）。
//
// 描画の回数を食わないよう、動かない物はまとめて描く。箱は boxBatch（影あり・なしの2回）、
// 丸い物・回した物・自発光（画面・窓の外）・ガラスは下の geoBatch（最大4回）。
import {
  THREE, wx, box, boxBatch, addScenery, zones, setLighting, ceilingSlab, scene, hemi, sun, fill,
} from '../../../game3d/src/render3d.js';

// ===== 色 =====
const C = {
  floor: '#4b5056', floorTile: '#484d53',
  wall: '#e3e2da', skirting: '#9ea29d',
  frame: '#a7aeb3', sill: '#cfd4d6', blind: '#e6e7e2', blindRail: '#c4c8c6',
  cabinet: '#cfd1ca', cabinetLine: '#a6a9a2', handle: '#80858b', shelfBack: '#9a9e98',
  desk: '#bfc2bc', deskTop: '#d3d5cf', deskEdge: '#9fa39e', drawer: '#c8cbc5', mat: '#5d8a71',
  chair: '#7c828a', metal: '#6f757c',          // 灰色の布張り（古い型）。色のヘルメットが映える
  pmTop: '#7a6048', pmBody: '#b2b0a7', pmChair: '#4a3f3c', pmMat: '#3b5646',
  crt: '#d4cfc0', crtDark: '#b5af9f', screenOff: '#2b3238',
  phone: '#d0cbbd', phoneDark: '#7e7a70', pc: '#d8d3c4',
  paper: ['#f4f3ee', '#e8e6dd', '#efe9d6', '#f7f6f2'],
  folder: ['#e2cd96', '#c9dce9', '#f0c8b8'],
  binder: ['#2f5a8f', '#8f3a2e', '#3f6e46', '#e2dfd2', '#7a6a2e', '#4a4f8a', '#2c3e50', '#e2dfd2'],
  board: '#f6f7f3', boardFrame: '#9aa1a6', cork: '#ae895c', corkFrame: '#7e6142',
  cardboard: '#b8956a', fileBox: '#e9e7de', tube: '#2c2f34',
};
// ヘルメットの色は配属先の色（stages2.js の PALETTES2 の h と同じ）。現場はキャップ。
const OWNER = {
  player:       { helmet: '#36b06a' },
  douki_sekkei: { helmet: '#4a7ad0' },
  douki_genba:  { helmet: '#44507a', cap: true },
  douki_hinsho: { helmet: '#9a6ad0' },
};
const DOUKI = ['douki_sekkei', 'douki_genba', 'douki_hinsho'];
const MUGS = ['#f2f0ea', '#d9534f', '#3f6fae', '#e8c85a'];
const SEATS = ['player', 'douki_sekkei', 'douki_genba', 'douki_hinsho'];   // 島の手前の列、左から

// 章ごとの「帰社した時刻」（時計の針）。窓の外の明るさと合わせてある
const CLOCK = { 2: [15, 40], 3: [17, 55], 4: [19, 50], 5: [22, 20] };

const DT = 8.4;          // 机の天板の中心の高さ（本編の執務室と同じ）
const TOP = DT + 0.5;    // 天板の上面
const ZN = -41;          // 島の手前の列（自分たちの席）の机の中心
const ZF = -53;          // 島の奥の列（先輩たちの席）

// ===== 動かす物（build のたびに作り直す。前の章の参照を残さない）=====
let secHand = null;      // 時計の秒針（回すための Group）
let secBase = 0;         // 帰社した時刻の秒
let delayBar = null;     // 白板の遅れの赤い棒
let delayX0 = 0;         // 赤い棒の左端
let delayLen = 0;        // 赤い棒が伸びきったときの長さ

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const _ca = new THREE.Color(), _cb = new THREE.Color();
function mix(a, b, t) { _ca.set(a); _cb.set(b); _ca.lerp(_cb, clamp01(t)); return '#' + _ca.getHexString(); }
function mixStops(stops, t) {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
// 位置から決まる乱数。建て直しても同じ机に同じ物が載る
function rng(seed) {
  let s = (Math.floor(Math.abs(seed) * 7919 + 104729) >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ===== まとめ描き（丸い物・回した物・自発光・ガラス）=====
// boxBatch と同じ考え方で、形を問わず頂点カラーの1メッシュにまとめる。
//   plain: 影を受けるだけ / cast: 影も落とす / glow: 光を受けない（画面・窓の外）/ glass: 半透明
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const DOME = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const BALL = new THREE.IcosahedronGeometry(1, 0);
function geoBatch() {
  const groups = { cast: [], plain: [], glow: [], glass: [] };
  const api = {
    add(tpl, color, x, y, z, o = {}) {
      const g = tpl.clone();
      g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      groups[o.kind || 'plain'].push([g, color]);
    },
    box(w, h, d, color, x, y, z, o = {}) { api.add(UNIT_BOX, color, x, y, z, { ...o, sx: w, sy: h, sz: d }); },
    cyl(r, h, color, x, y, z, o = {}) { api.add(CYL, color, x, y, z, { ...o, sx: r, sy: h, sz: r }); },
    done(glassOpacity) {
      for (const kind of Object.keys(groups)) {
        const list = groups[kind];
        if (!list.length) continue;
        let nv = 0, ni = 0;
        for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
        const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
        const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
        const c = new THREE.Color();
        let v = 0, k = 0;
        for (const [g, color] of list) {
          c.set(color);   // linear に直った値。頂点カラーにそのまま入れてよい（boxBatch と同じ）
          const n = g.attributes.position.count;
          pos.set(g.attributes.position.array, v * 3);
          nor.set(g.attributes.normal.array, v * 3);
          for (let i = 0; i < n; i++) { col[(v + i) * 3] = c.r; col[(v + i) * 3 + 1] = c.g; col[(v + i) * 3 + 2] = c.b; }
          if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[k++] = v + I[i]; }
          else for (let i = 0; i < n; i++) idx[k++] = v + i;
          v += n;
          g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        const mat = kind === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true })
          : kind === 'glass' ? new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: glassOpacity, depthWrite: false })
          : new THREE.MeshLambertMaterial({ vertexColors: true });
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = kind === 'cast';
        m.receiveShadow = kind === 'cast' || kind === 'plain';
        m.matrixAutoUpdate = false; m.updateMatrix();
        addScenery(m);
        list.length = 0;
      }
    },
  };
  return api;
}

// 組み立て物を Y 軸まわりに回して置く。局所座標 (dx, y, dz) → 世界座標
function placer(b, ox, oz, rot, cast) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return (w, h, d, color, dx, y, dz) =>
    b.box(w, h, d, color, ox + dx * c + dz * s, y, oz - dx * s + dz * c, { cast, rotY: rot });
}

// ===== 家具と小物 =====
// 事務椅子。局所座標で座る人は -z を向き、背もたれは +z 側。rot で向きを変える。
function chairAt(b, x, z, rot, color, cast) {
  const p = placer(b, x, z, rot, cast);
  p(6.4, 0.9, 6.2, color, 0, 5.4, 0);                 // 座面
  p(6.2, 4.4, 0.8, color, 0, 11.3, 2.9);              // 背もたれ
  p(1.0, 3.4, 0.6, '#5d6268', 0, 7.5, 2.9);           // 背の支柱
  p(1.1, 4.5, 1.1, '#8f959b', 0, 2.75, 0);            // ガス柱
  for (let k = 0; k < 3; k++) {                        // 五本脚（3本の棒を星形に重ねる）
    b.box(5.4, 0.5, 0.9, C.metal, x, 0.45, z, { cast: false, rotY: rot + k * Math.PI / 3 + 0.2 });
  }
}

// 課長の椅子。背の高い黒い椅子に肘掛け。座る人は局所 -z を向く
function bossChairAt(b, x, z, rot) {
  const p = placer(b, x, z, rot, true);
  p(7.6, 1.2, 7.2, C.pmChair, 0, 5.7, 0);
  p(7.8, 11.0, 1.2, C.pmChair, 0, 14.2, 3.4);         // 高い背もたれ（窓の下端にかかる）
  p(7.2, 1.2, 1.6, '#5a4d49', 0, 19.6, 3.2);          // 頭当て
  p(0.9, 0.7, 4.6, '#3a3b40', -4.1, 9.0, 0.6);        // 肘掛け
  p(0.9, 0.7, 4.6, '#3a3b40', 4.1, 9.0, 0.6);
  p(0.7, 3.0, 0.7, '#3a3b40', -4.1, 7.2, 1.6);
  p(0.7, 3.0, 0.7, '#3a3b40', 4.1, 7.2, 1.6);
  p(1.3, 4.6, 1.3, '#8f959b', 0, 2.8, 0);
  for (let k = 0; k < 3; k++) b.box(6.2, 0.6, 1.0, C.metal, x, 0.45, z, { rotY: rot + k * Math.PI / 3 + 0.2 });
}

// 片袖のスチール机。side=+1 は使う人が +z 側（袖の引き出しが +z を向く）。bare は片付いた机（マットも無い）
function deskAt(b, x, z, side, cast, bare) {
  const p = (w, h, d, c, dx, y, dz) => b.box(w, h, d, c, x + dx, y, z + dz * side, { cast });
  p(22, 1.0, 12, C.deskTop, 0, DT, 0);                  // 天板
  p(21.4, 0.5, 11.4, C.deskEdge, 0, DT - 0.75, 0);      // 天板下の見切り
  p(7.6, 7.4, 10.8, C.desk, 6.8, 3.9, -0.3);            // 袖（引き出し3段）
  for (let i = 0; i < 3; i++) {
    p(6.9, 2.1, 0.2, C.drawer, 6.8, 1.5 + i * 2.4, 5.15);
    p(2.2, 0.35, 0.35, C.handle, 6.8, 2.1 + i * 2.4, 5.4);
  }
  p(1.0, 7.4, 11.0, C.desk, -10.5, 3.9, 0);             // 脇板
  p(16, 5.6, 0.7, C.desk, -2.0, 4.8, -5.4);             // 幕板（使う人と反対側）
  if (!bare) p(15.5, 0.2, 9.0, C.mat, -1.5, TOP + 0.1, 0.6);   // 緑のデスクマット
}

// 箱型（ブラウン管）のモニター。(x, z) は前面の中心。rot=0 で画面が +z を向く。
// screen: null なら消えている。{ base, inner, lines } で画面の色
function crtAt(b, g, x, z, rot, screen, cast = true) {
  const p = placer(b, x, z, rot, cast);
  const y0 = TOP + 0.6;
  p(5.4, 4.7, 0.8, C.crt, 0, y0 + 2.35, 0);           // ベゼル
  p(4.8, 4.1, 2.4, C.crt, 0, y0 + 2.3, -1.6);         // 胴
  p(3.0, 2.6, 1.6, C.crtDark, 0, y0 + 2.1, -3.5);     // 管の後ろ
  p(3.6, 0.35, 3.2, C.crt, 0, TOP + 0.18, -1.2);      // 台座
  p(1.8, 0.5, 1.8, C.crtDark, 0, TOP + 0.55, -1.2);   // 首振りの台
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  const yc = y0 + 2.45;
  const [sx, sz] = at(0, 0.44);
  if (!screen) { g.box(4.3, 3.5, 0.06, C.screenOff, sx, yc, sz, { ry: rot }); return; }
  g.box(4.3, 3.5, 0.06, screen.base, sx, yc, sz, { ry: rot, kind: 'glow' });
  if (screen.inner) { const [ix, iz] = at(0.3, 0.5); g.box(3.0, 2.2, 0.04, screen.inner, ix, yc - 0.2, iz, { ry: rot, kind: 'glow' }); }
  if (screen.lines) {
    for (let i = 0; i < 3; i++) {
      const [lx, lz] = at(-0.4 + i * 0.3, 0.52);
      g.box(2.6 - i * 0.5, 0.14, 0.04, screen.lines, lx, yc + 0.9 - i * 0.8, lz, { ry: rot, kind: 'glow' });
    }
  }
}

// 電話。face は受話器と反対側（使う人の側）の向き
function phoneAt(b, x, z, face, color = C.phone) {
  b.box(3.0, 0.9, 2.4, color, x, TOP + 0.45, z);
  b.box(3.1, 0.55, 0.9, C.phoneDark, x, TOP + 1.18, z - 0.65 * face);
  b.box(1.6, 0.08, 1.0, '#9a9d9f', x + 0.4, TOP + 0.94, z + 0.5 * face);
  b.box(0.5, 0.1, 0.5, '#b03a2e', x - 1.0, TOP + 0.95, z + 0.7 * face);   // 保留ボタン
}

// 書類の山。束ごとに少しずらし、色の違う束（黄ばんだ紙・フォルダ）を挟む
function pileAt(b, x, y0, z, h, r) {
  let y = y0;
  while (y < y0 + h - 0.05) {
    const t = Math.min(0.5 + r() * 1.1, y0 + h - y);
    const col = r() < 0.18 ? pick(r, C.folder) : pick(r, C.paper);
    b.box(3.3, t, 2.4, col, x + (r() - 0.5) * 0.5, y + t / 2, z + (r() - 0.5) * 0.4, { rotY: (r() - 0.5) * 0.3 });
    y += t;
  }
}

// 立てたバインダーの列。背（face 側）に文字の無い白いラベル
function bindersAt(b, x0, y0, z, n, face, r, cols = C.binder) {
  let x = x0;
  for (let i = 0; i < n; i++) {
    const t = 0.7 + r() * 0.5, h = 3.4 + r() * 0.6;
    b.box(t, h, 3.0, pick(r, cols), x + t / 2, y0 + h / 2, z);
    b.box(t * 0.55, 0.8, 0.06, '#eeeadf', x + t / 2, y0 + h * 0.72, z + face * 1.53);
    x += t + 0.06;
  }
  return x;
}

// 椅子の背もたれに掛けたヘルメット。椅子と同じ回転で背もたれの上に載せる
function helmetOnChair(g, x, z, rot, owner) {
  const o = OWNER[owner];
  const lx = 0, lz = 2.9;
  const hx = x + lx * Math.cos(rot) + lz * Math.sin(rot), hz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
  g.add(DOME, o.helmet, hx, 13.3, hz, { sx: 1.7, sy: 1.5, sz: 1.7, ry: rot });
  if (o.cap) {
    const vx = hx - 1.9 * Math.sin(rot), vz = hz - 1.9 * Math.cos(rot);           // つばは座る人の側
    g.box(2.4, 0.18, 1.6, o.helmet, vx, 13.45, vz, { ry: rot });
  } else g.cyl(2.05, 0.2, o.helmet, hx, 13.4, hz);
}

// 図面筒。端に色のついた蓋
function tubeAt(g, x, y, z, len, rz, rx, ry, cap, body) {
  g.cyl(0.45, len, body || C.tube, x, y, z, { rz, rx, ry });
  const v = new THREE.Vector3(0, len / 2, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), rx || 0)
    .applyAxisAngle(new THREE.Vector3(0, 0, 1), rz || 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0);
  g.cyl(0.52, 0.7, cap, x + v.x, y + v.y, z + v.z, { rz, rx, ry });
}

// 席の机の上。owner は SEATS のどれか（null は島のほかの人）。side=+1 は使う人が +z 側。
// 天板（22×12）の置き場所: 奥の端に バインダー・モニター・電話、真ん中に書類の山、手前に キーボード・湯のみ。
function dressDesk(b, g, x, z, side, owner, s, r, opts = {}) {
  const zz = (d) => z + d * side;
  const yMat = TOP + 0.2;
  const scr = opts.screen === undefined ? { base: '#5a7f9e', inner: '#c9d8e2' } : opts.screen;
  crtAt(b, g, x + 2.5 + (r() - 0.5) * 1.2, zz(-1.4), (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.24, scr, opts.cast);
  b.box(4.8, 0.4, 1.7, '#cfcabc', x + 2.6, yMat + 0.2, zz(2.6));                   // キーボード
  phoneAt(b, x + 8.6, zz(-2.6), side);
  bindersAt(b, x - 10.4, yMat, zz(-4.1), 3 + Math.floor(r() * 3), side, r);        // 奥の端に立てたバインダー
  const grow = (1 + 0.9 * s) * (opts.pileMul || 1);                              // 遅い章ほど山が高い
  if (owner === 'douki_hinsho') {
    bindersAt(b, x - 8.2, yMat, zz(-0.9), 5, side, r, ['#2f5a8f', '#e2dfd2', '#2f5a8f', '#e2dfd2']);   // 検査記録
  } else {
    pileAt(b, x - 5.4, yMat, zz(-0.6), Math.min(7, (1.2 + r() * 2.4) * grow), r);
  }
  if (r() < 0.7 || owner === 'player') pileAt(b, x + 8.4, yMat, zz(1.6), Math.min(5, (0.8 + r() * 1.8) * grow), r);
  if (owner !== 'douki_hinsho' && r() < 0.6) g.cyl(0.55, 1.1, pick(r, MUGS), x - 1.3, yMat + 0.55, zz(3.6));
}

// ===== 窓の外 =====
// 遠くの棟と手前の建屋の陸屋根。光を受けない（glow）。昼 → 夕方 → 日暮れ → 夜。
function outside(g, W, BACK, s, r) {
  const sky = mixStops([[0, '#a3cbe9'], [0.25, '#b7c2cb'], [0.5, '#6e7b95'], [0.78, '#1e293e'], [1, '#121a28']], s);
  g.box(W + 420, 170, 1, sky, W / 2, 40, BACK - 44, { kind: 'glow' });
  // 地平の帯。夕方〜夜は街の明かりで少し明るい
  const haze = mixStops([[0, '#c6dcec'], [0.25, '#c9cfd2'], [0.5, '#8f8f9c'], [0.78, '#3b3f52'], [1, '#262a38']], s);
  g.box(W + 420, 8, 1, haze, W / 2, 9, BACK - 43, { kind: 'glow' });
  const bA = mixStops([[0, '#8b9aaa'], [0.25, '#8f979f'], [0.5, '#525d76'], [0.78, '#1b2332']], s);
  const bB = mixStops([[0, '#7b8a9b'], [0.25, '#818991'], [0.5, '#48526a'], [0.78, '#161d2b']], s);
  const winDay = mixStops([[0, '#5d7086'], [0.25, '#66717c'], [0.5, '#3a4458']], s);
  const litP = clamp01((s - 0.3) / 0.45) * 0.55;
  for (let i = 0, x = -90; x < W + 130; i++) {
    const w = 28 + (i % 3) * 13, h = 15 + ((i * 7) % 5) * 2.6;
    const zf = BACK - 30 - (i % 2) * 4;
    g.box(w, h, 6, i % 2 ? bA : bB, x + w / 2, h / 2 + 2, zf, { kind: 'glow' });
    const floors = Math.floor((h - 4) / 3.2);
    for (let f = 0; f < floors; f++) {
      const y = 5.2 + f * 3.2;
      if (s < 0.45) g.box(w - 3, 1.1, 0.2, winDay, x + w / 2, y, zf + 3.3, { kind: 'glow' });
      else {
        for (let c2 = 0; c2 < Math.floor((w - 3) / 3.3); c2++) {
          if (r() < litP) g.box(2.1, 1.3, 0.2, r() < 0.7 ? '#f0d38e' : '#d6eaf4', x + 2.8 + c2 * 3.3, y, zf + 3.3, { kind: 'glow' });
        }
      }
    }
    x += w + 5 + (i % 4) * 6;
  }
  // 煙突（構内の工場らしさ）。夜は先に赤い航空障害灯
  for (let x = 150; x < W; x += 410) {
    g.box(4.4, 26, 4.4, bA, x, 15, BACK - 26, { kind: 'glow' });
    if (s > 0.45) g.box(1.2, 1.2, 1.2, '#ff4a3a', x, 28.6, BACK - 23.6, { kind: 'glow' });
  }
  // 手前の建屋の陸屋根。見下ろしているので窓の下寄りに屋上が入る
  const roof = mixStops([[0, '#6f777e'], [0.25, '#70767b'], [0.5, '#474d58'], [0.78, '#1a1f27']], s);
  const roofTop = mixStops([[0, '#8e969c'], [0.25, '#8c9196'], [0.5, '#5b616c'], [0.78, '#262b34']], s);
  g.box(W + 420, 16, 12, roof, W / 2, 10, BACK - 12, { kind: 'glow' });
  g.box(W + 420, 1.4, 1.6, roofTop, W / 2, 18.6, BACK - 6.4, { kind: 'glow' });
  for (let i = 0, x = -30; x < W + 60; x += 70 + (i % 3) * 9, i++) {
    const dz = BACK - 13 - (i % 2) * 3;
    g.box(10, 4.4, 7, roofTop, x, 20.0, dz, { kind: 'glow' });            // 屋上の室外機
    g.box(6.5, 1.2, 5, roof, x, 22.6, dz, { kind: 'glow' });
  }
}

// ===== 場面を建てる =====
export function build(W, halfD, ctx = {}) {
  secHand = null; delayBar = null; secBase = 0; delayX0 = 0; delayLen = 0;
  const data = ctx.data || null;
  const st = ctx.stage || null;
  const id = (data && data.id) || 2;
  const slope = data && typeof data.slope === 'number' ? data.slope : ({ 2: 0.2, 3: 0.4, 4: 0.6, 5: 0.82 }[id] ?? 0.2);
  const s = clamp01((slope - 0.2) / 0.8);     // 第2章 0 → 第5章 0.78
  const { BACK, FRONT } = zones(halfD, 46, 70);

  // --- 光。第2章は普通の蛍光灯。先の章ほど少し暗く冷たく ---
  setLighting(false);
  hemi.color.set(mix('#eef5fa', '#c8d5e8', s));
  hemi.groundColor.set(mix('#8a9198', '#4c5563', s));
  hemi.intensity = 2.1 - 0.62 * s;
  sun.color.set(mix('#fdfeff', '#d2def2', s));
  sun.intensity = 0.95 - 0.26 * s;
  fill.intensity = 1.0 - 0.16 * s;
  const bg = mix('#dfe1dc', '#8a93a0', s);
  scene.background = new THREE.Color(bg);
  scene.fog = new THREE.Fog(new THREE.Color(bg), 320, 900);

  // --- 区間の位置。PM の波の少し手前を中心に、島と課長の机が戦う間ずっと画面に入るよう置く ---
  let segGX = null, pmX = null;
  if (data) {
    const seg = (data.scenes3d || []).find((q) => q.scene === 'g2_jisha');
    if (seg) segGX = seg.x;
    const pw = (data.waves || []).find((w) => (w.enemies || []).some((e) => e.type === 'pm'));
    if (pw) pmX = wx(pw.x);
  }
  const F = pmX != null ? pmX - 20 : segGX != null ? wx(segGX) + 45 : W * 0.7;

  // --- 抜けた同期。roster に居ない人と、この区間に来るまでに章のデータで抜ける人 ---
  // （?demo= で途中から始めると離脱の処理を通らず roster が古いままなので、データでも見る）
  const gone = new Set();
  const roster = st && st.game && Array.isArray(st.game.roster) ? st.game.roster : null;
  if (roster) for (const t of DOUKI) if (!roster.includes(t)) gone.add(t);
  if (data && segGX != null) {
    for (const l of data.doukiLeave || []) {
      const w = (data.waves || [])[l.wave - 1];
      if (w && w.x - 130 < segGX) gone.add(l.type);
    }
  }

  const b = boxBatch();
  const g = geoBatch();
  const r = rng(id * 31 + 7);

  // ===== 床 =====
  b.box(W + 160, 2, FRONT - BACK, C.floor, W / 2 + 30, -1, (FRONT + BACK) / 2);   // 右端の島がはみ出しても床がある
  // タイルカーペットの市松。目地の向きで色がわずかに違って見える
  const T = 10;
  for (let ix = 0, x = -40; x < W + 40; x += T, ix++) {
    for (let iz = 0, z = BACK; z < FRONT; z += T, iz++) {
      if ((ix + iz) & 1) b.box(T, 0.04, T, C.floorTile, x + T / 2, 0.02, z + T / 2);
    }
  }
  // 通路（歩行帯）の縁の見切り
  for (const z of [-halfD + 1, halfD - 1]) b.box(W + 80, 0.06, 0.5, '#5c6168', W / 2, 0.05, z);

  // ===== 奥の壁 =====
  // 連窓。ピッチ62・幅34で、課長の机の真後ろに1つ来るよう揃える。
  // 島の後ろ（白板の壁）と書類棚の後ろは窓を作らない。
  const WIN_B = 19, WIN_T = 35, PITCH = 62, WINW = 34;
  const PMX = F + 42;                                   // 課長の机の中心
  const solid = [[F - 189, F + 25]];                    // 窓を作らない区間（書類棚と白板の壁）
  const openings = [];
  for (let k = -12; k <= 12; k++) {
    const cx = PMX + k * PITCH;
    const x0 = cx - WINW / 2, x1 = cx + WINW / 2;
    if (x1 < -40 || x0 > W + 40) continue;
    if (solid.some(([a, c]) => x1 > a && x0 < c)) continue;
    openings.push([x0, x1]);
  }
  b.box(W + 80, WIN_B, 2, C.wall, W / 2, WIN_B / 2, BACK - 1);                        // 腰壁
  b.box(W + 80, 64 - WIN_T, 2, C.wall, W / 2, (64 + WIN_T) / 2, BACK - 1);            // 垂れ壁
  {
    let x = -40;
    for (const [x0, x1] of openings) {
      if (x0 > x) b.box(x0 - x, WIN_T - WIN_B, 2, C.wall, (x + x0) / 2, (WIN_B + WIN_T) / 2, BACK - 1);
      x = x1;
    }
    if (W + 40 > x) b.box(W + 40 - x, WIN_T - WIN_B, 2, C.wall, (x + W + 40) / 2, (WIN_B + WIN_T) / 2, BACK - 1);
  }
  b.box(W + 80, 1.2, 0.4, C.skirting, W / 2, 0.6, BACK + 0.2);                         // 幅木
  // サッシ・窓台・ブラインド・ガラス
  const WINC = (WIN_B + WIN_T) / 2;
  for (const [x0, x1] of openings) {
    const cx = (x0 + x1) / 2;
    b.box(WINW + 2, 1.4, 1.8, C.frame, cx, WIN_T - 0.4, BACK - 0.5);
    b.box(WINW + 2, 1.4, 1.8, C.frame, cx, WIN_B + 0.4, BACK - 0.5);
    b.box(1.2, WIN_T - WIN_B, 1.8, C.frame, cx, WINC, BACK - 0.5);
    b.box(1.0, WIN_T - WIN_B, 1.8, C.frame, x0 + 0.5, WINC, BACK - 0.5);
    b.box(1.0, WIN_T - WIN_B, 1.8, C.frame, x1 - 0.5, WINC, BACK - 0.5);
    b.box(WINW + 4, 1.0, 3.0, C.sill, cx, WIN_B - 0.6, BACK + 0.6);                   // 窓台
    g.box(WINW - 1, WIN_T - WIN_B - 1.6, 0.2, '#e4f0f8', cx, WINC, BACK - 1.6, { kind: 'glass' });
    // ブラインド。上から途中まで下ろしてある（窓ごとに高さが違う）
    const rb = rng(cx * 1.37);
    const down = 2.5 + rb() * 4 + s * 2;
    b.box(WINW + 1, 1.3, 1.4, C.blindRail, cx, WIN_T - 1.0, BACK + 0.9);
    for (let y = WIN_T - 2.2; y > WIN_T - 1.6 - down; y -= 0.9) b.box(WINW - 0.4, 0.3, 0.5, C.blind, cx, y, BACK + 1.0);
    b.box(WINW, 0.6, 0.8, C.blindRail, cx, WIN_T - 1.8 - down, BACK + 1.0);
  }
  outside(g, W, BACK, s, rng(17 + id));

  // ===== 天井 =====
  ceilingSlab(W, halfD, BACK, mix('#eef0ec', '#a9b0b9', s), 47);

  // ===== 奥ゾーン =====
  // --- 壁ぎわの低いキャビネット（窓の下・白板の下）。書類棚・課長の机・コピー機の後ろは空ける ---
  const noLow = [[F - 190, F - 88], [PMX - 26, PMX + 34], [F + 126, F + 146]];
  for (let x = -40; x < W + 40; x += 22.4) {
    const cx = x + 11;
    if (noLow.some(([a, c]) => cx + 11 > a && cx - 11 < c)) continue;
    b.box(22, 12, 5, C.cabinet, cx, 6, BACK + 2.5, { cast: true });
    b.box(0.3, 11, 0.2, C.cabinetLine, cx, 6, BACK + 5.05);                          // 引き違い戸の合わせ
    b.box(1.6, 0.4, 0.3, C.handle, cx - 1.6, 6.5, BACK + 5.15);
    b.box(1.6, 0.4, 0.3, C.handle, cx + 1.6, 6.5, BACK + 5.15);
    b.box(21.6, 0.5, 0.3, C.cabinetLine, cx, 11.6, BACK + 5.1);
    // 上に載っている物。白板の真下は空ける（白板の下端を隠さない）
    if (cx > F - 56 && cx < F + 26) continue;
    const rc = rng(cx * 2.3);
    if (rc() < 0.55) bindersAt(b, cx - 9, 12, BACK + 2.5, 4 + Math.floor(rc() * 6), 1, rc);
    if (rc() < 0.5) b.box(6, 3.2, 4.2, C.cardboard, cx + 6, 13.6, BACK + 2.5);
    else if (rc() < 0.5) pileAt(b, cx + 5, 12, BACK + 2.4, 1 + rc() * 2, rc);
  }

  // --- 書類棚（背の高い棚が4本）。島の左。背板・側板・棚板で組んで中を暗く奥まらせる。上の2段は引き違いのガラス戸 ---
  for (let i = 0; i < 4; i++) {
    const cx = F - 174 + i * 24.4;
    const rs = rng(cx * 3.1);
    const z0 = BACK, D = 7;
    b.box(24, 34, 0.6, C.shelfBack, cx, 17, z0 + 0.3, { cast: true });                 // 背板
    b.box(0.8, 34, D, C.cabinet, cx - 11.6, 17, z0 + D / 2, { cast: true });          // 側板
    b.box(0.8, 34, D, C.cabinet, cx + 11.6, 17, z0 + D / 2, { cast: true });
    b.box(24, 0.8, D, C.cabinet, cx, 33.6, z0 + D / 2, { cast: true });               // 天板
    b.box(22.4, 1.2, D, C.cabinet, cx, 0.6, z0 + D / 2);                              // 台輪
    for (let f = 0; f < 5; f++) {
      const y = 1.2 + f * 6.5;                                                        // この段の床
      if (f > 0) {
        b.box(22.4, 0.5, D - 0.6, C.cabinet, cx, y - 0.25, z0 + 3.7);                 // 棚板
        b.box(22.4, 0.5, 0.2, C.cabinetLine, cx, y - 0.25, z0 + 6.9);                 // 棚板の小口
      }
      if (f === 4) {                                                                    // 最上段は書類箱
        for (let k = 0; k < 4; k++) {
          b.box(4.8, 4.2, 5.4, rs() < 0.7 ? C.fileBox : C.cardboard, cx - 8.4 + k * 5.6, y + 2.1, z0 + 3.6);
          b.box(1.6, 0.6, 0.1, '#6a6a64', cx - 8.4 + k * 5.6, y + 3.0, z0 + 6.35);
        }
      } else {
        let x = cx - 11;
        while (x < cx + 10) {
          const tk = 0.9 + rs() * 0.5, h = 4.0 + rs() * 1.2;
          if (rs() < 0.07) { x += 1.6; continue; }                                        // 抜けている所
          b.box(tk, h, 5, pick(rs, C.binder), x + tk / 2, y + h / 2, z0 + 3.9);
          b.box(tk * 0.55, 0.9, 0.06, '#eeeadf', x + tk / 2, y + h * 0.72, z0 + 6.44);
          x += tk + 0.05;
        }
      }
    }
    g.box(11.2, 12.7, 0.15, '#dfeaf0', cx - 5.6, 26.85, z0 + D + 0.2, { kind: 'glass' });
    g.box(11.2, 12.7, 0.15, '#dfeaf0', cx + 5.6, 26.85, z0 + D + 0.4, { kind: 'glass' });
    b.box(22.4, 0.4, 0.8, C.cabinetLine, cx, 20.4, z0 + D + 0.3);                     // 戸のレール
  }

  // --- 島の後ろの壁: 掲示板・白板（工程表）・カレンダー・時計 ---
  {
    const zW = BACK + 0.3;
    // 掲示板（コルク）。文字の無い紙を画鋲で留めてある
    const kx = F - 72;
    b.box(19, 12, 0.5, C.corkFrame, kx, 20.5, zW + 0.25);
    b.box(18, 11, 0.4, C.cork, kx, 20.5, zW + 0.55);
    const rk = rng(kx);
    for (let i = 0; i < 6; i++) {
      const px = kx - 6.5 + (i % 3) * 6.4 + (rk() - 0.5), py = 23.2 - Math.floor(i / 3) * 5.4 + (rk() - 0.5);
      b.box(3.4 + rk(), 4.2, 0.08, pick(rk, ['#f6f5f0', '#f2efe2', '#eaf0f2', '#f6eadf']), px, py, zW + 0.8 + i * 0.01);
      b.box(0.35, 0.35, 0.2, pick(rk, ['#c0392b', '#2f6fae', '#e8c33a']), px, py + 1.8, zW + 0.95);
    }
    // 白板（工程表）。色の棒だけ。遅い章ほど赤い棒（遅れ）が多い
    const wbx = F - 34, wbW = 36, wbH = 15, wbY = 20.6;
    const zB = zW + 0.75;                          // 白板の表面
    b.box(wbW + 1.4, wbH + 1.4, 0.4, C.boardFrame, wbx, wbY, zW + 0.3);
    b.box(wbW, wbH, 0.3, C.board, wbx, wbY, zW + 0.6);
    b.box(wbW, 0.5, 1.4, C.boardFrame, wbx, wbY - wbH / 2 - 0.5, zW + 1.2);           // ペン受け
    for (const [i, c] of ['#2b2b2b', '#c0392b', '#2f5fa8'].entries()) b.box(2.2, 0.4, 0.4, c, wbx - 14 + i * 2.8, wbY - wbH / 2 - 0.1, zW + 1.3);
    b.box(2.4, 0.9, 0.9, '#3a3d42', wbx + 13, wbY - wbH / 2 - 0.05, zW + 1.3);          // イレーザー
    const L = wbx - wbW / 2 + 7.5, R = wbx + wbW / 2 - 1.2;  // 棒を描く範囲（左は項目の欄）
    b.box(0.15, wbH - 1.4, 0.05, '#b9bec2', L - 0.8, wbY, zB);                          // 項目欄の縦罫
    b.box(wbW - 1.2, 0.15, 0.05, '#b9bec2', wbx, wbY + wbH / 2 - 2.0, zB);              // 見出し行の横罫
    for (let i = 1; i < 6; i++) b.box(0.1, wbH - 3, 0.05, '#dde0e2', L + (R - L) * i / 6, wbY - 1.0, zB - 0.01);   // 月の区切り
    const rw = rng(77 + id);
    const rows = 6, rowH = (wbH - 3.2) / rows;
    const nRed = 1 + Math.round(s * 3.9);
    const redRows = new Set();
    while (redRows.size < Math.min(nRed, rows - 1)) redRows.add(Math.floor(rw() * (rows - 1)));
    for (let i = 0; i < rows; i++) {
      const y = wbY + wbH / 2 - 3.0 - i * rowH;
      b.box(4.0 + rw() * 1.6, 0.35, 0.05, '#8e9499', L - 4.6, y, zB + 0.01);           // 項目欄の印（文字ではなく灰色の短い棒）
      if (i === rows - 1) { delayX0 = L + (R - L) * 0.55; continue; }                   // 最下段は動く遅れの棒
      const a = L + (R - L) * (0.05 + i * 0.12 + rw() * 0.06);
      const e = Math.min(R - 2, a + (R - L) * (0.22 + rw() * 0.2));
      const col = i % 3 === 2 ? '#2f8a4e' : i % 2 ? '#2b2b2b' : '#2f5fa8';
      b.box(e - a, 0.8, 0.06, col, (a + e) / 2, y, zB + 0.02);
      if (redRows.has(i)) {
        const e2 = Math.min(R, e + (R - L) * (0.08 + rw() * 0.14 + s * 0.08));
        b.box(e2 - e, 0.8, 0.06, '#c0392b', (e + e2) / 2, y, zB + 0.03);
      }
    }
    // 最下段: 全体の工程。計画の棒（青）と、残工期が減るほど伸びる遅れ（赤・動く）
    {
      const y = wbY + wbH / 2 - 3.0 - (rows - 1) * rowH;
      b.box(delayX0 - L, 0.9, 0.06, '#2f5fa8', (L + delayX0) / 2, y, zB + 0.02);
      delayLen = R - delayX0;
      delayBar = box(1, 0.9, 0.08, '#c0392b', delayX0 + 0.5, y, zB + 0.03, { receive: false });
      const k0 = st && st.game ? 1 - (st.game.kouki ?? 100) / (st.game.koukiMax || 100) : 0;
      setDelay(k0);
    }
    // 今日の線（赤い縦線）。遅い章ほど右
    const todayX = L + (R - L) * (0.42 + s * 0.4);
    b.box(0.25, wbH - 2.4, 0.06, '#d0453a', todayX, wbY - 0.6, zB + 0.04);
    // マグネット
    for (let i = 0; i < 5; i++) {
      g.cyl(0.42, 0.25, pick(rw, ['#d0453a', '#2f6fae', '#e8c33a', '#3f9a5a']), L + (R - L) * rw(), wbY + wbH / 2 - 1.0, zB + 0.12, { rx: Math.PI / 2 });
    }
    // カレンダー（上が写真、下が日付の升目。字は無い）
    const cx = F - 7;
    b.box(7, 10, 0.2, '#f4f3ee', cx, 20.5, zW + 0.3);
    b.box(6.2, 3.8, 0.06, mixStops([[0, '#7fb27a'], [0.5, '#c79a4a'], [1, '#8a9ab0']], s), cx, 23.0, zW + 0.44);
    b.box(6.2, 0.6, 0.06, '#c0392b', cx, 20.4, zW + 0.44);
    for (let i = 0; i < 4; i++) b.box(6.2, 0.08, 0.06, '#c9c9c3', cx, 19.3 - i * 1.15, zW + 0.44);
    for (let i = 0; i < 6; i++) b.box(0.08, 4.4, 0.06, '#c9c9c3', cx - 2.65 + i * 1.06, 17.6, zW + 0.45);
    // 時計（壁掛け）。章ごとに帰社した時刻を指す。秒針だけ動く
    const ckx = F + 12, cky = 28.2, ckz = zW;
    g.cyl(3.3, 0.5, '#3a3e44', ckx, cky, ckz + 0.45, { rx: Math.PI / 2 });
    g.cyl(3.0, 0.2, '#f7f7f3', ckx, cky, ckz + 0.82, { rx: Math.PI / 2 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.box(i % 3 ? 0.18 : 0.32, 0.6, 0.08, '#2a2d31', ckx + Math.sin(a) * 2.5, cky + Math.cos(a) * 2.5, ckz + 1.0, { rz: -a });
    }
    const [hh, mm] = CLOCK[id] || [15 + Math.round(s * 9), 30];
    const hand = (len, wdt, ang, zo, col) => g.box(wdt, len, 0.08, col,
      ckx + Math.sin(ang) * (len / 2 - 0.4), cky + Math.cos(ang) * (len / 2 - 0.4), ckz + zo, { rz: -ang });
    hand(1.9, 0.38, ((hh % 12) + mm / 60) / 12 * Math.PI * 2, 1.1, '#202326');
    hand(2.7, 0.26, (mm / 60) * Math.PI * 2, 1.18, '#202326');
    secBase = hh * 3600 + mm * 60 + Math.floor(r() * 60);
    secHand = new THREE.Group();
    secHand.position.set(ckx, cky, ckz + 1.27);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.05), new THREE.MeshBasicMaterial({ color: '#c0392b' }));
    sh.position.y = 1.0;
    secHand.add(sh);
    addScenery(secHand);
  }

  // --- 自分たちの島（手前の列が 自分・設計・現場・品証、奥の列が先輩たち）---
  const islandL = F - 78;                 // 島の左端（机4台 × 22）
  const deskX = (i) => islandL + 11 + i * 22;
  // 島の真ん中の低いパネル（デスクトップパネル。アクリル板ではない）
  b.box(88, 4.4, 0.8, '#8c949b', F - 34, TOP + 2.2, (ZN + ZF) / 2, { cast: true });
  b.box(88.4, 0.5, 1.1, '#6f777e', F - 34, TOP + 4.5, (ZN + ZF) / 2);
  for (let i = 0; i < 4; i++) {
    const x = deskX(i);
    const owner = SEATS[i];
    const empty = owner !== 'player' && gone.has(owner);
    const rs = rng(x * 5.7 + i);
    deskAt(b, x, ZN, 1, true, empty);
    if (empty) {
      // 空いた席: 椅子はまっすぐ奥まで押し込まれ（背もたれが天板の縁にかかる）、机の上には何も無い
      chairAt(b, x - 3.5, ZN + 1.6, 0, C.chair, true);
      continue;
    }
    // 座っていた席: 椅子は引き出されたまま斜めを向き、背もたれにその人のヘルメット
    const turn = owner === 'player' ? 0.5 : (i % 2 ? -1 : 1) * (0.3 + rs() * 0.22);
    chairAt(b, x - 3.5, ZN + 8.0, turn, C.chair, true);
    helmetOnChair(g, x - 3.5, ZN + 8.0, turn, owner);
    const scr = owner === 'douki_sekkei' ? { base: '#16202c', lines: '#62d0e0' }       // CAD（黒地に線）
      : owner === 'douki_hinsho' ? { base: '#5a7f9e', inner: '#eef2f4' }
      : owner === 'douki_genba' ? { base: '#4f7a62', inner: '#d4e4d8' }
      : { base: '#5a7f9e', inner: '#e8eef2' };
    dressDesk(b, g, x, ZN, 1, owner, s, rs, { screen: scr, cast: true, pileMul: owner === 'player' ? 1.5 : 1 });
    b.box(2.6, 4.6, 4.6, C.pc, x + 1.4, 2.4, ZN - 1.4);                               // 机の下のパソコン本体
    b.box(1.6, 0.25, 0.1, '#6d6a62', x + 1.4, 3.6, ZN + 0.95);
    if (owner === 'player') {
      // 机の脇に立てかけた図面筒（通路側）
      tubeAt(g, x - 12.0, 4.8, ZN + 1.0, 9.5, -0.12, 0, 0, '#c0392b');
      tubeAt(g, x - 12.8, 4.6, ZN - 0.6, 9.0, -0.08, 0.05, 0, '#2f6fae', '#c9b58c');
    } else if (owner === 'douki_sekkei') {
      // 設計: 広げた図面と、机の前の図面立て
      b.box(9.5, 0.06, 6.2, '#eef2f5', x - 3, TOP + 0.24, ZN + 2.0, { rotY: 0.06 });
      for (let k = 0; k < 4; k++) b.box(7 - k * 1.5, 0.05, 0.12, '#7d9cc0', x - 3.6 + k * 0.4, TOP + 0.29, ZN + 0.6 + k * 1.1, { rotY: 0.06 });
      g.cyl(1.7, 4.2, '#5f6670', x + 7, 2.1, ZN + 8, { kind: 'cast' });
      for (let k = 0; k < 5; k++) {
        const a = k * 1.3;
        tubeAt(g, x + 7 + Math.cos(a) * 0.7, 5.2, ZN + 8 + Math.sin(a) * 0.7, 8.5 + (k % 2) * 1.6,
          Math.cos(a) * 0.16, Math.sin(a) * 0.14, 0, pick(rs, ['#c0392b', '#2f6fae', '#e8c33a']), ['#2c2f34', '#c9b58c', '#8d939a', '#c9b58c', '#2c2f34'][k]);
      }
    } else if (owner === 'douki_genba') {
      // 現場: 点検表を挟んだクリップボードと軍手
      b.box(2.6, 0.15, 3.6, '#8a6a46', x - 1.8, TOP + 0.3, ZN + 0.8, { rotY: -0.2 });
      b.box(2.2, 0.06, 3.0, '#f4f3ee', x - 1.8, TOP + 0.4, ZN + 0.9, { rotY: -0.2 });
      b.box(1.2, 0.3, 0.5, '#a9aeb3', x - 2.1, TOP + 0.45, ZN - 0.8, { rotY: -0.2 });
      b.box(1.5, 0.35, 2.2, '#efe6cc', x + 7.4, TOP + 0.38, ZN + 4.6, { rotY: 1.2 });
      b.box(1.5, 0.35, 2.2, '#e8dfc2', x + 8.0, TOP + 0.55, ZN + 4.4, { rotY: 0.9 });
    } else if (owner === 'douki_hinsho') {
      // 品証: 検査記録のバインダー（dressDesk）、朱肉とノギス
      b.box(1.6, 0.5, 1.2, '#7a1e1e', x + 6.2, TOP + 0.45, ZN + 4.6);
      b.box(4.0, 0.25, 0.6, '#b9bec3', x + 2.0, TOP + 0.33, ZN + 4.6, { rotY: 0.3 });
    }
  }
  // 奥の列（先輩たち）。遅い章ほど帰った人が増える（椅子が入り、画面が消えている）
  for (let i = 0; i < 4; i++) {
    const x = deskX(i);
    const rs = rng(x * 9.1 + 3);
    deskAt(b, x, ZF, -1, true, false);
    const home = rs() < s * 0.75;
    chairAt(b, x - 3.5, home ? ZF - 2.7 : ZF - 8.5, Math.PI + (home ? 0 : (rs() - 0.5) * 0.5), C.chair, true);
    dressDesk(b, g, x, ZF, -1, null, s, rs, { screen: home ? null : undefined, cast: true });
  }
  // 島の上の吊り下げ札（無地の板と色の棒）
  const hang = (x, z, col) => {
    b.box(0.3, 9, 0.3, '#aeb4b9', x, 41.5, z);
    b.box(13, 4.6, 0.6, '#f4f5f2', x, 34.6, z);
    b.box(9, 0.9, 0.2, col, x, 34.6, z + 0.4);
  };
  hang(F - 34, ZN - 5, '#36b06a');

  // --- 課長の机。窓を背にして、フロアの方を向く ---
  {
    const x = PMX, z = -60;
    const p = (w, h, d, c, dx, y, dz, cast = true) => b.box(w, h, d, c, x + dx, y, z + dz, { cast });
    p(28, 1.1, 13, C.pmTop, 0, DT + 0.1, 0);                         // 木目の天板
    p(27.2, 0.5, 12.4, '#5e4836', 0, DT - 0.7, 0);
    for (const sx of [-1, 1]) {                                      // 両袖
      p(7.6, 7.6, 12, C.pmBody, sx * 9.6, 3.9, 0);
      for (let i = 0; i < 3; i++) {
        p(6.8, 2.2, 0.2, '#bdbbb2', sx * 9.6, 1.5 + i * 2.45, -6.1, false);
        p(2.0, 0.35, 0.35, C.handle, sx * 9.6, 2.1 + i * 2.45, -6.35, false);
      }
    }
    p(12, 6.0, 0.8, C.pmBody, 0, 4.6, 6.0);                          // 正面の幕板（こちらを向く）
    p(22, 0.2, 9, C.pmMat, -1, DT + 0.75, -0.5, false);              // デスクマット
    bossChairAt(b, x, z - 7.9, Math.PI);                             // 窓を背にした椅子（背は窓台の手前）
    // 机の上: 決裁箱（2段のトレー）・電話・モニター（裏がこちら）・書類・ペン立て
    const yT = DT + 0.85;
    for (let t = 0; t < 2; t++) {
      const y = yT + 0.2 + t * 2.0;
      b.box(4.4, 0.3, 3.4, '#cdbb8e', x - 10, y, z + 2.5);
      b.box(0.3, 1.4, 3.4, '#cdbb8e', x - 12.1, y + 0.6, z + 2.5);
      b.box(0.3, 1.4, 3.4, '#cdbb8e', x - 7.9, y + 0.6, z + 2.5);
      pileAt(b, x - 10, y + 0.15, z + 2.5, 0.6 + t * 0.4 + s * 1.4, rng(x + t));
    }
    phoneAt(b, x + 9.5, z + 2.2, -1, '#56595e');
    crtAt(b, g, x + 6, z - 1.6, Math.PI - 0.35, { base: '#5a7f9e', inner: '#dfe8ee' }, true);
    pileAt(b, x - 2.5, yT, z + 3.4, 1.2 + s * 2.5, rng(x * 3));
    pileAt(b, x - 6, yT, z + 0.4, 0.8 + s * 1.6, rng(x * 5));
    g.cyl(0.8, 2.2, '#2e3236', x + 2.4, yT + 1.1, z + 3.8, { kind: 'cast' });           // ペン立て
    for (let k = 0; k < 3; k++) g.cyl(0.12, 2.2, ['#c0392b', '#2b2b2b', '#2f5fa8'][k], x + 2.2 + k * 0.2, yT + 2.4, z + 3.8, { rz: (k - 1) * 0.15 });
    // 脇のワゴンと書類キャビネット
    b.box(6.2, 7.2, 8, C.pmBody, x + 18, 3.6, z - 3, { cast: true });
    b.box(5.6, 0.3, 0.2, C.handle, x + 18, 5.6, z + 1.1);
    pileAt(b, x + 18, 7.2, z - 3, 1.5 + s * 1.5, rng(x * 7));
    const fx = x + 28;
    b.box(9, 22, 8, C.cabinet, fx, 11, BACK + 4, { cast: true });
    for (let i = 0; i < 4; i++) {
      b.box(8.2, 4.8, 0.2, C.drawer, fx, 3 + i * 5.3, BACK + 8.1);
      b.box(2.6, 0.4, 0.4, C.handle, fx, 4.4 + i * 5.3, BACK + 8.3);
    }
    b.box(6, 3.2, 4.4, C.cardboard, fx, 23.6, BACK + 4);
    // 課長の観葉植物（幸福の木）。遅い章ほど葉が枯れていく
    const px = x - 21, pz = BACK + 5;
    g.cyl(2.3, 5.2, '#d7d2c4', px, 2.6, pz, { kind: 'cast' });
    g.cyl(2.1, 0.4, '#5a4632', px, 5.1, pz);
    for (const [dx, h] of [[-0.5, 13], [0.6, 16.5], [0.1, 10]]) g.cyl(0.42, h, '#7a6248', px + dx, 5 + h / 2, pz);
    const leaf = mixStops([[0, '#3f8a4a'], [0.5, '#6d8a40'], [1, '#8a7a3e']], s);
    const leaf2 = mixStops([[0, '#2f6e3a'], [0.5, '#5a7436'], [1, '#76683a']], s);
    for (const [dx, y, sc] of [[-0.6, 18.5, 3.2], [0.8, 21.6, 3.4], [0.1, 15, 2.9], [-1.8, 20.5, 2.2], [2.2, 17.4, 2.3]]) {
      g.add(BALL, sc > 3 ? leaf : leaf2, px + dx, y, pz, { sx: sc, sy: sc * 0.62, sz: sc, ry: dx, kind: 'cast' });
    }
  }

  // --- 打ち合わせの机（課長の机の右、窓の前）---
  {
    const x = F + 104, z = -52;
    b.box(17, 0.8, 10, '#e7e4db', x, 8.2, z, { cast: true });
    for (const [dx, dz] of [[-7.6, -4.2], [7.6, -4.2], [-7.6, 4.2], [7.6, 4.2]]) b.box(0.8, 7.8, 0.8, '#9ba1a7', x + dx, 3.9, z + dz, { cast: true });
    const stack = (cx, cz, rot) => {
      const p = placer(b, cx, cz, rot, true);
      p(5.6, 0.6, 5.4, '#5d6e7e', 0, 5.0, 0);
      p(5.4, 3.0, 0.5, '#5d6e7e', 0, 9.6, 2.6);
      for (const [dx, dz] of [[-2.4, -2.3], [2.4, -2.3], [-2.4, 2.3], [2.4, 2.3]]) p(0.4, 4.9, 0.4, '#a3a9ae', dx, 2.45, dz);
      p(0.4, 4.2, 0.4, '#a3a9ae', -2.4, 7.0, 2.6);
      p(0.4, 4.2, 0.4, '#a3a9ae', 2.4, 7.0, 2.6);
    };
    stack(x - 4, z + 8, 0.1); stack(x + 4.5, z + 8.4, -0.15);
    stack(x - 4.2, z - 8, Math.PI); stack(x + 4, z - 8.2, Math.PI + 0.12);
    tubeAt(g, x - 1, 9.05, z - 1.5, 10, Math.PI / 2, 0, 0.15, '#2f6fae');            // 図面（巻いたまま）
    b.box(9, 0.06, 6, '#eef2f5', x + 3, 8.65, z + 1, { rotY: -0.12 });               // 広げた図面
    for (let k = 0; k < 3; k++) b.box(6 - k, 0.05, 0.1, '#7d9cc0', x + 2.6, 8.7, z - 0.2 + k * 1.2, { rotY: -0.12 });
    pileAt(b, x - 5.5, 8.6, z + 1.5, 1.4, rng(x));
    g.cyl(0.55, 1.1, '#f2f0ea', x + 7, 9.15, z - 2.5);
  }

  // --- コピー機（壁ぎわ）---
  {
    const x = F + 136, z = BACK + 6;
    b.box(14, 9, 10, '#d8d4c7', x, 4.5, z, { cast: true });
    b.box(14, 2.2, 10, '#c9c4b6', x, 10.1, z, { cast: true });
    b.box(10.5, 1.5, 8, '#bdb8aa', x - 1, 11.95, z);                                   // 原稿送り
    b.box(4, 0.4, 3, '#4a4e54', x + 4.6, 11.4, z + 3.6);                              // 操作パネル
    g.box(1.8, 0.1, 1.0, '#8fe08a', x + 4.2, 11.65, z + 3.6, { kind: 'glow' });
    for (let i = 0; i < 3; i++) b.box(13, 0.3, 0.2, '#a9a496', x, 1.6 + i * 2.4, z + 5.1);
    b.box(4.5, 0.5, 6, '#c9c4b6', x - 9.2, 7.2, z);                                   // 排紙トレー
    pileAt(b, x - 9.2, 7.45, z, 0.8, rng(x));
    b.box(6, 3.5, 4.5, C.cardboard, x + 11, 1.75, z + 2);                              // 用紙の箱
  }

  // --- ほかの課の島（左右）。同じ作りで、見せ場の島と見分けがつくよう札の色を変える ---
  const otherIsland = (cx, seed) => {
    const rr = rng(seed);
    b.box(88, 4.4, 0.8, '#8c949b', cx, TOP + 2.2, (ZN + ZF) / 2, { cast: true });
    b.box(88.4, 0.5, 1.1, '#6f777e', cx, TOP + 4.5, (ZN + ZF) / 2);
    for (let i = 0; i < 4; i++) {
      const x = cx - 33 + i * 22;
      for (const [z, side] of [[ZN, 1], [ZF, -1]]) {
        const rs = rng(x * 4.3 + side * 11 + seed);
        deskAt(b, x, z, side, true, false);
        const home = rs() < s * 0.8;
        const zc = side > 0 ? (home ? z + 2.7 : z + 8.5) : (home ? z - 2.7 : z - 8.5);
        chairAt(b, x - 3.5, zc, (side > 0 ? 0 : Math.PI) + (home ? 0 : (rs() - 0.5) * 0.6), C.chair, true);
        dressDesk(b, g, x, z, side, null, s, rs, { screen: home ? null : undefined, cast: true });
      }
    }
    hang(cx, ZN - 5, pick(rr, ['#3a6fb0', '#c08a2e', '#8a4a9a']));
  };
  for (let cx = F - 146; cx > -100; cx -= 120) otherIsland(cx, Math.round(cx));
  for (let cx = F + 196; cx - 44 < W + 40; cx += 120) otherIsland(cx, Math.round(cx));

  // ===== 手前ゾーン（低い物だけ）=====
  // 140ごとに「低い書庫3台 ＋ 図面を広げる作業台 ＋ 鉢植え」。帯から離して z≈58 に置き、
  // 帯の手前の端に立った人の足も隠さない（z=54.5 の足元の線は 9.7。書庫の天板は 8.4）。
  // 椅子は置かない（背もたれが足元の線を越え、手前の端で戦う人の脚を隠すため）。
  const ZC = 58;
  for (let base = F - 34 - 140 * Math.ceil((F + 120) / 140); base < W + 140; base += 140) {
    // 低い書庫（高さ8.4）。上に書類箱・寝かせたバインダー・段ボール・ファクス
    for (let k = 0; k < 3; k++) {
      const cx = base - 22 + k * 22;
      if (cx < -60 || cx > W + 60) continue;
      const rc = rng(cx * 1.9 + 5);
      b.box(21.6, 8.4, 7, C.cabinet, cx, 4.2, ZC);
      b.box(0.3, 7.6, 0.2, C.cabinetLine, cx, 4.2, ZC + 3.55);
      b.box(1.4, 0.4, 0.3, C.handle, cx - 1.4, 5.0, ZC + 3.65);
      b.box(1.4, 0.4, 0.3, C.handle, cx + 1.4, 5.0, ZC + 3.65);
      const what = rc();
      if (what < 0.3) {
        for (let j = 0; j < 3; j++) b.box(3.2, 0.9, 4.2, pick(rc, C.binder), cx - 6 + j * 0.15, 8.85 + j * 0.92, ZC + (rc() - 0.5) * 0.6, { rotY: (rc() - 0.5) * 0.2 });
        b.box(5, 2.6, 3.6, C.fileBox, cx + 5, 9.7, ZC);
      } else if (what < 0.6) {
        b.box(7, 3.0, 5, C.cardboard, cx - 4, 9.9, ZC + 0.2, { rotY: 0.08 });
        pileAt(b, cx + 5, 8.4, ZC, 1.6 + rc() * 1.4, rc);
      } else if (what < 0.8) {
        b.box(5.4, 1.8, 4.4, '#d6d2c6', cx - 3, 9.3, ZC);                               // ファクス
        b.box(4.2, 0.6, 2.0, '#bdb8aa', cx - 3, 10.4, ZC - 0.8);
        b.box(3.0, 0.05, 2.4, '#f6f5f1', cx - 3, 10.25, ZC + 1.6, { rotY: 0.1 });
        bindersAt(b, cx + 2, 8.4, ZC, 6, 1, rc);
      } else {
        pileAt(b, cx - 4, 8.4, ZC, 2 + rc() * 1.5, rc);
        pileAt(b, cx + 4, 8.4, ZC + 0.3, 1 + rc() * 1.5, rc);
      }
    }
    // 作業台（図面を広げて見る台。椅子は無い）。広げた図面・巻いた図面・三角スケール・文鎮
    {
      const x = base + 58, z = ZC + 2;
      if (x > -60 && x < W + 60) {
        const rt = rng(x * 2.7);
        b.box(30, 0.8, 13, '#dcd8cc', x, 8.0, z);
        for (const [dx, dz] of [[-14, -5.8], [14, -5.8], [-14, 5.8], [14, 5.8]]) b.box(1.0, 7.6, 1.0, '#9ba1a7', x + dx, 3.8, z + dz);
        b.box(28, 0.6, 0.8, '#9ba1a7', x, 1.4, z);
        b.box(12, 0.05, 8.5, '#eef2f5', x - 6, 8.43, z - 0.4, { rotY: 0.05 });
        for (let k = 0; k < 4; k++) b.box(8 - k * 1.4, 0.05, 0.12, '#7d9cc0', x - 6.5 + k * 0.3, 8.48, z - 2.6 + k * 1.5, { rotY: 0.05 });
        b.box(11, 0.05, 8, '#f3efe2', x + 7, 8.45, z + 0.5, { rotY: -0.08 });
        for (let k = 0; k < 3; k++) b.box(0.12, 0.05, 6 - k * 1.5, '#8f8a7c', x + 4 + k * 2.4, 8.5, z + 0.5, { rotY: -0.08 });
        tubeAt(g, x + 1, 8.85, z - 5.0, 12, Math.PI / 2, 0, 0.05, pick(rt, ['#c0392b', '#2f6fae']), '#c9b58c');
        b.box(7, 0.45, 0.6, '#e6dcbf', x - 4.5, 8.65, z + 4.2, { rotY: 0.3 });           // 三角スケール
        b.box(1.4, 0.8, 1.2, '#3a3d42', x - 11.4, 8.85, z - 3.4);                          // 文鎮
        b.box(1.4, 0.8, 1.2, '#3a3d42', x + 11.6, 8.85, z + 3.2);
      }
    }
    // 鉢植え（ポトス）。遅い章ほど葉の色が抜ける
    {
      const x = base + 92;
      if (x > -60 && x < W + 60) {
        g.cyl(2.0, 4.0, '#c9c2b2', x, 2.0, ZC);
        const lf = mixStops([[0, '#3f8a4a'], [0.5, '#6a8a44'], [1, '#8a8044']], s);
        for (const [dx, y, sc] of [[0, 6.0, 2.6], [-1.6, 5.0, 1.8], [1.7, 5.2, 1.9]]) g.add(BALL, lf, x + dx, y, ZC + dx * 0.3, { sx: sc, sy: sc * 0.7, sz: sc, ry: dx });
      }
    }
  }

  b.done();
  g.done(0.1 + 0.08 * s);
}

// 白板の遅れの棒。k=0..1（残工期が減った割合）
function setDelay(k) {
  if (!delayBar) return;
  const len = Math.max(0.001, delayLen * clamp01(k));
  delayBar.scale.x = len;
  delayBar.position.x = delayX0 + len / 2;
  delayBar.visible = len > 0.05;
}

export function onEvent(name, arg) {
  if (name !== 'tick' || !arg) return;
  if (secHand) {
    const sec = (secBase + Math.floor(arg.t || 0)) % 60;
    secHand.rotation.z = -(sec / 60) * Math.PI * 2;
  }
  if (delayBar && typeof arg.kouki === 'number') setDelay(1 - arg.kouki);
}

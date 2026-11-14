// 小向クエスト2 ゴールデンエイジ編 — 第4章 L3社編「窓のない会議室」（g2_l3_kaigi・ボス戦）
//
// 技術力はあるが情報を出さない相手の、窓のない会議室。ボス戦だけで張られる。
// ボス（L3社プロマネ）はHPバーが出ない。62%まで削ると初めてバーが見え、そこから勝てる。
// 部屋はその「見えない → 見える」を受けて、閉じた状態から開いた状態へ変わる。
//
// 間取り（ワールドの x。W は章の幅/3。第4章は W≈583）:
//   〜W-100      廊下（立入制限区域の中）。灰色の壁に、窓の無い扉とカード読取機。見物の同期はここに立つ
//   W-100        ガラスの仕切り（細いアルミの枠＋薄いガラス＋引き戸）。帯を横切るのは細い枠だけ
//   W-100〜W+40  会議室。藍の布張りの壁で、窓は無い。右の壁で閉じている
//     奥の壁   … 白板2枚。閉じたブラインドが下りている（窓に見えるが、上げると白板）
//     奥の左   … 覆いを掛けた試験ラック。机の上にも覆いを掛けた模型
//     奥の右端 … 中身の分からない黒い箱（試験台の上。ラックと線でつながっている）
//     手前     … こちらの折りたたみ机。図面・書類・バインダーの山（相手は何も出さず、こちらは紙だらけ）
//
// 閉（build の直後）: 冷たく暗い光。部屋の奥に濃い霧。霧は奥ゾーン（z<-29）に重ねた薄い幕で作る
//   （本物の霧は near≥250 の決まりがあり、ボス戦のカメラでは部屋のどこにも掛からない。幕なら帯のキャラは霞まない）。
// 'reveal'（HPバーが見えた）で開く: 照明が点く（瞬いてから暖かく明るく）・覆いが引き上げられて消える・
//   ブラインドが上がって白板（インターフェースの図）が出る・霧が晴れる。あわせて引き戸が開き、
//   引き戸の上の赤い灯が緑になり、ラックの計器の画面が点き、床に明かりが落ちる。
// 'defeated'（撃破＝完成）: 黒い箱に初めて灯りが入る（前面の継ぎ目・状態灯・表示窓が順に点き、まわりが照らされる）。
// build は毎回「閉」から始める。ただし章の状態がすでに「見えた」後なら、その場で開いた形にそろえる
// （出来事はもう来ないので、閉じたまま戻れなくなるのを防ぐ）。
//
// 文字・ロゴ・社章・旗は描かない（看板・札は無地の板と色の棒）。人に見える物は置かない（覆いは箱の形）。
// 描画の数: 動かない物は頂点カラーで2回（影あり／なし）にまとめ、動く物（ブラインド・覆い・引き戸・
// 灯り・霧・壁の照り・箱のまわりの光）とガラスだけ別に描く。PointLight は使わない。
import { THREE, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill } from '../../../game3d/src/render3d.js';

// ===== 色 =====
const C = {
  bg: '#141828',
  // 廊下（灰色の塗り壁・ビニル床）
  cwall: '#b7bcc4', cwallLow: '#a6acb5', cbase: '#4a505a', cstripe: '#3d4a84',
  vinyl: '#9a9fa8', vinylLine: '#8b9099', vinylEdge: '#737982', redLine: '#a83a30',
  door: '#7d848d', doorFrame: '#596069', kick: '#a2a8b0', lever: '#c9ced3',
  reader: '#24272d', keypad: '#5f656e', plate: '#e9ebe8', plateBar: '#3d4a84', plateLine: '#9aa0a8',
  bench: '#8a7254', benchLeg: '#4a4f57', phone: '#d6cfbd', phoneDark: '#8e877a',
  ext: '#b8322a', camBody: '#e2e2de',
  // 仕切り
  alu: '#aab2bb', aluDark: '#7d858f', glass: '#cfe2f2',
  // 会議室（藍）
  wall: '#3e4a80', joint: '#2c3662', base: '#1d2238', ceiling: '#22263a',
  carpet: '#323954', carpetB: '#2d3450', lightBar: '#2a3152',
  blind: '#cfcabd', blindLine: '#a29d91', blindRail: '#bab4a6', cord: '#e7e3d8',
  boardFrame: '#9aa3ad', board: '#eef1ef', tray: '#8d959e',
  ink: '#1f2a3a', inkBlue: '#2f5aa8', inkRed: '#c0392b', inkGreen: '#2e8a52', grid: '#8a95a5',
  wood: '#5a4636', woodEdge: '#3d2f25', woodDark: '#2e241d',
  chair: '#1d2130', chairHi: '#2b3144', steel: '#727986', steelDark: '#4a505b',
  paper: '#f2f0e8', paperB: '#e6e2d6', paperY: '#eee6cf',
  folder: ['#7a2e2a', '#2f4a7a', '#b8973a', '#3c6648'],
  binderDark: ['#232838', '#2e3550', '#3a3f4c', '#1c1f2a'],
  binder: ['#2f5a8f', '#8f3a2e', '#3f6e46', '#e2dfd2', '#7a6a2e', '#4a4f8a'],
  credenza: '#2b2f40',
  cloth: '#8c877b', clothDark: '#6a655c', clothHi: '#a39d90',
  rackFrame: '#2a2e36', beige: '#c6bea8', grey: '#8d939c', knob: '#262628', screenOff: '#0c1110',
  bbox: '#111216', bboxPanel: '#17181d', bboxEdge: '#24262d', conn: '#2b2d33', connRim: '#6d727a',
  stand: '#5b616c', standTop: '#6c737e', cable: '#16171b',
  ours: '#bcb7a9', oursLeg: '#80868e', oursChair: '#4f5866', tube: '#e4e9ee', drawing: '#dbe7f1', drawLine: '#4f78a8',
  haze: '#434d6d',
};

// ===== 光と霧（第4章は坂0.6。閉じている間はさらに冷たく暗い。開くと暖かく明るい）=====
// fill の色は setLighting が戻さないので触らない（強さだけ）
const LC = { hemi: new THREE.Color('#7b8abf'), ground: new THREE.Color('#181c2e'), hi: 0.92,
             sun: new THREE.Color('#a8b7e2'), si: 0.36, fi: 0.72 };
const LO = { hemi: new THREE.Color('#fff2e0'), ground: new THREE.Color('#6e6252'), hi: 2.05,
             sun: new THREE.Color('#ffe4bf'), si: 1.05, fi: 1.0 };
const FOG = { c0: new THREE.Color('#2a3252'), c1: new THREE.Color('#d9cfc0'), n0: 250, n1: 430, f0: 480, f1: 1300 };
const HAZE_A = 0.21;      // 霧の幕1枚の濃さ（4枚重ねると奥の壁で約半分）

function setLights(k) {
  hemi.color.copy(LC.hemi).lerp(LO.hemi, k);
  hemi.groundColor.copy(LC.ground).lerp(LO.ground, k);
  hemi.intensity = LC.hi + (LO.hi - LC.hi) * k;
  sun.color.copy(LC.sun).lerp(LO.sun, k);
  sun.intensity = LC.si + (LO.si - LC.si) * k;
  fill.intensity = LC.fi + (LO.fi - LC.fi) * k;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const easeIn = (t) => { t = clamp01(t); return t * t; };
// 決まった乱数（建て直しても同じ机に同じ物が載る）
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ===== まとめ描き =====
// 形を頂点カラーの1メッシュにまとめる（g2_jisha と同じ考え方）。置き方:
// 拡縮 → at だけずらす → X・Z・Y の順に回す → x,y,z へ動かす。
const T_BOX = new THREE.BoxGeometry(1, 1, 1);
const T_CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const T_CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const T_PLANE = new THREE.PlaneGeometry(1, 1);
const T_PLANE_V = new THREE.PlaneGeometry(1, 1, 1, 8);   // 霧の幕（下の縁だけ薄くするため縦に刻む）

function pieces() {
  const list = [];
  const api = {
    list,
    add(tpl, color, x, y, z, o = {}) {
      const g = tpl.clone();
      g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
      if (o.at) g.translate(o.at[0], o.at[1], o.at[2]);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      const p = { g, color, alpha: o.alpha, tag: o.tag };
      list.push(p);
      return p;
    },
    box(w, h, d, color, x, y, z, o = {}) { return api.add(T_BOX, color, x, y, z, { ...o, sx: w, sy: h, sz: d }); },
    // 円柱（軸は y。寝かせるなら rx / rz）
    cyl(r, h, color, x, y, z, o = {}) { return api.add(o.lo ? T_CYL6 : T_CYL, color, x, y, z, { ...o, sx: r, sy: h, sz: r }); },
    plane(w, h, color, x, y, z, o = {}) { return api.add(o.tpl || T_PLANE, color, x, y, z, { ...o, sx: w, sy: h, sz: 1 }); },
  };
  return api;
}

function merge(list, { uv = false, rgba = false } = {}) {
  let nv = 0, ni = 0;
  for (const p of list) {
    nv += p.g.attributes.position.count;
    ni += p.g.index ? p.g.index.count : p.g.attributes.position.count;
  }
  const cs = rgba ? 4 : 3;
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * cs);
  const uvs = uv ? new Float32Array(nv * 2) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const c = new THREE.Color();
  let v = 0, k = 0;
  for (const p of list) {
    const g = p.g, P = g.attributes.position, n = P.count;
    pos.set(P.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    if (uvs && g.attributes.uv) uvs.set(g.attributes.uv.array, v * 2);
    c.set(p.color);   // ColorManagement で linear になる。頂点カラーにそのまま入れてよい
    for (let i = 0; i < n; i++) {
      const o = (v + i) * cs;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      if (rgba) col[o + 3] = p.alpha ? p.alpha(P.getX(i), P.getY(i), P.getZ(i)) : 1;
    }
    if (g.index) { const I = g.index.array; for (let i = 0; i < I.length; i++) idx[k++] = v + I[i]; }
    else for (let i = 0; i < n; i++) idx[k++] = v + i;
    p.start = v; p.count = n;
    v += n;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, cs));
  if (uvs) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

function addMesh(P, mat, o = {}) {
  if (!P.list.length) return null;
  const m = new THREE.Mesh(merge(P.list, o), mat);
  m.castShadow = !!o.cast;
  m.receiveShadow = !!o.receive;
  if (o.renderOrder != null) m.renderOrder = o.renderOrder;
  if (!o.moving) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  addScenery(m);
  return m;
}
const lambert = () => new THREE.MeshLambertMaterial({ vertexColors: true });

// ===== 光の模様（キャンバスで描く。張り替えても使い回す）=====
let washTex = null, glowTex = null;
// 壁の照り（上の灯りから下へ広がって消える、横長の山形）
function washTexture() {
  if (washTex) return washTex;
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.save(); g.scale(0.5, 1);
  const gr = g.createRadialGradient(128, 0, 0, 128, 0, 250);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.62)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.restore();
  washTex = new THREE.CanvasTexture(cv); washTex.colorSpace = THREE.SRGBColorSpace;
  return washTex;
}
// 黒い箱のまわりの光（中心が明るく縁が消える）
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// ===== 家具と小物 =====
// 会議椅子（背の高い布張り）。座る人は f の向き（+1 で +z）を向き、背もたれは反対側
function confChair(P, x, z, f) {
  const b = z - 3.4 * f;
  P.box(6.6, 1.2, 6.4, C.chair, x, 5.5, z);                                   // 座面
  P.box(6.6, 10.5, 1.1, C.chair, x, 11.6, b, { rx: -0.1 * f });               // 背もたれ（少し後ろへ倒す）
  P.box(6.2, 0.6, 1.3, C.chairHi, x, 16.8, b - 0.5 * f, { rx: -0.1 * f });    // 上端の縫い目
  for (const s of [-1, 1]) {
    P.box(0.8, 0.7, 4.6, C.steelDark, x + 3.6 * s, 8.6, z - 0.4 * f);         // 肘掛け
    P.box(0.6, 2.6, 0.6, C.steelDark, x + 3.6 * s, 7.0, z - 1.6 * f);
  }
  P.box(1.1, 4.4, 1.1, C.steel, x, 2.8, z);                                   // ガス柱
  for (let k = 0; k < 3; k++) P.box(5.6, 0.5, 0.9, C.steelDark, x, 0.45, z, { ry: k * Math.PI / 3 + 0.25 });
}
// 積み重ね椅子（こちらの側）。座る人は -z（奥）を向く
function stackChair(P, x, z) {
  P.box(5.4, 0.7, 5.2, C.oursChair, x, 4.5, z);
  P.box(5.4, 3.6, 0.6, C.oursChair, x, 8.0, z + 2.6);
  for (const dx of [-2.5, 2.5]) {
    P.box(0.4, 4.3, 0.4, C.oursLeg, x + dx, 2.15, z - 2.2);
    P.box(0.4, 9.6, 0.4, C.oursLeg, x + dx, 4.8, z + 2.3);
  }
}
// 線で描いた四角（白板の図）
function rect(P, x0, y0, x1, y1, col, z, t = 0.3) {
  P.box(x1 - x0 + t, t, 0.05, col, (x0 + x1) / 2, y1, z);
  P.box(x1 - x0 + t, t, 0.05, col, (x0 + x1) / 2, y0, z);
  P.box(t, y1 - y0, 0.05, col, x0, (y0 + y1) / 2, z);
  P.box(t, y1 - y0, 0.05, col, x1, (y0 + y1) / 2, z);
}
// 書類の山（束ごとに少しずらし、黄ばんだ紙を挟む）
function pile(P, x, y0, z, h, seed) {
  let y = y0, i = 0;
  while (y < y0 + h - 0.05) {
    const t = Math.min(0.4 + rnd(seed + i) * 0.9, y0 + h - y);
    const col = rnd(seed * 3 + i) < 0.25 ? C.paperY : (i % 2 ? C.paperB : C.paper);
    P.box(4.4, t, 3.2, col, x + (rnd(seed + i * 7) - 0.5) * 0.5, y + t / 2, z + (rnd(seed + i * 11) - 0.5) * 0.4,
      { ry: (rnd(seed + i * 5) - 0.5) * 0.3 });
    y += t; i++;
  }
}

// ===== 動かす物（build のたびに作り直す。前の章の参照を残さない）=====
let A = null;

export function build(W, halfD, ctx = {}) {
  A = null;
  const stage = ctx.stage || null;
  const { BACK, FRONT } = zones(halfD, 42, 70);   // 奥 -70 / 手前 98
  setLighting(false);
  setLights(0);
  scene.background = hex(C.bg);
  scene.fog = new THREE.Fog(FOG.c0.clone(), FOG.n0, FOG.f0);

  const PX = W - 100;            // ガラスの仕切り
  const XR = W + 40;             // 会議室の右の壁
  const XL = -130;               // 廊下の左端（ボス戦で左へ戻ってもカメラに切れない）
  const HZ = -38;                // 廊下の奥の壁（会議室の奥の壁より手前。部屋の奥行きの差で仕切りが読める）
  const CEIL = halfD + 12;       // 天井の手前の端（ceilingSlab と同じ）
  const RM = (PX + XR) / 2, RW = XR - PX;

  const P = pieces();     // 照らされる・動かない・影を落とさない
  const PC = pieces();    // 照らされる・動かない・影を落とす（奥の大物だけ）
  const LT = pieces();    // 灯り（照明を受けない。出来事で色を変える）
  const GL = pieces();    // 仕切りのガラス（動かない）

  // ---------- 床 ----------
  P.box(PX - XL, 2, FRONT - BACK, C.vinyl, (XL + PX) / 2, -1, (FRONT + BACK) / 2);   // 廊下のビニル床
  P.box(RW, 2, FRONT - BACK, C.carpet, RM, -1, (FRONT + BACK) / 2);                  // 会議室のタイルカーペット
  for (let x = XL + 10; x < PX - 4; x += 10) P.box(0.22, 0.04, FRONT - HZ, C.vinylLine, x, 0.02, (FRONT + HZ) / 2);
  for (let z = HZ + 10; z < FRONT; z += 10) P.box(PX - XL, 0.04, 0.22, C.vinylLine, (XL + PX) / 2, 0.02, z);
  P.box(PX - XL, 0.06, 3, C.vinylEdge, (XL + PX) / 2, 0.03, HZ + 1.5);                 // 壁ぎわの見切り
  P.box(1.0, 0.08, 52, C.redLine, PX - 5, 0.04, 0);                                    // 立入の境界線（部屋の手前）
  for (let i = 0, x = PX + 5; x < XR; x += 10, i++) {
    for (let j = 0, z = BACK + 5; z < FRONT; z += 10, j++) {
      if ((i + j) % 2) P.box(9.6, 0.03, 9.6, C.carpetB, x, 0.015, z);
    }
  }

  // ---------- 壁 ----------
  // 廊下の壁（灰色の塗り壁。腰の濃い帯・幅木・案内の藍の線）
  const CW = PX - 2 - XL, CX = (XL + PX - 2) / 2;
  P.box(CW, 64, 2, C.cwall, CX, 32, HZ - 1);
  P.box(CW, 9, 0.3, C.cwallLow, CX, 4.5, HZ + 0.15);
  P.box(CW, 1.2, 0.5, C.cbase, CX, 0.6, HZ + 0.25);
  P.box(CW, 1.0, 0.4, C.cstripe, CX, 9.5, HZ + 0.2);
  // 会議室: 左の壁（廊下の奥の壁から部屋の奥の壁まで）・奥の壁・右の壁。藍の布張りパネル
  P.box(2, 64, HZ - BACK + 2, C.wall, PX - 1, 32, (HZ + BACK - 2) / 2);
  P.box(RW, 64, 2, C.wall, RM, 32, BACK - 1);
  // 右の壁は床の手前端まで（天井の切り口 z=40 で止めると、寄ったカメラの右下に背景の色がそのまま出た）
  P.box(2, 64, FRONT - BACK + 2, C.wall, XR + 1, 32, (FRONT + BACK - 2) / 2);
  for (let x = PX + 10; x < XR - 4; x += 10) P.box(0.35, 44.8, 0.12, C.joint, x, 23.6, BACK + 0.06);
  for (let z = BACK + 10; z < HZ - 3; z += 10) P.box(0.12, 44.8, 0.35, C.joint, PX + 0.06, 23.6, z);
  for (let z = BACK + 10; z < FRONT - 4; z += 10) P.box(0.12, 44.8, 0.35, C.joint, XR - 0.06, 23.6, z);
  P.box(RW, 1.2, 0.4, C.base, RM, 0.6, BACK + 0.2);
  P.box(0.4, 1.2, HZ - BACK, C.base, PX + 0.2, 0.6, (HZ + BACK) / 2);
  P.box(0.4, 1.2, FRONT - BACK, C.base, XR - 0.2, 0.6, (FRONT + BACK) / 2);

  // ---------- 天井（手前は z=40 で切る）----------
  ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  P.box(-40 - XL, 2, CEIL - BACK, C.ceiling, (XL - 40) / 2, 47, (CEIL + BACK) / 2);

  // ---------- 廊下の壁ぎわ ----------
  const door = (x) => {
    P.box(13.2, 23, 0.6, C.doorFrame, x, 11.5, HZ + 0.3);
    P.box(11.6, 21.6, 0.5, C.door, x, 10.8, HZ + 0.7);
    P.box(11.2, 2.4, 0.1, C.kick, x, 1.4, HZ + 1.0);
    P.box(2.6, 0.5, 0.7, C.lever, x + 3.6, 10.5, HZ + 1.3);
    P.box(0.9, 0.9, 0.3, C.lever, x + 4.6, 10.5, HZ + 1.05);
    P.box(5, 0.8, 1.0, '#6c727b', x - 2, 20.6, HZ + 1.3);                     // ドアクローザ
    P.box(7, 2.4, 0.3, C.plate, x, 25.2, HZ + 0.15);                          // 室名札（無地）
    P.box(5, 0.5, 0.1, C.plateBar, x, 25.7, HZ + 0.35);
    P.box(3.4, 0.35, 0.1, C.plateLine, x - 0.8, 24.6, HZ + 0.35);
  };
  const reader = (x, y = 12.5) => {                                           // カード読取機とテンキー
    P.box(1.8, 3.0, 0.8, C.reader, x, y, HZ + 0.4);
    LT.box(0.45, 0.45, 0.1, '#ff3b30', x, y + 1.0, HZ + 0.85);
    P.box(2.0, 2.6, 0.6, C.keypad, x, y - 3.5, HZ + 0.3);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) P.box(0.35, 0.35, 0.1, '#c9ced3', x - 0.55 + c * 0.55, y - 2.9 - r * 0.6, HZ + 0.65);
  };
  const bench = (x, z) => {
    for (let i = 0; i < 3; i++) P.box(22, 0.5, 1.4, C.bench, x, 4.6, z - 1.7 + i * 1.7);
    for (const s of [-1, 1]) P.box(1.0, 4.4, 4.6, C.benchLeg, x + 9.5 * s, 2.2, z);
  };
  const extinguisher = (x) => {
    P.box(3.0, 0.6, 1.2, C.benchLeg, x, 9.0, HZ + 0.9);
    P.cyl(1.3, 6.4, C.ext, x, 6.0, HZ + 2.0);
    P.box(1.2, 1.4, 1.2, '#2a2a2a', x, 9.9, HZ + 2.0);
    P.box(0.35, 4.0, 0.35, '#2a2a2a', x + 1.5, 7.2, HZ + 2.4);
    P.box(2.8, 2.8, 0.2, '#c0392b', x, 14.5, HZ + 0.2);                       // 消火器の札（無地の赤）
  };
  const camera = (x) => {                                                     // 監視カメラ（箱型）
    P.box(0.6, 0.6, 2.2, C.plateLine, x, 35.5, HZ + 1.1);
    P.box(1.8, 1.6, 3.2, C.camBody, x + 0.6, 35, HZ + 2.6, { ry: -0.5 });
    P.box(1.0, 1.0, 0.3, '#1c1e22', x + 1.4, 35, HZ + 4.0, { ry: -0.5 });
  };
  for (let k = 0, x = PX - 32; x > XL + 8; x -= 96, k++) {
    door(x); reader(x + 9.5);
    if (k % 2 === 0) bench(x - 32, HZ + 4.2); else extinguisher(x - 34);
    if (k % 3 === 0) camera(x - 12);
  }
  // 部屋のすぐ脇: 引き戸の読取機と、壁掛けの電話（使用中の灯は仕切りの引き戸の上）
  reader(PX - 6.5);
  {
    const x = PX - 84;                                                        // 壁掛けの電話（古い型）
    P.box(3.2, 4.6, 1.4, C.phone, x, 15, HZ + 0.7);
    P.box(1.0, 4.2, 0.9, C.phoneDark, x - 1.0, 15, HZ + 1.8);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) P.box(0.3, 0.3, 0.1, '#6a655a', x + 0.4 + c * 0.45, 16.4 - r * 0.6, HZ + 1.45);
    P.box(0.25, 3.0, 0.25, '#3a3a3a', x - 1.2, 11.4, HZ + 1.8);
  }
  // 廊下の手前（低い物だけ）: ベンチとごみ箱
  for (let x = PX - 60; x > XL + 20; x -= 192) {
    for (let i = 0; i < 3; i++) P.box(24, 0.5, 1.5, C.bench, x, 4.6, 48 + i * 1.8);
    for (const s of [-1, 1]) P.box(1.0, 4.4, 5, C.benchLeg, x + 10 * s, 2.2, 49.8);
  }
  P.cyl(2.0, 5.5, '#5c636d', PX - 22, 2.75, 44);
  P.cyl(1.7, 0.2, '#3a3f46', PX - 22, 5.55, 44);

  // ---------- ガラスの仕切り（帯を横切るのは細い枠だけ）----------
  const PZ1 = 25.6;                                                           // 仕切りの手前の端（帯の縁）
  P.box(1.2, 46, 1.2, C.alu, PX, 23, HZ + 0.6);
  // 帯の中の縦の枠（引き戸の両脇・帯の手前の端）はごく細く。太いと、ガラスの外で見ている同期の体や、
  // 仕切りのそばで戦う人の顔を縦に切る
  for (const z of [-9.6, 9.6]) P.box(0.3, 46, 0.3, C.alu, PX, 23, z);
  P.box(0.4, 46, 0.4, C.alu, PX, 23, PZ1);
  P.box(1.0, 1.0, PZ1 - HZ, C.alu, PX, 45.5, (PZ1 + HZ) / 2);                 // 上枠
  P.box(0.7, 0.7, PZ1 - HZ, C.alu, PX, 27.2, (PZ1 + HZ) / 2);                 // 欄間の横枠
  // 引き戸の上の「使用中」の灯（閉: 赤 → 開: 緑）。両面に向ける。廊下の壁に付けるとボス戦では HUD の裏に隠れる
  P.box(1.2, 1.9, 3.4, C.reader, PX, 28.5, 0);
  for (const s of [-1, 1]) LT.box(0.12, 1.3, 2.6, '#ff3b30', PX + 0.64 * s, 28.5, 0, { tag: { grp: 'lamp', off: '#ff3b30', on: '#37e07a' } });
  P.box(1.2, 1.0, -25 - HZ, C.aluDark, PX, 0.5, (HZ - 25) / 2);              // 下枠（奥ゾーン）
  P.box(1.2, 0.14, PZ1 + 25, C.aluDark, PX, 0.07, (PZ1 - 25) / 2);          // 下のレール（帯は床の模様の高さだけ）
  GL.box(0.16, 44.8, -10 - (HZ + 1.2), C.glass, PX, 22.6, (HZ + 1.2 - 10) / 2);
  GL.box(0.16, 44.8, PZ1 - 0.45 - 10, C.glass, PX, 22.6, (PZ1 - 0.45 + 10) / 2);
  GL.box(0.16, 17.4, 18.4, C.glass, PX, 36.3, 0);                             // 欄間のガラス

  // 引き戸（閉じている。'reveal' で奥へ滑って開く）。ガラスの中の物は照明に、ガラスは半透明で
  const doorG = new THREE.Group();
  {
    const F = pieces(), G = pieces();
    for (const s of [-1, 1]) F.box(0.5, 26.4, 0.5, C.alu, 0, 13.4, 9.2 * s);
    F.box(0.5, 0.7, 18.4, C.alu, 0, 26.5, 0);
    F.box(0.5, 1.0, 18.4, C.alu, 0, 0.75, 0);
    for (const s of [-1, 1]) {                                                // 縦長の取っ手（両面）
      F.box(0.35, 12, 0.35, C.lever, 1.3 * s, 13, -6.5);
      for (const y of [8, 18]) F.box(1.2, 0.35, 0.35, C.lever, 0.7 * s, y, -6.5);
    }
    G.box(0.16, 26.2, 18.4, C.glass, 0, 13.55, 0);
    const fm = new THREE.Mesh(merge(F.list), lambert()); fm.receiveShadow = true;
    const gm = new THREE.Mesh(merge(G.list), new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, emissive: 0x1a2a3a,
    }));
    gm.renderOrder = 3;
    doorG.add(fm, gm);
    doorG.position.set(PX + 0.7, 0, 0);
    addScenery(doorG);
  }

  // ---------- 会議室の奥の壁: 白板2枚（閉じたブラインドの裏）----------
  const ZB = BACK + 0.76;                                                     // 白板に描いた線の面
  const board = (cx, w) => {
    P.box(w + 1.2, 19.6, 0.5, C.boardFrame, cx, 20.8, BACK + 0.25);
    P.box(w, 18.4, 0.2, C.board, cx, 20.8, BACK + 0.6);
    P.box(w + 1.0, 0.7, 1.4, C.tray, cx, 10.9, BACK + 0.95);
    for (let i = 0; i < 3; i++) P.box(2.4, 0.5, 0.5, [C.inkRed, C.inkBlue, C.ink][i], cx - w / 2 + 4 + i * 3, 11.5, BACK + 1.1);
  };
  const B1 = PX + 47, B1W = 44, B2 = PX + 91, B2W = 36;
  board(B1, B1W); board(B2, B2W);
  // 左の白板: インターフェースの構成図。左がこちらの装置（青）、右が相手の箱（黒）。
  // 相手の箱の中の区画まで描いてある——今まで出てこなかった情報
  {
    const c = B1;
    rect(P, c - 19, 14, c - 7, 27, C.inkBlue, ZB);
    for (let i = 0; i < 3; i++) P.box(7 - i * 1.5, 0.25, 0.05, C.inkBlue, c - 14 - i * 0.4, 24.5 - i * 2.4, ZB);
    rect(P, c - 17.5, 15.5, c - 11, 19, C.inkBlue, ZB, 0.22);
    rect(P, c + 7, 14, c + 19, 27, C.ink, ZB);
    rect(P, c + 8.5, 21.5, c + 12.6, 25.6, C.inkRed, ZB, 0.24);
    rect(P, c + 13.8, 21.5, c + 17.6, 25.6, C.ink, ZB, 0.24);
    rect(P, c + 8.5, 15.4, c + 17.6, 20.2, C.ink, ZB, 0.24);
    for (let i = 0; i < 3; i++) P.box(6.5 - i * 1.2, 0.2, 0.05, C.ink, c + 12.8, 18.8 - i * 1.2, ZB);
    // 結ぶ線（信号・電源・冷却）。矢じりは小さな菱形
    const lines = [[16.2, C.ink], [18.4, C.inkRed], [20.6, C.inkBlue], [22.8, C.ink], [25.0, C.inkRed]];
    for (const [y, col] of lines) {
      P.box(13.4, 0.26, 0.05, col, c, y, ZB);
      P.box(0.9, 0.9, 0.05, col, c + 6.2, y, ZB, { rz: Math.PI / 4 });
    }
    // 赤丸（ここが合わなかった）。八角形で
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      P.box(2.0, 0.24, 0.05, C.inkRed, c + Math.cos(a) * 2.4, 22.8 + Math.sin(a) * 2.4, ZB + 0.03, { rz: a + Math.PI / 2 });
    }
    for (let i = 0; i < 4; i++) P.box(2.5 + rnd(i) * 3, 0.2, 0.05, '#7d8794', c - 4 + rnd(i + 5) * 6, 28.6 - i * 0.0 - (i % 2) * 0.9, ZB);
  }
  // 右の白板: 取り合いの表（升目と色付きの欄）と、信号の波形
  {
    const c = B2, x0 = c - 16.5, x1 = c + 5, y0 = 13.2, y1 = 28.6;
    P.box(x1 - x0, 2.0, 0.05, '#cfe0f2', (x0 + x1) / 2, y1 - 1.0, ZB - 0.03);
    for (let r = 0; r <= 7; r++) P.box(x1 - x0, 0.18, 0.05, C.grid, (x0 + x1) / 2, y0 + r * (y1 - y0) / 7, ZB);
    for (let k = 0; k <= 5; k++) P.box(0.18, y1 - y0, 0.05, C.grid, x0 + k * (x1 - x0) / 5, (y0 + y1) / 2, ZB);
    const cw = (x1 - x0) / 5, rh = (y1 - y0) / 7;
    const cells = [[1, 2, '#f2d46a'], [3, 4, '#e8a39a'], [2, 1, '#a8d8b0'], [4, 3, '#f2d46a'], [0, 5, '#a8d8b0'], [3, 1, '#e8a39a']];
    for (const [cc, rr, col] of cells) P.box(cw - 0.5, rh - 0.5, 0.05, col, x0 + (cc + 0.5) * cw, y0 + (rr + 0.5) * rh, ZB - 0.03);
    for (let r = 0; r < 6; r++) for (let k = 0; k < 5; k++) {
      if (rnd(r * 9 + k) < 0.55) P.box(cw * (0.3 + rnd(r + k * 3) * 0.4), 0.18, 0.05, '#5d6878', x0 + (k + 0.5) * cw, y0 + (r + 0.5) * rh, ZB + 0.03);
    }
    // 波形（矩形波）
    let x = c + 7.2, hi = false;
    for (let i = 0; i < 6; i++) {
      const y = hi ? 25.2 : 22.6, len = 1.2 + (i % 3) * 0.6;
      P.box(len, 0.24, 0.05, C.inkBlue, x + len / 2, y, ZB);
      P.box(0.24, 2.6, 0.05, C.inkBlue, x + len, 23.9, ZB);
      x += len; hi = !hi;
    }
    for (let i = 0; i < 2; i++) P.box(9, 0.22, 0.05, C.inkGreen, c + 11.6, 17.5 + i * 2.2, ZB);
    P.box(0.22, 6.4, 0.05, C.inkGreen, c + 7.3, 18.6, ZB);
  }
  // ブラインドの上の箱と、紐（動かない）。灯りの帯はその上
  const BL = [[B1, B1W + 3], [B2, B2W + 3]];
  for (const [cx, w] of BL) {
    P.box(w + 1.2, 1.2, 1.6, C.blindRail, cx, 31.8, BACK + 2.3);
    P.box(0.14, 17, 0.14, C.cord, cx + w / 2 - 1.5, 22.8, BACK + 3.3);
    P.box(0.5, 1.0, 0.5, C.cord, cx + w / 2 - 1.5, 13.8, BACK + 3.3);
  }
  P.box(RW - 1, 1.4, 1.6, C.lightBar, RM, 33.6, BACK + 0.8);                 // 壁付けの灯りの箱
  LT.box(RW - 3, 0.9, 0.12, '#262b40', RM, 33.5, BACK + 1.66, { tag: { grp: 'cove', off: '#262b40', on: '#fff0d0' } });

  // ---------- 会議室の奥: 机・椅子・覆いの下の機材・黒い箱 ----------
  const TXc = PX + 64, TZc = -44, TOP = 8.9;
  // 相手の長机（木目）。机の向こうに背の高い椅子（相手の席）
  PC.box(76, 1.0, 14, C.wood, TXc, 8.4, TZc);
  P.box(76.4, 0.6, 14.4, C.woodEdge, TXc, 7.6, TZc);
  for (const s of [-1, 1]) {
    PC.box(4, 7.3, 9, C.woodDark, TXc + 26 * s, 3.65, TZc);
    P.box(8, 0.5, 11, C.woodDark, TXc + 26 * s, 0.25, TZc);
  }
  for (const dx of [-27, -9, 9, 27]) confChair(PC, TXc + dx, -55.5, 1);
  // 机の上: 伏せた書類と閉じたフォルダだけ（何も見せない）、真ん中に会議用のスピーカーホン
  for (const [dx, k] of [[-27, 0], [27, 1]]) {
    P.box(4.4, 0.5, 3.2, C.paperB, TXc + dx + 1, TOP + 0.25, TZc - 2.6, { ry: 0.05 });
    P.box(6.0, 0.4, 4.6, C.folder[k], TXc + dx - 1, TOP + 0.7, TZc - 2.2, { ry: -0.04 });
  }
  P.box(4.4, 0.8, 3.2, C.paper, TXc + 9, TOP + 0.4, TZc - 2.6, { ry: 0.08 });
  P.box(6.0, 0.4, 4.6, C.folder[2], TXc + 10, TOP + 1.0, TZc - 2.4, { ry: -0.06 });
  P.box(0.3, 0.3, 4.2, '#1d2028', TXc + 13.5, TOP + 0.15, TZc - 2.0, { ry: 0.3 });
  P.cyl(2.5, 0.7, '#2c2f36', TXc + 20, TOP + 0.35, TZc + 1.5);
  P.cyl(1.6, 0.2, '#454a54', TXc + 20, TOP + 0.8, TZc + 1.5);
  for (let i = 0; i < 3; i++) P.box(0.5, 0.2, 0.5, '#7d838c', TXc + 19 + i, TOP + 0.75, TZc + 3.3);
  // 机の上の模型（開くと見える）: 箱の切断模型。手前の壁を切り取って、中の基板と電源を見せる
  const MXc = TXc - 12, MZc = -45;
  P.box(16, 0.6, 8, '#6f7682', MXc, TOP + 0.3, MZc);
  PC.box(16, 6.0, 0.4, C.bboxEdge, MXc, TOP + 3.6, MZc - 3.8);
  for (const s of [-1, 1]) PC.box(0.4, 6.0, 8, C.bboxEdge, MXc + 7.8 * s, TOP + 3.6, MZc);
  P.box(16.2, 0.3, 0.3, '#c84a3a', MXc, TOP + 6.6, MZc - 3.8);                 // 切り口（赤）
  for (const s of [-1, 1]) P.box(0.3, 6.0, 0.3, '#c84a3a', MXc + 7.8 * s, TOP + 3.6, MZc + 3.9);
  for (let i = 0; i < 6; i++) {
    P.box(0.3, 5.0, 6.6, i % 3 === 2 ? '#2a6a8a' : '#2f7a4a', MXc - 6 + i * 1.7, TOP + 3.1, MZc - 0.3);
    P.box(0.32, 0.3, 6.6, '#c9a845', MXc - 6 + i * 1.7, TOP + 5.7, MZc - 0.3);
  }
  P.box(3.4, 4.2, 6.6, '#a9b0b8', MXc + 5.4, TOP + 2.7, MZc - 0.3);
  P.cyl(1.3, 0.4, '#2a2d33', MXc + 5.4, TOP + 5.0, MZc - 0.3);
  P.box(12, 0.35, 6, C.bboxEdge, TXc + 4, TOP + 0.18, TZc + 3, { ry: 0.1 });          // 外した蓋
  // シュレッダー（左の壁ぎわ）と、壁の注意書き（無地の板と赤い帯）
  P.box(7, 9, 5.5, '#3d4048', PX + 6.5, 4.5, -44);
  P.box(7.2, 1.2, 5.7, '#2c2f36', PX + 6.5, 9.6, -44);
  P.box(4.6, 0.2, 0.6, '#0e0f12', PX + 6.5, 10.25, -44);
  P.box(4.2, 2.6, 0.1, '#d8d4c8', PX + 6.5, 4.2, -41.2);
  for (let i = 0; i < 5; i++) P.box(0.25, 2.4, 0.1, '#b9b4a6', PX + 4.8 + i * 0.85, 4.2, -41.12);
  P.box(0.3, 8, 7, '#e9e6dc', PX + 0.15, 21, -50);
  P.box(0.32, 1.6, 7, C.inkRed, PX + 0.17, 23.8, -50);
  for (let i = 0; i < 3; i++) P.box(0.32, 0.3, 5 - i, C.plateLine, PX + 0.17, 21.4 - i * 1.3, -50.4);
  // 低い棚（白板の下。閉じたファイルボックスと伏せた束）
  P.box(77, 8, 6, C.credenza, PX + 64.5, 4, BACK + 3.4);
  for (let x = PX + 30; x < PX + 100; x += 13) P.box(0.25, 7, 0.1, '#20232f', x, 4, BACK + 6.42);
  for (let i = 0; i < 14; i++) {
    const x = PX + 30 + i * 2.0 + (i > 6 ? 30 : 0);
    P.box(1.8, 3.4, 4.6, C.binderDark[i % 4], x, 9.7, BACK + 3.4);
  }
  pile(P, PX + 93, 8, BACK + 3.4, 2.2, 3);

  // 試験ラック（奥の左。覆いの下）。計器を積み、下の差込盤から黒い箱へ線が伸びる
  const RXc = PX + 12.5, RZc = BACK + 7, RF = RZc + 4.6;   // RF: 計器の前面
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) PC.box(1.2, 26, 1.2, C.rackFrame, RXc + 7.4 * sx, 13, RZc + 4.4 * sz);
  for (const sx of [-1, 1]) PC.box(0.5, 24, 8.6, C.rackFrame, RXc + 7.6 * sx, 13.5, RZc);
  PC.box(16, 1.0, 10, C.rackFrame, RXc, 25.5, RZc);
  PC.box(15, 24, 0.5, C.rackFrame, RXc, 13.5, RZc - 4.6);
  P.box(16, 2.0, 10, '#1e2128', RXc, 1.0, RZc);
  // 1) オシロスコープ
  P.box(14.2, 5.8, 8.8, C.beige, RXc, 21.9, RZc + 0.1);
  P.box(6.2, 4.4, 0.1, '#3a382f', RXc - 3.3, 22, RF + 0.02);
  P.box(5.6, 3.8, 0.1, C.screenOff, RXc - 3.3, 22, RF + 0.06);
  for (let i = 0; i < 6; i++) P.cyl(0.42, 0.5, C.knob, RXc + 1.6 + (i % 3) * 1.8, 23.4 - Math.floor(i / 3) * 2.6, RF + 0.2, { rx: Math.PI / 2, lo: true });
  // 2) 信号発生器
  P.box(14.2, 5.2, 8.8, C.grey, RXc, 16, RZc + 0.1);
  P.box(7.2, 1.6, 0.1, '#1a1410', RXc - 2.6, 17.3, RF + 0.04);
  for (let i = 0; i < 8; i++) P.box(0.8, 0.6, 0.15, '#d9dcdf', RXc - 5.6 + i * 1.2, 14.6, RF + 0.06);
  P.cyl(0.8, 0.5, C.knob, RXc + 4.6, 16.2, RF + 0.2, { rx: Math.PI / 2 });
  // 3) 電源（針の計器2つ）
  P.box(14.2, 5.2, 8.8, C.beige, RXc, 10.2, RZc + 0.1);
  for (const dx of [-4.5, -0.6]) {
    P.box(3.4, 2.6, 0.12, '#f2efe6', RXc + dx, 10.9, RF + 0.04);
    P.box(0.16, 1.8, 0.1, '#1a1a1a', RXc + dx + 0.3, 10.7, RF + 0.12, { rz: -0.5 });
  }
  P.cyl(0.5, 0.4, '#c0392b', RXc + 3.6, 9.0, RF + 0.2, { rx: Math.PI / 2, lo: true });
  P.cyl(0.5, 0.4, '#1a1a1a', RXc + 5.2, 9.0, RF + 0.2, { rx: Math.PI / 2, lo: true });
  // 4) 差込盤と、垂れた線
  P.box(14.2, 2.4, 2.0, '#2b2f37', RXc, 5.8, RF - 0.9);
  for (let i = 0; i < 10; i++) P.box(0.5, 0.5, 0.1, '#111216', RXc - 5.8 + i * 1.3, 5.8, RF + 0.12);
  for (let i = 0; i < 3; i++) P.box(0.4, 5.6, 0.4, ['#16171b', '#b8952e', '#2f5aa8'][i], RXc + 1 + i * 1.6, 2.9, RF + 0.6 + i * 0.2);
  P.box(14.2, 2.0, 8.8, '#3a3e47', RXc, 3.3, RZc + 0.1);

  // 黒い箱（奥の右端）。試験台の上に載った、窓も表示も無い箱。前面に丸いコネクタと取っ手だけ
  // 中心は W+1（右端 W+11）。W+19 だと、ボス戦の始まりの位置で倒したとき箱が画面の右端で切れ、完成の灯りが見えない
  const BXc = XR - 39, BZc = -56, BF = BZc + 6.5;          // BF: 箱の前面
  PC.box(26, 0.8, 16, C.standTop, BXc, 8.6, BZc);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) PC.box(1.2, 8.2, 1.2, C.stand, BXc + 12 * sx, 4.1, BZc + 7 * sz);
  P.box(24, 0.6, 14, C.stand, BXc, 2.4, BZc);
  P.box(8, 3.2, 6, '#7a808a', BXc - 6, 4.3, BZc - 1);                        // 下段の電源
  PC.box(20, 13, 13, C.bbox, BXc, 15.5, BZc);
  P.box(19, 12, 0.3, C.bboxPanel, BXc, 15.5, BF + 0.15);
  for (const s of [-1, 1]) {                                                  // 取っ手
    P.box(0.6, 7, 0.6, C.bboxEdge, BXc + 8.6 * s, 15.5, BF + 1.3);
    for (const y of [12.3, 18.7]) P.box(0.6, 0.6, 1.2, C.bboxEdge, BXc + 8.6 * s, y, BF + 0.8);
  }
  for (const dx of [-6, -2, 2, 6]) {                                          // 丸いコネクタ
    P.cyl(1.45, 0.3, C.connRim, BXc + dx, 14.6, BF + 0.4, { rx: Math.PI / 2 });
    P.cyl(1.15, 0.9, C.conn, BXc + dx, 14.6, BF + 0.7, { rx: Math.PI / 2 });
  }
  P.box(5, 1.6, 0.1, '#25272c', BXc - 5, 11.0, BF + 0.36);                    // 銘板（無地）
  for (let i = 0; i < 6; i++) P.box(0.6, 11, 0.4, C.bboxEdge, BXc + 10.3, 15.5, BZc - 5 + i * 2);   // 横の放熱板
  P.box(8, 0.5, 0.5, C.bboxEdge, BXc, 22.6, BZc - 2);                         // 上の吊り手
  for (const s of [-1, 1]) P.box(0.5, 1.0, 0.5, C.bboxEdge, BXc + 3.75 * s, 22.3, BZc - 2);
  P.box(0.9, 4.2, 0.05, '#c8322a', BXc - 8.6, 11.4, BF + 1.65, { rz: 0.06 });  // 赤い札（無地）
  // 線: コネクタから台の縁を越えて床へ、台の下を通ってラックへ
  for (const [dx, zr] of [[-6, -60.6], [-2, -61.4]]) {
    const x = BXc + dx;
    P.box(0.45, 5.6, 0.45, C.cable, x, 11.9, BF + 1.0);
    P.box(0.45, 0.45, 1.4, C.cable, x, 9.2, BF + 1.5);
    P.box(0.45, 9.0, 0.45, C.cable, x, 4.7, BF + 2.1);
    P.box(0.45, 0.45, BF + 2.1 - zr, C.cable, x, 0.23, (BF + 2.1 + zr) / 2);
    P.box(x - (RXc + 8), 0.45, 0.45, C.cable, (x + RXc + 8) / 2, 0.23, zr);
  }

  // 黒い箱の灯り（'defeated' で順に点く）。消えている間は箱と同じ色
  const boxLights = [];
  const bl = (w, h, x, y, on, delay, dur = 0.25) => boxLights.push(
    LT.box(w, h, 0.08, C.bboxPanel, x, y, BF + 0.36, { tag: { grp: 'box', off: C.bboxPanel, on, delay, dur } }));
  bl(19, 0.24, BXc, 21.45, '#ffe2b0', 0.0, 0.5);                               // 前面の継ぎ目
  bl(19, 0.24, BXc, 9.55, '#ffe2b0', 0.0, 0.5);
  bl(0.24, 12, BXc - 9.45, 15.5, '#ffe2b0', 0.0, 0.5);
  bl(0.24, 12, BXc + 9.45, 15.5, '#ffe2b0', 0.0, 0.5);
  for (let i = 0; i < 6; i++) bl(0.7, 0.55, BXc - 7.2 + i * 1.3, 19.7, i === 0 ? '#ffb347' : '#5dff8f', 0.18 + i * 0.09, 0.08);   // 状態灯
  bl(4.4, 1.8, BXc + 5, 19.5, '#1e5a3a', 0.35, 0.2);                           // 表示窓
  for (let i = 0; i < 3; i++) boxLights.push(LT.box(0.9, 0.7, 0.06, C.bboxPanel, BXc + 3.7 + i * 1.2, 19.5, BF + 0.42,
    { tag: { grp: 'box', off: C.bboxPanel, on: '#7dffb0', delay: 0.5 + i * 0.1, dur: 0.1 } }));
  for (let i = 0; i < 4; i++) bl(8.5, 0.32, BXc + 4.6, 10.6 + i * 0.55, '#b89466', 0.3, 0.6);   // 下の通風口（中の灯りが漏れる）

  // ラックの計器の画面（'reveal' で点く）
  LT.box(5.2, 3.4, 0.08, C.screenOff, RXc - 3.3, 22, RF + 0.12, { tag: { grp: 'screen', off: C.screenOff, on: '#0f3a2a', delay: 0.85 } });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, y = 22 + Math.sin(a + 0.4) * 1.1, ny = 22 + Math.sin(a + 0.4 + Math.PI / 4) * 1.1;
    LT.box(0.7, 0.18, 0.06, C.screenOff, RXc - 5.4 + i * 0.6, (y + ny) / 2, RF + 0.18,
      { rz: Math.atan2(ny - y, 0.6), tag: { grp: 'screen', off: C.screenOff, on: '#6dffa8', delay: 0.9 } });
  }
  for (let i = 0; i < 6; i++) LT.box(0.7, 0.9, 0.06, '#1a1410', RXc - 5.4 + i * 1.1, 17.3, RF + 0.1,
    { tag: { grp: 'screen', off: '#1a1410', on: '#ffb547', delay: 0.95 } });

  // ---------- 霧（奥ゾーンに重ねた薄い幕。下の縁は床に溶かす）----------
  const HZP = pieces();
  for (const z of [-30.5, -40.5, -51, -62]) {
    HZP.plane(RW - 2, 46, C.haze, RM, 23, z, { tpl: T_PLANE_V, alpha: (x, y) => HAZE_A * ease(y / 7) });
  }

  // ---------- 壁の照り（'reveal' で点く。灯りの帯の下へ山形に広がる）----------
  // 白板の上に重ねても白のままで効かないので、壁が見えている所だけに置く:
  // ラックの上・黒い箱の上（奥の壁）、左の壁の内側、右の壁の内側
  const WSP = pieces();
  WSP.plane(20, 22, '#ffd9a8', PX + 13, 22, BACK + 1.3);
  WSP.plane(24, 22, '#ffd9a8', XR - 14, 22, BACK + 1.3);
  WSP.plane(22, 22, '#ffd9a8', PX + 0.5, 22, -55, { ry: Math.PI / 2 });
  for (const z of [-48, -2, 26]) WSP.plane(24, 22, '#ffd9a8', XR - 1.0, 22, z, { ry: -Math.PI / 2 });
  // 床の明かりの溜まり（'reveal' で点く。帯の床に落ちる天井の灯り。床の模様と同じ薄さ）
  const PLP = pieces();
  for (let i = 0; i < 5; i++) PLP.plane(26, 20, '#ffd9a8', PX + 18 + i * 26, 0.1, -6 + (i % 2) * 5, { rx: -Math.PI / 2 });

  // ---------- 箱のまわりの光（'defeated' で点く）----------
  const GWP = pieces();
  GWP.plane(36, 26, '#9a8058', BXc, 15.5, BF + 0.9);                         // 前面（弱め。灯りの粒を消さない）
  GWP.plane(44, 34, '#ffdcaa', XR - 23, 17, BACK + 1.9);                      // 後ろの壁に映る光（灯りの箱の前面 BACK+1.6 と重ねない）
  GWP.plane(40, 22, '#ffdcaa', BXc, 0.14, BF + 6, { rx: -Math.PI / 2 });

  // ---------- 手前: こちらの折りたたみ机（低い物だけ。手前の線より低く）----------
  for (let s = 0; s < 3; s++) {
    const x = PX + 28 + s * 42, z = 52, yT = 7.3;
    P.box(40, 0.6, 9.5, C.ours, x, 7.0, z);
    for (const dx of [-19, 19]) for (const dz of [-4.2, 4.2]) P.box(0.7, 6.7, 0.7, C.oursLeg, x + dx, 3.35, z + dz);
    P.box(38, 0.5, 0.5, C.oursLeg, x, 1.6, z + 4.2);
    for (const dx of [-13, 0, 13]) stackChair(P, x + dx, 60.5);
    // 机の上は4つの区画に分けて置く（互いにめり込ませない）:
    //   x-14 書類の山 / x-5 書類の山（真ん中の机は広げた図面）/ x+4 立てたバインダーと寝かせたバインダー / x+13 丸めた図面
    pile(P, x - 14 + rnd(s * 5) * 1.5, yT, z - 2.0 + rnd(s) * 0.8, 1.2 + rnd(s * 9) * 1.6, s * 31);
    if (s !== 1) pile(P, x - 5 + rnd(s * 5 + 1) * 1.5, yT, z - 1.6 + rnd(s + 1) * 0.8, 0.8 + rnd(s * 9 + 1) * 2.0, s * 31 + 7);
    else {
      P.box(9, 0.06, 6.4, C.drawing, x - 5, yT + 0.03, z - 0.8, { ry: 0.05 });
      for (let k = 0; k < 4; k++) P.box(6 - k, 0.03, 0.2, C.drawLine, x - 5.4 + k * 0.4, yT + 0.08, z - 2.8 + k * 1.3, { ry: 0.05 });
      P.box(0.2, 0.03, 4.8, C.drawLine, x - 8.4, yT + 0.08, z - 0.8, { ry: 0.05 });
    }
    const nb = 3 + Math.floor(rnd(s * 5) * 3), bx0 = x + 1.5;
    for (let k = 0; k < nb; k++) P.box(0.95, 3.8, 3.4, C.binder[(s * 3 + k) % C.binder.length], bx0 + k * 1.05, yT + 1.9, z + 2.4);
    P.box(0.4, 2.8, 3.0, C.oursLeg, bx0 + nb * 1.05 + 0.2, yT + 1.4, z + 2.4);
    P.box(4.4, 0.9, 3.4, C.binder[(s + 2) % C.binder.length], x + 4, yT + 0.45, z - 2.4, { ry: 0.15 });
    P.cyl(0.55, 8, C.tube, x + 13, yT + 0.55, z - 2.2, { rz: Math.PI / 2, ry: 0.2, lo: true });
    P.cyl(0.5, 7, C.drawing, x + 13.5, yT + 1.5, z - 1.4, { rz: Math.PI / 2, ry: -0.1, lo: true });
    if (s === 2) P.cyl(0.5, 7.5, C.tube, x + 12.5, yT + 0.5, z + 2.4, { rz: Math.PI / 2, ry: 0.05, lo: true });
  }

  // ---------- 右の壁: 奥の試験室へ通じる扉（閉じている）----------
  P.box(0.5, 22, 12, '#4a5372', XR - 0.25, 11, -14);
  for (const z of [-20.45, -7.55]) P.box(0.6, 23, 0.9, '#2d3452', XR - 0.3, 11.5, z);
  P.box(0.6, 0.9, 13.8, '#2d3452', XR - 0.3, 22.4, -14);
  P.box(0.7, 0.5, 2.6, C.lever, XR - 0.9, 11, -9.8);
  P.box(0.6, 3.2, 2.2, C.reader, XR - 0.3, 13, -23.5);
  P.cyl(0.9, 0.5, '#9aa1a8', XR - 0.7, 16.4, -23.5, { rz: Math.PI / 2 });

  // ===== まとめて描く =====
  addMesh(P, lambert(), { receive: true });
  addMesh(PC, lambert(), { cast: true, receive: true });
  addMesh(GL, new THREE.MeshLambertMaterial({
    vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, emissive: 0x1a2a3a,
  }), { renderOrder: 3 });
  const haze = addMesh(HZP, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false,
  }), { rgba: true, renderOrder: 2 });
  const wash = addMesh(WSP, new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, map: washTexture(), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }), { uv: true, renderOrder: 1 });
  const glow = addMesh(GWP, new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }), { uv: true, renderOrder: 1 });
  const pools = addMesh(PLP, new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, map: glowTexture(), transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  }), { uv: true, renderOrder: 1 });
  wash.visible = false; glow.visible = false; pools.visible = false;

  // 灯り（1回の描画）。要素ごとの頂点の範囲を覚えておき、出来事で色だけ書き換える
  const lights = addMesh(LT, new THREE.MeshBasicMaterial({ vertexColors: true }), {});
  const els = LT.list.filter((p) => p.tag).map((p) => ({
    start: p.start, count: p.count, grp: p.tag.grp, delay: p.tag.delay || 0, dur: p.tag.dur || 0.15,
    off: new THREE.Color(p.tag.off), on: new THREE.Color(p.tag.on), cur: 0,
  }));

  // ブラインド（1回の描画）。上端を原点にして、上げるときは縦に縮める
  const BP = pieces();
  const ZBL = BACK + 2.3;
  for (const [cx, w] of BL) {
    for (let y = -0.5; y > -19.6; y -= 1.15) {
      BP.box(w, 1.0, 0.22, C.blind, cx, y - 0.5, ZBL);
      BP.box(w, 0.15, 0.22, C.blindLine, cx, y - 1.07, ZBL + 0.06);
    }
    BP.box(w + 0.4, 0.7, 0.8, C.blindRail, cx, -20.3, ZBL);
  }
  const blinds = addMesh(BP, lambert(), { receive: true, moving: true });
  blinds.position.y = 31.2;

  // 覆い（1つずつ動かす）。箱に布を掛けた形にする（ただの灰色の箱に見えないように）:
  //   上の縁は丸め（布が角で折れて垂れる）、四隅に縦の襞、角から斜めに引かれた襞、
  //   裾は床（机）に広がって角が尾を引く。色は明るい生成りの帆布で、暗い部屋で「何か隠してある」と分かる
  const cover = (x, y0, z, w, h, d, folds, seed) => {
    const Q = pieces(), r = 0.8, yT = h + 0.3;
    Q.box(w, h - r, d, C.cloth, 0, (h - r) / 2 + 0.3, 0);                       // 胴
    Q.box(w - 2 * r, r, d - 2 * r, C.clothHi, 0, yT - r / 2, 0);                // 上面
    for (const s of [-1, 1]) {                                                  // 上の縁の丸み
      Q.cyl(r, w - 2 * r, C.clothHi, 0, yT - r, s * (d / 2 - r), { rz: Math.PI / 2 });
      Q.cyl(r, d - 2 * r, C.clothHi, s * (w / 2 - r), yT - r, 0, { rx: Math.PI / 2 });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      Q.cyl(r, r * 1.6, C.clothHi, sx * (w / 2 - r), yT - r * 1.1, sz * (d / 2 - r), { lo: true });   // 上の角
      Q.box(1.3, h - 1.2, 0.5, C.clothDark, sx * (w / 2 - 0.1), (h - 1.2) / 2 + 0.6, sz * (d / 2 - 0.1), { ry: sx * sz * Math.PI / 4 });   // 四隅の襞
      Q.box(3.4, 0.35, 1.5, C.clothDark, sx * (w / 2 + 0.9), 0.18, sz * (d / 2 + 0.9), { ry: -sx * sz * Math.PI / 4 });          // 裾の尾
    }
    Q.box(w + 1.4, 0.7, d + 1.4, C.clothDark, 0, 0.35, 0);                      // 裾の広がり
    for (let i = 0; i < folds; i++) {                                           // 前の縦の襞（長さを不揃いに）
      const fx = -w / 2 + (i + 0.7 + rnd(seed + i) * 0.4) * (w / (folds + 0.4)), len = (h - 1.5) * (0.5 + rnd(seed * 3 + i) * 0.45);
      Q.box(0.8, len, 0.35, C.clothDark, fx, 0.7 + len / 2, d / 2 + 0.12);
      Q.box(0.6, len * 0.8, 0.3, C.clothHi, fx + 0.75, 0.7 + len * 0.42, d / 2 + 0.1);
    }
    for (const s of [-1, 1]) {                                                  // 上の角から斜めに引かれた襞
      Q.box(Math.min(w, h) * 0.42, 0.5, 0.3, C.clothDark, s * w * 0.3, yT - h * 0.22, d / 2 + 0.14, { rz: s * 0.75 });
    }
    Q.box(0.35, h * 0.55, 1.0, C.clothDark, w / 2 + 0.12, 0.7 + h * 0.28, d * 0.12);   // 横の襞
    const m = addMesh(Q, lambert(), { receive: true, moving: true });
    m.position.set(x, y0, z);
    return { m, y0 };
  };
  const covers = [
    cover(RXc, 0, RZc, 17.8, 26.0, 11.8, 4, 11),
    cover(MXc, TOP, MZc, 19, 7.4, 10.4, 3, 23),
  ];

  // openAt / litAt は出来事が来た時刻（秒・実時間）。null の間はまだ閉じている／点いていない
  A = {
    haze, wash, glow, pools, blinds, covers, doorG, lights, els,
    openAt: null, openDone: false, litAt: null, litDone: false, dirty: false,
  };
  // 章の状態がもう先へ進んでいたら（場面だけ建て直したとき）、出来事を待たずにその形にそろえる
  if (stage && stage.bossBarRevealed) { A.openAt = clock() - 9; applyOpen(9); A.openDone = true; }
  if (stage && stage.cleared) { A.litAt = clock() - 9; applyLit(9); A.litDone = true; }
  flush();
}

// ===== 出来事 =====
// 演出の時計は実時間で進める。tick の dt はシェルが1コマ0.25秒で頭打ちにするので、
// コマ落ちする端末（や撮影用のヘッドレス）では演出が実時間より遅れ、途中の形のまま止まって見える
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
// 点き方: 蛍光灯のように2〜3回瞬いてから、暖かく明るくなる（0〜0.7秒）
function lightOn(T) {
  if (T < 0) return 0;
  const seq = [[0, 0.65], [0.07, 0.08], [0.13, 0.8], [0.2, 0.2], [0.27, 0.9], [0.33, 0.55]];
  if (T >= 0.42) return Math.min(1, 0.55 + (T - 0.42) / 0.25 * 0.45);
  let v = 0;
  for (const [t, a] of seq) if (T >= t) v = a;
  return v;
}

const _c = new THREE.Color();
function setEl(el, k) {
  if (Math.abs(el.cur - k) < 1e-3) return;
  el.cur = k;
  _c.copy(el.off).lerp(el.on, k);
  const arr = A.lights.geometry.attributes.color.array;
  for (let i = el.start; i < el.start + el.count; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  A.dirty = true;
}
function applyLights(grp, fn) {
  for (const el of A.els) if (el.grp === grp && fn) setEl(el, fn(el));
}
function flush() {
  if (A && A.dirty) { A.lights.geometry.attributes.color.needsUpdate = true; A.dirty = false; }
}

// 開く。T は 'reveal' からの秒。1.5秒で全部そろう
function applyOpen(T) {
  const on = lightOn(T);
  const k = ease((T - 0.05) / 0.95);
  setLights(on);
  if (scene.fog) {
    scene.fog.color.copy(FOG.c0).lerp(FOG.c1, k);
    scene.fog.near = FOG.n0 + (FOG.n1 - FOG.n0) * k;
    scene.fog.far = FOG.f0 + (FOG.f1 - FOG.f0) * k;
  }
  A.haze.material.opacity = 1 - k;
  A.haze.visible = k < 0.999;
  A.wash.material.opacity = 0.5 * on;
  A.wash.visible = on > 0.001;
  A.pools.material.opacity = 0.45 * on;
  A.pools.visible = on > 0.001;
  applyLights('cove', () => on);
  applyLights('lamp', () => (T >= 0.3 ? 1 : 0));
  applyLights('screen', (el) => (T < el.delay ? 0 : T < el.delay + 0.08 ? 0.6 : T < el.delay + 0.14 ? 0.15 : 1));
  // ブラインドが上がる（上端に畳まれる）
  A.blinds.scale.y = 1 - 0.9 * ease((T - 0.25) / 0.8);
  // 覆いが引き上げられる（天井の縁の向こうへ消える）
  A.covers.forEach((cv, i) => {
    const u = clamp01((T - (0.1 + 0.22 * i)) / 0.45);
    cv.m.position.y = cv.y0 + 46 * easeIn(u);
    cv.m.visible = u < 1;
  });
  // 引き戸が開く
  A.doorG.position.z = -18.4 * ease((T - 0.45) / 0.6);
}

// 完成。T は 'defeated' からの秒。黒い箱の継ぎ目→状態灯→表示窓の順に点き、まわりが照らされる
function applyLit(T) {
  applyLights('box', (el) => clamp01((T - el.delay) / el.dur));
  const g = ease((T - 0.1) / 0.8);
  A.glow.material.opacity = 0.75 * g;
  A.glow.visible = g > 0.001;
}

export function onEvent(name, arg) {
  if (!A) return;
  if (name === 'reveal') {
    if (A.openAt == null) { A.openAt = clock(); applyOpen(0); }
  } else if (name === 'defeated') {
    // HPバーが見える前に倒れたときも、部屋は開く
    if (A.openAt == null) { A.openAt = clock(); applyOpen(0); }
    if (A.litAt == null) { A.litAt = clock(); applyLit(0); }
  } else if (name === 'tick') {
    if (A.openAt != null && !A.openDone) {
      const T = clock() - A.openAt;
      applyOpen(Math.min(T, 9));
      if (T >= 1.5) A.openDone = true;
    }
    if (A.litAt != null && !A.litDone) {
      const T = clock() - A.litAt;
      applyLit(Math.min(T, 9));
      if (T >= 1.2) A.litDone = true;
    }
    // 閉じている間、霧がわずかに揺れる
    if (A.openAt == null && arg && arg.t != null) A.haze.material.opacity = 0.92 + 0.08 * Math.sin(arg.t * 0.6);
  }
  flush();
}

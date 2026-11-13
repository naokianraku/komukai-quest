// 小向クエスト2 ゴールデンエイジ編 — 第1章「配属編」研修センターの大講堂（g2_kodo）
//
// 章の始まり（ゲーム座標 x 0〜499）と、ボス戦（教育担当課長の配属発表。章の右端）で張る場面。
// 6章でいちばん明るく暖かい（春・入社1年目）。理不尽だが、まだ誰も本気で傷ついていない。
//
// 横の並び（ワールド座標。W = 章の幅/3。ボスは x≈W-20、自機は x≈W-50 で始まる）:
//   〜 -92        段々の客席
//   -92 〜 -14    入口の両開きの扉と、白いヘルメットが並ぶ棚（全員同じ白）
//   -14 〜 56     段々の客席（高窓の外は桜）
//   56 〜 148     一段高い壇・演台・大きな投影幕（最初の研修はここ）
//   148 〜 W-150  段々の客席（通路の階段・手すり・足元灯）
//   W-150 〜      舞台。投影幕・袖幕・演台・生け花・ヘルメットの棚（配属発表の場）
// 手前ゾーンは客席の前列の背もたれだけ（遮蔽の線より低い）。
//
// 出来事:
//   bossStart … 舞台の投影幕に配属表が映り、演台に明かりが入る（自発光の板。hemi/sun は触らない）
//   defeated  … 舞台の棚の白いヘルメットが、配属の色（緑・青・黄・紫）に分かれていく
//   tick      … 壇の投影幕のスライド送り・壁の時計の秒針
// 文字・ロゴ・社章・旗は描かない（投影幕も札も、無地の板と色の棒だけ）。
import {
  THREE, boxBatch, addScenery, hex, zones, setLighting, ceilingSlab, scene, hemi, sun, fill, renderer,
} from '../../../game3d/src/render3d.js';

const C = {
  bg: '#efe5d0',
  wall: '#f1e6cc', rail: '#a8784a', wainscot: '#b2824f', wainscotLine: '#8f6439',
  ceiling: '#f4eee2',
  riser: '#8e6039', tread: '#c49660', nosing: '#dcb57d',
  parapet: '#a0703f', parapetCap: '#cf9f68',
  seat: '#ad463f', seatBack: '#9c3e39', arm: '#5e3f2a', shell: '#7d5336', plate: '#f3efe4',
  binder: '#f3f1e9', binderSpine: '#d8d2c2',
  stageBody: '#6e4a2d', stageTop: '#ab7a4a', stageLine: '#94673e', stageLip: '#cf9d64',
  drape: '#7f2834', drape2: '#661f2b',
  curtain: '#8c2b3b', curtain2: '#72202f',
  panel: '#c99c69', slat: '#b0814f',
  frame: '#3e3632',
  lectern: '#7a4f2f', lecternPanel: '#9d6b41', lecternTop: '#5f3c23', mic: '#2b2b2e',
  helmet: '#f6f5ef',
  rack: '#bb8d5a', rackDark: '#916741',
  door: '#a8764b', doorFrame: '#6f4c2f', doorGlass: '#5d6b74', pushbar: '#cfcbc2', kick: '#c9c2b2',
  cork: '#c09461', paper: ['#fbfaf4', '#f3eedc', '#e3edf4', '#f6e6dc'],
  winFrame: '#dcd5c5', drapeWin: '#eadbbb', drapeWin2: '#d8c497',
  speaker: '#4a4440', grille: '#5f5852',
  clockRim: '#3a3430', clockFace: '#fbfaf5',
  stand: '#2c2623', vase: '#e8e2d4', leaf: '#4f7f42', leaf2: '#3d6a34',
  blossom: '#f1aac1', blossom2: '#f9dde6', twig: '#5a4030',
  table: '#ece6d9', tableLeg: '#a6a29a', pitcher: '#dce8ec',
  railing: '#c9c3b6', footlight: '#ffd9a0',
};
// 窓の外（春の朝）。光の計算をしない材質で描くので、面の向きの陰は色に焼き込む（shade）
const OUT = {
  sky: '#c2e1f4', hill: '#a6c4ad', hillFar: '#b9cfc8', bldg: '#eee8dc', bldgWin: '#a9c0cc', roof: '#9aa4a8',
  trunk: '#5c4636', blossom: ['#f6c9d5', '#f1b7c8', '#f9dbe3', '#efc0cf'],
};
// 配属の色（主人公・設計・現場・品証）。defeated で舞台の棚のヘルメットがこの色に分かれる
const DEPT = ['#36b06a', '#4a7ad0', '#e8c84a', '#9a6ad0'];

// 段々の客席（奥ゾーン z<-28 に収める）。k 段目の踏み面は zf(k)〜zf(k+1)、高さ RISE*k
const ROWS = 5, PITCH = 7, RISE = 2.6, Z0 = -30, SEAT_W = 6, AISLE_HALF = 3.6;
const zf = (k) => Z0 - PITCH * k;
const zs = (k) => zf(k) - PITCH / 2;
const DAIS_H = 3.0, DAIS_Z = -32;     // 研修の壇（一段高い）
const STAGE_H = 4.0, STAGE_Z = -31;   // 舞台

// ===== 出来事で動かす物（build のたびに作り直す。前の章の参照を残さない）=====
let fx = null;
const DBG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('dbg') === '1';

// ===== 道具 =====
// 箱以外の形（ヘルメット・花瓶・時計）や回した箱、光る物・窓の外を、材質ごとに1つのメッシュへまとめる。
// boxBatch と同じ頂点カラー方式で、影を落とす物と落とさない物で分けて最大2回の描画で済ませる。
// shade を付けた物は、光の計算をしない材質でも形が読めるよう、面の向きで色を落として焼き込む。
function meshBatch() {
  const parts = [];
  const api = {
    geo(g, color, x, y, z, o = {}) {
      if (o.sx || o.sy || o.sz) g.scale(o.sx || 1, o.sy || 1, o.sz || 1);
      if (o.rx) g.rotateX(o.rx);
      if (o.rz) g.rotateZ(o.rz);
      if (o.ry) g.rotateY(o.ry);
      g.translate(x, y, z);
      parts.push({ g, color, cast: !!o.cast, shade: !!o.shade });
      return parts.length - 1;
    },
    box(w, h, d, color, x, y, z, o) { return api.geo(new THREE.BoxGeometry(w, h, d), color, x, y, z, o); },
    cyl(rt, rb, h, color, x, y, z, o = {}) {
      return api.geo(new THREE.CylinderGeometry(rt, rb, h, o.seg || 12), color, x, y, z, o);
    },
    // material を渡して1〜2個のメッシュにする。ranges[i] = [メッシュ, 頂点の先頭, 頂点数]（色の差し替え用）
    done(material, { receive = true, dynamic = false } = {}) {
      const ranges = [];
      const meshes = [];
      for (const cast of [true, false]) {
        const list = parts.map((p, i) => [p, i]).filter(([p]) => p.cast === cast);
        if (!list.length) continue;
        const pos = [], nor = [], col = [], idx = [];
        const c = new THREE.Color();
        for (const [p, i] of list) {
          c.set(p.color);
          const base = pos.length / 3;
          const P = p.g.attributes.position, N = p.g.attributes.normal;
          for (let v = 0; v < P.count; v++) {
            const nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v);
            pos.push(P.getX(v), P.getY(v), P.getZ(v)); nor.push(nx, ny, nz);
            let k = 1;
            if (p.shade) k = ny > 0.5 ? 1 : ny < -0.5 ? 0.62 : (Math.abs(nz) >= Math.abs(nx) ? 0.9 : 0.8);
            col.push(c.r * k, c.g * k, c.b * k);
          }
          if (p.g.index) for (let v = 0; v < p.g.index.count; v++) idx.push(base + p.g.index.array[v]);
          else for (let v = 0; v < P.count; v++) idx.push(base + v);
          ranges[i] = [meshes.length, base, P.count];
          p.g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        const ca = new THREE.Float32BufferAttribute(col, 3);
        if (dynamic) ca.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('color', ca);
        geo.setIndex(idx);
        // 材質は1つを共有させない（場面を捨てるとき clearScenery がメッシュごとに dispose する）
        const m = new THREE.Mesh(geo, meshes.length ? material.clone() : material);
        m.castShadow = cast; m.receiveShadow = receive;
        m.matrixAutoUpdate = false; m.updateMatrix();
        addScenery(m);
        meshes.push(m);
      }
      if (!meshes.length) material.dispose();
      parts.length = 0;
      return { meshes, ranges };
    },
  };
  return api;
}

// 床の木目。板を1枚ずつ箱で並べると数千個になるので、1枚の絵（繰り返し）にして床に貼る。
// 一度作れば使い回す（場面を張り替えても同じ絵。clearScenery は絵を捨てない）。
const TILE_W = 96, TILE_H = 48;          // 絵1枚が覆う床の広さ（ワールド単位）。板の幅は 2.4
let woodTex = null;
function woodTexture() {
  if (woodTex) return woodTex;
  const cw = 1024, ch = 512, rows = 20, rh = ch / rows;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  let s = 20240401;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    let x = rnd() * cw;
    const end = x + cw;
    while (x < end - 1) {
      const len = Math.min(end - x, 230 + rnd() * 280);
      const col = `hsl(${(31 + rnd() * 5).toFixed(1)},${(34 + rnd() * 9).toFixed(1)}%,${(57 + rnd() * 8).toFixed(1)}%)`;
      const grain = [0, 1, 2].map(() => [3 + rnd() * (rh - 6), rnd() * 0.08 + 0.05]);
      for (const off of [0, -cw]) {          // 右端をはみ出した板は左端にも描く（継ぎ目なく繰り返すため）
        g.fillStyle = col; g.fillRect(x + off, y, len, rh);
        for (const [gy, a] of grain) { g.fillStyle = `rgba(110,68,30,${a.toFixed(3)})`; g.fillRect(x + off, y + gy, len, 1); }
        g.fillStyle = 'rgba(86,52,22,0.42)'; g.fillRect(x + off, y, 2, rh);   // 板の端の継ぎ目
      }
      x += len;
    }
    g.fillStyle = 'rgba(86,52,22,0.32)'; g.fillRect(0, y, cw, 2);          // 板と板の継ぎ目
  }
  woodTex = new THREE.CanvasTexture(cv);
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return woodTex;
}

// 投影幕に映すスライド（文字は描かない。見出しの帯・箇条の棒・図だけ）。600×250 の仮の座標で描く
const slideTex = {};
function slideTexture(kind) {
  if (slideTex[kind]) return slideTex[kind];
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.scale(512 / 600, 256 / 250);
  const bar = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (kind === 'standby') {
    const gr = g.createLinearGradient(0, 0, 0, 250);
    gr.addColorStop(0, '#3a5f98'); gr.addColorStop(1, '#2a4676');
    g.fillStyle = gr; g.fillRect(0, 0, 600, 250);
    bar(268, 105, 64, 40, 'rgba(255,255,255,0.18)');
  } else {
    bar(0, 0, 600, 250, '#f8f7f2');
    const head = kind === 'haizoku' ? '#2c3d5c' : '#2f6f86';
    bar(0, 0, 600, 44, head);
    bar(0, 44, 600, 4, '#e0b04a');
    bar(28, 16, kind === 'haizoku' ? 180 : 230, 12, 'rgba(255,255,255,0.85)');   // 見出し（文字の代わりの白い棒）
    if (kind === 'manner') {
      [250, 190, 268, 150].forEach((w, i) => { bar(34, 78 + i * 40, 12, 12, head); bar(58, 79 + i * 40, w, 10, '#8b9096'); });
      // 名刺交換の図: 2枚の名刺と矢印
      g.save(); g.translate(430, 128); g.rotate(-0.12);
      bar(-62, -36, 110, 64, '#ffffff'); g.strokeStyle = '#9aa3aa'; g.lineWidth = 3; g.strokeRect(-62, -36, 110, 64);
      bar(-50, -22, 46, 7, '#c9ced2'); bar(-50, -6, 70, 5, '#dde1e4');
      g.restore();
      g.save(); g.translate(488, 172); g.rotate(0.1);
      bar(-50, -30, 100, 58, '#ffffff'); g.strokeStyle = '#9aa3aa'; g.lineWidth = 3; g.strokeRect(-50, -30, 100, 58);
      bar(-40, -18, 40, 6, '#c9ced2');
      g.restore();
      g.strokeStyle = '#e0a03a'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(360, 205); g.lineTo(410, 205); g.moveTo(398, 195); g.lineTo(410, 205); g.lineTo(398, 215); g.stroke();
    } else if (kind === 'bow') {
      [230, 170, 205].forEach((w, i) => { bar(34, 84 + i * 44, 12, 12, head); bar(58, 85 + i * 44, w, 10, '#8b9096'); });
      // お辞儀の角度（15°・30°・45°）を、支点から開く3本の線で
      const px = 430, py = 214;
      bar(px - 90, py, 180, 4, '#b8bcc0');
      [[15, '#5aa06a'], [30, '#e0a03a'], [45, '#2f6f86']].forEach(([deg, c]) => {
        const a = (deg * Math.PI) / 180;
        g.strokeStyle = c; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.sin(a) * 130, py - Math.cos(a) * 130); g.stroke();
      });
      g.strokeStyle = '#c9ced2'; g.lineWidth = 3;
      g.beginPath(); g.arc(px, py, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI / 4); g.stroke();
      g.fillStyle = '#3e3632'; g.beginPath(); g.arc(px, py, 7, 0, Math.PI * 2); g.fill();
    } else if (kind === 'haizoku') {
      // 配属表: 色の札（配属先）・名前の代わりの棒・備考の棒。表の罫線
      const rows = 8, top = 64, rh = 22;
      for (let r = 0; r < rows; r++) {
        const y = top + r * rh;
        if (r % 2) bar(24, y, 552, rh, '#eeeee8');
        bar(36, y + 5, 46, rh - 10, DEPT[(r * 3 + 1) % 4]);
        bar(104, y + 7, 120 + ((r * 37) % 90), 8, '#6f757c');
        bar(372, y + 7, 70 + ((r * 53) % 110), 8, '#a7acb1');
      }
      g.strokeStyle = '#c9ccd0'; g.lineWidth = 2;
      g.strokeRect(24, top, 552, rows * rh);
      g.beginPath(); g.moveTo(92, top); g.lineTo(92, top + rows * rh); g.moveTo(356, top); g.lineTo(356, top + rows * rh); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (slideTex[kind] = t);
}

// 舞台の明かりの溜まり（中心が明るく縁が消える円）
let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  poolTex = new THREE.CanvasTexture(cv); poolTex.colorSpace = THREE.SRGBColorSpace;
  return poolTex;
}

// 範囲 [x0,x1] から通路 gaps（[a,c] の並び）を抜いた区間
function splitRange(x0, x1, gaps) {
  const out = [];
  let x = x0;
  for (const [a, c] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > x) out.push([x, Math.min(a, x1)]);
    x = Math.max(x, c);
  }
  if (x < x1) out.push([x, x1]);
  return out.filter(([a, c]) => c - a > 1);
}

// ===== 場面 =====
export function build(W, halfD, ctx = {}) {
  fx = null;
  const { BACK, FRONT } = zones(halfD, 42, 70);      // 奥の壁 z=-70、手前の端 z=98
  const X0 = -170, X1 = W + 170;                     // 自機が両端にいても背景が切れないよう広めに埋める
  const L = {
    W, BACK, FRONT, X0, X1, XC: (X0 + X1) / 2,
    SX0: W - 150,                                    // 舞台の左端
    entrance: [-92, -14], daisA: [56, 148],
  };
  L.tiers = [[X0, -92, false, true], [-14, 56, true, true], [148, L.SX0, true, true]];   // [x0, x1, 左端の腰壁, 右端の腰壁]

  // 春の朝の講堂。蛍光灯の白ではなく、暖かいクリーム色の光
  setLighting(false);
  hemi.color.set(0xfff2de); hemi.groundColor.set(0x9f8a6b); hemi.intensity = 2.2;
  sun.color.set(0xffe6c0); sun.intensity = 1.05;
  fill.intensity = 1.0;
  scene.background = hex(C.bg);
  scene.fog = new THREE.Fog(hex(C.bg), 320, 950);

  const K = {
    b: boxBatch(),           // 動かない箱
    sh: meshBatch(),         // 箱以外の形・回した箱（光の計算あり）
    glow: meshBatch(),       // 光る物（足元灯）
    glass: meshBatch(),      // 窓ガラス
    out: meshBatch(),        // 窓の外
    helm: meshBatch(),       // 舞台の棚のヘルメット（defeated で色を差し替える）
    stageHelmets: [],        // [部品の番号…] をヘルメット1つずつ
  };
  fx = { t: 0, slideA: null, slideAKind: 'manner', mainScreen: null, pool: null,
    clockHand: null, bossT: null, lit: false, defeatT: null, helm: null, painted: 0 };

  buildFloor(K, L);
  buildWall(K, L);
  // 天井。ceilingSlab は x=-40〜W+40 の分。両端は広げた床に合わせて足す（自機が端にいると切れ目が見えるため）
  const CEIL = ceilingSlab(W, halfD, BACK, C.ceiling, 47);
  K.b.box(-40 - X0, 2, CEIL - BACK, C.ceiling, (X0 - 40) / 2, 47, (CEIL + BACK) / 2);
  K.b.box(X1 - (W + 40), 2, CEIL - BACK, C.ceiling, (X1 + W + 40) / 2, 47, (CEIL + BACK) / 2);

  for (const [a, c, pl, pr] of L.tiers) tiers(K, L, a, c, pl, pr);
  entrance(K, L);
  daisA(K, L);
  mainStage(K, L);
  buildFront(K, L);

  K.b.done();
  K.sh.done(new THREE.MeshLambertMaterial({ vertexColors: true }));
  K.glow.done(new THREE.MeshBasicMaterial({ vertexColors: true }), { receive: false });
  K.glass.done(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.15, depthWrite: false }), { receive: false });
  K.out.done(new THREE.MeshBasicMaterial({ vertexColors: true }), { receive: false });
  const helm = K.helm.done(new THREE.MeshLambertMaterial({ vertexColors: true }), { dynamic: true });
  fx.helm = { mesh: helm.meshes[0] || null, ranges: helm.ranges, list: K.stageHelmets };

  // ボス戦の場面として張られた（＝もう配属発表が始まっている）なら、明かりを入れる流れをここから始める
  if (ctx && ctx.stage && ctx.stage.bossStarted) fx.bossT = 0;
  // ?dbg=1 のときだけ外から出来事の状態を覗けるようにする（本編の __scene と同じ扱い）
  if (DBG) window.__kodo = fx;
}

export function onEvent(name, arg) {
  if (!fx) return;
  if (name === 'bossStart') { if (fx.bossT == null) fx.bossT = 0; return; }
  if (name === 'defeated') { if (fx.defeatT == null) fx.defeatT = 0; return; }
  if (name !== 'tick' || !arg) return;
  const dt = Math.min(0.1, Math.max(0, arg.dt || 0));
  fx.t = arg.t || 0;

  // 壇の投影幕: 7秒ごとにスライドを送る（名刺交換 ↔ お辞儀の角度）
  if (fx.slideA) {
    const kind = Math.floor(fx.t / 7) % 2 ? 'bow' : 'manner';
    if (kind !== fx.slideAKind) { fx.slideA.material.map = slideTexture(kind); fx.slideAKind = kind; }
  }
  // 壁の時計の秒針
  if (fx.clockHand) fx.clockHand.rotation.z = -((fx.t % 60) / 60) * Math.PI * 2;

  // 配属発表: 少し間を置いて投影幕に配属表が映り、演台に明かりが入る
  if (fx.bossT != null) {
    fx.bossT += dt;
    if (!fx.lit && fx.bossT > 0.5 && fx.mainScreen) { fx.mainScreen.material.map = slideTexture('haizoku'); fx.lit = true; }
    const k = Math.min(1, Math.max(0, (fx.bossT - 0.5) / 0.9));
    const e = k * k * (3 - 2 * k);
    if (fx.pool) fx.pool.material.opacity = 0.5 * e;
  }
  // 倒したあと: 白いヘルメットが1つずつ配属の色に変わる
  if (fx.defeatT != null && fx.helm && fx.helm.mesh) {
    fx.defeatT += dt;
    const want = Math.min(fx.helm.list.length, Math.floor(fx.defeatT / 0.035));
    if (want > fx.painted) {
      const ca = fx.helm.mesh.geometry.attributes.color;
      const c = new THREE.Color();
      for (let i = fx.painted; i < want; i++) {
        c.set(DEPT[(i * 7 + (i >> 2)) % 4]);
        for (const pi of fx.helm.list[i]) {
          const r = fx.helm.ranges[pi];
          if (!r) continue;
          for (let v = r[1]; v < r[1] + r[2]; v++) ca.setXYZ(v, c.r, c.g, c.b);
        }
      }
      ca.needsUpdate = true;
      fx.painted = want;
    }
  }
}

// ===== 床 =====
function buildFloor(K, L) {
  const { X0, X1, BACK, FRONT, XC } = L;
  const g = new THREE.PlaneGeometry(X1 - X0, FRONT - BACK);
  g.rotateX(-Math.PI / 2);
  g.translate(XC, 0, (FRONT + BACK) / 2);
  const P = g.attributes.position, U = g.attributes.uv;
  for (let i = 0; i < P.count; i++) U.setXY(i, P.getX(i) / TILE_W, -P.getZ(i) / TILE_H);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: woodTexture() }));
  m.receiveShadow = true;
  addScenery(m);
  // 横通路（歩く帯）の縁。床の模様なので薄い箱
  for (const z of [-29.2, 29.4]) K.b.box(X1 - X0, 0.06, 0.7, '#a67546', XC, 0.03, z);
}

// ===== 奥の壁（クリーム色）と高窓 =====
const WIN_B = 22.5, WIN_T = 33, WIN_W = 22;
function buildWall(K, L) {
  const { b } = K;
  const { X0, X1, XC, BACK } = L;
  const WZ = BACK - 1;
  // 窓は段々の客席の上だけ（壇・舞台・入口の上は壁）
  const wins = [];
  for (const [a, c] of L.tiers) {
    const n = Math.floor((c - a - 18) / 40);
    if (n < 1) continue;
    const step = (c - a) / n;
    for (let i = 0; i < n; i++) wins.push(a + step * (i + 0.5));
  }
  L.windows = wins;
  b.box(X1 - X0, WIN_B, 2, C.wall, XC, WIN_B / 2, WZ);                       // 窓の下
  b.box(X1 - X0, 64 - WIN_T, 2, C.wall, XC, (64 + WIN_T) / 2, WZ);           // 窓の上
  let x = X0;
  for (const cx of wins) {                                                   // 窓と窓のあいだ
    const a = cx - WIN_W / 2;
    if (a > x) b.box(a - x, WIN_T - WIN_B, 2, C.wall, (a + x) / 2, (WIN_B + WIN_T) / 2, WZ);
    x = cx + WIN_W / 2;
  }
  if (X1 > x) b.box(X1 - x, WIN_T - WIN_B, 2, C.wall, (X1 + x) / 2, (WIN_B + WIN_T) / 2, WZ);
  for (const cx of wins) hallWindow(K, L, cx);

  // 客席の上の壁: 窓の下と上に木の見切り、窓と窓のあいだにスピーカー
  for (const [a, c] of L.tiers) {
    b.box(c - a, 1.0, 0.8, C.rail, (a + c) / 2, 21.4, BACK + 0.4);
    b.box(c - a, 0.9, 0.8, C.rail, (a + c) / 2, 35.0, BACK + 0.4);
  }
  wins.forEach((cx, i) => {
    if (i % 2 || i + 1 >= wins.length) return;
    const nx = wins[i + 1];
    if (nx - cx > 60) return;
    const sx = (cx + nx) / 2;
    b.box(3.4, 4.8, 1.6, C.speaker, sx, 28, BACK + 0.8);
    b.box(2.8, 4.0, 0.2, C.grille, sx, 28, BACK + 1.7);
  });
  outside(K, L);
}

function hallWindow(K, L, cx) {
  const { b } = K;
  const { BACK } = L;
  const mid = (WIN_B + WIN_T) / 2, h = WIN_T - WIN_B;
  b.box(WIN_W + 3, 1.0, 2.6, C.winFrame, cx, WIN_B - 0.2, BACK + 0.6);       // 窓台
  b.box(WIN_W + 1, 1.0, 2.0, C.winFrame, cx, WIN_T + 0.1, BACK - 0.8);       // 上枠
  for (const dx of [-WIN_W / 2 + 0.5, WIN_W / 2 - 0.5]) b.box(1.0, h, 2.0, C.winFrame, cx + dx, mid, BACK - 0.8);
  for (const dx of [-WIN_W / 6, WIN_W / 6]) b.box(0.6, h, 0.8, C.winFrame, cx + dx, mid, BACK - 1.2);   // 縦の桟
  b.box(WIN_W, 0.6, 0.8, C.winFrame, cx, WIN_B + h * 0.62, BACK - 1.2);                               // 横の桟
  K.glass.box(WIN_W - 1, h - 0.4, 0.1, '#eaf5fb', cx, mid, BACK - 1.0);
  // 半分ほど引いた生成りのカーテン（襞）
  for (const side of [-1, 1]) {
    const x0 = cx + side * (WIN_W / 2 - 2.4);
    for (let i = 0; i < 5; i++) {
      b.box(1.1, 13.4, 0.6, i % 2 ? C.drapeWin : C.drapeWin2, x0 + side * i * 1.1, 28.0, BACK + 1.0 + (i % 2) * 0.3);
    }
  }
  b.box(WIN_W + 9, 0.9, 1.2, C.rail, cx, 35.25, BACK + 1.3);               // カーテンボックス
}

// 窓の外: 春の空・遠い丘・構内の白い棟・桜。窓の高さ（y≈19〜31 が見える）に入るよう奥行きと高さを決める
function outside(K, L) {
  const { out } = K;
  const { X0, X1, XC, BACK } = L;
  out.box(X1 - X0 + 300, 90, 1, OUT.sky, XC, 30, BACK - 40);
  for (let i = 0, x = X0 - 40; x < X1 + 40; x += 46 + (i % 3) * 13, i++) {
    const h = 19 + ((i * 7) % 5) * 1.2;
    out.box(60, h, 2, OUT.hillFar, x, h / 2, BACK - 34, { shade: true });
  }
  for (let i = 0, x = X0 - 20; x < X1 + 40; x += 58 + (i % 2) * 22, i++) {
    const h = 17 + (i % 3) * 1.6;
    out.box(40 + (i % 2) * 14, h, 6, OUT.bldg, x, h / 2, BACK - 26, { shade: true });
    out.box(36 + (i % 2) * 14, 1.6, 0.4, OUT.bldgWin, x, h - 3.2, BACK - 22.8);
    out.box(42 + (i % 2) * 14, 0.8, 6.4, OUT.roof, x, h + 0.4, BACK - 26, { shade: true });
  }
  // 桜。枝ぶりは見えないので、花のかたまりを重ねて丸く見せる
  for (let i = 0, x = X0 - 10; x < X1 + 20; x += 24 + (i % 3) * 7, i++) {
    const z = BACK - 9 - (i % 2) * 5, cy = 25 + (i % 3) * 1.6;
    out.box(1.4, 14, 1.4, OUT.trunk, x, cy - 8, z, { shade: true });
    const blobs = [[0, 0, 0, 13, 7], [-5, -1.5, 1, 8, 6], [5, -1, -1, 9, 6], [-2, 3.5, 0.5, 9, 5], [3, 2.8, 1.2, 7, 5]];
    blobs.forEach(([dx, dy, dz, w, h], j) => {
      out.box(w, h, w * 0.8, OUT.blossom[(i + j) % OUT.blossom.length], x + dx, cy + dy, z + dz, { shade: true });
    });
  }
}

// ===== 段々の客席 =====
// 同じ椅子が同じ向きで並ぶ。後ろ（壁側）ほど高い段。いちばん手前の段の座面には同じ白いテキストが配られている。
function tiers(K, L, x0, x1, parL, parR) {
  const { b } = K;
  const { BACK } = L;
  const len = x1 - x0;
  const nA = Math.max(0, Math.round(len / 76) - 1);
  const aisles = [];
  for (let i = 1; i <= nA; i++) aisles.push(x0 + (len * i) / (nA + 1));
  const gaps = aisles.map((a) => [a - AISLE_HALF, a + AISLE_HALF]);
  const ix0 = x0 + (parL ? 1.2 : 0), ix1 = x1 - (parR ? 1.2 : 0);   // 腰壁の分だけ段を内側に

  for (let k = 1; k < ROWS; k++) {
    const h = RISE * k, z1 = zf(k), z2 = k === ROWS - 1 ? BACK : zf(k + 1);
    b.box(ix1 - ix0, h, z1 - z2, C.riser, (ix0 + ix1) / 2, h / 2, (z1 + z2) / 2, { cast: true });
    b.box(ix1 - ix0, 0.1, z1 - z2 - 0.4, C.tread, (ix0 + ix1) / 2, h + 0.05, (z1 + z2) / 2 - 0.2);
    b.box(ix1 - ix0, 0.5, 0.6, C.nosing, (ix0 + ix1) / 2, h - 0.15, z1 + 0.1);
  }
  for (let k = 0; k < ROWS; k++) {
    seatRow(K, ix0 + 0.6, ix1 - 0.6, gaps, zs(k), RISE * k, 1, { plate: true, binder: k === 0, cast: true });
  }
  // 通路の階段（1段を2つに割る）・手すり・足元灯
  for (const xa of aisles) {
    for (let k = 1; k < ROWS; k++) {
      const h0 = RISE * (k - 1), hh = h0 + RISE / 2, z1 = zf(k);
      b.box(AISLE_HALF * 2, hh, 3.5, C.riser, xa, hh / 2, z1 + 1.75, { cast: true });
      b.box(AISLE_HALF * 2, 0.1, 3.0, C.tread, xa, hh + 0.05, z1 + 1.55);
      b.box(AISLE_HALF * 2, 0.5, 0.6, C.nosing, xa, hh - 0.15, z1 + 3.6);
      K.glow.box(1.4, 0.5, 0.2, C.footlight, xa - AISLE_HALF + 1.4, h0 + 0.7, z1 + 3.6);
      K.glow.box(1.4, 0.5, 0.2, C.footlight, xa - AISLE_HALF + 1.4, hh + 0.7, z1 + 0.1);
    }
    const rx = xa + AISLE_HALF - 0.5;
    for (let k = 1; k < ROWS; k++) {
      K.b.box(0.45, 6.4, 0.45, C.railing, rx, RISE * k + 3.2, zf(k) - 1.2);
    }
    const y1 = RISE + 6.4, y2 = RISE * (ROWS - 1) + 6.4, za = zf(1) - 1.2, zb = zf(ROWS - 1) - 1.2;
    const lenR = Math.hypot(za - zb, y2 - y1);
    K.sh.box(0.55, 0.55, lenR + 1.6, C.railing, rx, (y1 + y2) / 2, (za + zb) / 2, { rx: Math.atan2(y2 - y1, za - zb) });
  }
  // 区画の端の腰壁（段に沿って段々になる）
  for (const [on, x] of [[parL, x0 + 0.6], [parR, x1 - 0.6]]) {
    if (!on) continue;
    for (let k = 0; k < ROWS; k++) {
      const h = RISE * k + 4.4, z1 = zf(k), z2 = k === ROWS - 1 ? BACK : zf(k + 1);
      b.box(1.2, h, z1 - z2, C.parapet, x, h / 2, (z1 + z2) / 2, { cast: true });
      b.box(1.7, 0.5, z1 - z2 + 0.3, C.parapetCap, x, h + 0.25, (z1 + z2) / 2 - 0.15);
    }
  }
}

// 座席の列。f=+1 はカメラ向き（奥ゾーン）、f=-1 は奥向き（手前ゾーン。背もたれの裏が見える）
function seatRow(K, x0, x1, gaps, zc, h, f, o = {}) {
  const { b } = K;
  const cast = !!o.cast;
  for (const [a, c] of splitRange(x0, x1, gaps)) {
    const n = Math.floor((c - a - 0.8) / SEAT_W);
    if (n < 1) continue;
    const start = (a + c) / 2 - (n * SEAT_W) / 2;
    for (let i = 0; i <= n; i++) {                                                  // 側板（肘掛け）
      b.box(0.8, 5.6, 5.4, C.arm, start + i * SEAT_W, h + 2.8, zc - 0.2 * f, { cast });
    }
    for (let i = 0; i < n; i++) {
      const x = start + (i + 0.5) * SEAT_W;
      b.box(5.2, 1.1, 4.4, C.seat, x, h + 4.05, zc + 0.4 * f, { cast });             // 座面
      b.box(5.2, 6.0, 1.0, C.seatBack, x, h + 7.2, zc - 2.4 * f, { cast });          // 背もたれ
      if (o.plate) b.box(1.5, 0.6, 0.2, C.plate, x, h + 9.4, zc - 1.8 * f);         // 座席番号の札（無地）
      if (o.shell) b.box(4.8, 5.4, 0.35, C.shell, x, h + 7.0, zc - 3.075 * f);      // 背もたれの裏の木
      if (o.binder) {                                                                // 配られた研修テキスト
        const ry = (((i * 37 + Math.round(x)) % 7) - 3) * 0.03;
        b.box(3.0, 0.55, 3.8, C.binder, x - 0.3, h + 4.88, zc + 0.6 * f, { rotY: ry });
        b.box(0.35, 0.6, 3.6, C.binderSpine, x - 1.9, h + 4.9, zc + 0.6 * f, { rotY: ry });
      }
    }
  }
}

// ===== 入口と、白いヘルメットの棚 =====
function entrance(K, L) {
  const { b } = K;
  const { BACK } = L;
  const [a, c] = L.entrance;
  const cx = (a + c) / 2;
  b.box(c - a, 9, 0.6, C.wainscot, cx, 4.5, BACK + 0.3);                     // 腰壁
  b.box(c - a, 0.8, 0.8, C.wainscotLine, cx, 9.2, BACK + 0.4);
  b.box(c - a, 1.0, 0.8, C.rail, cx, 35.0, BACK + 0.4);

  // 両開きの扉（研修生はここから入ってくる）
  const dx = a + 16;
  b.box(23.5, 24.5, 1.4, C.doorFrame, dx, 12.25, BACK + 0.9);
  for (const s of [-1, 1]) {
    const lx = dx + s * 5.1;
    b.box(9.8, 22, 0.6, C.door, lx, 11.0, BACK + 1.9);
    b.box(1.6, 8.5, 0.2, C.doorGlass, lx - s * 2.6, 14.5, BACK + 2.3);
    b.box(7.4, 0.7, 0.9, C.pushbar, lx, 10.2, BACK + 2.6);
    b.box(9.2, 2.2, 0.16, C.kick, lx, 1.3, BACK + 2.28);
  }
  b.box(24, 0.06, 7, '#77706a', dx, 0.03, BACK + 5);                        // 玄関マット

  // 白いヘルメットの棚。全員同じ白、同じ向き、同じ間隔
  rack(K, -39, BACK + 3.2, 0, 9, (x, y, z) => helmet(K.sh, x, y, z, C.helmet));
  // 棚の上: 配る前の研修テキストの山
  for (const [sx, n] of [[-54, 6], [-47, 9], [-40, 4], [-30, 7], [-24, 5]]) {
    for (let i = 0; i < n; i++) b.box(3.4, 0.62, 4.2, i % 3 === 2 ? C.binderSpine : C.binder, sx + ((i * 3) % 2) * 0.2, 17.1 + 0.31 + i * 0.62, BACK + 3.4);
  }
  // 掲示板（紙を貼っただけ。文字は描かない）
  b.box(28, 8.6, 0.5, C.cork, -38, 25.4, BACK + 0.25);
  b.box(29.2, 9.8, 0.3, C.rackDark, -38, 25.4, BACK + 0.1);
  for (let i = 0; i < 6; i++) {
    b.box(4.2 + (i % 2), 5.2 - (i % 3) * 0.6, 0.15, C.paper[i % 4], -49 + i * 4.5, 25.8 - (i % 2) * 0.8, BACK + 0.6);
  }
  // 壁の時計（扉の並びの右。秒針だけ動かす）
  clock(K, c + 8, 28.2, BACK);
}

// 棚: 幅は n 個ぶん。put(x, y, z) で1つずつ載せる。base は床の高さ
function rack(K, cx, z, base, n, put) {
  const { b } = K;
  const w = n * 4.2 + 1.6, H = 16.8;
  b.box(1.0, H, 5.2, C.rack, cx - w / 2 - 0.5, base + H / 2, z, { cast: true });
  b.box(1.0, H, 5.2, C.rack, cx + w / 2 + 0.5, base + H / 2, z, { cast: true });
  b.box(w, H, 0.4, C.rackDark, cx, base + H / 2, z - 2.4);
  for (let i = 0; i < 4; i++) b.box(w, 0.6, 5.2, C.rack, cx, base + 0.3 + i * 5.5, z, { cast: i === 3 });
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < n; i++) put(cx - w / 2 + 0.8 + 2.1 + i * 4.2, base + 0.6 + r * 5.5, z + 0.2);
  }
}

// 保護帽（白）: 鉢・つば・前びさし・頭頂の筋
function helmet(sh, x, y, z, color) {
  return [
    sh.geo(new THREE.SphereGeometry(1.55, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y + 0.22, z, { sz: 1.1 }),
    sh.cyl(1.8, 1.85, 0.24, color, x, y + 0.12, z + 0.1, { seg: 12, sz: 1.1 }),
    sh.box(2.2, 0.2, 1.0, color, x, y + 0.2, z + 2.0),
    sh.box(0.42, 0.42, 3.0, color, x, y + 1.62, z),
  ];
}

function clock(K, x, y, BACK) {
  K.sh.cyl(2.9, 2.9, 0.5, C.clockRim, x, y, BACK + 0.45, { seg: 20, rx: Math.PI / 2 });
  K.sh.cyl(2.5, 2.5, 0.3, C.clockFace, x, y, BACK + 0.7, { seg: 20, rx: Math.PI / 2 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    K.b.box(0.22, i % 3 ? 0.4 : 0.7, 0.1, C.clockRim, x + Math.sin(a) * 2.1, y + Math.cos(a) * 2.1, BACK + 0.9);
  }
  // 9時5分ごろ（朝の研修が始まったところ）
  K.sh.box(0.32, 1.5, 0.1, C.clockRim, x - 0.6, y, BACK + 0.92, { rz: Math.PI / 2 });
  K.sh.box(0.24, 2.0, 0.1, C.clockRim, x + 0.25, y + 0.9, BACK + 0.98, { rz: -0.52 });
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.06), new THREE.MeshLambertMaterial({ color: hex('#c0392b') }));
  hand.geometry.translate(0, 0.8, 0);
  hand.position.set(x, y, BACK + 1.04);
  addScenery(hand);
  fx.clockHand = hand;
}

// ===== 壇（一段高い）と大きな投影幕 =====
function daisA(K, L) {
  const { b } = K;
  const { BACK } = L;
  const [a, c] = L.daisA;
  const cx = (a + c) / 2;
  b.box(c - a, 40, 0.6, C.panel, cx, 20, BACK + 0.3);                                  // 木の背板
  for (const x of [a + 1.5, c - 1.5]) b.box(1.6, 40, 0.5, C.slat, x, 20, BACK + 0.85);
  dais(K, a + 4, c - 4, DAIS_Z, BACK, DAIS_H);
  fx.slideA = screen(K, cx, 20.5, 52, 21.7, BACK, 'manner');
  curtain(K, a + 1.6, a + 11, DAIS_H, 38.5, BACK + 2.6);
  curtain(K, c - 11, c - 1.6, DAIS_H, 38.5, BACK + 2.6);
  valance(K, a + 1, c - 1, 33.2, 38.5, BACK + 3.8);
  lectern(K, cx + 15, -42, DAIS_H, 1);
  flowers(K, a + 17, -45, DAIS_H, 0.9);
  docTable(K, c - 15, -40, DAIS_H);
}

// 壇・舞台の箱: 天板・段鼻・前面の幕（襞）
function dais(K, x0, x1, zFront, BACK, H) {
  const { b } = K;
  const cx = (x0 + x1) / 2, w = x1 - x0;
  b.box(w, H, zFront - BACK, C.stageBody, cx, H / 2, (zFront + BACK) / 2, { cast: true });
  b.box(w, 0.1, zFront - BACK - 1.0, C.stageTop, cx, H + 0.05, (zFront + BACK) / 2 - 0.5);
  for (let z = zFront - 3.4; z > BACK + 1; z -= 2.6) b.box(w, 0.04, 0.22, C.stageLine, cx, H + 0.12, z);
  b.box(w + 0.4, 0.5, 1.1, C.stageLip, cx, H - 0.2, zFront + 0.15);
  const n = Math.round(w / 1.6), pw = w / n;
  for (let i = 0; i < n; i++) {
    b.box(pw, H - 0.45, 0.4, i % 2 ? C.drape : C.drape2, x0 + pw * (i + 0.5), (H - 0.45) / 2, zFront + 0.2 + (i % 2) * 0.14);
  }
}

// 投影幕: 濃い枠と、絵を貼った板（光の計算をしない材質＝映っている明るさ）
function screen(K, cx, cy, w, h, BACK, kind) {
  K.b.box(w + 2.6, h + 2.6, 0.6, C.frame, cx, cy, BACK + 1.3);
  K.b.box(w + 3.4, 1.2, 1.4, C.frame, cx, cy + h / 2 + 1.6, BACK + 1.5);              // 巻き取りの箱
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: slideTexture(kind), color: hex('#f1eee6') }));
  m.position.set(cx, cy, BACK + 1.7);
  addScenery(m);
  return m;
}

function curtain(K, x0, x1, y0, y1, z) {
  const n = Math.max(2, Math.round((x1 - x0) / 1.3)), pw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    K.b.box(pw, y1 - y0, 0.9, i % 2 ? C.curtain : C.curtain2, x0 + pw * (i + 0.5), (y0 + y1) / 2, z + (i % 2) * 0.35, { cast: true });
  }
}

function valance(K, x0, x1, y0, y1, z) {
  const n = Math.max(2, Math.round((x1 - x0) / 1.6)), pw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    K.b.box(pw, y1 - y0, 0.8, i % 2 ? C.curtain : C.curtain2, x0 + pw * (i + 0.5), (y0 + y1) / 2, z + (i % 2) * 0.3);
  }
}

// 演台。正面はカメラ向き（話す人は演台と投影幕のあいだに立つ）
function lectern(K, x, z, base, s) {
  const { b, sh } = K;
  b.box(9 * s, 11 * s, 6, C.lectern, x, base + 5.5 * s, z, { cast: true });
  b.box(7.4 * s, 8.6 * s, 0.4, C.lecternPanel, x, base + 5.4 * s, z + 3.2);
  b.box(9.8 * s, 0.4, 6.4, C.lecternPanel, x, base + 0.2, z);
  b.box(9.8 * s, 0.7, 6.8, C.lecternTop, x, base + 11 * s + 0.35, z, { cast: true });
  sh.box(8.6 * s, 0.45, 4.6, C.lecternTop, x, base + 11 * s + 1.35, z - 0.3, { rx: -0.3 });   // 原稿台
  sh.box(0.25, 3.4, 0.25, C.mic, x + 2.6 * s, base + 11 * s + 2.2, z + 1.4, { rx: -0.45 });   // マイク
  sh.box(0.55, 0.55, 1.0, C.mic, x + 2.6 * s, base + 11 * s + 3.7, z + 2.1);
  sh.cyl(0.55, 0.45, 1.5, C.pitcher, x - 3.2 * s, base + 11 * s + 1.45, z + 1.6, { seg: 8 });   // 水のコップ
}

// 生け花（春）: 黒い花台・白い花器・緑のかたまり・桜の枝
function flowers(K, x, z, base, s) {
  const { b, sh } = K;
  b.box(5 * s, 7 * s, 5 * s, C.stand, x, base + 3.5 * s, z, { cast: true });
  b.box(5.8 * s, 0.5, 5.8 * s, '#3c342f', x, base + 7 * s + 0.25, z);
  const y0 = base + 7 * s + 0.5;
  sh.cyl(1.7 * s, 1.3 * s, 3.4 * s, C.vase, x, y0 + 1.7 * s, z, { seg: 12, cast: true });
  const top = y0 + 3.4 * s;
  [[-1.6, 1.2, 0.4, 3.2, 0.3], [1.5, 1.0, -0.3, 3.0, -0.4], [0, 2.2, 0.8, 3.4, 0.1], [-0.6, 3.4, -0.5, 2.6, 0.6], [1.0, 3.0, 0.6, 2.4, -0.2]]
    .forEach(([dx, dy, dz, w, r], i) => sh.box(w * s, w * 0.7 * s, w * 0.8 * s, i % 2 ? C.leaf : C.leaf2, x + dx * s, top + dy * s, z + dz * s, { ry: r, cast: true }));
  // 桜の枝: 細い枝を斜めに立て、枝先に花のかたまり
  [[-0.5, -0.5, 9, 0.35], [0.6, 0.45, 8, -0.3], [0.1, -0.15, 10, 0.08]].forEach(([dx, rz, len, rx]) => {
    const cx = x + (dx + Math.sin(-rz) * len * 0.5) * s, cy = top + 1.5 * s + Math.cos(rz) * len * 0.5 * s;
    sh.box(0.35 * s, len * s, 0.35 * s, C.twig, cx, cy, z, { rz, rx: rx * 0.3 });
    for (let j = 0; j < 4; j++) {
      const t = 0.45 + j * 0.18;
      const bx = x + (dx + Math.sin(-rz) * len * t) * s, by = top + 1.5 * s + Math.cos(rz) * len * t * s;
      sh.box((1.5 - j * 0.15) * s, (1.3 - j * 0.1) * s, 1.4 * s, j % 2 ? C.blossom2 : C.blossom, bx + (j % 2 ? 0.6 : -0.5) * s, by, z + (j % 2 ? 0.4 : -0.3) * s, { ry: j * 0.5 });
    }
  });
}

// 書類の机: 綴じた資料の山・バインダー・水差し
function docTable(K, x, z, base) {
  const { b, sh } = K;
  b.box(13, 0.6, 6.4, C.table, x, base + 7.2, z, { cast: true });
  for (const [dx, dz] of [[-5.8, -2.6], [5.8, -2.6], [-5.8, 2.6], [5.8, 2.6]]) b.box(0.5, 6.9, 0.5, C.tableLeg, x + dx, base + 3.45, z + dz);
  b.box(12, 3.2, 0.3, C.table, x, base + 5.2, z + 2.9);                                   // 幕板
  for (const [dx, n] of [[-4, 8], [-0.6, 5], [2.8, 10]]) {
    for (let i = 0; i < n; i++) b.box(3.0, 0.32, 4.0, C.paper[(i + n) % 4], x + dx + ((i * 7) % 3) * 0.12, base + 7.66 + i * 0.32, z - 0.6 + ((i * 5) % 3) * 0.1);
  }
  for (let i = 0; i < 4; i++) b.box(0.7, 4.4, 3.4, ['#2f5a8f', '#8f3a2e', '#4a7a3e', '#e8e4da'][i], x + 4.6 + i * 0.75, base + 9.7, z + 0.8);   // 立てたバインダー
  sh.cyl(0.9, 1.1, 2.6, C.pitcher, x - 5.4, base + 8.8, z + 1.8, { seg: 10 });
}

// ===== 舞台（配属発表の場。ボス戦はここ）=====
function mainStage(K, L) {
  const { b } = K;
  const { W, SX0, X1, BACK } = L;
  dais(K, SX0, X1, STAGE_Z, BACK, STAGE_H);
  // 舞台に上がる階段（左端。客席の側から上がる）
  b.box(10, 1.35, 2.4, C.stageBody, SX0 + 10, 0.675, STAGE_Z + 1.2, { cast: true });
  b.box(10, 2.7, 1.2, C.stageBody, SX0 + 10, 1.35, STAGE_Z + 0.6, { cast: true });
  b.box(10.2, 0.12, 2.4, C.stageLip, SX0 + 10, 1.41, STAGE_Z + 1.2);
  b.box(10.2, 0.12, 1.2, C.stageLip, SX0 + 10, 2.76, STAGE_Z + 0.6);

  // 木の背板と縦のリブ（音響の壁）。投影幕と袖幕のうしろは省く
  const SCX = W - 12, SCW = 72, SCH = 30;
  b.box(X1 - SX0, 56, 0.6, C.panel, (SX0 + X1) / 2, STAGE_H + 28, BACK + 0.3);
  const RK0 = W - 132, RK1 = W - 80;                 // 棚のうしろは棚より上だけ
  for (let x = SX0 + 2; x < X1; x += 3.4) {
    if (Math.abs(x - SCX) < SCW / 2 + 22) continue;
    const y0 = x > RK0 && x < RK1 ? STAGE_H + 18 : STAGE_H;
    b.box(1.4, STAGE_H + 40 - y0, 0.5, C.slat, x, (y0 + STAGE_H + 40) / 2, BACK + 0.85);
  }
  fx.mainScreen = screen(K, SCX, STAGE_H + 6 + SCH / 2, SCW, SCH, BACK, 'standby');
  curtain(K, SCX - SCW / 2 - 15, SCX - SCW / 2 - 2, STAGE_H, 45, BACK + 2.8);
  curtain(K, SCX + SCW / 2 + 2, SCX + SCW / 2 + 15, STAGE_H, 45, BACK + 2.8);
  valance(K, SCX - SCW / 2 - 17, SCX + SCW / 2 + 17, 38.6, 45, BACK + 4.6);

  const LX = W + 8, LZ = -42;
  lectern(K, LX, LZ, STAGE_H, 1.1);
  flowers(K, W - 54, -46, STAGE_H, 1.05);
  docTable(K, W + 38, -47, STAGE_H);

  // 舞台の棚: 配属を待つ白いヘルメット（倒すと色が分かれる）
  rack(K, W - 106, BACK + 3.2, STAGE_H, 11, (x, y, z) => K.stageHelmets.push(helmet(K.helm, x, y, z, C.helmet)));

  // 舞台の明かり（bossStart で入る）。演台のまわりの床に暖かい光の溜まり
  const pool = new THREE.Mesh(new THREE.CircleGeometry(10, 40), new THREE.MeshBasicMaterial({
    color: hex('#ffd9a6'), map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(1.4, 1, 1);                         // 横長の楕円。舞台の前の縁（z=-31）を越えない
  pool.position.set(LX - 4, STAGE_H + 0.2, LZ + 1);
  pool.renderOrder = 2;
  addScenery(pool);
  fx.pool = pool;
}

// ===== 手前ゾーン: 客席の前列 =====
// 画面の下の縁に背もたれの上のほうだけが並ぶ位置に置く（ふだんのカメラで下端に掛かる z）。
// 2列目は、自機が帯の手前の縁にいてカメラが引いたときだけ見える。
function buildFront(K, L) {
  const x0 = -130, x1 = L.W + 130;                   // カメラが寄れる範囲（自機は x≈5〜W-10）より少し広く
  const gaps = [];
  for (let x = x0 + 40; x < x1 - 20; x += 68) gaps.push([x - AISLE_HALF, x + AISLE_HALF]);
  seatRow(K, x0, x1, gaps, 69, 0, -1, { shell: true });
  seatRow(K, x0, x1, gaps, 83, 0, -1, { shell: true });
}

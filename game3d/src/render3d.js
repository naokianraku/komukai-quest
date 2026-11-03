// 小向クエスト — ボクセル3D描画エンジン（本編とゴールデンエイジ編で共有）
//
// ゲームロジックは一切持たない。Stage / Game をシェル側（main3d.js, main2-3d.js）が
// 作り、setStage / setGame で渡す。ここは渡されたものを毎フレーム描くだけ。
// 場面（背景）・キャラのメッシュ・武器・飛び道具・粒子・名札と吹き出し・カメラが中身。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PLAY, setPlay, playMid } from '../../game/src/config.js';
import { buildChar3DSplitForType, LEG, C3 } from '../../game/src/voxel.js';
import { TYPE_LABEL, TYPE_COLOR } from '../../game/src/sprites.js';

// 歩ける奥行きを2Dの2倍に広げる。2Dは帯76px(=25ワールドユニット≒キャラ2人分)で、
// 記号としては成立するが3Dの透視では窮屈に見えるため。216を中心に±75へ。
// あわせて奥行き許容も比例配分で広げる（18/76 ≒ 30/150）。
setPlay({ top: 141, bottom: 291, depthTol: 30 });

// ===== シェルと共有する可変の状態 =====
// stage と game は毎フレーム参照するので、関数に渡さずここに持つ。
// シェルが差し替えたら必ず setStage / setGame を呼ぶこと。
let stage = null, game = null, gaugeTarget = null, hudTop = 8;
export function setStage(s) { stage = s; }
export function setGame(g) { game = g; }
// 下のゲージに出している相手。頭上のHPバーと二重にしないため syncLabels が見る
export function setGaugeTarget(t) { gaugeTarget = t; }
// セリフを置いてよい上限（システムバーの下）。シェルの resize が測って渡す
export function setHudTop(v) { hudTop = v; }
// 打撃の手応え。シェルの fx フックと、ここの meteorBoom の両方が書く
export const FX = { hitstop: 0, shake: 0, flashT: 0, casting: 0 };

const S = 1 / 3;                               // ゲーム座標 → ワールド座標
const FLOOR_MID = playMid();
const wx = (gx) => gx * S;
const wz = (gy) => (gy - FLOOR_MID) * S;
const wy = (gz) => gz * S;

// ===== シーン =====
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('c3d') });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const Q = new URLSearchParams(location.search);
renderer.shadowMap.enabled = Q.get('noshadow') !== '1';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 3000);

// ===== ジオメトリのキャッシュ（パレットキーごとに1つ。全キャラで共有）=====
// 個体差。全員が同じ顔・同じ体型だと不自然なので、髪型・眼鏡・肌と髪の色・体格に幅を持たせる。
// エンティティIDから決めるので、同じキャラは画面にいる間ずっと同じ見た目になる。
const BUILDS = [            // 身長と横幅。bw/bd（胴の厚み）はボクセル側で効かせる
  { w: 0.96, h: 1.08 },     // 0 細身で背が高い
  { w: 1.00, h: 1.00 },     // 1 標準
  { w: 1.03, h: 1.04 },     // 2 背が高くてがっしり
  { w: 1.04, h: 0.90 },     // 3 小柄で太め
];

// 見た目のプリセット20種。[髪型, 眼鏡, 髭, 肌, 髪色, 体格]
// 1軸だけ変えるとパッと見で同じ人に見えるので、1体ごとに複数軸をまとめて変える。
const APPEARANCES = [
  [0, 0, 0, 0, 0, 1], [1, 1, 0, 1, 1, 0], [2, 0, 0, 2, 2, 2], [3, 2, 1, 3, 4, 3],
  [4, 0, 0, 0, 0, 0], [5, 1, 0, 1, 0, 2], [0, 0, 2, 4, 2, 1], [1, 2, 0, 2, 5, 3],
  [2, 1, 1, 0, 1, 1], [3, 0, 0, 3, 6, 2], [4, 1, 0, 2, 3, 1], [5, 0, 2, 1, 2, 0],
  [0, 2, 0, 3, 1, 2], [1, 0, 1, 4, 0, 1], [2, 0, 0, 1, 5, 0], [3, 1, 2, 0, 4, 1],
  [4, 2, 0, 4, 2, 2], [5, 0, 0, 3, 3, 3], [0, 1, 1, 2, 6, 3], [2, 2, 2, 4, 4, 0],
];
// ボスは小柄だと貫禄が出ないので、体格は標準以上に寄せた別表にする
const BOSS_APPEARANCES = [
  [2, 1, 0, 1, 5, 2], [3, 2, 1, 2, 6, 2], [5, 0, 2, 0, 1, 2],
  [1, 1, 0, 3, 4, 1], [0, 2, 0, 2, 6, 2], [2, 0, 1, 4, 5, 2],
];
const PLAYER_APPEARANCE = [0, 0, 0, 0, 0, 1];

// 見た目を固定するキャラ。ボスの個体差は e.id から選んでいるが、id は出現順で
// 変わるので、同じボスでも遊ぶたびに髪型・髪色・眼鏡が入れ替わってしまう
// （眼鏡が無い回もある）。看板キャラだけはここで固定する。
// skin / hairColor を null にすると、個体差で上書きせず CHAR_PALETTES の指定が残る。
const FIXED_APPEARANCE = {
  // 魔王Y下: 七三・黒縁眼鏡・髭なし。黒髪と日焼けはパレット側の指定をそのまま使う。
  maou: { hair: 2, glasses: 1, beard: 0, skin: null, hairColor: null, build: 2 },
};

function variantOf(e) {
  const fixed = FIXED_APPEARANCE[e.spriteKey];
  if (fixed) return fixed;
  const t = e === stage.player ? PLAYER_APPEARANCE
    : e.isBoss ? BOSS_APPEARANCES[e.id % BOSS_APPEARANCES.length]
    : APPEARANCES[e.id % APPEARANCES.length];
  return { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
}
const variantKey = (v) => `${v.hair}${v.glasses}${v.beard}${v.skin}${v.hairColor}${v.build}`;

const geoCache = new Map();
function toGeo(v) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(v.colors, 3));
  g.setIndex(new THREE.BufferAttribute(v.indices, 1));
  return g;
}
// 胴 / 左脚 / 右脚 の3部品。脚は自分の股関節が原点に来るよう平行移動しておく
// （親グループを回すだけで前後に振れる）。
function partsFor(key, vari) {
  const ck = key + '|' + variantKey(vari);
  if (geoCache.has(ck)) return geoCache.get(ck);
  const v = buildChar3DSplitForType(key, vari); // 3D専用の高解像度モデル（40x60x24・輪郭線なし）
  const r = { body: toGeo(v.body), legA: toGeo(v.legA), legB: toGeo(v.legB) };
  r.legA.translate(-LEG.cxA, -LEG.pivot, 0);
  r.legB.translate(-LEG.cxB, -LEG.pivot, 0);
  geoCache.set(ck, r);
  return r;
}
const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const charMatHit = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x883311 });
// 予備動作（telegraph）。2D版の「敵は予備動作のあとに攻撃してくる」を読めるようにする
const charMatTele = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x241202 });

// ===== ライト =====
// 室内/屋外で setLighting() が色と強さを切り替える（宣言はここ、値はシーン適用時）
const hemi = new THREE.HemisphereLight(0xeef5fa, 0x8a9198, 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfdfeff, 0.95);
sun.position.set(-30, 70, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 420;
scene.add(sun);
scene.add(sun.target);
// フィルライト: 太陽が上方からなので、カメラを向いた面(法線+Z)に光が当たらず
// 作業着の色が沈む。正面から弱く当てて色が読めるようにする（影は落とさない）。
const fill = new THREE.DirectionalLight(0xeaf2fa, 0.75);
scene.add(fill);
scene.add(fill.target);

// ===== ステージの箱組み =====
// three は THREE.Color / material.color を自動で sRGB→作業色空間に変換する。
// ここで自前変換すると二重変換になって極端に暗くなるので、文字列をそのまま渡す。
// （voxel.js の頂点カラーは自動変換の対象外なので、あちらは手で linear 化している）
function hex(c) { return new THREE.Color(c); }
// 背景は group にまとめる。ボス戦で場面を切り替えるときにまとめて捨てられるようにするため。
const scenery = new THREE.Group();
scene.add(scenery);
// ?dbg=1 のときだけ外から覗けるようにする。背景の箱が同一平面に重なっていないか
// （z-fighting＝点滅の原因）を、スクリプトから総当たりで確かめるため。
if (Q.get('dbg') === '1') { window.__scene = scene; window.__scenery = scenery; }

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({
      color: hex(color), emissive: opts.emissive ? hex(opts.emissive) : 0x000000,
      // 窓ガラスのような薄い面。depthWrite を切らないと、後ろの景色が消える
      transparent: opts.opacity != null, opacity: opts.opacity ?? 1,
      depthWrite: opts.opacity == null,
    }),
  );
  m.position.set(x, y, z);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  scenery.add(m);
  return m;
}

// ===== 炎 =====
// 箱を3段に積んだだけでは炎に見えない（オレンジの荷物に見える）。
// 先細りの舌を3枚重ね、毎フレーム伸び縮みさせて揺らす。さらに火の粉を昇らせ、
// 近くに揺らぐ点光源を置いて、床と人に炎の照り返しを乗せる。
const flames = [];          // {m, ph, rate, sy, sx, sway, x}
const fireLights = [];      // {l, ph, base}
const embers = [];          // {m, vy, t, life, x, y, z}
const glows = [];           // {m, ph, s} 足元の照り返し。炎と一緒に明滅させる
let fireAmb = null;         // 炎のある場面の地明かり。ゆっくり脈打たせるための基準値
// 炎の絵は手で描いて板に貼る。円錐メッシュだと縁がまっすぐな三角形のままで、
// どれだけ揺らしても「オレンジのトゲ」にしか見えない。板なら縁をなめらかに
// 消せるし、三角形のポリゴン2枚で済むので円錐より軽い。
// 加算合成なので、黒いところはそのまま背景に溶ける＝透明になる。
function flameTexture(seed) {
  const S = 96;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g2 = cv.getContext('2d');
  const img = g2.createImageData(S, S);
  const d = img.data;
  const rnd = (k) => { const v = Math.sin((seed * 37.1 + k) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  // 縁を波打たせる種。1枚ごとに舌の形を変えて、同じ絵の繰り返しに見せない
  const a1 = 0.13 + rnd(1) * 0.13, a2 = 0.07 + rnd(2) * 0.09;
  const f1 = 5 + rnd(3) * 6, f2 = 12 + rnd(4) * 11;
  const p1 = rnd(5) * 6.28, p2 = rnd(6) * 6.28;
  for (let y = 0; y < S; y++) {
    // 板のUVは下端が0。three は canvas を上下反転して貼るので、canvas の下の行が
    // 板の下＝炎の根元になる。ここを取り違えると、根元が細く先が太い光の筋になる。
    const v = y / (S - 1);                        // 0=先端(canvasの上) 1=根元(canvasの下)
    // 幅。根元がふくらみ、上へすぼまる。正弦を2本重ねて輪郭を揺らす
    const w = Math.max(0.005,
      Math.pow(v, 0.58) * 0.44 * (1 + a1 * Math.sin(v * f1 + p1) + a2 * Math.sin(v * f2 + p2)));
    for (let x = 0; x < S; x++) {
      const i2 = (y * S + x) * 4;
      const dx = Math.abs(x / (S - 1) - 0.5) / w;
      if (dx >= 1) { d[i2 + 3] = 0; continue; }
      // 縁へ向かってなめらかに消える。先はちぎれ、根元は床に溶ける
      let a = Math.pow(1 - dx * dx, 1.5) * Math.min(1, v * 3.4);
      if (v > 0.88) a *= (1 - v) / 0.12;
      // 熱さ。根元の芯がいちばん白く、外と先へ行くほど赤くなる
      const heat = Math.pow(v, 0.5) * (1 - dx * 0.72);
      let r, g, b;
      if (heat > 0.72)      { r = 255; g = 247; b = 218; }
      else if (heat > 0.46) { const t = (heat - 0.46) / 0.26; r = 255; g = 162 + 85 * t; b = 42 + 176 * t; }
      else if (heat > 0.20) { const t = (heat - 0.20) / 0.26; r = 251; g = 72 + 90 * t;  b = 10 + 32 * t; }
      else                  { const t = heat / 0.20;          r = 118 + 133 * t; g = 14 + 58 * t; b = 4 + 6 * t; }
      d[i2] = r; d[i2 + 1] = g; d[i2 + 2] = b;
      d[i2 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g2.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 炎のまわりの熱気。これが無いと炎だけが明るくて、周りが急に真っ暗になる
function hazeTexture() {
  const S = 64;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g2 = cv.getContext('2d');
  const gr = g2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0,    'rgba(255,190,120,0.85)');
  gr.addColorStop(0.35, 'rgba(255,120,40,0.34)');
  gr.addColorStop(0.7,  'rgba(190,52,12,0.10)');
  gr.addColorStop(1,    'rgba(0,0,0,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const flameTex = [flameTexture(1), flameTexture(2), flameTexture(3), flameTexture(4)];
const hazeTex = hazeTexture();
const flamePlane = new THREE.PlaneGeometry(1, 1);
flamePlane.translate(0, 0.5, 0);                  // 底を原点に（伸ばすと上だけ伸びる）
const emberGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const glowGeo = new THREE.CircleGeometry(1, 24); glowGeo.rotateX(-Math.PI / 2);

// 板は1枚だと横から見たとき紙になる。カメラは横に動くので、毎フレームこちらを向かせる。
// 回転順を YXZ にして、先のなびき(z)を板の中で効かせてから全体を回す。
function billboard(m, cam) {
  m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z);
}

// 加算合成。重なったところが白く飛んで、暗いところは背景に溶ける＝炎の見え方になる
function tongue(x, z, w, h, opacity, tilt, tex, tint) {
  const m = new THREE.Mesh(flamePlane, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity,
    color: tint ? hex(tint) : 0xffffff,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.rotation.order = 'YXZ';
  m.position.set(x, 0.4, z);
  m.scale.set(w, h, 1);
  m.rotation.z = tilt;
  m.renderOrder = 4;
  scenery.add(m);
  return m;
}

// 1か所ぶんの炎。s で大きさ、n で見た目の個体差を変える。
function fire(x, z, s, n) {
  const fr = (k) => { const v = Math.sin((n + k) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  box(3.6 * s, 0.5, 3.4 * s, '#140a06', x, 0.25, z, { receive: false });          // 焦げ跡
  box(2.2 * s, 1.1 * s, 2.0 * s, '#3a1206', x, 0.5 * s, z, { receive: false });   // 燃えている物
  // 足元の照り返し。これが無いと炎だけが宙に浮いて見える
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
    color: hex('#ff6a1e'), transparent: true, opacity: 0.44,
    depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, 0.14, z);
  glow.scale.set(7.4 * s, 1, 7.4 * s);
  scenery.add(glow);
  glows.push({ m: glow, ph: fr(4) * 6.28, s: 7.4 * s });
  // 舌を5枚。幅・高さ・濃さをばらして、根元が太く上が細い一山にする。
  const spec = [
    [0.0,  0.0, 4.6, 10.0, 0.60, null],      // 本体
    [-1.2, 0.6, 3.2,  7.0, 0.56, null],      // 左の張り出し
    [1.1, -0.5, 2.8,  5.6, 0.60, null],      // 右の張り出し
    [0.1,  0.2, 2.2,  3.6, 0.80, null],      // 芯（低く白い）
    // 噴き上がる細い舌。幅が狭いぶん芯の白が勝って白い直線に見えるので、色で落とす
    [0.4,  0.7, 1.6, 10.5, 0.30, '#d4551a'],
  ];
  spec.forEach(([dx, dz, w, h, o, tint], i) => {
    const hh = h * s * (0.72 + fr(i) * 0.66);
    const ww = w * s * (0.82 + fr(i + 7) * 0.4);
    const tilt = (fr(i + 5) - 0.5) * 0.3;
    const m = tongue(x + dx * s, z + dz * s, ww, hh, o, tilt, flameTex[(n + i) % flameTex.length], tint);
    flames.push({ m, ph: fr(i + 3) * 6.28, rate: 6.5 + fr(i + 11) * 6.5,
                  sy: hh, sx: ww, x: m.position.x, tilt, amp: 0.4, op: o });
  });
  // 熱気。炎より大きく、ゆっくり息をする。加算合成なので、全部の炎に付けると
  // 何十枚も重なって画面が白く霞む。3か所に1つだけ、薄く乗せる。
  if (n % 5 === 0) {
    const hz = new THREE.Mesh(flamePlane, new THREE.MeshBasicMaterial({
      map: hazeTex, transparent: true, opacity: 0.2,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    hz.rotation.order = 'YXZ';
    hz.position.set(x, 0.1, z + 0.5);
    hz.scale.set(8 * s, 8 * s, 1);
    hz.renderOrder = 3;
    scenery.add(hz);
    flames.push({ m: hz, ph: fr(2) * 6.28, rate: 1.7 + fr(9) * 1.4,
                  sy: 8 * s, sx: 8 * s, x: x, tilt: 0, amp: 0.1, op: 0.2 });
  }
}

// 炎の列をまとめて置き、ところどころに点光源と火の粉を添える
function fireRow(x0, x1, z, s, step, n0) {
  let n = n0;
  let rowLights = 0;      // 列ごとに1つ。全体で数えると最初の列が使い切ってしまう
  const spots = [];
  for (let x = x0; x < x1; x += step * (0.7 + ((n * 7) % 5) / 5)) {
    const fr = Math.abs(Math.sin(n * 7.13) * 10) % 1;
    n++;
    if (fr < 0.08) continue;                                   // 抜け（一列に揃えない）
    fire(x, z + (fr - 0.5) * 8, s * (0.8 + fr * 0.85), n);
    // 点光源は炎の数だけ置くと重い。列あたり2つに絞って、床と人に照りだけ乗せる。
    if (rowLights < 1 && fireLights.length < 5 && n % 5 === 0) {
      const l = new THREE.PointLight(0xff6a1e, 5.4, 270, 2);
      l.position.set(x, 10, z);
      scenery.add(l);
      fireLights.push({ l, ph: fr * 6.28, base: 5.4 });
      rowLights++;
    }
    spots.push(x);
  }
  // 火の粉は炎1つずつに持たせると数が増えすぎる。列ごとにまとめて散らす。
  for (let k = 0; k < 28 && spots.length; k++) {
    const sx2 = spots[(k * 7) % spots.length];
    const f2 = ((k * 13) % 11) / 11;
    const m = new THREE.Mesh(emberGeo, new THREE.MeshBasicMaterial({
      color: hex(k % 3 === 0 ? '#fff0b4' : k % 3 === 1 ? '#ffd24a' : '#ff8a3a'),
      transparent: true, opacity: 0.95, fog: false }));
    // 大きさをばらす。粒が揃っていると、火の粉ではなく点線に見える
    const sc = 0.7 + ((k * 17) % 9) / 9 * 1.6;
    m.scale.set(sc, sc, sc);
    m.position.set(sx2, 2, z);
    scenery.add(m);
    embers.push({ m, sc, x: sx2, z, vy: 14 + f2 * 24, t: f2 * 3 + k * 0.11, life: 2.2 + f2 * 2.0 });
  }
}

function updateFlames(dt, t, cam) {
  for (const f of flames) {
    // 速い揺れに遅いうねりを重ねる。単純な正弦だけだと規則正しく脈打って見える
    const w = Math.sin(t * f.rate + f.ph) * 0.7 + Math.sin(t * f.rate * 0.37 + f.ph * 1.7) * 0.3;
    f.m.scale.y = f.sy * (1 + w * f.amp);                      // 伸び縮み
    f.m.scale.x = f.sx * (1 - w * f.amp * 0.42);               // 伸びたぶん細る
    f.m.position.x = f.x + Math.sin(t * f.rate * 0.6 + f.ph) * 0.1 * f.sx;   // 揺らぎ
    f.m.rotation.z = f.tilt + Math.sin(t * f.rate * 0.45 + f.ph) * 0.22;     // 先がなびく
    // 濃さも揺らす。形だけ動かすと、明るさが一定で作り物に見える
    f.m.material.opacity = f.op * (0.76 + 0.24 * Math.sin(t * f.rate * 1.3 + f.ph * 2.1));
    billboard(f.m, cam);
  }
  for (const g of glows) {
    const k = g.s * (0.86 + 0.14 * Math.sin(t * 5.1 + g.ph));
    g.m.scale.x = k; g.m.scale.z = k;
    g.m.material.opacity = 0.34 + 0.16 * Math.sin(t * 6.7 + g.ph * 1.6);
  }
  for (const g of fireLights) {
    g.l.intensity = g.base * (0.62 + 0.38 * Math.abs(Math.sin(t * 7.3 + g.ph) * Math.sin(t * 3.1)));
  }
  // 部屋ぜんたいの明るさもゆっくり脈打たせる。炎だけ動いて部屋が止まっていると、
  // 書き割りの前で火が揺れているように見える。
  if (fireAmb == null) fireAmb = { h: hemi.intensity, s: sun.intensity };
  const amb = 1 + 0.1 * Math.sin(t * 2.9) * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 9.1);
  hemi.intensity = fireAmb.h * amb;
  sun.intensity = fireAmb.s * amb;
  for (const e of embers) {
    e.t += dt;
    if (e.t > e.life) { e.t = 0; e.m.position.set(e.x + (Math.random() - 0.5) * 5, 2, e.z + (Math.random() - 0.5) * 5); }
    const p = e.t / e.life;
    e.m.position.y = 2 + e.vy * e.t;
    e.m.position.x += Math.sin(t * 2.2 + e.vy) * dt * 3;       // ゆらゆら横に流れる
    e.m.material.opacity = 0.9 * (1 - p) * (p < 0.08 ? p / 0.08 : 1);
    const sc = e.sc * (1 - p * 0.6);
    e.m.scale.set(sc, sc, sc);
  }
}

function clearScenery() {
  flames.length = 0; fireLights.length = 0; embers.length = 0; doorFx.length = 0;
  glows.length = 0; fireAmb = null;
  for (const m of [...scenery.children]) {
    scenery.remove(m);
    // Group を混ぜると geometry が無くてここで落ちる。入れ子でも確実に捨てる。
    m.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}

// 室内（蛍光灯で全体に明るく影は薄い）/ 屋外（空の青＋強い日射）で照明を切り替える
function setLighting(outdoor) {
  hemi.color.set(outdoor ? 0xbcd9f2 : 0xeef5fa);
  hemi.groundColor.set(outdoor ? 0x7a7259 : 0x8a9198);
  hemi.intensity = outdoor ? 1.35 : 2.1;
  sun.color.set(outdoor ? 0xfff1d8 : 0xfdfeff);
  sun.intensity = outdoor ? 2.0 : 0.95;
  fill.intensity = outdoor ? 0.5 : 1.0;   // 顔が自分の髪の影で潰れないよう正面から補う
}

// 3D用の室内パレット。2D版の bg（暗い青灰）は2Dの記号としてそのまま残し、
// 3Dは実際の執務室の見た目（白い天井・明るいキャビネット・濃いグレーの床・
// 青いパーティション・緑のデスクマット）に寄せる。
const ROOM = {
  // 執務室（60号7階Cゾーン）: 白い天井と直管蛍光灯、明るいキャビネット、
  // 濃いグレーのタイルカーペット、青いパーティション、緑のデスクマット。
  office_win: {
    ceiling: '#f3f6f8', wall: '#e6eaed', cabinet: '#dde2e6', cabinetLine: '#b9c0c6',
    floor: '#474c52', partition: '#4a7ab0', mat: '#2f9e68', desk: '#eef1f4',
    chair: '#3a5fa8', sky: '#bcd6ea', frame: '#aeb6bd',
  },
  // 食堂: 光沢のある明るい木目の床、白い天井、白天板のテーブルにピンクのパイプ椅子、
  // ベージュの配膳カウンターとステンレス、白いブラインドの窓。※ステージ未使用（素材として用意）
  // 構内の稲荷社（ボス戦用の屋外アリーナ）: 朱の鳥居、瓦屋根の社、玉垣、木立、
  // 借景に工場の白い建屋。空が見えるので天井は作らない。
  shrine: {
    sky: '#9ec8e8', ground: '#b4a992', path: '#d6d2c6', torii: '#d9451f', toriiDark: '#241d18',
    shrineWood: '#7d5f41', roof: '#3b4648', tree: '#2f5a35', treeDark: '#23462a',
    bldg: '#e7eaec', bldgWin: '#8fa8bc', stone: '#9a978d',
  },
  // 「出向」の入り口（Stage3のフロアの奥に立つ小さな稲荷）。構内の稲荷社と同じ配色に寄せる。
  inari: {
    path: '#bdb8ab', pathLine: '#9d998f', torii: '#d9451f', toriiDark: '#241d18',
    plaque: '#e8d9ae', rope: '#d8cfa8', paper: '#f4f2ec',
    lantern: '#d8483c', lanternLit: '#5a1008',
    fox: '#e6e2d6', bib: '#c8321e', stone: '#9a978d', pole: '#6a6258',
    wood: '#7d5f41', roof: '#3b4648', roofRidge: '#2c3537', dark: '#120f0c',
    glow: '#ff8a3a',
  },
  // 正門（タイトル画面）: 白いコンクリート塀に濃緑の縦格子、引き戸の門扉と社名板の角柱、
  // 奥に連窓の事務棟と階段室。実際の入り口の写真に合わせてある。
  gate: {
    sky: '#9ec3dd', ground: '#86898c', road: '#75787c', line: '#e8eae8',
    bikeLane: '#2f5aa0',                                   // 自転車レーンの青
    wall: '#dcdcd6', wallTop: '#c6c6bf',                   // 白いコンクリート塀
    rail: '#2b3a33', railDark: '#1b2620',                  // 濃緑の縦格子フェンス
    gateLeaf: '#2a332e',                                   // 引き戸の門扉
    stripeA: '#e05a1e', stripeB: '#f0f0ec',                // オレンジ白の縞ポール
    sign: '#efede7', signPlate: '#d8d6d0', signMark: '#b03028',
    bldg: '#b7babb', bldgPanel: '#c4c7c7', bldgWin: '#4e5a63', spandrel: '#cdcfce',
    tower: '#a8acad', balcony: '#9ba0a1',
    annex: '#cfd4d6', annexWin: '#8fa8b8', bridge: '#aeb4b6',
    booth: '#e4e4de', boothRoof: '#7c8184', canopy: '#b9c2c6', canopyGlass: '#9fb4bc',
    tree: '#2c5230', treeDark: '#1f3d24', pole: '#c3c7c9', cone: '#1f4fa8',
  },
  // 構内道路: 頭上の配管ラック、灰色の柱、白い建屋。工場らしさが一番出る場所
  yard: {
    sky: '#9ec8e8', ground: '#5c5f63', path: '#6a6e73', pipe: '#b6bcc2', post: '#9aa0a6',
    bldg: '#e3e6e8', bldgWin: '#8fa8bc', line: '#e8e8e4', tree: '#2f5a35',
  },
  shokudo: {
    ceiling: '#f4f5f2', wall: '#ece7de', cabinet: '#e0c9b8', cabinetLine: '#c4a894',
    floor: '#c08a42', partition: '#e0c9b8', mat: '#f2f3f0', desk: '#f2f3f0',
    chair: '#d8b3ae', sky: '#dfe6ea', frame: '#c9ccc8', steel: '#b9bcc0',
  },
  // 内側のゾーン（技術管理部・関連会社）。窓がなく、壁一面が書類棚。
  // 窓のあるCゾーンより古くて色が沈んでいる。
  office: {
    ceiling: '#eceeec', wall: '#d9d5cc', cabinet: '#cdc8bd', cabinetLine: '#a9a496',
    floor: '#4a4f55', partition: '#6a7f94', mat: '#2f6f9e', desk: '#e4e1d9',
    chair: '#55606c', frame: '#a9a496', steel: '#b2b6ba',
    binder: ['#8f3a2e', '#2f5a8f', '#4a7a3e', '#8a7a2e', '#6a3a6a', '#3a6a6a'],
  },
  // 出向先の関連会社。同じ造りだが、もっと古くて色が沈んでいる。
  kanren: {
    ceiling: '#e2e0d6', wall: '#c6bda9', cabinet: '#b8ae99', cabinetLine: '#908771',
    floor: '#5a5244', partition: '#7a7256', mat: '#4a6a4a', desk: '#d6d0c0',
    chair: '#6a6252', frame: '#908771', steel: '#a8a89e',
    binder: ['#7a3a2a', '#2e4a72', '#44663a', '#7a6a2a', '#5a3a5a', '#36605e'],
  },
  // 会議フロア（60号5階）。白板とスクリーン、長机と積み重ね椅子。
  meeting: {
    ceiling: '#eef0ec', wall: '#b9c2b6', cabinet: '#aab4a6', cabinetLine: '#7d877a',
    floor: '#4e544e', partition: '#5f7a66', mat: '#2f6f5a', desk: '#ebeee6',
    chair: '#48604f', frame: '#4a5248', screen: '#fbfcf8', steel: '#b2b6ba',
  },
  // 本社の役員フロア。木目の腰壁・厚い絨毯・光る長机。金の額縁だけが明るい。
  boardroom: {
    ceiling: '#342f3c', wall: '#3d3442', wood: '#6a4a34', woodDark: '#483324',
    floor: '#4a3d52', cabinet: '#4a3a2c', cabinetLine: '#7a5e44', desk: '#3a2c22',
    deskTop: '#6a4e38', chair: '#241e2c', gold: '#e0b254', frame: '#a8822e',
    glass: '#2a3e52',
  },
  // 下請けの工場（GR社）。天井板を張らず鉄骨を見せる。機械と仕掛品と天井クレーン。
  // 事務所の場面と違って「床が主役」なので、区画線と仕掛品を床に多めに置く。
  factory: {
    roof: '#23272c', wall: '#3e4248', truss: '#5a6068', floor: '#5c6068',
    line: '#c8b43a', machine: '#45607a', machineTop: '#8e969e', steel: '#8e9298',
    crate: '#8a6a3e', pallet: '#6a5230', panel: '#1e2a36', rust: '#7a4a32',
    shutter: '#737a82', lamp: '#fff0cc',
  },
  // 裏ステージ。Aゾーンが燃えている。執務室と同じ骨格を炭化させて残り火を入れる。
  hellfire: {
    ceiling: '#1a1210', wall: '#2a1a14', cabinet: '#30201a', cabinetLine: '#50302080',
    floor: '#241612', partition: '#3a201a', mat: '#401c10', desk: '#2e1d16',
    chair: '#241612', frame: '#4a2a1e', ember: '#ff6a1e', emberHot: '#ffc24a',
    smoke: '#1a0e0a',
  },
};

// ===== 場面（シーン）=====
// どの場面も「歩行帯(±halfD)の外に奥ゾーンと手前ゾーンを作る」構成で統一する。
// 帯の中に物を置くとキャラと重なって奥行きが読めなくなるため。
//
// 画面に入る高さの目安（CAM: dist 188 / height 62 / lookY 13 / fov 26°）:
// カメラは天井(y=47)より上にあるので、画面の上1/3は天井スラブの上面で埋まる。
// 奥の壁で実際に見えるのは おおよそ y=0〜22 の帯で、さらに奥ゾーンの家具が
// 下から 10 くらいを隠す。壁に貼るものは y=10〜22 に置かないと見えない。

function zones(halfD, backDepth, frontDepth) {
  return { BACK: -(halfD + backDepth), FRONT: halfD + frontDepth };
}

// 天井。カメラ(y=62)は天井(y=47)より上にあるので、手前いっぱいまで張ると
// 画面の上1/3が天井スラブの上面で埋まり、壁の連窓も白板も1つも見えなくなる。
// 歩行帯の少し先で切って上を開けると、壁が y=38 あたりまで見えるようになる。
// 実物の執務室も上部が抜けている。
function ceilingSlab(W, halfD, BACK, color, y = 47) {
  const front = halfD + 12;
  box(W + 80, 2, front - BACK, color, W / 2, y, (front + BACK) / 2);
  return front;
}

// --- 執務室（60号7階Cゾーン）---
function buildOffice(W, halfD) {
  const R = ROOM.office_win;
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 320, 900);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.08, 0.4, '#6b7178', W / 2, 0.02, halfD);
  box(W + 80, 0.08, 0.4, '#6b7178', W / 2, 0.02, -halfD);

  // 壁。連窓を本物の開口にするため、腰壁・垂れ壁・方立（窓と窓の間の壁）に分けて
  // 隙間を作り、その奥に外の景色を置く。箱はくり抜けないので壁側を分割する。
  const WIN_B = 19, WIN_T = 35, PITCH = 62, WINW = 34, X0 = 18;
  box(W + 80, WIN_B, 2, R.wall, W / 2, WIN_B / 2, BACK - 1);                     // 腰壁
  box(W + 80, 64 - WIN_T, 2, R.wall, W / 2, (64 + WIN_T) / 2, BACK - 1);         // 垂れ壁
  for (let x = X0 - PITCH * 1.5; x < W + PITCH * 1.5; x += PITCH) {
    box(PITCH - WINW, WIN_T - WIN_B, 2, R.wall, x, (WIN_B + WIN_T) / 2, BACK - 1);
  }
  outsideView(W, BACK);
  const CEIL = ceilingSlab(W, halfD, BACK, R.ceiling, 47);

  // 天井まわり: 直管蛍光灯の列 ＋ 空調の吹き出し口 ＋ 配線ダクト
  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 14; dz < CEIL - 6; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#cfe0ee', receive: false });
    }
  }
  for (let x = 24; x < W; x += 88) {
    for (const dz of [BACK + 28, BACK + 62]) if (dz < CEIL - 6) box(9, 0.8, 9, '#c9ced3', x, 45.4, dz);  // 吹き出し口
  }
  box(W + 80, 1.2, 2.2, '#d9dee2', W / 2, 44.2, BACK + 8);                            // 配線ダクト

  // 吊り下げのゾーン表示（実物にある「D15」「D16」の札）
  for (let i = 0, x = 40; x < W; x += 150, i++) {
    box(0.3, 6, 0.3, '#aeb6bd', x, 41.5, BACK + 26);
    box(13, 5, 0.6, '#f4f6f8', x, 36, BACK + 26, { receive: false });
    box(9, 0.9, 0.8, '#3a5fa8', x, 36, BACK + 25.6, { receive: false });
  }

  // 連窓のサッシ。枠を少しだけ室内側に出すと、開口が「窓」に見える
  const WINC = (WIN_B + WIN_T) / 2;
  for (let x = X0; x < W + PITCH; x += PITCH) {
    box(WINW + 2, 1.5, 1.8, R.frame, x, WIN_T - 0.4, BACK - 0.5);        // 上枠
    box(WINW + 2, 1.5, 1.8, R.frame, x, WIN_B + 0.4, BACK - 0.5);        // 下枠
    box(1.2, WIN_T - WIN_B, 1.8, R.frame, x, WINC, BACK - 0.5);          // 中央の方立
    box(WINW, 1.0, 1.6, R.frame, x, WIN_B + 10.5, BACK - 0.5);           // 無目（中桟）
    box(WINW + 4, 1.1, 3.0, '#cfd5da', x, WIN_B - 0.7, BACK + 0.6);      // 窓台
    // ガラス。薄い映り込みだけ残す（不透明にすると外が見えない）
    box(WINW, WIN_T - WIN_B - 1.6, 0.2, '#e8f4fd', x, WINC, BACK - 1.6,
        { emissive: '#223a4c', receive: false, opacity: 0.11 });
  }
  // 掲示板は窓の下、キャビネットの上の帯に収める
  for (let x = 49; x < W; x += 124) {
    box(18, 6, 0.6, '#dfe3e6', x, 16, BACK + 0.6);
    for (let i = 0; i < 3; i++) box(4.4, 2.6, 0.4, ['#f2f3f0', '#eaf2d8', '#f6e3d8'][i], x - 5 + i * 5, 16, BACK + 1.0, { receive: false });
  }
  // 時計は窓の中に浮かせられないので、方立（窓と窓の間の壁）に掛ける
  for (let x = X0 + PITCH / 2; x < W; x += PITCH * 5) {
    box(5.5, 5.5, 0.7, '#f4f6f8', x, 28, BACK + 0.5);
    box(3.6, 3.6, 0.3, '#2a3038', x, 28, BACK + 1.1, { receive: false });
  }

  // 壁ぎわのキャビネット列
  for (let x = -14; x < W + 24; x += 24) {
    box(22, 13, 5, R.cabinet, x, 6.5, BACK + 3.5, { cast: true });
    for (let i = 0; i < 3; i++) box(20, 0.35, 0.4, R.cabinetLine, x, 2.4 + i * 4.2, BACK + 6.1, { receive: false });
  }

  // 島デスク（奥）。天板だけだと宙に浮いて見えるので、脚・貫・椅子まで作る
  const deskZ = -halfD - 10, DT = 8.4;
  for (let x = 6; x < W; x += 30) {
    box(24, 1.1, 12, R.desk, x, DT, deskZ, { cast: true });
    box(20, 0.25, 8, R.mat, x, DT + 0.65, deskZ, { receive: false });
    // 脚ではなく脇板＋幕板。ただし椅子のある側は足が入るので開けておく。
    // この列は椅子が手前(+z)にあるので、幕板は奥(-z)側。
    const PH = DT - 1.4;
    box(1.2, PH, 11, R.cabinet, x - 11.4, PH / 2, deskZ, { cast: true });      // 左の脇板
    box(1.2, PH, 11, R.cabinet, x + 11.4, PH / 2, deskZ, { cast: true });      // 右の脇板
    box(22.6, PH, 1.2, R.cabinet, x, PH / 2, deskZ - 5.4, { cast: true });     // 幕板
    box(23, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, deskZ, { receive: false }); // 天板下の見切り
    box(24, 7, 0.9, R.partition, x, DT + 4.1, deskZ - 6.6, { cast: true });
    box(24, 6, 0.3, '#dfeaf2', x, DT + 10.6, deskZ - 6.6, { receive: false }); // アクリル板
    box(0.5, 6, 0.5, '#aeb6bd', x - 11.6, DT + 10.6, deskZ - 6.6);
    box(0.5, 6, 0.5, '#aeb6bd', x + 11.6, DT + 10.6, deskZ - 6.6);
    box(5, 4.2, 0.7, '#20262c', x + 6, DT + 3.2, deskZ - 3, { emissive: '#14303f', cast: true });
    chair(x - 6, deskZ + 10, R.chair);
  }

  // 手前の島デスク（前景）。同じく脚と椅子をつける
  const fz = halfD + 26;
  for (let x = -6; x < W + 24; x += 30) {
    box(26, 1.1, 12, R.desk, x, DT, fz, { cast: true });
    box(21, 0.25, 8, R.mat, x, DT + 0.65, fz, { receive: false });
    // この列は椅子が奥(-z)にあるので、幕板は手前(+z)側
    const PH2 = DT - 1.4;
    box(1.2, PH2, 11, R.cabinet, x - 12.4, PH2 / 2, fz, { cast: true });
    box(1.2, PH2, 11, R.cabinet, x + 12.4, PH2 / 2, fz, { cast: true });
    box(24.6, PH2, 1.2, R.cabinet, x, PH2 / 2, fz + 5.4, { cast: true });
    box(25, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, fz, { receive: false });
    box(26, 6, 0.9, R.partition, x, DT + 3.6, fz + 6.6);
    chair(x - 7, fz - 10, R.chair);
  }
}

// 窓の外（60号7階Cゾーン）。カメラは窓より高い位置から見下ろしているので、
// 窓の下半分には手前の建屋の陸屋根が入り、上半分に遠くの棟と空が見える。
// 奥へ行くほど視線は下がるため、遠景ほど高く積まないと窓に入らない。
function outsideView(W, BACK) {
  const o = { receive: false, cast: false };
  // 奥へ行くほど視線が下がるので、窓に入る高さは「奥ほど低い帯」になる。
  // 空が窓の上半分を占めるよう、遠景の頭は y=26 あたりに抑える。
  box(W + 400, 150, 2, '#74b2e2', W / 2, 44, BACK - 30, { emissive: '#18354c', ...o });   // 空
  // 遠くの棟。幅と高さをばらして、同じ建物の繰り返しに見えないようにする
  for (let i = 0, x = -70; x < W + 110; x += 44 + (i % 3) * 19, i++) {
    const h = 15 + ((i * 7) % 5) * 2.0;
    box(36 + (i % 2) * 16, h, 6, i % 2 ? '#8495a6' : '#78899a', x, h / 2 + 2, BACK - 22,
        { emissive: '#131d27', ...o });
  }
  // 煙突。構内の工場らしさはこれで出る
  for (let x = 130; x < W; x += 430) {
    box(4.6, 24, 4.6, '#aab4bd', x, 14, BACK - 24, { emissive: '#131d27', ...o });
    box(6.0, 1.8, 6.0, '#98a3ad', x, 26.6, BACK - 24, { emissive: '#131d27', ...o });
  }
  // 手前の建屋の陸屋根。見下ろしているので、窓の下寄りに屋上が入る
  box(W + 400, 16, 12, '#6e767d', W / 2, 11, BACK - 12, { emissive: '#101619', ...o });
  box(W + 400, 1.4, 1.6, '#9ba3a9', W / 2, 19.4, BACK - 6.3, { emissive: '#101619', ...o });
  for (let i = 0, x = -30; x < W + 60; x += 74, i++) {
    const dz = BACK - 13 - (i % 2) * 3;
    box(11, 4.6, 7, '#8d959b', x, 21.3, dz, { emissive: '#101619', ...o });
    box(7, 1.2, 5, '#757d84', x, 24.0, dz, { emissive: '#101619', ...o });
  }
}

// 事務椅子: 座面・背もたれ・支柱・五本脚
function chair(x, z, color) {
  box(6.5, 0.9, 6.5, color, x, 5.4, z, { cast: true });           // 座面
  box(6.5, 7.0, 0.8, color, x, 9.2, z - 3.0, { cast: true });     // 背もたれ
  box(1.2, 4.8, 1.2, '#8f959b', x, 2.7, z);                       // 支柱
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const leg = box(4.6, 0.5, 0.9, '#8f959b', x + Math.cos(a) * 2.3, 0.45, z + Math.sin(a) * 2.3);
    leg.rotation.y = -a;
  }
}

// --- 構内の稲荷社（ボス戦の屋外アリーナ）---
function buildShrine(W, halfD) {
  const R = ROOM.shrine;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(true);
  scene.background = hex(R.sky);
  scene.fog = new THREE.Fog(hex(R.sky), 340, 980);

  box(W + 80, 2, FRONT - BACK, R.ground, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.3, halfD * 2, R.path, W / 2, 0.1, 0, { receive: true });

  // 鳥居は正面から見える向きに。参道が奥へ伸びる配置にして背景として見せる。
  const sx0 = W * 0.72;
  const torii = (cz, scale) => {
    const half = 9 * scale, hP = 26 * scale;
    for (const px of [sx0 - half, sx0 + half]) {
      box(3.2 * scale, hP, 3.2 * scale, R.torii, px, hP / 2, cz, { cast: true });
      box(4.6 * scale, 1.2, 4.6 * scale, R.toriiDark, px, 0.6, cz);
    }
    box(half * 2 + 10 * scale, 2.0 * scale, 3.6 * scale, R.toriiDark, sx0, hP + 1.4, cz, { cast: true });
    box(half * 2 + 6 * scale, 1.4 * scale, 3.0 * scale, R.torii, sx0, hP - 0.4, cz, { cast: true });
    box(half * 2 - 2 * scale, 1.2 * scale, 2.4 * scale, R.torii, sx0, hP * 0.78, cz, { cast: true });
    box(2.4 * scale, 3.2 * scale, 1.0, '#d8cfa8', sx0, hP * 0.93, cz + 1.8);
  };
  torii(-halfD - 8, 1.0);
  torii(BACK + 34, 0.82);
  box(16, 0.3, (-halfD - 8) - (BACK + 10), R.path, sx0, 0.12, ((-halfD - 8) + (BACK + 10)) / 2);

  for (const sz of [-halfD - 6, halfD + 6]) {
    for (let x = -10; x < W + 20; x += 7) {
      box(1.1, 6, 1.1, R.torii, x, 3, sz);
      box(7, 0.8, 1.0, R.torii, x, 6.2, sz);
    }
  }

  box(26, 16, 18, R.shrineWood, sx0, 8, BACK + 16, { cast: true });
  box(34, 2.4, 26, R.roof, sx0, 17.4, BACK + 16, { cast: true });
  box(28, 2.0, 20, R.roof, sx0, 19.6, BACK + 16, { cast: true });
  for (let i = 0; i < 3; i++) box(18 - i * 2, 1.2, 3, R.stone, sx0, 0.6 + i * 1.2, BACK + 26 - i * 1.5);

  for (let x = -20; x < W + 40; x += 17) {
    const h = 26 + ((x * 7) % 18);
    box(3, h * 0.45, 3, '#4a3a2a', x, h * 0.22, BACK + 2, { cast: true });
    box(14, h * 0.6, 14, (x % 34 === 0) ? R.treeDark : R.tree, x, h * 0.72, BACK + 2, { cast: true });
  }
  for (let x = -40; x < W + 60; x += 120) {
    box(110, 54, 10, R.bldg, x, 27, BACK - 26);
    for (let f = 0; f < 5; f++) box(100, 3.4, 1.0, R.bldgWin, x, 10 + f * 9, BACK - 31);
  }
}

// --- 「出向」の入り口（稲荷）---
// 2D版は壁の扉で表しているが、3Dでは奥の壁ぎわに朱の鳥居を立てた。構内に稲荷社がある
// のと同じ理屈で、フロアの奥に小さな稲荷が据わっている。くぐると関連会社へ出向になる。
// 社名は出さない。扁額の「出向」はボクセルに文字が描けないので DOM 側（#labels .plate）で出す。
const doorFx = [];   // 脈打たせる光る印（場面を張り替えるたびに作り直す）

function buildInariDoor(door) {
  const R = ROOM.inari;
  const cx = wx(door.x), dz = wz(door.y);
  // 触れる範囲。参道と光る印をこれに合わせておけば、どこへ寄れば出向になるか見て分かる
  const tolX = 16 * S, tolZ = door.tol * S;

  // 参道。触れる範囲の手前端から社の手前まで。石畳の継ぎ目は板に沈めてから出す
  // （同じ高さに並べると点滅する）
  const pF = dz + tolZ, pB = dz - 6, pC = (pF + pB) / 2, pD = pF - pB;
  box(tolX * 2 + 3, 0.5, pD, R.path, cx, 0.25, pC, { receive: true });
  for (let i = -2; i <= 2; i++) {
    box(tolX * 2 + 1.4, 0.2, 0.4, R.pathLine, cx, 0.55, pC + i * (pD / 5.5));
  }

  // 鳥居。柱→貫→額束→島木→笠木。笠木だけ濃色にして、朱との対比で形が読めるようにする
  const half = 11, hP = 27;
  for (const px of [cx - half, cx + half]) {
    box(3.0, hP, 3.0, R.torii, px, hP / 2, dz, { cast: true });
    box(4.2, 1.5, 4.2, R.toriiDark, px, 0.75, dz);                             // 根巻き
  }
  box(half * 2 + 11, 2.2, 4.2, R.toriiDark, cx, hP + 1.6, dz, { cast: true }); // 笠木
  box(half * 2 + 7, 1.5, 3.4, R.torii, cx, hP - 0.1, dz, { cast: true });      // 島木
  box(half * 2 - 1, 1.4, 2.6, R.torii, cx, hP * 0.74, dz, { cast: true });     // 貫
  box(1.2, 5.6, 1.2, R.torii, cx, 23.4, dz);                                   // 額束
  box(2.8, 3.6, 1.2, R.plaque, cx, 24.3, dz + 1.7);                            // 扁額（文字はDOM）

  // 注連縄と紙垂
  box(half * 2 - 4, 1.1, 1.1, R.rope, cx, 15.1, dz - 1.9);
  for (const dx of [-7, -2.4, 2.4, 7]) box(1.0, 2.6, 0.3, R.paper, cx + dx, 14.0, dz - 1.9);

  // 提灯。笠木から吊る
  for (const dx of [-6.6, 6.6]) {
    box(0.4, 2.4, 0.4, R.toriiDark, cx + dx, 25.9, dz - 1.2);
    box(2.6, 3.2, 2.6, R.lantern, cx + dx, 23.1, dz - 1.2, { emissive: R.lanternLit, cast: true });
  }

  // 幟。朱の布を2本立てて、離れたところからでも稲荷と分かるようにする。
  // 布だけだと赤い幕に見えるので、上下に白い縁を入れて幟らしくする
  for (const sd of [-1, 1]) {
    const px = cx + sd * 15.5, bx = px + sd * 1.8;
    box(0.9, 23, 0.9, R.pole, px, 11.5, dz + 1.5, { cast: true });
    box(2.6, 13, 0.5, R.bib, bx, 14.5, dz + 1.5, { cast: true });
    box(2.8, 1.0, 0.7, R.paper, bx, 20.6, dz + 1.5);
    box(2.8, 1.0, 0.7, R.paper, bx, 8.4, dz + 1.5);
  }

  // 狐。鳥居の手前の両脇に据える（奥に置くと社に埋まる）。参道の幅には掛けない
  const fz = dz + 4.5;
  const fox = (fcx) => {
    box(5.0, 5.0, 5.0, R.stone, fcx, 2.5, fz, { cast: true });                 // 台座
    box(3.0, 4.2, 3.4, R.fox, fcx, 7.1, fz, { cast: true });                   // 胴
    box(2.4, 2.4, 1.4, R.fox, fcx, 6.2, fz + 1.9);                             // 前脚
    box(2.6, 2.6, 2.4, R.fox, fcx, 10.5, fz + 0.7, { cast: true });            // 頭
    box(1.2, 1.0, 1.4, R.fox, fcx, 10.0, fz + 2.2);                            // 口
    for (const ex of [-0.9, 0.9]) box(0.8, 1.5, 0.8, R.fox, fcx + ex, 12.4, fz + 0.7);
    box(1.6, 3.8, 1.6, R.fox, fcx, 8.4, fz - 2.2, { cast: true });             // 尾
    box(2.9, 1.5, 0.6, R.bib, fcx, 7.6, fz + 2.8);                             // 赤い前垂れ
  };
  fox(cx - 13.5); fox(cx + 13.5);

  // 小さな社。鳥居の先に据えて、ここが出向の口であることを示す。
  // 鳥居と同じ背丈にすると鳥居が小屋の入口に見えてしまうので、半分の高さに抑える。
  // 奥の長机にぶつからない位置に留める（屋根の奥端 -28 / 長机の手前端 -30.5）。
  const sz = dz - 8;
  box(12, 1.6, 6.5, R.stone, cx, 0.8, sz, { cast: true });                     // 基壇
  box(9, 7, 5, R.wood, cx, 4.9, sz, { cast: true });                           // 社
  box(4.4, 4.8, 0.8, R.dark, cx, 4.6, sz + 2.7);                               // 暗い開口
  box(14, 1.8, 8, R.roof, cx, 9.1, sz, { cast: true });                        // 瓦屋根
  box(10, 1.4, 5.6, R.roof, cx, 10.6, sz, { cast: true });
  box(2.2, 0.8, 8.6, R.roofRidge, cx, 11.5, sz);                               // 棟

  // 出向になる場所を脈打つ光で示す（2D版の足元の点滅マーカーと同じ役目）。
  // 石畳いっぱいを薄く光らせても「石の色」にしか見えなかったので、
  // またぐ線（判定の手前端）と、鳥居の下の照り返しの2本に絞る。一度くぐった後は出さない。
  if (door.used) return;
  const band = (w, d, z, a2) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        color: hex(R.glow), transparent: true, opacity: a2,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.7, z);
    m.userData.amp = a2;
    scenery.add(m);
    doorFx.push(m);
  };
  band(tolX * 2, 2.4, dz + tolZ, 0.85);      // またぐ線
  band(half * 2 - 3, 5.0, dz, 0.45);         // 鳥居の下
}

// --- 食堂 ---
function buildShokudo(W, halfD) {
  const R = ROOM.shokudo;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 340, 980);

  // 光沢のある明るい木目の床。板目を細い線で表す
  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  for (let z = BACK + 4; z < FRONT; z += 7) {
    box(W + 80, 0.06, 0.35, '#a87533', W / 2, 0.03, z, { receive: false });
  }

  box(W + 80, 60, 2, R.wall, W / 2, 30, BACK - 1);
  const CEIL = ceilingSlab(W, halfD, BACK, R.ceiling, 45);
  for (let x = 6; x < W; x += 42) {
    for (let dz = BACK + 14; dz < CEIL - 6; dz += 28) {
      box(30, 0.5, 2.0, '#ffffff', x, 43.6, dz, { emissive: '#dfe6ea', receive: false });
    }
  }

  // 配膳カウンター（奥）: ベージュの腰壁 ＋ ステンレス天板 ＋ ガラスケース。
  // 壁ぎわまで下げて、手前にテーブルの列を通す
  const cz = -halfD - 30;
  box(W + 40, 11, 12, R.cabinet, W / 2, 5.5, cz, { cast: true });
  box(W + 40, 0.8, 13, R.steel, W / 2, 11.4, cz, { receive: false });
  box(W + 40, 7, 0.4, '#dfe9ee', W / 2, 15.4, cz - 5.6, { receive: false });   // ガラス
  for (let x = -10; x < W + 20; x += 9) box(0.5, 7, 0.5, R.steel, x, 15.4, cz - 5.6);

  // メニューの色札（実物は赤・青・緑・オレンジが並ぶ）。
  // カウンターより上、かつ画面に入る高さ（y=13〜21）に吊る
  const tag = ['#d8483c', '#3f7fc0', '#49a35c', '#e08a2e', '#d8483c'];
  for (let i = 0, x = 24; x < W; x += 34, i++) {
    box(0.3, 7, 0.3, '#c9ccc8', x, 24, cz + 6.5);
    box(11, 7, 0.5, tag[i % tag.length], x, 17, cz + 6.5, { receive: false });
    box(8, 0.6, 0.6, '#f6f7f4', x, 18.4, cz + 6.9, { receive: false });
  }

  // 壁の白いブラインド窓
  for (let x = 20; x < W; x += 58) {
    box(32, 14, 0.5, R.sky, x, 26, BACK + 0.5, { emissive: '#aebcc4' });
    for (let i = 0; i < 6; i++) box(32, 0.5, 0.8, '#f3f4f2', x, 20.5 + i * 2.2, BACK + 1.1, { receive: false });
  }

  // 白天板のテーブル＋ピンクのパイプ椅子（奥列と手前列）
  const table = (x, z) => {
    box(22, 0.9, 11, R.desk, x, 7.6, z, { cast: true });
    for (const [dx, dz] of [[-7, -4.6], [7, -4.6], [-7, 4.6], [7, 4.6]]) {
      box(0.7, 7.2, 0.7, R.steel, x + dx, 3.6, z + dz);
    }
    for (const dz of [-7.6, 7.6]) {
      for (const dx of [-5.5, 5.5]) {
        box(4.6, 0.7, 4.6, R.chair, x + dx, 4.4, z + dz, { cast: true });
        box(4.6, 5.2, 0.7, R.chair, x + dx, 7, z + dz + (dz > 0 ? 2.1 : -2.1), { cast: true });
      }
    }
  };
  for (let x = 10; x < W; x += 34) { table(x, -halfD - 13); table(x, halfD + 26); }
  // 返却口のワゴンと、床に置かれた番重（奥ゾーンの隙間を埋める）
  for (let x = 26; x < W; x += 68) {
    box(13, 7, 9, R.steel, x, 3.5, -halfD - 24, { cast: true });
    for (let i = 0; i < 3; i++) box(11, 1.1, 7, '#cfd4d8', x, 7.8 + i * 1.3, -halfD - 24, { receive: false });
  }
}

// --- 構内道路 ---
function buildYard(W, halfD) {
  const R = ROOM.yard;
  const { BACK, FRONT } = zones(halfD, 34, 60);
  setLighting(true);
  scene.background = hex(R.sky);
  scene.fog = new THREE.Fog(hex(R.sky), 320, 950);

  box(W + 80, 2, FRONT - BACK, R.ground, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.3, halfD * 2 + 6, R.path, W / 2, 0.1, 0);
  for (let x = -10; x < W + 20; x += 14) box(8, 0.1, 0.8, R.line, x, 0.3, 0);   // 車線

  // 両側の白い建屋（水平連窓）
  for (const sz of [BACK - 8, FRONT + 6]) {
    const far = sz < 0;
    // 手前側は低くする。背の高い建屋を置くと画面の下半分が無地の灰色で埋まる
    for (let x = -30; x < W + 50; x += 90) {
      box(84, far ? 52 : 19, 16, R.bldg, x, far ? 26 : 9.5, sz, { cast: true });
      for (let f = 0; f < (far ? 5 : 1); f++) {
        box(76, 3.2, 1.0, R.bldgWin, x, far ? 9 + f * 9 : 15, sz + (far ? 8.5 : -8.5), { receive: false });
      }
      if (!far) {
        box(84, 2.0, 1.2, '#9aa0a6', x, 18.4, sz - 8.2, { receive: false });      // 庇
        box(12, 11, 1.0, '#6e747a', x - 24, 5.5, sz - 8.3, { receive: false });   // シャッター
      }
    }
  }

  // 頭上の配管ラック。工場らしさが一番出る要素
  for (let x = -10; x < W + 20; x += 26) {
    box(2.6, 34, 2.6, R.post, x, 17, -halfD - 5, { cast: true });               // 柱
    box(2.6, 34, 2.6, R.post, x, 17, halfD + 5, { cast: true });
    box(2.2, 2.2, halfD * 2 + 12, R.post, x, 34.5, 0, { cast: true });          // 梁
    box(1.6, 1.6, halfD * 2 + 8, '#8e949a', x, 37, 0);                          // 上段の梁
  }
  for (const pz of [-halfD - 2, -halfD + 3, halfD - 3, halfD + 2]) {
    box(W + 80, 1.8, 1.8, R.pipe, W / 2, 32.6, pz, { cast: true });             // 長手に走る配管
  }
  box(W + 80, 1.0, 1.0, '#c7ccd1', W / 2, 36.4, 0);

  // 標識・電柱・植栽
  for (let x = 30; x < W; x += 120) {
    box(0.7, 16, 0.7, '#b9bcc0', x, 8, halfD + 11);
    box(6, 6, 0.4, '#d8483c', x, 15, halfD + 11, { receive: false });           // 進入禁止
    box(4.4, 1.2, 0.5, '#f2f3f4', x, 15, halfD + 10.7, { receive: false });
  }
  for (let x = 80; x < W; x += 120) {
    box(0.7, 15, 0.7, '#b9bcc0', x, 7.5, -halfD - 11);
    box(6, 4, 0.4, '#3f7fc0', x, 14, -halfD - 11, { receive: false });          // 一方通行
  }
  for (let x = 14; x < W; x += 46) {
    box(2.2, 13, 2.2, '#8a7a62', x, 6.5, halfD + 16, { cast: true });           // 電柱
    box(7, 5, 7, R.tree, x + 20, 3, -halfD - 9, { cast: true });                // 刈り込みの植栽
  }
}

// --- 執務室（内側のゾーン／関連会社）---
// 窓がないぶん、壁一面の書類棚で埋める。実際この手のフロアは棚で視界が切れている。
function buildOfficeInner(W, halfD, R = ROOM.office) {
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 320, 900);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 0.08, 0.4, '#5f646a', W / 2, 0.02, halfD);
  box(W + 80, 0.08, 0.4, '#5f646a', W / 2, 0.02, -halfD);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  const CEIL = ceilingSlab(W, halfD, BACK, R.ceiling, 47);

  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 14; dz < CEIL - 6; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#d5dde2', receive: false });
    }
  }
  box(W + 80, 1.2, 2.2, '#cdc8bd', W / 2, 44.2, BACK + 8);

  // 壁一面の書類棚。背表紙の色が並ぶだけで一気に事務所になる
  for (let x = -12; x < W + 24; x += 26) {
    box(24, 34, 6, R.cabinet, x, 17, BACK + 4, { cast: true });
    for (let f = 0; f < 5; f++) {
      box(23, 0.5, 0.6, R.cabinetLine, x, 2.5 + f * 6.6, BACK + 7.2, { receive: false });
      for (let i = 0; i < 9; i++) {
        const c = R.binder[Math.abs(x * 3 + f * 5 + i) % R.binder.length];
        box(1.9, 5.0, 0.7, c, x - 10 + i * 2.5, 5.6 + f * 6.6, BACK + 7.1, { receive: false });
      }
    }
  }

  // 棚の上の段ボール箱と、天井から下がるゾーン札
  for (let x = 8; x < W; x += 52) box(11, 7, 5, '#b89a72', x, 37.5, BACK + 4, { cast: true });
  for (let x = 40; x < W; x += 150) {
    box(0.3, 6, 0.3, '#a9a496', x, 41.5, BACK + 26);
    box(13, 5, 0.6, '#f0f1ee', x, 36, BACK + 26, { receive: false });
    box(9, 0.9, 0.8, R.partition, x, 36, BACK + 25.6, { receive: false });
  }

  // 島デスク。窓側フロアと違って向かい合わせの2列組
  const DT = 8.4, PH = DT - 1.4;
  const island = (x, z, chairSide) => {
    box(24, 1.1, 12, R.desk, x, DT, z, { cast: true });
    box(20, 0.25, 8, R.mat, x, DT + 0.65, z, { receive: false });
    box(1.2, PH, 11, R.cabinet, x - 11.4, PH / 2, z, { cast: true });
    box(1.2, PH, 11, R.cabinet, x + 11.4, PH / 2, z, { cast: true });
    box(22.6, PH, 1.2, R.cabinet, x, PH / 2, z - 5.4 * chairSide, { cast: true });  // 幕板は椅子と反対側
    box(23, 0.35, 11.3, R.cabinetLine, x, DT - 0.9, z, { receive: false });
    box(5, 4.2, 0.7, '#20262c', x + 6, DT + 3.2, z - 3 * chairSide, { emissive: '#14303f', cast: true });
    box(7, 5, 5, '#e6e3db', x - 7, DT + 3.0, z, { cast: true });                    // 書類の山
    chair(x - 6, z + 10 * chairSide, R.chair);
  };
  const bz = -halfD - 12;
  for (let x = 6; x < W; x += 30) {
    island(x, bz, 1);
    box(24, 7, 0.9, R.partition, x, DT + 4.1, bz - 6.6, { cast: true });
    island(x, bz - 24, -1);                       // 背中合わせのもう1列
  }
  const fz = halfD + 26;
  for (let x = -6; x < W + 24; x += 30) {
    island(x, fz, -1);
    box(26, 6, 0.9, R.partition, x, DT + 3.6, fz + 6.6);
  }
}

// --- 会議フロア（60号5階 生産管理・生産企画）---
function buildMeeting(W, halfD) {
  const R = ROOM.meeting;
  const { BACK, FRONT } = zones(halfD, 38, 70);
  setLighting(false);
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 330, 920);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  const CEIL = ceilingSlab(W, halfD, BACK, R.ceiling, 47);
  for (let x = 6; x < W; x += 44) {
    for (let dz = BACK + 16; dz < CEIL - 6; dz += 30) {
      box(32, 0.5, 2.0, '#ffffff', x, 45.6, dz, { emissive: '#dde3dc', receive: false });
    }
  }

  // 壁は白板とスクリーンの連続。審査会で詰められる場所という見た目にする。
  // 壁と白板が同系色だと溶けるので、濃い枠で縁取る。
  for (let x = 14; x < W; x += 120) {
    box(58, 18, 0.9, R.frame, x, 17, BACK + 0.5, { receive: false });                // 濃い枠
    box(55, 15, 0.5, '#fbfcfa', x, 17.5, BACK + 1.1, { receive: false });            // ホワイトボード
    box(57, 1.4, 1.6, R.frame, x, 9.2, BACK + 1.4);                                  // ペン受け
    box(10, 0.9, 1.0, '#d8483c', x - 18, 9.8, BACK + 1.9, { receive: false });        // 赤ペン
    for (let i = 0; i < 4; i++) {                                                     // 書き殴りの線
      box(14 + (i % 3) * 9, 0.7, 0.3, ['#3a4a5a', '#8f3a2e', '#2f5a8f'][i % 3],
          x - 13 + (i % 2) * 13, 22 - i * 3, BACK + 1.5, { receive: false });
    }
  }
  for (let x = 74; x < W; x += 120) {
    box(44, 20, 0.9, R.frame, x, 18, BACK + 0.5, { receive: false });
    box(40, 17, 0.5, R.screen, x, 18, BACK + 1.1, { emissive: '#aeb8b2', receive: false }); // スクリーン
    box(28, 8, 0.3, '#5a7fa8', x, 19, BACK + 1.6, { emissive: '#2e4a68', receive: false }); // 投影中の資料
    box(44, 1.6, 1.4, '#6a7268', x, 28.6, BACK + 1.2);
    box(7, 4, 9, '#2e3430', x, 41, BACK + 30, { cast: true });                        // 天吊りプロジェクタ
    box(1.0, 4, 1.0, '#8a9088', x, 44.6, BACK + 30);
  }

  // 長机の列（奥）。審査会の「ひな壇」側
  const longTable = (x, z, back) => {
    box(46, 1.0, 13, R.desk, x, 8.2, z, { cast: true });
    box(44, 0.25, 9, R.mat, x, 8.8, z, { receive: false });
    box(46, 6.6, 0.9, R.cabinet, x, 4.4, z + 6.0 * back, { cast: true });             // 前幕板
    for (const dx of [-21, 21]) box(0.9, 7.2, 11, R.cabinet, x + dx, 3.8, z, { cast: true });
    for (const dx of [-15, -5, 5, 15]) chair(x + dx, z - 9 * back, R.chair);
    for (const dx of [-16, 0, 16]) {                                                   // 書類とペットボトル
      box(6, 0.3, 4, '#f6f7f4', x + dx, 8.9, z, { receive: false });
      box(1.6, 4.0, 1.6, '#cfe0e8', x + dx + 4, 10.7, z + 2, { cast: true });
    }
  };
  for (let x = 24; x < W; x += 58) longTable(x, -halfD - 9, 1);
  for (let x = 10; x < W; x += 58) longTable(x, halfD + 26, -1);

  // 壁ぎわの積み重ね椅子とフリップチャート
  for (let x = 40; x < W; x += 140) {    // 積み重ねた椅子（壁ぎわ。白板を隠さない高さに留める）
    for (let i = 0; i < 5; i++) box(5.2, 0.6, 5.2, R.chair, x, 1.2 + i * 1.4, BACK + 13, { cast: true });
    box(5.6, 7.5, 5.6, R.chair, x, 4.2, BACK + 13);
  }
  for (let x = 100; x < W; x += 140) {
    box(0.6, 20, 0.6, '#9aa096', x - 5, 10, halfD + 12);
    box(0.6, 20, 0.6, '#9aa096', x + 5, 10, halfD + 12);
    box(13, 16, 0.4, '#fbfcfa', x, 22, halfD + 12, { receive: false });
  }
}

// --- 本社 役員フロア ---
function buildBoardroom(W, halfD) {
  const R = ROOM.boardroom;
  const { BACK, FRONT } = zones(halfD, 40, 70);
  setLighting(false);
  // 役員フロアだけは蛍光灯の白ではなく、暗く落とした間接照明にする
  hemi.color.set(0x6a6074); hemi.groundColor.set(0x322a38); hemi.intensity = 1.5;
  sun.color.set(0xffe2a8); sun.intensity = 1.05; fill.intensity = 0.8;
  scene.background = hex(R.wall);
  scene.fog = new THREE.Fog(hex(R.wall), 250, 760);

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);   // 厚い絨毯
  for (let z = BACK + 6; z < FRONT; z += 24) {
    box(W + 80, 0.06, 0.5, '#4a3d50', W / 2, 0.03, z, { receive: false });
  }
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);
  const CEIL = ceilingSlab(W, halfD, BACK, R.ceiling, 47);

  // 腰壁と縦の木目パネル（格を見せる要素）。見える帯に収める
  box(W + 80, 11, 1.6, R.wood, W / 2, 5.5, BACK + 0.4);
  box(W + 80, 1.2, 2.2, R.woodDark, W / 2, 11.6, BACK + 0.8);
  for (let x = -10; x < W + 20; x += 14) {
    box(2.0, 14, 1.0, R.woodDark, x, 19, BACK + 0.7);
  }

  // 金の額縁（歴代の事業部長）と社章。暗い部屋で唯一明るいもの
  for (let x = 30; x < W; x += 72) {
    box(13, 13, 0.9, R.frame, x, 18, BACK + 1.1, { emissive: '#4a3a10', receive: false });
    box(10, 10, 0.4, '#5a4a52', x, 18, BACK + 1.7, { receive: false });
    box(5.5, 5.5, 0.3, '#8a7a74', x, 20, BACK + 2.0, { receive: false });   // 顔のあたり
  }
  for (let x = 96; x < W; x += 216) {
    box(12, 12, 0.6, R.gold, x, 19, BACK + 1.2, { emissive: '#4a3614', receive: false });
    box(7.5, 7.5, 0.5, R.wall, x, 19, BACK + 1.6, { receive: false });
  }

  // ペンダント照明。長机の上に低く吊るす（高いと天井に隠れて見えない）
  for (let x = 20; x < W; x += 38) {
    box(0.5, 26, 0.5, R.gold, x, 33, -halfD - 8);
    box(13, 2.4, 7, R.gold, x, 19.0, -halfD - 8, { emissive: '#7a5a1e', receive: false });
    box(11, 0.8, 5.5, '#ffe6b0', x, 17.6, -halfD - 8, { emissive: '#ffdca0', receive: false });
  }

  // 磨き上げた長机と背の高い革椅子
  const boardTable = (x, z, back) => {
    box(54, 1.3, 16, R.deskTop, x, 9.0, z, { cast: true });
    box(50, 0.3, 12, '#5c4430', x, 9.7, z, { receive: false });                       // 艶のある天板
    box(50, 7.5, 10, R.desk, x, 4.8, z, { cast: true });                              // 台輪
    // 椅子は必ず歩行帯側（手前）に置く。机の向こうに置くと壁を隠してしまう
    for (const dx of [-19, -6, 7, 20]) {
      box(7.5, 1.0, 7.5, R.chair, x + dx, 6.2, z + 11 * back, { cast: true });        // 座面
      box(7.5, 13, 1.2, R.chair, x + dx, 12.7, z + 14 * back, { cast: true });        // 高い背もたれ
      box(1.4, 5.4, 1.4, '#6a6270', x + dx, 3.0, z + 11 * back);
      box(7.0, 0.6, 7.0, '#6a6270', x + dx, 0.5, z + 11 * back);
    }
    for (const dx of [-18, 0, 18]) {
      box(7, 0.3, 5, '#e8e4dc', x + dx, 9.9, z, { receive: false });                  // 資料
      box(3.2, 3.6, 3.2, R.glass, x + dx + 6, 11.4, z + 3, { emissive: '#0e1a26', cast: true });
    }
  };
  for (let x = 30; x < W; x += 66) boardTable(x, -halfD - 22, 1);
  for (let x = 10; x < W; x += 66) boardTable(x, halfD + 30, -1);
}

// --- 裏ステージ: 業火の60号7階Aゾーン ---
// 執務室と同じ骨格を炭にして、残り火と非常灯だけが光る状態にする。
function buildHellfire(W, halfD) {
  const R = ROOM.hellfire;
  const { BACK, FRONT } = zones(halfD, 36, 70);
  setLighting(false);
  hemi.color.set(0x5a2a16); hemi.groundColor.set(0x1a0c08); hemi.intensity = 1.0;
  sun.color.set(0xff8a3a); sun.intensity = 1.1; fill.intensity = 0.4;
  scene.background = hex(R.smoke);
  scene.fog = new THREE.Fog(hex(R.smoke), 180, 620);          // 煙で奥が見えない

  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  box(W + 80, 64, 2, R.wall, W / 2, 32, BACK - 1);

  // 天井は作らない。残った野縁や垂れ下がった蛍光灯を置くと、画面の上を
  // 暗い横棒が何本も横切って、炎より先にそちらが目に入ってしまう。
  // 上は抜けたまま煙で終わらせる。

  // 床の炎。歩行帯は空けて、手前と奥にだけ置く。
  // 奥ほど小さく、手前ほど大きくして、画面の下側が燃えているように見せる。
  fireRow(-6, W + 20, -halfD - 30, 1.2, 24, 907);   // 奥の壁に接しない位置まで手前に
  fireRow(-6, W + 20, -halfD - 22, 1.0, 20, 3);
  fireRow(-6, W + 20, -halfD - 7, 0.82, 19, 61);
  fireRow(-6, W + 20, halfD + 10, 1.15, 20, 127);
  fireRow(-6, W + 20, halfD + 30, 1.5, 24, 211);

  // 焼け残った壁ぎわのキャビネットと、倒れた机
  for (let x = -14; x < W + 24; x += 24) {
    const hgt = 6 + Math.abs((x * 11) % 7);
    box(22, hgt, 5, R.cabinet, x, hgt / 2, BACK + 3.5, { cast: true });
    box(21, 0.5, 0.6, R.ember, x, hgt - 0.4, BACK + 6.1, { emissive: R.ember, receive: false });
  }
  for (let x = 8; x < W; x += 34) {
    const d = box(24, 1.1, 12, R.desk, x, 3.2, -halfD - 12, { cast: true });
    d.rotation.z = Math.abs((x * 5) % 7) * 0.09 - 0.27;                // ひっくり返っている
    box(22, 7, 0.9, R.partition, x, 2.0, -halfD - 18, { cast: true }).rotation.x = 1.2;
    const f = box(24, 1.1, 12, R.desk, x + 12, 3.0, halfD + 26, { cast: true });
    f.rotation.z = 0.22;
  }

  // 壁の下半分を炎で焼けた色にする（炎だけ明るくて壁が無関係な色だと嘘に見える）
  box(W + 80, 16, 0.6, '#5a1e08', W / 2, 7, BACK + 0.2, { emissive: '#2a0c04', receive: false });
  box(W + 80, 5, 0.6, '#8a2c0c', W / 2, 2.5, BACK + 0.4, { emissive: '#4a1404', receive: false });

  // 非常灯（緑）と、壁に残った誘導標識
  for (let x = 34; x < W; x += 112) {                          // 非常灯（煙の中で唯一の緑）
    box(7, 3.4, 0.8, '#1e4a2a', x, 18, BACK + 1.0, { receive: false });
    box(5.4, 2.2, 0.4, '#3ad46a', x, 18, BACK + 1.5, { emissive: '#3ad46a', receive: false });
  }
}

// --- 正門（タイトル画面の背景）---
// 2D版のタイトル画と同じ構図を3Dで組む。全幅に黒い槍柵が走り、中央だけが開いて
// 構内道路が奥へ抜ける。柵の向こうに白い高層棟・ガラスの低層棟・連絡通路。
// プレイ用の場面ではないので、カメラに入る範囲だけを組んで軽くしてある。
function buildGate(W, halfD) {
  const R = ROOM.gate;
  // 実際の正門の写真に合わせた構成。
  //  ・境界は黒い槍柵ではなく「白いコンクリート塀 ＋ 濃緑の縦格子フェンス」
  //  ・門は引き戸（開けて脇に寄せてある）。脇に白い社名板の角柱とオレンジ白の縞ポール
  //  ・奥の事務棟は普通の窓グリッドではなく「細長い連窓の帯」。帯の間は無地のコンクリート
  //  ・門の奥に構内道路がまっすぐ伸び、連絡通路がその上を跨ぐ
  // 面どうしを同じ位置に置かないこと（z-fighting で点滅する）。窓は壁へ食い込ませ、
  // かつ手前へ突き出す。
  const cx = stage ? wx(stage.player.x) : W / 2;
  const gx = cx + 38;                                     // 門の中心（画面の右寄り）
  const L = cx - 150, Rt = cx + 150;
  const FZ = -(halfD + 22);                               // 塀の位置
  const GW = 27;                                          // 門の開口（中心からの半幅）
  const SPANS = [[L, gx - GW], [gx + GW, Rt]];
  setLighting(true);
  scene.background = hex(R.sky);
  scene.fog = new THREE.Fog(hex(R.sky), 360, 1100);

  // --- 路面 ---
  box(Rt - L + 160, 2, 420, R.ground, cx, -1, FZ + 70);
  box(GW * 2 - 5, 0.3, 430, R.road, gx, 0.1, FZ - 60);                     // 門を抜ける構内道路
  for (let z = FZ - 200; z < halfD + 24; z += 17) box(2.0, 0.1, 9, R.line, gx, 0.32, z);
  for (let x = gx - GW + 6; x < gx + GW - 4; x += 7) box(4.4, 0.1, 11, R.line, x, 0.32, halfD + 8);
  box(Rt - L + 60, 0.1, 9, R.bikeLane, cx, 0.3, halfD + 20);               // 自転車レーンの青
  box(Rt - L + 60, 0.12, 0.7, R.line, cx, 0.34, halfD + 15.6);             // 車道との区画線

  // --- 白いコンクリート塀と濃緑の縦格子 ---
  for (const [x0, x1] of SPANS) {
    const w = x1 - x0, xm = (x0 + x1) / 2;
    box(w, 13, 3.0, R.wall, xm, 6.5, FZ, { cast: true });                  // 腰までの白い塀
    box(w + 0.4, 1.0, 3.6, R.wallTop, xm, 13.2, FZ);                       // 笠木
    // 塀の上に立つ縦格子。実物は細い角パイプが等間隔に並ぶ
    for (let x = x0 + 1.5; x < x1; x += 2.6) box(0.8, 13, 0.8, R.rail, x, 20, FZ, { cast: true });
    box(w, 0.9, 1.0, R.railDark, xm, 26.2, FZ);                            // 上レール
    box(w, 0.7, 1.0, R.railDark, xm, 14.4, FZ);                            // 下レール
  }

  // --- 塀の内側の樹木。写真では丸く刈られた常緑樹が塀より高く並ぶ ---
  for (const [x0, x1] of SPANS) {
    for (let x = x0 + 6; x < x1; x += 13) {
      const h = 20 + Math.abs(Math.sin(x * 0.7)) * 14;
      box(9, h * 0.5, 9, R.treeDark, x, h * 0.28, FZ - 11, { cast: true });        // 下枝
      box(13, h * 0.42, 13, R.tree, x, h * 0.62, FZ - 11, { cast: true });         // 中段
      box(9.5, h * 0.26, 9.5, R.tree, x, h * 0.9, FZ - 11, { cast: true });        // 天端を丸める
    }
  }

  // --- 門まわり ---
  // 引き戸の門扉。開けて右へ寄せてある（戸袋の内側に重なっている体）
  for (let x = gx + GW + 6; x < gx + GW + 28; x += 2.4) {
    box(0.9, 24, 0.9, R.gateLeaf, x, 12, FZ + 2.6, { cast: true });
  }
  box(22, 1.1, 1.2, R.gateLeaf, gx + GW + 17, 23.8, FZ + 2.6);
  box(22, 0.9, 1.2, R.gateLeaf, gx + GW + 17, 1.2, FZ + 2.6);
  // 社名板の角柱（白い角柱に、赤い印の入った板）
  const sx2 = gx - GW - 4.5;
  box(6.5, 30, 5.5, R.sign, sx2, 15, FZ + 1.0, { cast: true });
  box(7.1, 1.2, 6.1, R.wallTop, sx2, 30.2, FZ + 1.0);
  box(5.2, 6.0, 0.9, R.signPlate, sx2, 21, FZ + 4.2, { receive: false });
  box(3.6, 0.9, 0.5, R.signMark, sx2 - 0.4, 22.8, FZ + 4.8, { receive: false });
  box(4.4, 0.6, 0.5, '#6a6a66', sx2, 20.0, FZ + 4.8, { receive: false });
  // オレンジ白の縞ポール。実物は門の角に必ず立っている目印
  for (let i = 0; i < 11; i++) {
    box(1.6, 3.2, 1.6, i % 2 ? R.stripeB : R.stripeA, gx + GW + 2.5, 1.8 + i * 3.2, FZ + 12, { cast: true });
  }
  box(5.2, 1.2, 1.2, R.stripeA, gx + GW + 5, 36.5, FZ + 12, { receive: false });   // 上の小さな旗板
  // 青いコーン（門の手前に2つ）
  for (const dx of [-14, -4, 8]) {
    box(3.0, 0.8, 3.0, R.cone, gx + dx, 0.4, FZ + 13, { receive: false });
    box(1.9, 4.0, 1.9, R.cone, gx + dx, 2.4, FZ + 13, { cast: true });
    box(2.1, 0.8, 2.1, R.stripeB, gx + dx, 3.4, FZ + 13, { receive: false });
  }

  // --- 守衛所と、自転車置場の長い庇（写真の左手に写っているガラス張りの建屋）---
  const bx = gx + GW + 30;
  box(17, 15, 13, R.booth, bx, 7.5, FZ + 14, { cast: true });
  box(20, 1.4, 16, R.boothRoof, bx, 15.7, FZ + 14, { cast: true });
  box(12, 6.5, 1.4, R.canopyGlass, bx, 9.5, FZ + 21.2, { receive: false });
  const kx = gx - GW - 46;
  box(62, 11, 14, R.canopy, kx, 5.5, FZ - 6, { cast: true });              // 自転車置場
  box(66, 1.2, 17, R.boothRoof, kx, 11.6, FZ - 6, { cast: true });
  for (let x = kx - 28; x < kx + 30; x += 7) box(4.6, 7.0, 1.4, R.canopyGlass, x, 5.5, FZ + 1.6, { receive: false });

  // --- 奥の事務棟。細長い連窓が帯になって並ぶのが実物の特徴 ---
  const BZ = FZ - 86;
  const MF = BZ + 14;                                                      // 正面の位置
  box(126, 74, 28, R.bldg, cx - 66, 37, BZ, { cast: true });               // 本体
  box(128, 2.6, 30, R.bldgPanel, cx - 66, 75.4, BZ);                       // パラペット
  for (let f = 0; f < 9; f++) {
    const y = 10 + f * 7.2;
    box(112, 2.6, 2.2, R.bldgWin, cx - 70, y, MF + 0.6, { receive: false });        // 連窓の帯
    box(114, 0.8, 2.6, R.spandrel, cx - 70, y + 2.0, MF + 0.7, { receive: false }); // 帯の上の白い見切り
    for (let x = cx - 126; x < cx - 14; x += 14)                                     // 方立（まだら感）
      box(0.9, 2.8, 2.8, R.bldgPanel, x, y, MF + 0.8, { receive: false });
  }
  // 右端の階段室。窓が少なく、バルコニーが段々に付く
  box(26, 76, 34, R.tower, cx - 1, 38, BZ, { cast: true });               // 本体より手前へ出す
  for (let f = 0; f < 7; f++) box(16, 1.2, 3.0, R.balcony, cx + 4, 16 + f * 8.4, BZ + 18.2, { receive: false });
  for (let f = 0; f < 7; f++) box(9, 3.0, 2.2, R.bldgWin, cx - 8, 14 + f * 8.4, BZ + 18.0, { receive: false });

  // --- 門の奥: 構内道路の両脇の建屋と、道路を跨ぐ連絡通路 ---
  box(54, 34, 40, R.annex, gx + 62, 17, BZ + 30, { cast: true });
  for (let f = 0; f < 4; f++) box(50, 2.6, 2.0, R.annexWin, gx + 62, 8 + f * 8, BZ + 50.6, { receive: false });
  box(40, 30, 40, R.annex, gx - 56, 15, BZ + 30, { cast: true });
  box(GW * 2 + 26, 9, 12, R.bridge, gx, 34, BZ + 43, { cast: true });      // 連絡通路
  for (let x = gx - GW - 4; x < gx + GW + 6; x += 6.5) box(2.4, 4.4, 1.6, R.bldgWin, x, 35, BZ + 49.4, { receive: false });
  box(3.4, 34, 3.4, R.tower, gx - GW - 10, 17, BZ + 43, { cast: true });   // 通路の柱
  box(3.4, 34, 3.4, R.tower, gx + GW + 10, 17, BZ + 43, { cast: true });

  // --- 街路の設え: 押ボタン式の歩行者信号、照明柱、電柱 ---
  const px2 = gx - GW - 54;                               // 門の正面を塞がないよう左へ
  box(1.6, 34, 1.6, R.pole, px2, 17, halfD + 14, { cast: true });
  box(5.0, 7.0, 2.4, '#2a2e31', px2 + 2.6, 30, halfD + 14, { receive: false });     // 信号機
  box(3.2, 3.2, 0.6, '#2fb24a', px2 + 2.6, 30, halfD + 12.9, { emissive: '#2fb24a', receive: false });
  box(3.6, 5.2, 0.5, '#f2f4f6', px2 - 1.2, 29, halfD + 13.0, { receive: false });   // 「押ボタン式」の板
  for (const x of [cx - 60, cx + 96]) {                                             // 照明柱
    box(1.2, 40, 1.2, R.pole, x, 20, halfD + 18, { cast: true });
    box(5.0, 1.2, 2.4, '#5a6064', x + 2, 40.2, halfD + 18, { receive: false });
  }
  box(2.0, 46, 2.0, '#8a7f72', cx - 96, 23, halfD + 20, { cast: true });            // 電柱
  box(9, 0.6, 0.6, '#6a6a66', cx - 96, 44, halfD + 20, { receive: false });
}

// 下請けの工場。天井が高く、鉄骨と天井クレーンが剥き出し。
// 事務所の場面と見分けがつくよう、水平の梁と黄色い区画線で「横に長い」印象を作る。
function buildFactory(W, halfD) {
  const R = ROOM.factory;
  const { BACK, FRONT } = zones(halfD, 46, 74);
  setLighting(false);
  scene.background = hex(R.roof);
  scene.fog = new THREE.Fog(hex(R.roof), 300, 900);

  // 土間と区画線。歩ける帯の外側を黄色で縁取る＝工場の通路の引き方
  box(W + 80, 2, FRONT - BACK, R.floor, W / 2, -1, (FRONT + BACK) / 2);
  for (const z of [-halfD - 3, halfD + 3]) {
    box(W + 80, 0.3, 1.1, R.line, W / 2, 0.16, z, { receive: false });
  }
  for (let x = 4; x < W; x += 26) {                       // 破線の中央線
    box(9, 0.3, 0.7, R.line, x, 0.16, 0, { receive: false });
  }

  // 奥の壁は波板。縦のリブを入れないと、ただの灰色の板に見える
  box(W + 80, 70, 2, R.wall, W / 2, 35, BACK - 1);
  for (let x = -20; x < W + 40; x += 7) {
    box(1.6, 60, 0.8, R.steel, x, 30, BACK + 0.6, { receive: false });
  }
  // シャッター（搬入口）。閉まっているが、ここから物が出入りする場所だと分かるように
  for (let x = 70; x < W; x += 260) {
    box(60, 34, 1.0, R.shutter, x, 17, BACK + 1.2, { receive: false });
    for (let i = 0; i < 11; i++) box(60, 0.5, 1.4, '#5e656d', x, 2 + i * 3, BACK + 1.5, { receive: false });
    box(64, 2.4, 2.0, R.rust, x, 35.4, BACK + 1.4);
    box(3, 0.6, 1.0, R.line, x - 34, 0.18, BACK + 10, { receive: false });
  }

  // 鉄骨の小屋組。柱・梁・斜材。天井板は張らず、上は暗いまま抜けさせる
  for (let x = -10; x < W + 30; x += 52) {
    box(2.8, 56, 2.8, R.truss, x, 28, BACK + 9, { cast: true });
    box(2.8, 56, 2.8, R.truss, x, 28, FRONT - 14, { cast: true });
    box(2.4, 2.4, FRONT - BACK - 20, R.truss, x, 55, (FRONT + BACK) / 2, { cast: true });
    box(2.0, 1.6, 2.0, R.truss, x, 50, BACK + 9);
  }
  box(W + 80, 2.2, 2.2, R.truss, W / 2, 57, BACK + 12);        // 桁（横に通す）
  box(W + 80, 2.2, 2.2, R.truss, W / 2, 57, FRONT - 18);

  // 天井クレーン。レール2本とガーダー1本。工場だと一目で分かる要素
  for (const z of [BACK + 16, FRONT - 22]) box(W + 80, 1.6, 3.0, R.steel, W / 2, 46, z);
  {
    const cx = W * 0.42;
    box(5.0, 4.0, FRONT - BACK - 36, R.steel, cx, 49, (FRONT + BACK) / 2, { cast: true });
    box(7, 6, 7, '#c8a53a', cx, 43, -halfD - 10, { cast: true });        // 巻上機
    box(0.7, 16, 0.7, '#3a3e44', cx, 34, -halfD - 10);                   // ワイヤ
    box(6, 2.4, 3.0, R.rust, cx, 25, -halfD - 10, { cast: true });       // 吊り具
  }

  // 高天井灯。工場の明かりは点で落ちる
  for (let x = 16; x < W; x += 60) {
    box(1.0, 5, 1.0, '#4a5058', x, 41, -halfD - 2);
    box(9, 2.0, 9, '#4a5058', x, 38, -halfD - 2, { cast: true });
    box(7, 0.6, 7, R.lamp, x, 36.8, -halfD - 2, { emissive: R.lamp, receive: false });
  }

  // 工作機械の列（奥）。箱＋操作盤＋積層表示灯
  const machine = (x, z) => {
    box(26, 16, 15, R.machine, x, 8, z, { cast: true });
    box(27, 1.6, 16, R.machineTop, x, 16.6, z, { cast: true });
    box(14, 10, 0.8, R.panel, x + 6, 11, z + 7.8, { emissive: '#16303e', receive: false });
    box(9, 5, 0.4, '#5fb8d8', x + 6, 13, z + 8.3, { emissive: '#2a6a84', receive: false });
    box(1.6, 3.0, 1.6, '#2fa054', x - 9, 20, z, { emissive: '#1d6a36', receive: false });
    box(1.6, 3.0, 1.6, '#d8b23a', x - 9, 23, z, { receive: false });
    box(1.6, 3.0, 1.6, '#c2352f', x - 9, 26, z, { receive: false });
    box(2.0, 9, 2.0, R.steel, x - 9, 12, z);
    box(1.2, 14, 1.2, R.hose || '#2e3238', x + 13, 8, z - 6);
  };
  for (let x = 24; x < W; x += 70) machine(x, BACK + 26);

  // 仕掛品。高く積むものは必ず奥に置く。手前に積むとカメラとキャラの間に入って、
  // 戦っている相手が見えなくなる（会議フロアの長机が低いのと同じ理由）。
  for (let x = 40; x < W; x += 54) {
    const k = Math.abs(Math.sin(x * 1.7));
    box(16, 1.6, 12, R.pallet, x, 0.8, BACK + 46, { cast: true });
    for (let i = 0; i < 2 + (k > 0.5 ? 1 : 0); i++) {
      box(14 - i * 1.5, 7, 10 - i * 1.2, R.crate, x, 5.1 + i * 7.4, BACK + 46, { cast: true });
    }
    box(5.6, 9, 5.6, R.rust, x + 24, 4.5, BACK + 44, { cast: true });      // ドラム缶
    box(5.8, 0.8, 5.8, '#4a4e54', x + 24, 9.2, BACK + 44);
  }
  // 手前は低いものだけ。鋼材の束とパレット1枚ぶん
  for (let x = 14; x < W; x += 58) {
    for (let i = 0; i < 3; i++) box(30, 2.2, 2.2, R.steel, x, 1.3 + i * 2.4, halfD + 30, { cast: true });
  }
  for (let x = 44; x < W; x += 58) {
    box(16, 1.6, 12, R.pallet, x, 0.8, halfD + 32, { cast: true });
    box(14, 6, 10, R.crate, x, 4.6, halfD + 32, { cast: true });
  }

  // 安全柵（手前）。縞のポストで区画を切る
  for (let x = 6; x < W + 20; x += 18) {
    box(1.4, 11, 1.4, R.line, x, 5.5, FRONT - 10);
    box(1.5, 2.4, 1.5, '#2a2e34', x, 8.4, FRONT - 10, { receive: false });
    box(1.5, 2.4, 1.5, '#2a2e34', x, 3.6, FRONT - 10, { receive: false });
    if (x + 18 < W + 20) box(18, 0.9, 0.9, R.steel, x + 9, 9.6, FRONT - 10);
  }
}

const SCENES = {
  gate: buildGate, factory: buildFactory,
  office_win: buildOffice, office: buildOfficeInner, meeting: buildMeeting,
  kanren: (W, halfD) => buildOfficeInner(W, halfD, ROOM.kanren),
  boardroom: buildBoardroom, hellfire: buildHellfire,
  shrine: buildShrine, shokudo: buildShokudo, yard: buildYard,
};

function applyScene(key, data) {
  clearScenery();
  const W = data.width * S;
  const halfD = (PLAY.bottom - PLAY.top) * S / 2 + 3;
  (SCENES[key] || buildOffice)(W, halfD);
  // 「出向」の入り口は場面の一部ではなくステージの仕掛け。場面を張り替えても消えないよう、
  // どの場面のあとにも足す（ボス戦で稲荷社に変わったあとも、来た道に残っていてよい）。
  if (stage && stage.door) buildInariDoor(stage.door);
}

// ステージ内で場面が変わる区間。data.scenes3d は 3D専用のキーで、
// 「このx以降はこの場面」という切り替え点だけを並べる（手前は bg.scene）。
// 2D版はこのキーを見ないので、2Dの背景は変わらない。
function sceneAt(data, x) {
  let cur = { scene: data.bg.scene, label: null };
  for (const seg of data.scenes3d || []) if (x >= seg.x) cur = seg;
  return cur;
}

let curScene = null;

// タイトルの背景は正門。ステージの場面とは別に張り替える。
// タイトルへ戻るときは必ずここを通す（戻り先が執務室のままだと開始画面が暗いだけになる）。
export function buildTitleScenery(width) {
  clearScenery();
  const halfD = (PLAY.bottom - PLAY.top) * S / 2 + 3;
  buildGate(width * S, halfD);
  curScene = 'gate';
}

// 場面の読み書き。章の途中で背景が変わるステージは、シェルがここを突いて張り替える。
export function getScene() { return curScene; }
export function setScene(key, data) { curScene = key; applyScene(key, data); }

function buildScenery(data) {
  const forced = new URLSearchParams(location.search).get('scene');
  curScene = forced || sceneAt(data, stage ? stage.player.x : 0).scene;
  applyScene(curScene, data);
}
// ===== ステージの読み込み =====
function clearStageObjects() {
  for (const [, r] of meshes) { scene.remove(r.root); if (r.ring) scene.remove(r.ring); }
  meshes.clear();
  for (const [, r] of projMeshes) { scene.remove(r.group); if (r.mark) scene.remove(r.mark.g); }
  projMeshes.clear();
  for (const [, r] of weapons) { scene.remove(r.group); scene.remove(r.flash); }
  weapons.clear();
  for (const p of parts) { p.m.visible = false; partPool.push(p.m); }
  parts.length = 0;
  for (const d of domes) { scene.remove(d.m); d.m.material.dispose(); }
  domes.length = 0;
  for (const [, r] of tagEls) { r.tag.remove(); r.bubble.remove(); r.hp.remove(); }
  tagEls.clear();
  for (const f of floats) f.el.remove();
  floats.length = 0;
}

// 本編・出向・裏ステージで共通のロード処理。fx のフックを張り直すのを忘れると
// 打撃の手応えと数字が出なくなるので、必ずここを通す。
// ===== エンティティ ↔ メッシュ =====
// 1体を「胴 + 左脚 + 右脚」の3メッシュで組む。1枚のメッシュを平行移動するだけだと、
// 脚が止まったまま床の上を流れていく（歩かずに滑って見える）。
// 体格の拡縮は root ではなく末端のメッシュに掛ける。root に非等倍スケールを置くと、
// その下で回した脚がせん断して潰れる。
const WALK = {
  swing: 0.66,   // 振り幅(rad)。脚を前後に開く角度
  // 踏み出す側の足を持ち上げる量（ボクセル）。これが無いと両足が接地したまま
  // 開閉するだけになり、歩いているというより床を滑っているように見える。
  // 脚は1本の棒なので、膝を曲げる代わりに脚ごと腰へ引き込んで足を浮かせる。
  lift: 2.4,
  drop: 0.8,     // 脚を開いたとき腰を沈める量（1.0で足裏がぴったり床に残る）
  twist: 0.13,   // 胴のひねり。腕は胴と一体なので、これで腕が振れて見える
  air: 0.40,     // 跳躍中の開き
};
const meshes = new Map();   // entity.id → リグ
// ?walk=<rad> … 歩行ポーズを固定する（脚の付き方・継ぎ目の確認用。開発用）
const WALK_FIX = Q.get('walk') != null ? parseFloat(Q.get('walk')) : null;

// 足元に敷く陣営リング。乱戦でも敵味方が一目で分かるようにする。
// キャラ本体ではなく床に置くので、跳んでいる間は体だけが離れて影の位置も分かる。
const RING_COL = { player: '#ff7f0e', ally: '#2ad48a', enemy: '#c2352f' };
const ringGeo = new THREE.RingGeometry(0.72, 1.0, 28);
ringGeo.rotateX(-Math.PI / 2);
function makeRing(e) {
  const col = e === stage.player ? RING_COL.player : RING_COL[e.team];
  if (!col) return null;                       // mob（通行人）には付けない
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: new THREE.Color(col), transparent: true, opacity: 0.72,
    depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
  m.renderOrder = 1;                           // 床の影より上に描く
  scene.add(m);
  return m;
}

function makeRig(e) {
  e._v = e._v || variantOf(e);   // _v が先に入っていればそれを使う（?looks=1 の確認用）
  const g = partsFor(e.spriteKey, e._v);
  const root = new THREE.Group();
  const body = new THREE.Mesh(g.body, charMat);
  const legA = new THREE.Mesh(g.legA, charMat);
  const legB = new THREE.Mesh(g.legB, charMat);
  const hipA = new THREE.Group(), hipB = new THREE.Group();
  hipA.add(legA); hipB.add(legB);
  root.add(body); root.add(hipA); root.add(hipB);
  if (e.satchel) body.add(makeSatchel());   // 小学生のランドセル（K目息子）
  for (const m of [body, legA, legB]) { m.castShadow = true; m.receiveShadow = false; }
  scene.add(root);
  // 位相は個体ごとにずらす。全員が同じ足から踏み出すと行進に見える
  const r = { root, body, legA, legB, hipA, hipB, ring: makeRing(e),
              ph: (e.id % 7) * 0.9, amp: 0, air: 0, px: e.x, py: e.y };
  meshes.set(e.id, r);
  return r;
}

function syncEntities(dt) {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive) continue;
    seen.add(e.id);
    const r = meshes.get(e.id) || makeRig(e);
    // C3.SCALE で 2D版と同じ見た目サイズに戻す（グリッドが細かいぶん1ボクセルが小さい）
    const sc = ((e.scale || 3) / 3) * C3.SCALE;
    const bd = BUILDS[(e._v && e._v.build) ?? 1];
    // 体格の差。bodyW/bodyH は def 側の指定（魔王Y下を太らせるなど）
    const sx = sc * bd.w * (e.bodyW || 1), sy = sc * bd.h * (e.bodyH || 1);
    const dir = e.facing >= 0 ? 1 : -1;

    // --- 歩行の位相 ---
    // 時間ではなく「実際に動いた距離」で進める。こうすると止まれば脚も止まり、
    // 殴られて流されている間に歩き出すこともない。
    // 1歩の歩幅は振り幅と脚長から出す。固定値にすると体格ごとに足裏が滑る。
    const stride = 2 * LEG.pivot * sy * Math.sin(WALK.swing);
    const moved = Math.hypot(e.x - r.px, e.y - r.py);
    r.px = e.x; r.py = e.y;
    const walking = moved > 0.01 && e.z === 0 && e.hitstun <= 0 && !e.attackActive;
    // ステージ読み込みの瞬間移動で位相が飛ばないよう、1フレームの歩進を抑える
    if (walking) r.ph += (Math.min(moved, 12) * S / stride) * Math.PI;
    r.amp += ((walking ? 1 : 0) - r.amp) * Math.min(1, dt * 11);   // 止まると脚を揃える
    r.air += ((e.z > 0 ? 1 : 0) - r.air) * Math.min(1, dt * 14);
    const sw = WALK_FIX != null ? WALK_FIX
      : r.amp * WALK.swing * Math.sin(r.ph) * (1 - r.air) + WALK.air * r.air;

    // 足の持ち上げ。前へ出ていく側（角度が増えている側）だけ浮かせる。
    // 脚が揃うところで最大、開ききったところで0になるので、
    // 「浮いた足が立っている足を追い越す」という歩行のかたちになる。
    const c = Math.cos(r.ph) * r.amp * (1 - r.air) * (WALK_FIX != null ? 0 : 1);
    const liftA = Math.max(0, c) * WALK.lift * sy;
    const liftB = Math.max(0, -c) * WALK.lift * sy;

    // 脚を開いたぶん腰を沈める。沈めないと歩くたび足が床に潜る。
    // 1.0まで沈めると足が床に貼りついて重く見えるので、少しだけ浮かせる。
    const drop = LEG.pivot * (1 - Math.cos(sw)) * sy * WALK.drop;
    // 攻撃中は前に踏み込む。棒立ちで当たり判定だけ出るのを避ける（手応えの演出）
    const lunge = e.attackActive ? 3.2 * sc : (e.state === 'attack' ? 1.4 * sc : 0);
    r.root.position.set(wx(e.x) + lunge * dir, wy(e.z) - drop, wz(e.y));
    if (r.ring) {
      // 自分のリングだけ少し大きく・濃くして、人混みでも自機を見失わない
      const rr = (e === stage.player ? 7.6 : 6.4) * ((e.scale || 3) / 3);
      r.ring.scale.set(rr, 1, rr);
      r.ring.position.set(wx(e.x), 0.12, wz(e.y));
      r.ring.material.opacity = (e === stage.player ? 0.9 : 0.62) * (e.hitstun > 0 ? 0.4 : 1);
    }

    r.hipA.position.set(LEG.cxA * sx, LEG.pivot * sy, 0);
    r.hipB.position.set(LEG.cxB * sx, LEG.pivot * sy, 0);
    r.hipA.rotation.z = sw;
    r.hipB.rotation.z = -sw;
    // 脚を自分の軸方向へ引き込んで足を浮かせる（膝の代わり）。
    // 引き込んだぶん脚の上端は腰のブロックに潜るので、外からは見えない。
    r.legA.position.y = liftA;
    r.legB.position.y = liftB;

    // 進行方向へ向ける。真横(90°)まで回すと薄い板に見えるので浅めに留め、顔はカメラ側に残す。
    // 符号に注意: Y軸回転 θ で正面(+Z)は x=sin(θ) へ向く。右(+X)を向かせるには θ>0。
    // 脚には ひねり を足さない（振りの軸をワールドのx方向＝進行方向に合わせるため）。
    const face = dir * 0.55;
    // 奥の手のK田は体ごと回る。腕（得物）だけ回しても「ぐるぐる回っている」とは見えない。
    r.body.rotation.y = (e.attack && e.attack.spin)
      ? performance.now() / 1000 * 11
      : face + r.amp * WALK.twist * Math.sin(r.ph);
    r.legA.rotation.y = r.legB.rotation.y = face;
    // 予備動作でのけぞり、攻撃で前に倒す。動きを読めるようにする。
    // 倒れかけ（捨てセリフ中）は、膝から崩れるように前のめりへ倒していく。
    const fall = e.dying ? Math.min(1, 1 - (e.downT / (e.downMax || e.downDur || 2.8))) : 0;
    r.body.rotation.x = e.dying ? 0.16 + fall * 0.9
      : e.state === 'cast' ? -0.34
      : e.state === 'telegraph' ? -0.12 : (e.attackActive ? 0.16 : 0);
    // 崩れ方: 前半は言わせたいので形を保ち、後半で一気に縮んで消える。
    // 横にも潰すので、瓦礫になって落ちていくように見える。
    const crumble = Math.max(0, (fall - 0.45) / 0.55);
    const sink = e.dying ? (1 - fall * 0.42) * (1 - crumble * 0.9) : 1;
    const squash = e.dying ? 1 - crumble * 0.75 : 1;
    r.body.scale.set(sx * squash, sy * sink, sx * squash);
    r.legA.scale.set(sx * squash, sy * sink, sx * squash);
    r.legB.scale.set(sx * squash, sy * sink, sx * squash);
    // ガラガラと瓦礫を落としながら崩れる。崩れが進むほど頻度を上げる。
    if (e.dying) {
      const now = performance.now();
      if (!e._crumbleT || now - e._crumbleT > 90 + (1 - fall) * 240) {
        e._crumbleT = now;
        burst(e.x + (Math.random() - 0.5) * 14 * sc, e.y + (Math.random() - 0.5) * 10, '#8d7f6d');
        FX.shake = Math.max(FX.shake, 0.45 + crumble * 0.8);
      }
    }

    // 倒れかけは点滅させない（捨てセリフを読ませたいので）
    r.root.visible = e.dying || !(e.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0);
    const mt = e.hitstun > 0 ? charMatHit : (e.state === 'telegraph' ? charMatTele : charMat);
    r.body.material = mt; r.legA.material = mt; r.legB.material = mt;
  }
  for (const [id, r] of meshes) {
    if (seen.has(id)) continue;
    scene.remove(r.root);
    if (r.ring) { scene.remove(r.ring); r.ring.material.dispose(); }
    meshes.delete(id);
  }
}

// ===== 攻撃の見た目 =====
// プレイヤーは拳（2D版の drawFist と同じ）。敵は職種ごとの道具で殴る。
// インパクトの閃光。2D版は星形のバーストを描いていたので、3Dでも尖らせる。
// 球にすると「大きな玉」に見えて拳と紛らわしかった。
const flashSpikeGeo = new THREE.BoxGeometry(9.0, 1.3, 1.3);
const flashCoreGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
const flashMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#ffd98a'), transparent: true, opacity: 0.62,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
function makeFlash() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(flashSpikeGeo, flashMat);
    m.rotation.z = (i / 4) * Math.PI;      // 45度ずつ交差させて星形にする
    g.add(m);
  }
  g.add(new THREE.Mesh(flashCoreGeo, flashMat));
  return g;
}

const mat = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(c), ...opts });
// 各武器は「主パーツ＋補助パーツ」の最大2つで形を作る
const WEAPON_SPEC = {
  fist:   { a: [new THREE.BoxGeometry(2.8, 2.8, 2.8), mat('#f1c79b'), [0, 0, 0]] },
  roll:   { a: [new THREE.CylinderGeometry(1.7, 1.7, 12, 8), mat('#eceee8'), [0, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(1.8, 1.8, 1.2, 8), mat('#c8ccc4'), [-4, 0, 0], [0, 0, Math.PI / 2]] },
  wrench: { a: [new THREE.BoxGeometry(13, 2.0, 2.0), mat('#b9bec4'), [0, 0, 0]],
            b: [new THREE.BoxGeometry(4.5, 5.0, 2.2), mat('#9aa0a6'), [6, 0, 0]] },
  binder: { a: [new THREE.BoxGeometry(2.0, 11, 9), mat('#2e4a7a'), [0, 0, 0]],
            b: [new THREE.BoxGeometry(0.9, 10, 8), mat('#f2f4f6'), [1.2, 0, 0]] },
  stamp:  { a: [new THREE.CylinderGeometry(2.2, 2.2, 6, 10), mat('#8a6a46'), [0, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(2.4, 2.4, 1.0, 10), mat('#c0352a'), [3.4, 0, 0], [0, 0, Math.PI / 2]] },
  bottle: { a: [new THREE.CylinderGeometry(2.0, 2.0, 11, 10), mat('#1d4a2c'), [0, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(1.0, 1.0, 4.0, 8), mat('#1d4a2c'), [7.4, 0, 0], [0, 0, Math.PI / 2]] },
  pipe:   { a: [new THREE.CylinderGeometry(1.25, 1.25, 13, 10), mat('#848d95'), [2.5, 0, 0], [0, 0, Math.PI / 2]],
            b: [new THREE.CylinderGeometry(1.3, 1.3, 0.9, 10), mat('#4d555c'), [8.8, 0, 0], [0, 0, Math.PI / 2]] },
};

// 職種 → 武器。書類仕事は丸めた資料やバインダー、現場はレンチ、管理は判子。
const WEAPON_OF = {
  player: 'fist',
  ally: 'roll', douki_sekkei: 'roll', douki_hinsho: 'binder', douki_genba: 'wrench', shutantou: 'binder',
  buka: 'roll', senpai: 'roll', dr: 'roll', staff: 'binder', exctrl: 'stamp',
  kyaku: 'binder', vendor: 'binder', missile: 'wrench', kanren: 'wrench', shukkou: 'binder',
  pmr_seisan: 'binder', pmr_seizou: 'wrench', pmr_choutatsu: 'binder',
  pmr_gijutsu: 'roll', pmr_hinshou: 'stamp', kanrik: 'stamp', kanrik_son: 'stamp',
  kta: 'fist',   // K田は素手。回っている腕そのものが見せ場
  // 生産企画課長（中村）とその再登場 N村 は一升瓶。投げるだけでなく、素手でも瓶を握っている。
  seikikaku: 'bottle', shitennou_nmura: 'bottle',
  shitennou_hno: 'wrench',   // H野は速い詰め役。振りの速い得物を持たせる
  maou: 'pipe',   // 魔王Y下は鉄パイプ。投げ切ってもまた拾ってくる、という体
};
const weaponOf = (e) => (e === stage.player ? 'fist' : (WEAPON_OF[e.spriteKey] || (e.isBoss ? 'fist' : 'roll')));

// ランドセル。胴のボクセルは x:-20..20 / y:0..60 / z:-12..12（+zが正面）なので、
// 背中は -z 側。胴の子にすると、向きも崩れ落ちも一緒に動く。
function makeSatchel() {
  const g = new THREE.Group();
  // 胴より横に張り出させる。胴の幅に収めると背中へ完全に隠れて、
  // 斜め前から見るこのカメラではほぼ見えない（赤がちらつくだけになる）。
  const box = new THREE.Mesh(new THREE.BoxGeometry(27, 22, 10), mat('#b4342c'));
  const flap = new THREE.Mesh(new THREE.BoxGeometry(27.6, 13, 2.2), mat('#8e241d'));
  flap.position.set(0, 4.2, -6.1);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 1.8), mat('#d8b24a'));
  clasp.position.set(0, -3.4, -6.6);
  g.add(box); g.add(flap); g.add(clasp);
  // 肩ベルト。胴の外側を通して、前から見ても背負っているのが分かるようにする
  for (const sx of [-8.5, 8.5]) {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3, 30), mat('#8e241d'));
    belt.position.set(sx, 11.5, 9);
    g.add(belt);
  }
  for (const m of g.children) { m.castShadow = true; m.receiveShadow = false; }
  g.position.set(0, 24, -15.5);
  return g;
}

const weapons = new Map();   // entity.id → {group, flash, kind}
const armMat = mat('#a8c4de');   // 作業着の袖
const wristMat = mat('#f1c79b');
const armGeo = new THREE.BoxGeometry(7.0, 2.2, 2.2);
const wristGeo = new THREE.BoxGeometry(1.4, 2.4, 2.4);

function makeWeapon(kind) {
  const spec = WEAPON_SPEC[kind] || WEAPON_SPEC.fist;
  const g = new THREE.Group();
  // 前腕。道具だけが宙に浮いて見えるのを防ぐため、必ず胴側へ伸ばす
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(-5.0, 0, 0); arm.castShadow = true; g.add(arm);
  const wrist = new THREE.Mesh(wristGeo, wristMat);
  wrist.position.set(-1.6, 0, 0); wrist.castShadow = true; g.add(wrist);
  for (const key of ['a', 'b']) {
    const part = spec[key];
    if (!part) continue;
    const [geo, material, pos, rot] = part;
    const m = new THREE.Mesh(geo, material);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

function syncWeapons() {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive || !e.attackActive) continue;
    seen.add(e.id);
    const kind = weaponOf(e);
    let r = weapons.get(e.id);
    if (!r || r.kind !== kind) {
      if (r) { scene.remove(r.group); scene.remove(r.flash); }
      const group = makeWeapon(kind);
      const flash = makeFlash();
      scene.add(group); scene.add(flash);
      r = { group, flash, kind }; weapons.set(e.id, r);
    }
    const sc = (e.scale || 3) / 3;
    const dir = e.facing >= 0 ? 1 : -1;
    // 太い相手は腕も外に出るので、得物の位置を横幅に合わせてずらす
    let px = wx(e.x) + 9.5 * sc * (e.bodyW || 1) * dir;
    const py = wy(e.z) + 10 * sc * (e.bodyH || 1);
    let pz = wz(e.y), yaw = 0;
    // 大振り（中村の一升瓶）は、体のまわりを横薙ぎに回す。
    // 通常の殴りは前へ突き出すだけなので、振り回しているとひと目で分かるようにする。
    // 奥の手のK田は、止まらずぐるぐる回し続ける（振り回しの一振りとは別物）
    if (e.attack && e.attack.spin) {
      const a = performance.now() / 1000 * 11;
      const R = 15 * sc * (e.bodyW || 1);
      px = wx(e.x) + Math.cos(a) * R * dir;
      pz = wz(e.y) + Math.sin(a) * R * 0.7;
      yaw = -a;
    }
    const sw = (e.attack && e.attack.swing) ? e.attack : null;
    if (sw && sw.dur > 0) {
      const prog = Math.max(0, Math.min(1, 1 - e.stateT / sw.dur));
      const a = -2.5 + prog * 3.6;                      // 後ろから前へ薙ぎ払う
      const R = 13 * sc * (e.bodyW || 1);
      px = wx(e.x) + Math.cos(a) * R * dir;
      pz = wz(e.y) + Math.sin(a) * R * 0.7;             // 奥行きは少し潰して見やすく
      yaw = -a;
    }
    r.group.position.set(px, py, pz);
    r.group.rotation.y = yaw;
    r.group.scale.set(sc * dir, sc, sc);          // 向きで左右反転
    r.group.visible = true;
    // 閃光は「当たったとき」だけ出す。attackActive の間ずっと出していると、
    // 空振りでも☆が出て当たったように見える。
    // hitSet は 1回の攻撃で殴れた相手の集合（combat.js の resolveMelee が入れる）。
    const landed = !!(e.attack && e.attack.hitSet && e.attack.hitSet.size > 0);
    r.flash.visible = landed;
    if (landed) {
      // 閃光は拳の少し手前・少し外側に。拳が埋もれないよう小さめにして回す
      r.flash.position.set(px + 3.5 * sc * dir, py, pz + 3);
      r.flash.rotation.z = Math.random() * Math.PI;
      r.flash.scale.setScalar(sc * (0.34 + Math.random() * 0.14));
    }
  }
  for (const [id, r] of weapons) {
    if (seen.has(id)) continue;
    scene.remove(r.group); scene.remove(r.flash); weapons.delete(id);
  }
}

// ===== 飛び道具とヒットの粒子 =====
// 2D版の Projectile を3Dの小物で表現する。
// 当たり判定・ダメージは2D版のまま（kind は 'paper' か 'missile' の2種類）で、
// 見た目だけ 書類 / マグカップ / キーボード から選んで変化をつける。
// 2D版の描画には一切影響しない。
const THROWN = {
  paper: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 4.2), mat('#f4f6f8')));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 0.5), mat('#9aa6b2')));
    return g;
  },
  mug: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.8, 4.4, 10), mat('#f2f4f6'));
    g.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.45, 6, 10), mat('#f2f4f6'));
    handle.position.set(2.4, 0, 0); handle.rotation.y = Math.PI / 2;
    g.add(handle);
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.3, 10), mat('#5a3a22'));
    coffee.position.y = 2.0; g.add(coffee);
    return g;
  },
  keyboard: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.1, 3.8), mat('#e4e7ea')));
    const keys = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 3.0), mat('#3c424a'));
    keys.position.y = 0.7; g.add(keys);
    return g;
  },
  missile: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(7, 1.8, 1.8), mat('#5a6a2e', { emissive: new THREE.Color('#2a1a08') })));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 8), mat('#8a3a1a'));
    tip.position.x = 4.2; tip.rotation.z = -Math.PI / 2; g.add(tip);
    return g;
  },
  // 中村の一升瓶
  sake: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 10, 10), mat('#1d4a2c')));
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 2.1, 2.0, 10), mat('#1d4a2c'));
    shoulder.position.y = 6.0; g.add(shoulder);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.2, 8), mat('#1d4a2c'));
    neck.position.y = 8.3; g.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.0, 8), mat('#c8a23a'));
    cap.position.y = 10.1; g.add(cap);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.4, 10), mat('#efe7d2'));
    label.position.y = -0.6; g.add(label);
    return g;
  },
  // 魔王Y下の投げ物
  pipe: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 17, 10), mat('#848d95')));
    for (const y of [8.4, -8.4]) {                     // 切り口を暗くして筒に見せる
      const e = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.6, 10), mat('#4d555c'));
      e.position.y = y; g.add(e);
    }
    return g;
  },
  dumbbell: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 9, 8), mat('#2f343a')));
    for (const y of [4.2, -4.2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 2.6, 12), mat('#3c4046'));
      w.position.y = y; g.add(w);
    }
    return g;
  },
  pc: () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 8), mat('#c9ced4'));
    g.add(base);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 6.4), mat('#8e959c'));
    keys.position.y = 0.6; g.add(keys);
    // 蓋は開いたまま飛ぶ（たたんでいる余裕はない）
    const lid = new THREE.Group();
    lid.add(new THREE.Mesh(new THREE.BoxGeometry(11, 0.8, 7.6), mat('#2b3038')));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.3, 6.6), mat('#5a8fb8', { emissive: new THREE.Color('#13293a') }));
    panel.position.y = 0.5; lid.add(panel);
    lid.position.set(0, 3.4, -4.0); lid.rotation.x = -1.15;
    g.add(lid);
    return g;
  },
  // 魔王Y下のメテオ。岩ではなく「頭が白熱して長い尾を引く筋」にする。
  // ローカル +x を進行方向とし、syncProjectiles で速度の向きへ回す。
  meteor: () => {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 0),
      mat('#fff6d8', { emissive: new THREE.Color('#fff0b0') }));
    g.add(head);
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(5.6, 0), new THREE.MeshBasicMaterial({
      color: hex('#ffb04a'), transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(halo);
    // 尾。粒が離れていると数珠に見えるので、重なるだけ詰めて一本の筋にする
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4 - t * 2.7, 0), new THREE.MeshBasicMaterial({
        color: hex(t < 0.3 ? '#fff0b0' : t < 0.62 ? '#ffa02a' : '#c23a08'),
        transparent: true, opacity: 0.8 - t * 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(-3.6 - i * 4.2, 0, 0);
      g.add(m);
    }
    return g;
  },
};
const LOOKS = ['paper', 'mug', 'keyboard'];
// 投げ物ごとの回り方。倒れずに回る軸と速さで、重さの違いを出す。
const SPIN = {
  meteor:   { z: 0.25, x: 0 },    // 岩塊なのでゆっくり回る
  sake:     { z: 1.5, x: 0 },     // 端から端へくるくる回る
  pipe:     { z: 2.6, x: 0 },     // 一番速く回る
  dumbbell: { z: 0.9, x: 0 },     // 重いのでゆっくり
  pc:       { z: 1.0, x: 0.7 },   // 開いたまま不規則に舞う
};

// 彗星の着地点を床に出す印。落ちるほど濃くなるので、あと何秒かが読める。
// 当たり判定が奥行きを 1.6 倍で詰めて見ているので、円ではなく奥行きを潰した楕円にする。
const markGeo = new THREE.CircleGeometry(1, 30); markGeo.rotateX(-Math.PI / 2);
const markRing = new THREE.RingGeometry(0.88, 1.0, 30); markRing.rotateX(-Math.PI / 2);
function makeMark() {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff2a0e'), transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
  const ring = new THREE.Mesh(markRing, new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ff7a3a'), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  fill.renderOrder = 2; ring.renderOrder = 3;
  g.add(fill); g.add(ring); g.position.y = 0.2;
  scene.add(g);
  return { g, fill, ring };
}

const projMeshes = new Map();
function syncProjectiles() {
  const seen = new Set();
  for (const pr of stage.projectiles) {
    if (!pr.alive) continue;
    seen.add(pr.id);
    let r = projMeshes.get(pr.id);
    if (!r) {
      // pr.look は投げた時点で決まっている（一升瓶・鉄パイプなど）。
      // 書類(paper)だけは見た目を散らしたいので、同じ弾が毎フレーム変わらないよう ID から決める。
      const look = (pr.look && THROWN[pr.look]) ? pr.look
        : (pr.kind === 'missile' ? 'missile' : LOOKS[pr.id % LOOKS.length]);
      const group = THROWN[look]();
      group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      scene.add(group);
      r = { group, look, spin: (pr.id % 2 ? 1 : -1) * 0.26, mark: pr.aoe ? makeMark() : null };
      projMeshes.set(pr.id, r);
    }
    if (r.mark) {
      const rr = pr.aoe * S;
      const prog = 1 - Math.min(1, Math.max(0, pr.z) / 240);     // 0=出たばかり 1=着地直前
      r.mark.g.position.set(wx(pr.mx), 0.2, wz(pr.my));
      r.mark.g.scale.set(rr, 1, rr / 1.6);                        // 奥行きを潰す
      r.mark.fill.material.opacity = 0.10 + 0.26 * prog;
      r.mark.ring.material.opacity = 0.45 + 0.5 * prog;
    }
    r.group.position.set(wx(pr.x), wy(pr.z || 0) + 9, wz(pr.y));
    if (r.look === 'meteor') {
      // 速度の向き（斜め下）へ筋を寝かせる。真下に落ちる岩に見せない。
      r.group.rotation.set(0, 0, Math.atan2(pr.vz || -1, pr.vx || -1));
    } else if (r.look === 'missile') {
      r.group.rotation.set(0, pr.vx > 0 ? 0 : Math.PI, 0);       // 誘導弾は進行方向を向く
    } else {
      const sp = SPIN[r.look] || { z: 1, x: 0.6 };                // 投げ物はくるくる回る
      r.group.rotation.z += r.spin * sp.z;
      r.group.rotation.x += r.spin * sp.x;
    }
  }
  for (const [id, r] of projMeshes) {
    if (seen.has(id)) continue;
    scene.remove(r.group);
    if (r.mark) { scene.remove(r.mark.g); r.mark.fill.material.dispose(); r.mark.ring.material.dispose(); }
    projMeshes.delete(id);
  }
}

// メテオ着弾: 火の粉を3色で散らし、画面を揺らして赤く光らせる
const flashEl = document.getElementById('flash');
// 着弾の火球。粒子が散るだけでは「落ちてきた」感じが出ないので、
// 床にドーム状の火球を膨らませて消す（参考: FF のメテオ）。
const domeGeo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const domes = [];
function meteorBoom(gx, gy, radius = 42) {
  FX.hitstop = Math.max(FX.hitstop, 0.05);
  FX.shake = Math.max(FX.shake, 3.2);
  FX.flashT = Math.max(FX.flashT, 0.42);
  for (const c of ['#fff0b0', '#ff7f0e', '#c73333']) burst(gx, gy, c);
  // 見た目の火球は当たり判定より一回り大きく。判定の広さは落ちる前の床の印で見せてある。
  const R = radius * S * 1.5;
  for (const [col, k, op] of [['#ff6a1e', 1.0, 0.72], ['#ffd24a', 0.62, 0.8], ['#fff4cc', 0.3, 0.9]]) {
    const m = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
      color: hex(col), transparent: true, opacity: op,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(wx(gx), 0.3, wz(gy));
    m.renderOrder = 5;
    scene.add(m);
    domes.push({ m, r: R * k, t: 0, life: 0.5 + k * 0.2, op });
  }
}

function updateDomes(dt) {
  for (let i = domes.length - 1; i >= 0; i--) {
    const d = domes[i];
    d.t += dt;
    const q = d.t / d.life;
    if (q >= 1) { scene.remove(d.m); d.m.material.dispose(); domes.splice(i, 1); continue; }
    const g = d.r * (0.35 + 0.65 * Math.sqrt(q));     // 最初に速く広がって止まる
    d.m.scale.set(g, g * 0.95, g * 0.78);             // 丸く盛り上がった火球
    d.m.material.opacity = d.op * (1 - q * q);
  }
}

// 砕けた投げ物の破片の色（2D側の DEBRIS と揃える）
const SHARD = { sake: '#9ccfae', pipe: '#b4bcc3', dumbbell: '#6b7076', pc: '#7fd4ff' };

// 打撃の粒子
const partGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const partPool = [];
const parts = [];
function burst(gx, gy, color) {
  const col = new THREE.Color(color || '#ffd24a');
  for (let i = 0; i < 9; i++) {
    let m = partPool.pop();
    if (!m) { m = new THREE.Mesh(partGeo, new THREE.MeshLambertMaterial({ color: col })); scene.add(m); }
    else { m.material.color.copy(col); m.visible = true; }
    const a = (i / 9) * Math.PI * 2;
    parts.push({
      m, t: 0,
      x: wx(gx), y: wy(0) + 10, z: wz(gy),
      vx: Math.cos(a) * 16, vy: 10 + (i % 3) * 6, vz: Math.sin(a) * 10,
    });
    m.position.set(wx(gx), wy(0) + 10, wz(gy));
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.t += dt;
    if (p.t > 0.42) { p.m.visible = false; partPool.push(p.m); parts.splice(i, 1); continue; }
    p.vy -= 58 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.m.position.set(p.x, Math.max(0.4, p.y), p.z);
    p.m.scale.setScalar(0.5 + (1 - p.t / 0.42));
  }
}

// ===== 画面に重ねる文字（吹き出し / 役職ラベル / ダメージ数字）=====
//
// 3Dの中に文字を置くとボケるので、キャラの位置をスクリーン座標に投影して
// DOM要素を頭上に置く。2D版の吹き出し・頭上ラベル・ダメージ数字をそのまま再現する。
const layer = document.getElementById('labels');
const projV = new THREE.Vector3();

// 画面（#stage）の実寸。box() は背景を置く関数なので名前を分けてある。
const stageEl = document.getElementById('stage');
function project(wxp, wyp, wzp) {
  projV.set(wxp, wyp, wzp).project(camera);
  if (projV.z > 1) return null;                       // カメラの後ろ
  return {
    x: (projV.x * 0.5 + 0.5) * stageEl.clientWidth,
    y: (-projV.y * 0.5 + 0.5) * stageEl.clientHeight,
  };
}

const tagEls = new Map();   // entity.id → {tag, bubble, hp}
const drawOrder = [];       // 名札とセリフを置く順（毎フレーム使い回す）
function elFor(id) {
  let r = tagEls.get(id);
  if (!r) {
    const tag = document.createElement('div'); tag.className = 'tag';
    const bubble = document.createElement('div'); bubble.className = 'bubble';
    const hp = document.createElement('div'); hp.className = 'ehp';
    hp.appendChild(document.createElement('i'));
    layer.appendChild(tag); layer.appendChild(bubble); layer.appendChild(hp);
    r = { tag, bubble, hp }; tagEls.set(id, r);
  }
  return r;
}

function syncLabels() {
  // タイトルは一枚絵として見せたいので、頭上の名札も吹き出しも出さない
  // （中央の書類に重なって縁で切れる）。
  if (game.state === 'title') {
    for (const [, r] of tagEls) { r.tag.style.display = 'none'; r.bubble.style.display = 'none'; r.hp.style.display = 'none'; }
    return;
  }
  const seen = new Set();
  // 同じ役職が固まって立っていると名札が重なり、「PJメンバ」が「PJメシバ」のように
  // 潰れて読めなくなる。この1フレームで置いた名札の矩形を覚えておき、
  // 同じ文字の名札がぶつかるときは後から来たほうを出さない（1枚だけ残す）。
  const placed = [];
  // セリフの吹き出しは、重なったら上へ積む。敵は群がってくるので、重なったぶんを
  // 隠すと「一人が喋っているあいだ他は黙る」ように見えてしまう。全員の声を出したまま
  // 読めるようにするため、下から順に段を重ねる。画面の上に出るものだけは諦める。
  // 各要素は { cx, bottom, half, h }。bottom は吹き出しの下辺（translate -100% のため）。
  const placedBubbles = [];
  // ボスを先に置く。後回しにすると雑魚や中ボスの吹き出しに押し上げられ、箱の外
  //（#labels は overflow:hidden）へ出て上半分が切り落とされる。裏ステージで
  // Y下5人衆と魔王が同時に喋るとこれが起きていた。魔王のセリフがいちばん大事なので、
  // 先に場所を取らせて、残りをその上へ積ませる。
  drawOrder.length = 0;
  for (const e of stage.entities) if (e.isBoss) drawOrder.push(e);
  for (const e of stage.entities) if (e.midboss && !e.isBoss) drawOrder.push(e);
  for (const e of stage.entities) if (!e.isBoss && !e.midboss) drawOrder.push(e);
  for (const e of drawOrder) {
    if (!e.alive) continue;
    seen.add(e.id);
    const { tag, bubble, hp } = elFor(e.id);
    const headY = wy(e.z) + 19 * ((e.scale || 3) / 3) * (e.bodyH || 1);   // 頭のすぐ上
    const p = project(wx(e.x), headY, wz(e.y));
    if (!p) { tag.style.display = bubble.style.display = hp.style.display = 'none'; continue; }

    // 頭上のHPバー。2D版の drawHpBar と同じく、無傷のうちは出さない。
    // 下のゲージに出している相手は二重になるので省く。
    const showHp = e !== stage.player && !e.hideHpBar && !e.isBoss
      && e !== gaugeTarget && e.hp < e.maxhp;
    if (showHp) {
      const t = Math.max(0, e.hp / e.maxhp);
      hp.className = 'ehp' + (e.midboss ? ' mid' : '');
      hp.firstChild.style.width = (t * 100).toFixed(0) + '%';
      hp.firstChild.style.background = t < 0.3 ? '#d63b3b' : t < 0.6 ? '#dd9a2a' : '#49a862';
      hp.style.display = 'block';
      hp.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
    } else hp.style.display = 'none';
    const tagY = p.y - (showHp ? (e.midboss ? 10 : 8) : 0);   // バーのぶん名札を上げる
    // 文字の大きさはキャラの体格に合わせる。ボスは1.5〜2.3倍の体格があるので、
    // 同じ級数だと相対的に小さく見えてしまう。
    const sr = (e.scale || 3) / 3;
    // 見かけの大きさを2D版にそろえる。2D版は幅480pxの画面に、名札8px・セリフ11px で描いている
    // （ボスは体格ぶん大きくなる）。3Dは箱の幅が可変なので、その比率から級数を出す。
    // こうすると、どの画面幅でも2D版と同じ大きさに見える。
    const px2D = stageEl.clientWidth / 480;
    const tagPx = Math.max(9, Math.min(17 * px2D, 8 * px2D * (1 + (sr - 1) * 0.55)));

    // 頭上の役職ラベル（ボスとプレイヤーは出さない。2D版と同じ）
    const label = e === stage.player ? null
      : e.betrayed ? '裏切り者'
      : (e.isBoss ? null : TYPE_LABEL[e.spriteKey]);
    let tagH = 0;                        // 吹き出しをどれだけ上に逃がすか
    // 画面の端に居る相手の名前が切れないよう、内側に寄せる。
    // #labels は overflow:hidden なので、はみ出すと名前ごと消える。
    const putTag = (text, color) => {
      const half = text.length * tagPx * 0.55;
      const tx = Math.min(Math.max(p.x, half + 6), stageEl.clientWidth - half - 6);
      const ty = Math.max(tagPx + 4, tagY);
      // 同じ文字の名札と重なるなら出さない。違う役職どうしは重なっても両方残す
      //（誰が何なのかは読めたほうがいいので、多少ぶつかるのは許す）。
      for (const q of placed) {
        if (q.text !== text) continue;
        if (Math.abs(q.cx - tx) < q.half + half && Math.abs(q.cy - ty) < tagPx) {
          tag.style.display = 'none';
          return;
        }
      }
      tag.textContent = text;
      tag.style.color = color;
      tag.style.fontSize = tagPx.toFixed(1) + 'px';
      tag.style.display = 'block';
      tag.style.transform = `translate(-50%,-100%) translate(${tx}px,${ty}px)`;
      placed.push({ text, cx: tx, cy: ty, half });
      tagH = tagPx;
    };
    if (label) putTag(label, e.betrayed ? '#ff5a5a' : (TYPE_COLOR[e.spriteKey] || '#cfd6de'));
    else if (e === stage.player) putTag('▼', '#ff7f0e');
    else tag.style.display = 'none';

    // セリフの吹き出し。名札の級数が上がったぶん、重ならないよう持ち上げる。
    if (e.taunt && e.tauntT > 0) {
      bubble.textContent = e.taunt;
      bubble.classList.toggle('ally', e.team === 'ally');
      bubble.classList.toggle('boss', !!(e.isBoss || e.midboss));
      bubble.classList.toggle('lead', !!e.isBoss);   // 本物のボスだけは必ず手前に重ねる
      bubble.style.display = 'block';
      // 大きいボスほど吹き出しが高く上がるので、画面の外へ出してしまわないよう内側に寄せる。
      // offsetWidth を読むと毎フレーム再レイアウトが走るため、級数と文字数から見積もる。
      const fs = Math.max(12, Math.min(26 * px2D, 11 * px2D * (1 + (sr - 1) * 0.85)));
      bubble.style.fontSize = fs.toFixed(1) + 'px';
      // 長い一言は折り返す。上限は箱の7割強。そのぶん背が伸びるので、行数ぶん持ち上げる。
      const maxW = stageEl.clientWidth * 0.72;
      bubble.style.maxWidth = maxW.toFixed(0) + 'px';
      const wantW = e.taunt.length * fs + fs * 1.5;
      const rows = Math.max(1, Math.ceil(wantW / maxW));
      const halfW = Math.min(maxW, wantW) / 2;
      const bh = fs * 1.35 * rows + fs * 0.7;
      const bxp = Math.min(Math.max(p.x, halfW + 8), stageEl.clientWidth - halfW - 8);
      let by = Math.max(bh + hudTop, tagY - tagH - 9);
      // ぶつかる相手の真上へ逃がす。数回繰り返して、空いた段に収める。
      for (let guard = 0; guard < 8; guard++) {
        const hit = placedBubbles.find((q) =>
          Math.abs(q.cx - bxp) < q.half + halfW && by > q.bottom - q.h && by - bh < q.bottom);
        if (!hit) break;
        by = hit.bottom - hit.h - 5;
      }
      // 積み上げた結果、箱の上へ出てしまうことがある。#labels は overflow:hidden なので、
      // そのまま出すと上が切れて何を言ったのか読めない。ボスは重なってでも中へ戻し、
      // それ以外は諦めて出さない（切れた吹き出しより、出ないほうがまし）。
      if (by - bh < hudTop) {
        if (!e.isBoss) { bubble.style.display = 'none'; continue; }
        by = bh + hudTop;
      }
      placedBubbles.push({ cx: bxp, bottom: by, half: halfW, h: bh });
      bubble.style.transform = `translate(-50%,-100%) translate(${bxp}px,${by}px)`;
    } else bubble.style.display = 'none';
  }
  for (const [id, r] of tagEls) {
    if (seen.has(id)) continue;
    r.tag.remove(); r.bubble.remove(); r.hp.remove(); tagEls.delete(id);
  }
}

// 鳥居の扁額に出す「出向」の二文字。ボクセルでは文字が読めないので、
// 名札と同じ投影DOMで扁額の板の上に重ねる。くぐった後は薄く残す。
let plateEl = null;
function syncDoorPlate() {
  const d = (game.state === 'playing' || game.state === 'intro') && stage.door ? stage.door : null;
  if (!d) { if (plateEl) plateEl.style.display = 'none'; return; }
  if (!plateEl) {
    plateEl = document.createElement('div');
    plateEl.className = 'plate';
    plateEl.textContent = '出向';
    layer.appendChild(plateEl);
  }
  const p = project(wx(d.x), 24.3, wz(d.y) + 2.4);
  if (!p) { plateEl.style.display = 'none'; return; }
  plateEl.style.display = 'block';
  plateEl.style.opacity = d.used ? '0.4' : '1';
  plateEl.style.transform = `translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;
}

// ダメージ数字など、浮かんで消える文字
const floats = [];
function addFloat(gx, gy, gz, text, color) {
  const el = document.createElement('div');
  el.className = 'float'; el.textContent = text; el.style.color = color || '#ffe39a';
  layer.appendChild(el);
  floats.push({ el, gx, gy, gz, t: 0 });
}
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    if (f.t > 0.8) { f.el.remove(); floats.splice(i, 1); continue; }
    const p = project(wx(f.gx), wy(0) + 13 + f.t * 14, wz(f.gy));
    if (!p) { f.el.style.display = 'none'; continue; }
    f.el.style.display = 'block';
    f.el.style.opacity = String(1 - f.t / 0.8);
    f.el.style.transform = `translate(-50%,-100%) translate(${p.x}px,${p.y}px)`;
  }
}

// ===== カメラ =====
// dist は「2D版と同じ範囲を映す」値。2Dは論理480x270=横160/縦90ワールドユニットを映すので、
// 水平fov 44.6° で横160になる実距離194.9 → 高さ差31を引いて dist_z=192。
// height を上げると俯角が付いて奥行きが読めるようになる。
// dist は「横160ワールドユニット＝2D版と同じ範囲」を保つ値（実距離194.9から高さ差を引く）。
const CAM = { dist: 188, height: 62, lookY: 13 };
const camPos = new THREE.Vector3(wx(stageStartX()), CAM.height, CAM.dist);
const camLook = new THREE.Vector3(wx(stageStartX()), CAM.lookY, -3);
function stageStartX() { return 60; }
function updateCamera(dt) {
  const p = stage.player;
  // タイトルは自機を追わず、門を正面から見る固定カメラ。ゆっくり横に流す。
  if (game.state === 'title') {
    // 画面中央は書類で塞がるので、門は右三分の一に来るよう構図を左へ振る
    const cx = wx(p.x), t = game.screenT, sw = Math.sin(t * 0.17);
    camPos.set(cx - 32 + sw * 13, 72 + Math.sin(t * 0.11) * 3, 252);
    camLook.set(cx - 32 + sw * 5, 26, -50);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    sun.target.position.set(cx, 0, -40);
    sun.position.set(cx - 70, 150, 90);
    fill.target.position.set(cx, 10, -40);
    fill.position.set(cx + 30, 40, 130);
    return;
  }
  const bossOn = stage.bossStarted && stage.boss && stage.boss.alive;
  const dist = bossOn ? CAM.dist * 0.82 : CAM.dist;   // ボス戦は寄る（案D）
  const height = bossOn ? CAM.height * 0.86 : CAM.height;
  const tx = wx(p.x) + (bossOn ? 6 : 0);
  const a = Math.min(1, Math.max(0, 1 - Math.pow(0.0015, Math.max(0, dt))));
  camPos.lerp(new THREE.Vector3(tx, height, wz(p.y) + dist), a);
  camLook.lerp(new THREE.Vector3(tx, CAM.lookY, wz(p.y) - 3), a);
  const sh = FX.shake * 1.8;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook);
  sun.target.position.set(camLook.x, 0, camLook.z);
  sun.position.set(camLook.x - 60, 120, camLook.z + 80);
  fill.target.position.set(camLook.x, 8, camLook.z);
  fill.position.set(camLook.x + 20, 34, camLook.z + 120);
}


export {
  THREE, S, wx, wy, wz, Q, renderer, scene, camera, CAM, camPos, camLook,
  APPEARANCES, SHARD, flames, domes, doorFx, meshes, flashEl,
  box, applyScene, sceneAt, buildScenery, clearScenery, clearStageObjects,
  addFloat, burst, meteorBoom,
  syncEntities, syncWeapons, syncProjectiles, syncLabels, syncDoorPlate,
  updateCamera, updateFlames, updateParts, updateDomes, updateFloats,
};

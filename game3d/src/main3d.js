// 小向クエスト — ボクセル3Dレンダラ（プロトタイプ）
//
// ゲームロジックは一切変更していない。既存の Stage をそのまま動かし、
// 描画だけ three.js に差し替えている（x=横 / y=奥行き / z=高さ の3軸がもともとあるため）。
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { FLOOR_TOP, FLOOR_BOTTOM } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Stage } from '../../game/src/main.js';
import { STAGES } from '../../game/src/stages.js';
import { buildVoxelForType } from '../../game/src/voxel.js';
import { TYPE_LABEL } from '../../game/src/sprites.js';
import { Audio } from '../../game/src/audio.js';

const S = 1 / 3;                               // ゲーム座標 → ワールド座標
const FLOOR_MID = (FLOOR_TOP + FLOOR_BOTTOM) / 2;
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
const geoCache = new Map();
function geoFor(key) {
  if (geoCache.has(key)) return geoCache.get(key);
  const v = buildVoxelForType(key) || buildVoxelForType('buka');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(v.colors, 3));
  g.setIndex(new THREE.BufferAttribute(v.indices, 1));
  geoCache.set(key, g);
  return g;
}
const charMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const charMatHit = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x883311 });

// ===== ステージの箱組み =====
// three は THREE.Color / material.color を自動で sRGB→作業色空間に変換する。
// ここで自前変換すると二重変換になって極端に暗くなるので、文字列をそのまま渡す。
// （voxel.js の頂点カラーは自動変換の対象外なので、あちらは手で linear 化している）
function hex(c) { return new THREE.Color(c); }
function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: hex(color), emissive: opts.emissive ? hex(opts.emissive) : 0x000000 }),
  );
  m.position.set(x, y, z);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  scene.add(m);
  return m;
}

function buildScenery(data) {
  const bg = data.bg;
  const W = data.width * S;
  const halfD = (FLOOR_BOTTOM - FLOOR_TOP) * S / 2 + 2;

  scene.background = hex(bg.wall);
  if (Q.get('nofog') !== '1') scene.fog = new THREE.Fog(hex(bg.wall), 150, 520);

  // 床。カメラ側（手前）に大きく伸ばして画面下端まで床で埋める
  box(W + 60, 2, 150, bg.floor, W / 2, -1, 40);
  // 歩行帯のライン（奥行きの手がかり。ベルトスクロールの"足場"を示す）
  box(W + 60, 0.08, 0.5, bg.accent, W / 2, 0.02, halfD);
  // 奥の壁
  box(W + 60, 56, 2, bg.wall, W / 2, 28, -halfD - 1);
  // 巾木
  box(W + 60, 1.4, 1.2, bg.accent, W / 2, 0.7, -halfD - 0.1);
  // 手前のローパーティション。前景に物を置くと一気に奥行きが出る（歩行帯の外に配置）
  // 高さは足元ラインより下に収める（キャラの足と影が隠れると奥行きが読めなくなる）
  for (let x = -10; x < W + 20; x += 34) {
    box(30, 4, 1.6, bg.detail, x, 2, halfD + 26);
    box(30, 0.6, 2.2, bg.accent, x, 4.2, halfD + 26);
  }
  // 天井（空間を閉じると一気に"部屋"に見える）
  box(W + 60, 2, 60, bg.detail, W / 2, 45, -halfD + 24);

  // 窓（office_win）: 外光が入る明るい面＋遠景ビル
  if (bg.scene === 'office_win') {
    for (let x = 10; x < W; x += 44) {
      box(30, 24, 0.6, '#9fc4e0', x, 20, -halfD - 0.2, { emissive: '#3f5f7a' });
      box(32, 1.2, 1.2, bg.detail, x, 32.5, -halfD - 0.4);
      box(1.2, 24, 1.2, bg.detail, x, 20, -halfD - 0.4);
    }
  } else {
    for (let x = 10; x < W; x += 36) box(8, 30, 1.6, bg.detail, x, 15, -halfD - 0.4);
  }

  // 天井の蛍光灯（光源の見た目。実際の照明は DirectionalLight）
  for (let x = 16; x < W; x += 30) {
    box(16, 0.7, 3, '#eef4f8', x, 43.4, -halfD + 10, { emissive: '#9fb8cc', receive: false });
  }

  // デスク列（奥）
  for (let x = 14; x < W; x += 26) {
    box(16, 1.2, 7, '#6a5a44', x, 7.5, -halfD + 6, { cast: true });
    box(1.4, 7.5, 1.4, '#4a3f30', x - 6.5, 3.7, -halfD + 6);
    box(1.4, 7.5, 1.4, '#4a3f30', x + 6.5, 3.7, -halfD + 6);
    box(5, 4, 0.8, '#2b3a46', x, 10.6, -halfD + 4.2, { emissive: '#17313f', cast: true });
  }
}

// ===== ライト =====
const hemi = new THREE.HemisphereLight(0xd6e6f4, 0x2a3440, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e2, 1.9);
sun.position.set(-30, 70, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 420;
scene.add(sun);
scene.add(sun.target);

// ===== ゲーム本体（ロジックは2D版そのまま）=====
const game = {
  difficulty: 'normal', score: 0, lives: 3, over: false,
  toGameOver() { this.over = true; },
};
const stage = new Stage(STAGES[0], game);
buildScenery(STAGES[0]);

// 打撃フック: ヒットストップ＋カメラシェイク（案D）
let hitstop = 0, shake = 0;
const origHit = stage.fx.hit.bind(stage.fx);
stage.fx.hit = (x, y, color) => { origHit(x, y, color); hitstop = 0.06; shake = 1.1; };

// ===== エンティティ ↔ メッシュ =====
const meshes = new Map();
function syncEntities() {
  const seen = new Set();
  for (const e of stage.entities) {
    if (!e.alive) continue;
    seen.add(e.id);
    let m = meshes.get(e.id);
    if (!m) {
      m = new THREE.Mesh(geoFor(e.spriteKey), charMat);
      m.castShadow = true; m.receiveShadow = false;
      scene.add(m);
      meshes.set(e.id, m);
    }
    const sc = (e.scale || 3) / 3;
    m.scale.setScalar(sc);
    m.position.set(wx(e.x), wy(e.z), wz(e.y));
    // 真横を向くと薄い板に見えるので、向きは浅い角度だけ付ける（顔はカメラ側に残す）
    m.rotation.y = (e.facing >= 0 ? -1 : 1) * 0.42;
    m.visible = !(e.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0);
    m.material = e.hitstun > 0 ? charMatHit : charMat;
  }
  for (const [id, m] of meshes) {
    if (seen.has(id)) continue;
    scene.remove(m); meshes.delete(id);
  }
}

// ===== カメラ =====
const CAM = { dist: 150, height: 44, lookY: 13 };
const camPos = new THREE.Vector3(wx(stageStartX()), CAM.height, CAM.dist);
const camLook = new THREE.Vector3(wx(stageStartX()), CAM.lookY, -3);
function stageStartX() { return 60; }
function updateCamera(dt) {
  const p = stage.player;
  const bossOn = stage.bossStarted && stage.boss && stage.boss.alive;
  const dist = bossOn ? CAM.dist * 0.82 : CAM.dist;   // ボス戦は寄る（案D）
  const height = bossOn ? CAM.height * 0.86 : CAM.height;
  const tx = wx(p.x) + (bossOn ? 6 : 0);
  const a = Math.min(1, Math.max(0, 1 - Math.pow(0.0015, Math.max(0, dt))));
  camPos.lerp(new THREE.Vector3(tx, height, wz(p.y) + dist), a);
  camLook.lerp(new THREE.Vector3(tx, CAM.lookY, wz(p.y) - 3), a);
  const sh = shake * 1.8;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook);
  sun.target.position.set(camLook.x, 0, camLook.z);
  sun.position.set(camLook.x - 60, 120, camLook.z + 80);
}

// ===== HUD（案A: 高解像度レイヤー / 案B: 社内システムの語彙）=====
const hud = {
  rank: document.getElementById('rank'),
  hpFill: document.getElementById('hpFill'),
  hpNum: document.getElementById('hpNum'),
  lives: document.getElementById('lives'),
  score: document.getElementById('score'),
  bossWrap: document.getElementById('bossWrap'),
  bossName: document.getElementById('bossName'),
  bossFill: document.getElementById('bossFill'),
  banner: document.getElementById('banner'),
  loc: document.getElementById('loc'),
};
let hpShown = 1, bossShown = 1, scoreShown = 0;
function updateHUD(dt) {
  const p = stage.player;
  hpShown += ((p.hp / p.maxhp) - hpShown) * Math.min(1, dt * 7);   // バーを補間（案D）
  scoreShown += (game.score - scoreShown) * Math.min(1, dt * 6);
  hud.rank.textContent = stage.data.playerRank;
  hud.hpFill.style.width = (hpShown * 100).toFixed(1) + '%';
  hud.hpFill.style.background = hpShown < 0.3 ? '#c73333' : hpShown < 0.6 ? '#e0a030' : '#389451';
  hud.hpNum.textContent = Math.max(0, Math.round(p.hp)) + ' / ' + p.maxhp;
  hud.lives.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < game.lives ? 'on' : ''}"></i>`).join('');
  hud.score.textContent = String(Math.round(scoreShown)).padStart(6, '0');

  const b = stage.boss;
  if (b && b.alive) {
    bossShown += ((b.hp / b.maxhp) - bossShown) * Math.min(1, dt * 7);
    hud.bossWrap.classList.add('show');
    hud.bossName.textContent = b.typeName;
    hud.bossFill.style.width = (bossShown * 100).toFixed(1) + '%';
  } else {
    hud.bossWrap.classList.remove('show');
    bossShown = 1;
  }
  hud.loc.textContent = stage.data.location || '';
  if (stage.bannerT > 0 && stage.banner) {
    hud.banner.textContent = stage.banner;
    hud.banner.classList.add('show');
  } else hud.banner.classList.remove('show');
}

// ===== ループ =====
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

Input.init();
Input.initTouch(document.getElementById('c3d'));
addEventListener('keydown', () => Audio.resume(), { once: true });
addEventListener('pointerdown', () => Audio.resume(), { once: true });

const STEP = 1 / 60;
let acc = 0, last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let frame = (now - last) / 1000; last = now;
  if (!(frame > 0)) frame = 0;        // 負 / NaN を潰す（補間の発散を防ぐ）
  if (frame > 0.25) frame = 0.25;     // スパイラル防止
  acc += frame;
  try {
  while (acc >= STEP) {
    if (hitstop > 0) hitstop -= STEP;          // 打撃の手応え（案D）
    else if (!game.over && !stage.cleared) stage.update(STEP);
    Input.endFrame();
    acc -= STEP;
  }
  shake = Math.max(0, shake - frame * 4.5);
  syncEntities();
  updateCamera(frame);
  updateHUD(frame);
  renderer.render(scene, camera);
  if (!window.__once && Q.get('dbg') === '1') { window.__once = 1; window.__dbg && window.__dbg(
    'OK frame1 / meshes=' + meshes.size + ' / children=' + scene.children.length +
    ' / cam=' + camera.position.toArray().map(n=>n.toFixed(1)).join(',') +
    ' / look=' + camLook.toArray().map(n=>n.toFixed(1)).join(',')); }
  } catch (e) { window.__dbg && window.__dbg('LOOP: ' + (e.stack || e.message)); throw e; }
}
requestAnimationFrame(loop);

// ?demo=N … 指定x地点まで進めて波を出す（スクリーンショット確認用）
{
  const d = parseFloat(new URLSearchParams(location.search).get('demo') || '0');
  if (d > 0) { stage.player.x = d; stage.updateWaves(); camPos.x = wx(d); camLook.x = wx(d); }
}

// デバッグ: ボスまで一気に進める
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') { stage.player.x = stage.width - 230; stage.currentWave = 99; }
});

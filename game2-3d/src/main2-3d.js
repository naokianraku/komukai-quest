// 小向クエスト2 ゴールデンエイジ編 — 3D版のシェル（起動・状態機械・HUD・画面）
//
// ゲームロジックは2D版（game2/src/main2.js）の Game2 / Stage2 をそのまま使う。
// 描画は本編の3D版と同じ render3d.js。ここが持つのは
// 「章をどう読み込むか」「HUDに何を出すか」「どの画面を出すか」だけ。
import { LIVES } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Audio } from '../../game/src/audio.js';
import { registerPalettes, registerTypeMeta } from '../../game/src/sprites.js';
import { CHAPTERS, PALETTES2, LABELS2, COLORS2, defFor2 } from '../../game2/src/stages2.js';
import { Game2, Stage2 } from '../../game2/src/main2.js';
import {
  wx, wz, Q, renderer, scene, camera, CAM, camPos, camLook,
  SHARD, flames, domes, flashEl, FX,
  buildScenery, clearStageObjects, sceneAt, getScene, setScene,
  setStage, setGame, setGaugeTarget, setHudTop,
  addFloat, burst, meteorBoom,
  syncEntities, syncWeapons, syncProjectiles, syncLabels, syncDoorPlate,
  updateCamera, updateFlames, updateParts, updateDomes, updateFloats,
} from '../../game3d/src/render3d.js';

// 続編の役職パレットと名札を先に登録する。voxel.js は sprites.js の CHAR_PALETTES を
// 直接読むので、これを忘れると続編のキャラが全員「部下」の見た目で出てくる。
registerPalettes(PALETTES2);
registerTypeMeta(LABELS2, COLORS2);

// ===== ゲーム本体 =====
// 2D版の Game2 をそのまま継承する。違うのは
//  ・章を読み込んだら3Dの場面も張り替える
//  ・打撃のヒットストップ中はステージを進めない
//  ・エピローグの行き先が3D版の本編
// の3点だけ。進行そのもの（同期の加入・離脱、残工期、レター）は2D版と同じものが動く。
class Game2_3D extends Game2 {
  constructor() {
    super();
    this.exitHref = '../game3d/';
  }

  loadChapter(i) {
    super.loadChapter(i);
    attach(this.stage, CHAPTERS[i]);
  }

  update(dt) {
    // 打撃の手応え。止めている間はステージを進めないが、画面の状態遷移は進める
    if (this.state === 'playing' && !this.paused && FX.hitstop > 0) {
      FX.hitstop -= dt;
      const st = this.stage;
      st.update = () => {};
      try { super.update(dt); } finally { delete st.update; }
      return;
    }
    super.update(dt);
  }
}

const game = new Game2_3D();
setGame(game);

let bossSceneApplied = false;

// 章の読み込み。fx のフックを張り直すのを忘れると、打撃の手応えと
// ダメージ数字が出なくなるので必ずここを通す。
function attach(st, data) {
  clearStageObjects();
  bossSceneApplied = false;
  setStage(st);
  const oHit = st.fx.hit.bind(st.fx);
  st.fx.hit = (x, y, c) => { oHit(x, y, c); FX.hitstop = 0.06; FX.shake = 1.1; burst(x, y, c); };
  const oBoom = st.fx.boom ? st.fx.boom.bind(st.fx) : null;
  if (oBoom) st.fx.boom = (x, y) => { oBoom(x, y); FX.hitstop = 0.22; FX.shake = 2.6; burst(x, y, '#ffd24a'); };
  const oText = st.fx.text.bind(st.fx);
  st.fx.text = (x, y, s, c) => { oText(x, y, s, c); addFloat(x, y, 0, s, c); };
  const oShatter = st.fx.shatter.bind(st.fx);
  st.fx.shatter = (x, y, look) => { oShatter(x, y, look); FX.shake = Math.max(FX.shake, 0.7); burst(x, y, SHARD[look] || SHARD.sake); };
  const oMeteor = st.fx.meteor.bind(st.fx);
  st.fx.meteor = (x, y, r) => { oMeteor(x, y, r); meteorBoom(x, y, r); };
  buildScenery(data);
  camPos.set(wx(st.player.x), CAM.height, wz(st.player.y) + CAM.dist);
  camLook.set(wx(st.player.x), CAM.lookY, wz(st.player.y) - 3);
}

// タイトルの裏にも章が要る（render3d は stage を前提に描く）。第1章を置いておく。
game.stage = new Stage2(CHAPTERS[0], game);
attach(game.stage, CHAPTERS[0]);

// ===== HUD =====
const hud = {
  rank: document.getElementById('rank'),
  diffchip: document.getElementById('diffchip'),
  hpFill: document.getElementById('hpFill'),
  hpNum: document.getElementById('hpNum'),
  lives: document.getElementById('lives'),
  roster: document.getElementById('roster'),
  score: document.getElementById('score'),
  gKouki: document.getElementById('gKouki'),
  gGenka: document.getElementById('gGenka'),
  gLetter: document.getElementById('gLetter'),
  koukiFill: document.getElementById('koukiFill'),
  genkaFill: document.getElementById('genkaFill'),
  letterFill: document.getElementById('letterFill'),
  letterLabel: document.getElementById('letterLabel'),
  bossWrap: document.getElementById('bossWrap'),
  bossKind: document.getElementById('bossKind'),
  bossName: document.getElementById('bossName'),
  bossNum: document.getElementById('bossNum'),
  bossFill: document.getElementById('bossFill'),
  banner: document.getElementById('banner'),
  loc: document.getElementById('loc'),
  mute: document.getElementById('mute'),
  cards: document.getElementById('cards'),
  wait: document.getElementById('wait'),
};
let hpShown = 1, bossShown = 1, scoreShown = 0, bossRef = null;

const DIFFS = [
  ['easy', 'かんたん', '1', '工具が飛ぶ。残機 ' + LIVES.easy],
  ['normal', 'ふつう', '2', '標準ルール。残機 ' + LIVES.normal],
  ['hell', '地獄', '3', '敵が倍。残機 ' + LIVES.hell],
];

function updateHUD(dt) {
  const st = game.stage;
  if (!st) return;
  // タイトルは一枚絵として見せたいので、体力やスコアのカードは出さない
  const onTitle = game.state === 'title';
  hud.cards.style.visibility = onTitle ? 'hidden' : 'visible';
  hud.loc.style.visibility = onTitle ? 'hidden' : 'visible';
  if (onTitle) { hud.bossWrap.classList.remove('show'); hud.wait.classList.remove('show'); return; }
  const p = st.player;
  const t = Math.max(0, p.hp / p.maxhp);
  hpShown += (t - hpShown) * Math.min(1, dt * 8);
  scoreShown += (game.score - scoreShown) * Math.min(1, dt * 6);
  hud.rank.textContent = st.data.playerRank || '';
  const d = DIFFS.find((x) => x[0] === game.difficulty) || DIFFS[1];
  hud.diffchip.textContent = d[1];
  hud.diffchip.className = 'diff ' + game.difficulty;
  hud.hpFill.style.width = (Math.max(0, hpShown) * 100).toFixed(1) + '%';
  hud.hpFill.style.background = hpShown < 0.3 ? '#c73333' : hpShown < 0.6 ? '#e0a030' : '#389451';
  hud.hpNum.textContent = Math.max(0, Math.round(p.hp)) + ' / ' + p.maxhp;
  hud.lives.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < game.lives ? 'on' : ''}"></i>`).join('')
    + (game.lives > 5 ? `<b>${game.lives}</b>` : '');
  // 同期。減ったら戻らないので、空いた枠も残して「減った」ことが見えるようにする
  const n = (game.roster || []).length;
  hud.roster.innerHTML = n
    ? Array.from({ length: Math.max(n, 3) }, (_, i) => `<i class="${i < n ? 'mate' : ''}"></i>`).join('')
    : '<b style="color:#7a8290">—</b>';
  hud.score.textContent = String(Math.round(scoreShown)).padStart(6, '0');

  // 章をまたいで持ち越すゲージ。使わない章では出さない
  const g = st.data.gauges || {};
  hud.gKouki.classList.toggle('off', !g.kouki);
  hud.gGenka.classList.toggle('off', !g.genka);
  hud.gLetter.classList.toggle('off', !g.letter);
  if (g.kouki) hud.koukiFill.style.width = (game.kouki / game.koukiMax * 100).toFixed(1) + '%';
  if (g.genka) hud.genkaFill.style.width = (game.genka / game.genkaMax * 100).toFixed(1) + '%';
  if (g.letter) {
    const full = game.letter >= game.letterMax;
    hud.letterFill.style.width = (game.letter / game.letterMax * 100).toFixed(1) + '%';
    hud.gLetter.classList.toggle('full', full);
    hud.letterLabel.textContent = full ? 'レター（R で撃てる）' : 'レター';
  }

  // ボスのゲージ。L3社のように情報が出てこない相手は「？？？」のまま
  const b = st.boss && st.boss.alive ? st.boss : null;
  const hidden = b && b.hideHpBar && !st.bossBarRevealed;
  setGaugeTarget(b && !hidden ? b : null);
  if (b) {
    const r = Math.max(0, b.hp / b.maxhp);
    if (b !== bossRef) { bossRef = b; bossShown = r; }
    bossShown += (r - bossShown) * Math.min(1, dt * 7);
    hud.bossWrap.classList.add('show');
    hud.bossWrap.classList.toggle('low', !hidden && r <= 0.3);
    hud.bossKind.textContent = 'ボス';
    hud.bossName.textContent = b.typeName;
    hud.bossNum.textContent = hidden ? '情報が出てこない' : Math.max(0, Math.round(b.hp)) + ' / ' + b.maxhp;
    hud.bossFill.style.width = hidden ? '0%' : (Math.max(0, bossShown) * 100).toFixed(1) + '%';
  } else {
    hud.bossWrap.classList.remove('show');
    bossRef = null; bossShown = 1;
  }

  hud.loc.textContent = st.location || st.data.location || '';
  if (st.bannerT > 0 && st.banner) {
    hud.banner.textContent = st.banner;
    hud.banner.classList.add('show');
  } else hud.banner.classList.remove('show');
  // 待合室。敵が出ない代わりに、残工期だけが減っていく時間
  hud.wait.classList.toggle('show', game.state === 'playing' && st.waitT > 0);
}

// ===== 画面 =====
const screenEl = document.getElementById('screen');
function showScreen(html, soft = false) {
  screenEl.innerHTML = html;
  screenEl.className = soft ? 'soft' : '';
  screenEl.style.display = 'flex';
}
function hideScreen() { screenEl.style.display = 'none'; }

const touch = () => Input.controlsActive();
const hint = (t, tt) => `<p class="k">${touch() ? (tt || t) : t}</p>`;

function renderScreen() {
  const i = Math.min(game.chapterIndex, CHAPTERS.length - 1);
  const ch = CHAPTERS[i];
  switch (game.state) {
    case 'title': {
      const cur = DIFFS.find((d) => d[0] === game.difficulty) || DIFFS[1];
      showScreen(`<div class="sheet title">
        <div class="eyebrow">小向工場 工程管理システム　Ver 1.0</div>
        <h1>KOMUKAI QUEST 2</h1>
        <div class="jp">ゴ ー ル デ ン エ イ ジ 編</div>
        <p class="lead">— 後にそう呼ばれる者たちの物語 —</p>
        <div class="diffwrap">
          <div class="difflabel">${touch() ? '① 難易度を選ぶ' : '難易度を選ぶ（押す／1・2・3 キー）'}</div>
          <div class="diffrow">${DIFFS.map(([k, name, key]) =>
            `<button class="dbtn${k === cur[0] ? ' sel' : ''}" data-diff="${k}"><b>${name}</b>${touch() ? '' : `<i>${key} キー</i>`}</button>`).join('')}</div>
          <p class="diffdesc${cur[0] === 'hell' ? ' hell' : ''}">${cur[1]}: ${cur[3]}</p>
        </div>
        ${touch() ? '<button class="startbtn">② ▶ はじめる</button>' : ''}
        ${hint('Enter キー、または上のボタン以外を押して開始（M キーで BGM 入／切）',
               '画面を押すと音が出ます（🔊 で BGM 入／切）')}
      </div>`, true);
      break;
    }
    case 'intro':
      showScreen(`<div class="sheet">
        <div class="eyebrow">作 業 指 示 書</div>
        <table class="form">
          <tr><th>件名</th><td>${ch.name}</td></tr>
          <tr><th>副題</th><td>${ch.subtitle || ''}</td></tr>
          <tr><th>作業場所</th><td>${ch.location || ''}</td></tr>
          <tr><th>等級</th><td>${ch.playerRank || ''}</td></tr>
          <tr><th>指示事項</th><td>${(ch.intro || '').replace(/\n/g, '<br>')}</td></tr>
        </table>
        ${hint('Enter で作業開始', '画面を押して作業開始')}
      </div>`);
      break;
    case 'clear': {
      const done = !!ch.completion;
      showScreen(`<div class="sheet">
        <div class="eyebrow">作 業 報 告 書</div>
        <h2 class="ok">${done ? '完 成' : ch.name + ' 突破'}</h2>
        ${done ? '<p class="lead">納期は遅れた。コストも少し上がった。だが、完成した。</p>' : ''}
        ${ch.clearLine ? `<p class="lead" style="color:#8a6a3a">「${ch.clearLine}」</p>` : ''}
        ${ch.outro ? `<p class="lead" style="font-size:12px;color:#6c737c">${ch.outro.replace(/\n/g, '<br>')}</p>` : ''}
        <table class="form">
          <tr><th>SCORE</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
          <tr><th>同期</th><td>${game.roster.length ? game.roster.map((t) => defFor2(t).name).join('／') : '—'}</td></tr>
        </table>
        ${hint('Enter で次の章へ', '画面を押して次の章へ')}
      </div>`);
      break;
    }
    case 'slope': {
      // 章と章のあいだの「坂」。上がりっぱなしの線を引いて見せる。
      const from = CHAPTERS[game.chapterIndex - 1]?.slope ?? 0;
      const to = ch.slope ?? 0;
      const y = (v) => (88 - v * 62).toFixed(1);
      showScreen(`<div class="sheet">
        <div class="eyebrow">年 次 推 移</div>
        <svg viewBox="0 0 320 100" style="width:100%;height:auto;margin-top:6px" aria-hidden="true">
          <line x1="10" y1="92" x2="310" y2="92" stroke="#d3d8dd" stroke-width="1"/>
          <line x1="10" y1="${y(from)}" x2="310" y2="${y(to)}" stroke="#d2a23c" stroke-width="2.5"
                stroke-linecap="round"/>
          <circle cx="310" cy="${y(to)}" r="4" fill="#1b1e23"/>
        </svg>
        ${game.chapterIndex === 1
          ? '<p class="lead" style="text-align:center">「これから下り坂のない、上り坂の道が、何年か続きます」</p>'
          : '<p class="lead" style="text-align:center;color:#6c737c">坂は、まだ続いている。</p>'}
        ${hint('Enter で次の章へ', '画面を押して次の章へ')}
      </div>`);
      break;
    }
    case 'disband':
      // 時間をかけて1行ずつ出す。2D版が t>0.4 / 1.8 / 3.4 で出していたのに合わせる。
      showScreen(`<div class="sheet">
        <div class="eyebrow">通 知 書</div>
        <h2 class="ng" style="animation:fadein .5s .4s both">契約解除</h2>
        <p class="lead" style="animation:fadein .6s 1.8s both">勝った。だが、何も覆らなかった。</p>
        <p class="lead" style="animation:fadein .6s 3.4s both;color:#6c737c">最後の同期が呼ばれて出ていく。振り返らない。</p>
        <p class="k" style="animation:fadein .6s 5.0s both">${touch() ? '画面を押して先へ' : 'Enter で先へ'}</p>
      </div>`);
      break;
    case 'epilogue':
      showScreen(`<div class="sheet">
        <div class="eyebrow" style="animation:fadein .8s 4.4s both">後に誰かが、あの年次を金の世代と呼んだ。<br>誰が言い出したのかは、もう分からない。</div>
        <svg viewBox="0 0 320 100" style="width:100%;height:auto;margin:10px 0" aria-hidden="true">
          <line x1="10" y1="92" x2="310" y2="92" stroke="#d3d8dd" stroke-width="1"/>
          <line x1="10" y1="88" x2="226" y2="20" stroke="#d2a23c" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p class="lead" style="animation:fadein .6s 1.0s both">下り坂は、一度も来なかった。</p>
        <p class="lead" style="animation:fadein .6s 2.6s both">そして、頂上もなかった。</p>
        <h2 style="animation:fadein .8s 6.2s both;color:var(--accent);text-align:center">— 小向戦士 —</h2>
        <p class="k" style="animation:fadein .8s 6.2s both">${touch() ? '画面を押して 小向クエスト（本編）へ' : 'Enter で 小向クエスト（本編）へ'}</p>
      </div>`);
      break;
    case 'gameover':
      showScreen(`<div class="sheet">
        <div class="eyebrow">離 脱 届</div>
        <h2 class="ng">離 脱</h2>
        <table class="form">
          <tr><th>到達</th><td>${ch.name}</td></tr>
          <tr><th>SCORE</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter でタイトルへ', '画面を押してタイトルへ')}
      </div>`);
      break;
    default:
      hideScreen();
  }
}

// 画面の上のタップ。#screen は canvas を覆っているので、ここで拾って Input に渡す。
screenEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('.dbtn');
  if (btn) { game.difficulty = btn.dataset.diff; renderScreen(); Audio.resume(); return; }
  Audio.resume();
  Input.tapConfirm();
});

// ===== 画面の大きさ =====
let uiScale = 1;
function resize() {
  const box = document.getElementById('stage');
  const w = Math.max(16, box.clientWidth), h = Math.max(9, box.clientHeight);
  uiScale = Math.min(1, Math.max(0.52, w / 1100));
  box.style.setProperty('--u', uiScale.toFixed(3));
  const bar = box.querySelector('.sysbar');
  setHudTop(bar ? Math.round(bar.getBoundingClientRect().bottom - box.getBoundingClientRect().top) + 4 : 8);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = 16 / 9;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

Input.init();
if (Q.get('touch') === '1') Input.forceTouch = true;
Input.initTouch(document.getElementById('c3d'));

// スマホの操作UI。3Dの上に2Dのキャンバスを重ねて、本編と同じ Input.drawControls を呼ぶ。
const padEl = document.getElementById('pad');
const padCtx = padEl.getContext('2d');
function drawPad() {
  if (!Input.controlsActive()) return;
  const bw = Math.round(padEl.clientWidth * Math.min(devicePixelRatio || 1, 2));
  const bh = Math.round(padEl.clientHeight * Math.min(devicePixelRatio || 1, 2));
  if (padEl.width !== bw || padEl.height !== bh) { padEl.width = bw; padEl.height = bh; }
  padCtx.setTransform(bw / 480, 0, 0, bh / 270, 0, 0);
  padCtx.clearRect(0, 0, 480, 270);
  if (game.state === 'playing') Input.drawControls(padCtx);
}

function updateAudio() {
  let track = 'stage';
  if (game.state === 'title') track = 'title';
  else if (game.state === 'disband' || game.state === 'epilogue') track = 'ending';
  else if (game.state === 'gameover') track = 'gameover';
  else if (game.state === 'playing' && game.stage && game.stage.boss && game.stage.boss.alive) track = 'boss';
  Audio.play(track);
}
function renderMute() { hud.mute.textContent = Audio.muted ? '🔇 BGM' : '🔊 BGM'; }
hud.mute.addEventListener('click', () => { Audio.resume(); Audio.toggleMute(); renderMute(); });
renderMute();

// ===== ループ =====
const STEP = 1 / 60;
const SHOT = parseFloat(Q.get('shot') || '0');
let shotDone = false, acc = 0, last = performance.now(), screenKey = null;

function loop(now) {
  if (!shotDone) requestAnimationFrame(loop);
  let frame = (now - last) / 1000; last = now;
  if (!(frame > 0)) frame = 0;
  if (frame > 0.25) frame = 0.25;
  if (SHOT > 0) frame = shotDone ? 0 : Math.min(SHOT, 30);
  acc += frame;
  while (acc >= STEP) {
    game.update(STEP);
    if (Input.pressed('KeyM')) { Audio.toggleMute(); renderMute(); }
    Input.endFrame();
    acc -= STEP;
  }

  // 画面は中身が変わったときだけ書き直す（毎フレーム innerHTML を入れ替えない）
  const key = `${game.state}|${game.chapterIndex}|${game.difficulty}|${Input.controlsActive()}`;
  if (key !== screenKey) {
    screenKey = key;
    renderScreen();
    if (game.state === 'playing') hideScreen();
  }

  const st = game.stage;
  // 章の途中で場面が変わる区間（3D専用のキー）。ボス場面に入ったあとは戻さない。
  if (st && !bossSceneApplied && st.data.scenes3d && !Q.get('scene')) {
    const seg = sceneAt(st.data, st.player.x);
    if (seg.scene !== getScene()) {
      setScene(seg.scene, st.data);
      if (seg.label) { st.banner = seg.label; st.bannerColor = 'rgba(28,58,86,0.92)'; st.bannerT = 2.4; }
    }
  }
  // ボス戦で場面が変わる章（会議室 → 相手の工場 など）
  if (st && st.bossStarted && !bossSceneApplied && st.data.bossBg && !Q.get('scene')) {
    bossSceneApplied = true;
    setScene(st.data.bossBg.scene, st.data);
  }

  // 詠唱の圧と閃光（本編と同じ）
  const cast = st ? st.entities.some((e) => e.alive && e.state === 'cast') : false;
  FX.casting += ((cast ? 1 : 0) - FX.casting) * Math.min(1, frame * 5);
  if (cast) FX.shake = Math.max(FX.shake, 0.5 + FX.casting * 0.9);
  FX.flashT = Math.max(0, FX.flashT - frame * 2.4);
  flashEl.style.opacity = Math.min(0.5, FX.flashT * 1.1 + FX.casting * 0.09).toFixed(3);
  FX.shake = Math.max(0, FX.shake - frame * 4.5);

  syncEntities(frame);
  updateCamera(frame);
  updateHUD(frame);
  renderer.render(scene, camera);
  syncWeapons();
  syncProjectiles();
  updateParts(frame);
  if (domes.length) updateDomes(frame);
  if (flames.length) updateFlames(frame, now / 1000, camera);
  syncLabels();
  syncDoorPlate();
  updateFloats(frame);
  drawPad();
  updateAudio();
  if (SHOT > 0) shotDone = true;
}
requestAnimationFrame(loop);

// 音は最初の操作で鳴り出す（ブラウザの自動再生規制）
const resume = () => Audio.resume();
addEventListener('keydown', resume, { once: true });
addEventListener('pointerdown', resume, { once: true });

// ===== 確認用のURLパラメータ =====
// ?diff=easy|normal|hell … 難易度を指定して始める
{
  const d = Q.get('diff');
  if (d === 'easy' || d === 'normal' || d === 'hell') { game.difficulty = d; game.lives = LIVES[d]; }
}
// ?ch=1..6 … 指定した章から始める（場面の確認用）
{
  const n = parseInt(Q.get('ch') || '0', 10);
  if (n >= 1 && n <= CHAPTERS.length) {
    game.score = 0; game.lives = LIVES[game.difficulty];
    game.kouki = game.koukiMax; game.genka = 0; game.letter = 0;
    game.roster = [];
    game.chapterIndex = n - 1;
    game.loadChapter(n - 1);
    game.state = 'intro'; game.screenT = 0;
  }
}
// ?demo=N … x=N 地点まで進めて波を出す
{
  const d = parseFloat(Q.get('demo') || '0');
  if (d > 0 && game.stage) {
    const st = game.stage;
    game.state = 'playing'; hideScreen();
    st.waitT = 0;
    st.player.x = d;
    st.currentWave = st.data.waves.length;
    st.lockX = st.width - 40;
    let pick = st.data.waves[0];
    for (const w of st.data.waves) if ((w.x || 0) <= d) pick = w;
    st.spawnWave(pick);
    camPos.x = wx(d); camLook.x = wx(d);
  }
}
// ?boss=1 … ボス戦をすぐ始める
if (Q.get('boss') === '1' && game.stage) {
  const st = game.stage;
  game.state = 'playing'; hideScreen();
  st.waitT = 0;
  st.currentWave = st.data.waves.length;
  st.lockX = st.width - 40;
  st.player.x = st.width - 150;
  st.startBoss();
  camPos.x = wx(st.player.x); camLook.x = wx(st.player.x);
}

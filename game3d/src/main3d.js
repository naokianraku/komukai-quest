// 小向クエスト — 3D版のシェル（起動・状態機械・HUD・画面）
//
// ゲームロジックは2D版そのまま。描画は render3d.js（ゴールデンエイジ編と共有）。
// ここが持つのは「どのステージを読むか」「どの画面を出すか」だけ。
import { PLAY, playMid, LIVES, VIEW_W, VIEW_H } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Char } from '../../game/src/entities.js';
import { Stage } from '../../game/src/main.js';
import { STAGES, SHUKKOU_STAGE, URA_STAGE, defFor } from '../../game/src/stages.js';
import { Audio } from '../../game/src/audio.js';
import {
  S, wx, wz, Q, renderer, scene, camera, CAM, camPos, camLook,
  APPEARANCES, SHARD, flames, domes, doorFx, meshes, flashEl, FX,
  box,
  applyScene, sceneAt, buildScenery, buildTitleScenery, clearStageObjects,
  getScene, setScene, setStage, setGame, setGaugeTarget, setHudTop,
  addFloat, burst, meteorBoom,
  syncEntities, syncWeapons, syncProjectiles, syncLabels, syncDoorPlate,
  updateCamera, updateFlames, updateParts, updateDomes, updateFloats,
} from './render3d.js';


// ===== ゲーム本体（ロジックは2D版そのまま）=====
const game = {
  difficulty: 'normal', score: 0, lives: LIVES.normal, over: false, specialUsed: false,
  state: 'title', stageIndex: 0, screenT: 0,
  toGameOver() { this.state = 'gameover'; this.screenT = 0; },
};
let stage = new Stage(STAGES[0], game);
setGame(game); setStage(stage);
buildTitleScenery(STAGES[0].width);

// 打撃フック: ヒットストップ＋カメラシェイク（案D）。値は描画側の FX に持たせてある
let bossSceneApplied = false;
const origHit = stage.fx.hit.bind(stage.fx);
stage.fx.hit = (x, y, color) => { origHit(x, y, color); FX.hitstop = 0.06; FX.shake = 1.1; burst(x, y, color); };
// ボスを倒した瞬間。通常のヒットより長く止めて、強く揺らす。
// 倒したのに画面が静かだとあっけないので、手応えはここで出す。
const origBoom = stage.fx.boom.bind(stage.fx);
stage.fx.boom = (x, y) => { origBoom(x, y); FX.hitstop = 0.22; FX.shake = 2.6; burst(x, y, '#ffd24a'); };
// ダメージ数字は2D用のテキストではなく、投影したDOMで出す
const origText = stage.fx.text.bind(stage.fx);
stage.fx.text = (x, y, str, color) => { origText(x, y, str, color); addFloat(x, y, 0, str, color); };
// 投げ物が砕けるのも3Dの粒子で出す（音と2D側の破片は fx 本体が受け持つ）
const origShatter = stage.fx.shatter.bind(stage.fx);
stage.fx.shatter = (x, y, look) => { origShatter(x, y, look); FX.shake = Math.max(FX.shake, 0.7); burst(x, y, SHARD[look] || SHARD.sake); };
// メテオ着弾。揺らして赤く光らせる
const origMeteor = stage.fx.meteor.bind(stage.fx);
stage.fx.meteor = (x, y, r) => { origMeteor(x, y, r); meteorBoom(x, y, r); };

function attachStage(st, data) {
  clearStageObjects();
  bossSceneApplied = false;
  stage = st; setStage(st);
  const origHit2 = stage.fx.hit.bind(stage.fx);
  stage.fx.hit = (x, y, color) => { origHit2(x, y, color); FX.hitstop = 0.06; FX.shake = 1.1; burst(x, y, color); };
  const origText2 = stage.fx.text.bind(stage.fx);
  stage.fx.text = (x, y, str, color) => { origText2(x, y, str, color); addFloat(x, y, 0, str, color); };
  const origShatter2 = stage.fx.shatter.bind(stage.fx);
  stage.fx.shatter = (x, y, look) => { origShatter2(x, y, look); FX.shake = Math.max(FX.shake, 0.7); burst(x, y, SHARD[look] || SHARD.sake); };
  const origMeteor2 = stage.fx.meteor.bind(stage.fx);
  stage.fx.meteor = (x, y, r) => { origMeteor2(x, y, r); meteorBoom(x, y, r); };
  stage.player.ranged = (game.difficulty === 'easy');   // 2D版の applyDifficulty と同じ
  buildScenery(data);
  camPos.set(wx(stage.player.x), CAM.height, wz(stage.player.y) + CAM.dist);
  camLook.set(wx(stage.player.x), CAM.lookY, wz(stage.player.y) - 3);
}

function loadStage(i) { attachStage(new Stage(STAGES[i], game), STAGES[i]); }

// 「出向」の扉 → 関連会社サブステージ。クリアで本社（Stage3）へ帰還する。
let savedStage = null;
function enterDetour() {
  const hp = stage.player.hp;
  savedStage = stage;
  const st = new Stage(SHUKKOU_STAGE, game);
  st.isDetour = true;
  attachStage(st, SHUKKOU_STAGE);
  stage.player.hp = Math.max(5, Math.min(hp, stage.player.maxhp));   // HPを引き継ぐ
  game.state = 'intro'; game.screenT = 0; renderScreen();
}
function returnFromDetour() {
  const hp = stage.player.hp;
  const back = savedStage; savedStage = null;
  back.player.hp = Math.max(5, hp);
  back.player.x = back.door.x + 34;      // 扉の先へ
  back.player.invuln = 1.4;
  back.detourRequested = false;
  attachStage(back, back.data);
  back.banner = '出向先を制圧！' + (back.data.location || '本社') + 'へ帰還';
  back.bannerColor = 'rgba(22,42,74,0.92)'; back.bannerT = 2.6;
  game.state = 'playing'; hideScreen();
}
// 事業部長を倒した“その先”——業火の裏ステージへ（帰還なし。クリアでエンディング）
function enterTrueFinal() {
  const st = new Stage(URA_STAGE, game);
  attachStage(st, URA_STAGE);
  stage.player.hp = stage.player.maxhp;  // 真の最終決戦は全快で
  game.state = 'intro'; game.screenT = 0; renderScreen();
}

// ===== HUD（案A: 高解像度レイヤー / 案B: 社内システムの語彙）=====
const hud = {
  rank: document.getElementById('rank'),
  diffchip: document.getElementById('diffchip'),
  hpFill: document.getElementById('hpFill'),
  hpNum: document.getElementById('hpNum'),
  lives: document.getElementById('lives'),
  special: document.getElementById('special'),
  score: document.getElementById('score'),
  bossWrap: document.getElementById('bossWrap'),
  bossKind: document.getElementById('bossKind'),
  bossName: document.getElementById('bossName'),
  bossNum: document.getElementById('bossNum'),
  bossFill: document.getElementById('bossFill'),
  banner: document.getElementById('banner'),
  loc: document.getElementById('loc'),
  mute: document.getElementById('mute'),
  cards: document.getElementById('cards'),
};
let hpShown = 1, bossShown = 1, scoreShown = 0;
// 下のゲージに出している相手。頭上バーと二重にしないため syncLabels から見る
let bossRef = null;
function updateHUD(dt) {
  // タイトルは一枚絵として見せたいので、稼働率や評価ポイントのカードは出さない
  const onTitle = game.state === 'title';
  hud.cards.style.visibility = onTitle ? 'hidden' : 'visible';
  hud.loc.style.visibility = onTitle ? 'hidden' : 'visible';
  if (onTitle) { hud.bossWrap.classList.remove('show'); return; }
  const p = stage.player;
  hpShown += ((p.hp / p.maxhp) - hpShown) * Math.min(1, dt * 7);   // バーを補間（案D）
  scoreShown += (game.score - scoreShown) * Math.min(1, dt * 6);
  hud.rank.textContent = stage.data.playerRank;
  // 今どの難易度で遊んでいるか。タイトルでしか分からないと確認しようがない
  const dd = DIFFS.find((d) => d[0] === game.difficulty) || DIFFS[1];
  hud.diffchip.textContent = dd[1];
  hud.diffchip.className = 'diff ' + dd[0];
  hud.hpFill.style.width = (hpShown * 100).toFixed(1) + '%';
  hud.hpFill.style.background = hpShown < 0.3 ? '#c73333' : hpShown < 0.6 ? '#e0a030' : '#389451';
  hud.hpNum.textContent = Math.max(0, Math.round(p.hp)) + ' / ' + p.maxhp;
  // 有休残は点で出す。点は5つ＝ふつうの持ち玉ぶんで、かんたんの24日は並べきれないので、
  // 5を超えているあいだだけ日数を横に添える（点が振り切れたまま動かないのを避ける）。
  hud.lives.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<i class="${i < game.lives ? 'on' : ''}"></i>`).join('')
    + (game.lives > 5 ? `<b>${game.lives}</b>` : '');
  hud.special.className = 'kbadge' + (game.specialUsed ? ' used' : '');
  hud.score.textContent = String(Math.round(scoreShown)).padStart(6, '0');

  // ボスと中ボスのゲージ。中ボス（管理担当K・生産企画課長）は stage.boss ではないので、
  // ここで拾わないと「ゲージが1本も出ない強敵」になる。
  const b = (stage.bossStarted && stage.boss && stage.boss.alive) ? stage.boss
    : stage.entities.find((e) => e.alive && e.midboss && e.team === 'enemy') || null;
  const gt = b && !b.hideHpBar ? b : null;
  setGaugeTarget(gt);
  if (gt) {
    const t = Math.max(0, b.hp / b.maxhp);
    if (b !== bossRef) { bossRef = b; bossShown = t; }   // 相手が替わったら補間をやり直す
    bossShown += (t - bossShown) * Math.min(1, dt * 7);
    hud.bossWrap.classList.add('show');
    hud.bossWrap.classList.toggle('low', t <= 0.3);
    hud.bossKind.textContent = b.isBoss ? 'ボス' : '中ボス';
    hud.bossName.textContent = b.typeName;
    hud.bossNum.textContent = Math.max(0, Math.round(b.hp)) + ' / ' + b.maxhp;
    hud.bossFill.style.width = (Math.max(0, bossShown) * 100).toFixed(1) + '%';
  } else {
    hud.bossWrap.classList.remove('show');
    bossRef = null; bossShown = 1;
  }
  hud.loc.textContent = stage.data.location || '';
  if (stage.bannerT > 0 && stage.banner) {
    hud.banner.textContent = stage.banner;
    hud.banner.classList.add('show');
  } else hud.banner.classList.remove('show');
}

// ===== 画面（案B: 社内システムの語彙で統一）=====
const screenEl = document.getElementById('screen');
// soft=true … 背景（タイトルの正門）を見せるため暗幕を薄くする
// ?nosheet=1 … 書類を出さない（タイトルの背景の構図を確認する開発用）
function showScreen(html, soft = false) {
  if (Q.get('nosheet')) { screenEl.style.display = 'none'; return; }
  screenEl.innerHTML = html;
  screenEl.classList.toggle('soft', soft);
  screenEl.style.display = 'flex';
}
function hideScreen() { screenEl.style.display = 'none'; }

// 書類（#screen）は canvas の上に重なっているので、ここへのタップは Input に届かない。
// スマホだと難易度も選べず開始もできないため、クリック/タップをここで拾う。
let screenTap = false;
const DIFFS = [
  ['easy',   'かんたん', '1', `残機多め（有休 ${LIVES.easy}）＋自分も飛び道具`],
  ['normal', 'ふつう',   '2', `標準ルール（有休 ${LIVES.normal}）`],
  ['hell',   '地獄',     '3', `雑魚が2倍＋残機少なめ（有休 ${LIVES.hell}）`],
];
screenEl.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-diff]');
  if (b) { game.difficulty = b.dataset.diff; renderScreen(); return; }
  // ブラウザは最初のユーザー操作がないと音を鳴らせない。タイトルで「どこを押しても開始」に
  // していると、スマホでは最初のタップが音の解禁と開始を兼ねてしまい、
  // オープニングのファンファーレが一度も鳴らないまま場面が変わる。
  // 指で遊ぶ端末のタイトルだけは「はじめる」を押したときに限って開始する。
  // 空振りのタップは音を解禁するだけなので、そこでファンファーレが鳴り出す。
  if (Input.controlsActive() && game.state === 'title' && !ev.target.closest('.startbtn')) {
    Audio.resume();
    return;
  }
  screenTap = true;
});
const confirmed = () => Input.confirm || screenTap;

// 画面下の案内。指で遊ぶ端末に「Enter キー」と出しても押せないので、言い回しを変える。
const hint = (t, touch) => `<p class="k">${Input.controlsActive() ? (touch || t) : t}</p>`;
function renderScreen() {
  // 出向・裏ステージは STAGES に入っていないので、今読み込んでいるステージのデータを使う
  const ch = (stage && stage.data) || STAGES[game.stageIndex];
  switch (game.state) {
    case 'title': {
      const cur = DIFFS.find((d) => d[0] === game.difficulty) || DIFFS[1];
      // 指で遊ぶ端末では、キーの名前を出しても押すものが無い。
      // 「どこか押せば始まる」は伝わらないので、押すものをはっきり置く。
      const touch = Input.controlsActive();
      showScreen(`<div class="sheet title">
        <div class="eyebrow">小向工場 業務支援システム　Ver 2.4</div>
        <h1>KOMUKAI QUEST</h1>
        <div class="jp">小 向 ク エ ス ト</div>
        <p class="lead">小向戦士となり、小向工場を生き残れ。</p>
        <div class="diffwrap">
          <div class="difflabel">${touch ? '① 難易度を選ぶ' : '難易度を選ぶ（押す／← → キー／1・2・3 キー）'}</div>
          <div class="diffrow">${DIFFS.map(([k, name, key]) =>
            `<button class="dbtn${k === cur[0] ? ' sel' : ''}" data-diff="${k}"><b>${name}</b>${touch ? '' : `<i>${key} キー</i>`}</button>`).join('')}</div>
          <p class="diffdesc${cur[0] === 'hell' ? ' hell' : ''}">${cur[1]}: ${cur[3]}</p>
        </div>
        ${touch ? '<button class="startbtn">② ▶ はじめる</button>' : ''}
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
          <tr><th>作業場所</th><td>${ch.location || ''}</td></tr>
          <tr><th>等級</th><td>${ch.playerRank}</td></tr>
          <tr><th>難易度</th><td>${(DIFFS.find((d) => d[0] === game.difficulty) || DIFFS[1])[1]}　<span style="color:#6c737c">${(DIFFS.find((d) => d[0] === game.difficulty) || DIFFS[1])[3]}</span></td></tr>
          <tr><th>指示事項</th><td>${(ch.intro || '').replace(/\n/g, '<br>')}</td></tr>
        </table>
        ${hint('Enter で作業開始', '画面を押して作業開始')}
      </div>`);
      break;
    case 'clear':
      showScreen(`<div class="sheet">
        <div class="eyebrow">作 業 報 告 書</div>
        <h2 class="ok">提出完了</h2>
        <table class="form">
          <tr><th>件名</th><td>${ch.name}</td></tr>
          <tr><th>結果</th><td>所定の作業を完了した</td></tr>
          <tr><th>評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter で次の作業へ', '画面を押して次の作業へ')}
      </div>`);
      break;
    case 'gameover':
      showScreen(`<div class="sheet">
        <div class="eyebrow">休 職 願</div>
        <h2 class="ng">稼働率 0%</h2>
        <table class="form">
          <tr><th>事由</th><td>組織に敗れたため</td></tr>
          <tr><th>評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter でタイトルへ', '画面を押してタイトルへ')}
      </div>`);
      break;
    case 'ending':
      showScreen(`<div class="sheet">
        <div class="eyebrow">辞 令</div>
        <h2>小 向 司 令 官</h2>
        <p class="lead">数々の困難と理不尽、そして裏切りを越え、小向の頂点に立った。</p>
        <table class="form">
          <tr><th>最終評価ポイント</th><td class="mono">${String(game.score).padStart(6, '0')}</td></tr>
        </table>
        ${hint('Enter でタイトルへ', '画面を押してタイトルへ')}
      </div>`);
      break;
    default: hideScreen();
  }
}

// ===== ループ =====
// HUDと頭上の文字の倍率。1100px幅の箱を基準にして、箱が小さいぶんだけ一緒に縮める。
// 画面幅で判定してはいけない: 横持ちのスマホは画面が874pxあっても、16:9の箱は
// 高さに縛られて663pxしかない。文字だけ原寸のまま残ると箱からあふれる。
let uiScale = 1;
// セリフを置いてよい上限（システムバーの下）。毎フレーム測ると再レイアウトが走るので
// resize のときだけ測る。#labels と同じ #stage の中にあるので、この差がそのまま座標になる。

function resize() {
  const box = document.getElementById('stage');
  const w = Math.max(16, box.clientWidth), h = Math.max(9, box.clientHeight);
  uiScale = Math.min(1, Math.max(0.52, w / 1100));
  box.style.setProperty('--u', uiScale.toFixed(3));
  const bar = box.querySelector('.sysbar');
  setHudTop(bar ? Math.round(bar.getBoundingClientRect().bottom - box.getBoundingClientRect().top) + 4 : 8);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = 16 / 9;   // 枠自体が16:9なので固定（2D版と画角を揃えるため）
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

Input.init();
// ?touch=1 … パソコンでもタッチ操作UIを出す（配置の確認用。2D版と同じ指定）
if (Q.get('touch') === '1') Input.forceTouch = true;
Input.initTouch(document.getElementById('c3d'));

// スマホの操作UI。2D版は canvas に直接描いているが、3D版には描く場所が無かったので、
// 3Dの上に2Dのキャンバスを重ねて同じ Input.drawControls を呼ぶ。これが無いと、
// 押す場所が一切見えないまま「どこを触っても何も起きない」ように見える。
const padEl = document.getElementById('pad');
const padCtx = padEl.getContext('2d');
function drawPad() {
  if (!Input.controlsActive()) return;   // キーボードの端末では一切触らない
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const bw = Math.max(1, Math.round(padEl.clientWidth * dpr));
  const bh = Math.max(1, Math.round(padEl.clientHeight * dpr));
  if (padEl.width !== bw || padEl.height !== bh) { padEl.width = bw; padEl.height = bh; }
  padCtx.setTransform(bw / VIEW_W, 0, 0, bh / VIEW_H, 0, 0);
  padCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (game.state === 'playing') Input.drawControls(padCtx);
}
hud.mute.addEventListener('click', () => { Audio.resume(); Audio.toggleMute(); renderMute(); });
renderMute();
addEventListener('keydown', () => Audio.resume(), { once: true });
addEventListener('pointerdown', () => Audio.resume(), { once: true });

// BGM。2D版の Game.updateAudio と同じ割り当て。Audio.play は同じ曲なら何もしないので毎フレーム呼べる。
function updateAudio() {
  let track = 'stage';
  if (game.state === 'title') track = 'title';
  else if (game.state === 'ending') track = 'ending';
  else if (game.state === 'gameover') track = 'gameover';
  // 裏ステージは業火の中なので、道中からボス戦までずっと地獄の曲でいく
  else if (game.state === 'playing' && stage && stage.data.id === 'ura') track = 'hell';
  else if (game.state === 'playing' && stage && stage.boss && stage.boss.alive) track = 'boss';
  Audio.play(track);
}

// ミュートの表示を実際の状態に合わせる
function renderMute() {
  hud.mute.textContent = Audio.muted ? '🔇 BGM' : '🔊 BGM';
  hud.mute.classList.toggle('off', Audio.muted);
}

const STEP = 1 / 60;
// ?shot=秒 … その秒数ぶんまとめて進めて1枚だけ描き、ループを止める。
// 描き続けているとヘッドレスブラウザの仮想時間が終わらずスクリーンショットが撮れない。
const SHOT = parseFloat(new URLSearchParams(location.search).get('shot') || '0');
let shotDone = false;
let acc = 0, last = performance.now();
function loop(now) {
  if (!shotDone) requestAnimationFrame(loop);
  let frame = (now - last) / 1000; last = now;
  if (!(frame > 0)) frame = 0;        // 負 / NaN を潰す（補間の発散を防ぐ）
  if (frame > 0.25) frame = 0.25;     // スパイラル防止
  if (SHOT > 0) frame = shotDone ? 0 : Math.min(SHOT, 30);
  acc += frame;
  try {
  while (acc >= STEP) {
    game.screenT += STEP;
    // タッチのフローティングスティックはプレイ中だけ出す（メニューでの誤作動を防ぐため）。
    // 2D版は Game.update で立てている。3D版は game オブジェクトが別なので、ここで立てないと
    // スマホで一歩も動けない（攻撃と跳躍だけ効く）状態になる。
    Input.gameplayActive = game.state === 'playing';
    // 奥の手（スマホは画面の「Ｋ」ボタン / PCは L キー）。1周につき1回だけ。
    Input.specialReady = !game.specialUsed && Input.gameplayActive;
    if (Input.special) { game.specialUsed = true; stage.callKta(); }
    switch (game.state) {
      case 'title': {
        const step = (Input.pressed('ArrowRight', 'KeyD') ? 1 : 0) - (Input.pressed('ArrowLeft', 'KeyA') ? 1 : 0);
        if (step) {
          const i = DIFFS.findIndex((d) => d[0] === game.difficulty);
          game.difficulty = DIFFS[Math.min(DIFFS.length - 1, Math.max(0, (i < 0 ? 1 : i) + step))][0];
        }
        if (Input.pressed('Digit1')) game.difficulty = 'easy';
        if (Input.pressed('Digit2')) game.difficulty = 'normal';
        if (Input.pressed('Digit3')) game.difficulty = 'hell';
        if (confirmed()) {
          Audio.resume();
          game.score = 0;
          game.lives = LIVES[game.difficulty];
          game.specialUsed = false;   // 奥の手は1周につき1回
          game.stageIndex = 0; loadStage(0);
          game.state = 'intro'; game.screenT = 0; renderScreen();
        } else if (step || Input.pressed('Digit1', 'Digit2', 'Digit3')) renderScreen();
        break;
      }
      case 'intro':
        if (game.screenT > 0.4 && confirmed()) { game.state = 'playing'; hideScreen(); }
        break;
      case 'playing':
        if (FX.hitstop > 0) FX.hitstop -= STEP;        // 打撃の手応え（案D）
        else stage.update(STEP);
        // ?atk=1 … 空振り / ?atk=2 … 命中の瞬間 を固定する（開発用）
        // 向きは固定しない（固定すると左へ攻撃できなくなる）
        if (Q.get('atk')) {
          stage.player.attackActive = true;
          // 閃光は hitSet が空でないときだけ出る。2 なら中身を入れて命中扱いにする
          stage.player.attack = { reach: 0, dmg: 0, kb: 0, hitSet: new Set(Q.get('atk') === '2' ? [-1] : []) };
        }
        if (stage.detourRequested && !stage.isDetour) {
          enterDetour();                         // 「出向」の扉に触れた → 関連会社へ
        } else if (stage.cleared) {
          if (stage.isDetour) {
            returnFromDetour();                  // 関連会社を制圧 → 本社(Stage3)へ帰還
          } else if (stage.data.trueFinal) {
            enterTrueFinal();                    // 事業部長撃破 → 業火の裏ステージへ
          } else {
            game.state = game.stageIndex >= STAGES.length - 1 ? 'ending' : 'clear';
            game.screenT = 0; renderScreen();
          }
        }
        break;
      case 'clear':
        if (game.screenT > 0.5 && confirmed()) {
          game.stageIndex++; loadStage(game.stageIndex);
          game.state = 'intro'; game.screenT = 0; renderScreen();
        }
        break;
      case 'gameover':
      case 'ending':
        if (game.screenT > 0.6 && confirmed()) {
          game.state = 'title'; game.screenT = 0;
          stage = new Stage(STAGES[0], game);   // 自機を門前に立たせ直す
          buildTitleScenery(); renderScreen();
        }
        break;
    }
    if (Input.pressed('KeyM')) { Audio.toggleMute(); renderMute(); }   // どの画面でもMでミュート
    Input.endFrame(); screenTap = false;
    acc -= STEP;
  }
  // 区間で場面が変わるステージ（執務室→食堂→執務室 / 会議フロア→構内道路）。
  // ボス場面に入ったあとは戻さない。
  if (!bossSceneApplied && stage.data.scenes3d && !Q.get('scene')) {
    const seg = sceneAt(stage.data, stage.player.x);
    if (Q.get('dbg') === '1' && !window.__segdbg) { window.__segdbg = 1; window.__dbg &&
      window.__dbg('SEG x=' + stage.player.x.toFixed(0) + ' cur=' + getScene() + ' -> ' + seg.scene +
                   ' segs=' + JSON.stringify(stage.data.scenes3d)); }
    if (seg.scene !== getScene()) {
      setScene(seg.scene, stage.data);
      if (seg.label) {
        stage.banner = seg.label;
        stage.bannerColor = 'rgba(28,58,86,0.92)';
        stage.bannerT = 2.4;
      }
    }
  }

  // ボス戦で場面が変わるステージ（工場長＝構内の稲荷社）。
  // Stage は本編のものをそのまま使っているため startBoss は書き換えず、
  // ここで bossStarted の立ち上がりを拾って背景だけ差し替える。
  if (stage.bossStarted && !bossSceneApplied && stage.data.bossScene
      && !new URLSearchParams(location.search).get('scene')) {
    bossSceneApplied = true;
    setScene(stage.data.bossScene, stage.data);
    stage.banner = stage.data.bossLocation || '';
    stage.bannerColor = 'rgba(150,40,20,0.92)';
    stage.bannerT = 3.0;
  }

  updateAudio();
  if (flames.length) updateFlames(frame, now / 1000, camera);
  if (doorFx.length) {
    const o = 0.62 + 0.38 * Math.sin(now / 1000 * 3.2);
    for (const m of doorFx) m.material.opacity = m.userData.amp * o;
  }
  if (domes.length) updateDomes(frame);
  // 詠唱中は床の印に加えて画面全体をうっすら赤くし、揺らして圧をかける
  const cast = stage.entities.some((e) => e.alive && e.state === 'cast');
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
  syncLabels();
  syncDoorPlate();
  drawPad();   // 固定ステップの中ではなく、描画1回につき1回でよい
  updateFloats(frame);
  if (!window.__once && Q.get('dbg') === '1') { window.__once = 1; window.__dbg && window.__dbg(
    'OK frame1 / meshes=' + meshes.size + ' / children=' + scene.children.length +
    ' / cam=' + camera.position.toArray().map(n=>n.toFixed(1)).join(',') +
    ' / look=' + camLook.toArray().map(n=>n.toFixed(1)).join(',')); }
  } catch (e) { window.__dbg && window.__dbg('LOOP: ' + (e.stack || e.message)); throw e; }
  // 武器や投擲物は render の後に同期しているので、1フレーム目には写らない。
  // ?shot では2フレーム目まで描いてから止める。
  if (SHOT > 0) { if (window.__shot1) shotDone = true; window.__shot1 = 1; }
}
renderScreen();
requestAnimationFrame(loop);

// ?cast=1 … 主要キャラを一列に並べて見るビュー（作業着・帽子など見た目の確認用）
if (new URLSearchParams(location.search).get('cast') === '1') {
  const { defFor2 } = await import('../../game2/src/stages2.js');
  const { registerPalettes, registerTypeMeta } = await import('../../game/src/sprites.js');
  const g2 = await import('../../game2/src/stages2.js');
  registerPalettes(g2.PALETTES2); registerTypeMeta(g2.LABELS2, g2.COLORS2);
  for (const e of [...stage.entities]) if (e !== stage.player) e.alive = false;
  stage.sweepDead();
  const cast = [
    ['1', 'ally'], ['1', 'buka'], ['1', 'senpai'], ['1', 'staff'], ['1', 'dr'],
    ['2', 'douki_sekkei'], ['2', 'douki_genba'], ['2', 'douki_hinsho'],
    ['2', 'gr_seizo'], ['2', 'm_kikai'], ['1', 'kyaku'],
    // 中ボスも並べる。見分けがつくか（特に管理担当Kとその息子）をここで確かめられる
    ['1', 'kanrik'], ['1', 'kanrik_son'], ['1', 'seikikaku'],
  ];
  const baseX = stage.player.x + 46;
  cast.forEach(([which, type], i) => {
    const def = which === '1' ? defFor(type) : defFor2(type);
    const c = new Char(baseX + i * 34, playMid(), { ...def, team: 'mob', passive: true });
    stage.entities.push(c);
  });
  stage.currentWave = 99; stage.lockX = stage.width - 40;
  game.state = 'playing'; hideScreen();
}

// ?looks=1 … 同じ役職の20体を並べて、個体差だけを見るビュー
if (new URLSearchParams(location.search).get('looks') === '1') {
  for (const e of [...stage.entities]) if (e !== stage.player) e.alive = false;
  stage.sweepDead();
  const baseX = stage.player.x + 40;
  APPEARANCES.forEach((t, i) => {
    const row = i % 10, col = (i / 10) | 0;
    const c = new Char(baseX + row * 30, PLAY.top + col * 70, { ...defFor('buka'), team: 'mob', passive: true });
    c._v = { hair: t[0], glasses: t[1], beard: t[2], skin: t[3], hairColor: t[4], build: t[5] };
    stage.entities.push(c);
  });
  stage.currentWave = 99; stage.lockX = stage.width - 40;
  game.state = 'playing'; hideScreen();
}

// ?diff=easy|normal|hell … 難易度を指定して始める（場面へ直接飛ぶときの確認用）。
// タイトルを通らないと既定の「ふつう」のままになるため、ここで残機ごと合わせる。
{
  const d = Q.get('diff');
  if (d === 'easy' || d === 'normal' || d === 'hell') {
    game.difficulty = d;
    game.lives = LIVES[d];
  }
}

// ?stage=N … 第Nステージから始める（場面の確認用）
{
  const sg = new URLSearchParams(location.search).get('stage') || '';
  if (sg === 'shukkou') { const st = new Stage(SHUKKOU_STAGE, game); st.isDetour = true; attachStage(st, SHUKKOU_STAGE); }
  else if (sg === 'ura') attachStage(new Stage(URA_STAGE, game), URA_STAGE);
  else if (+sg >= 1 && +sg <= STAGES.length) { game.stageIndex = +sg - 1; loadStage(+sg - 1); }
}

// ?demo=N … 指定x地点まで進めて波を出す（スクリーンショット確認用）
{
  const d = parseFloat(new URLSearchParams(location.search).get('demo') || '0');
  if (d > 0) {
    game.state = 'playing'; hideScreen();
    stage.player.x = d;
    if (stage.data.bossJoinsAfter != null) {
      // 裏ステージは「5人衆が出てしばらくすると魔王が降りてくる」進行そのものが見どころ。
      // 波を飛ばすと魔王が降りてこないので、ここだけ通常どおり進ませる（歩けば波が出る）。
      stage.lockX = stage.data.waves[0].x;
    } else {
      // 進行ロック(lockX)を外してから移動する。Player.update が maxX=lockX で引き戻すため、
      // 外さないと指定した地点までカメラが行かない。
      stage.currentWave = stage.data.waves.length;
      stage.lockX = stage.width - 40;
      // 指定地点にいちばん近い波を出す。常に waves[0] だと中ボスの波が確認できない
      let pick = stage.data.waves[0];
      for (const w of stage.data.waves) if ((w.x || 0) <= d) pick = w;
      stage.spawnWave(pick);
    }
    camPos.x = wx(d); camLook.x = wx(d);
  }
}

// ?boss=1 … ボス戦をすぐ始める（ゲージと場面の確認用）
if (Q.get('boss') === '1') {
  game.state = 'playing'; hideScreen();
  stage.currentWave = stage.data.waves.length;
  stage.lockX = stage.width - 40;
  stage.player.x = stage.width - 150;
  stage.startBoss();
  camPos.x = wx(stage.player.x); camLook.x = wx(stage.player.x);
}

// ?meteor=1 … 魔王のメテオをすぐ撃たせる（印と着弾の確認用）。間合いは開けておく。
if (Q.get('meteor') === '1') {
  game.state = 'playing'; hideScreen();
  stage.currentWave = stage.data.waves.length;
  stage.lockX = stage.width - 40;
  stage.player.x = stage.width - 150;
  stage.startBoss();
  if (stage.boss) {
    stage.boss.x = stage.player.x + 230;
    if (stage.boss.meteorDef) stage.boss.meteorT = 0.8;
  }
  camPos.x = wx(stage.player.x); camLook.x = wx(stage.player.x);
}

// デバッグ: ボスまで一気に進める
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') { stage.player.x = stage.width - 230; stage.currentWave = 99; }
});

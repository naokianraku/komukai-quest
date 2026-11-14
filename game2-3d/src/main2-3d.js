// 小向クエスト2 ゴールデンエイジ編 — 3D版のシェル（起動・状態機械・HUD・画面）
//
// ゲームロジックは2D版（game2/src/main2.js）の Game2 / Stage2 をそのまま使う。
// 描画は本編の3D版と同じ render3d.js。ここが持つのは
// 「章をどう読み込むか」「HUDに何を出すか」「どの画面を出すか」だけ。
import { LIVES, PLAY } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { Audio } from '../../game/src/audio.js';
import { registerPalettes, registerTypeMeta } from '../../game/src/sprites.js';
import { CHAPTERS, PALETTES2, LABELS2, COLORS2, defFor2 } from '../../game2/src/stages2.js';
import { Game2, Stage2 } from '../../game2/src/main2.js';
import {
  THREE, wx, wz, Q, renderer, scene, camera, CAM, camPos, camLook,
  SHARD, flames, domes, flashEl, FX, meshes,
  buildScenery, clearStageObjects, sceneAt, getScene, setScene,
  setStage, setGame, setGaugeTarget, setHudTop, sceneEvent, buildTitleScenery,
  addFloat, burst, meteorBoom,
  syncEntities, syncWeapons, syncProjectiles, syncLabels, syncDoorPlate,
  updateCamera, updateFlames, updateParts, updateDomes, updateFloats,
} from '../../game3d/src/render3d.js';
import { loadSequelScenes } from './scenes2.js';
import { registerChars2 } from './chars2.js';

// 続編の役職パレットと名札を先に登録する。voxel.js は sprites.js の CHAR_PALETTES を
// 直接読むので、これを忘れると続編のキャラが全員「部下」の見た目で出てくる。
registerPalettes(PALETTES2);
registerTypeMeta(LABELS2, COLORS2);
registerChars2();   // 顔の固定・持ち物・第1章の着替え（chars2.js）

// ===== ゲーム本体 =====
// 2D版の Game2 をそのまま継承する。違うのは
//  ・章を読み込んだら3Dの場面も張り替える
//  ・打撃のヒットストップ中はステージを進めない
//  ・エピローグの行き先が3D版の本編
// の3点だけ。進行そのもの（同期の加入・離脱、残工期、レター）は2D版と同じものが動く。
class Game2_3D extends Game2 {
  constructor() {
    super();
    // エピローグのあと本編へ。アプリの中なら app=1 を引き継ぐ（落とすと本編に枠が出る）。
    // ほかのクエリ（ch や demo）は本編では別の意味になるので持っていかない。
    this.exitHref = Q.has('app') ? '../game3d/index.html?app=1' : '../game3d/';
  }

  loadChapter(i) {
    super.loadChapter(i);
    attach(this.stage, CHAPTERS[i]);
  }

  update(dt) {
    const before = this.state;
    // 打撃の手応え。止めている間はステージを進めないが、画面の状態遷移は進める
    this.hitstopStep = this.state === 'playing' && !this.paused && FX.hitstop > 0;
    if (this.hitstopStep) {
      FX.hitstop -= dt;
      const st = this.stage;
      st.update = () => {};
      try { super.update(dt); } finally { delete st.update; }
    } else {
      super.update(dt);
    }
    holdForDown(this, before);
    // 離脱届からタイトルへ戻ったら、負けた章の敵や同期を片付けて第1章を置き直す（起動したときと同じ）。
    // そのままだと、タイトルの絵の中に負けた章の敵が立ったまま残る。
    if (before !== 'title' && this.state === 'title') {
      this.roster = [];
      this.stage = new Stage2(CHAPTERS[0], this);
      attach(this.stage, CHAPTERS[0]);
      enterTitleScene();
    }
  }
}

// ===== 撃破の間（3D版だけ） =====
// 続編のボスは捨てセリフ（lastLine）を持たないので、2D版と同じく倒した瞬間に報告書が出る。
// 3Dではそれだと、ボスが崩れる絵も、場面が撃破で変わるところ（講堂の棚のヘルメットが配属色に
// 変わる、など）も、報告書の暗幕に隠れて見えない。そこで3D版だけ、最後の一撃のあと本編のボスと
// 同じ「倒れかけ」（膝から崩れて瓦礫になる）を挟んでから報告書へ進む。
// 吹き出しには、その章の報告書に載る一言（clearLine。既存の文言）をそのまま出す。新しい文は足さない。
// 作り直しの残りがある（第5章でまだ復活する）ときは挟まない。
const DOWN_SEC = 3.2;
const DOWN_SEC_HAND = 4.6;
// 握手のカット（支援の章）。倒して0.5秒後に暗転し、暗いうちに主担当をボスの正面へ、主人公をその後ろへ置いて明ける。
// 主担当はガラスの外（見ているだけの人の場所）にいるので、歩かせずにカットで移す（ガラスを抜けて歩く絵にしない）
const hs = { st: null, b: null, t: 0, cut: false, pins: null };
function startHandshake(st, b) {
  Object.assign(hs, { st, b, t: 0, cut: false, pins: null });
}
function stepHandshake(dt) {
  if (!hs.st) return;
  if (hs.st !== game.stage || !hs.b.alive) { hs.st = null; return; }
  hs.t += dt;
  if (!hs.cut && hs.t >= 0.5) {
    hs.cut = true;
    const { st, b } = hs;
    cutTo(() => {
      if (st !== game.stage || !b.alive) return;
      const s = st.supportUnit, p = st.player;
      delete s._pin;
      const y = Math.min(Math.max(b.y, PLAY.top + 30), PLAY.bottom - 24);
      hs.pins = [
        { e: s, x: b.x - 30, y, f: 1 },          // 主担当: ボスの正面で向き合う
        { e: p, x: b.x - 66, y: y - 18, f: 1 },  // 主人公: 一歩うしろ（奥）に立っている
        { e: b, x: b.x, y, f: -1 },
      ];
      // 代理店が残っていれば、ボスの脇へ（主人公と重ならないように）
      if (st.agent && st.agent.alive) hs.pins.push({ e: st.agent, x: b.x + 30, y: y - 14, f: -1 });
      pinHandshake();
    });
  }
}
// 握手の間は位置と向きを毎ステップ書き戻す（主人公は動かせない。攻撃も止める）
function pinHandshake() {
  if (!hs.pins || hs.st !== game.stage) return;
  for (const q of hs.pins) {
    const e = q.e;
    e.x = q.x; e.y = q.y; e.facing = q.f; e.kbx = 0; e.moving = false;
    if (e !== hs.b) { e.attack = null; e.attackActive = false; e.state = 'idle'; }
  }
}
function holdForDown(g, before) {
  const st = g.stage;
  const b = st && st.boss;
  if (!b || b.alive || b.__down || !st.bossStarted || (st.reviveLeft || 0) > 0) return;
  // 撃破で章が終わったところ（報告書・通知書へ移る直前）か、レターでとどめを刺した直後（次の更新で終わる）
  const ended = before === 'playing' && (g.state === 'clear' || g.state === 'disband');
  if (!ended && g.state !== 'playing') return;
  if (ended) { g.state = 'playing'; g.screenT = 0; st.cleared = false; }
  b.__down = true;
  b.alive = true; b.hp = 0;
  // 支援の章（第3・5章）は、倒したあとの決着を主担当が持っていく（構成案）。ボスは崩れずに立ったまま、
  // 少し間を置いてカットで握手の絵へ（stepHandshake）。主担当がいない（やられた等）ときは普通に崩れる
  const hand = !!(st.data.support && st.supportUnit && st.supportUnit.alive);
  if (hand) { b.downStyle = 'stand'; startHandshake(st, b); }
  b.dying = true; b.downT = b.downMax = hand ? DOWN_SEC_HAND : DOWN_SEC;
  b.taunt = st.data.clearLine || null;
  // 3.2秒で消す。握手の章（第3・5章）は残りの1.4秒、吹き出しに隠れない握手の絵を見せる（一言は報告書にも出る）
  b.tauntT = b.taunt ? DOWN_SEC : 0;
  b.chatterT = 99;
  b.hitstun = 0; b.kbx = 0; b.attack = null; b.attackActive = false; b.state = 'idle';
  if (!st.entities.includes(b)) st.entities.push(b);
  FX.hitstop = Math.max(FX.hitstop, 0.22); FX.shake = Math.max(FX.shake, 2.6);
  burst(b.x, b.y - 14, '#ffd24a');
}

// 続編専用の場面を先に登録する（章を読み込むと場面を張るので、その前に済ませる）
window.__scenes2 = await loadSequelScenes();
const game = new Game2_3D();
setGame(game);
// ?dbg=1 のときだけ外から状態を触れるようにする（出来事の演出を確かめる用。本編の __scene と同じ扱い）
if (Q.get('dbg') === '1') window.__g2 = game;

let bossSceneApplied = false;
// 章の途中で場面が変わる区間（scenes3d）の、いまの区間の番号。0 は章の頭の場面（bg.scene）、
// k は scenes3d[k-1]。進むだけで戻らない（戦闘中に自機が後ろへ下がっても、前の場面へ張り戻さない。
// 地獄では敵が自機の後ろにも出るので、下がるたびに部屋が入れ替わってしまう）。
let segIdx = 0;
// 区間の切り替えの暗転（下の updateFade）。attach が起動直後にも呼ぶので、ここで先に用意する
const fadeEl = document.getElementById('fade');
const labelsEl = document.getElementById('labels');
const fade = { phase: 0, a: 0, pending: null };
function segIndexAt(data, x) {
  let k = 0;
  for (const seg of data.scenes3d || []) if (x >= seg.x) k++;
  return k;
}
function segScene(data, k) { return k === 0 ? { scene: data.bg.scene, label: null } : data.scenes3d[k - 1]; }

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
  st.fx.text = (x, y, s, c) => {
    // 代理店が同席している間、こちらの言葉は薄まる（ボスの被ダメ半減）。2Dでは数字でしか分からないので、
    // 3Dではボスに出る減りの数字を灰色にして「通っていない」ことを見せる
    const b = st.boss;
    if (st.agent && st.agent.alive && b && b.alive && x === b.x && typeof s === 'string' && s[0] === '-') c = '#9aa0a8';
    oText(x, y, s, c); addFloat(x, y, 0, s, c);
  };
  const oShatter = st.fx.shatter.bind(st.fx);
  st.fx.shatter = (x, y, look) => { oShatter(x, y, look); FX.shake = Math.max(FX.shake, 0.7); burst(x, y, SHARD[look] || SHARD.sake); };
  const oMeteor = st.fx.meteor.bind(st.fx);
  st.fx.meteor = (x, y, r) => { oMeteor(x, y, r); meteorBoom(x, y, r); };
  buildScenery(data);
  segIdx = segIndexAt(data, st.player.x);
  clearFade();
  camPos.set(wx(st.player.x), CAM.height, wz(st.player.y) + CAM.dist);
  camLook.set(wx(st.player.x), CAM.lookY, wz(st.player.y) - 3);
}

// タイトルの裏にも章が要る（render3d は stage を前提に描く）。第1章を置いておく。
game.stage = new Stage2(CHAPTERS[0], game);
attach(game.stage, CHAPTERS[0]);
enterTitleScene();

// 続編専用のタイトル場面（研修センターの前）。読めなかったときは第1章の場面のまま。
function enterTitleScene() {
  // タイトルは一枚絵。裏に置いた第1章の通行人が画面の端で半身だけ出たり入ったりするので、自機のほかは出さない
  // （始めるときに章を読み込み直すので、ここで消しても遊びには影響しない）
  for (const e of game.stage.entities) if (e !== game.stage.player) e.alive = false;
  if (window.__scenes2 && window.__scenes2.loaded.includes('g2_title')) {
    buildTitleScenery(CHAPTERS[0].width, 'g2_title');
  }
}

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
  hud.rank.textContent = act.senshi ? '小向戦士' : (st.data.playerRank || '');   // 小向戦士: エピローグの書類と同じ文言
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
    hud.letterLabel.textContent = full ? (touch() ? 'レター（ボタンで撃てる）' : 'レター（R で撃てる）') : 'レター';
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

  hud.loc.textContent = locFor(st);
  if (st.bannerT > 0 && st.banner) {
    hud.banner.textContent = st.banner;
    hud.banner.classList.add('show');
    // バナーの色は意味を持つ（合流＝緑・離脱＝灰・通された＝紺 など。main2.js が決める）。
    // CSS の既定は赤なので、色の指定が無いときだけ赤に戻す
    hud.banner.style.background = st.bannerColor || '';
  } else hud.banner.classList.remove('show');
  // 待合室。敵が出ない代わりに、残工期だけが減っていく時間
  hud.wait.classList.toggle('show', game.state === 'playing' && st.waitT > 0);
}

// 右上の作業場所。章のデータは章に1つ（2D版と同じ）なので、3Dで部屋が変わる区間では、
// 今ある文言から作る（新しい名前は足さない）:
//  ・帰社の区間（自社の執務室）… 波の見出し「帰社 — PM（課長）」の「帰社」
//  ・章の場所名のうち部屋の名前より前（「研修センター 大講堂」→「研修センター」、「GR社 工場 待合室」→「GR社 工場」）
//    … その部屋ではない区間（実習場・寮・古い工場・古い会議室）
const LOC_JISHA = '帰社';
const LOC_TRIM = new Set(['g2_kenshu', 'g2_ryo', 'g2_gr_kojo', 'g2_gr_kaigi']);
function locFor(st) {
  const base = st.location || st.data.location || '';
  const key = getScene();
  if (key === 'g2_jisha') return LOC_JISHA;
  if (LOC_TRIM.has(key)) { const w = base.split(' '); return w.length > 1 ? w.slice(0, -1).join(' ') : base; }
  return base;
}

// ===== 画面 =====
const screenEl = document.getElementById('screen');
// soft: タイトル（書類を細くして背景を見せる）／'veil': 解散・エピローグ（暗幕を薄く、書類を下に）
function showScreen(html, soft = false) {
  screenEl.innerHTML = html;
  screenEl.className = soft === 'veil' ? 'veil' : soft ? 'soft' : '';
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
        <a class="backlink" href="../launcher/index.html?app=1">◀ 作品の選択へ</a>
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
        ${ch.clearLine ? `<p class="lead" style="color:#8a6a3a">「${ch.clearLine.replace(/\n/g, '<br>')}」</p>` : ''}
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
          ? '<p class="lead" style="text-align:center">「これから下り坂のない、つらい上り坂の道が、何年か続きます」</p>'
          : ''}
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
      </div>`, 'veil');
      break;
    case 'epilogue':
      // 文は本人の点検（2026-11-14）のとおり。前にあった2行（下り坂／頂上）を本人が外したので、
      // 残った2行を1.0秒に出す。「— 小向戦士 —」は3Dのヘルメットが橙に変わる6.2秒のまま
      showScreen(`<div class="sheet">
        <div class="eyebrow" style="animation:fadein .8s 1.0s both">後に誰かが、あの年次を金の世代　-ゴールデンエイジ-と呼んだ。<br>誰が言い出したのかは、もう分からない。</div>
        <svg viewBox="0 0 320 100" style="width:100%;height:auto;margin:10px 0" aria-hidden="true">
          <line x1="10" y1="92" x2="310" y2="92" stroke="#d3d8dd" stroke-width="1"/>
          <line x1="10" y1="88" x2="226" y2="20" stroke="#d2a23c" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <h2 style="animation:fadein .8s 6.2s both;color:var(--accent);text-align:center">— 小向戦士 —</h2>
        <p class="k" style="animation:fadein .8s 6.2s both">${touch() ? '画面を押して 小向クエスト（本編）へ' : 'Enter で 小向クエスト（本編）へ'}</p>
      </div>`, 'veil');
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
  // 「作品の選択へ」はリンクに任せる（ここで決定にすると、遷移の前にゲームが始まる）
  if (ev.target.closest('.backlink')) return;
  const btn = ev.target.closest('.dbtn');
  if (btn) { game.difficulty = btn.dataset.diff; renderScreen(); Audio.resume(); return; }
  // 指で遊ぶ端末のタイトルは「はじめる」を押したときだけ始める（本編と同じ）。
  // どこを押しても始まると、最初のタップが音の解禁と開始を兼ねてしまい、
  // タイトルの曲が一度も鳴らないまま作業指示書に変わる。空振りは音を出すだけ。
  if (touch() && game.state === 'title' && !ev.target.closest('.startbtn')) { Audio.resume(); return; }
  Audio.resume();
  Input.tapConfirm();
});

// 指で遊ぶ端末の「その場のボタン」。続編の2つの仕掛けはキーボードの R／E でしか出せず、
// iPhone では使えなかった。使える間だけ、奥の手Ｋの位置にボタンを出す（続編は奥の手を使わない）。
// 条件は game2/src/main2.js のボス戦の判定（R: レターが満タン／E: 作り直しの残りがある）と同じ。
// レターは第3章、口出しは第5章だけなので、同時に2つ出ることはない。
function ctxAction() {
  const st = game.stage;
  if (game.state !== 'playing' || game.paused || !st || !st.boss || !st.boss.alive || st.boss.dying) return null;
  const g = st.data.gauges || {};
  if (g.letter && game.letter >= game.letterMax) return { key: 'KeyR', label: 'レター' };
  if (st.reviveLeft > 0) return { key: 'KeyE', label: '口出し' };
  return null;
}

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
// タブが裏に回ったら曲を止め、戻ったら続きから（本編と同じ。裏では setInterval が間引かれて
// BGM がスローモーションになる）
document.addEventListener('visibilitychange', () => Audio.setMusicPaused(document.hidden));

// ===== 出来事を場面へ =====
// 続編の場面は、待合室の扉・L3社の照明・試験台などを出来事で変える（scenes2.js の onEvent）。
// ロジック（game2/src/main2.js）は触らず、前のフレームとの差を見てここから知らせる。
const evPrev = { st: null };
let reviveFromBoss = false;   // 作り直しの残りが減ったのが、ボスの復活か E（口出し）かを分ける
let sceneClock = 0;
const spawnedCount = (st) => (st.data.waves || []).filter((_, i) => st.spawned && st.spawned[i]).length;
function pumpSceneEvents(st, dt) {
  if (!st) return;
  if (evPrev.st !== st) {   // 章が変わった（attach の後）。差を取る起点を取り直す
    Object.assign(evPrev, { st, waiting: st.waitT > 0, bossStarted: !!st.bossStarted, reveal: !!st.bossBarRevealed,
      bossAlive: !!(st.boss && st.boss.alive), dying: !!(st.boss && st.boss.dying), reviveLeft: st.reviveLeft || 0,
      letter: game.letter, state: game.state, waves: spawnedCount(st), roster: [...(game.roster || [])],
      turned: !!st.turned, agentDown: !!st.agentCleared, defeated: false });
    if (typeof st.reviveBoss === 'function' && !st.__reviveWrapped) {
      const o = st.reviveBoss.bind(st);
      st.reviveBoss = () => { reviveFromBoss = true; o(); };
      st.__reviveWrapped = true;
    }
    // 確認用の ?boss=1 は、起点を取る前にボス戦が始まっている。そのままだと 'bossStart' が届かない
    if (st.bossStarted) { sceneEvent('bossStart'); placeWatchers(st); }
  }
  sceneClock += dt;
  sceneEvent('tick', {
    dt, t: sceneClock, waitT: st.waitT || 0,
    letter: game.letter / (game.letterMax || 100),
    kouki: game.kouki / (game.koukiMax || 100),
    genka: game.genka / (game.genkaMax || 100),
  });
  const waiting = st.waitT > 0;
  if (evPrev.waiting && !waiting) sceneEvent('waitEnd');
  // 波が出た（第何波か・波の名前）
  const waves = spawnedCount(st);
  for (let i = evPrev.waves; i < waves; i++) sceneEvent('wave', { index: i, label: (st.data.waves[i] || {}).label || '' });
  // 同期の加入・離脱（roster の差）
  const roster = game.roster || [];
  for (const t of roster) if (!evPrev.roster.includes(t)) sceneEvent('doukiJoin', { type: t });
  for (const t of evPrev.roster) if (!roster.includes(t)) sceneEvent('doukiLeave', { type: t });
  if (!evPrev.bossStarted && st.bossStarted) { sceneEvent('bossStart'); placeWatchers(st); }
  if (!evPrev.reveal && st.bossBarRevealed) sceneEvent('reveal');
  if (!evPrev.turned && st.turned) sceneEvent('turn');
  if (!evPrev.agentDown && st.agentCleared) {
    sceneEvent('agentDown');
    hud.gKouki.classList.remove('hit'); void hud.gKouki.offsetWidth; hud.gKouki.classList.add('hit');
  }
  const rl = st.reviveLeft || 0;
  if (rl < evPrev.reviveLeft) sceneEvent(reviveFromBoss ? 'revive' : 'kuchidashi');
  reviveFromBoss = false;
  const lmax = game.letterMax || 100;
  if (evPrev.letter >= lmax && game.letter < evPrev.letter && st.bossStarted) { sceneEvent('letter'); fireLetterFx(st); }
  // 撃破。3D版はボスが崩れていく間（holdForDown）を挟むので、その始まりで知らせる。
  // 場面の撃破の変化（'defeated'）も同じ瞬間に送る。報告書が出てからでは暗幕に隠れて見えない
  const alive = !!(st.boss && st.boss.alive);
  const dying = !!(st.boss && st.boss.dying);
  let defeated = evPrev.defeated;
  if (!evPrev.dying && dying && rl === 0) { sceneEvent('down'); if (!defeated) { sceneEvent('defeated'); defeated = true; } }
  if (evPrev.bossAlive && !alive && rl === 0 && !defeated) { sceneEvent('defeated'); defeated = true; }
  if (evPrev.state !== game.state) {
    if (game.state === 'disband') sceneEvent('disband');
    if (game.state === 'epilogue') sceneEvent('epilogue');
  }
  Object.assign(evPrev, { waiting, bossStarted: !!st.bossStarted, reveal: !!st.bossBarRevealed,
    bossAlive: alive, dying, reviveLeft: rl, letter: game.letter, state: game.state, waves, roster: [...roster],
    turned: !!st.turned, agentDown: !!st.agentCleared, defeated });
}

// 社長宛レター（R）。待たされた時間が書かせた手紙が、自機から舞い上がってボスの頭上を越え、
// 上から落ちてくる。ダメージはロジック側で即座に入るので、絵は短く（0.5秒）して因果に見せる。
// 宛先・社名などの文字は出さない。
const letterFx = [];
function fireLetterFx(st) {
  const b = st.boss;
  if (!b) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(8, 0.45, 5.5),
    new THREE.MeshLambertMaterial({ color: 0xf6f3ea, emissive: 0x6fb8e8, emissiveIntensity: 0.45 }));
  scene.add(m);
  letterFx.push({ m, t: 0, x0: wx(st.player.x), z0: wz(st.player.y), x1: wx(b.x), z1: wz(b.y), bx: b.x, by: b.y });
}
function updateLetterFx(dt) {
  for (let i = letterFx.length - 1; i >= 0; i--) {
    const f = letterFx[i];
    f.t += dt;
    const u = Math.min(1, f.t / 0.5);
    // 頭越しの弧。高くしすぎると画面の上（HUDの帯）に出て見えないので、頂点は y≈30 まで
    f.m.position.set(f.x0 + (f.x1 - f.x0) * u, 8 + Math.sin(Math.PI * u) * 22, f.z0 + (f.z1 - f.z0) * u);
    f.m.rotation.set(u * 8, u * 3, u * 5);
    if (u >= 1) {
      burst(f.bx, f.by, '#9ad8ff');
      FX.shake = Math.max(FX.shake, 2.2);
      FX.hitstop = Math.max(FX.hitstop, 0.12);
      scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose();
      letterFx.splice(i, 1);
    }
  }
}

// 海外3社のボス戦は単騎。2D版は同期と主担当を「2Dカメラの左端」へ下げるが、3Dのカメラは自機を追って
// 寄るので、その位置は画面の外になる（「端で見ているのに入ってこられない」が見えない）。
// 3Dで見える左の奥（ボス部屋のガラスの外）へ置き直す。並びは見た目だけで、ロジックは変えない。
function placeWatchers(st) {
  if (!st.data.soloBoss) return;
  const ws = st.entities.filter((e) => e.alive && e.team === 'mob'
    && ((st.doukiUnits || []).includes(e) || e === st.supportUnit));
  // 置き場は部屋（章の右端）から決める。自機の位置から決めると、ボス戦に入った地点しだいで
  // いちばん右の人がガラスの内側（会議室の側）に立ってしまう。仕切りは W−88〜W−100 にあるので、
  // その左（W−127〜W−105）に並べる
  ws.forEach((e, i) => {
    e.x = Math.max(12, st.width - 380 + i * 22);
    e.y = PLAY.top + 6 + (i % 2) * 9;
    e._pin = { x: e.x, y: e.y };
  });
}
// 下がった人は陣営が mob になり、ロジックの中では毎フレーム辺りをうろつく（向きも勝手に変わる）。
// 置いたままにしないと、30〜60秒の戦いのうちにガラスを抜けて会議室へ入ってくる。
// 毎ステップ、ロジックの更新のあとで位置と向き（会議室の方＝右）を書き戻す。見た目だけで、判定は変えない。
function pinWatchers(st) {
  if (!st || !st.bossStarted) return;
  for (const e of st.entities) {
    if (!e._pin || !e.alive) continue;
    e.x = e._pin.x; e.y = e._pin.y; e.vx = 0; e.kbx = 0;
    e.facing = 1; e.moving = false;
  }
}
// 単騎のボス戦（第3〜5章）で自機がやられたとき、ロジックは2Dの画面の左端（2Dのカメラ +40）に
// 立ち直らせる。3Dではそこはボス部屋のガラスの外（廊下）で、ボスも追って廊下へ出てくる。
// 3Dだけ、ボス戦が始まる地点（章の右端から220）より左には戻さない。
function keepRespawnInRoom(st, livesBefore) {
  if (!st || !st.data.soloBoss || !st.bossStarted || game.lives >= livesBefore || !st.player.alive) return;
  st.player.x = Math.max(st.player.x, st.width - 220);
}

// ===== 解散とエピローグ（最終章。3D版だけの段取り） =====
// 2D版は書類だけを出すが、3D版は書類（薄い暗幕で下に寄せてある）の上に大会議室が見えている。
// 撃破した瞬間のまま全員が止まって映らないよう、ステージの外から人を動かす（ロジックは止まっている）。
//  解散  0秒〜: 係争・残った敵・見ていた人は左へ歩いて出ていく（来た道。カメラの外で消える）
//        2.6秒〜（3.4秒に「最後の同期が呼ばれて出ていく。振り返らない。」）: 最後の同期が帯の奥の縁を右へ歩き、
//             右端の扉（g2_daikaigi が同じ3.4秒に開けて、5.9秒から閉める）へ背中を見せたまま入っていく
//  エピローグ: 自機だけが残る。6.2秒（「— 小向戦士 —」）でヘルメットが緑から橙へ、等級が「小向戦士」へ
//             （どちらも構成案のとおり）。カメラはゆっくり引く
const act = { on: null, t: 0, leavers: [], last: null, senshi: false, cam0: null };
function stepAct(st, dt) {
  if (!st) return;
  if (game.state !== act.on) {
    if (game.state === 'disband') startDisband(st);
    else if (game.state === 'epilogue') startEpilogue(st);
    else if (act.on) endAct();
    act.on = (game.state === 'disband' || game.state === 'epilogue') ? game.state : null;
  }
  if (!act.on) return;
  act.t += dt;
  if (act.on === 'disband') stepDisband(st, dt);
  else stepEpilogue(st, dt);
}
function startDisband(st) {
  act.t = 0;
  const p = st.player;
  const douki = (st.doukiUnits || []).filter((e) => e.alive);
  act.last = douki[douki.length - 1] || null;
  // 同期はふだん自機について歩いている。離れた所に取り残されていたら（確認用の ?boss=1 など）、自機のそばへ
  if (act.last && Math.abs(act.last.x - p.x) > 140) { act.last.x = p.x - 46; act.last.y = p.y - 10; }
  act.leavers = st.entities.filter((e) => e.alive && e !== p && !douki.includes(e)).map((e, i) => ({ e, at: 0.25 + i * 0.2 }));
  for (const e of st.entities) {   // 殴りかけ・吹き出しの途中で止まっている人も、ここで手を止める
    e.attack = null; e.attackActive = false; e.hitstun = 0; e.kbx = 0; e.state = 'idle'; e.taunt = null; e.tauntT = 0;
  }
}
function stepDisband(st, dt) {
  const p = st.player;
  for (const L of act.leavers) {
    const e = L.e;
    if (!e.alive || act.t < L.at) continue;
    e.facing = -1;
    e.x -= 78 * dt;
    if (e.x < p.x - 330) e.alive = false;   // カメラの左の外
  }
  const d = act.last;
  if (d && d.alive && act.t >= 2.6) {   // 扉は3.4秒に開いて5.9秒から閉まる。閉まりきる前に入れるよう少し早めに歩き出す
    const laneY = PLAY.top + 2;                 // 帯の奥の縁（机の列の手前）
    const doorX = st.width + 36;                // 扉の真ん中（g2_daikaigi の DX = W + 12）
    const doorY = (PLAY.top + PLAY.bottom) / 2 + (-72 + 5) * 3;  // 扉の前（奥の壁 BACK = -72 の少し手前。ワールド z → ゲーム y）
    if (d.x < st.width - 6) {                   // 机の列は W-14 で終わる。そこまでは帯の縁を右へ
      d.facing = 1;
      d.x = Math.min(st.width - 6, d.x + 115 * dt);
      d.y += (laneY - d.y) * Math.min(1, dt * 4);
    } else {                                    // 扉へ。振り返らない
      d.yawOverride = Math.PI;
      d.x += (doorX - d.x) * Math.min(1, dt * 3);
      d.y = Math.max(doorY, d.y - 125 * dt);
      if (d.y <= doorY + 0.5) d.alive = false;
    }
  }
}
function startEpilogue(st) {
  act.t = 0;
  // 書類を早送りして来ても、部屋には自機しか残さない
  for (const e of st.entities) if (e !== st.player) e.alive = false;
  act.cam0 = { dist: CAM.dist, height: CAM.height };
}
function stepEpilogue(st, dt) {
  const k = Math.min(1, act.t / 7);
  const ease = k * k * (3 - 2 * k);
  CAM.dist = act.cam0.dist * (1 + 0.16 * ease);
  CAM.height = act.cam0.height * (1 + 0.06 * ease);
  // 書類は画面の真ん中に立つので、自機が書類の右（扉と白板の側）に来るよう、最初の2.5秒でカメラを左へ振る
  const k2 = Math.min(1, act.t / 2.5);
  CAM.xOff = -58 * k2 * k2 * (3 - 2 * k2);
  if (!act.senshi && act.t >= 6.2) {
    act.senshi = true;
    const p = st.player;
    p.spriteKey = 'p2_senshi';
    refreshRig(p);   // 3Dの人形は最初に作ったものを使い回すので、作り直させる
    burst(p.x, p.y - 20, '#ff7f0e');
  }
}
function endAct() {
  if (act.cam0) { CAM.dist = act.cam0.dist; CAM.height = act.cam0.height; act.cam0 = null; }
  CAM.xOff = 0;
  act.senshi = false; act.leavers = []; act.last = null;
}

// ===== 配属発表（第1章のボスが倒れていく間。3D版だけ） =====
// 研修の間は主人公も同期3人も同じ白いヘルメット（chars2.js の kenshuLook）。ボスが崩れていく間に、
// 主人公から順に0.4秒おきに1人ずつ、それぞれの配属の色へ変わる（構成案「同じ白だった4人の色が分かれる」）。
// 主人公の種別を配属後（p2_haizoku）にすると、研修の着替えが外れて同期も自分の色で作られるようになる。
const haizoku = { st: null, t: 0, order: [], done: 0 };
function refreshRig(e) {   // 3Dの人形を作り直させる（次の描画で、いまの種別・着替えで作られる）
  const r = meshes.get(e.id);
  if (r) { scene.remove(r.root); if (r.ring) scene.remove(r.ring); meshes.delete(e.id); }
}
function stepHaizoku(st, dt) {
  if (!st) return;
  if (haizoku.st !== st) {
    haizoku.st = st; haizoku.order = []; haizoku.done = 0; haizoku.t = 0;
  }
  const b = st.boss;
  if (!haizoku.order.length) {
    if (!(b && b.dying && st.player.spriteKey === 'p2_shinjin')) return;
    haizoku.order = [st.player, ...(st.doukiUnits || []).filter((e) => e.alive)];
    haizoku.t = 0;
  }
  if (haizoku.done >= haizoku.order.length) return;
  haizoku.t += dt;
  while (haizoku.done < haizoku.order.length && haizoku.t >= 0.5 + haizoku.done * 0.4) {
    const e = haizoku.order[haizoku.done++];
    if (e === st.player) e.spriteKey = 'p2_haizoku';
    if (!e.alive) continue;
    refreshRig(e);
    burst(e.x, e.y - 20, '#ffffff');
  }
}

// ===== 区間の切り替えの暗転 =====
// phase 0: なし / 1: 暗くしていく / 2: 暗いうちに張り替えて明けていく
const FADE_IN = 0.16, FADE_OUT = 0.34;
function updateFade(frameDt) {
  if (fade.phase === 0) return;
  // 建て直しの重い1フレームで dt が大きくなっても、明ける途中が飛ばないよう上限を置く
  const dt = Math.min(frameDt, 0.1);
  if (fade.phase === 1) {
    fade.a = Math.min(1, fade.a + dt / FADE_IN);
    if (fade.a >= 1) {
      const job = fade.pending;
      fade.pending = null;
      if (job) job.run();
      fade.phase = 2;
    }
  } else {
    fade.a = Math.max(0, fade.a - dt / FADE_OUT);
    if (fade.a <= 0) fade.phase = fade.pending ? 1 : 0;
  }
  fadeEl.style.opacity = fade.a.toFixed(3);
  labelsEl.style.opacity = (1 - fade.a).toFixed(3);
}
// 短く暗転して、真っ暗なうちに run を実行して明ける（区間の張り替え・握手のカット）。
// 暗転の途中でもう一度呼ばれたら、あとの方だけを実行する
function cutTo(run) {
  fade.pending = { run };
  if (fade.phase === 0) fade.phase = 1;
}
function clearFade() {
  fade.phase = 0; fade.a = 0; fade.pending = null;
  fadeEl.style.opacity = '0'; labelsEl.style.opacity = '1';
}

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
    const wasTitle = game.state === 'title';
    Input.ctxButton = ctxAction();
    const st0 = game.stage, livesBefore = game.lives;
    // ボスが崩れていく間の R／E は捨てる（R が読まれると、倒れる途中で HP が書き戻されて消えてしまう）
    if (st0 && st0.boss && st0.boss.dying) Input.dropPressed('KeyR', 'KeyE');
    game.update(STEP);
    if (game.stage === st0 && game.state === 'playing') { pinWatchers(st0); keepRespawnInRoom(st0, livesBefore); pinHandshake(); }
    // タイトルでは2D側（game2/src/main2.js の title）が M を処理する。ここでも反転させると
    // 同じ押下で2回ひっくり返って効かない。タイトル以外だけここで反転し、表示は毎回合わせる。
    if (Input.pressed('KeyM')) { if (!wasTitle) Audio.toggleMute(); renderMute(); }
    // ヒットストップでステージが止まっていた間に押された R／E は、読まれずに消える。次のフレームへ持ち越す
    const carry = game.hitstopStep ? ['KeyR', 'KeyE'].filter((k) => Input.pressed(k)) : [];
    Input.endFrame();
    for (const k of carry) Input.keepPressed(k);
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
  // 章の途中で場面が変わる区間（3D専用のキー）。前へ進んだときだけ張り替え、戻らない。
  // タイトルの間は張り替えない（裏に置いた第1章の区間が、タイトルの場面を上書きしてしまう）。
  // ボス場面に入ったあとも張り替えない。
  if (st && game.state !== 'title' && !bossSceneApplied && st.data.scenes3d && !Q.get('scene')) {
    const segs = st.data.scenes3d;
    const from = segIdx;
    while (segIdx < segs.length && st.player.x >= segs[segIdx].x) segIdx++;
    if (segIdx !== from) {
      const seg = segScene(st.data, segIdx);
      if (seg.scene !== getScene()) {
        // すぐには張り替えず、短く暗転してから（建て直す一瞬の引っかかりと、部屋が入れ替わる瞬間を隠す）
        const data = st.data;
        cutTo(() => {
          if (st !== game.stage) return;   // 暗転の間に章が変わっていたら張り替えない
          setScene(seg.scene, data);
          if (seg.label) { st.banner = seg.label; st.bannerColor = 'rgba(28,58,86,0.92)'; st.bannerT = 2.4; }
          sceneEvent('segment', { index: segIdx, scene: seg.scene });
        });
      } else {
        sceneEvent('segment', { index: segIdx, scene: seg.scene });
      }
    }
  }
  updateFade(frame);
  // ボス戦で場面が変わる章（会議室 → 相手の工場 など）
  if (st && st.bossStarted && !bossSceneApplied && (st.data.bossScene3d || st.data.bossBg) && !Q.get('scene')) {
    bossSceneApplied = true;
    // 3D専用のボス場面を先に見る（bossBg は2D版と共有のキーなので、3Dだけの場面はこちらに書く）
    setScene(st.data.bossScene3d || st.data.bossBg.scene, st.data);
  }
  pumpSceneEvents(st, frame);
  stepAct(st, frame);
  stepHaizoku(st, frame);
  stepHandshake(frame);

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
  updateLetterFx(frame);
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
// ?ch=N で途中の章から始めるとき、その章の始まりにいるはずの同期を揃える。
// 前の章までの加入・離脱を、applyDoukiEvents と同じ順（波ごとに加入→離脱）でなぞる。
// 空のままだと、第2章以降を確かめるとき同期が1人もいない。
function rosterAt(n) {
  const r = [];
  for (let i = 0; i < n - 1; i++) {
    const d = CHAPTERS[i];
    const waves = [...new Set([...(d.doukiJoin || []).map((j) => j.wave), ...(d.doukiLeave || []).map((l) => l.wave)])]
      .sort((a, b) => a - b);
    for (const w of waves) {
      for (const j of (d.doukiJoin || [])) if (j.wave === w && !r.includes(j.type)) r.push(j.type);
      for (const l of (d.doukiLeave || [])) if (l.wave === w) { const k = r.indexOf(l.type); if (k >= 0) r.splice(k, 1); }
    }
  }
  return r;
}

// ?ch=1..6 … 指定した章から始める（場面の確認用）
{
  const n = parseInt(Q.get('ch') || '0', 10);
  if (n >= 1 && n <= CHAPTERS.length) {
    game.score = 0; game.lives = LIVES[game.difficulty];
    game.kouki = game.koukiMax; game.genka = 0; game.letter = 0;
    game.roster = rosterAt(n);
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
    // ?wait=1 なら待合室の「待っている最中」のまま（第3章の待合室の場面を確かめる用）
    if (!Q.get('wait')) st.waitT = 0;
    st.player.x = d;
    st.currentWave = st.data.waves.length;
    st.lockX = st.width - 40;
    let pick = st.data.waves[0];
    for (const w of st.data.waves) if ((w.x || 0) <= d) pick = w;
    st.spawnWave(pick);
    camPos.x = wx(d); camLook.x = wx(d);
    resyncScene();
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
  resyncScene();
}

// 確認用のパラメータで位置や待ち時間を書き換えたあと、場面をその状態から建て直す
// （待合室の扉は建てるときの待ち時間で開け閉めを決める、など）。出来事の起点も取り直す。
function resyncScene() {
  const st = game.stage;
  if (!st || Q.get('scene')) return;
  segIdx = segIndexAt(st.data, st.player.x);
  setScene(segScene(st.data, segIdx).scene, st.data);
  evPrev.st = null;
}

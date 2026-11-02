// 小向クエスト2 ゴールデンエイジ編 — 起動・ループ・状態機械
//
// エンジン（Stage の波/カメラ/背景描画、entities、combat、sprites、input、audio）は1から継承・共有する。
// 1のブートは canvas#game を見て起動するので、こちらは canvas#game2 を使い二重起動を避けている。
import { VIEW_W, VIEW_H, FLOOR_TOP, FLOOR_BOTTOM, PLAY, LIVES, clamp } from '../../game/src/config.js';
import { Input } from '../../game/src/input.js';
import { buildSprites, registerPalettes, registerTypeMeta } from '../../game/src/sprites.js';
import { Char } from '../../game/src/entities.js';
import { Stage } from '../../game/src/main.js';
import { Audio } from '../../game/src/audio.js';
import { CHAPTERS, defFor2, PALETTES2, LABELS2, COLORS2 } from './stages2.js';
import './taunts2.js'; // 1の TAUNTS に続編カテゴリを合流させる（副作用のみ）
import {
  drawHUD2, drawTitle2, drawChapterIntro2, drawSlope2,
  drawChapterClear2, drawDisband2, drawEpilogue2, drawGameOver2,
} from './ui2.js';

const FLOOR_MID = (FLOOR_TOP + FLOOR_BOTTOM) / 2;

// ===== 章ステージ =====
class Stage2 extends Stage {
  constructor(data, game) {
    super(data, game);
    this.player.spriteKey = data.playerSprite || 'p2_haizoku';

    this.waitT = data.waitingRoom ? data.waitingRoom.sec : 0;
    this.bossBarRevealed = false;
    this.reviveLeft = data.bossRevive || 0;
    this.agent = null;
    this.agentCleared = false;
    this.parked = false;
    this.turned = false;      // ボスが振り向いたか
    this.doukiUnits = [];     // 同期の実体
    this.supportUnit = null;  // 支援章の主担当

    // 同期（roster は章をまたいで持ち越す。減ったら戻らない）
    for (const type of game.roster) this.spawnDouki(type);
    // 支援章の主担当
    if (data.support) {
      this.supportUnit = new Char(150, FLOOR_MID + 14, defFor2(data.support));
      this.entities.push(this.supportUnit);
    }
    // モブ（中間管理職・通行人）— 攻撃も被弾もせず、ただ見ている
    for (const m of (data.mobs || [])) {
      this.entities.push(new Char(m.x, FLOOR_TOP + 8 + ((m.x * 7) % 50), defFor2(m.type)));
    }
  }

  spawnDouki(type) {
    const n = this.doukiUnits.length;
    const c = new Char(96 + n * 42, FLOOR_MID - 10 + n * 12, defFor2(type));
    this.doukiUnits.push(c);
    this.entities.push(c);
    return c;
  }

  // 2の同期は絶対に裏切らない（1の checkBetrayal を完全に無効化）
  checkBetrayal() {
    if (this.data.noBetray) return;
    super.checkBetrayal();
  }

  spawnWave(w) {
    const hell = this.game && this.game.difficulty === 'hell';
    const list = [];
    for (const g of w.enemies) {
      const d = defFor2(g.type);
      const reps = (hell && !d.boss && !d.midboss && !d.elite) ? g.count * 2 : g.count;
      for (let k = 0; k < reps; k++) list.push(g.type);
    }
    const band = PLAY.bottom - PLAY.top - 12;
    for (let n = 0; n < list.length; n++) {
      const fromBehind = list.length > 3 && n % 4 === 3;
      let x = fromBehind ? this.player.x - 72 - (n % 3) * 38 : this.player.x + 78 + n * 58 + ((n % 2) ? 26 : 0);
      x = clamp(x, 12, this.width - 24);
      const y = PLAY.top + 6 + Math.round(band * ((n * 0.618 + 0.13) % 1));
      this.entities.push(new Char(x, y, defFor2(list[n])));
    }
  }

  startBoss() {
    this.bossStarted = true;
    const d = this.data;
    const bossDef = defFor2(d.boss.type);
    this.boss = new Char(this.width - 60, FLOOR_MID, bossDef);
    this.entities.push(this.boss);
    this.lockX = this.width - 40;
    this.bossSpokeAt = this.time;
    if (bossDef.firstLine) {
      this.boss.taunt = bossDef.firstLine;
      this.boss.tauntT = 3.6;
      this.boss.chatterT = 4.2;
    }
    if (d.coBoss) this.entities.push(new Char(this.width - 118, FLOOR_MID + 20, defFor2(d.coBoss)));

    // なめられている：最初こちらを向かず、怯まない
    if (d.bossFaceLock) {
      this.boss.faceLock = -1;
      this.boss.noKb = true;
      this.banner = 'こちらを見ようともしない'; this.bannerColor = 'rgba(60,60,72,0.9)'; this.bannerT = 2.6;
    }
    // 代理店が同席する間、こちらの言葉は薄まる（被ダメ半減）
    if (d.agent) {
      this.agent = new Char(this.width - 150, FLOOR_MID + 8, defFor2('dairiten'));
      this.entities.push(this.agent);
      this.boss.dmgTakenMul = 0.5;
    }
    // 会議に入れるのは英語が分かる自分だけ。同期も主担当も画面端へ。
    if (d.soloBoss) this.parkAllies();

    if (d.bossLocation) {
      this.location = d.bossLocation;
      if (d.bossBg) this.data = { ...this.data, bg: d.bossBg };
      this.banner = d.bossLocation; this.bannerColor = 'rgba(22,42,74,0.92)'; this.bannerT = 2.8;
    }
  }

  // 味方を「見ているだけ」の状態にする（mob 陣営＝攻撃も被弾もしない）
  parkAllies() {
    if (this.parked) return;
    this.parked = true;
    const list = [...this.doukiUnits, this.supportUnit].filter((e) => e && e.alive);
    list.forEach((e, i) => {
      e.team = 'mob';
      e.x = this.camera.x + 26 + i * 20;
      e.y = FLOOR_TOP + 10;
      e.state = 'idle';
    });
  }

  updateWaves() {
    if (this.cleared) return;

    // 待合室フェーズ: 敵が出てこない。時間だけが過ぎ、レターが溜まる。
    if (this.waitT > 0) return;

    if (this.bossStarted) {
      if (this.boss && !this.boss.alive) {
        if (this.reviveLeft > 0) { this.reviveBoss(); return; }
        this.cleared = true;
      }
      return;
    }
    if (this.currentWave < this.data.waves.length) {
      const w = this.data.waves[this.currentWave];
      if (!this.spawned[this.currentWave] && this.player.x > w.x - 130) {
        this.spawnWave(w);
        this.spawned[this.currentWave] = true;
        this.lockX = w.x;
        this.applyDoukiEvents(this.currentWave + 1);
        if (w.label) { this.banner = w.label; this.bannerColor = 'rgba(120,16,16,0.88)'; this.bannerT = 2.6; }
      }
      if (this.spawned[this.currentWave] && this.aliveEnemies() === 0) {
        this.currentWave++;
        this.lockX = this.currentWave < this.data.waves.length
          ? this.data.waves[this.currentWave].x : this.width - 40;
      }
    } else if (this.player.x > this.width - 220) {
      this.startBoss();
    }
  }

  // 同期の加入／恒久離脱（roster も更新するので次章に持ち越される）
  applyDoukiEvents(waveNo) {
    for (const j of (this.data.doukiJoin || [])) {
      if (j.wave !== waveNo || this.game.roster.includes(j.type)) continue;
      this.game.roster.push(j.type);
      const c = this.spawnDouki(j.type);
      c.x = this.player.x - 40; c.y = this.player.y;
      this.banner = '同期が合流した'; this.bannerColor = 'rgba(24,74,48,0.92)'; this.bannerT = 2.4;
    }
    for (const l of (this.data.doukiLeave || [])) {
      if (l.wave !== waveNo) continue;
      const i = this.game.roster.indexOf(l.type);
      if (i < 0) continue;
      this.game.roster.splice(i, 1);
      const u = this.doukiUnits.find((e) => e.spriteKey === l.type);
      if (u) { u.alive = false; }
      this.banner = '同期がいなくなった'; this.bannerColor = 'rgba(40,40,52,0.94)'; this.bannerT = 3.0;
    }
  }

  // 設計は通る。だが試験で裏切られる。壊れる。作り直し。
  reviveBoss() {
    this.reviveLeft--;
    const d = defFor2(this.data.boss.type);
    this.boss.alive = true;
    this.boss.maxhp = Math.round(d.hp * 0.8);
    this.boss.hp = this.boss.maxhp;
    this.boss.atkDmg = d.dmg + 1;
    this.boss.invuln = 0.6;
    this.boss.x = clamp(this.player.x + 120, 60, this.width - 40);
    if (!this.entities.includes(this.boss)) this.entities.push(this.boss);
    this.banner = '試験で裏切られた — 作り直し';
    this.bannerColor = 'rgba(120,60,16,0.92)'; this.bannerT = 3.0;
  }

  update(dt) {
    // --- 待合室: 敵は出ない。残工期は減り、レターだけが溜まる ---
    if (this.waitT > 0) {
      this.waitT -= dt;
      this.game.letter = Math.min(this.game.letterMax, this.game.letter + this.game.letterMax * dt / (this.data.waitingRoom.sec * 0.85));
      this.game.kouki = Math.max(0, this.game.kouki - dt * 0.9);
      if (this.waitT <= 0) {
        this.banner = 'ようやく通された'; this.bannerColor = 'rgba(22,42,74,0.92)'; this.bannerT = 2.6;
      }
    }

    super.update(dt);

    const g = this.data.gauges || {};
    // 残工期は時間とともに減り続ける（章をまたいでリセットされない）
    if (g.kouki && !this.cleared) this.game.kouki = Math.max(0, this.game.kouki - dt * 0.16);

    // 代理店を倒した＝通訳を外して直接話す。全ダメージが通るが、話が拗れて時間を食う。
    if (this.agent && !this.agent.alive && !this.agentCleared) {
      this.agentCleared = true;
      if (this.boss) this.boss.dmgTakenMul = 1;
      this.game.kouki = Math.max(0, this.game.kouki - 6);
      this.banner = '代理店を外して直接話した — 話が拗れる';
      this.bannerColor = 'rgba(90,60,20,0.92)'; this.bannerT = 3.0;
    }

    if (this.boss && this.boss.alive) {
      // 食らいつき続けると、はじめてHPバーが現れる（L社＝情報が出ない）
      if (this.boss.hideHpBar && !this.bossBarRevealed && this.boss.hp <= this.boss.maxhp * 0.62) {
        this.bossBarRevealed = true;
        this.boss.hideHpBar = false;
        this.banner = '相手の状態が、はじめて見えた';
        this.bannerColor = 'rgba(22,42,74,0.92)'; this.bannerT = 2.8;
      }
      // 一定まで削ると振り向く。そこからが本当の戦闘。
      if (this.data.bossFaceLock && !this.turned && this.boss.hp <= this.boss.maxhp * 0.7) {
        this.turned = true;
        this.boss.faceLock = null;
        this.boss.noKb = false;
        this.banner = '——ようやく、振り向いた';
        this.bannerColor = 'rgba(120,16,16,0.9)'; this.bannerT = 2.8;
      }
      // レター: 待たされた時間が武器になる。プロマネを飛び越して社長に届く。
      if (g.letter && this.game.letter >= this.game.letterMax && Input.pressed('KeyR')) {
        this.game.letter = 0;
        this.boss.hp -= 10;
        this.boss.invuln = 0.2;
        this.fx.text(this.boss.x, this.boss.y - 40, '社長宛レター', '#9ad8ff');
        this.banner = '社長宛の改善要望レターを出した';
        this.bannerColor = 'rgba(20,60,100,0.92)'; this.bannerT = 2.6;
        if (this.boss.hp <= 0) { this.boss.hp = 0; this.boss.alive = false; }
      }
      // 設計方針に口を出す: 作り直しを1回止められる。だが out of scope で原価が上がる。
      if (this.reviveLeft > 0 && Input.pressed('KeyE')) {
        this.reviveLeft--;
        this.game.genka = Math.min(this.game.genkaMax, this.game.genka + 14);
        this.fx.text(this.boss.x, this.boss.y - 40, 'out of scope', '#ffd85a');
        this.banner = '設計に口を出した — 追加費用を要求された';
        this.bannerColor = 'rgba(110,90,20,0.92)'; this.bannerT = 3.0;
      }
    }
  }

  render(ctx) {
    this.drawBackground(ctx);
    const order = this.entities.filter((e) => e.alive).sort((a, b) => a.y - b.y);
    for (const e of order) e.draw(ctx, this.camera.x);
    for (const p of this.projectiles) if (p.alive) p.draw(ctx, this.camera.x);
    this.fx.draw(ctx, this.camera.x);

    if (!this.bossStarted && this.waitT <= 0 && this.aliveEnemies() > 0) {
      const lx = this.lockX - this.camera.x;
      if (lx > 0 && lx < VIEW_W) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,127,14,0.5)'; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(lx, FLOOR_TOP - 2); ctx.lineTo(lx, VIEW_H); ctx.stroke();
        ctx.restore();
      }
    }
    drawHUD2(ctx, this.game, this);
  }
}

// ===== ゲーム（状態機械） =====
class Game2 {
  constructor() {
    this.state = 'title';
    this.time = 0; this.screenT = 0;
    this.chapterIndex = 0;
    this.score = 0; this.lives = LIVES.normal;
    this.difficulty = 'normal';
    this.paused = false;
    this.stage = null;
    this.roster = [];               // 同期（章をまたいで持ち越し、減ったら戻らない）
    this.koukiMax = 100; this.kouki = 100;   // 残工期（減る）
    this.genkaMax = 100; this.genka = 0;     // 原価（増える）
    this.letterMax = 100; this.letter = 0;   // レター
  }

  applyDifficulty() {
    if (this.stage && this.stage.player) this.stage.player.ranged = (this.difficulty === 'easy');
  }

  startRun() {
    this.chapterIndex = 0;
    this.score = 0;
    this.lives = LIVES[this.difficulty];
    this.roster = [];
    this.kouki = this.koukiMax; this.genka = 0; this.letter = 0;
    this.loadChapter(0);
    this.state = 'intro'; this.screenT = 0;
  }

  loadChapter(i) {
    this.stage = new Stage2(CHAPTERS[i], this);
    this.applyDifficulty();
  }

  toGameOver() { this.state = 'gameover'; this.screenT = 0; }

  update(dt) {
    this.time += dt; this.screenT += dt;
    const ch = CHAPTERS[this.chapterIndex];
    // 1の Game.update と同じ。立てないとスマホでスティックが出ず、歩けない
    Input.gameplayActive = this.state === 'playing' && !this.paused;

    switch (this.state) {
      case 'title':
        if (Input.pressed('Digit1')) this.difficulty = 'easy';
        if (Input.pressed('Digit2')) this.difficulty = 'normal';
        if (Input.pressed('Digit3')) this.difficulty = 'hell';
        if (Input.pressed('KeyM')) Audio.toggleMute && Audio.toggleMute();
        if (Input.confirm) { Audio.resume(); this.startRun(); }
        break;

      case 'intro':
        if (this.screenT > 1.0 && Input.confirm) { this.state = 'playing'; this.screenT = 0; }
        break;

      case 'playing': {
        if (Input.pressed('KeyP')) this.paused = !this.paused;
        if (this.paused) break;
        this.stage.update(dt);
        if (this.stage.cleared) {
          this.state = ch.final ? 'disband' : 'clear';
          this.screenT = 0;
        }
        break;
      }

      case 'clear':
        if (this.screenT > 1.4 && Input.confirm) {
          this.chapterIndex++;
          this.state = 'slope'; this.screenT = 0;
        }
        break;

      case 'slope':
        if (this.screenT > 1.8 && Input.confirm) {
          this.loadChapter(this.chapterIndex);
          this.state = 'intro'; this.screenT = 0;
        }
        break;

      case 'disband':
        if (this.screenT > 5.0 && Input.confirm) { this.state = 'epilogue'; this.screenT = 0; }
        break;

      case 'epilogue':
        if (this.screenT > 6.4 && Input.confirm) { location.href = '../game/'; }
        break;

      case 'gameover':
        if (this.screenT > 1.2 && Input.confirm) { this.state = 'title'; this.screenT = 0; }
        break;
    }
  }

  render(ctx) {
    if (this.state === 'playing' || this.state === 'clear' || this.state === 'disband') {
      if (this.stage) this.stage.render(ctx);
    } else {
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    const ch = CHAPTERS[Math.min(this.chapterIndex, CHAPTERS.length - 1)];
    switch (this.state) {
      case 'title': drawTitle2(ctx, this.time, this.difficulty, Audio.muted); break;
      case 'intro': drawChapterIntro2(ctx, ch, this.screenT); break;
      case 'clear': {
        const prev = CHAPTERS[this.chapterIndex];
        drawChapterClear2(ctx, prev, this.screenT, !!prev.completion);
        break;
      }
      case 'slope': {
        const from = CHAPTERS[this.chapterIndex - 1]?.slope ?? 0;
        drawSlope2(ctx, from, ch.slope ?? 0, this.chapterIndex === 1, this.screenT);
        break;
      }
      case 'disband': drawDisband2(ctx, this.screenT); break;
      case 'epilogue': drawEpilogue2(ctx, this, this.screenT); break;
      case 'gameover': drawGameOver2(ctx, this, this.screenT); break;
    }
    if (this.state === 'playing') Input.drawControls(ctx);
  }
}

// ===== 起動 =====
function boot2() {
  const canvas = document.getElementById('game2');
  const ctx = canvas.getContext('2d');

  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // 縦持ちのスマホでは canvas ごと90°回しているので、getBoundingClientRect では
    // 縦横が入れ替わって絵が潰れる。clientWidth/Height は回す前の自分の大きさ。
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const w = Math.max(VIEW_W, Math.round((cw || VIEW_W) * dpr));
    const h = Math.max(VIEW_H, Math.round((ch || VIEW_H) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  fitCanvas();
  addEventListener('resize', fitCanvas);
  addEventListener('orientationchange', fitCanvas);

  registerPalettes(PALETTES2);
  registerTypeMeta(LABELS2, COLORS2);
  buildSprites();
  Input.init();
  Input.initTouch(canvas);
  const resume = () => Audio.resume();
  addEventListener('keydown', resume, { once: true });
  addEventListener('pointerdown', resume, { once: true });

  const game = new Game2();
  const STEP = 1 / 60;
  let acc = 0, last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    let frame = (now - last) / 1000; last = now;
    if (frame > 0.25) frame = 0.25;
    acc += frame;
    while (acc >= STEP) { game.update(STEP); Input.endFrame(); acc -= STEP; }
    fitCanvas();
    ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
    ctx.imageSmoothingEnabled = false;
    game.render(ctx);
  }
  requestAnimationFrame(loop);
}

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('game2')) {
  boot2();
}

export { Game2, Stage2 };

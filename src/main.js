// Komukai Quest — 起動・ゲームループ・状態機械・ステージ進行
import {
  VIEW_W, VIEW_H, FLOOR_TOP, FLOOR_BOTTOM, clamp, dist2,
} from './config.js';
import { Input } from './input.js';
import { buildSprites } from './sprites.js';
import { Player, Char, Projectile } from './entities.js';
import { resolveMelee, resolveProjectiles, Fx } from './combat.js';
import { STAGES, defFor } from './stages.js';
import {
  drawHUD, drawTitle, drawStageIntro, drawStageClear,
  drawRankUp, drawEnding, drawGameOver,
} from './ui.js';

const FLOOR_MID = (FLOOR_TOP + FLOOR_BOTTOM) / 2;

// ===== ステージ =====
export class Stage {
  constructor(data, game) {
    this.data = data;
    this.game = game;
    this.width = data.width;
    this.time = 0;

    this.player = new Player(60, FLOOR_MID);
    this.entities = [this.player];
    this.projectiles = [];
    this.fx = new Fx();
    this.camera = { x: 0 };

    this.currentWave = 0;
    this.spawned = data.waves.map(() => false);
    this.lockX = data.waves.length ? data.waves[0].x : this.width - 60;
    this.boss = null;
    this.bossStarted = false;
    this.cleared = false;
    this.banner = null;
    this.bannerT = 0;

    for (const a of (data.allies || [])) {
      const c = new Char(a.x, FLOOR_MID, defFor(a.type));
      c.betrayer = !!a.betrayer;
      c.betrayTrigger = a.trigger || null;
      this.entities.push(c);
    }
  }

  nearestEnemy(self) {
    let best = null, bd = Infinity;
    for (const e of this.entities) {
      if (e.team !== 'enemy' || !e.alive) continue;
      const d = dist2(self.x, self.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  aliveEnemies() {
    let n = 0;
    for (const e of this.entities) if (e.team === 'enemy' && e.alive && !e.isBoss) n++;
    return n;
  }

  spawnProjectile(thrower, target) {
    const dirx = Math.sign(target.x - thrower.x) || 1;
    const vy = clamp(target.y - thrower.y, -28, 28);
    this.projectiles.push(new Projectile(thrower.x + dirx * 8, thrower.y, dirx * 150, vy, thrower.team));
  }

  spawnWave(w) {
    // 種別を1つの配列に展開してから、横にも奥行きにも広く散らして配置
    const list = [];
    for (const g of w.enemies) for (let k = 0; k < g.count; k++) list.push(g.type);
    const total = list.length;
    const band = FLOOR_BOTTOM - FLOOR_TOP - 12;
    for (let n = 0; n < total; n++) {
      const fromBehind = total > 3 && n % 4 === 3; // 集団は一部を後方からも（取り囲む）
      let x = fromBehind
        ? this.player.x - 72 - (n % 3) * 38
        : this.player.x + 78 + n * 58 + ((n % 2) ? 26 : 0);
      x = clamp(x, 12, this.width - 24);
      // 奥行きは黄金比刻みで全体に分散（縦の列に固まらない）
      const y = FLOOR_TOP + 6 + Math.round(band * ((n * 0.618 + 0.13) % 1));
      this.entities.push(new Char(x, y, defFor(list[n])));
    }
  }

  startBoss() {
    this.bossStarted = true;
    this.boss = new Char(this.width - 60, FLOOR_MID, defFor(this.data.boss.type));
    this.entities.push(this.boss);
    this.lockX = this.width - 40;
  }

  checkBetrayal() {
    for (const e of this.entities) {
      if (e.team !== 'ally' || !e.betrayer || e.betrayed) continue;
      const tr = e.betrayTrigger;
      let fire = false;
      if (tr) {
        if (tr.type === 'x') fire = this.player.x >= tr.value;
        else if (tr.type === 'time') fire = this.time >= tr.value;
        else if (tr.type === 'bossHp') fire = this.boss && this.boss.alive && (this.boss.hp / this.boss.maxhp) <= tr.value;
      }
      if (fire) {
        e.team = 'enemy';
        e.betrayed = true;
        e.state = 'idle';
        e.score = 300;
        e.tauntCat = 'betray';
        e.setTaunt(1.6); // 裏切りの一言を吐く
        this.fx.betray(e.x, e.y);
      }
    }
  }

  updateWaves() {
    if (this.cleared) return;
    if (this.bossStarted) {
      if (this.boss && !this.boss.alive) this.cleared = true;
      return;
    }
    if (this.currentWave < this.data.waves.length) {
      const w = this.data.waves[this.currentWave];
      if (!this.spawned[this.currentWave] && this.player.x > w.x - 130) {
        this.spawnWave(w);
        this.spawned[this.currentWave] = true;
        this.lockX = w.x;
        if (w.label) { this.banner = w.label; this.bannerT = 2.6; } // 徒党出現バナー
      }
      if (this.spawned[this.currentWave] && this.aliveEnemies() === 0) {
        this.currentWave++;
        this.lockX = this.currentWave < this.data.waves.length
          ? this.data.waves[this.currentWave].x
          : this.width - 40;
      }
    } else if (this.player.x > this.width - 220) {
      this.startBoss();
    }
  }

  sweepDead() {
    const live = [];
    for (const e of this.entities) {
      if (e === this.player || e.alive) { live.push(e); continue; }
      if (e.team === 'enemy') this.game.score += e.score || 100; // 撃破スコア（裏切り者含む）
    }
    this.entities = live;
  }

  updateCamera() {
    const targetX = clamp(this.player.x - VIEW_W / 2, 0, Math.max(0, this.width - VIEW_W));
    const camMax = Math.max(0, this.lockX - VIEW_W + 70);
    this.camera.x = clamp(Math.min(targetX, camMax), 0, Math.max(0, this.width - VIEW_W));
  }

  handlePlayerDeath() {
    if (this.player.alive) return;
    this.game.lives--;
    if (this.game.lives > 0) {
      const p = this.player;
      p.alive = true; p.hp = p.maxhp;
      p.x = this.camera.x + 40; p.y = FLOOR_MID; p.z = 0; p.vz = 0; p.kbx = 0;
      p.invuln = 1.6; p.state = 'idle'; p.attack = null;
    } else {
      this.game.toGameOver();
    }
  }

  update(dt) {
    this.time += dt;
    for (const e of this.entities) if (e.alive) e.update(dt, this);
    for (const p of this.projectiles) if (p.alive) p.update(dt);
    resolveMelee(this.entities, this.fx);
    resolveProjectiles(this.projectiles, this.entities, this.fx);
    this.fx.update(dt);
    this.sweepDead();
    this.checkBetrayal();
    this.updateWaves();
    this.projectiles = this.projectiles.filter(
      (p) => p.alive && p.x > this.camera.x - 40 && p.x < this.camera.x + VIEW_W + 40,
    );
    this.updateCamera();
    this.handlePlayerDeath();
    this.bannerT = Math.max(0, this.bannerT - dt);
  }

  drawBackground(ctx) {
    const cam = this.camera.x;
    const bg = this.data.bg;
    ctx.fillStyle = bg.wall; ctx.fillRect(0, 0, VIEW_W, FLOOR_TOP);
    ctx.fillStyle = bg.floor; ctx.fillRect(0, FLOOR_TOP, VIEW_W, VIEW_H - FLOOR_TOP);

    // シーン別の壁装飾（視差スクロール）
    const scene = bg.scene || 'factory';
    if (scene === 'office') this.bgOffice(ctx, cam, bg);
    else if (scene === 'meeting') this.bgMeeting(ctx, cam, bg);
    else if (scene === 'boardroom') this.bgBoardroom(ctx, cam, bg);
    else this.bgFactory(ctx, cam, bg);

    // フロア境界のアクセント
    ctx.fillStyle = bg.accent; ctx.fillRect(0, FLOOR_TOP - 2, VIEW_W, 2);
    // 床タイルの遠近線
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    const tsp = 48, foff = -(cam % tsp);
    for (let x = foff; x < VIEW_W + tsp; x += tsp) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x), FLOOR_TOP);
      ctx.lineTo(Math.round(x) - 22, VIEW_H);
      ctx.stroke();
    }
  }

  bgFactory(ctx, cam, bg) {
    // 太い鉄骨の柱とダクト
    ctx.fillStyle = bg.detail;
    const sp = 70, off = -((cam * 0.5) % sp);
    for (let x = off; x < VIEW_W + sp; x += sp) {
      ctx.fillRect(Math.round(x), 16, 26, FLOOR_TOP - 34);
      ctx.fillRect(Math.round(x) - 8, 26, 42, 6); // 横ダクト
    }
    // 上部の配管ライン
    ctx.fillStyle = bg.accent; ctx.fillRect(0, 14, VIEW_W, 2);
  }

  bgOffice(ctx, cam, bg) {
    // パーティション（キュービクル）とモニタ
    const sp = 74, off = -((cam * 0.5) % sp);
    for (let x = off; x < VIEW_W + sp; x += sp) {
      const px = Math.round(x);
      ctx.fillStyle = bg.detail;
      ctx.fillRect(px, 36, 58, FLOOR_TOP - 44);            // 間仕切り
      ctx.fillStyle = bg.accent;
      ctx.fillRect(px + 8, 52, 20, 13);                    // モニタ
      ctx.fillStyle = '#1b2733';
      ctx.fillRect(px + 10, 54, 16, 9);                    // 画面
      ctx.fillStyle = bg.detail;
      ctx.fillRect(px + 36, 70, 16, 8);                    // 書類トレイ
    }
    // 天井ライン
    ctx.fillStyle = bg.accent; ctx.fillRect(0, 24, VIEW_W, 1);
  }

  bgMeeting(ctx, cam, bg) {
    // ホワイトボードと窓が並ぶ会議室
    const sp = 150, off = -((cam * 0.5) % sp);
    for (let x = off; x < VIEW_W + sp; x += sp) {
      const px = Math.round(x);
      // ホワイトボード
      ctx.fillStyle = '#e8ece6';
      ctx.fillRect(px + 8, 40, 60, 40);
      ctx.strokeStyle = bg.detail; ctx.lineWidth = 2;
      ctx.strokeRect(px + 8, 40, 60, 40);
      ctx.strokeStyle = '#9aa6a0'; ctx.lineWidth = 1;
      ctx.beginPath(); // 殴り書きの線
      ctx.moveTo(px + 14, 52); ctx.lineTo(px + 40, 50);
      ctx.moveTo(px + 14, 60); ctx.lineTo(px + 56, 64);
      ctx.moveTo(px + 14, 70); ctx.lineTo(px + 34, 68); ctx.stroke();
      // 窓
      ctx.fillStyle = '#26323a';
      ctx.fillRect(px + 92, 38, 44, 44);
      ctx.strokeStyle = bg.accent; ctx.lineWidth = 1; ctx.strokeRect(px + 92, 38, 44, 44);
      ctx.beginPath(); ctx.moveTo(px + 114, 38); ctx.lineTo(px + 114, 82);
      ctx.moveTo(px + 92, 60); ctx.lineTo(px + 136, 60); ctx.stroke();
    }
  }

  bgBoardroom(ctx, cam, bg) {
    // 役員会議室: 一面の夜景窓 + プロジェクタ投影
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 26, VIEW_W, FLOOR_TOP - 34);
    const sp = 16, off = -((cam * 0.5) % sp);
    ctx.fillStyle = bg.accent; // 窓の桟＆遠くのビル灯り
    for (let x = off; x < VIEW_W + sp; x += sp) {
      const px = Math.round(x);
      ctx.globalAlpha = 0.5; ctx.fillRect(px, 26, 1, FLOOR_TOP - 34); ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        if (((px + i * 7) % 23) < 4) ctx.fillRect(px + 4, 40 + i * 22, 3, 3);
      }
    }
    // プロジェクタの投影面（業績資料）
    const screen = ((-cam * 0.5) % 320 + 320) % 320 + 40;
    ctx.fillStyle = 'rgba(240,235,220,0.92)';
    ctx.fillRect(Math.round(screen), 34, 90, 52);
    ctx.fillStyle = '#c0392b'; // 右肩下がりの折れ線（赤字）
    ctx.beginPath();
    ctx.moveTo(screen + 8, 50); ctx.lineTo(screen + 30, 60);
    ctx.lineTo(screen + 52, 56); ctx.lineTo(screen + 82, 78);
    ctx.lineWidth = 2; ctx.strokeStyle = '#c0392b'; ctx.stroke();
    ctx.fillStyle = '#2a2a2a'; ctx.font = '7px system-ui'; ctx.fillText('採算', screen + 8, 44);
    ctx.fillStyle = bg.accent; ctx.fillRect(0, 24, VIEW_W, 1);
  }

  render(ctx) {
    this.drawBackground(ctx);
    // 足元yで奥行きソート（下にいる者が手前）
    const order = this.entities.filter((e) => e.alive).sort((a, b) => a.y - b.y);
    for (const e of order) e.draw(ctx, this.camera.x);
    for (const p of this.projectiles) if (p.alive) p.draw(ctx, this.camera.x);
    this.fx.draw(ctx, this.camera.x);

    // 進行ロックの注意表示（殲滅するまで進めない）
    if (!this.bossStarted && this.aliveEnemies() > 0) {
      const lx = this.lockX - this.camera.x;
      if (lx > 0 && lx < VIEW_W) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,127,14,0.5)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(lx, FLOOR_TOP - 2); ctx.lineTo(lx, VIEW_H); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#ff7f0e';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('敵を殲滅せよ！', VIEW_W / 2, 52);
      ctx.textAlign = 'left';
    }

    // 徒党出現バナー
    if (this.bannerT > 0 && this.banner) {
      ctx.globalAlpha = Math.min(1, this.bannerT);
      ctx.fillStyle = 'rgba(120,16,16,0.85)';
      ctx.fillRect(0, 96, VIEW_W, 30);
      ctx.fillStyle = '#ff7f0e'; ctx.fillRect(0, 96, VIEW_W, 1); ctx.fillRect(0, 125, VIEW_W, 1);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.banner, VIEW_W / 2, 112);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }

    drawHUD(ctx, this.game, this);
  }
}

// ===== ゲーム（状態機械） =====
export class Game {
  constructor() {
    this.state = 'title';
    this.time = 0;
    this.screenT = 0;
    this.stageIndex = 0;
    this.score = 0;
    this.lives = 3;
    this.stage = null;
  }

  start() {
    this.stageIndex = 0; this.score = 0; this.lives = 3;
    this.loadStage(0);
    this.state = 'intro'; this.screenT = 0;
  }

  loadStage(i) { this.stage = new Stage(STAGES[i], this); }
  toGameOver() { this.state = 'gameover'; this.screenT = 0; }

  update(dt) {
    this.time += dt; this.screenT += dt;
    switch (this.state) {
      case 'title':
        if (Input.confirm) this.start();
        break;
      case 'intro':
        if (this.screenT > 0.3 && Input.confirm) { this.state = 'playing'; }
        break;
      case 'playing':
        this.stage.update(dt);
        if (this.stage.cleared) {
          this.state = this.stageIndex >= STAGES.length - 1 ? 'ending' : 'clear';
          this.screenT = 0;
        }
        break;
      case 'clear':
        if (this.screenT > 0.4 && Input.confirm) { this.state = 'rankup'; this.screenT = 0; }
        break;
      case 'rankup':
        if (this.screenT > 0.4 && Input.confirm) {
          this.stageIndex++;
          this.loadStage(this.stageIndex);
          this.state = 'intro'; this.screenT = 0;
        }
        break;
      case 'ending':
        if (this.screenT > 0.6 && Input.confirm) { this.state = 'title'; this.screenT = 0; }
        break;
      case 'gameover':
        if (this.screenT > 0.5 && Input.confirm) { this.state = 'title'; this.screenT = 0; }
        break;
    }
  }

  render(ctx) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (this.stage && ['playing', 'clear', 'rankup', 'intro'].includes(this.state)) {
      this.stage.render(ctx);
    } else {
      ctx.fillStyle = '#0c0e11'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    switch (this.state) {
      case 'title': drawTitle(ctx, this.time); break;
      case 'intro': drawStageIntro(ctx, this.stage, this.screenT); break;
      case 'clear': drawStageClear(ctx, this.stage, this.screenT); break;
      case 'rankup': drawRankUp(ctx, STAGES[this.stageIndex + 1]?.playerRank ?? '工場長', this.screenT); break;
      case 'ending': drawEnding(ctx, this, this.screenT); break;
      case 'gameover': drawGameOver(ctx, this, this.screenT); break;
    }
    if (this.state === 'playing') Input.drawControls(ctx); // スマホのタッチ操作UI
  }
}

// ===== 起動 & ループ =====
function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // 内部解像度を「表示サイズ × デバイス画素比」に合わせて高精細化（文字・図形がくっきり）
  function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(VIEW_W, Math.round((r.width || VIEW_W) * dpr));
    const h = Math.max(VIEW_H, Math.round((r.height || VIEW_H) * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  fitCanvas();
  addEventListener('resize', fitCanvas);
  addEventListener('orientationchange', fitCanvas);

  buildSprites();
  Input.init();
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('touch') === '1') {
    Input.forceTouch = true; // デバッグ用にPCでもタッチUIを表示
  }
  Input.initTouch(canvas);
  const game = new Game();

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();

  function loop(now) {
    requestAnimationFrame(loop);
    let frame = (now - last) / 1000;
    last = now;
    if (frame > 0.25) frame = 0.25; // スパイラル防止
    acc += frame;
    while (acc >= STEP) {
      game.update(STEP);
      Input.endFrame(); // エッジ入力は1ステップで消費
      acc -= STEP;
    }
    fitCanvas();
    // 論理座標(480x270)で描けるよう内部解像度に合わせて拡大変換
    ctx.setTransform(canvas.width / VIEW_W, 0, 0, canvas.height / VIEW_H, 0, 0);
    ctx.imageSmoothingEnabled = false; // ドット絵は補間しない（高DPIでもくっきり）
    game.render(ctx);
  }
  requestAnimationFrame(loop);
}

// ブラウザ環境でのみ自動起動（Nodeでのヘッドレステストでは起動しない）
if (typeof document !== 'undefined' && document.getElementById && document.getElementById('game')) {
  boot();
}

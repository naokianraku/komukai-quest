// Komukai Quest — 起動・ゲームループ・状態機械・ステージ進行
import {
  VIEW_W, VIEW_H, FLOOR_TOP, FLOOR_BOTTOM, clamp, dist2,
} from './config.js';
import { Input } from './input.js';
import { buildSprites } from './sprites.js';
import { Player, Char, Projectile } from './entities.js';
import { resolveMelee, resolveProjectiles, Fx } from './combat.js';
import { STAGES, SHUKKOU_STAGE, defFor } from './stages.js';
import {
  drawHUD, drawTitle, drawStageIntro, drawStageClear,
  drawRankUp, drawEnding, drawGameOver, DIFF_BUTTONS, MUTE_BUTTON,
  PAUSE_BUTTON, drawPauseButton, drawPauseOverlay,
} from './ui.js';
import { Audio } from './audio.js';

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
    this.bannerColor = 'rgba(120,16,16,0.88)';
    this.location = data.location || '';
    if (this.location) { this.banner = this.location; this.bannerColor = 'rgba(22,42,74,0.92)'; this.bannerT = 2.8; } // 開始時に現在地表示
    this.door = data.door ? { x: data.door.x, y: FLOOR_TOP + 14, used: false } : null;
    this.detourRequested = false;
    this.isDetour = false;

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

  spawnPlayerProjectile(p) {
    const dir = p.facing || 1;
    this.projectiles.push(new Projectile(
      p.x + dir * 10, p.y, dir * 230, 0, 'player',
      { kind: 'tool', dmg: 1, kb: 80, w: 5 },
    ));
  }

  spawnProjectile(thrower, target) {
    const dirx = Math.sign(target.x - thrower.x) || 1;
    if (thrower.projKind === 'missile') {
      this.projectiles.push(new Projectile(
        thrower.x + dirx * 10, thrower.y, dirx * 200, 0, thrower.team,
        { kind: 'missile', dmg: 2, kb: 130, w: 8, homing: true, target },
      ));
    } else {
      const vy = clamp(target.y - thrower.y, -28, 28);
      this.projectiles.push(new Projectile(
        thrower.x + dirx * 8, thrower.y, dirx * 150, vy, thrower.team,
        { kind: 'paper', dmg: 1, kb: 70, w: 5 },
      ));
    }
  }

  spawnWave(w) {
    // 種別を1つの配列に展開してから、横にも奥行きにも広く散らして配置
    // 地獄モードは雑魚（ボス/中ボス/elite以外）の数を2倍にする
    const hell = this.game && this.game.difficulty === 'hell';
    const list = [];
    for (const g of w.enemies) {
      const d = defFor(g.type);
      const reps = (hell && !d.boss && !d.midboss && !d.elite) ? g.count * 2 : g.count;
      for (let k = 0; k < reps; k++) list.push(g.type);
    }
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
    if (this.data.coBoss) { // ボスと一緒に出る強敵（例: 技師長と生産部長）
      this.entities.push(new Char(this.width - 110, FLOOR_MID + 20, defFor(this.data.coBoss)));
    }
    if (this.data.bossLocation) { // 例: 事業部長は本社へ
      this.location = this.data.bossLocation;
      this.banner = this.data.bossLocation; this.bannerColor = 'rgba(22,42,74,0.92)'; this.bannerT = 2.8;
    }
  }

  checkBetrayal() {
    // ボスの直前まで来たら PJメンバは全員自動的に裏切る（出向先など味方不在のステージは対象なし）
    const nearBoss = this.player.x > this.width - 320;
    for (const e of this.entities) {
      if (e.team !== 'ally' || e.betrayed) continue;
      let fire = nearBoss;
      const tr = e.betrayTrigger;
      if (!fire && e.betrayer && tr) {
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
        if (w.label) { this.banner = w.label; this.bannerColor = 'rgba(120,16,16,0.88)'; this.bannerT = 2.6; } // 徒党出現バナー
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
    // 「出向」の扉に触れたら分岐をリクエスト
    if (this.door && !this.door.used &&
        Math.abs(this.player.x - this.door.x) < 16 && Math.abs(this.player.y - this.door.y) < 22) {
      this.door.used = true;
      this.detourRequested = true;
    }
  }

  drawBackground(ctx) {
    const cam = this.camera.x;
    const bg = this.data.bg;
    ctx.fillStyle = bg.wall; ctx.fillRect(0, 0, VIEW_W, FLOOR_TOP);
    ctx.fillStyle = bg.floor; ctx.fillRect(0, FLOOR_TOP, VIEW_W, VIEW_H - FLOOR_TOP);

    // シーン別の壁装飾（視差スクロール）
    const scene = bg.scene || 'factory';
    if (scene === 'office') this.bgOffice(ctx, cam, bg);
    else if (scene === 'office_win') this.bgOfficeWin(ctx, cam, bg);
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

  bgOfficeWin(ctx, cam, bg) {
    // 外が見える大きな窓（空＋遠景ビル、視差）
    const sp = 132, off = -((cam * 0.45) % sp);
    for (let x = off - sp; x < VIEW_W + sp; x += sp) {
      const px = Math.round(x), wx = px + 14, wy = 22, ww = 104, wh = 116;
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#7fb0d8'); sky.addColorStop(1, '#bcd6ea');
      ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#9fb6c8'; // 遠景ビル
      ctx.fillRect(wx + 8, wy + 46, 22, wh - 46);
      ctx.fillRect(wx + 40, wy + 64, 26, wh - 64);
      ctx.fillRect(wx + 74, wy + 34, 20, wh - 34);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let yy = wy + 52; yy < wy + wh - 6; yy += 12) { ctx.fillRect(wx + 12, yy, 4, 5); ctx.fillRect(wx + 46, yy, 4, 5); ctx.fillRect(wx + 78, yy, 4, 5); }
      ctx.strokeStyle = bg.detail; ctx.lineWidth = 3; ctx.strokeRect(wx, wy, ww, wh);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    }
    ctx.fillStyle = bg.accent; ctx.fillRect(0, 16, VIEW_W, 2); // 天井ライン
    // オフィス机（壁際・視差）
    const dsp = 92, doff = -((cam * 0.7) % dsp);
    for (let x = doff - dsp; x < VIEW_W + dsp; x += dsp) {
      const px = Math.round(x);
      ctx.fillStyle = '#3a2f24'; ctx.fillRect(px + 6, 158, 64, 4);
      ctx.fillStyle = '#7a6448'; ctx.fillRect(px + 6, 150, 64, 9);
      ctx.fillStyle = '#5b4a34'; ctx.fillRect(px + 10, 159, 6, 14); ctx.fillRect(px + 60, 159, 6, 14);
      ctx.fillStyle = '#23272e'; ctx.fillRect(px + 24, 136, 22, 15); // モニタ
      ctx.fillStyle = '#3a6e8c'; ctx.fillRect(px + 26, 138, 18, 11);
    }
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

  drawDoor(ctx) {
    if (!this.door) return;
    const sx = this.door.x - this.camera.x;
    if (sx < -30 || sx > VIEW_W + 30) return;
    const baseY = this.door.y, w = 26, h = 46;
    const x = Math.round(sx - w / 2), y = Math.round(baseY - h);
    ctx.fillStyle = '#caa15a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); // 金枠
    ctx.fillStyle = '#14110d'; ctx.fillRect(x, y, w, h);                 // 暗い開口
    ctx.strokeStyle = '#ff7f0e'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // プレート「出向」
    ctx.fillStyle = '#ff7f0e'; ctx.fillRect(x - 4, y - 14, w + 8, 12);
    ctx.fillStyle = '#15171a'; ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('出向', x + w / 2, y - 8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // 足元の点滅マーカー（ここに触れろ）
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(this.time * 5);
    ctx.fillStyle = '#ff7f0e'; ctx.fillRect(Math.round(sx - 9), Math.round(baseY + 1), 18, 2);
    ctx.globalAlpha = 1;
  }

  render(ctx) {
    this.drawBackground(ctx);
    this.drawDoor(ctx);
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
      ctx.fillStyle = this.bannerColor || 'rgba(120,16,16,0.85)';
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
    this.savedStage = null; // 出向中に本社(Stage3)を退避
    this.difficulty = 'normal'; // 'normal' | 'easy'
    this.paused = false;
  }

  applyDifficulty() {
    if (this.stage && this.stage.player) this.stage.player.ranged = (this.difficulty === 'easy');
  }

  enterDetour() {
    const hp = this.stage.player.hp;
    this.savedStage = this.stage;
    this.stage = new Stage(SHUKKOU_STAGE, this);
    this.stage.isDetour = true;
    this.stage.player.hp = Math.max(5, Math.min(hp, this.stage.player.maxhp)); // HPを引き継ぐ
    this.applyDifficulty();
    this.state = 'intro'; this.screenT = 0;
  }

  returnFromDetour() {
    const hp = this.stage.player.hp;
    const back = this.savedStage;
    this.savedStage = null;
    back.player.hp = Math.max(5, hp);
    back.player.x = back.door.x + 34; // 扉の先へ
    back.player.invuln = 1.4;
    back.detourRequested = false;
    back.banner = '出向先を制圧！' + (back.location || '本社') + 'へ帰還'; back.bannerColor = 'rgba(22,42,74,0.92)'; back.bannerT = 2.6;
    this.stage = back;
    this.state = 'playing'; this.screenT = 0; this.paused = false;
  }

  start() {
    this.stageIndex = 0; this.score = 0;
    this.lives = this.difficulty === 'easy' ? 6 : this.difficulty === 'hell' ? 2 : 3;
    this.loadStage(0);
    this.state = 'intro'; this.screenT = 0;
  }

  loadStage(i) { this.stage = new Stage(STAGES[i], this); this.applyDifficulty(); }
  toGameOver() { this.state = 'gameover'; this.screenT = 0; }

  update(dt) {
    this.time += dt; this.screenT += dt;
    if (Input.pressed('KeyM')) Audio.toggleMute(); // どの画面でもMでミュート切替
    switch (this.state) {
      case 'title': {
        // 難易度切替（キーボード ←→↑↓ / WASD）
        const DIFFS = ['normal', 'easy', 'hell'];
        if (Input.pressed('ArrowRight', 'ArrowDown', 'KeyD', 'KeyS')) {
          this.difficulty = DIFFS[(DIFFS.indexOf(this.difficulty) + 1) % DIFFS.length];
        } else if (Input.pressed('ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW')) {
          this.difficulty = DIFFS[(DIFFS.indexOf(this.difficulty) + 2) % DIFFS.length];
        }
        const tap = Input.consumeTap();
        if (tap) {
          const inB = (b) => tap.x >= b.x && tap.x <= b.x + b.w && tap.y >= b.y && tap.y <= b.y + b.h;
          if (inB(MUTE_BUTTON)) { Audio.toggleMute(); }            // BGMミュート（開始しない）
          else if (inB(DIFF_BUTTONS.easy)) { this.difficulty = 'easy'; this.start(); }
          else if (inB(DIFF_BUTTONS.normal)) { this.difficulty = 'normal'; this.start(); }
          else if (inB(DIFF_BUTTONS.hell)) { this.difficulty = 'hell'; this.start(); }
          else this.start(); // ボタン以外のタップは現在の難易度で開始
        } else if (Input.confirm) {
          this.start();
        }
        break;
      }
      case 'intro':
        if (this.screenT > 0.3 && Input.confirm) { this.state = 'playing'; this.paused = false; }
        break;
      case 'playing': {
        // 一時停止トグル（Pキー / Escape / 画面のボタン）
        let togglePause = Input.pressed('KeyP', 'Escape');
        const ptap = Input.consumeTap();
        if (ptap) {
          const b = PAUSE_BUTTON;
          if (ptap.x >= b.x && ptap.x <= b.x + b.w && ptap.y >= b.y && ptap.y <= b.y + b.h) togglePause = true;
        }
        if (togglePause) { this.paused = !this.paused; Audio.setMusicPaused(this.paused); }
        if (this.paused) break; // 停止中は更新しない
        this.stage.update(dt);
        if (this.stage.detourRequested && !this.stage.isDetour) {
          this.enterDetour();               // 「出向」の扉に触れた → 関連会社へ
        } else if (this.stage.cleared) {
          if (this.stage.isDetour) {
            this.returnFromDetour();         // 関連会社を制圧 → 本社(Stage3)へ帰還
          } else {
            this.state = this.stageIndex >= STAGES.length - 1 ? 'ending' : 'clear';
            this.screenT = 0;
          }
        }
        break;
      }
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
    this.updateAudio();
  }

  updateAudio() {
    let track = 'stage';
    if (this.state === 'title') track = 'title';
    else if (this.state === 'ending') track = 'ending';
    else if (this.state === 'gameover') track = 'gameover';
    else if (this.state === 'playing' && this.stage && this.stage.boss && this.stage.boss.alive) track = 'boss';
    Audio.play(track);
  }

  render(ctx) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (this.stage && ['playing', 'clear', 'rankup', 'intro'].includes(this.state)) {
      this.stage.render(ctx);
    } else {
      ctx.fillStyle = '#0c0e11'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    switch (this.state) {
      case 'title': drawTitle(ctx, this.time, this.difficulty, Audio.muted); break;
      case 'intro': drawStageIntro(ctx, this.stage, this.screenT); break;
      case 'clear': drawStageClear(ctx, this.stage, this.screenT); break;
      case 'rankup': drawRankUp(ctx, STAGES[this.stageIndex + 1]?.playerRank ?? '工場長', this.screenT); break;
      case 'ending': drawEnding(ctx, this, this.screenT); break;
      case 'gameover': drawGameOver(ctx, this, this.screenT); break;
    }
    if (this.state === 'playing') {
      Input.drawControls(ctx); // スマホのタッチ操作UI
      drawPauseButton(ctx, this.paused);
      if (this.paused) drawPauseOverlay(ctx);
    }
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
  // 自動再生規制対応: 初回操作でBGMを開始
  const resumeAudio = () => Audio.resume();
  addEventListener('keydown', resumeAudio, { once: true });
  addEventListener('pointerdown', resumeAudio, { once: true });
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

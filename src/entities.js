// エンティティ: 基底 / プレイヤー(小向戦士) / AIキャラ(敵・味方・ボス) / 投擲物
import {
  GRAVITY, FLOOR_TOP, FLOOR_BOTTOM, DEPTH_TOL, VIEW_W, CHAR_SCALE,
  clamp, sign, nextId,
} from './config.js';
import { drawSprite, SPRITE_W, SPRITE_H, TYPE_LABEL, TYPE_COLOR } from './sprites.js';
import { randomTaunt } from './taunts.js';
import { Input } from './input.js';

function drawShadow(ctx, sx, y, w) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(Math.round(sx), Math.round(y), Math.max(5, w * 0.6), 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFist(ctx, sx, footY, facing, scale) {
  const off = (SPRITE_W / 2) * scale + 6 * scale;
  const fx = facing > 0 ? sx + off : sx - off;
  const fy = footY - 10 * scale;
  // インパクトの閃光（星形バースト）
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff0c0';
  ctx.beginPath();
  const r = 8 * scale;
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    const px = fx + Math.cos(a) * rr, py = fy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.95; ctx.fillStyle = '#ff9c2a';
  ctx.beginPath(); ctx.arc(fx, fy, 2.6 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 拳（大きめ）
  const s = Math.round(5 * scale);
  ctx.fillStyle = '#f1c79b';
  ctx.fillRect(Math.round(fx - s / 2), Math.round(fy - s / 2), s, s);
  ctx.strokeStyle = '#0d1118'; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(fx - s / 2) + 0.5, Math.round(fy - s / 2) + 0.5, s - 1, s - 1);
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 頭上の「言葉の暴力」吹き出し
function drawSpeechBubble(ctx, cx, bottomY, text, big) {
  ctx.font = (big ? 'bold 14px' : 'bold 11px') + ' system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const w = Math.ceil(tw) + 10;
  const h = big ? 19 : 16;
  let x = Math.round(cx - w / 2);
  x = Math.max(2, Math.min(x, VIEW_W - w - 2));
  const y = Math.round(bottomY - h - 4);
  ctx.fillStyle = big ? '#fff3e0' : '#ffffff';
  ctx.strokeStyle = big ? '#ff7f0e' : '#10141c';
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  ctx.fill(); ctx.stroke();
  // 吹き出しの三角（キャラ側へ）
  ctx.beginPath();
  ctx.moveTo(clamp(cx, x + 4, x + w - 8) - 3, y + h);
  ctx.lineTo(clamp(cx, x + 4, x + w - 8) + 3, y + h);
  ctx.lineTo(clamp(cx, x + 4, x + w - 8), y + h + 4);
  ctx.closePath();
  ctx.fillStyle = big ? '#fff3e0' : '#ffffff'; ctx.fill();
  ctx.fillStyle = '#10141c';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// 役職ラベル（頭上の小さな名札）
function drawLabel(ctx, cx, topY, text, color) {
  ctx.font = 'bold 8px system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const w = Math.ceil(tw) + 6, h = 10;
  let x = Math.round(cx - w / 2);
  x = Math.max(1, Math.min(x, VIEW_W - w - 1));
  const y = Math.round(topY - h);
  ctx.fillStyle = 'rgba(13,17,24,0.82)';
  roundRectPath(ctx, x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

export class Entity {
  constructor(x, y) {
    this.id = nextId();
    this.x = x; this.y = y; this.z = 0;
    this.vz = 0; this.kbx = 0;
    this.facing = 1; this.w = 10; this.scale = 1;
    this.hp = 1; this.maxhp = 1;
    this.team = 'enemy';
    this.alive = true;
    this.invuln = 0; this.hitstun = 0;
    this.animT = 0; this.moving = false;
    this.state = 'idle'; this.stateT = 0;
    this.attackActive = false; this.attack = null;
    this.isBoss = false;
    this.spriteKey = 'buka';
    this.maxX = 1e9;
    this.taunt = null; this.tauntT = 0;   // 言葉の暴力（吹き出し）
  }

  integrate(dt) {
    // ノックバック減衰
    this.x += this.kbx * dt;
    this.kbx *= Math.pow(0.0008, dt);
    if (Math.abs(this.kbx) < 2) this.kbx = 0;
    // ジャンプ / 重力 (高さ z)
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }
    // クランプ
    this.y = clamp(this.y, FLOOR_TOP, FLOOR_BOTTOM);
    this.x = clamp(this.x, 8, this.maxX);
    // タイマー
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitstun = Math.max(0, this.hitstun - dt);
    this.tauntT = Math.max(0, this.tauntT - dt);
    if (this.tauntT === 0) this.taunt = null;
    this.animT += dt;
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    // 歩行の上下バウンド
    const bob = this.moving && this.z === 0 ? (Math.floor(this.animT * 10) % 2) : 0;
    const footY = this.y - this.z - bob;
    drawShadow(ctx, sx, this.y, this.w * this.scale);
    const blink = this.invuln > 0 && Math.floor(this.animT * 30) % 2 === 0;
    drawSprite(ctx, this.spriteKey, sx, footY, this.facing, this.scale, blink);
    const headTop = footY - SPRITE_H * this.scale;
    if (!blink) {
      if (this.attackActive) drawFist(ctx, sx, footY, this.facing, this.scale);
      this.drawHpBar(ctx, sx, footY);
      this.drawTag(ctx, sx, headTop);   // 役職ラベル / プレイヤーマーカー
    }
    // 吹き出しは点滅中も出す（言葉の暴力は止まらない）。役職ラベルの上に出す。
    if (this.taunt) drawSpeechBubble(ctx, sx, headTop - 11, this.taunt, this.isBoss);
  }

  drawHpBar() {}
  drawTag() {}
}

export class Player extends Entity {
  constructor(x, y) {
    super(x, y);
    this.team = 'player';
    this.spriteKey = 'player';
    this.scale = CHAR_SCALE;
    this.w = 12 * CHAR_SCALE;
    this.maxhp = 12; this.hp = 12;
    this.speed = 86;
    this.combo = 0;
    this.attackData = null;
  }

  update(dt, stage) {
    this.maxX = stage.lockX;
    this.attackActive = false;

    if (this.state === 'attack') {
      this.stateT -= dt;
      this.attackActive = this.stateT < 0.20 && this.stateT > 0.06;
      this.attack = this.attackActive ? this.attackData : null;
      if (this.stateT <= 0) { this.state = 'idle'; this.attack = null; }
    }

    if (this.hitstun > 0) { this.integrate(dt); return; }

    // 攻撃開始（接地時のみ）
    if (Input.attack && this.state !== 'attack' && this.z === 0) {
      this.state = 'attack'; this.stateT = 0.30;
      this.combo = (this.combo + 1) % 3;
      const kb = this.combo === 2 ? 220 : 150; // 3段目は強ノックバック
      this.attackData = { reach: 27 * CHAR_SCALE, dmg: 1, kb, hitSet: new Set() };
    }

    // ジャンプ
    if (Input.jump && this.z === 0 && this.state !== 'attack') this.vz = 205;

    // 移動（攻撃中は不可）
    let mx = 0, my = 0;
    if (this.state !== 'attack') {
      if (Input.left) mx -= 1;
      if (Input.right) mx += 1;
      if (Input.up) my -= 1;
      if (Input.down_) my += 1;
    }
    if (mx || my) {
      const n = Math.hypot(mx, my) || 1;
      this.x += (mx / n) * this.speed * dt;
      this.y += (my / n) * this.speed * dt;
      if (mx) this.facing = sign(mx);
      this.moving = true;
    } else {
      this.moving = false;
    }
    this.integrate(dt);
  }

  // 自分の位置が分かるよう、頭上に橙の下向き三角マーカー
  drawTag(ctx, sx, headTop) {
    const bob = Math.sin(this.animT * 6) * 1.2;
    const y = Math.round(headTop - 5 + bob);
    const x = Math.round(sx);
    ctx.fillStyle = '#ff7f0e';
    ctx.strokeStyle = '#0d1118';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4);
    ctx.lineTo(x + 4, y - 4);
    ctx.lineTo(x, y + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
}

export class Char extends Entity {
  constructor(x, y, def) {
    super(x, y);
    this.team = def.team || 'enemy';
    this.spriteKey = def.sprite;
    this.typeName = def.name;
    this.maxhp = def.hp; this.hp = def.hp;
    this.speed = def.speed;
    this.atkReach = (def.reach || 22) * CHAR_SCALE;
    this.atkDmg = def.dmg || 1;
    this.atkKb = def.kb || 90;
    this.cooldown = def.cooldown || 0.7;
    this.telegraph = def.telegraph || 0.32;
    this.active = def.activeDur || 0.14;
    this.thrower = !!def.thrower;
    this.projKind = def.proj || 'paper';
    this.projRange = def.projRange || 210;
    this.throwCooldown = def.throwCooldown || 1.6;
    this.isBoss = !!def.boss;
    this.score = def.score || 100;
    this.scale = (def.scale || 1) * CHAR_SCALE;
    this.w = 12 * this.scale;
    this.thinkT = 0.2 + (this.id % 5) * 0.06;
    this.throwT = 1 + (this.id % 4) * 0.4;
    this.betrayer = !!def.betrayer;
    this.betrayTrigger = def.trigger || null;
    this.betrayed = false;
    this.tauntCat = def.taunts || null;
    this.fumbleT = 7 + (this.id % 6); // 味方のうっかり攻撃までの時間
  }

  setTaunt(extra = 0.4) {
    if (!this.tauntCat) return;
    this.taunt = randomTaunt(this.tauntCat);
    this.tauntT = this.telegraph + this.active + extra;
  }

  update(dt, stage) {
    this.attackActive = false;
    this.advanceFSM(dt);
    if (this.team === 'ally' && !this.betrayed) this.tryFumble(dt, stage);
    if (!this.isBoss && this.hitstun <= 0) this.separate(dt, stage); // 間隔保持（固まり防止）

    if (this.hitstun > 0) { this.integrate(dt); return; }
    if (this.state !== 'idle') { this.integrate(dt); return; } // 予備/攻撃/硬直中は動かない

    const target = this.team === 'enemy' ? stage.player : stage.nearestEnemy(this);
    if (!target || !target.alive) {
      if (this.team === 'ally') this.followPlayer(dt, stage);
      this.integrate(dt);
      return;
    }

    const dx = target.x - this.x, dy = target.y - this.y;
    this.facing = sign(dx) || this.facing;
    const inRange = Math.abs(dx) <= this.atkReach * 0.9 && Math.abs(dy) <= DEPTH_TOL;

    // 飛び道具（スタッフ=書類 / 携行ミサイル兵=誘導弾）
    this.throwT -= dt;
    const aligned = this.projKind === 'missile' || Math.abs(dy) < DEPTH_TOL + 5; // ミサイルは誘導なので奥行きズレOK
    if (this.thrower && this.team === 'enemy' && !inRange && aligned &&
        Math.abs(dx) < this.projRange && this.throwT <= 0) {
      stage.spawnProjectile(this, target);
      this.setTaunt(0.6); // 撃ちながら一言
      this.throwT = this.throwCooldown + (this.id % 3) * 0.4;
    }

    if (inRange) {
      this.startAttack();
    } else if (this.projKind === 'missile' && Math.abs(dx) < 130) {
      // ミサイル兵は近すぎると離れて撃つ（カイト）。ただし画面内＆到達可能な範囲に留める
      const nx = -sign(dx) || -1;
      const ny = Math.abs(dy) > 6 ? sign(dy) : 0;
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * 0.5 * dt;
      this.x = clamp(this.x, stage.camera.x + 16, stage.lockX + 8); // 壁際で必ず届く範囲に留める
      this.moving = true;
    } else {
      const nx = Math.abs(dx) > 3 ? sign(dx) : 0;
      const ny = Math.abs(dy) > 3 ? sign(dy) : 0;
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
      this.moving = !!(nx || ny);
    }
    this.integrate(dt);
  }

  // 同じ陣営の仲間と重ならないよう、近すぎる相手から少し離れる（取り囲み＝固まり防止）
  separate(dt, stage) {
    let px = 0, py = 0, cnt = 0;
    const R = 22;
    for (const o of stage.entities) {
      if (o === this || !o.alive || o.isBoss || o.team !== this.team) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.001) { const f = (R - d) / R; px += (dx / d) * f; py += (dy / d) * f; cnt++; }
    }
    if (cnt) { this.x += px * 55 * dt; this.y += py * 55 * dt; }
  }

  followPlayer(dt, stage) {
    const p = stage.player;
    const tx = p.x - 26 * p.facing;
    const dx = tx - this.x, dy = p.y - this.y;
    if (Math.abs(dx) > 6) { this.x += sign(dx) * this.speed * 0.8 * dt; this.facing = sign(dx) || this.facing; this.moving = true; }
    else this.moving = false;
    if (Math.abs(dy) > 4) this.y += sign(dy) * this.speed * 0.8 * dt;
  }

  startAttack() {
    this.state = 'telegraph'; this.stateT = this.telegraph; this.moving = false;
    if (this.team === 'enemy') this.setTaunt(); // 攻撃と同時に言葉の暴力
  }

  // 味方のうっかり攻撃: 時々、後ろから意図しない一撃を入れてくる（言い訳つき）
  tryFumble(dt, stage) {
    this.fumbleT -= dt;
    if (this.fumbleT > 0) return;
    const p = stage.player;
    if (!p || !p.alive || Math.hypot(p.x - this.x, p.y - this.y) > 80) { this.fumbleT = 1.5; return; }
    if (p.invuln <= 0) {
      p.hp -= 1;
      p.kbx += (sign(p.x - this.x) || 1) * 130; // 後ろから押し出す
      p.hitstun = 0.16; p.invuln = 0.5;
      stage.fx.hit(p.x, p.y - 9, '#9fe0ff');       // 青系＝同士討ち
      stage.fx.text(p.x, p.y - SPRITE_H, 'うっかり -1', '#9fe0ff');
    }
    this.taunt = randomTaunt('ally_blunder');
    this.tauntT = 1.8;
    this.facing = sign(p.x - this.x) || this.facing;
    this.fumbleT = 11 + (this.id % 6) + Math.random() * 4; // 次は時々（10〜21秒後）
  }

  advanceFSM(dt) {
    if (this.state === 'idle') return;
    this.stateT -= dt;
    if (this.state === 'telegraph' && this.stateT <= 0) {
      this.state = 'attack'; this.stateT = this.active;
      this.attack = { reach: this.atkReach, dmg: this.atkDmg, kb: this.atkKb, hitSet: new Set() };
    } else if (this.state === 'attack') {
      this.attackActive = true;
      if (this.stateT <= 0) { this.state = 'recover'; this.stateT = this.cooldown; this.attack = null; }
    } else if (this.state === 'recover' && this.stateT <= 0) {
      this.state = 'idle';
    }
  }

  // 頭上に役職名の名札（ボス以外）。識別できるように。
  drawTag(ctx, sx, headTop) {
    if (this.isBoss) return;
    let text, color;
    if (this.betrayed) { text = '裏切り者'; color = '#ff5a5a'; }
    else { text = TYPE_LABEL[this.spriteKey]; color = TYPE_COLOR[this.spriteKey]; }
    if (!text) return;
    drawLabel(ctx, sx, headTop - 1, text, color);
  }

  drawHpBar(ctx, sx, footY) {
    if (this.isBoss || this.hp >= this.maxhp) return;
    const w = 14 * this.scale, h = 2;
    const top = footY - SPRITE_H * this.scale - 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(sx - w / 2) - 1, Math.round(top) - 1, w + 2, h + 2);
    ctx.fillStyle = '#c73333';
    ctx.fillRect(Math.round(sx - w / 2), Math.round(top), w, h);
    ctx.fillStyle = '#389451';
    ctx.fillRect(Math.round(sx - w / 2), Math.round(top), w * (this.hp / this.maxhp), h);
  }
}

export class Projectile {
  constructor(x, y, vx, vy, team, opts = {}) {
    this.id = nextId();
    this.x = x; this.y = y; this.z = 0;
    this.vx = vx; this.vy = vy;
    this.team = team;
    this.kind = opts.kind || 'paper';
    this.dmg = opts.dmg ?? 1;
    this.kb = opts.kb ?? 70;
    this.w = opts.w ?? 5;
    this.homing = !!opts.homing;
    this.target = opts.target || null;
    this.life = this.kind === 'missile' ? 4 : 3;
    this.age = 0;
    this.alive = true;
  }

  update(dt) {
    this.age += dt;
    if (this.homing && this.target && this.target.alive) {
      // 奥行きを誘導弾としてじわっと標的のyへ寄せる
      const dy = this.target.y - this.y;
      this.vy = clamp(this.vy + clamp(dy, -1, 1) * 130 * dt, -64, 64);
      const dirx = sign(this.target.x - this.x) || sign(this.vx) || 1;
      this.vx = clamp(this.vx + dirx * 44 * dt, -260, 260);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    if (this.kind === 'missile') {
      const dir = this.vx >= 0 ? 1 : -1;
      const sy = this.y - 12;
      // 炎・煙の尾
      ctx.save();
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ff9c2a';
      ctx.fillRect(Math.round(sx - dir * 8), Math.round(sy), 5, 4);
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#cfcfcf';
      ctx.fillRect(Math.round(sx - dir * 13), Math.round(sy + 1), 5, 3);
      ctx.restore();
      // 弾体
      ctx.fillStyle = '#3a3f48';
      ctx.fillRect(Math.round(sx - 5), Math.round(sy), 10, 4);
      ctx.fillStyle = '#c73333'; // 弾頭
      ctx.fillRect(Math.round(sx + dir * 4), Math.round(sy), 3, 4);
    } else {
      const x0 = Math.round(sx) - 2, sy = Math.round(this.y - 10);
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x0, sy, 6, 4);   // 書類
      ctx.fillStyle = '#b8b2a0'; ctx.fillRect(x0, sy, 6, 1);
    }
  }
}

// エンティティ: 基底 / プレイヤー(小向戦士) / AIキャラ(敵・味方・ボス) / 投擲物
import {
  GRAVITY, VIEW_W, CHAR_SCALE, PLAY,
  clamp, sign, nextId,
} from './config.js';
import { drawSprite, SPRITE_W, SPRITE_H, TYPE_LABEL, TYPE_COLOR } from './sprites.js';
import { randomTaunt } from './taunts.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

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
  ctx.fillStyle = color || '#e6e9ec'; // 色未定義でも黒文字にならないよう明色フォールバック
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
    this.y = clamp(this.y, PLAY.top, PLAY.bottom); // 歩ける奥行き帯（3Dでは広げる）
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
    this.ranged = false; // かんたんモードで true: 攻撃時に飛び道具も出す
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
      if (this.ranged && stage.spawnPlayerProjectile) stage.spawnPlayerProjectile(this);
      Audio.sfxSwing(); // 攻撃の振り音
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
    // 攻撃の間も個体差をつける。全員が同じ拍で振りかぶると、壁が迫ってくるように見える。
    // ボスだけは読んで避ける相手なので、拍を揺らさず def のままにする。
    const rv = def.boss ? 1 : 0.82 + (this.id % 6) * 0.072;   // 0.82〜1.18
    const rw = def.boss ? 1 : 0.86 + (this.id % 5) * 0.07;    // 0.86〜1.14
    this.cooldown = (def.cooldown || 0.7) * rv;
    this.telegraph = (def.telegraph || 0.32) * rw;
    this.active = def.activeDur || 0.14;
    this.thrower = !!def.thrower;
    this.passive = !!def.passive; // true=攻撃してこない（近づくが殴らない）
    this.projKind = def.proj || 'paper';
    this.projRange = def.projRange || 210;
    this.throwCooldown = def.throwCooldown || 1.6;
    // メテオ（魔王Y下の大技）。def に無ければ一切撃たない＝他のキャラの挙動は変わらない。
    this.meteorDef = def.meteor || null;
    this.meteorT = this.meteorDef ? this.meteorDef.first ?? 4.5 : 0;
    // 倒されると跡を継ぐ者（管理担当K → 息子）。def に無ければ誰も出てこない。
    this.heir = def.heir || null;
    // ランドセル。3D版だけ背中に足す（2D版のドット絵には出ない）。
    this.satchel = !!def.satchel;
    // 捨てセリフ。これがある相手は、HPが尽きても即座には消えず、膝をついて一言残してから倒れる。
    // 無ければ従来どおりその場で消える（雑魚の倒れ方は変わらない）。
    this.lastLine = def.lastLine || null;
    // 崩れ落ちる時間。ボスは「ガラガラと」見せたいので長め、中ボスは短め。
    this.downDur = def.downDur ?? (def.boss ? 3.4 : 2.6);
    this.dying = false; this.downT = 0;
    // 大振り（中村の一升瓶の振り回し）。これも def に無ければ一切出さない。
    this.swingDef = def.swing || null;
    this.swingT = this.swingDef ? (this.swingDef.first ?? 3.0) : 0;
    this.swinging = false;
    // 3D版の体型の倍率。2D版はドット絵が固定なので参照しない（未指定なら1＝従来と同じ）。
    this.bodyW = def.bodyW || 1;
    this.bodyH = def.bodyH || 1;
    this.isBoss = !!def.boss;
    this.midboss = !!def.midboss;   // 道中の強敵。3D版のゲージ表示に使う（2D版は参照しない）
    this.score = def.score || 100;
    this.scale = (def.scale || 1) * CHAR_SCALE;
    this.w = 12 * this.scale;
    // --- 動きの癖（id から決まるので、同じ個体はずっと同じ動き方をする）---
    // 全員が最短距離をまっすぐ同じ速さで来ると、隊列行進のように見える。
    this.moveStyle = this.id % 4;                  // 0=直進 1=回り込み 2=ためらい 3=早足
    this.speedMul = 0.84 + (this.id % 7) * 0.055;  // 足の速さ 0.84〜1.17倍
    this.standY = ((this.id % 5) - 2) * 7;         // 詰める先の奥行きをずらす（一点に集まらない）
    this.weaveA = 10 + (this.id % 3) * 7;          // 蛇行の振れ
    this.weaveW = 1.5 + (this.id % 4) * 0.45;      // 蛇行の速さ
    this.hesitT = 0;
    this.thinkT = 0.2 + (this.id % 5) * 0.06;
    this.throwT = 1 + (this.id % 4) * 0.4;
    this.betrayer = !!def.betrayer;
    this.betrayTrigger = def.trigger || null;
    this.betrayed = false;
    this.tauntCat = def.taunts || null;
    // --- 続編(game2)用フラグ。未指定なら1の挙動と完全に同じ ---
    this.noFumble = !!def.noFumble;     // 味方のうっかり攻撃をしない（同期）
    this.noBetray = !!def.noBetray;     // 絶対に裏切らない（同期）
    this.hideHpBar = !!def.hideHpBar;   // ボスHPバーを隠す（L社＝情報が出ない）
    this.noKb = !!def.noKb;             // 怯まない（なめている＝振り向かない段階）
    this.faceLock = def.faceLock ?? null; // 顔を向けない（null=通常, -1/1=固定）
    this.wanderT = 0.4 + (this.id % 7) * 0.3; // mob の徘徊タイマ
    this.dmgTakenMul = 1;               // 被ダメ倍率（代理店が間に立つと下がる）
    this.fumbleT = 7 + (this.id % 6); // 味方のうっかり攻撃までの時間
    this.chatterT = 1.2 + (this.id % 6) * 0.6; // 攻撃以外でしゃべるまでの時間
  }

  setTaunt(extra = 0.4) {
    if (!this.tauntCat) return;
    this.taunt = randomTaunt(this.tauntCat);
    this.tauntT = this.telegraph + this.active + extra;
  }

  update(dt, stage) {
    this.attackActive = false;
    // 倒れかけ: 捨てセリフを言い終わるまでその場に残る。攻撃も移動もしない。
    if (this.dying) {
      this.downT -= dt;
      this.tauntT = Math.max(this.tauntT, 0.1);   // 消えるまで吹き出しを出し続ける
      this.state = 'idle'; this.moving = false; this.attack = null;
      this.integrate(dt);
      if (this.downT <= 0) this.alive = false;
      return;
    }
    this.advanceFSM(dt);
    if (this.team === 'ally' && !this.betrayed && !this.noFumble) this.tryFumble(dt, stage);
    if (!this.isBoss && this.hitstun <= 0) this.separate(dt, stage); // 間隔保持（固まり防止）
    // 敵は攻撃していなくても時々しゃべる（味方は攻撃時のみ＝ここでは喋らない）
    if (this.team === 'enemy' && this.tauntCat) {
      this.chatterT -= dt;
      if (this.chatterT <= 0 && this.tauntT <= 0) {
        this.setTaunt(0.9);
        this.chatterT = 3.5 + (this.id % 4) + Math.random() * 2.5;
      }
    }

    if (this.hitstun > 0) { this.integrate(dt); return; }
    if (this.state !== 'idle') { this.integrate(dt); return; } // 予備/攻撃/硬直中は動かない

    // mob（通行人・傍観者・中間管理職）は索敵も攻撃もしない。その場をゆっくり往復するだけ。
    if (this.team === 'mob') { this.wander(dt); this.integrate(dt); return; }

    let target = this.team === 'enemy' ? stage.player : stage.nearestEnemy(this);
    if (this.team === 'ally' && target) {
      // 味方は積極的に前に出ない: 近くの敵だけ相手にし、プレイヤーより前に出過ぎない
      const near = Math.hypot(target.x - this.x, target.y - this.y) <= 64;
      const tooFarAhead = (this.x - stage.player.x) * stage.player.facing > 24;
      if (!near || tooFarAhead) target = null;
    }
    if (!target || !target.alive) {
      if (this.team === 'ally') this.followPlayer(dt, stage);
      this.integrate(dt);
      return;
    }

    const dx = target.x - this.x, dy = target.y - this.y;
    // faceLock: こちらを向かない（なめている）段階。向きを固定したまま攻撃してくる。
    if (this.faceLock == null) this.facing = sign(dx) || this.facing;
    else this.facing = this.faceLock;
    const inRange = Math.abs(dx) <= this.atkReach * 0.9 && Math.abs(dy) <= PLAY.depthTol;

    // メテオ。間合いに関係なく降らせるので、殴り合いより先に判定する
    if (this.meteorDef) {
      this.meteorT -= dt;
      if (this.meteorT <= 0 && target.alive) { this.startMeteor(stage, target); this.integrate(dt); return; }
    }

    // 飛び道具（スタッフ=書類 / 携行ミサイル兵=誘導弾）
    this.throwT -= dt;
    if (this.swingDef) this.swingT -= dt;
    // ミサイルは誘導、投げ物（一升瓶や鉄アレイ）は山なりに落とすので、どちらも奥行きのズレを許す
    const lobbed = !!THROWS[this.projKind] || this.projKind === 'junk';
    const aligned = this.projKind === 'missile' ? true
      : Math.abs(dy) < (lobbed ? PLAY.depthTol * 2 : PLAY.depthTol + 5);
    if (this.thrower && !this.passive && this.team === 'enemy' && !inRange && aligned &&
        Math.abs(dx) < this.projRange && this.throwT <= 0) {
      stage.spawnProjectile(this, target);
      this.setTaunt(0.6); // 撃ちながら一言
      this.throwT = this.throwCooldown + (this.id % 3) * 0.4;
    }

    // passive（攻撃しない壁役）は攻撃間合いではなく“殴られる至近距離”まで詰めて立ち止まる
    // （攻撃間合い≈リーチ70pxで止まると、進行ロック中のプレイヤーが届かず詰む）
    const passiveClose = this.passive && Math.abs(dx) <= 22 && Math.abs(dy) <= PLAY.depthTol;
    if (inRange && !this.passive) {
      if (this.swingDef && this.swingT <= 0) this.startSwing();
      else this.startAttack();
    } else if (passiveClose) {
      this.moving = false;
    } else if (this.projKind === 'missile' && !this.passive && Math.abs(dx) < 130) {
      // ミサイル兵は近すぎると離れて撃つ（カイト）。ただし画面内＆到達可能な範囲に留める
      const nx = -sign(dx) || -1;
      const ny = Math.abs(dy) > 6 ? sign(dy) : 0;
      this.x += nx * this.speed * this.speedMul * dt;
      this.y += ny * this.speed * this.speedMul * 0.5 * dt;
      this.x = clamp(this.x, stage.camera.x + 16, stage.lockX + 8); // 壁際で必ず届く範囲に留める
      this.moving = true;
    } else {
      this.approach(dt, dx, dy);
    }
    this.integrate(dt);
  }

  // 詰め方。全員が最短距離をまっすぐ来ると行進に見えるので、個体ごとに癖をつける。
  // 癖は id で決まるため、同じ敵は出現から倒されるまで同じ動き方をする（運任せにしない）。
  approach(dt, dx, dy) {
    const sp = this.speed * this.speedMul;

    // ためらい型: 間合いが見えてきたあたりで、ときどき足を止めて様子をうかがう。
    // 遠くからでも止まるようにすると、ただ到着が遅いだけの個体になる。
    if (this.moveStyle === 2 && Math.abs(dx) < this.atkReach * 4) {
      if (this.hesitT > 0) { this.hesitT -= dt; this.moving = false; return; }
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.hesitT = 0.4 + (this.id % 3) * 0.2;
        this.thinkT = 2.2 + (this.id % 4) * 0.5;
        this.moving = false;
        return;
      }
    }

    // 立ち位置を個体ごとにずらす。回り込み型は、遠いうちは正面を外して寄る。
    let off = this.standY;
    if (this.moveStyle === 1 && Math.abs(dx) > this.atkReach * 1.4) off += (this.id % 2 ? 1 : -1) * 16;
    const wy = dy - off;

    const nx = Math.abs(dx) > 3 ? sign(dx) : 0;
    const ny = Math.abs(wy) > 3 ? sign(wy) : 0;
    // 早足型: 遠くは速く詰め、間合いの手前で減速する（突っ込みっぱなしにしない）
    const k = this.moveStyle === 3 ? (Math.abs(dx) < this.atkReach * 1.5 ? 0.72 : 1.3) : 1;
    this.x += nx * sp * k * dt;
    this.y += ny * sp * k * dt;
    // 蛇行。寄ってくる線がまっすぐだと全員同じ軌道になる
    if (nx) this.y += Math.sin(this.animT * this.weaveW + this.id) * this.weaveA * dt;
    this.moving = !!(nx || ny);
  }

  // mob の徘徊: 一定間隔で向きを変え、ゆっくり歩くだけ
  wander(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.wanderT = 1.6 + Math.random() * 2.6;
      this.wanderMove = Math.random() < 0.65;
    }
    if (this.wanderMove) this.x += this.facing * (this.speed * 0.22) * dt;
  }

  // 同じ陣営の仲間と重ならないよう、近すぎる相手から少し離れる（取り囲み＝固まり防止）
  separate(dt, stage) {
    let px = 0, py = 0, cnt = 0;
    const R = this.w + 6; // 体格に応じた間隔（大型化に追従）
    for (const o of stage.entities) {
      if (o === this || !o.alive || o.isBoss || o.team !== this.team) continue;
      const dx = this.x - o.x, dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.001) { const f = (R - d) / R; px += (dx / d) * f; py += (dy / d) * f; cnt++; }
    }
    // 逃がす方向は奥行きを強めに、横は弱めに。横へ均等に押し返すと、後ろの個体が
    // 前につかえたまま押し戻され、いつまでも間合いに入れない「行列」ができる。
    // 奥行きへ逃がすと、自然に横へ広がって取り囲むかたちになる。
    if (cnt) { this.x += px * 26 * dt; this.y += py * 78 * dt; }
  }

  followPlayer(dt, stage) {
    const p = stage.player;
    // 3人が同じ1点に並ぶと「隊列」に見えるので、ついてくる位置を個体ごとにずらす
    const tx = p.x - (22 + (this.id % 3) * 14) * p.facing;
    const ty = p.y + this.standY;
    const dx = tx - this.x, dy = ty - this.y;
    const sp = this.speed * this.speedMul * 0.8;
    if (Math.abs(dx) > 6) { this.x += sign(dx) * sp * dt; this.facing = sign(dx) || this.facing; this.moving = true; }
    else this.moving = false;
    if (Math.abs(dy) > 4) this.y += sign(dy) * sp * dt;
  }

  startAttack() {
    this.state = 'telegraph'; this.stateT = this.telegraph; this.moving = false;
    if (this.tauntCat) this.setTaunt(); // 攻撃時にしゃべる（味方の掛け声もここ）
  }

  // 大振り（中村の一升瓶の振り回し）。大きく振りかぶって横薙ぎに払う。
  // 通常の殴りより遅く・広く・重い。背後まで薙ぐので、すれ違いざまに抜けても当たる。
  // 振りかぶりが長いぶん、見てから離れれば必ずかわせる。
  startSwing() {
    const w = this.swingDef;
    this.state = 'telegraph'; this.stateT = w.telegraph ?? 0.62; this.moving = false;
    this.swinging = true;
    this.swingT = (w.every ?? 4.5) + (this.id % 3) * 0.5;
    if (this.tauntCat) this.setTaunt();
  }

  // メテオ: 狙った床に印を出してから、彗星を順番に落とす。
  // 印は落ちきるまで出しっぱなしなので、走れば必ず逃げられる（理不尽にしない）。
  startMeteor(stage, target) {
    const m = this.meteorDef;
    this.state = 'cast'; this.stateT = m.cast; this.moving = false;
    this.meteorT = m.every + (this.id % 3) * 0.4;
    if (this.tauntCat) this.setTaunt(m.cast + 0.4);
    const half = (PLAY.bottom - PLAY.top) / 2;
    const mid = (PLAY.top + PLAY.bottom) / 2;
    // 着弾点は最大±160px散るので、端に寄られると画面の外に出る。外へ出た弾は
    // main.js の画面外カリングが黙って消すため、端に立つだけで5発中2発が降らなくなっていた
    //（＝端が安全地帯）。画面の中に収めて、どこに立っていても同じ数だけ降らせる。
    const lo = stage.camera.x + 26, hi = stage.camera.x + VIEW_W - 26;
    for (let i = 0; i < m.n; i++) {
      // 1発目は足元へ落とす。棒立ちは必ず痛い目を見る
      const raw = i === 0 ? target.x
        : target.x + (((i * 97) % 2 ? 1 : -1)) * (50 + ((i * 53) % 110));
      const tx = clamp(raw, Math.min(lo, hi), Math.max(lo, hi));
      const ty = i === 0 ? target.y : mid + (((i * 71) % 100) / 100 - 0.5) * 2 * half * 0.9;
      stage.spawnMeteor(tx, clamp(ty, PLAY.top, PLAY.bottom), this.team, m, i * 0.24, this);
    }
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
    if (this.state === 'cast') {
      // 詠唱中は動かない。彗星はもう飛んでいるので、ここでは硬直だけ数える
      if (this.stateT <= 0) { this.state = 'recover'; this.stateT = 0.5; }
      return;
    }
    if (this.state === 'telegraph' && this.stateT <= 0) {
      const w = this.swinging ? this.swingDef : null;
      this.state = 'attack'; this.stateT = w ? (w.active ?? 0.34) : this.active;
      this.attack = w
        ? {
            reach: this.atkReach * (w.reachMul ?? 1.5),   // プレイヤーの間合い(81)の1.5倍強。離れれば必ずかわせる
            back: this.atkReach * (w.backMul ?? 0.55),   // 背後まで薙ぐ
            depth: PLAY.depthTol * (w.depthMul ?? 1.8),  // 奥行きも広い
            dmg: w.dmg ?? this.atkDmg + 1,
            kb: w.kb ?? this.atkKb * 1.8,
            swing: true, dur: this.stateT, hitSet: new Set(),
          }
        : { reach: this.atkReach, dmg: this.atkDmg, kb: this.atkKb, hitSet: new Set() };
      if (w) Audio.sfxSwing();
    } else if (this.state === 'attack') {
      this.attackActive = true;
      if (this.stateT <= 0) {
        this.state = 'recover';
        this.stateT = this.swinging ? (this.swingDef.recover ?? this.cooldown * 1.7) : this.cooldown;
        this.attack = null; this.swinging = false;
      }
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
    if (this.isBoss || this.hideHpBar || this.hp >= this.maxhp) return;
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

// 飛び道具が手を離れる高さ（床からの z）。山なりに投げたときの着地判定に使う。
export const HAND_Z = 10;

// 投げ物のドット絵。(x, y) は中心、upright=true で縦向き（90度回った状態）。
// 中村の一升瓶と、魔王Y下が投げてくる鉄パイプ・鉄アレイ・パソコン。
// 投げ物の飛び方。vz/gz は「投擲間合いの少し先で床に落ちる」ように決めた値で、
// 弧の頂点はどれも当たり判定の高さ許容(Z_TOL=20)の内側。頭上を素通りして当たらない事故が起きない。
export const THROWS = {
  sake:     { vx: 205, vz: 72, gz: 150, dmg: 2, kb: 110, w: 7 },  // 一升瓶（中村）
  pipe:     { vx: 240, vz: 0,  gz: 28,  dmg: 2, kb: 130, w: 7 },  // 鉄パイプ: 低く速い（投げ上げない。約200px先で落ちる）
  dumbbell: { vx: 175, vz: 62, gz: 130, dmg: 3, kb: 175, w: 7 },  // 鉄アレイ: 高く重く、一番痛い
  pc:       { vx: 195, vz: 44, gz: 95,  dmg: 2, kb: 155, w: 9 },  // パソコン
};
// 魔王Y下が手当たり次第に投げてくるもの
export const JUNK = ['pipe', 'dumbbell', 'pc'];

const px = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const THROWN_2D = {
  sake: (ctx, x, y, up) => {
    if (up) {
      px(ctx, '#1d4a2c', x - 2, y - 4, 5, 9);   // 胴
      px(ctx, '#3f7d52', x - 2, y - 4, 1, 9);   // 照り
      px(ctx, '#1d4a2c', x - 1, y - 7, 3, 3);   // 首
      px(ctx, '#c8a23a', x - 1, y - 8, 3, 1);   // 王冠
      px(ctx, '#efe7d2', x - 2, y - 1, 5, 4);   // ラベル
    } else {
      px(ctx, '#1d4a2c', x - 4, y - 2, 9, 5);
      px(ctx, '#3f7d52', x - 4, y - 2, 9, 1);
      px(ctx, '#1d4a2c', x + 5, y - 1, 3, 3);
      px(ctx, '#c8a23a', x + 8, y - 1, 1, 3);
      px(ctx, '#efe7d2', x - 2, y - 2, 4, 5);
    }
  },
  pipe: (ctx, x, y, up) => {
    if (up) {
      px(ctx, '#848d95', x - 1, y - 6, 3, 13);
      px(ctx, '#b4bcc3', x - 1, y - 6, 1, 13);  // 丸みの照り
      px(ctx, '#4d555c', x - 1, y - 6, 3, 1);   // 切り口
    } else {
      px(ctx, '#848d95', x - 6, y - 1, 13, 3);
      px(ctx, '#b4bcc3', x - 6, y - 1, 13, 1);
      px(ctx, '#4d555c', x + 6, y - 1, 1, 3);
    }
  },
  dumbbell: (ctx, x, y, up) => {
    if (up) {
      px(ctx, '#2f343a', x - 1, y - 4, 3, 9);   // シャフト
      px(ctx, '#3c4046', x - 3, y - 6, 7, 3);   // 上の重り
      px(ctx, '#3c4046', x - 3, y + 4, 7, 3);   // 下の重り
      px(ctx, '#6b7076', x - 3, y - 6, 7, 1);
    } else {
      px(ctx, '#2f343a', x - 4, y - 1, 9, 3);
      px(ctx, '#3c4046', x - 6, y - 3, 3, 7);
      px(ctx, '#3c4046', x + 4, y - 3, 3, 7);
      px(ctx, '#6b7076', x - 6, y - 3, 3, 1);
    }
  },
  pc: (ctx, x, y, up) => {
    if (up) {                                    // 画面側が手前を向いた状態
      px(ctx, '#2b3038', x - 4, y - 5, 9, 11);
      px(ctx, '#5a8fb8', x - 3, y - 4, 7, 6);    // 液晶
      px(ctx, '#c9ced4', x - 3, y + 3, 7, 2);    // キーボード
    } else {                                     // 開いたまま横倒しに飛ぶ
      px(ctx, '#2b3038', x - 6, y - 4, 7, 8);    // 蓋
      px(ctx, '#5a8fb8', x - 5, y - 3, 5, 6);
      px(ctx, '#c9ced4', x + 1, y + 1, 7, 3);    // 本体
      px(ctx, '#9aa1a8', x + 1, y + 1, 7, 1);
    }
  },
};

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
    // 見た目の指定。未指定なら kind のまま（書類/工具/ミサイルは従来どおり）。
    this.look = opts.look || null;
    // 彗星（魔王Y下のメテオ）用。空で待ってから落ち、着地点を中心に範囲で当たる。
    this.delay = opts.delay || 0;
    this.aoe = opts.aoe || 0;
    // 斜めに降るので、いま居る場所と落ちる場所は別。印と範囲判定はこちらを使う。
    this.mx = opts.mx ?? x;
    this.my = opts.my ?? y;
    // ff=true: 敵味方の区別なく当たる（魔王のメテオ）。owner は降らせた本人＝自分だけは巻き込まない。
    this.ff = !!opts.ff;
    this.owner = opts.owner ?? null;
    this.floorZ = opts.floorZ ?? -HAND_Z;
    // 投げ上げ（一升瓶や鉄アレイのような山なりの投擲）。未指定なら従来どおり高さは動かない。
    this.vz = opts.vz || 0;
    this.gz = opts.gz || 0;
    this.grounded = false;      // 床に落ちた＝割れる / 着弾する（combat.js が見る）
    this.life = opts.life ?? (this.kind === 'missile' ? 4 : 3);
    this.age = 0;
    this.alive = true;
  }

  update(dt) {
    this.age += dt;
    // 落下待ち。着地点の印だけ床に出したまま、空で止まって見せる
    if (this.delay > 0) { this.delay -= dt; this.life -= dt; return; }
    if (this.homing && this.target && this.target.alive) {
      // 奥行きを誘導弾としてじわっと標的のyへ寄せる
      const dy = this.target.y - this.y;
      this.vy = clamp(this.vy + clamp(dy, -1, 1) * 130 * dt, -64, 64);
      const dirx = sign(this.target.x - this.x) || sign(this.vx) || 1;
      this.vx = clamp(this.vx + dirx * 44 * dt, -260, 260);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.gz) {
      // z はキャラの当たり判定と同じ高さ尺度。手の高さ(0)から投げ上げ、床(-HAND_Z)で止める。
      this.z += this.vz * dt;
      this.vz -= this.gz * dt;
      if (this.z <= this.floorZ) { this.z = this.floorZ; this.grounded = true; }
    }
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
    } else if (this.kind === 'meteor') {
      // 印は「落ちる場所」に出す。彗星は斜めに飛んでくるので現在地とは別。
      const mx = Math.round(this.mx - camX), my = Math.round(this.my);
      const prog = this.z > 0 ? 1 - Math.min(1, this.z / 240) : 1;
      const rr = this.aoe * (1 - 0.25 * prog);   // 落ちるほど濃く小さく＝あと何秒かが読める
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.55 * prog;
      ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(mx, my, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.14 + 0.2 * prog;
      ctx.fillStyle = '#ff2a0e';
      ctx.beginPath(); ctx.ellipse(mx, my, rr, rr * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (this.z > 0) {                       // 本体と尾（空にいる間だけ描く）
        const bx = Math.round(sx), by = Math.round(this.y - this.z);
        // 尾は進行方向の逆へ。斜めに来るので横にもずらす。
        const dirx = this.vx >= 0 ? -1 : 1;
        ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#ff7f0e';
        for (let i = 1; i < 7; i++) ctx.fillRect(bx + dirx * i * 5 - 2, by - i * 7, 5 - (i >> 1), 5 - (i >> 1));
        ctx.restore();
        ctx.fillStyle = '#ff7f0e'; ctx.fillRect(bx - 4, by - 4, 9, 9);
        ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx - 3, by - 3, 7, 7);
        ctx.fillStyle = '#fff4cc'; ctx.fillRect(bx - 1, by - 1, 4, 4);
      }
    } else if (THROWN_2D[this.look]) {
      // 回転は90度刻み。ドット絵の格子を崩さずに、縦横が入れ替わって回って見える
      const upright = (Math.floor(this.age * 9) & 1) === 1;
      THROWN_2D[this.look](ctx, Math.round(sx), Math.round(this.y - 10 - this.z), upright);
    } else if (this.kind === 'tool') {
      const sy = Math.round(this.y - 12); // プレイヤーの飛び道具（工具）
      ctx.fillStyle = '#cfd2d6'; ctx.fillRect(Math.round(sx) - 4, sy, 8, 3);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(Math.round(sx) - 4, sy, 8, 1);
      ctx.fillStyle = '#6f757b'; ctx.fillRect(Math.round(sx) + 2, sy - 1, 2, 5);
    } else {
      const x0 = Math.round(sx) - 2, sy = Math.round(this.y - 10);
      ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x0, sy, 6, 4);   // 書類
      ctx.fillStyle = '#b8b2a0'; ctx.fillRect(x0, sy, 6, 1);
    }
  }
}

// 戦闘解決（2.5Dの当たり判定）とエフェクト
import { Z_TOL, PLAY } from './config.js';
import { SPRITE_H } from './sprites.js';
import { Audio } from './audio.js';

// 同陣営か（player/ally は味方、enemy は敵）
export function sameSide(a, b) {
  return (a.team !== 'enemy') === (b.team !== 'enemy');
}

// 攻撃対象になり得るか。mob（通行人・傍観者）は誰からも狙われない。
// sameSide が2値（enemy かどうか）なので、mob は敵からは「別陣営」に見えてしまう。ここで弾く。
export function targetable(t) { return t.team !== 'mob'; }

// 投げ物が砕けたときの破片の色・数・音
const DEBRIS = {
  sake:     { cols: ['#1d4a2c', '#cfe8d6'], spray: '#f4f1e2', n: 14, sp: 70, sfx: 'sfxSmash' },
  pipe:     { cols: ['#848d95', '#4d555c'], spray: null,      n: 9,  sp: 80, sfx: 'sfxClang' },
  dumbbell: { cols: ['#3c4046', '#6b7076'], spray: null,      n: 8,  sp: 56, sfx: 'sfxThud'  },
  pc:       { cols: ['#2b3038', '#c9ced4'], spray: '#7fd4ff', n: 15, sp: 76, sfx: 'sfxSmash' },
};

// ヒット適用（HP減・ノックバック・硬直・無敵・エフェクト）
export function applyHit(t, dir, dmg, kb, fx) {
  Audio.sfxHit(); // 命中の打撃音
  // dmgTakenMul: 続編の「代理店を介すと言葉が薄まる」等で被ダメを増減（未設定なら1＝1と同じ）
  const eff = dmg * (t.dmgTakenMul ?? 1);
  t.hp -= eff;
  t.kbx += dir * (t.noKb ? 0 : kb); // noKb: 怯まないボス（続編の「振り向かない」演出）
  t.hitstun = 0.18;
  t.invuln = 0.24;
  fx.hit(t.x, t.y - 9, t.isBoss ? '#ff7f0e' : '#ffd24a');
  const shown = Math.round(eff * 10) / 10;
  fx.text(t.x, t.y - SPRITE_H, '-' + shown, '#ffe39a');
  if (t.hp <= 0) { t.hp = 0; t.alive = false; }
}

// 近接攻撃の解決: attackActive な攻撃者の前方ボックスと敵対エンティティを照合
export function resolveMelee(entities, fx) {
  for (const a of entities) {
    if (!a.attackActive || !a.attack) continue;
    const { reach, dmg, kb, hitSet } = a.attack;
    const minX = a.facing > 0 ? a.x : a.x - reach;
    const maxX = a.facing > 0 ? a.x + reach : a.x;
    for (const t of entities) {
      if (t === a || !t.alive) continue;
      if (!targetable(t)) continue;
      if (sameSide(a, t)) continue;
      if (hitSet.has(t.id)) continue;
      if (t.invuln > 0) continue;
      const half = t.w / 2;
      if (t.x + half < minX || t.x - half > maxX) continue;  // x重なり
      if (Math.abs(a.y - t.y) > PLAY.depthTol) continue;          // 奥行き近接
      if (Math.abs(a.z - t.z) > Z_TOL) continue;             // 高さ重なり
      hitSet.add(t.id);
      applyHit(t, a.facing, dmg, kb, fx);
    }
  }
}

// 投擲物・飛び道具の解決（高さzが合わないとヒットしない＝ジャンプで回避可）
export function resolveProjectiles(projectiles, entities, fx) {
  for (const p of projectiles) {
    if (!p.alive) continue;
    // 床に落ちた投げ物は、誰にも当たらなくてもそこで砕ける（外した投擲にも手応えを残す）
    if (p.grounded) { fx.shatter(p.x, p.y, p.look); p.alive = false; continue; }
    for (const t of entities) {
      if (!t.alive || t.invuln > 0) continue;
      if (!targetable(t)) continue;
      if (sameSide(p, t)) continue;
      if (Math.abs(p.x - t.x) > t.w / 2 + 3) continue;
      if (Math.abs(p.y - t.y) > PLAY.depthTol) continue;
      if (Math.abs((p.z || 0) - t.z) > Z_TOL) continue; // ジャンプで頭上を通せる
      applyHit(t, Math.sign(p.vx) || 1, p.dmg, p.kb || 70, fx);
      if (p.kind === 'missile') fx.boom(p.x, p.y - 10);
      if (p.look) fx.shatter(p.x, p.y - 10 - p.z, p.look);
      p.alive = false;
      break;
    }
  }
}

// エフェクト: ヒット粒子・浮遊ダメージ数字・裏切りフラッシュ
export class Fx {
  constructor() { this.parts = []; this.texts = []; }

  hit(x, y, color = '#ffd24a') {
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const sp = 60 + (i % 3) * 34;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24,
        life: 0.42, color, size: 2 + (i % 3),
      });
    }
  }

  text(x, y, str, color = '#fff') {
    this.texts.push({ x, y, str, color, life: 0.7, vy: -26, big: false });
  }

  betray(x, y) {
    this.texts.push({ x, y: y - 14, str: '裏切り！', color: '#ff4a4a', life: 1.4, vy: -10, big: true });
    this.hit(x, y - 8, '#ff4a4a');
  }

  // ミサイル着弾の大爆発
  boom(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sp = 90 + (i % 4) * 42;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.55, color: i % 2 ? '#ff7f0e' : '#ffd24a', size: 3 + (i % 3),
      });
    }
  }

  // 投げ物が砕ける（一升瓶=ガラス片と酒／鉄パイプ・鉄アレイ=金属片／パソコン=樹脂片と火花）
  shatter(x, y, look = 'sake') {
    const d = DEBRIS[look] || DEBRIS.sake;
    Audio[d.sfx]();
    for (let i = 0; i < d.n; i++) {
      const a = (i / d.n) * Math.PI * 2;
      const sp = d.sp + (i % 4) * 44;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 46,
        life: 0.5, color: i % 3 ? d.cols[0] : d.cols[1], size: 2 + (i % 2),
      });
    }
    if (!d.spray) return;
    for (let i = 0; i < 5; i++) {                       // 中身のしぶき（横に低く広がる）
      this.parts.push({
        x, y, vx: (i % 2 ? 1 : -1) * (40 + i * 22), vy: -18 - i * 6,
        life: 0.34, color: d.spray, size: 2,
      });
    }
  }

  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y += t.vy * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx, camX) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / 0.42);
      ctx.fillStyle = p.color;
      const s = p.size || 2;
      ctx.fillRect(Math.round(p.x - camX) - (s >> 1), Math.round(p.y) - (s >> 1), s, s);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.fillStyle = t.color;
      ctx.font = (t.big ? 'bold 14px' : 'bold 9px') + ' system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.str, Math.round(t.x - camX), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

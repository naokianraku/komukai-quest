// 小向クエスト2 — HUD と各画面（1の ui.js とは分離）
import { VIEW_W, VIEW_H } from '../../game/src/config.js';

const INK = '#e9eef5';
const SUB = '#a8b3c2';
const ACCENT = '#ffb35c';
const GOLD = '#e0c060';

function shadowed(ctx, fn) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.92)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  fn();
  ctx.restore();
}

function bar(ctx, x, y, w, h, ratio, back, front) {
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = front; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

export function drawHUD2(ctx, game, stage) {
  const scrim = ctx.createLinearGradient(0, 0, 0, 62);
  scrim.addColorStop(0, 'rgba(10,12,16,0.70)');
  scrim.addColorStop(1, 'rgba(10,12,16,0)');
  ctx.fillStyle = scrim; ctx.fillRect(0, 0, VIEW_W, 62);

  shadowed(ctx, () => {
    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(stage.data.playerRank, 10, 18);

    // 仕事体力
    const p = stage.player;
    const bx = 10, by = 24, bw = 96, bh = 7;
    bar(ctx, bx, by, bw, bh, p.hp / p.maxhp, '#3a1414', '#389451');
    ctx.fillStyle = SUB; ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillText('仕事体力', bx + bw + 5, by + bh - 1);

    ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('残機 × ' + game.lives, bx, by + bh + 12);

    // 同期（残っている人数）— 減ると戻らない
    const roster = game.roster || [];
    ctx.fillStyle = roster.length ? '#6fd39a' : '#7a8290';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('同期 ' + (roster.length ? '●'.repeat(roster.length) : '—'), bx + 74, by + bh + 12);

    // スコア
    ctx.fillStyle = INK;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE ' + String(game.score).padStart(6, '0'), VIEW_W - 10, 18);

    // 通しゲージ（残工期・原価・レター）
    const g = stage.data.gauges || {};
    let gy = 24;
    const gw = 84, gh = 6, gx = VIEW_W - 10 - gw;
    ctx.textAlign = 'right';
    if (g.kouki) {
      bar(ctx, gx, gy, gw, gh, game.kouki / game.koukiMax, '#2a1c10', '#e08a3a');
      ctx.fillStyle = SUB; ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText('残工期', gx - 4, gy + gh - 1);
      gy += gh + 6;
    }
    if (g.genka) {
      bar(ctx, gx, gy, gw, gh, game.genka / game.genkaMax, '#2a2410', '#e0c040');
      ctx.fillStyle = SUB; ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText('原価', gx - 4, gy + gh - 1);
      gy += gh + 6;
    }
    if (g.letter) {
      bar(ctx, gx, gy, gw, gh, game.letter / game.letterMax, '#101c2a', '#6ab0e0');
      ctx.fillStyle = game.letter >= game.letterMax ? '#9ad8ff' : SUB;
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText(game.letter >= game.letterMax ? 'レター（撃てる）' : 'レター', gx - 4, gy + gh - 1);
    }
  });

  // ボスHPバー（hideHpBar の間は「？？？」）
  const b = stage.boss;
  if (b && b.alive) {
    const w = 250, x = (VIEW_W - w) / 2, y = VIEW_H - 22;
    const hidden = b.hideHpBar && !stage.bossBarRevealed;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 2, y - 12, w + 4, 22);
    ctx.textAlign = 'center';
    ctx.fillStyle = hidden ? '#8a90a0' : '#ffd24a';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(b.typeName, VIEW_W / 2, y - 3);
    if (hidden) {
      ctx.fillStyle = '#20242c'; ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = '#5a6272'; ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText('情報が出てこない', VIEW_W / 2, y + 5.5);
    } else {
      bar(ctx, x, y, w, 6, b.hp / b.maxhp, '#3a1414', '#c73333');
    }
  }

  // バナー
  if (stage.bannerT > 0 && stage.banner) {
    ctx.fillStyle = stage.bannerColor;
    ctx.fillRect(0, 70, VIEW_W, 20);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(stage.banner, VIEW_W / 2, 84);
  }

  // 待合室フェーズの表示
  if (stage.waitT > 0) {
    ctx.fillStyle = 'rgba(8,10,14,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fa0b4'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('待合室', VIEW_W / 2, 118);
    ctx.fillStyle = '#6a7686'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('通されない。何時間も待たされている。', VIEW_W / 2, 136);
    ctx.fillStyle = '#4e94c8'; ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText('——書くことだけが増えていく', VIEW_W / 2, 154);
  }
}

export function drawTitle2(ctx, t, difficulty, muted) {
  ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 背景に薄い坂
  ctx.strokeStyle = 'rgba(224,192,96,0.16)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 240); ctx.lineTo(VIEW_W, 60); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD; ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('小向クエスト2', VIEW_W / 2, 76);
  ctx.fillStyle = INK; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('ゴールデンエイジ編', VIEW_W / 2, 98);
  ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('— 後にそう呼ばれる者たちの物語 —', VIEW_W / 2, 116);

  ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#fff' : '#8f9bab';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('Enter / 画面タップ で開始', VIEW_W / 2, 176);

  ctx.fillStyle = SUB; ctx.font = '9px system-ui, sans-serif';
  ctx.fillText('難易度: ' + (difficulty === 'easy' ? 'かんたん' : difficulty === 'hell' ? '地獄' : 'ふつう') + '（1/2/3キーで変更）', VIEW_W / 2, 202);
  ctx.fillText(muted ? '🔇 M でミュート解除' : '🔊 M でミュート', VIEW_W / 2, 216);
  ctx.fillStyle = '#5a6472'; ctx.font = '8px system-ui, sans-serif';
  ctx.fillText('© Anraku Tech', VIEW_W / 2, 250);
}

export function drawChapterIntro2(ctx, ch, t) {
  ctx.fillStyle = 'rgba(6,8,12,0.92)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD; ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(ch.name, VIEW_W / 2, 62);
  ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(ch.subtitle || '', VIEW_W / 2, 80);
  ctx.fillStyle = INK; ctx.font = '10px system-ui, sans-serif';
  (ch.intro || '').split('\n').forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 116 + i * 16));
  ctx.fillStyle = '#7c8798'; ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(ch.location || '', VIEW_W / 2, 214);
}

// 章間の「坂」。台詞は最初の1回だけ。あとは黙って坂を見せる。
export function drawSlope2(ctx, from, to, showLine, t) {
  ctx.fillStyle = '#07090d'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const x0 = 40, x1 = VIEW_W - 40, base = 210;
  const y0 = base - from * 150;
  const y1 = base - to * 150;
  const k = Math.min(1, t / 1.4);
  ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, base + 6); ctx.lineTo(x1, base + 6); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, 2.5, 0, Math.PI * 2); ctx.fill();
  if (showLine) {
    ctx.textAlign = 'center';
    ctx.fillStyle = INK; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('「これから下り坂のない、上り坂の道が、何年か続きます」', VIEW_W / 2, 250);
  }
}

export function drawChapterClear2(ctx, ch, t, completion) {
  ctx.fillStyle = 'rgba(6,8,12,0.9)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (completion) {
    ctx.fillStyle = '#6fd39a'; ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('完 成', VIEW_W / 2, 104);
    ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('納期は遅れた。コストも少し上がった。だが、完成した。', VIEW_W / 2, 130);
  } else {
    ctx.fillStyle = GOLD; ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(ch.name + ' 突破', VIEW_W / 2, 108);
  }
  if (ch.clearLine) {
    ctx.fillStyle = '#c8a06a'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('「' + ch.clearLine + '」', VIEW_W / 2, completion ? 164 : 148);
  }
  if (ch.outro) {
    ctx.fillStyle = '#9aa5b4'; ctx.font = '9px system-ui, sans-serif';
    ch.outro.split('\n').forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 190 + i * 14));
  }
}

// 解散通告 → 同期が連れて行かれる → エピローグ
export function drawDisband2(ctx, t) {
  ctx.fillStyle = 'rgba(4,5,8,' + Math.min(0.95, 0.3 + t * 0.3) + ')'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (t > 0.4) {
    ctx.fillStyle = '#e0e6ee'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('契約解除', VIEW_W / 2, 104);
  }
  if (t > 1.8) {
    ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('勝った。だが、何も覆らなかった。', VIEW_W / 2, 132);
  }
  if (t > 3.4) {
    ctx.fillStyle = '#7c8798'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('最後の同期が呼ばれて出ていく。振り返らない。', VIEW_W / 2, 156);
  }
}

export function drawEpilogue2(ctx, game, t) {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // 途中で切れる坂
  const x0 = 40, x1 = VIEW_W - 40, base = 190;
  ctx.strokeStyle = '#2a3240'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, base + 6); ctx.lineTo(x1, base + 6); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  const cut = x0 + (x1 - x0) * 0.72;
  ctx.beginPath(); ctx.moveTo(x0, base); ctx.lineTo(cut, base - 132); ctx.stroke();

  ctx.textAlign = 'center';
  if (t > 1.0) {
    ctx.fillStyle = SUB; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('下り坂は、一度も来なかった。', VIEW_W / 2, 222);
  }
  if (t > 2.6) {
    ctx.fillStyle = INK; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('そして、頂上もなかった。', VIEW_W / 2, 240);
  }
  if (t > 4.4) {
    ctx.fillStyle = '#c8a06a'; ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('後に誰かが、あの年次を金の世代と呼んだ。', VIEW_W / 2, 46);
    ctx.fillText('誰が言い出したのかは、もう分からない。', VIEW_W / 2, 62);
  }
  if (t > 6.2) {
    ctx.fillStyle = '#ff7f0e'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('— 小向戦士 —', VIEW_W / 2, 92);
    ctx.fillStyle = '#8f9bab'; ctx.font = '9px system-ui, sans-serif';
    ctx.fillText('Enter で 小向クエスト（本編）へ', VIEW_W / 2, 258);
  }
}

export function drawGameOver2(ctx, game, t) {
  ctx.fillStyle = 'rgba(6,4,6,0.9)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d05a5a'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('離 脱', VIEW_W / 2, 116);
  ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('SCORE ' + game.score, VIEW_W / 2, 146);
  if (Math.floor(t * 2) % 2) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('Enter でタイトルへ', VIEW_W / 2, 182);
  }
}

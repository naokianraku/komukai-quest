// UI: HUD（HP・スコア・ランク・残機・ボスHP）と各画面（タイトル/クリア/昇進/エンディング/GO）
import { VIEW_W, VIEW_H } from './config.js';

const ACCENT = '#ff7f0e';
const INK = '#e6e9ec';
const SUB = '#9aa0a8';

function dim(ctx, a = 0.6) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(21,23,26,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function center(ctx, text, y, font, color) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
  ctx.textAlign = 'left';
}

function multiline(ctx, text, cx, y, lineH, font, color) {
  ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'center';
  text.split('\n').forEach((line, i) => ctx.fillText(line, cx, y + i * lineH));
  ctx.textAlign = 'left';
}

export function drawHUD(ctx, game, stage) {
  // ランク名
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(stage.data.playerRank, 10, 18);

  // プレイヤーHPバー
  const p = stage.player;
  const bx = 10, by = 24, bw = 96, bh = 7;
  ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#3a1414'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#389451'; ctx.fillRect(bx, by, bw * Math.max(0, p.hp / p.maxhp), bh);
  ctx.strokeStyle = '#0d0f12'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  // 残機
  ctx.fillStyle = SUB; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('残機 × ' + game.lives, bx, by + bh + 12);

  // スコア
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText('SCORE ' + String(game.score).padStart(6, '0'), VIEW_W - 10, 18);
  ctx.textAlign = 'left';

  // ステージ名
  ctx.fillStyle = SUB; ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(stage.data.name, VIEW_W - 10, 30);
  ctx.textAlign = 'left';

  // ボスHPバー
  if (stage.boss && stage.boss.alive) {
    const bw2 = 240, bx2 = (VIEW_W - bw2) / 2, by2 = VIEW_H - 18;
    ctx.fillStyle = '#000'; ctx.fillRect(bx2 - 1, by2 - 1, bw2 + 2, 9);
    ctx.fillStyle = '#3a1414'; ctx.fillRect(bx2, by2, bw2, 7);
    ctx.fillStyle = '#c73333'; ctx.fillRect(bx2, by2, bw2 * Math.max(0, stage.boss.hp / stage.boss.maxhp), 7);
    center(ctx, 'BOSS  ' + stage.boss.typeName, by2 - 4, 'bold 9px system-ui, sans-serif', ACCENT);
  }
}

export function drawTitle(ctx, t) {
  ctx.fillStyle = '#0c0e11'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  center(ctx, 'KOMUKAI QUEST', 96, 'bold 34px system-ui, sans-serif', ACCENT);
  center(ctx, '小 向 ク エ ス ト', 124, 'bold 15px system-ui, sans-serif', INK);
  center(ctx, '小向戦士となり、小向工場を生き残れ', 162, 'bold 12px system-ui, sans-serif', INK);
  if (Math.floor(t * 2) % 2 === 0) {
    center(ctx, 'PRESS ENTER  /  タップでスタート', 218, 'bold 12px system-ui, sans-serif', INK);
  }
  center(ctx, '移動 ←↑↓→ / WASD・スティック　攻撃 J/Z　ジャンプ K/X', 244, '9px system-ui, sans-serif', SUB);
}

export function drawStageIntro(ctx, stage, t) {
  dim(ctx, 0.78);
  panel(ctx, 50, 70, VIEW_W - 100, 130);
  center(ctx, 'STAGE ' + stage.data.id, 100, 'bold 13px system-ui, sans-serif', ACCENT);
  center(ctx, stage.data.name, 122, 'bold 14px system-ui, sans-serif', INK);
  multiline(ctx, stage.data.intro, VIEW_W / 2, 150, 15, '10px system-ui, sans-serif', SUB);
  if (Math.floor(t * 2) % 2 === 0) {
    center(ctx, 'PRESS  ENTER  TO  START', 188, 'bold 11px system-ui, sans-serif', INK);
  }
}

export function drawStageClear(ctx, stage, t) {
  dim(ctx, 0.6);
  center(ctx, 'STAGE CLEAR!', 120, 'bold 26px system-ui, sans-serif', ACCENT);
  center(ctx, stage.data.name + ' を突破', 150, '12px system-ui, sans-serif', INK);
  if (Math.floor(t * 2) % 2 === 0) center(ctx, 'PRESS ENTER', 190, 'bold 12px system-ui, sans-serif', SUB);
}

export function drawRankUp(ctx, newRank, t) {
  dim(ctx, 0.7);
  center(ctx, '昇 進 !', 110, 'bold 30px system-ui, sans-serif', ACCENT);
  center(ctx, 'あなたは「' + newRank + '」になった', 148, 'bold 14px system-ui, sans-serif', INK);
  if (Math.floor(t * 2) % 2 === 0) center(ctx, 'PRESS ENTER', 192, 'bold 12px system-ui, sans-serif', SUB);
}

export function drawEnding(ctx, game, t) {
  ctx.fillStyle = '#0c0a12'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  center(ctx, '小 向 司 令 官', 90, 'bold 30px system-ui, sans-serif', '#c79a3a');
  center(ctx, '生産部長・技師長・工場長を倒し、真のボス「事業部長」をも撃破。', 128, '10px system-ui, sans-serif', INK);
  center(ctx, '数々の困難と裏切りを越え、あなたは小向の頂点に立った。', 146, '10px system-ui, sans-serif', SUB);
  center(ctx, '小向戦士の伝説、ここに完結。', 162, '10px system-ui, sans-serif', SUB);
  center(ctx, 'FINAL SCORE  ' + String(game.score).padStart(6, '0'), 194, 'bold 14px ui-monospace, monospace', ACCENT);
  if (Math.floor(t * 2) % 2 === 0) center(ctx, 'PRESS ENTER', 230, 'bold 11px system-ui, sans-serif', SUB);
}

export function drawGameOver(ctx, game, t) {
  dim(ctx, 0.75);
  center(ctx, 'GAME OVER', 116, 'bold 30px system-ui, sans-serif', '#c73333');
  center(ctx, '組織に敗れた…。', 146, '12px system-ui, sans-serif', INK);
  center(ctx, 'SCORE ' + String(game.score).padStart(6, '0'), 174, 'bold 12px ui-monospace, monospace', SUB);
  if (Math.floor(t * 2) % 2 === 0) center(ctx, 'PRESS ENTER TO RETRY', 210, 'bold 12px system-ui, sans-serif', SUB);
}

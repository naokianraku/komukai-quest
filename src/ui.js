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

// タイトル背景: 小向工場の正門をイメージしたドット絵風シーン
function drawTitleScene(ctx) {
  // 空
  const sky = ctx.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, '#4f97cf'); sky.addColorStop(1, '#c2def0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, 150);
  // 地面（アスファルト）
  ctx.fillStyle = '#8a8f96'; ctx.fillRect(0, 150, VIEW_W, VIEW_H - 150);

  // 左の高層棟（白いビル）＋窓グリッド
  ctx.fillStyle = '#9aa2aa'; ctx.fillRect(0, 32, 150, 5);
  ctx.fillStyle = '#d6dade'; ctx.fillRect(0, 36, 150, 114);
  ctx.fillStyle = '#bcc2c8'; ctx.fillRect(126, 36, 24, 114);
  ctx.fillStyle = '#6f7b88';
  for (let y = 50; y < 150; y += 12) for (let x = 8; x < 120; x += 15) ctx.fillRect(x, y, 9, 7);

  // 連絡通路（スカイブリッジ）
  ctx.fillStyle = '#c8ccd0'; ctx.fillRect(150, 112, 56, 14);
  ctx.fillStyle = '#7a8694'; for (let x = 154; x < 204; x += 8) ctx.fillRect(x, 115, 5, 8);

  // 右の低層棟（ガラス張り）
  ctx.fillStyle = '#b6bec4'; ctx.fillRect(300, 88, 180, 5);
  ctx.fillStyle = '#cdd5da'; ctx.fillRect(300, 92, 180, 58);
  for (let y = 98; y < 150; y += 11) { ctx.fillStyle = '#a6cad4'; ctx.fillRect(304, y, 172, 7); ctx.fillStyle = '#7fadba'; ctx.fillRect(304, y, 172, 2); }

  // 正門の黒い柵（全幅・かなり手前・高さ2倍）。このあと道路を上に重ねてゲート開口を作る。
  const fBot = 242, fTop = fBot - 44, hedgeTop = fTop - 16, baseTop = fBot - 2;
  // 背後の植栽（全幅）
  ctx.fillStyle = '#2f5a32'; ctx.fillRect(0, hedgeTop, VIEW_W, fBot - hedgeTop);
  ctx.fillStyle = '#3a6e3d'; for (let x = 4; x < VIEW_W; x += 13) { ctx.beginPath(); ctx.arc(x, hedgeTop + 2, 7, 0, Math.PI * 2); ctx.fill(); }
  // コンクリ基礎（全幅）
  ctx.fillStyle = '#b9bdc1'; ctx.fillRect(0, baseTop, VIEW_W, 14);
  ctx.fillStyle = '#969ca2'; ctx.fillRect(0, baseTop + 12, VIEW_W, 2);
  // 黒い柵（縦バー＋レール、槍状の先端）。右の一部はオレンジ塗装。
  for (let x = 2; x < VIEW_W; x += 6) {
    ctx.fillStyle = (x >= 432 && x <= 470) ? '#ff7f0e' : '#16171c';
    ctx.fillRect(x, fTop, 2, fBot - fTop);
    ctx.fillRect(x - 1, fTop - 3, 4, 3); // 先端
  }
  ctx.fillStyle = '#16171c';
  ctx.fillRect(0, fTop + 3, VIEW_W, 3);                       // 上レール
  ctx.fillRect(0, Math.round((fTop + fBot) / 2), VIEW_W, 3);  // 中レール

  // 道路（中央へ収束）を柵の上に重ねる＝ゲート開口（道だけ通れる）＋横断歩道＋矢印
  ctx.fillStyle = '#777c83';
  ctx.beginPath(); ctx.moveTo(150, VIEW_H); ctx.lineTo(330, VIEW_H); ctx.lineTo(268, 150); ctx.lineTo(214, 150); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e6e8ea'; for (let x = 158; x < 324; x += 16) ctx.fillRect(x, 256, 9, 7);
  ctx.fillStyle = '#dfe2e5'; ctx.fillRect(238, 224, 4, 22);
  ctx.beginPath(); ctx.moveTo(231, 228); ctx.lineTo(249, 228); ctx.lineTo(240, 218); ctx.closePath(); ctx.fill();

  // テキスト可読性のための暗幕
  const ov = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  ov.addColorStop(0, 'rgba(8,10,14,0.34)'); ov.addColorStop(0.5, 'rgba(8,10,14,0.55)'); ov.addColorStop(1, 'rgba(8,10,14,0.40)');
  ctx.fillStyle = ov; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// 難易度ボタン（描画とヒットテストで共有）
export const DIFF_BUTTONS = {
  normal: { x: 150, y: 170, w: 82, h: 24, label: 'ふつう' },
  easy: { x: 248, y: 170, w: 82, h: 24, label: 'かんたん' },
};

function diffBtn(ctx, b, sel) {
  ctx.fillStyle = sel ? ACCENT : 'rgba(16,18,22,0.9)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = sel ? '#ffffff' : ACCENT; ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.fillStyle = sel ? '#15171a' : INK;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

export function drawTitle(ctx, t, difficulty = 'normal') {
  drawTitleScene(ctx);
  center(ctx, 'KOMUKAI QUEST', 86, 'bold 34px system-ui, sans-serif', ACCENT);
  center(ctx, '小 向 ク エ ス ト', 112, 'bold 15px system-ui, sans-serif', INK);
  center(ctx, '小向戦士となり、小向工場を生き残れ', 142, 'bold 12px system-ui, sans-serif', INK);
  center(ctx, '難 易 度', 162, 'bold 9px system-ui, sans-serif', SUB);
  diffBtn(ctx, DIFF_BUTTONS.normal, difficulty === 'normal');
  diffBtn(ctx, DIFF_BUTTONS.easy, difficulty === 'easy');
  const desc = difficulty === 'easy' ? 'かんたん: 残機おおめ＋自分も飛び道具' : 'ふつう: 標準ルール';
  center(ctx, desc, 208, 'bold 9px system-ui, sans-serif', INK);
  if (Math.floor(t * 2) % 2 === 0) center(ctx, '←→で選択　ENTER / タップで開始', 226, 'bold 11px system-ui, sans-serif', INK);
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

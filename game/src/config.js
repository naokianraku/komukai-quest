// ゲーム全体の定数とユーティリティ
export const VIEW_W = 480;          // 論理解像度（CSSで拡大、pixelated）
export const VIEW_H = 270;

export const FLOOR_TOP = 178;       // フロア帯（足元yの最小=奥）
export const FLOOR_BOTTOM = 254;    // フロア帯の最大=手前

export const GRAVITY = 620;         // ジャンプ高さzの重力 (px/s^2)
export const DEPTH_TOL = 18;        // 当たり判定の奥行き許容 (y)（大きいキャラに合わせ拡大）
export const Z_TOL = 20;            // 当たり判定の高さ許容 (z)
export const CHAR_SCALE = 3.0;      // キャラ全体の表示倍率（約2倍に拡大）

// 出世ランク（小向戦士 → 小隊長(主務級) → 大隊長(EX級) → 司令官(課長級)）
export const RANKS = ['小向戦士', '小向小隊長', '小向大隊長', '小向司令官'];

// プレイ空間の調整値。既定は上の定数と同じなので、設定しなければ2D版の挙動は一切変わらない。
// 3Dビルドだけ奥行きを広げたいので可変にしてある（2Dは背景の描画位置と帯が一致している必要があるため既定のまま）。
export const PLAY = { top: FLOOR_TOP, bottom: FLOOR_BOTTOM, depthTol: DEPTH_TOL };
export function setPlay({ top, bottom, depthTol }) {
  if (top != null) PLAY.top = top;
  if (bottom != null) PLAY.bottom = bottom;
  if (depthTol != null) PLAY.depthTol = depthTol;
}
export const playMid = () => (PLAY.top + PLAY.bottom) / 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

let _id = 0;
export const nextId = () => ++_id;

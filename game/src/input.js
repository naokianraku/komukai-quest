// 入力: キーボード + タッチ（仮想ジョイスティック / 攻撃・ジャンプボタン / タップ決定）
import { VIEW_W, VIEW_H, clamp } from './config.js';

const held = new Set();
const pressed = new Set();

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

// 画面上のタッチ操作レイアウト（論理座標 480x270）
// スティックはフローティング式（左半分のどこを押してもそこが中心に）。固定ブロブが敵に隠れない。
const STICK = { r: 36, knobR: 14, active: false, ox: 56, oy: 212 }; // ox/oy = 押した位置（生きた原点）
const STICK_HOME = { cx: 56, cy: 212 }; // 待機時のホームヒント位置（左下・親指が届く所）
const BTN_A = { cx: 451, cy: 226, r: 23 };  // 攻撃（右端の列・下）
const BTN_B = { cx: 451, cy: 192, r: 18 };  // 跳（攻撃の真上・一部フロア帯より上＝足元が来にくい所）

const touchDir = { left: false, right: false, up: false, down: false };
const knob = { x: STICK_HOME.cx, y: STICK_HOME.cy };
const pointers = new Map(); // pointerId -> 'stick'|'attack'|'jump'|'tap'
let lastTap = null;          // 直近タップの論理座標（メニューのヒットテスト用）

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const Input = {
  isTouch: false,
  forceTouch: false,
  gameplayActive: false, // プレイ中(かつ一時停止していない)のみ true。フローティングスティックの誤作動防止
  _canvas: null,

  init() {
    addEventListener('keydown', (e) => {
      if (!held.has(e.code)) pressed.add(e.code);
      held.add(e.code);
      if (PREVENT.has(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => held.delete(e.code));
    addEventListener('blur', () => { held.clear(); pressed.clear(); this._resetStick(); pointers.clear(); });
    this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  },

  controlsActive() { return this.isTouch || this.forceTouch; },

  initTouch(canvas) {
    this._canvas = canvas;
    if (!this.controlsActive()) return; // デスクトップ(キーボード)では何もしない
    const opt = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._onDown(e), opt);
    canvas.addEventListener('pointermove', (e) => this._onMove(e), opt);
    canvas.addEventListener('pointerup', (e) => this._onUp(e), opt);
    canvas.addEventListener('pointercancel', (e) => this._onUp(e), opt);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  _toLogical(e) {
    const r = this._canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VIEW_W,
      y: ((e.clientY - r.top) / r.height) * VIEW_H,
    };
  },

  _onDown(e) {
    e.preventDefault();
    const { x, y } = this._toLogical(e);
    lastTap = { x, y };
    let role = 'tap';
    // 右側ボタンを先に判定 → 残りの左半分はフローティングスティック
    if (dist(x, y, BTN_A.cx, BTN_A.cy) < BTN_A.r + 10) {
      role = 'attack'; pressed.add('TouchAttack'); held.add('TouchAttack');
    } else if (dist(x, y, BTN_B.cx, BTN_B.cy) < BTN_B.r + 10) {
      role = 'jump'; pressed.add('TouchJump'); held.add('TouchJump');
    } else if (this.gameplayActive && x < VIEW_W * 0.5 && y > 26) {
      // プレイ中のみ・上部HUD/一時停止ボタン帯(y<=26)を除いた左半分でスティック発動
      role = 'stick'; STICK.active = true; STICK.ox = x; STICK.oy = y;
      knob.x = x; knob.y = y; this._updateStick(x, y);
    }
    pointers.set(e.pointerId, role);
    pressed.add('TouchConfirm'); // どこをタップしてもメニューは進む
  },

  _onMove(e) {
    if (pointers.get(e.pointerId) !== 'stick') return;
    e.preventDefault();
    const { x, y } = this._toLogical(e);
    this._updateStick(x, y);
  },

  _onUp(e) {
    const role = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (role === 'stick') this._resetStick();
    else if (role === 'attack') held.delete('TouchAttack');
    else if (role === 'jump') held.delete('TouchJump');
  },

  _updateStick(x, y) {
    const dx = x - STICK.ox, dy = y - STICK.oy; // フローティング原点からの変位
    const dead = 8;
    touchDir.left = dx < -dead; touchDir.right = dx > dead;
    touchDir.up = dy < -dead; touchDir.down = dy > dead;
    const m = Math.hypot(dx, dy) || 1;
    const c = Math.min(m, STICK.r) / m;
    knob.x = STICK.ox + dx * c; knob.y = STICK.oy + dy * c;
  },

  _resetStick() {
    touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
    STICK.active = false;
    knob.x = STICK_HOME.cx; knob.y = STICK_HOME.cy;
  },

  down(...codes) { return codes.some((c) => held.has(c)); },
  pressed(...codes) { return codes.some((c) => pressed.has(c)); },

  get left()    { return this.down('ArrowLeft', 'KeyA') || touchDir.left; },
  get right()   { return this.down('ArrowRight', 'KeyD') || touchDir.right; },
  get up()      { return this.down('ArrowUp', 'KeyW') || touchDir.up; },
  get down_()   { return this.down('ArrowDown', 'KeyS') || touchDir.down; },
  get attack()  { return this.pressed('KeyJ', 'KeyZ', 'TouchAttack'); },
  get jump()    { return this.pressed('KeyK', 'KeyX', 'TouchJump'); },
  get confirm() { return this.pressed('Enter', 'Space', 'KeyJ', 'KeyZ', 'TouchAttack', 'TouchConfirm'); },

  endFrame() { pressed.clear(); },

  // 直近タップの論理座標を1回だけ取り出す（メニューのヒットテスト用）
  consumeTap() { const t = lastTap; lastTap = null; return t; },

  // 画面上のタッチUIを描画（playing中のみ）
  drawControls(ctx) {
    if (!this.controlsActive()) return;
    ctx.save();
    ctx.lineWidth = 1;
    // フローティング十字スティック
    if (STICK.active) {
      // 端で完全透明になる柔らかい暗グラデ背景（敵を“暗く”はしても“消さない”）
      const g = ctx.createRadialGradient(STICK.ox, STICK.oy, 0, STICK.ox, STICK.oy, STICK.r);
      g.addColorStop(0, 'rgba(8,10,14,0.34)');
      g.addColorStop(0.62, 'rgba(8,10,14,0.20)');
      g.addColorStop(1, 'rgba(8,10,14,0.0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(STICK.ox, STICK.oy, STICK.r, 0, Math.PI * 2); ctx.fill();
      // 暗いハロー → 明るいリング（明床でも敵の山でも視認できる）
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#0d1118';
      ctx.beginPath(); ctx.arc(STICK.ox, STICK.oy, STICK.r + 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.72; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(STICK.ox, STICK.oy, STICK.r, 0, Math.PI * 2); ctx.stroke();
      // ノブ（最も不透明＝操作フィードバックの本体）
      ctx.globalAlpha = 0.78; ctx.fillStyle = '#ff7f0e';
      ctx.beginPath(); ctx.arc(knob.x, knob.y, STICK.knobR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#0d1118';
      ctx.beginPath(); ctx.arc(knob.x, knob.y, STICK.knobR, 0, Math.PI * 2); ctx.stroke();
    } else {
      // 待機ヒント: 薄いリングのみ（コーナーを空けておく）
      ctx.globalAlpha = 0.12; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(STICK_HOME.cx, STICK_HOME.cy, STICK.r - 4, 0, Math.PI * 2); ctx.stroke();
    }
    // ボタン
    this._btn(ctx, BTN_A, '攻撃', held.has('TouchAttack'));
    this._btn(ctx, BTN_B, '跳', held.has('TouchJump'));
    ctx.restore();
  },

  _btn(ctx, b, label, down) {
    // 端で透明になる柔らかい暗グラデ背景（リムの少し外で alpha 0）
    const g = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r + 3);
    g.addColorStop(0, 'rgba(8,10,14,0.32)');
    g.addColorStop(0.7, 'rgba(8,10,14,0.16)');
    g.addColorStop(1, 'rgba(8,10,14,0.0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2); ctx.fill();
    // 塗り: 待機はゴースト、押下時はオレンジで明確に
    ctx.globalAlpha = down ? 0.62 : 0.16;
    ctx.fillStyle = down ? '#ff7f0e' : '#ffffff';
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.fill();
    // 暗ハロー → 明リング
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#0d1118';
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r + 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.78; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.stroke();
    // ラベル
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (down) {
      ctx.globalAlpha = 1; ctx.fillStyle = '#0d1118';
      ctx.fillText(label, b.cx, b.cy + 0.5);
    } else {
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 1;
      ctx.fillText(label, b.cx, b.cy + 0.5);
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  },
};

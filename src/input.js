// 入力: キーボード + タッチ（仮想ジョイスティック / 攻撃・ジャンプボタン / タップ決定）
import { VIEW_W, VIEW_H, clamp } from './config.js';

const held = new Set();
const pressed = new Set();

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

// 画面上のタッチ操作レイアウト（論理座標 480x270）
const STICK = { cx: 56, cy: 210, r: 34, knobR: 15 };
const BTN_A = { cx: 436, cy: 216, r: 25 };  // 攻撃（右下）
const BTN_B = { cx: 380, cy: 222, r: 19 };  // ジャンプ（攻撃の左）

const touchDir = { left: false, right: false, up: false, down: false };
const knob = { x: STICK.cx, y: STICK.cy };
const pointers = new Map(); // pointerId -> 'stick'|'attack'|'jump'|'tap'

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const Input = {
  isTouch: false,
  forceTouch: false,
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
    let role = 'tap';
    if (x < VIEW_W * 0.5 && dist(x, y, STICK.cx, STICK.cy) < STICK.r + 22) {
      role = 'stick'; this._updateStick(x, y);
    } else if (dist(x, y, BTN_A.cx, BTN_A.cy) < BTN_A.r + 8) {
      role = 'attack'; pressed.add('TouchAttack'); held.add('TouchAttack');
    } else if (dist(x, y, BTN_B.cx, BTN_B.cy) < BTN_B.r + 8) {
      role = 'jump'; pressed.add('TouchJump'); held.add('TouchJump');
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
    const dx = x - STICK.cx, dy = y - STICK.cy;
    const dead = 8;
    touchDir.left = dx < -dead; touchDir.right = dx > dead;
    touchDir.up = dy < -dead; touchDir.down = dy > dead;
    const m = Math.hypot(dx, dy) || 1;
    const c = Math.min(m, STICK.r) / m;
    knob.x = STICK.cx + dx * c; knob.y = STICK.cy + dy * c;
  },

  _resetStick() {
    touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
    knob.x = STICK.cx; knob.y = STICK.cy;
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

  // 画面上のタッチUIを描画（playing中のみ）
  drawControls(ctx) {
    if (!this.controlsActive()) return;
    ctx.save();
    ctx.lineWidth = 1;
    // 十字スティック
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(STICK.cx, STICK.cy, STICK.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(STICK.cx, STICK.cy, STICK.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#ff7f0e';
    ctx.beginPath(); ctx.arc(knob.x, knob.y, STICK.knobR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#0d1118';
    ctx.beginPath(); ctx.arc(knob.x, knob.y, STICK.knobR, 0, Math.PI * 2); ctx.stroke();
    // ボタン
    this._btn(ctx, BTN_A, '攻撃', held.has('TouchAttack'));
    this._btn(ctx, BTN_B, '跳', held.has('TouchJump'));
    ctx.restore();
  },

  _btn(ctx, b, label, down) {
    ctx.globalAlpha = down ? 0.7 : 0.3;
    ctx.fillStyle = down ? '#ff7f0e' : '#ffffff';
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = down ? '#0d1118' : '#15171a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.cx, b.cy + 0.5);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  },
};

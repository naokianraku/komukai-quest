// 入力: キーボード + タッチ（仮想ジョイスティック / 攻撃・ジャンプボタン / タップ決定）
import { VIEW_W, VIEW_H, clamp } from './config.js';

const held = new Set();
const pressed = new Set();

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

// 画面上のタッチ操作レイアウト（論理座標 480x270）
// スティックはフローティング式（左半分のどこを押してもそこが中心に）。固定ブロブが敵に隠れない。
const STICK = { r: 36, knobR: 14, active: false, ox: 56, oy: 212 }; // ox/oy = 押した位置（生きた原点）
const STICK_HOME = { cx: 56, cy: 212 }; // 待機時のホームヒント位置（左下・親指が届く所）

// 倒し幅 → 速さ。以前は8px(半径の22%)を超えた瞬間に最大速度の4方向デジタルだったので、
// 立ち位置の微調整ができなかった。いまは倒し幅がそのまま速さの倍率になる。
const DEAD = 8;        // 不感帯。この中は中立
const FULL = 25;       // ここまで倒せば全速。ノブの可動域(r=36)より内側で飽和させて反応を軽くする
const WALK_MIN = 0.42; // 不感帯を出た瞬間の速さ。これ未満にはしない（じわっと動かせる下限）
const AXIS_SNAP = 2.0; // 片方がもう片方の2倍を超えたら弱い方を切る＝まっすぐ歩ける／まっすぐ奥へ行ける

// ボタンは親指の弧に沿わせた扇形。以前は右端 x=451 の縦一列で、攻撃の右リムが画面端から
// 論理6px＝親指の付け根に当たり、奥の手Ｋは画面の高さの58%＝かなり上にあった。
// 攻撃を手前に、跳はそこから外へ伸ばした先（指を滑らせれば出る）、Ｋは横へ払った先に置く。
const BTN_A = { cx: 437, cy: 231, r: 25 };  // 攻撃（いちばん使う＝いちばん近く・いちばん大きく）
const BTN_B = { cx: 415, cy: 188, r: 20 };  // 跳（攻撃から外へ伸ばした位置）
const BTN_C = { cx: 383, cy: 237, r: 19 };  // 奥の手Ｋ（横へ払った位置。1回きりなので最後に判定）
const BTN_PAD = 7;                          // 実際の当たりは見た目より少し広く取る

const touchDir = { left: false, right: false, up: false, down: false };
const stickVec = { x: 0, y: 0 };   // 移動ベクトル（大きさ＝速さの倍率 0〜1）
const mv = { x: 0, y: 0 };         // moveVec の戻り値（毎フレームの確保を避ける使い回し）
const knob = { x: STICK_HOME.cx, y: STICK_HOME.cy };
const pointers = new Map(); // pointerId -> 'stick'|'attack'|'jump'|'special'|'tap'
let lastTap = null;          // 直近タップの論理座標（メニューのヒットテスト用）

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const Input = {
  isTouch: false,
  forceTouch: false,
  gameplayActive: false, // プレイ中(かつ一時停止していない)のみ true。フローティングスティックの誤作動防止
  specialReady: false,   // 奥の手が残っているか。ボタンを出すかどうかもこれで決める
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
    const c = this._canvas;
    // 縦持ちのスマホでは画面ごと90°回している（game3d/index.html）。
    // getBoundingClientRect は回転後の外接矩形を返すので、そこからの引き算では
    // 縦と横が入れ替わって判定が90°ずれる。offsetX/offsetY は要素自身の座標系
    // （回転を戻したもの）なので、そのまま割れば向きに関係なく正しい。
    if (e.offsetX != null && c.clientWidth > 0 && c.clientHeight > 0) {
      return { x: (e.offsetX / c.clientWidth) * VIEW_W, y: (e.offsetY / c.clientHeight) * VIEW_H };
    }
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VIEW_W,
      y: ((e.clientY - r.top) / r.height) * VIEW_H,
    };
  },

  // その座標にあるボタン（無ければ 'tap'）。攻撃→跳→Ｋの順に見るので、
  // 当たりが重なる所では「いちばん使うボタン」が勝つ。
  _btnAt(x, y) {
    if (dist(x, y, BTN_A.cx, BTN_A.cy) < BTN_A.r + BTN_PAD) return 'attack';
    if (dist(x, y, BTN_B.cx, BTN_B.cy) < BTN_B.r + BTN_PAD) return 'jump';
    if (this.specialReady && dist(x, y, BTN_C.cx, BTN_C.cy) < BTN_C.r + BTN_PAD) return 'special';
    return 'tap';
  },

  _code(role) {
    return role === 'attack' ? 'TouchAttack' : role === 'jump' ? 'TouchJump'
      : role === 'special' ? 'TouchSpecial' : null;
  },

  _pressBtn(role) { const c = this._code(role); if (c) { pressed.add(c); held.add(c); } },
  _releaseBtn(role) { const c = this._code(role); if (c) held.delete(c); },

  _onDown(e) {
    e.preventDefault();
    const { x, y } = this._toLogical(e);
    lastTap = { x, y };
    // 右側ボタンを先に判定 → 残りの左半分はフローティングスティック
    let role = this._btnAt(x, y);
    if (role !== 'tap') {
      this._pressBtn(role);
    } else if (this.gameplayActive && x < VIEW_W * 0.5 && y > 26) {
      // プレイ中のみ・上部HUD/一時停止ボタン帯(y<=26)を除いた左半分でスティック発動
      role = 'stick'; STICK.active = true; STICK.ox = x; STICK.oy = y;
      knob.x = x; knob.y = y; this._updateStick(x, y);
    }
    pointers.set(e.pointerId, role);
    pressed.add('TouchConfirm'); // どこをタップしてもメニューは進む
  },

  _onMove(e) {
    const role = pointers.get(e.pointerId);
    if (role === undefined) return;
    e.preventDefault();
    const { x, y } = this._toLogical(e);
    if (role === 'stick') { this._updateStick(x, y); return; }
    // ボタンの上で指を滑らせたら押し替える（格ゲーのパッドと同じ）。
    // 狙いが少しずれて置いた指をそのまま直せるし、攻撃→跳も指を伸ばすだけで出る。
    // 移動中のスティックは別。歩いている途中でボタンに化けては困る。
    const next = this._btnAt(x, y);
    if (next !== role) {
      this._releaseBtn(role);
      this._pressBtn(next);
      pointers.set(e.pointerId, next);
    }
  },

  _onUp(e) {
    const role = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (role === 'stick') this._resetStick();
    else this._releaseBtn(role);
  },

  _updateStick(x, y) {
    let dx = x - STICK.ox, dy = y - STICK.oy; // フローティング原点からの変位
    const len = Math.hypot(dx, dy);
    // ノブは指そのまま（可動域でクランプするだけ）。指より遅れて動くと直感に反する
    const c = len > STICK.r ? STICK.r / len : 1;
    knob.x = STICK.ox + dx * c; knob.y = STICK.oy + dy * c;
    if (len <= DEAD) { this._clearDir(); return; }
    // 軸スナップ。斜めに少し入っただけで奥行きへ流れていくのを止める
    if (Math.abs(dx) > Math.abs(dy) * AXIS_SNAP) dy = 0;
    else if (Math.abs(dy) > Math.abs(dx) * AXIS_SNAP) dx = 0;
    // 倒し幅 → 速さ。不感帯の縁で WALK_MIN、FULL まで倒して 1.0
    const sp = WALK_MIN + (1 - WALK_MIN) * clamp((len - DEAD) / (FULL - DEAD), 0, 1);
    const n = Math.hypot(dx, dy) || 1;
    stickVec.x = (dx / n) * sp; stickVec.y = (dy / n) * sp;
    // 向きの真偽値はベクトルと必ず一致させる（軸スナップで切った側は false）
    touchDir.left = dx < 0; touchDir.right = dx > 0;
    touchDir.up = dy < 0; touchDir.down = dy > 0;
  },

  _clearDir() {
    touchDir.left = touchDir.right = touchDir.up = touchDir.down = false;
    stickVec.x = 0; stickVec.y = 0;
  },

  _resetStick() {
    this._clearDir();
    STICK.active = false;
    knob.x = STICK_HOME.cx; knob.y = STICK_HOME.cy;
  },

  down(...codes) { return codes.some((c) => held.has(c)); },
  pressed(...codes) { return codes.some((c) => pressed.has(c)); },

  get left()    { return this.down('ArrowLeft', 'KeyA') || touchDir.left; },
  get right()   { return this.down('ArrowRight', 'KeyD') || touchDir.right; },
  get up()      { return this.down('ArrowUp', 'KeyW') || touchDir.up; },
  get down_()   { return this.down('ArrowDown', 'KeyS') || touchDir.down; },

  // 移動ベクトル。大きさがそのまま速さの倍率になる。
  // タッチは倒し幅（歩き〜走りが地続き）、キーボードは押すか押さないかなので常に全速。
  // 斜めが速くならないよう、キーボードの斜めは 1/√2 に落とす。
  get moveVec() {
    if (stickVec.x || stickVec.y) { mv.x = stickVec.x; mv.y = stickVec.y; return mv; }
    let x = 0, y = 0;
    if (this.down('ArrowLeft', 'KeyA')) x -= 1;
    if (this.down('ArrowRight', 'KeyD')) x += 1;
    if (this.down('ArrowUp', 'KeyW')) y -= 1;
    if (this.down('ArrowDown', 'KeyS')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    mv.x = x; mv.y = y;
    return mv;
  },

  get attack()  { return this.pressed('KeyJ', 'KeyZ', 'TouchAttack'); },
  // 押しっぱなし。押した瞬間だけでは連打が要るので、持っている間はコンボを繋げる
  get attackHeld() { return this.down('KeyJ', 'KeyZ', 'TouchAttack'); },
  get jump()    { return this.pressed('KeyK', 'KeyX', 'TouchJump'); },
  // 奥の手。スマホは画面の「Ｋ」ボタン。キーボードは K がジャンプで埋まっているので L を当てる。
  // 1回しか使えないので、押せるのは残っているときだけ（specialReady はゲーム側が立てる）
  get special() { return this.specialReady && this.pressed('KeyL', 'TouchSpecial'); },
  get confirm() { return this.pressed('Enter', 'Space', 'KeyJ', 'KeyZ', 'TouchAttack', 'TouchConfirm'); },

  // canvas を覆っている DOM（説明の紙など）の上のタップを「決定」として渡す。
  // そこを押しても canvas の pointerdown は飛んでこないので、画面側から教えてもらう。
  tapConfirm() { pressed.add('TouchConfirm'); },

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
    // 奥の手は使い切ったら消す。押せないボタンが残っていると迷わせる
    if (this.specialReady) this._btn(ctx, BTN_C, 'Ｋ', held.has('TouchSpecial'));
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

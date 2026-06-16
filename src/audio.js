// 依存ゼロのチップチューンBGM（WebAudioで生成）。状態ごとにループ曲を切替。
// 自動再生規制のため、初回ユーザー操作で resume() してから鳴り始める。

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// 各曲: step=1ステップのms, len=ステップ数, lead/bass=MIDI(0=休符), drum=キック有無, once=一回のみ
const TRACKS = {
  title: {
    step: 160, len: 16,
    lead: [69, 0, 72, 74, 76, 0, 74, 72, 69, 0, 67, 69, 72, 0, 0, 0],
    bass: [45, 45, 52, 52, 41, 41, 48, 48, 45, 45, 52, 52, 40, 40, 47, 47],
    drum: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  },
  stage: {
    step: 132, len: 16,
    lead: [72, 76, 79, 76, 74, 77, 74, 72, 72, 76, 79, 81, 79, 76, 74, 72],
    bass: [48, 55, 48, 55, 50, 57, 50, 57, 53, 60, 53, 60, 55, 43, 55, 43],
    drum: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  boss: {
    step: 116, len: 16,
    lead: [69, 0, 68, 69, 72, 0, 71, 69, 64, 0, 65, 67, 68, 0, 67, 64],
    bass: [45, 45, 45, 0, 44, 44, 44, 0, 41, 41, 41, 0, 40, 40, 40, 40],
    drum: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  ending: {
    step: 168, len: 16,
    lead: [72, 76, 79, 84, 83, 79, 76, 72, 74, 77, 81, 86, 84, 81, 77, 74],
    bass: [48, 48, 55, 55, 53, 53, 55, 55, 50, 50, 57, 57, 55, 55, 48, 48],
    drum: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1],
  },
  gameover: {
    step: 230, len: 8, once: true,
    lead: [69, 67, 65, 64, 62, 60, 0, 0],
    bass: [57, 55, 53, 52, 50, 48, 0, 0],
    drum: [0, 0, 0, 0, 0, 0, 0, 0],
  },
};

export const Audio = {
  ctx: null, master: null, enabled: false, muted: false,
  _timer: null, _track: null, _step: 0,

  ensure() {
    if (this.ctx) return;
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.2;
    this.master.connect(this.ctx.destination);
  },

  // 初回ユーザー操作で呼ぶ
  resume() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.enabled = true;
    if (this._track) this._start(this._track);
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.2;
  },
  toggleMute() { this.setMuted(!this.muted); return this.muted; },

  // 曲を切替（同じ曲なら何もしない）。enable前は予約だけ。
  play(name) {
    if (this._track === name) return;
    this._track = name;
    if (this.enabled) this._start(name);
  },

  _start(name) {
    clearInterval(this._timer);
    this._step = 0;
    const t = TRACKS[name];
    if (!t || !this.ctx) { this._timer = null; return; }
    this._timer = setInterval(() => this._tick(t), t.step);
    this._tick(t);
  },

  _tick(t) {
    if (!this.ctx) return;
    const i = this._step % t.len;
    if (t.lead[i]) this._note(midi(t.lead[i]), t.step / 1000 * 0.9, 'square', 0.32);
    if (t.bass[i]) this._note(midi(t.bass[i]), t.step / 1000 * 1.7, 'triangle', 0.5);
    if (t.drum && t.drum[i]) this._kick();
    this._step++;
    if (t.once && this._step >= t.len) { clearInterval(this._timer); this._timer = null; } // _trackは保持＝再生しない
  },

  _note(freq, dur, type, g) {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain();
    o.type = type; o.frequency.value = freq;
    const now = c.currentTime;
    gn.gain.setValueAtTime(0.0001, now);
    gn.gain.linearRampToValueAtTime(g, now + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(now); o.stop(now + dur + 0.03);
  },

  _kick() {
    const c = this.ctx, o = c.createOscillator(), gn = c.createGain();
    const now = c.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(140, now);
    o.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    gn.gain.setValueAtTime(0.6, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    o.connect(gn); gn.connect(this.master);
    o.start(now); o.stop(now + 0.15);
  },
};

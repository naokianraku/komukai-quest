// 依存ゼロのチップチューンBGM（WebAudioで生成）。状態ごとにループ曲を切替。
// 自動再生規制のため、初回ユーザー操作で resume() してから鳴り始める。

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// 各曲: step=1ステップのms, len=ステップ数, lead/bass=MIDI(0=休符), drum=キック有無, once=一回のみ
const TRACKS = {
  title: { // 不気味な行進（半音の揺れ＋トライトーン）
    step: 196, len: 16,
    lead: [57, 0, 58, 57, 0, 0, 53, 0, 56, 0, 57, 56, 0, 0, 0, 0],
    bass: [45, 0, 45, 0, 45, 0, 51, 0, 44, 0, 44, 0, 51, 0, 45, 45],
    drum: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  },
  stage: { // 暗く緊張したオスティナート
    step: 150, len: 16,
    lead: [69, 68, 69, 72, 69, 68, 65, 64, 69, 68, 69, 74, 72, 71, 69, 68],
    bass: [45, 45, 46, 45, 45, 45, 51, 51, 45, 45, 46, 45, 44, 44, 45, 45],
    drum: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
  },
  boss: { // 恐怖の追い込み（A↔Eb トライトーン連打＋超低音ドローン）
    step: 126, len: 16,
    lead: [57, 63, 57, 63, 56, 62, 56, 62, 57, 63, 57, 63, 68, 67, 65, 63],
    bass: [33, 33, 39, 39, 33, 33, 39, 39, 32, 32, 38, 38, 33, 39, 33, 39],
    drum: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  ending: { // 重い勝利（短調→解決）
    step: 176, len: 16,
    lead: [57, 60, 64, 69, 68, 64, 60, 57, 59, 62, 67, 71, 69, 67, 64, 60],
    bass: [45, 45, 52, 52, 44, 44, 52, 52, 47, 47, 55, 55, 57, 57, 45, 45],
    drum: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1],
  },
  gameover: { // 沈み込む
    step: 240, len: 8, once: true,
    lead: [57, 56, 55, 53, 51, 49, 0, 0],
    bass: [45, 44, 43, 41, 39, 37, 0, 0],
    drum: [1, 0, 0, 0, 1, 0, 0, 0],
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
    // 効果音用ホワイトノイズ素材
    const len = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
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
    if (t.lead[i]) this._note(midi(t.lead[i]), t.step / 1000 * 0.95, 'sawtooth', 0.24);
    if (t.bass[i]) this._note(midi(t.bass[i]), t.step / 1000 * 1.8, 'triangle', 0.5);
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

  // 攻撃の振り（ヒュッ）
  sfxSwing() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(1900, now);
    f.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.16, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.11);
  },

  // 命中の打撃（ドカッ）= ノイズ + 低音の衝撃
  sfxHit() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.5, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.13);
    const o = c.createOscillator(), g2 = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, now);
    o.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    g2.gain.setValueAtTime(0.5, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o.connect(g2); g2.connect(this.master);
    o.start(now); o.stop(now + 0.14);
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

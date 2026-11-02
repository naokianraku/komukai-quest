// 依存ゼロのチップチューンBGM（WebAudioで生成）。状態ごとにループ曲を切替。
// 自動再生規制のため、初回ユーザー操作で resume() してから鳴り始める。

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// 各曲: step=1ステップのms, len=ステップ数, lead/bass=MIDI(0=休符), drum=キック有無, once=一回のみ
// 音符は数値(1ステップぶん)のほか [MIDI, 長さ(ステップ数)] でも書ける。伸ばす音に使う。
// harm は lead に重ねる第2声部（和音）。*Type/*Gain/*Voices/*Detune/*Atk/*Cut は任意で、
// 省略すると従来どおり（鋸波0.24 / 三角波0.5・1声・フィルタなし）＝既存曲の響きは変わらない。
export const TRACKS = {
  // 冒険の始まりのファンファーレ（ニ長調）。呼びかけ（短・短・長）→ 下りながらの応答 →
  // 駆け上がって頂点で伸ばす、の3段。金管の合奏に寄せたいので、
  // 鋸波を3声わずかにずらして重ね、低域通過フィルタで角を落とし、3度下の第2声部を添えている。
  // 勢いはベースと太鼓で出す: ベースは root とオクターブ上を刻み続け、
  // 太鼓は裏も打って、最後だけ連打で締める。伸ばす音の裏でも足が止まらないようにする。
  title: {
    step: 130, len: 48,
    leadType: 'sawtooth', leadGain: 0.155, leadVoices: 3, leadDetune: 9, leadAtk: 0.024, leadCut: 3000,
    harmGain: 0.085, harmVoices: 2, harmDetune: 7, harmAtk: 0.03, harmCut: 2200,
    bassType: 'triangle', bassGain: 0.33,
    lead: [
      69, 0, 69, 69, [74, 2], 0, 74, 76,   [78, 2], 0, [81, 2], 81, [86, 3], 0, 0, 83,
      [83, 2], 0, 81, 81, [79, 2], 0, 78, 79,   [76, 2], 0, 78, 79, [81, 3], 0, 81, 83,
      74, 76, 78, 79, [81, 2], 0, 83, 85,   [86, 6], 0, 0, 0, 0, 0, 83, 86,
    ],
    harm: [
      66, 0, 66, 66, [69, 2], 0, 69, 73,   [74, 2], 0, [78, 2], 78, [81, 3], 0, 0, 79,
      [79, 2], 0, 78, 78, [76, 2], 0, 74, 76,   [73, 2], 0, 74, 76, [78, 3], 0, 78, 79,
      71, 73, 74, 76, [78, 2], 0, 79, 81,   [81, 6], 0, 0, 0, 0, 0, 79, 81,
    ],
    bass: [
      38, 50, 38, 50, 38, 50, 38, 50,   38, 50, 38, 50, 45, 57, 45, 57,
      35, 47, 35, 47, 31, 43, 31, 43,   33, 45, 33, 45, 33, 45, 33, 45,
      38, 50, 38, 50, 33, 45, 33, 45,   [38, 6], 0, 0, 0, 0, 0, 38, 45,
    ],
    drum: [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1,
      1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1,
      1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1,
    ],
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
  hell: { // 業火の60号7階Aゾーン。半音ずつ沈むベースの上に、常に三全音が乗る。
    // 前半は鐘のように重く、後半は半音で駆け上がって追い詰める。
    step: 142, len: 32, leadGain: 0.26, bassType: 'sawtooth', bassGain: 0.46,
    lead: [68, 0, 67, 0, 66, 0, 65, 0,
           64, 0, 63, 0, 62, 0, 61, 0,
           80, 0, 79, 78, 77, 0, 76, 75,
           74, 0, 73, 72, 71, 70, 69, 68],
    bass: [38, 38, 37, 37, 36, 36, 35, 35,
           34, 34, 33, 33, 32, 32, 31, 31,
           38, 38, 37, 37, 36, 36, 35, 35,
           34, 34, 33, 33, 32, 32, 31, 31],
    drum: [1, 0, 0, 1, 1, 0, 0, 1,
           1, 0, 0, 1, 1, 0, 0, 1,
           1, 0, 1, 0, 1, 0, 1, 0,
           1, 1, 1, 1, 1, 1, 1, 1],
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

  // 一時停止: スケジューラを止める（鳴っている音は短いのですぐ消える）／解除で再開
  setMusicPaused(p) {
    this._musicPaused = p;
    if (p) { clearInterval(this._timer); this._timer = null; }
    else if (this.enabled && this._track) this._start(this._track);
  },

  _start(name) {
    clearInterval(this._timer);
    this._step = 0;
    const t = TRACKS[name];
    if (!t || !this.ctx) { this._timer = null; return; }
    this._timer = setInterval(() => this._tick(t), t.step);
    this._tick(t);
  },

  // 数値 → {n, len:1} / [MIDI, 長さ] → {n, len}
  _at(arr, i) {
    const v = arr && arr[i];
    if (!v) return null;
    return Array.isArray(v) ? { n: v[0], len: v[1] || 1 } : { n: v, len: 1 };
  },

  _tick(t) {
    if (!this.ctx) return;
    const i = this._step % t.len;
    const L = this._at(t.lead, i), H = this._at(t.harm, i), B = this._at(t.bass, i);
    const v = (pre) => ({
      voices: t[pre + 'Voices'] || 1, detune: t[pre + 'Detune'] || 0,
      atk: t[pre + 'Atk'], cut: t[pre + 'Cut'],
    });
    if (L) this._note(midi(L.n), t.step / 1000 * 0.95 * L.len, t.leadType || 'sawtooth', t.leadGain ?? 0.24, v('lead'));
    if (H) this._note(midi(H.n), t.step / 1000 * 0.95 * H.len, t.harmType || t.leadType || 'sawtooth', t.harmGain ?? 0.12, v('harm'));
    if (B) this._note(midi(B.n), t.step / 1000 * 1.8 * B.len, t.bassType || 'triangle', t.bassGain ?? 0.5, v('bass'));
    if (t.drum && t.drum[i]) this._kick();
    this._step++;
    if (t.once && this._step >= t.len) { clearInterval(this._timer); this._timer = null; } // _trackは保持＝再生しない
  },

  // opts.voices>1 で少しずつ音程をずらした同じ音を重ねる（厚みが出る）。
  // opts.cut を入れると低域通過フィルタを通す（鋸波の角を落として管楽器寄りにする）。
  _note(freq, dur, type, g, opts = {}) {
    const c = this.ctx, now = c.currentTime;
    const voices = Math.max(1, opts.voices || 1);
    const atk = opts.atk ?? 0.012;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.0001, now);
    gn.gain.linearRampToValueAtTime(g, now + atk);
    gn.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    let tail = gn;
    if (opts.cut) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opts.cut; f.Q.value = 0.6;
      gn.connect(f); tail = f;
    }
    tail.connect(this.master);
    for (let i = 0; i < voices; i++) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = freq;
      if (opts.detune) o.detune.value = (i - (voices - 1) / 2) * opts.detune;
      o.connect(gn); o.start(now); o.stop(now + dur + 0.03);
    }
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

  // 一升瓶が割れる（パリーン）= 高域ノイズの短い破裂 + 高い倍音の残り
  sfxSmash() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.42, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.24);
    // ガラスの鳴り。少しずらして2つ重ねると「パリン」と割れたように聞こえる
    [3100, 4300].forEach((hz, i) => {
      const o = c.createOscillator(), g2 = c.createGain();
      o.type = 'triangle'; o.frequency.value = hz;
      const t0 = now + i * 0.03;
      g2.gain.setValueAtTime(0.16, t0);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      o.connect(g2); g2.connect(this.master);
      o.start(t0); o.stop(t0 + 0.18);
    });
  },

  // 鉄パイプが跳ねる（カーン）= 金属の倍音が長く残る
  sfxClang() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    [1180, 1790, 2630].forEach((hz, i) => {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = 'square'; o.frequency.value = hz;
      gn.gain.setValueAtTime(0.1 / (i + 1), now);
      gn.gain.exponentialRampToValueAtTime(0.001, now + 0.42 - i * 0.1);
      o.connect(gn); gn.connect(this.master);
      o.start(now); o.stop(now + 0.46);
    });
  },

  // 鉄アレイが落ちる（ドスン）= 低音の塊。倍音を持たせず鈍く
  sfxThud() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const o = c.createOscillator(), gn = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, now);
    o.frequency.exponentialRampToValueAtTime(38, now + 0.16);
    gn.gain.setValueAtTime(0.7, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(gn); gn.connect(this.master);
    o.start(now); o.stop(now + 0.22);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.4, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(f); f.connect(g2); g2.connect(this.master);
    src.start(now); src.stop(now + 0.16);
  },

  // 彗星の着弾（ズドォン）= 落ちてくる唸りではなく、着いた瞬間の重い炸裂
  sfxMeteor() {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, now = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, now);
    f.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0.75, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(now); src.stop(now + 0.52);
    const o = c.createOscillator(), g2 = c.createGain();   // 腹に来る低音
    o.type = 'sine';
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(26, now + 0.4);
    g2.gain.setValueAtTime(0.9, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    o.connect(g2); g2.connect(this.master);
    o.start(now); o.stop(now + 0.48);
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

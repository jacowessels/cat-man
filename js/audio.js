// All music and sound effects are generated live with the Web Audio API.
// The music is an original spy-thriller style loop in 5/4 time.
const MUTE_KEY = 'catman.muted';

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// --- Song data (eighth-note steps, 10 per bar of 5/4) -------------------
// Bass patterns: one note per step, null = rest.
const BASS = {
  a: [45, null, 45, 48, null, 45, null, 43, 44, null],
  b: [45, null, 45, 48, null, 50, null, 51, 50, 48],
  c: [41, null, 41, 44, null, 41, null, 40, 41, null],
  d: [40, null, 40, 43, null, 46, null, 45, 44, 43],
};
const BASS_ORDER = ['a', 'a', 'b', 'a', 'c', 'c', 'd', 'a'];
const CHORDS = [
  [57, 60, 64], [57, 60, 64], [57, 62, 65], [57, 60, 64],
  [53, 57, 60], [53, 57, 60], [52, 56, 59], [57, 60, 64],
];
// Melody: [step, midi note, length in steps]
const MELODY = [
  [],
  [[4, 76, 2], [6, 74, 1], [7, 76, 3]],
  [[0, 79, 3], [3, 77, 1], [4, 76, 2], [6, 75, 4]],
  [[0, 76, 2], [2, 72, 2], [4, 74, 2], [6, 71, 4]],
  [[0, 69, 6], [7, 72, 1], [8, 74, 1], [9, 75, 1]],
  [[0, 77, 2], [2, 76, 2], [4, 77, 2], [6, 80, 4]],
  [[0, 79, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2], [6, 76, 4]],
  [[0, 81, 2], [2, 80, 2], [4, 79, 2], [6, 78, 2], [8, 77, 2]],
];
const KICK_STEPS = new Set([0, 6]);
const SNARE_STEPS = new Set([3, 8]);
const STEPS_PER_BAR = 10;
const BARS = 8;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // ignore
    }
    this.bpm = 132;
    this.playing = false;
    this.timer = null;
    this.lastSqueak = 0;
    this.squeakFlip = false;
  }

  // Must be called from a tap or click (browser rule for sound).
  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // Play a silent buffer: unlocks audio on older iOS versions.
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, 22050);
    src.connect(this.ctx.destination);
    src.start(0);
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  makeNoise() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  noiseSource(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  env(gainNode, t, peak, attack, dur, release = 0.05) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.setValueAtTime(peak, t + Math.max(attack, dur - release));
    g.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  // ---------------- Music ----------------
  startMusic(bpm = this.bpm) {
    if (!this.ctx) return;
    this.bpm = bpm;
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.05);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  setTempo(bpm) {
    this.bpm = bpm;
  }

  duck(on) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.12 : 0.55, this.ctx.currentTime, 0.1);
  }

  schedule() {
    const c = this.ctx;
    if (!c) return;
    const eighth = 60 / this.bpm / 2;
    // If the tab was hidden for a while, skip ahead instead of catching up.
    if (this.nextTime < c.currentTime - 0.2) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, eighth);
      this.nextTime += eighth;
      this.step = (this.step + 1) % (STEPS_PER_BAR * BARS);
    }
  }

  playStep(step, t, eighth) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    if (KICK_STEPS.has(s)) this.kick(t);
    if (SNARE_STEPS.has(s)) this.snare(t);
    this.hat(t, s % 2 === 0 ? 0.05 : 0.025);
    const b = BASS[BASS_ORDER[bar]][s];
    if (b != null) this.bass(midi(b), t, eighth * 0.85);
    if (s === 0) for (const n of CHORDS[bar]) this.stab(midi(n), t, eighth * 1.6);
    if (s === 5) for (const n of CHORDS[bar]) this.stab(midi(n), t, eighth * 0.6, 0.6);
    for (const [st, note, len] of MELODY[bar]) {
      if (st === s) this.lead(midi(note), t, eighth * len * 0.95);
    }
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.7, 0.003, 0.2, 0.15);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }

  snare(t) {
    const c = this.ctx;
    const n = this.noiseSource(t, 0.15);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, 0.28, 0.002, 0.14, 0.12);
    n.connect(f).connect(g).connect(this.musicBus);
  }

  hat(t, vol) {
    const c = this.ctx;
    const n = this.noiseSource(t, 0.05);
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = c.createGain();
    this.env(g, t, vol, 0.001, 0.045, 0.04);
    n.connect(f).connect(g).connect(this.musicBus);
  }

  bass(freq, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.32, 0.005, dur, 0.04);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  stab(freq, t, dur, vol = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 14;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1500;
    const g = c.createGain();
    this.env(g, t, 0.045 * vol, 0.01, dur, 0.08);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  lead(freq, t, dur) {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.linearRampToValueAtTime(3200, t + 0.08);
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 0;
    lfoGain.gain.linearRampToValueAtTime(9, t + Math.min(0.3, dur));
    lfo.connect(lfoGain);
    for (const [type, det, vol] of [['sawtooth', -6, 0.07], ['square', 6, 0.05]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      lfoGain.connect(o.detune);
      const og = c.createGain();
      og.gain.value = vol;
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    this.env(g, t, 1, 0.02, dur, Math.min(0.08, dur / 2));
    f.connect(g).connect(this.musicBus);
  }

  // ---------------- Sound effects ----------------
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'mouse':
        return this.squeak(t);
      case 'catnip':
        this.sparkle(t);
        return this.meow(t + 0.05, 1.15);
      case 'dogEaten':
        this.yelp(t);
        return this.meow(t + 0.25, 1.3, 0.35);
      case 'caught':
        this.bark(t);
        this.bark(t + 0.22);
        return this.growl(t + 0.5, 1.2);
      case 'fish':
        this.arp(t, [72, 76, 79, 84], 0.07, 'triangle');
        return this.meow(t + 0.3, 1.25, 0.35);
      case 'fishAppear':
        return this.arp(t, [84, 88], 0.06, 'triangle');
      case 'levelStart':
        return this.meow(t, opts.pitch || 1);
      case 'levelClear':
        this.arp(t, [69, 72, 76, 81, 84], 0.1, 'triangle');
        return this.meow(t + 0.55, 1.1);
      case 'gameOver':
        this.sadSlide(t);
        return this.growl(t + 0.2, 1.6);
      case 'click':
        return this.arp(t, [79], 0.05, 'triangle');
      default:
        return undefined;
    }
  }

  squeak(t) {
    if (t - this.lastSqueak < 0.06) return;
    this.lastSqueak = t;
    this.squeakFlip = !this.squeakFlip;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    const base = this.squeakFlip ? 2100 : 2500;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.04);
    o.frequency.exponentialRampToValueAtTime(base * 1.1, t + 0.07);
    const g = c.createGain();
    this.env(g, t, 0.07, 0.004, 0.08, 0.03);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  // "Mee-ow": a buzzy tone sung through filters that move from "ee" to "ow".
  meow(t, pitch = 1, len = 0.6) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f0 = 430 * pitch;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.75, t + len * 0.22);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + len * 0.6);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.85, t + len);
    const vib = c.createOscillator();
    const vibG = c.createGain();
    vib.frequency.value = 7;
    vibG.gain.value = 18;
    vib.connect(vibG).connect(o.frequency);

    const out = c.createGain();
    this.env(out, t, 0.32, 0.04, len, len * 0.3);
    const formants = [
      // [start, middle, end] frequency, Q, gain
      [[350, 850, 450], 6, 1.0],
      [[2300, 1300, 800], 9, 0.7],
      [[3000, 2600, 2400], 12, 0.25],
    ];
    for (const [[a, b, e], q, vol] of formants) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + len * 0.45);
      bp.frequency.linearRampToValueAtTime(e, t + len);
      const fg = c.createGain();
      fg.gain.value = vol * 2.2;
      o.connect(bp).connect(fg).connect(out);
    }
    out.connect(this.sfxBus);
    o.start(t);
    vib.start(t);
    o.stop(t + len + 0.05);
    vib.stop(t + len + 0.05);
  }

  bark(t) {
    const c = this.ctx;
    const out = c.createGain();
    this.env(out, t, 0.6, 0.005, 0.17, 0.1);
    out.connect(this.sfxBus);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(330, t);
    o.frequency.linearRampToValueAtTime(420, t + 0.03);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.17);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.17);
    lp.Q.value = 3;
    o.connect(lp).connect(out);
    o.start(t);
    o.stop(t + 0.2);
    const n = this.noiseSource(t, 0.12);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 1.2;
    const ng = c.createGain();
    this.env(ng, t, 0.5, 0.002, 0.09, 0.07);
    n.connect(bp).connect(ng).connect(out);
  }

  growl(t, dur = 1) {
    const c = this.ctx;
    const out = c.createGain();
    this.env(out, t, 0.45, 0.15, dur, 0.3);
    out.connect(this.sfxBus);
    // Rough, rumbling tone: low saws with a fast wobble in volume.
    const rumble = c.createGain();
    rumble.gain.value = 0.6;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 24;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.4;
    lfo.connect(lfoG).connect(rumble.gain);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    lp.Q.value = 4;
    for (const [freq, type] of [[78, 'sawtooth'], [117, 'sawtooth'], [80, 'square']]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.linearRampToValueAtTime(freq * 0.85, t + dur);
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const n = this.noiseSource(t, dur);
    const nf = c.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 450;
    n.connect(nf).connect(rumble);
    lp.connect(rumble).connect(out);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  yelp(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    const g = c.createGain();
    this.env(g, t, 0.3, 0.005, 0.26, 0.1);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.3);
  }

  sparkle(t) {
    this.arp(t, [88, 91, 96], 0.05, 'sine', 0.12);
  }

  arp(t, notes, gap, type = 'triangle', vol = 0.18) {
    const c = this.ctx;
    notes.forEach((n, i) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = midi(n);
      const g = c.createGain();
      const st = t + i * gap;
      this.env(g, st, vol, 0.005, gap * 2.2, gap);
      o.connect(g).connect(this.sfxBus);
      o.start(st);
      o.stop(st + gap * 2.5);
    });
  }

  sadSlide(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 1.3);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = c.createGain();
    this.env(g, t, 0.18, 0.02, 1.3, 0.3);
    o.connect(lp).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 1.4);
  }
}

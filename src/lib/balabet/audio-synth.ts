// Web Audio API Synthesizer Engine for BalaBet
// Original futuristic casino / synthwave chill soundtrack
// Fully synthesized without external audio files; zero telemetry, zero performance impact.

const STORAGE_KEY = "balabet-audio-settings";

interface AudioSettings {
  volume: number;
  muted: boolean;
}

function loadSettings(): AudioSettings {
  if (typeof window === "undefined") {
    return { volume: 0.35, muted: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { volume: 0.35, muted: false };
    const parsed = JSON.parse(raw);
    const volume = typeof parsed.volume === "number" && !isNaN(parsed.volume) ? Math.max(0, Math.min(1, parsed.volume)) : 0.35;
    const muted = Boolean(parsed.muted);
    return { volume, muted };
  } catch {
    return { volume: 0.35, muted: false };
  }
}

function saveSettings(settings: AudioSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

// 102 BPM - Chill, futuristic, engaging neon groove
const BPM = 102;
const SECONDS_PER_BEAT = 60 / BPM;
const SECONDS_PER_SIXTEENTH = SECONDS_PER_BEAT / 4;
const TOTAL_STEPS = 64; // 4 bars of 16 steps

// Note frequency map
const FREQ: Record<string, number> = {
  D2: 73.42,
  F2: 87.31,
  G2: 98.00,
  A2: 110.00,
  Bb2: 116.54,
  C2: 65.41,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.00,
  A3: 220.00,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.00,
  A4: 440.00,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.00,
};

// Harmony progression over 4 bars (each bar is 16 sixteenths):
// Bar 1: Dm9 (steps 0-15)
// Bar 2: Bbmaj7 (steps 16-31)
// Bar 3: Gm9 (steps 32-47)
// Bar 4: Asus4 -> A7 (steps 48-63)
const PAD_CHORDS = [
  { startStep: 0, notes: ["D3", "F3", "A3", "C4", "E4"] },
  { startStep: 16, notes: ["Bb2", "D3", "F3", "A3", "C4"] },
  { startStep: 32, notes: ["G2", "Bb2", "D3", "F3", "A3"] },
  { startStep: 48, notes: ["A2", "D3", "E3", "A3", "C4"] },
];

// Rolling synthwave bass pattern (step, note)
const BASS_LINE: { step: number; note: string }[] = [
  // Bar 1 - Dm
  { step: 0, note: "D2" }, { step: 2, note: "D2" }, { step: 4, note: "D2" }, { step: 6, note: "F2" },
  { step: 8, note: "D2" }, { step: 10, note: "D2" }, { step: 12, note: "A2" }, { step: 14, note: "D2" },
  // Bar 2 - Bb
  { step: 16, note: "Bb2" }, { step: 18, note: "Bb2" }, { step: 20, note: "Bb2" }, { step: 22, note: "D2" },
  { step: 24, note: "Bb2" }, { step: 26, note: "Bb2" }, { step: 28, note: "F2" }, { step: 30, note: "Bb2" },
  // Bar 3 - Gm
  { step: 32, note: "G2" }, { step: 34, note: "G2" }, { step: 36, note: "G2" }, { step: 38, note: "Bb2" },
  { step: 40, note: "G2" }, { step: 42, note: "G2" }, { step: 44, note: "D2" }, { step: 46, note: "G2" },
  // Bar 4 - Asus4 / A
  { step: 48, note: "A2" }, { step: 50, note: "A2" }, { step: 52, note: "A2" }, { step: 54, note: "C2" },
  { step: 56, note: "A2" }, { step: 58, note: "A2" }, { step: 60, note: "D2" }, { step: 62, note: "E3" },
];

// Arpeggiator / Casino sparkle chime melody
const ARP_LINE: { step: number; note: string }[] = [
  // Bar 1
  { step: 0, note: "A4" }, { step: 3, note: "D5" }, { step: 6, note: "F5" }, { step: 9, note: "E5" },
  { step: 12, note: "A4" }, { step: 14, note: "D5" },
  // Bar 2
  { step: 16, note: "F4" }, { step: 19, note: "A4" }, { step: 22, note: "D5" }, { step: 25, note: "C5" },
  { step: 28, note: "A4" }, { step: 30, note: "F4" },
  // Bar 3
  { step: 32, note: "G4" }, { step: 35, note: "Bb4" }, { step: 38, note: "D5" }, { step: 41, note: "F5" },
  { step: 44, note: "D5" }, { step: 46, note: "Bb4" },
  // Bar 4
  { step: 48, note: "E4" }, { step: 51, note: "A4" }, { step: 54, note: "C5" }, { step: 57, note: "E5" },
  { step: 60, note: "G5" }, { step: 62, note: "E5" },
];

export class BalaBetAudioEngine {
  private static instance: BalaBetAudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private arpGain: GainNode | null = null;
  private drumGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlayingState = false;
  private volumeState: number = 0.35;
  private isMutedState = false;

  private currentStep = 0;
  private nextStepTime = 0;
  private timerId: number | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    const saved = loadSettings();
    this.volumeState = saved.volume;
    this.isMutedState = saved.muted;
  }

  public static getInstance(): BalaBetAudioEngine {
    if (!BalaBetAudioEngine.instance) {
      BalaBetAudioEngine.instance = new BalaBetAudioEngine();
    }
    return BalaBetAudioEngine.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public get isPlaying(): boolean {
    return this.isPlayingState;
  }

  public get isMuted(): boolean {
    return this.isMutedState;
  }

  public get volume(): number {
    return this.volumeState;
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    // Create 1-second white noise buffer for soft hi-hats and snares
    const bufferSize = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Master Gain
    this.masterGain = this.ctx.createGain();
    const effectiveVol = this.isMutedState ? 0 : this.volumeState;
    this.masterGain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Instrument sub-gains with gentle leveling
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.padGain.connect(this.masterGain);

    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.bassGain.connect(this.masterGain);

    this.arpGain = this.ctx.createGain();
    this.arpGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.arpGain.connect(this.masterGain);

    this.drumGain = this.ctx.createGain();
    this.drumGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.drumGain.connect(this.masterGain);
  }

  public async play(): Promise<void> {
    if (this.isPlayingState) return;

    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    this.isPlayingState = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.startScheduler();
    this.notify();
  }

  public pause(): void {
    if (!this.isPlayingState) return;

    this.isPlayingState = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.masterGain && this.ctx) {
      // Smooth fade out over 30ms to prevent click
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
      setTimeout(() => {
        if (!this.isPlayingState && this.masterGain && this.ctx) {
          const effective = this.isMutedState ? 0 : this.volumeState;
          this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
        }
      }, 50);
    }

    this.notify();
  }

  public togglePlay(): void {
    if (this.isPlayingState) {
      this.pause();
    } else {
      void this.play();
    }
  }

  public toggleMute(): void {
    this.isMutedState = !this.isMutedState;
    this.updateGain();
    saveSettings({ volume: this.volumeState, muted: this.isMutedState });
    this.notify();
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volumeState = clamped;
    if (clamped > 0 && this.isMutedState) {
      this.isMutedState = false;
    }
    this.updateGain();
    saveSettings({ volume: this.volumeState, muted: this.isMutedState });
    this.notify();
  }

  private updateGain() {
    if (!this.masterGain || !this.ctx) return;
    const effective = this.isMutedState ? 0 : this.volumeState;
    this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.02);
  }

  private startScheduler() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }
    // Check every 25ms and schedule events up to 100ms ahead
    this.timerId = window.setInterval(() => {
      this.scheduleLookahead();
    }, 25);
  }

  private scheduleLookahead() {
    if (!this.ctx || !this.isPlayingState) return;

    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.nextStepTime += SECONDS_PER_SIXTEENTH;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
  }

  private scheduleStep(step: number, time: number) {
    if (!this.ctx) return;

    // 1. Synth Chords / Warm Pad (triggers at start of each bar: step 0, 16, 32, 48)
    const chord = PAD_CHORDS.find((c) => c.startStep === step);
    if (chord && this.padGain) {
      this.triggerPadChord(chord.notes, time, SECONDS_PER_BEAT * 4);
    }

    // 2. Rolling Bassline
    const bass = BASS_LINE.find((b) => b.step === step);
    if (bass && this.bassGain) {
      this.triggerBass(FREQ[bass.note], time, SECONDS_PER_SIXTEENTH * 1.8);
    }

    // 3. Arpeggiator / Sparkle Pluck
    const arp = ARP_LINE.find((a) => a.step === step);
    if (arp && this.arpGain) {
      this.triggerArp(FREQ[arp.note], time);
    }

    // 4. Subtle Electronic Drums
    if (this.drumGain) {
      // Soft kick on beats 1 and 3 of each bar (every 8 steps: 0, 8, 16, 24, etc.)
      // plus a gentle syncopation on step 10, 26, 42, 58
      const isKickStep = step % 8 === 0 || step % 16 === 10;
      if (isKickStep) {
        this.triggerSoftKick(time);
      }

      // Smooth snare / rim on beats 2 and 4 (steps 4, 12, 20, 28, etc.)
      const isSnareStep = step % 8 === 4;
      if (isSnareStep) {
        this.triggerSoftSnare(time);
      }

      // Delicate hi-hat ticks on every 2nd step (even steps)
      if (step % 2 === 0) {
        const isAccent = step % 4 === 2; // upbeat accent
        this.triggerHiHat(time, isAccent);
      }
    }
  }

  private triggerPadChord(notes: string[], time: number, duration: number) {
    if (!this.ctx || !this.padGain) return;

    notes.forEach((note) => {
      const freq = FREQ[note];
      if (!freq) return;

      const osc = this.ctx!.createOscillator();
      const osc2 = this.ctx!.createOscillator();
      const filter = this.ctx!.createBiquadFilter();
      const gain = this.ctx!.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);

      // Gentle warm detune
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq * 1.003, time);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.exponentialRampToValueAtTime(750, time + duration * 0.4);
      filter.frequency.exponentialRampToValueAtTime(400, time + duration);

      // Smooth attack and release envelope
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.07, time + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.045, time + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.padGain!);

      osc.start(time);
      osc2.start(time);
      osc.stop(time + duration);
      osc2.stop(time + duration);
    });
  }

  private triggerBass(freq: number, time: number, duration: number) {
    if (!this.ctx || !this.bassGain || !freq) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);
    filter.Q.setValueAtTime(3.5, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bassGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerArp(freq: number, time: number) {
    if (!this.ctx || !this.arpGain || !freq) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 1.2, time);
    filter.Q.setValueAtTime(1.5, time);

    // Fast decay sparkle pluck
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.arpGain);

    osc.start(time);
    osc.stop(time + 0.35);

    // Simulated soft ping-pong echo note
    const echoOsc = this.ctx.createOscillator();
    const echoGain = this.ctx.createGain();
    const echoTime = time + SECONDS_PER_SIXTEENTH * 1.5;

    echoOsc.type = "sine";
    echoOsc.frequency.setValueAtTime(freq * 1.5, echoTime);
    echoGain.gain.setValueAtTime(0.035, echoTime);
    echoGain.gain.exponentialRampToValueAtTime(0.0001, echoTime + 0.22);

    echoOsc.connect(echoGain);
    echoGain.connect(this.arpGain);

    echoOsc.start(echoTime);
    echoOsc.stop(echoTime + 0.25);
  }

  private triggerSoftKick(time: number) {
    if (!this.ctx || !this.drumGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.drumGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private triggerSoftSnare(time: number) {
    if (!this.ctx || !this.drumGain || !this.noiseBuffer) return;

    // Noise component
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1200, time);
    noiseFilter.Q.setValueAtTime(1.2, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.drumGain);

    // Subtle low tone body
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(180, time);
    body.frequency.exponentialRampToValueAtTime(80, time + 0.08);

    bodyGain.gain.setValueAtTime(0.08, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    body.connect(bodyGain);
    bodyGain.connect(this.drumGain);

    noise.start(time);
    noise.stop(time + 0.15);
    body.start(time);
    body.stop(time + 0.1);
  }

  private triggerHiHat(time: number, isAccent: boolean) {
    if (!this.ctx || !this.drumGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(8500, time);

    const gain = this.ctx.createGain();
    const vol = isAccent ? 0.07 : 0.035;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.045);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.drumGain);

    noise.start(time);
    noise.stop(time + 0.05);
  }
}

// Global accessor
export function getAudioEngine(): BalaBetAudioEngine {
  return BalaBetAudioEngine.getInstance();
}

/**
 * Procedural Web Audio Engine for PROTOCOL: APEX
 * 100% synthesized sound effects: weapons, reloads, footsteps, abilities, objectives, and hitmarkers
 */

import { Agent, WeaponCategory } from '../types/game';
import { AGENT_VOICE_PROFILES, VoiceLineEvent } from '../data/voiceLines';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private presenceFilter: BiquadFilterNode | null = null;
  private voiceVolume: number = 0.85;
  private isMuted: boolean = false;
  private initialized: boolean = false;
  private heartbeatOsc: OscillatorNode | null = null;
  private heartbeatGain: GainNode | null = null;
  private lastVoiceTime: number = 0;
  private lastVoicePriority: number = 0;
  private lastBotGunshotMs: number = 0;
  private gunshotNoiseBuffer: AudioBuffer | null = null;

  public init() {
    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Headphone Comfort Compressor & Limiter (prevents any volume spikes or clipping in headphones)
      const masterCompressor = this.ctx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-20, this.ctx.currentTime);
      masterCompressor.knee.setValueAtTime(24, this.ctx.currentTime);
      masterCompressor.ratio.setValueAtTime(5, this.ctx.currentTime);
      masterCompressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
      masterCompressor.release.setValueAtTime(0.22, this.ctx.currentTime);

      // Roll off piercing top end and soften the presence band without removing useful detail.
      const masterWarmthFilter = this.ctx.createBiquadFilter();
      masterWarmthFilter.type = 'lowpass';
      masterWarmthFilter.frequency.setValueAtTime(4800, this.ctx.currentTime);
      masterWarmthFilter.Q.setValueAtTime(0.55, this.ctx.currentTime);
      this.presenceFilter = this.ctx.createBiquadFilter();
      this.presenceFilter.type = 'peaking';
      this.presenceFilter.frequency.setValueAtTime(2500, this.ctx.currentTime);
      this.presenceFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
      this.presenceFilter.gain.setValueAtTime(-6, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(masterWarmthFilter);
      masterWarmthFilter.connect(this.presenceFilter);
      this.presenceFilter.connect(masterCompressor);
      masterCompressor.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.setValueAtTime(this.voiceVolume * 0.6, this.ctx.currentTime);
      this.voiceGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Pre-warm Web Speech API voice list so all OS/browser voices are ready
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.getVoices();
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
          };
        } catch {}
      }

      this.initialized = true;
    } catch {
      // Audio context may not be allowed until user gesture
    }
  }

  public setVolumes(master: number, sfx: number, music: number, muted: boolean, voice: number = 0.85) {
    this.isMuted = muted;
    this.voiceVolume = voice;
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : master * 0.65, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(sfx * 0.35, now, 0.08);
    if (this.voiceGain) {
      this.voiceGain.gain.setTargetAtTime(voice * 0.6, now, 0.08);
    }
    this.musicGain.gain.setTargetAtTime(music * 0.5, now, 0.08);
  }

  private ensureContext(): boolean {
    if (!this.initialized || !this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!(this.ctx && !this.isMuted);
  }

  /**
   * Procedural Gunshot sound generator with tailored acoustic profiles and headphone-safe attenuation
   */
  public playGunshot(
    category: string,
    isSuppressed: boolean = false,
    volumeScale: number = 1.0,
    stereoPan: number = 0
  ) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;

    // Rate-limit distant/bot gunfire so simultaneous bot shots never stack and clip
    if (volumeScale < 0.95) {
      const nowMs = performance.now();
      if (nowMs - this.lastBotGunshotMs < 42) return;
      this.lastBotGunshotMs = nowMs;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = Math.max(0.03, Math.min(0.65, volumeScale * 0.65));

    // Create noise burst for transient crack (smoothed with gentle taper to prevent ear fatigue)
    if (!this.gunshotNoiseBuffer || this.gunshotNoiseBuffer.sampleRate !== ctx.sampleRate) {
      const bufferSize = Math.floor(ctx.sampleRate * 0.25);
      this.gunshotNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = this.gunshotNoiseBuffer.getChannelData(0);
      let lastNoise = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastNoise = lastNoise * 0.65 + white * 0.35;
        output[i] = lastNoise;
      }
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.gunshotNoiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    // Body Oscillator for punch/thump (warm sine/triangle rather than harsh raw square/sawtooth)
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();

    // Secondary sub-bass punch oscillator for cinematic depth
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    // Warm high-shelf safety roll-off to soften abrasive frequencies above 5.5kHz in headphones
    const earFatigueFilter = ctx.createBiquadFilter();
    earFatigueFilter.type = 'lowpass';
    earFatigueFilter.frequency.setValueAtTime(3000, now);

    switch (category) {
      case 'Melee':
        // Smooth blade whoosh with soft air displacement
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, now);
        noiseFilter.Q.setValueAtTime(1.8, now);
        noiseGain.gain.setValueAtTime(0.22, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(320, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
        bodyGain.gain.setValueAtTime(0.25, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        break;

      case 'Pistols':
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(isSuppressed ? 520 : 1050, now);
        noiseGain.gain.setValueAtTime(isSuppressed ? 0.13 : 0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + (isSuppressed ? 0.055 : 0.075));

        // Avoid the pitched oscillator on pistols; it can sound like an alert tone on small speakers.
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(90, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(42, now + 0.055);
        bodyGain.gain.setValueAtTime(0.07, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        break;

      case 'SMGs':
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(isSuppressed ? 950 : 1650, now);
        noiseGain.gain.setValueAtTime(0.24, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(190, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(60, now + 0.07);
        bodyGain.gain.setValueAtTime(0.28, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        break;

      case 'Assault Rifles':
        // Warm cinematic rifle crack with deep low-mid resonance
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(isSuppressed ? 900 : 1850, now);
        noiseFilter.Q.setValueAtTime(1.6, now);
        noiseGain.gain.setValueAtTime(isSuppressed ? 0.22 : 0.36, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(220, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
        bodyGain.gain.setValueAtTime(0.42, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(95, now);
        subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
        subGain.gain.setValueAtTime(0.3, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        break;

      case 'Shotguns':
        // Heavy bass boom with wide, cushioned blast
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseGain.gain.setValueAtTime(0.45, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(140, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
        bodyGain.gain.setValueAtTime(0.48, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(75, now);
        subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.22);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        break;

      case 'Sniper Rifles':
        // Deep sonic boom with round reverberation rather than piercing white noise
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(2100, now);
        noiseFilter.Q.setValueAtTime(2.0, now);
        noiseGain.gain.setValueAtTime(0.48, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(260, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
        bodyGain.gain.setValueAtTime(0.55, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(85, now);
        subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.3);
        subGain.gain.setValueAtTime(0.45, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        break;

      case 'LMGs':
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, now);
        noiseGain.gain.setValueAtTime(0.38, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(190, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(48, now + 0.13);
        bodyGain.gain.setValueAtTime(0.44, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        break;

      case 'Heavy Weapons':
      default:
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, now);
        noiseGain.gain.setValueAtTime(0.46, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(110, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(28, now + 0.28);
        bodyGain.gain.setValueAtTime(0.5, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        break;
    }

    const shotScaleGain = ctx.createGain();
    shotScaleGain.gain.setValueAtTime(vol, now);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, stereoPan)), now);
    shotScaleGain.connect(panner);
    panner.connect(this.sfxGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(earFatigueFilter);
    earFatigueFilter.connect(noiseGain);
    noiseGain.connect(shotScaleGain);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(shotScaleGain);

    subOsc.connect(subGain);
    subGain.connect(shotScaleGain);

    noiseSource.start(now);
    bodyOsc.start(now);
    subOsc.start(now);

    noiseSource.stop(now + 0.4);
    bodyOsc.stop(now + 0.4);
    subOsc.stop(now + 0.4);
  }

  /**
   * Reload mechanical clicks (warm, non-piercing tactile foley)
   */
  public playReload(stage: 'magOut' | 'magIn' | 'bolt') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (stage === 'magOut') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.06);
    } else if (stage === 'magIn') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.07);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.08);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.08);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);

    this.playTextureTransient(
      now + (stage === 'magOut' ? 0 : 0.015),
      stage === 'bolt' ? 0.035 : 0.05,
      stage === 'magIn' ? 420 : 360,
      stage === 'magIn' ? 0.025 : 0.02
    );
  }

  public playWeaponSwitch() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.055;
    const size = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < size; i++) {
      const progress = i / size;
      const envelope = Math.pow(1 - progress, 3);
      samples[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration);
  }

  private playTextureTransient(now: number, duration: number, frequency: number, volume: number) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      const envelope = 1 - i / size;
      samples[i] = (Math.random() * 2 - 1) * envelope * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, now);
    filter.Q.setValueAtTime(0.9, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    source.stop(now + duration);
  }

  /**
   * Procedural weapon inspection audio sequence
   * Generates tactile weapon slide check, metal chamber clicks, and bolt release foley
   */
  public playWeaponInspect(category?: WeaponCategory, isMelee: boolean = false) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (isMelee || category === 'Melee') {
      // Smooth blade spin whoosh and tactile handle catch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.3);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.34);

      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(300, now + 0.25);
      clickOsc.frequency.exponentialRampToValueAtTime(210, now + 0.32);
      clickGain.gain.setValueAtTime(0.07, now + 0.25);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      clickOsc.connect(clickGain);
      clickGain.connect(this.sfxGain);
      clickOsc.start(now + 0.25);
      clickOsc.stop(now + 0.34);
    } else {
      // Primary Firearm Inspection Foley:
      // 1. Cloth/receiver lift & tilt (0.0s)
      const liftOsc = ctx.createOscillator();
      const liftGain = ctx.createGain();
      liftOsc.type = 'sine';
      liftOsc.frequency.setValueAtTime(220, now);
      liftOsc.frequency.exponentialRampToValueAtTime(380, now + 0.16);
      liftGain.gain.setValueAtTime(0.08, now);
      liftGain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
      liftOsc.connect(liftGain);
      liftGain.connect(this.sfxGain);
      liftOsc.start(now);
      liftOsc.stop(now + 0.2);

      // 2. Charging handle / chamber check slide (0.28s)
      const boltOsc = ctx.createOscillator();
      const boltGain = ctx.createGain();
      boltOsc.type = 'triangle';
      boltOsc.frequency.setValueAtTime(360, now + 0.28);
      boltOsc.frequency.exponentialRampToValueAtTime(420, now + 0.37);
      boltGain.gain.setValueAtTime(0.08, now + 0.28);
      boltGain.gain.exponentialRampToValueAtTime(0.002, now + 0.39);
      boltOsc.connect(boltGain);
      boltGain.connect(this.sfxGain);
      boltOsc.start(now + 0.28);
      boltOsc.stop(now + 0.41);

      // 3. Ejection port / receiver turn click (0.72s)
      const turnOsc = ctx.createOscillator();
      const turnGain = ctx.createGain();
      turnOsc.type = 'triangle';
      turnOsc.frequency.setValueAtTime(420, now + 0.72);
      turnOsc.frequency.exponentialRampToValueAtTime(280, now + 0.8);
      turnGain.gain.setValueAtTime(0.065, now + 0.72);
      turnGain.gain.exponentialRampToValueAtTime(0.002, now + 0.82);
      turnOsc.connect(turnGain);
      turnGain.connect(this.sfxGain);
      turnOsc.start(now + 0.72);
      turnOsc.stop(now + 0.84);

      // 4. Bolt release & combat ready lock snap (1.35s)
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(480, now + 1.35);
      snapOsc.frequency.exponentialRampToValueAtTime(240, now + 1.46);
      snapGain.gain.setValueAtTime(0.08, now + 1.35);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 1.48);
      snapOsc.connect(snapGain);
      snapGain.connect(this.sfxGain);
      snapOsc.start(now + 1.35);
      snapOsc.stop(now + 1.5);
    }
  }

  /**
   * Distinctive tactile hit marker tick (soft, rounded transient)
   */
  public playHitmarker() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.playTextureTransient(now, 0.045, 420, 0.035);
  }

  /**
   * Crisp, satisfying metallic headshot "dink" (smooth hollow chime with warm bell decay)
   */
  public playHeadshotDink() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Warm, low-register confirmation chime.
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(360, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.16);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(270, now);
    osc2.frequency.exponentialRampToValueAtTime(230, now + 0.14);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.18);
    osc2.stop(now + 0.18);
  }

  /**
   * Tactical Footsteps (procedural contact tap)
   */
  public playFootstep(isSprinting: boolean = false) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const pitch = 0.92 + Math.random() * 0.16;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((isSprinting ? 112 : 82) * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);

    gain.gain.setValueAtTime(isSprinting ? 0.1 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
    this.playTextureTransient(now, isSprinting ? 0.065 : 0.045, isSprinting ? 380 : 320, isSprinting ? 0.04 : 0.025);
  }

  /**
   * Jump sound
   */
  public playJump() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Nexus Core / Spike Beep (escalates smoothly as fuse shortens)
   */
  public playSpikeBeep(urgencyRate: number = 1.0) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const volume = Math.min(0.055, 0.03 + Math.max(0, urgencyRate - 1) * 0.012);
    this.playTextureTransient(now, 0.075, 240, volume);
  }

  /**
   * Plant Core start / complete
   */
  public playPlantEvent(stage: 'start' | 'success' | 'defuse_start' | 'defuse_success') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (stage === 'start' || stage === 'defuse_start') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.2);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } else {
      // Warm harmonic chord chime
      const sfxGain = this.sfxGain;
      [330, 392, 494].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.055, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.07 + 0.16);
        osc.connect(gain);
        gain.connect(sfxGain);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.18);
      });
    }
  }

  /**
   * Detonation Explosion (warm cinematic sub-bass boom without harsh ear-splitting white noise)
   */
  public playDetonation() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sub-bass rumble
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 1.1);
    oscGain.gain.setValueAtTime(0.28, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1.2);

    // Smoothed brown-noise rumble
    const bufferSize = Math.floor(ctx.sampleRate * 0.9);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      last = last * 0.72 + (Math.random() * 2 - 1) * 0.28;
      data[i] = last;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 0.9);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.95);
  }

  /**
   * Ability trigger audio
   */
  public playAbility(type: 'dash' | 'sonar' | 'freeze' | 'shield' | 'heal' | 'emp' | 'ultimate') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (type === 'dash') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.18);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'sonar') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'ultimate') {
      // Big charging sci-fi horn
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.65);
    } else {
      // Generic tactical tech chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(392, now + 0.08);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  /**
   * UI Click / button audio
   */
  public playUIClick() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.playTextureTransient(now, 0.025, 500, 0.02);
  }

  /**
   * Announcer voice / horn chime
   */
  public playAnnouncer(message: 'round_start' | 'victory' | 'defeat' | 'ace') {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const notes = message === 'victory' || message === 'ace'
      ? [294, 370, 440, 523]
      : message === 'defeat'
      ? [330, 294, 262, 220]
      : [262, 330, 392];

    const sfxGain = this.sfxGain;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.08, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.35);
    });
  }

  /**
   * Heartbeat for low health (<30hp)
   */
  public setHeartbeatActive(active: boolean) {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;

    if (!active) {
      if (this.heartbeatOsc) {
        try {
          this.heartbeatOsc.stop();
          this.heartbeatOsc.disconnect();
        } catch {}
        this.heartbeatOsc = null;
      }
      return;
    }

    if (this.heartbeatOsc) return; // already running

    const now = ctx.currentTime;
    this.heartbeatOsc = ctx.createOscillator();
    this.heartbeatGain = ctx.createGain();

    this.heartbeatOsc.type = 'sine';
    this.heartbeatOsc.frequency.setValueAtTime(55, now);

    // Pulse gain 1.2 Hz
    this.heartbeatGain.gain.setValueAtTime(0.01, now);
    
    this.heartbeatOsc.connect(this.heartbeatGain);
    this.heartbeatGain.connect(this.sfxGain);
    this.heartbeatOsc.start();
  }

  /**
   * Dramatic Player Elimination Audio Cue
   * Cinematic muffled sub-bass impact + low suit power-down sweep (soft, warm low-end without harsh high-pitched headphone beeps)
   */
  public playPlayerDeath() {
    if (!this.ensureContext() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Deep cinematic low sub-drop (warm sine wave, non-fatiguing)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(80, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.7);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.76);

    // 2. Muffled tactical air-decompression woosh (soft pink/brown noise, lowpass filtered at 380Hz)
    const bufferSize = Math.floor(ctx.sampleRate * 0.6);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let val = 0;
    for (let i = 0; i < bufferSize; i++) {
      val = val * 0.7 + (Math.random() * 2 - 1) * 0.3;
      data[i] = val;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(380, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(70, now + 0.55);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSource.start(now);
    noiseSource.stop(now + 0.6);

    // 3. Gentle low-frequency suit power-down hum (130Hz -> 40Hz)
    const humOsc = ctx.createOscillator();
    const humGain = ctx.createGain();
    humOsc.type = 'triangle';
    humOsc.frequency.setValueAtTime(130, now + 0.05);
    humOsc.frequency.exponentialRampToValueAtTime(35, now + 0.8);
    humGain.gain.setValueAtTime(0.09, now + 0.05);
    humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    humOsc.connect(humGain);
    humGain.connect(this.sfxGain);
    humOsc.start(now + 0.05);
    humOsc.stop(now + 0.85);
  }

  /**
   * Randomized Agent-Specific Tactical Voice Line Audio Hook
   * Combines military walkie-talkie PTT squelch + bespoke 12-agent formant vocal synthesis + multi-accent Web Speech TTS
   */
  public playAgentVoiceLine(agent: Agent, event: VoiceLineEvent, lineText: string, force: boolean = false): boolean {
    if (!this.ensureContext() || !this.ctx || !this.voiceGain) return false;

    const priorityMap: Record<VoiceLineEvent, number> = {
      ultimate: 5,
      plant: 4,
      defuse: 4,
      headshot_kill: 3,
      kill: 3,
      ability: 2,
      round_start: 2,
      damage: 1,
      reload: 1
    };

    const priority = priorityMap[event] ?? 1;
    const nowMs = Date.now();
    const minIntervalMs = priority >= 4 ? 900 : priority === 3 ? 1600 : 2800;

    // Prevent overlapping spam unless a higher-priority event interrupts
    if (!force && nowMs - this.lastVoiceTime < minIntervalMs && priority <= this.lastVoicePriority) {
      return false;
    }

    this.lastVoiceTime = nowMs;
    this.lastVoicePriority = priority;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const profile = AGENT_VOICE_PROFILES[agent.id] || AGENT_VOICE_PROFILES['agent_vortex'];
    const targetGain = this.voiceGain;

    // 1. Subtle, clean military radio comms tone (soft click, zero abrasive hiss)
    this.playRadioSquelch(now, 0.025, 760 + (profile.voiceIndexOffset % 4) * 35);

    // 2. High-fidelity Web Speech API Spoken Voice Delivery (natural human voice prioritized)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && !this.isMuted && this.voiceVolume > 0.02) {
      try {
        const synth = window.speechSynthesis;
        if (priority >= 3 || force) {
          synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(lineText);
        utterance.lang = profile.lang || 'en-US';
        // Confine pitch and rate to natural, human speech ranges (no chipmunk squeaks or slow robot drones)
        utterance.pitch = Math.max(0.82, Math.min(1.08, profile.pitch));
        utterance.rate = Math.max(0.88, Math.min(1.15, profile.rate));
        utterance.volume = Math.min(0.5, Math.max(0, this.voiceVolume * 0.6));

        const voices = synth.getVoices();
        if (voices.length > 0) {
          const isFemale = agent.gender === 'Female';
          const femaleHints = ['female', 'samantha', 'victoria', 'karen', 'zira', 'hazel', 'aria', 'jenny', 'natasha', 'susan', 'linda', 'serena', 'kyoko', 'amélie', 'amelie', 'anna'];
          const maleHints = ['male', 'daniel', 'alex', 'david', 'mark', 'guy', 'james', 'richard', 'george', 'oliver', 'rishi', 'fred', 'aaron', 'arthur', 'jorge'];

          // Prioritize high-quality natural voices (Google, Natural, Siri, Microsoft Online)
          const naturalVoices = voices.filter(v => /natural|premium|online|google|enhanced|neural/i.test(v.name));
          const targetPool = naturalVoices.length > 0 ? naturalVoices : voices;

          const matchedByGender = targetPool.filter(v => {
            const lower = v.name.toLowerCase();
            return isFemale ? femaleHints.some(h => lower.includes(h)) : maleHints.some(h => lower.includes(h));
          });

          const candidates = matchedByGender.length > 0 ? matchedByGender : targetPool;
          utterance.voice = candidates[profile.voiceIndexOffset % candidates.length];
        }

        synth.speak(utterance);
      } catch {
        // Fallback gracefully in restricted iframe contexts
      }
    }

    // 3. Soft tactical mic release squelch (delayed to conversational cadence)
    const lineDurationEstimate = Math.max(0.8, lineText.split(' ').length * 0.28);
    this.playRadioSquelch(now + lineDurationEstimate, 0.02, 720);

    return true;
  }

  private playRadioSquelch(startTime: number, duration: number, filterFreq: number) {
    if (!this.ctx || !this.voiceGain) return;
    const ctx = this.ctx;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.65;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'lowpass';
    bandpass.frequency.setValueAtTime(Math.min(500, filterFreq), startTime);
    bandpass.Q.setValueAtTime(0.7, startTime);

    const squelchGain = ctx.createGain();
    squelchGain.gain.setValueAtTime(0.025, startTime);
    squelchGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(bandpass);
    bandpass.connect(squelchGain);
    squelchGain.connect(this.voiceGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}

export const soundEngine = new SoundEngine();

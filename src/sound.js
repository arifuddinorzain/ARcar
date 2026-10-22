/**
 * AERO-RC // Web Audio API Procedural Sound Synthesizer
 * Fully self-contained sound engine for engine rumble, horn, drift screech, and nitro.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Engine sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.engineNoiseNode = null;
    this.engineNoiseGain = null;

    // Drift sound nodes
    this.driftNoiseNode = null;
    this.driftFilter = null;
    this.driftGain = null;

    // Horn nodes
    this.hornOsc1 = null;
    this.hornOsc2 = null;
    this.hornGain = null;
    this.isHornActive = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.setupEngineSound();
      this.setupDriftSound();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupEngineSound() {
    if (!this.ctx) return;

    // Main engine tone (sawtooth for aggressive engine combustion)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Sub harmonic engine tone (triangle for low-end body rumble)
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(22.5, this.ctx.currentTime);

    // Lowpass filter to muffle harsh harmonics like an exhaust muffler
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // Engine master gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  setupDriftSound() {
    if (!this.ctx) return;

    // Generate white noise buffer for tire squeal / drift
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.driftNoiseNode = this.ctx.createBufferSource();
    this.driftNoiseNode.buffer = noiseBuffer;
    this.driftNoiseNode.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(4, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.driftNoiseNode.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.ctx.destination);

    this.driftNoiseNode.start();
  }

  /**
   * Updates dynamic engine pitch and rumble based on current RPM and speed
   * @param {number} rpm - e.g. 1000 (idle) to 8000 (redline)
   * @param {number} throttle - 0.0 to 1.0
   * @param {boolean} isDrifting - whether tires are sliding
   */
  update(rpm, throttle, isDrifting = false) {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const normalizedRPM = Math.max(0, Math.min(1, (rpm - 1000) / 7000));

    // Pitch mapping: 45Hz idle -> 220Hz redline
    const targetFreq1 = 45 + normalizedRPM * 180 + throttle * 25;
    const targetFreq2 = targetFreq1 * 0.5;

    // Filter cutoff sweeps up on throttle opening
    const targetFilter = 160 + normalizedRPM * 600 + throttle * 300;

    if (this.engineOsc1 && this.engineOsc2) {
      this.engineOsc1.frequency.setTargetAtTime(targetFreq1, now, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(targetFreq2, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);

      const targetGain = 0.06 + normalizedRPM * 0.08 + throttle * 0.06;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    }

    // Drift squeal update
    if (this.driftGain) {
      const targetDriftGain = isDrifting ? 0.14 : 0;
      this.driftGain.gain.setTargetAtTime(targetDriftGain, now, 0.05);
    }
  }

  /**
   * Synthesizes car horn honk
   * @param {boolean} active
   */
  setHorn(active) {
    this.isHornActive = active;
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    if (active) {
      if (!this.hornOsc1) {
        this.hornOsc1 = this.ctx.createOscillator();
        this.hornOsc2 = this.ctx.createOscillator();
        this.hornGain = this.ctx.createGain();

        // Dual-tone European car horn: F4 (349Hz) + A4 (440Hz)
        this.hornOsc1.type = 'sawtooth';
        this.hornOsc1.frequency.setValueAtTime(349, now);

        this.hornOsc2.type = 'triangle';
        this.hornOsc2.frequency.setValueAtTime(440, now);

        const hornFilter = this.ctx.createBiquadFilter();
        hornFilter.type = 'lowpass';
        hornFilter.frequency.setValueAtTime(1400, now);

        this.hornGain.gain.setValueAtTime(0.2, now);

        this.hornOsc1.connect(hornFilter);
        this.hornOsc2.connect(hornFilter);
        hornFilter.connect(this.hornGain);
        this.hornGain.connect(this.ctx.destination);

        this.hornOsc1.start();
        this.hornOsc2.start();
      } else {
        this.hornGain.gain.setTargetAtTime(0.2, now, 0.02);
      }
    } else {
      if (this.hornGain) {
        this.hornGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }
  }

  /**
   * Synthesizes Nitro Boost burst whoosh
   */
  playNitroSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(300, now + 1.2);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch (e) {
      // ignore
    }
  }

  /**
   * UI Click blip
   */
  playClick() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      // ignore
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.08, this.ctx.currentTime);
    }
    if (this.driftGain && this.isMuted) {
      this.driftGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const sound = new SoundEngine();

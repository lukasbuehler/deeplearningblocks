import { Injectable, signal } from '@angular/core';

const MUTE_KEY = 'dlb-sound-muted';
export type Sound = 'click' | 'drop' | 'trash';

function storedMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Tiny synthesized sound effects, so nothing has to download.
 * A context is only created after the first sound request, which always follows a user gesture.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal(storedMute());
  private context?: AudioContext;

  toggleMute(): void {
    this.muted.update((m) => !m);
    try {
      localStorage.setItem(MUTE_KEY, this.muted() ? '1' : '0');
    } catch {
      // Private windows may block storage; the switch still works for this visit.
    }
    if (!this.muted()) this.play('click');
  }

  play(sound: Sound): void {
    if (this.muted() || typeof AudioContext === 'undefined') return;
    try {
      this.context ??= new AudioContext();
      const ctx = this.context;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime + 0.01;
      if (sound === 'click') {
        // Two hard little plastic taps: the brick lands, then seats.
        this.tap(ctx, now, 2400, 0.035, 0.32);
        this.tone(ctx, now, 1300, 700, 0.05, 0.22, 'triangle');
        this.tap(ctx, now + 0.055, 1500, 0.03, 0.26);
        this.tone(ctx, now + 0.055, 900, 450, 0.06, 0.2, 'triangle');
      } else if (sound === 'drop') {
        this.tone(ctx, now, 520, 880, 0.09, 0.18, 'sine');
        this.tap(ctx, now + 0.06, 1800, 0.025, 0.12);
      } else {
        // A falling "whomp" into the can, with a rattle at the bottom.
        this.tone(ctx, now, 420, 70, 0.22, 0.3, 'sine');
        this.tap(ctx, now + 0.16, 700, 0.09, 0.18);
      }
    } catch {
      // Audio is a nicety; never let it break a build action.
    }
  }

  private tone(
    ctx: AudioContext,
    at: number,
    from: number,
    to: number,
    length: number,
    volume: number,
    type: OscillatorType,
  ): void {
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + length);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** A short band-passed noise burst: the "tick" of plastic on plastic. */
  private tap(ctx: AudioContext, at: number, pitch: number, length: number, volume: number): void {
    const samples = Math.ceil(ctx.sampleRate * length),
      buffer = ctx.createBuffer(1, samples, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3;
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = pitch;
    filter.Q.value = 2.5;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(at);
  }
}

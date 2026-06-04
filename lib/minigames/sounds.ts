"use client";

/**
 * Tiny sound effects for minigames, synthesized with the Web Audio API so we
 * don't ship any audio files. Respects a persisted mute toggle. All calls are
 * safe no-ops on the server or if Web Audio is unavailable.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

const MUTE_KEY = "minigames-muted";

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

function blip(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.05): void {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ac.destination);

  const now = ac.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
  osc.start(now);
  osc.stop(now + durMs / 1000);
}

export const sounds = {
  move: () => blip(330, 80, "triangle", 0.04),
  win: () => {
    blip(523, 120, "sine", 0.05);
    setTimeout(() => blip(659, 120, "sine", 0.05), 110);
    setTimeout(() => blip(784, 220, "sine", 0.05), 220);
  },
  lose: () => {
    blip(330, 160, "sine", 0.04);
    setTimeout(() => blip(247, 260, "sine", 0.04), 150);
  },
};

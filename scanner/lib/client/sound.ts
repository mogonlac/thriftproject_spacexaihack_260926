// Tiny WebAudio cues so staff can work without looking at the screen.
let ctx: AudioContext | null = null;
export let soundEnabled = true;
export function setSoundEnabled(v: boolean) { soundEnabled = v; }

function ac() {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18) {
  const a = ac();
  if (!a || !soundEnabled) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sounds = {
  /** Unlock audio on first user gesture. */
  unlock: () => { ac(); },
  shutter: () => { tone(1800, 0, 0.05, "square", 0.08); tone(900, 0.05, 0.06, "square", 0.06); },
  success: () => { tone(660, 0, 0.12); tone(880, 0.1, 0.12); tone(1320, 0.2, 0.25); },
  error: () => { tone(220, 0, 0.25, "sawtooth", 0.12); tone(180, 0.25, 0.35, "sawtooth", 0.12); },
  rack: () => { tone(988, 0, 0.1); tone(988, 0.14, 0.1); },
};

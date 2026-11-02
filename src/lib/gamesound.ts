/* 게임 효과음 (2026-11-03) — [사용자: "다 고쳐서 배포" · 리뷰의 '게임에 소리가 전혀 없다']
 * 파일 없이 코드로 합성한다(WebAudio) — 받을 것이 없어 첫 로드에 안 실리고, 저작권 걱정도 없다.
 * ⚠ iOS 는 사용자가 누른 순간에만 소리를 열 수 있다 — 첫 누름에 깨운다(wake). 무음 스위치를 켜 두면 안 들린다(기기 설정이라 앱이 못 바꾼다). */
const KEY = "ourdays:sound";

export type Sfx =
  | "cast" | "splash" | "nibble" | "bite" | "hook" | "reel" | "surge" | "snap" | "escape"
  | "land" | "reveal" | "stored" | "slipped" | "sold" | "junk"
  | "feverStart" | "feverOk" | "feverWrong" | "feverWin"
  | "slide" | "merge" | "gameOver" | "newBest" | "feed" | "buy";

let on: boolean | null = null;
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  if (on !== null) return on;
  try {
    on = localStorage.getItem(KEY) !== "off";
  } catch {
    on = true;
  }
  return on;
}
export function setSoundOn(next: boolean) {
  on = next;
  try {
    localStorage.setItem(KEY, next ? "on" : "off");
  } catch {
    /* 저장 못 해도 지금 세션엔 듣는다 */
  }
  if (next) sfx("feed");
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** 소리 낼 수 있게 깨운다 — 누르는 처리 안에서 부른다 */
export function wakeSound() {
  if (soundOn()) audio();
}

function tone(a: AudioContext, freq: number, ms: number, opts: { to?: number; type?: OscillatorType; vol?: number; at?: number } = {}) {
  const start = a.currentTime + (opts.at ?? 0) / 1000, end = start + ms / 1000, vol = opts.vol ?? 0.12;
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, end);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.012, ms / 4000));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext, ms: number, opts: { from?: number; to?: number; vol?: number; at?: number } = {}) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    // 결정적 잡음 — 매번 같은 질감이면 된다
    let v = 22222;
    for (let i = 0; i < d.length; i++) {
      v = (v * 16807) % 2147483647;
      d[i] = v / 1073741823.5 - 1;
    }
  }
  const start = a.currentTime + (opts.at ?? 0) / 1000, end = start + ms / 1000;
  const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
  src.buffer = noiseBuf;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(opts.from ?? 1200, start);
  filter.frequency.exponentialRampToValueAtTime(opts.to ?? 400, end);
  gain.gain.setValueAtTime(opts.vol ?? 0.14, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(start);
  src.stop(end + 0.02);
}

const notes = (a: AudioContext, list: readonly number[], step: number, type: OscillatorType = "triangle", vol = 0.11) =>
  list.forEach((f, i) => tone(a, f, step * 1.8, { at: i * step, type, vol }));

/** n — reveal 은 등급(0~7), merge 는 단계(1~17) */
export function sfx(name: Sfx, n = 0) {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  switch (name) {
    case "cast": noise(a, 260, { from: 600, to: 2600, vol: 0.08 }); break;
    case "splash": noise(a, 300, { from: 2400, to: 500, vol: 0.13 }); break;
    case "nibble": tone(a, 520, 60, { to: 400, vol: 0.05 }); break;
    case "bite": tone(a, 880, 90, { type: "square", vol: 0.07 }); tone(a, 1175, 110, { type: "square", vol: 0.07, at: 90 }); break;
    case "hook": noise(a, 110, { from: 3000, to: 900, vol: 0.14 }); tone(a, 330, 150, { to: 660, type: "triangle", vol: 0.14 }); break;
    case "reel": tone(a, 1500, 18, { type: "square", vol: 0.018 }); break;
    case "surge": tone(a, 220, 240, { to: 110, type: "sawtooth", vol: 0.07 }); break;
    case "snap": noise(a, 90, { from: 4000, to: 1800, vol: 0.2 }); tone(a, 400, 180, { to: 90, type: "sawtooth", vol: 0.09 }); break;
    case "escape": tone(a, 440, 300, { to: 165, vol: 0.1 }); noise(a, 200, { from: 1500, to: 400, vol: 0.07, at: 60 }); break;
    case "land": noise(a, 240, { from: 1800, to: 600, vol: 0.12 }); tone(a, 196, 200, { to: 294, type: "triangle", vol: 0.1 }); break;
    case "reveal": {
      const g = Math.max(0, Math.min(7, n));
      notes(a, [523, 659, 784, 1047, 1319, 1568, 2093, 2637].slice(0, 2 + g), 75, "triangle", 0.1);
      if (g >= 3) noise(a, 500 + g * 100, { from: 5000, to: 2000, vol: 0.035 });
      break;
    }
    case "stored": notes(a, [659, 880, 1109, 1319], 80); break;
    case "slipped": tone(a, 500, 340, { to: 150, vol: 0.1 }); noise(a, 140, { from: 2000, to: 800, vol: 0.09, at: 300 }); break;
    case "sold": notes(a, [1319, 1760, 2093], 55, "square", 0.04); break;
    case "junk": tone(a, 294, 170, { to: 277, type: "sawtooth", vol: 0.06 }); tone(a, 262, 170, { to: 247, type: "sawtooth", vol: 0.06, at: 170 }); tone(a, 196, 420, { to: 165, type: "sawtooth", vol: 0.06, at: 340 }); break;
    case "feverStart": notes(a, [392, 523, 659, 784, 1047], 60, "square", 0.05); break;
    case "feverOk": tone(a, 880 + n * 70, 90, { type: "triangle", vol: 0.1 }); break;
    case "feverWrong": tone(a, 150, 340, { to: 75, type: "sawtooth", vol: 0.11 }); break;
    case "feverWin": notes(a, [784, 988, 1175, 1568, 1976], 70); break;
    case "slide": noise(a, 70, { from: 900, to: 500, vol: 0.035 }); break;
    case "merge": {
      const f = 330 * 2 ** (Math.min(17, Math.max(1, n)) / 8);
      tone(a, f, 130, { to: f * 1.5, type: "triangle", vol: 0.1 });
      if (n >= 9) notes(a, [f * 1.5, f * 2, f * 3], 60, "triangle", 0.06);
      break;
    }
    case "gameOver": notes(a, [523, 440, 349, 262], 130, "triangle", 0.09); break;
    case "newBest": notes(a, [659, 784, 988, 1319, 1568], 85); break;
    case "feed": tone(a, 700, 60, { to: 950, vol: 0.06 }); break;
    case "buy": notes(a, [988, 1319], 70, "square", 0.04); break;
  }
}

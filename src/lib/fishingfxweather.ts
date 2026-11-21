/* 낚시 연출의 날씨 — 비 · 눈 입자와 수면 파문(2026-11-21 리뷰 ⑩ — fishingfx.ts 에서 옮겼다).
 * 판정 없음 · 캔버스만. 시간 · 크기 · 난수 · 움직임 줄이기는 호스트(FishFx)가 env 로 넘긴다 — 시계를 직접 읽지 않는다(fishingfx.test).
 * ⚠ shadowBlur · ctx.filter 금지(fishingfx.ts 머리 주석과 같다). */
export type FxWeather = "rain" | "snow" | null;
/** 한 화면의 입자 수 — 폰 프레임을 지키는 상한(테스트가 잠근다) */
export const FX_WEATHER_MAX = { rain: 190, snow: 150, splash: 54 } as const;
/** 호스트가 넘기는 값 — 화면 크기(W · H) · 배율(u) · 연출 시각(t, 초) · 수평선(px 아님, H 에 곱할 비율) · 낚시터 · 움직임 줄이기 · 난수 */
export type WxEnv = { W: number; H: number; u: number; t: number; horizon: number; spot: string; reduced: boolean; rnd: () => number };

export class FxWeatherLayer {
  wx: FxWeather = null;
  fall: { x: number; y: number; z: number; end: number; p: number }[] = [];
  ripples: { x: number; y: number; life: number; k: number }[] = [];

  set(wx: FxWeather, e: WxEnv, force = false) {
    if (wx === this.wx && !force) return;
    this.wx = wx;
    this.seed(e);
  }

  private seed(e: WxEnv) {
    this.ripples = [];
    if (!this.wx) {
      this.fall = [];
      return;
    }
    const n = FX_WEATHER_MAX[this.wx];
    this.fall = Array.from({ length: n }, () => this.newFall(e, e.rnd() * e.H * 1.2 - e.H * 0.2));
  }

  /** 앞쪽은 적게, 먼 쪽은 많이 — 코앞 입자가 많으면 화면이 줄무늬로 덮인다. into 가 있으면 그 입자를 다시 쓴다(초당 수백 개를 새로 만들지 않게) */
  private newFall(e: WxEnv, y: number, into?: { x: number; y: number; z: number; end: number; p: number }) {
    const z = e.rnd() ** 1.45;
    const hz = e.horizon * e.H;
    const f = into ?? { x: 0, y: 0, z: 0, end: 0, p: 0 };
    f.x = e.rnd() * e.W * 1.3 - e.W * 0.15;
    f.y = y;
    f.z = z;
    f.end = hz + (e.H - hz) * Math.min(1, z * 1.1 + e.rnd() * 0.08);
    f.p = e.rnd() * 6.28;
    return f;
  }

  step(real: number, e: WxEnv) {
    if (!this.wx || e.reduced) return;
    const gust = Math.sin(e.t * 0.31) * 0.5 + Math.sin(e.t * 0.83 + 1.3) * 0.3;
    const icy = e.spot === "hwacheon";
    for (let i = 0; i < this.fall.length; i++) {
      const f = this.fall[i];
      if (this.wx === "rain") {
        const vy = (720 + 760 * f.z) * e.u;
        f.y += vy * real;
        f.x += vy * (-0.14 + gust * 0.05) * real;
        if (f.y >= f.end) {
          if (!icy && this.ripples.length < FX_WEATHER_MAX.splash && (f.z > 0.12 || e.rnd() < 0.3)) this.ripples.push({ x: f.x, y: f.end, life: 1, k: 0.3 + f.z * 0.9 });
          this.newFall(e, -e.rnd() * e.H * 0.25, f);
        }
      } else {
        const vy = (20 + 58 * f.z) * e.u;
        f.y += vy * real;
        f.x += (Math.sin(e.t * (0.5 + f.z * 0.5) + f.p) * (7 + 20 * f.z) + gust * (8 + 16 * f.z)) * e.u * real;
        if (f.y >= f.end) this.newFall(e, -e.rnd() * e.H * 0.12, f);
      }
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].life -= real * 2.4;
      if (this.ripples[i].life <= 0) this.ripples.splice(i, 1);
    }
  }

  /** 낚시찌 · 낚싯대 뒤의 먼 입자와 수면 파문 */
  drawBack(c: CanvasRenderingContext2D, e: WxEnv) {
    if (!this.wx || e.reduced) return; // 움직임 줄이기면 입자는 멈춘 채 긁힌 자국으로 남는다 — 하늘 막(.fish-sky)만 남긴다
    c.save();
    c.lineCap = "round";
    if (this.wx === "rain") {
      // 파문 — 수면에 눕도록 납작한 타원. 첫 순간엔 튀어 오른 물방울이 위에 있다
      c.strokeStyle = "#e4f0ff";
      for (const p of this.ripples) {
        const g = 1 - p.life, rx = (2 + 16 * g) * p.k * e.u;
        c.globalAlpha = p.life * 0.62;
        c.lineWidth = Math.max(0.5, 1.1 * p.k * p.life);
        c.beginPath();
        c.ellipse(p.x, p.y, rx, rx * 0.3, 0, 0, Math.PI * 2);
        c.stroke();
        if (g < 0.35 && p.k > 0.6) {
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + 1.2 * e.u, p.y - (2 + 16 * g) * p.k * e.u);
          c.stroke();
        }
      }
      this.strokeRain(c, e, 0, 0.42, 0.3, 0.7);
    } else {
      this.fillSnow(c, e, 0, 0.5, 0.75);
    }
    c.restore();
  }

  /** 낚싯대 앞을 지나가는 가까운 입자 */
  drawFront(c: CanvasRenderingContext2D, e: WxEnv) {
    if (!this.wx || e.reduced) return;
    c.save();
    c.lineCap = "round";
    if (this.wx === "rain") {
      this.strokeRain(c, e, 0.42, 0.78, 0.36, 1);
      this.strokeRain(c, e, 0.78, 1.01, 0.3, 1.8);
    } else {
      this.fillSnow(c, e, 0.5, 1.01, 0.92);
    }
    c.restore();
  }

  /** 한 깊이 층을 경로 하나로 — 입자마다 stroke 를 부르면 폰에서 프레임이 떨어진다 */
  private strokeRain(c: CanvasRenderingContext2D, e: WxEnv, lo: number, hi: number, alpha: number, width: number) {
    const gust = Math.sin(e.t * 0.31) * 0.5 + Math.sin(e.t * 0.83 + 1.3) * 0.3, slant = -0.14 + gust * 0.05;
    c.strokeStyle = "#dfeaff";
    c.globalAlpha = alpha;
    c.lineWidth = width * Math.max(0.8, e.u);
    for (const part of [1, 0.45]) {
      c.globalAlpha = part === 1 ? alpha * 0.55 : alpha;
      c.beginPath();
      for (const f of this.fall) {
        if (f.z < lo || f.z >= hi) continue;
        const len = (14 + 62 * f.z) * e.u * part;
        c.moveTo(f.x, f.y);
        c.lineTo(f.x - slant * len, f.y - len);
      }
      c.stroke();
    }
  }

  /** 눈송이 = 옅은 원 세 겹이라 shadowBlur 없이 가장자리가 부드럽다. 코앞(z > 0.82)은 초점이 나간 큰 송이로 심만 뺀다 */
  private fillSnow(c: CanvasRenderingContext2D, e: WxEnv, lo: number, hi: number, alpha: number) {
    c.fillStyle = "#ffffff";
    for (const [scale, a, far] of [[2.6, 0.07, 1], [1.7, 0.16, 1], [1, 0.8, 0.82]] as const) {
      c.globalAlpha = alpha * a;
      c.beginPath();
      for (const f of this.fall) {
        if (f.z < lo || f.z >= hi || f.z >= far) continue;
        // 송이마다 크기가 조금씩 다르다(같은 크기면 점박이 무늬로 읽힌다)
        const r = (0.55 + 2.1 * f.z + (f.z > 0.82 ? 2.2 : 0)) * (0.75 + 0.25 * Math.sin(f.p * 7)) * e.u * scale;
        // 땅에 닿을 무렵 스러진다 — 수면에서 뚝 끊기지 않게
        const q = r * Math.min(1, Math.max(0.25, (f.end - f.y) / (24 * e.u)));
        c.moveTo(f.x + q, f.y);
        c.arc(f.x, f.y, q, 0, Math.PI * 2);
      }
      c.fill();
    }
  }
}

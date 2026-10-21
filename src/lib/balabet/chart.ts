import { ROUND_MS, type Direction, directionOf } from "./engine.ts";

export type Point = { t: number; y: number };
export type Rng = () => number;

export function nextY(rand: Rng, y: number): number {
  if (rand() < 0.1) return y;
  const sharp = rand() < 0.33;
  const magnitude = sharp ? 12 + Math.floor(rand() * 30) : 1 + Math.floor(rand() * 8);
  const sign = rand() < 0.52 ? -1 : 1;
  const next = y + sign * magnitude;
  if (next < 0) return 0;
  if (next > 100) return 100;
  return next;
}

type Segment = { t0: number; t1: number; y0: number; y1: number };

function planSegment(rand: Rng, t: number, y: number): Segment | null {
  if (t >= ROUND_MS) return null;
  let duration = 240 + Math.floor(rand() * 280);
  if (t + duration > ROUND_MS) duration = ROUND_MS - t;
  if (duration <= 0) return null;
  return { t0: t, t1: t + duration, y0: y, y1: nextY(rand, y) };
}

/**
 * Gerador monotônico: visible(t) só pode ser chamado com t crescente.
 * O próximo vértice só é fixado quando o instante dele chega, e o
 * resultado usa os pontos visíveis — nunca um segmento além do relógio.
 */
export function createLiveSimulator(rand: Rng, startY?: number) {
  let cursorT = 0;
  let cursorY = startY ?? 20 + Math.floor(rand() * 61);
  const points: Point[] = [{ t: 0, y: cursorY }];
  let planned = planSegment(rand, cursorT, cursorY);

  return {
    visible(elapsed: number): Point[] {
      const e = Math.max(0, Math.min(ROUND_MS, elapsed));
      while (planned && planned.t1 <= e) {
        points.push({ t: planned.t1, y: planned.y1 });
        cursorT = planned.t1;
        cursorY = planned.y1;
        planned = planSegment(rand, cursorT, cursorY);
      }
      const visible = points.filter((point) => point.t <= e).map((point) => ({ ...point }));
      if (planned && e > planned.t0 && e < planned.t1) {
        const progress = (e - planned.t0) / (planned.t1 - planned.t0);
        visible.push({
          t: e,
          y: Math.round(planned.y0 + (planned.y1 - planned.y0) * progress),
        });
      }
      return visible;
    },
  };
}

export function finalDirection(points: Point[]): Direction {
  return directionOf(points);
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

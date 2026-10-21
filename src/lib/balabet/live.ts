import { create } from "zustand";
import type { Direction } from "./engine";

export type ChartPoint = { t: number; y: number };
export type ChartSeries = { playerId: string; points: ChartPoint[] };

type LiveState = {
  clockMs: number;
  chart: ChartSeries[] | null;
  setFrame: (clockMs: number, chart: ChartSeries[]) => void;
  clear: () => void;
};

export const useLive = create<LiveState>((set) => ({
  clockMs: 0,
  chart: null,
  setFrame: (clockMs, chart) => set({ clockMs, chart }),
  clear: () => set({ clockMs: 0, chart: null }),
}));

export type DirectionReading = { playerId: string; direction: Direction };

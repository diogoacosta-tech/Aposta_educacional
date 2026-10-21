import { useEffect } from "react";
import { createLiveSimulator } from "@/lib/balabet/chart";
import { COUNTDOWN_MS, ROUND_MS, directionOf } from "@/lib/balabet/engine";
import { useLive } from "@/lib/balabet/live";
import { useDispute } from "@/lib/balabet/store";

export function RoundDirector() {
  const roundId = useDispute((state) => state.activeRoundId);
  const epoch = useDispute((state) => state.epoch);

  useEffect(() => {
    const snap = useDispute.getState();
    if (snap.phase !== "countdown" || snap.activeRoundId !== roundId || !roundId) return;
    const ids = snap.players.map((player) => player.id);
    const sims = ids.map(() => createLiveSimulator(Math.random));
    const started = performance.now();
    let frame = 0;
    let settled = false;

    const loop = (now: number) => {
      const live = useDispute.getState();
      if (live.epoch !== epoch || live.activeRoundId !== roundId) return;
      const elapsed = now - started;
      if (elapsed < COUNTDOWN_MS) {
        const series = ids.map((playerId, index) => ({
          playerId,
          points: sims[index].visible(0),
        }));
        useLive.getState().setFrame(elapsed, series);
      } else {
        live.markRunning();
        const run = Math.min(elapsed - COUNTDOWN_MS, ROUND_MS);
        const series = ids.map((playerId, index) => ({
          playerId,
          points: sims[index].visible(run),
        }));
        useLive.getState().setFrame(elapsed, series);
        if (elapsed - COUNTDOWN_MS >= ROUND_MS && !settled) {
          settled = true;
          const directions = series.map((item) => ({
            playerId: item.playerId,
            direction: directionOf(item.points),
          }));
          void live.settleRound(directions, series);
          return;
        }
      }
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [roundId, epoch]);

  return null;
}

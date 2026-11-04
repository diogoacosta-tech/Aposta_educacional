import { useEffect, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { getAudioEngine } from "@/lib/balabet/audio-synth";

export function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.35);

  useEffect(() => {
    const engine = getAudioEngine();
    setIsPlaying(engine.isPlaying);
    setIsMuted(engine.isMuted);
    setVolume(engine.volume);

    const unsubscribe = engine.subscribe(() => {
      setIsPlaying(engine.isPlaying);
      setIsMuted(engine.isMuted);
      setVolume(engine.volume);
    });

    return unsubscribe;
  }, []);

  const handlePlay = () => {
    void getAudioEngine().play();
  };

  const handlePause = () => {
    getAudioEngine().pause();
  };

  const handleToggleMute = () => {
    getAudioEngine().toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value) / 100;
    getAudioEngine().setVolume(newVol);
  };

  const displayVolumePercent = isMuted ? 0 : Math.round(volume * 100);

  return (
    <div
      className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/80 px-2 py-1 text-fg backdrop-blur shadow-sm sm:gap-2 sm:px-2.5"
      role="region"
      aria-label="Controle de Trilha Sonora"
    >
      {/* Equalizer Visual Indicator */}
      <div
        className="flex items-end gap-0.5 h-3.5 w-3.5 mr-0.5 justify-center"
        title={isPlaying ? "Música tocando" : "Música parada"}
        aria-hidden="true"
      >
        <span
          className={`w-0.5 rounded-full transition-all duration-300 ${
            isPlaying && !isMuted
              ? "bg-gold animate-[bounce_0.8s_ease-in-out_infinite]"
              : "bg-muted/40 h-1"
          }`}
          style={{ height: isPlaying && !isMuted ? "100%" : "4px" }}
        />
        <span
          className={`w-0.5 rounded-full transition-all duration-300 ${
            isPlaying && !isMuted
              ? "bg-gold animate-[bounce_0.6s_ease-in-out_infinite_0.2s]"
              : "bg-muted/40 h-1.5"
          }`}
          style={{ height: isPlaying && !isMuted ? "75%" : "6px" }}
        />
        <span
          className={`w-0.5 rounded-full transition-all duration-300 ${
            isPlaying && !isMuted
              ? "bg-gold animate-[bounce_0.9s_ease-in-out_infinite_0.4s]"
              : "bg-muted/40 h-1"
          }`}
          style={{ height: isPlaying && !isMuted ? "90%" : "4px" }}
        />
      </div>

      {/* Play Button */}
      <button
        type="button"
        onClick={handlePlay}
        disabled={isPlaying}
        className={`flex size-7 items-center justify-center rounded-lg border transition ${
          isPlaying
            ? "border-transparent text-gold/40 cursor-default"
            : "border-line bg-surface-2 text-gold hover:border-gold/50 hover:bg-gold/10"
        }`}
        title="Reproduzir trilha sonora"
        aria-label="Reproduzir música"
      >
        <Play className="size-3.5 fill-current" />
      </button>

      {/* Pause Button */}
      <button
        type="button"
        onClick={handlePause}
        disabled={!isPlaying}
        className={`flex size-7 items-center justify-center rounded-lg border transition ${
          !isPlaying
            ? "border-transparent text-muted/30 cursor-default"
            : "border-line bg-surface-2 text-fg hover:border-line hover:bg-line/40"
        }`}
        title="Pausar trilha sonora"
        aria-label="Pausar música"
      >
        <Pause className="size-3.5 fill-current" />
      </button>

      {/* Mute / Unmute Button */}
      <button
        type="button"
        onClick={handleToggleMute}
        className="flex size-7 items-center justify-center rounded-lg border border-transparent text-muted transition hover:border-line hover:bg-surface-2 hover:text-fg"
        title={isMuted ? "Ativar som" : "Desativar som (mudo)"}
        aria-label={isMuted ? "Ativar som" : "Desativar som"}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="size-3.5 text-loss" />
        ) : (
          <Volume2 className="size-3.5 text-fg" />
        )}
      </button>

      {/* Volume Slider */}
      <div className="flex items-center gap-1.5">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={displayVolumePercent}
          onChange={handleVolumeChange}
          className="h-1.5 w-14 sm:w-16 cursor-pointer appearance-none rounded-lg bg-surface-2 accent-gold"
          title={`Volume: ${displayVolumePercent}%`}
          aria-label="Controle de volume da música"
        />
        <span className="hidden font-mono text-[10px] text-muted sm:inline-block w-6 text-right">
          {displayVolumePercent}%
        </span>
      </div>
    </div>
  );
}

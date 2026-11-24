import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { PlayerTrack } from "@/types/player";

type PlayerContextValue = {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  volume: number;
  expanded: boolean;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (value: number) => void;
  cycleRate: () => void;
  setVolume: (value: number) => void;
  setExpanded: (value: boolean) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeek = useRef(0);
  const shouldPlay = useRef(false);
  const lastSaved = useRef(0);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated } = useAuth();
  const saveMutation = trpc.progress.save.useMutation();
  const saveRef = useRef(saveMutation);
  saveRef.current = saveMutation;

  const persist = useCallback((track: PlayerTrack | null, position: number, total: number) => {
    if (!isAuthenticated || !track || position < 1) return;
    saveRef.current.mutate({
      episodeId: track.episodeId,
      position: Math.max(0, Math.floor(position)),
      duration: Math.max(0, Math.floor(total || track.duration)),
    });
  }, [isAuthenticated]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      shouldPlay.current = true;
      void audio.play().catch(() => setIsPlaying(false));
    } else {
      shouldPlay.current = false;
      persist(current, audio.currentTime, audio.duration);
      audio.pause();
    }
  }, [current, persist]);

  const playTrack = useCallback((track: PlayerTrack, nextQueue?: PlayerTrack[]) => {
    if (!track.audioUrl) return;
    if (current?.episodeId === track.episodeId) {
      toggle();
      return;
    }
    if (nextQueue) setQueue(nextQueue);
    else setQueue((items) => items.length ? items : [track]);
    pendingSeek.current = track.position ?? 0;
    shouldPlay.current = true;
    lastSaved.current = 0;
    setCurrent(track);
    setCurrentTime(track.position ?? 0);
    setDuration(track.duration || 0);
    setIsPlaying(true);
  }, [current, toggle]);

  const next = useCallback(() => {
    if (!current || queue.length < 2) return;
    const index = queue.findIndex((item) => item.episodeId === current.episodeId);
    const track = queue[(index + 1) % queue.length];
    playTrack({ ...track, position: 0 }, queue);
  }, [current, queue, playTrack]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 4) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (!current || queue.length < 2) return;
    const index = queue.findIndex((item) => item.episodeId === current.episodeId);
    const track = queue[(index - 1 + queue.length) % queue.length];
    playTrack({ ...track, position: 0 }, queue);
  }, [current, queue, playTrack]);

  const seek = useCallback((value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.load();
    if (shouldPlay.current) void audio.play().catch(() => setIsPlaying(false));
  }, [current?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <PlayerContext.Provider value={{
      current, queue, isPlaying, currentTime, duration, rate, volume, expanded,
      playTrack, toggle, next, previous, seek,
      cycleRate: () => setRate((value) => [1, 1.25, 1.5, 2][([1, 1.25, 1.5, 2].indexOf(value) + 1) % 4]),
      setVolume, setExpanded,
    }}>
      {children}
      <audio
        ref={audioRef}
        src={current?.audioUrl}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          const total = Number.isFinite(audio.duration) ? audio.duration : current?.duration ?? 0;
          setDuration(total);
          if (pendingSeek.current > 0 && pendingSeek.current < total - 1) {
            audio.currentTime = pendingSeek.current;
            setCurrentTime(pendingSeek.current);
          }
          pendingSeek.current = 0;
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setCurrentTime(audio.currentTime);
          if (Date.now() - lastSaved.current > 5000) {
            lastSaved.current = Date.now();
            persist(current, audio.currentTime, audio.duration);
          }
        }}
        onEnded={(event) => {
          persist(current, event.currentTarget.duration, event.currentTarget.duration);
          if (queue.length > 1) next();
          else setIsPlaying(false);
        }}
        onError={() => setIsPlaying(false)}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}

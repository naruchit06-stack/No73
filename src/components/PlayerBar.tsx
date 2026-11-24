import { Link } from "react-router";
import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { usePlayer } from "@/providers/PlayerProvider";
import { CoverArt } from "@/components/CoverArt";
import { formatTime } from "@/types/player";

export function PlayerBar() {
  const {
    current, queue, isPlaying, currentTime, duration, rate, volume, expanded,
    toggle, next, previous, seek, cycleRate, setVolume, setExpanded, playTrack,
  } = usePlayer();
  if (!current) return null;
  const total = duration || current.duration || 1;

  return (
    <aside className="player-wrap" aria-label="เครื่องเล่นเสียง">
      <div className={`playlist-panel ${expanded ? "open" : ""}`} aria-hidden={!expanded}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--accent)]">คิวการฟัง</p>
            <h2 className="mt-1 font-display text-xl">{current.novelTitle}</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setExpanded(false)} aria-label="ปิดคิวการฟัง">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {queue.map((track) => (
            <button
              type="button"
              key={track.episodeId}
              onClick={() => playTrack(track, queue)}
              className={`playlist-row ${track.episodeId === current.episodeId ? "active" : ""}`}
            >
              <span className="w-8 text-xs text-[var(--muted)]">{track.episodeNumber.toString().padStart(2, "0")}</span>
              <span className="flex-1 text-left">
                <span className="block text-sm font-medium">{track.episodeTitle}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{formatTime(track.duration)}</span>
              </span>
              {track.episodeId === current.episodeId && (
                <span className="playing-bars" aria-label="กำลังเล่น"><i /><i /><i /></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="player-main">
        <input
          className="player-seek"
          type="range"
          min={0}
          max={total}
          step={0.1}
          value={Math.min(currentTime, total)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="ตำแหน่งการเล่น"
          style={{ "--seek": `${(currentTime / total) * 100}%` } as React.CSSProperties}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3 md:grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <CoverArt src={current.coverUrl} title={current.novelTitle} className="hidden h-12 w-12 shrink-0 sm:block" />
            <div className="min-w-0">
              <Link to={`/story/${current.novelSlug}`} className="block truncate text-sm font-medium hover:text-[var(--accent)]">
                {current.episodeTitle}
              </Link>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{current.novelTitle} · ตอนที่ {current.episodeNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 md:gap-2">
            <button type="button" className="icon-button hidden sm:flex" onClick={previous} aria-label="ตอนก่อนหน้า"><SkipBack size={19} /></button>
            <button type="button" className="play-button" onClick={toggle} aria-label={isPlaying ? "หยุดชั่วคราว" : "เล่นเสียง"}>
              {isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
            </button>
            <button type="button" className="icon-button hidden sm:flex" onClick={next} aria-label="ตอนถัดไป"><SkipForward size={19} /></button>
            <button type="button" className="icon-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label="แสดงคิวการฟัง">
              <ListMusic size={20} />
            </button>
          </div>

          <div className="hidden items-center justify-end gap-3 md:flex">
            <span className="text-xs tabular-nums text-[var(--muted)]">{formatTime(currentTime)} / {formatTime(total)}</span>
            <button type="button" className="speed-button" onClick={cycleRate} aria-label="เปลี่ยนความเร็วการเล่น">{rate}×</button>
            <Volume2 size={17} className="text-[var(--muted)]" aria-hidden="true" />
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="volume-slider" aria-label="ระดับเสียง"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

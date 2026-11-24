export type PlayerTrack = {
  episodeId: number;
  novelSlug: string;
  novelTitle: string;
  episodeNumber: number;
  episodeTitle: string;
  audioUrl: string;
  coverUrl: string | null;
  duration: number;
  position?: number;
};

export function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  const minutes = Math.floor(value / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${seconds}`;
  return `${minutes}:${seconds}`;
}

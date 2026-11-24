import { Link } from "react-router";
import { ArrowUpRight, Headphones } from "lucide-react";
import { CoverArt } from "@/components/CoverArt";

export type NovelCardData = {
  slug: string;
  title: string;
  author: string;
  category: string;
  coverUrl: string | null;
  episodeCount: number;
};

export function NovelCard({ novel }: { novel: NovelCardData }) {
  return (
    <article className="novel-card group">
      <Link to={`/story/${novel.slug}`} className="block rounded-[2px] focus-visible:outline-offset-4">
        <div className="relative overflow-hidden bg-[var(--surface)]">
          <div
            className="novel-card-blur"
            style={novel.coverUrl ? { backgroundImage: `url("${novel.coverUrl}")` } : undefined}
            aria-hidden="true"
          />
          <CoverArt src={novel.coverUrl} title={novel.title} className="relative aspect-[3/4]" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-[#111516f2] to-transparent p-4 pt-16">
            <span className="text-xs font-medium text-[var(--text)]">{novel.category}</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] transition-transform duration-200 group-hover:scale-105">
              <Headphones size={19} aria-hidden="true" />
            </span>
          </div>
        </div>
        <div className="flex items-start justify-between gap-3 pt-4">
          <div>
            <h3 className="font-display text-xl font-semibold leading-snug text-[var(--text)]">{novel.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{novel.author} · {novel.episodeCount} ตอน</p>
          </div>
          <ArrowUpRight className="mt-1 shrink-0 text-[var(--muted)] transition-colors group-hover:text-[var(--accent)]" size={19} aria-hidden="true" />
        </div>
      </Link>
    </article>
  );
}

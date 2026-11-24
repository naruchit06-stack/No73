import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, Headphones, Lock, Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/providers/PlayerProvider";
import { CoverArt } from "@/components/CoverArt";
import { NovelCard } from "@/components/NovelCard";
import { formatTime } from "@/types/player";

export default function Home() {
  const novelsQuery = trpc.novel.list.useQuery();
  const { isAuthenticated } = useAuth();
  const continueQuery = trpc.progress.list.useQuery(undefined, { enabled: isAuthenticated });
  const { playTrack } = usePlayer();
  const openAudio = trpc.novel.getEpisodeAudio.useMutation();
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const location = useLocation();
  const novels = useMemo(() => novelsQuery.data ?? [], [novelsQuery.data]);
  const featured = useMemo(() => novels.filter((novel) => novel.featured).slice(0, 3), [novels]);
  const hero = featured[activeIndex % Math.max(featured.length, 1)] ?? novels[0];
  const categories = [...new Set(novels.map((novel) => novel.category))];

  useEffect(() => {
    featured.forEach((novel) => {
      if (novel.coverUrl) {
        const image = new Image();
        image.src = novel.coverUrl;
      }
    });
  }, [featured]);

  useEffect(() => {
    if (featured.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % featured.length), 4000);
    return () => window.clearInterval(timer);
  }, [featured.length]);

  useEffect(() => {
    if (location.hash === "#continue" && !novelsQuery.isLoading) {
      window.setTimeout(() => document.getElementById("continue")?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [location.hash, novelsQuery.isLoading]);

  if (novelsQuery.isLoading) return <HomeSkeleton />;
  if (novelsQuery.error) return (
    <main className="page-shell flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-3xl">เปิดคลังนิยายไม่สำเร็จ</h1>
      <p className="mt-3 text-[var(--muted)]">กรุณาลองเชื่อมต่ออีกครั้ง</p>
      <button type="button" className="button-primary mt-6" onClick={() => void novelsQuery.refetch()}>
        <RotateCcw size={18} /> ลองใหม่
      </button>
    </main>
  );

  return (
    <main>
      {hero && (
        <section className="hero-section">
          <div className="hero-backdrop" style={hero.coverUrl ? { backgroundImage: `url("${hero.coverUrl}")` } : undefined} aria-hidden="true" />
          <div className="page-shell relative grid items-center gap-10 py-12 md:min-h-[650px] md:grid-cols-[1.08fr_.92fr] md:py-16 lg:gap-20">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-6 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                <span className="h-px w-8 bg-[var(--accent)]" /> นิยายเสียงคัดสรร
              </div>
              <div key={hero.slug} className="hero-copy">
                <p className="mb-3 text-sm text-[var(--muted)]">{hero.category} · {hero.author}</p>
                <h1 className="font-display text-[clamp(2.75rem,6.2vw,5.7rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
                  {hero.title}
                </h1>
                <p className="clamp-3 mt-6 max-w-xl text-base leading-8 text-[var(--text-soft)] md:text-lg">{hero.description}</p>
                <Link to={`/story/${hero.slug}`} className="button-primary mt-8">
                  <Play size={18} fill="currentColor" /> เริ่มฟังเรื่องนี้ <ArrowRight size={18} />
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-3" aria-label="เลือกเรื่องเด่น">
                {featured.map((item, index) => (
                  <button
                    type="button" key={item.slug} onClick={() => setActiveIndex(index)}
                    className={`hero-dot ${item.slug === hero.slug ? "active" : ""}`}
                    aria-label={`แสดงเรื่อง ${item.title}`} aria-pressed={item.slug === hero.slug}
                  />
                ))}
                {featured.length > 0 && <span className="ml-2 text-xs tabular-nums text-[var(--muted)]">{(activeIndex % featured.length + 1).toString().padStart(2, "0")} / {featured.length.toString().padStart(2, "0")}</span>}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[390px] md:mr-0">
              <div className="hero-cover-shadow" aria-hidden="true" />
              <CoverArt key={hero.slug} src={hero.coverUrl} title={hero.title} eager className="hero-cover relative aspect-[3/4]" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between border border-white/15 bg-[#111516c9] px-4 py-3 backdrop-blur-md">
                <span className="text-xs text-[var(--text-soft)]">ฟังได้ {hero.episodeCount} ตอน</span>
                <Headphones size={19} className="text-[var(--accent)]" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="genre-ticker" aria-label={`หมวดหมู่ ${categories.join(", ")}`}>
        <div className="ticker-track">
          {[...categories, ...categories, ...categories].map((category, index) => (
            <span key={`${category}-${index}`}>{category}<i>•</i></span>
          ))}
        </div>
      </div>

      <section id="continue" className="page-shell scroll-mt-24 py-16 md:py-24">
        <div className="section-heading">
          <div>
            <p className="section-kicker">บันทึกไว้ให้แล้ว</p>
            <h2 className="section-title">ฟังต่อจากตรงที่ค้าง</h2>
          </div>
          {isAuthenticated && <span className="text-sm text-[var(--muted)]">ซิงก์กับบัญชีของคุณ</span>}
        </div>

        {!isAuthenticated ? (
          <div className="continue-login">
            <div>
              <h3 className="font-display text-2xl">ไม่ต้องจำว่าฟังค้างไว้ตรงไหน</h3>
              <p className="mt-2 max-w-xl leading-7 text-[var(--muted)]">เข้าสู่ระบบเพื่อบันทึกตำแหน่งทุก 5 วินาที และกลับมาฟังต่อได้จากทุกอุปกรณ์</p>
            </div>
            <Link to="/login" className="button-secondary shrink-0">เข้าสู่ระบบ <ArrowRight size={17} /></Link>
          </div>
        ) : continueQuery.isLoading ? (
          <div className="h-36 animate-pulse bg-[var(--surface)]" />
        ) : continueQuery.data?.length ? (
          <div className="continue-row">
            {continueQuery.data.map((item) => {
              const progress = item.duration ? Math.min(100, (item.position / item.duration) * 100) : 0;
              return (
                <article className="continue-card" key={item.episodeId}>
                  <CoverArt src={item.coverUrl} title={item.novelTitle} className="h-[104px] w-[78px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[var(--accent)]">{item.novelTitle}</p>
                    <h3 className="mt-1 line-clamp-2 font-display text-lg leading-snug">ตอนที่ {item.episodeNumber} · {item.episodeTitle}</h3>
                    <div className="mt-3 h-1 bg-[var(--line)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--muted)]">{formatTime(item.position)} / {formatTime(item.duration)}</span>
                      <button
                        type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--accent)] disabled:opacity-40"
                        disabled={item.locked || openingId === item.episodeId}
                        onClick={async () => {
                          if (item.audioUrl) {
                            playTrack({
                              episodeId: item.episodeId, novelSlug: item.novelSlug, novelTitle: item.novelTitle,
                              episodeNumber: item.episodeNumber, episodeTitle: item.episodeTitle,
                              audioUrl: item.audioUrl, coverUrl: item.coverUrl, duration: item.duration, position: item.position,
                            });
                            return;
                          }
                          setOpeningId(item.episodeId);
                          try {
                            const signed = await openAudio.mutateAsync({ episodeId: item.episodeId });
                            playTrack({
                              episodeId: item.episodeId, novelSlug: item.novelSlug, novelTitle: item.novelTitle,
                              episodeNumber: item.episodeNumber, episodeTitle: item.episodeTitle,
                              audioUrl: signed.url, coverUrl: item.coverUrl, duration: item.duration, position: item.position,
                            });
                          } catch {
                            toast.error("ตอนนี้เปิดให้เฉพาะสมาชิกที่ยังไม่หมดอายุ");
                          } finally {
                            setOpeningId(null);
                          }
                        }}
                      >
                        {item.locked
                          ? <><Lock size={15} /> ต้องเป็นสมาชิก</>
                          : openingId === item.episodeId
                            ? <><Loader2 size={15} className="animate-spin" /> กำลังเปิด</>
                            : <><Play size={15} fill="currentColor" /> ฟังต่อ</>}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Headphones size={28} className="text-[var(--accent)]" />
            <p className="mt-3">ยังไม่มีประวัติการฟัง เลือกเรื่องที่ชอบแล้วเริ่มฟังตอนแรกได้เลย</p>
            <Link to="/library" className="mt-4 inline-flex min-h-11 items-center text-[var(--accent)]">เปิดคลังนิยาย <ArrowRight size={16} /></Link>
          </div>
        )}
      </section>

      <section className="page-shell pb-20 md:pb-28">
        <div className="section-heading">
          <div>
            <p className="section-kicker">คลังเสียงนิยาย</p>
            <h2 className="section-title">เรื่องเล่าสำหรับคืนนี้</h2>
          </div>
          <Link to="/library" className="text-link">ดูทั้งหมด <ArrowRight size={17} /></Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {novels.map((novel) => <NovelCard key={novel.slug} novel={novel} />)}
        </div>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="page-shell flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-display text-3xl">No.73</div>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">พื้นที่เล็ก ๆ สำหรับปิดตา วางหน้าจอ และปล่อยให้เรื่องเล่าพาไป</p>
          </div>
          <div className="flex gap-6 text-sm text-[var(--muted)]">
            <Link to="/" className="flex min-h-11 items-center hover:text-[var(--accent)]">หน้าแรก</Link>
            <Link to="/library" className="flex min-h-11 items-center hover:text-[var(--accent)]">คลังนิยาย</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HomeSkeleton() {
  return (
    <main className="page-shell py-10">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="h-80 animate-pulse bg-[var(--surface)]" />
        <div className="mx-auto aspect-[3/4] w-full max-w-sm animate-pulse bg-[var(--surface)]" />
      </div>
      <div className="mt-20 grid grid-cols-2 gap-5 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[3/4] animate-pulse bg-[var(--surface)]" />)}
      </div>
    </main>
  );
}

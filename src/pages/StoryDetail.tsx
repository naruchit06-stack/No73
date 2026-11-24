import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, Clock3, ListMusic, Loader2, Lock, Pause, Play, Unlock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { usePlayer } from "@/providers/PlayerProvider";
import { useAuth } from "@/hooks/useAuth";
import { CoverArt } from "@/components/CoverArt";
import { formatTime } from "@/types/player";
import type { PlayerTrack } from "@/types/player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EpisodeRow = {
  id: number;
  number: number;
  title: string;
  duration: number;
  isPremium: boolean;
  locked: boolean;
  audioUrl: string | null;
  progress: { position: number; duration: number } | null;
};

function formatThaiDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(value));
}

function isMembersOnly(error: unknown) {
  return error instanceof Error && error.message.includes("MEMBERS_ONLY");
}

export default function StoryDetail() {
  const { slug = "" } = useParams();
  const membership = trpc.membership.info.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: (query) => (query.state.data?.pendingRequest ? 15000 : false),
  });
  const detailQuery = trpc.novel.detail.useQuery({ slug }, {
    enabled: Boolean(slug),
    refetchInterval: membership.data?.pendingRequest ? 15000 : false,
  });
  const { data, isLoading, error, refetch } = detailQuery;
  const { playTrack, toggle, current, isPlaying } = usePlayer();
  const { isAuthenticated } = useAuth();
  const openAudio = trpc.novel.getEpisodeAudio.useMutation();
  const submitPayment = trpc.membership.submitPayment.useMutation();
  const utils = trpc.useUtils();

  const [lockedEpisode, setLockedEpisode] = useState<EpisodeRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loadingEpisodeId, setLoadingEpisodeId] = useState<number | null>(null);

  const tracks = useMemo<PlayerTrack[]>(() => (data?.episodes ?? []).flatMap((episode) => episode.audioUrl ? [{
    episodeId: episode.id,
    novelSlug: data!.novel.slug,
    novelTitle: data!.novel.title,
    episodeNumber: episode.number,
    episodeTitle: episode.title,
    audioUrl: episode.audioUrl,
    coverUrl: data!.novel.coverUrl,
    duration: episode.duration,
    position: episode.progress?.position ?? 0,
  }] : []), [data]);

  if (isLoading) return <main className="page-shell min-h-[80dvh] py-16"><div className="h-[480px] animate-pulse bg-[var(--surface)]" /></main>;
  if (error || !data) return (
    <main className="page-shell flex min-h-[75dvh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-4xl">ไม่พบเรื่องนี้ในคลัง</h1>
      <p className="mt-3 text-[var(--muted)]">เรื่องนี้อาจถูกย้ายหรือนำออกแล้ว</p>
      <div className="mt-6 flex gap-3"><button type="button" className="button-secondary" onClick={() => void refetch()}>ลองใหม่</button><Link to="/library" className="button-primary">กลับคลังนิยาย</Link></div>
    </main>
  );

  const { novel, episodes } = data;
  const resumeTrack = tracks.find((track) => (track.position ?? 0) > 1 && (track.position ?? 0) < track.duration - 2) ?? tracks[0];
  const totalDuration = episodes.reduce((sum, episode) => sum + episode.duration, 0);
  const info = membership.data;

  async function playEpisode(episode: EpisodeRow) {
    if (!data) return;
    if (episode.locked) {
      setLockedEpisode(episode);
      void membership.refetch();
      return;
    }
    const ready = tracks.find((track) => track.episodeId === episode.id);
    if (ready) {
      if (current?.episodeId === episode.id) toggle();
      else playTrack(ready, tracks);
      return;
    }
    setLoadingEpisodeId(episode.id);
    try {
      const signed = await openAudio.mutateAsync({ episodeId: episode.id });
      const track: PlayerTrack = {
        episodeId: episode.id,
        novelSlug: data.novel.slug,
        novelTitle: data.novel.title,
        episodeNumber: episode.number,
        episodeTitle: episode.title,
        audioUrl: signed.url,
        coverUrl: data.novel.coverUrl,
        duration: episode.duration,
        position: episode.progress?.position ?? 0,
      };
      playTrack(track, [...tracks, track]);
    } catch (playError) {
      if (isMembersOnly(playError)) {
        setLockedEpisode(episode);
        void membership.refetch();
        return;
      }
      toast.error(playError instanceof Error ? playError.message : "เปิดไฟล์เสียงไม่สำเร็จ");
    } finally {
      setLoadingEpisodeId(null);
    }
  }

  async function submit() {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error("กรุณากรอกยอดเงินที่โอน");
      return;
    }
    try {
      await submitPayment.mutateAsync({ amount: Math.round(parsed), note: note.trim() });
      await utils.membership.info.invalidate();
      await utils.membership.myRequests.invalidate();
      setNote("");
      toast.success("ส่งแจ้งโอนแล้ว รอผู้ดูแลตรวจสอบ");
    } catch (submitError) {
      if (submitError instanceof Error && submitError.message.includes("PAYMENT_PENDING")) {
        toast.error("คุณมีรายการแจ้งโอนที่รอตรวจสอบอยู่แล้ว");
        await utils.membership.info.invalidate();
        return;
      }
      toast.error(submitError instanceof Error ? submitError.message : "ส่งแจ้งโอนไม่สำเร็จ");
    }
  }

  return (
    <main>
      <section className="story-hero">
        <div className="hero-backdrop" style={novel.coverUrl ? { backgroundImage: `url("${novel.coverUrl}")` } : undefined} aria-hidden="true" />
        <div className="page-shell relative py-8 md:py-14">
          <Link to="/library" className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-soft)] hover:text-[var(--accent)]"><ArrowLeft size={17} /> คลังนิยาย</Link>
          <div className="mt-7 grid gap-8 md:grid-cols-[220px_1fr] md:gap-10 lg:grid-cols-[270px_1fr]">
            <CoverArt src={novel.coverUrl} title={novel.title} eager className="mx-auto aspect-[3/4] w-[210px] shadow-2xl md:mx-0 md:w-full" />
            <div className="flex flex-col justify-end">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">{novel.category}</p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-6xl">{novel.title}</h1>
              <p className="mt-3 text-[var(--text-soft)]">เขียนโดย {novel.author}</p>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-soft)]">{novel.description}</p>
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5"><ListMusic size={16} /> {episodes.length} ตอน</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 size={16} /> รวม {formatTime(totalDuration)}</span>
                {info?.isMember && <span className="inline-flex items-center gap-1.5 text-[var(--accent)]"><Unlock size={16} /> สมาชิกถึง {formatThaiDate(info.memberUntil)}</span>}
              </div>
              {resumeTrack && (
                <button type="button" className="button-primary mt-7 self-start" onClick={() => playTrack(resumeTrack, tracks)}>
                  <Play size={18} fill="currentColor" /> {(resumeTrack.position ?? 0) > 1 ? "ฟังต่อจากที่ค้าง" : "เริ่มฟังตอนแรก"} <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-12 md:py-20">
        <div className="section-heading">
          <div><p className="section-kicker">สารบัญเสียง</p><h2 className="section-title">ทุกตอน</h2></div>
          <span className="text-sm text-[var(--muted)]">เล่นต่อเนื่องอัตโนมัติ</span>
        </div>

        {!isAuthenticated && (
          <div className="mb-6 flex flex-col gap-3 border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[var(--muted)]">เข้าสู่ระบบเพื่อบันทึกตำแหน่งและฟังต่อบนอุปกรณ์อื่น</p>
            <Link to="/login" className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[var(--accent)]">เข้าสู่ระบบ <ArrowRight size={16} /></Link>
          </div>
        )}

        <div className="episode-list">
          {episodes.map((episode) => {
            const active = current?.episodeId === episode.id;
            const progress = episode.progress && episode.progress.duration ? Math.min(100, episode.progress.position / episode.progress.duration * 100) : 0;
            const finished = progress > 96;
            const busy = loadingEpisodeId === episode.id;
            return (
              <button
                type="button" key={episode.id} disabled={busy}
                onClick={() => void playEpisode(episode)}
                className={`episode-row ${active ? "active" : ""} ${episode.locked ? "opacity-90" : ""}`}
              >
                <span className="episode-number">{episode.number.toString().padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block font-display text-lg font-medium md:text-xl">{episode.title}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                    {episode.locked
                      ? <><Lock size={13} className="text-[var(--accent)]" /> ต้องเป็นสมาชิกก่อนฟัง</>
                      : finished ? <><Check size={14} className="text-[var(--accent)]" /> ฟังจบแล้ว</>
                        : episode.progress && episode.progress.position > 0 ? `ฟังแล้ว ${Math.round(progress)}%` : "ยังไม่ได้ฟัง"}
                  </span>
                  {progress > 0 && !episode.locked && <span className="mt-3 block h-0.5 w-full max-w-md bg-[var(--line)]"><span className="block h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></span>}
                </span>
                <span className="hidden text-xs tabular-nums text-[var(--muted)] sm:block">{formatTime(episode.duration)}</span>
                <span className={`episode-play ${active ? "active" : ""}`}>
                  {busy ? <Loader2 size={19} className="animate-spin" />
                    : episode.locked ? <Lock size={18} />
                      : active && isPlaying ? <Pause size={19} fill="currentColor" />
                        : <Play size={19} fill="currentColor" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Dialog open={Boolean(lockedEpisode)} onOpenChange={(open) => { if (!open) setLockedEpisode(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ปลดล็อกเพื่อฟัง</DialogTitle>
            <DialogDescription>
              ตอนที่ {lockedEpisode?.number} · {lockedEpisode?.title}
            </DialogDescription>
          </DialogHeader>

          {!isAuthenticated ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--muted)]">กรุณาเข้าสู่ระบบก่อนแจ้งโอน เพื่อให้ผู้ดูแลตรวจสอบและผูกสมาชิกกับบัญชีของคุณ</p>
              <Button asChild className="w-full">
                <Link to="/login">เข้าสู่ระบบ</Link>
              </Button>
            </div>
          ) : info?.isMember ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--muted)]">บัญชีของคุณเป็นสมาชิกถึงวันที่ {formatThaiDate(info.memberUntil)} จึงฟังตอนนี้ได้ทันที</p>
              <Button className="w-full" onClick={() => { if (lockedEpisode) void playEpisode({ ...lockedEpisode, locked: false }); setLockedEpisode(null); }}>
                <Play size={16} fill="currentColor" /> ฟังตอนนี้
              </Button>
            </div>
          ) : info?.pendingRequest ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-[var(--text-soft)]">คุณส่งแจ้งโอน {info.pendingRequest.amount.toLocaleString("th-TH")} บาท เมื่อ {formatThaiDate(info.pendingRequest.createdAt)} แล้ว</p>
              <p className="text-sm leading-6 text-[var(--muted)]">ผู้ดูแลกำลังตรวจสอบยอดเงิน เมื่ออนุมัติแล้วระบบจะปลดล็อกให้อัตโนมัติ</p>
              <Button variant="secondary" className="w-full" onClick={() => void membership.refetch()}>ตรวจสอบสถานะอีกครั้ง</Button>
            </div>
          ) : !info?.paymentsEnabled ? (
            <p className="text-sm leading-6 text-[var(--muted)]">ขณะนี้ระบบสมาชิกยังไม่เปิดให้แจ้งโอน กรุณาติดต่อผู้ดูแลเว็บไซต์</p>
          ) : (
            <div className="space-y-4">
              {info.qrUrl ? (
                <div className="flex flex-col items-center gap-2 border border-[var(--line)] bg-white p-3">
                  <img src={info.qrUrl} alt="QR รับโอนเงิน" className="h-52 w-52 object-contain" />
                </div>
              ) : (
                <p className="border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">ผู้ดูแลยังไม่ได้อัปโหลด QR รับโอน กรุณาติดต่อผู้ดูแลเว็บไซต์</p>
              )}
              {info.priceLabel && <p className="text-center text-sm text-[var(--text-soft)]">ค่าสมาชิก {info.priceLabel}</p>}
              <div className="space-y-2">
                <Label htmlFor="payment-amount">ยอดเงินที่โอน (บาท)</Label>
                <Input id="payment-amount" type="number" min={1} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="เช่น 99" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-note">หมายเหตุ (ไม่บังคับ)</Label>
                <Textarea id="payment-note" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="ชื่อบัญชีที่โอน หรือเวลาที่โอน" />
              </div>
              <Button className="w-full" disabled={submitPayment.isPending} onClick={() => void submit()}>
                {submitPayment.isPending ? <Loader2 size={16} className="animate-spin" /> : null} แจ้งโอนแล้ว
              </Button>
              <p className="text-center text-xs leading-5 text-[var(--muted)]">เมื่อผู้ดูแลตรวจสอบยอดเงินเรียบร้อย ระบบจะเปิดให้ฟังทันที</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

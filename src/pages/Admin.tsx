import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Crown,
  FileAudio,
  Headphones,
  Image,
  Layers3,
  Loader2,
  Lock,
  Plus,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const emptyStory = { title: "", author: "", category: "แฟนตาซี", description: "", featured: false };

type NovelSummary = { id: number; title: string; slug: string; episodeCount: number };

function formatThaiDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatThaiDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(value));
}

export default function Admin() {
  const { user, isLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  const [tab, setTab] = useState<"story" | "episode" | "manage" | "member">("story");
  const novelsQuery = trpc.novel.list.useQuery(undefined, { enabled: user?.role === "admin" });
  const utils = trpc.useUtils();
  const statsQuery = trpc.admin.membershipStats.useQuery(undefined, {
    enabled: user?.role === "admin",
    refetchInterval: 15000,
  });
  const previousStats = useRef({ pendingCount: 0, unreadSignups: 0 });

  useEffect(() => {
    const stats = statsQuery.data;
    if (!stats) return;
    const previous = previousStats.current;
    if (stats.pendingCount > previous.pendingCount) {
      toast.info(`มีแจ้งโอนใหม่ ${stats.pendingCount - previous.pendingCount} รายการ รออนุมัติ`, { duration: 6000 });
    }
    if (stats.unreadSignups > previous.unreadSignups) {
      toast.info(`มีผู้สมัครใหม่ ${stats.unreadSignups - previous.unreadSignups} คน`, { duration: 6000 });
    }
    previousStats.current = { pendingCount: stats.pendingCount, unreadSignups: stats.unreadSignups };
  }, [statsQuery.data]);
  const [story, setStory] = useState(emptyStory);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [creating, setCreating] = useState(false);
  const [episode, setEpisode] = useState({ novelId: 0, number: 1, title: "", duration: 0 });
  const [audio, setAudio] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const upload = trpc.admin.upload.useMutation();
  const createNovel = trpc.admin.createNovel.useMutation();
  const addEpisode = trpc.admin.addEpisode.useMutation();
  const deleteNovel = trpc.admin.deleteNovel.useMutation();
  const novels = novelsQuery.data ?? [];

  useEffect(() => {
    if (!episode.novelId && novels[0]) setEpisode((value) => ({ ...value, novelId: novels[0].id }));
  }, [novels, episode.novelId]);

  useEffect(() => {
    if (!cover) { setCoverPreview(""); return; }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  if (isLoading) return <main className="page-shell py-16"><div className="h-96 animate-pulse bg-[var(--surface)]" /></main>;
  if (!isAuthenticated) return null;
  if (user?.role !== "admin") return (
    <main className="page-shell flex min-h-[75dvh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-4xl">หน้านี้สำหรับผู้ดูแลเท่านั้น</h1>
      <p className="mt-3 text-[var(--muted)]">บัญชีของคุณยังไม่มีสิทธิ์จัดการคลังนิยาย</p>
      <Link to="/" className="button-primary mt-6">กลับหน้าแรก</Link>
    </main>
  );

  async function handleCreateStory(event: FormEvent) {
    event.preventDefault();
    if (story.description.trim().length < 10) { toast.error("เรื่องย่อต้องมีอย่างน้อย 10 ตัวอักษร"); return; }
    setCreating(true);
    try {
      let coverKey: string | undefined;
      if (cover) coverKey = (await upload.mutateAsync({
        kind: "cover", fileName: cover.name, contentType: cover.type, contentBase64: await fileToBase64(cover),
      })).key;
      await createNovel.mutateAsync({ ...story, coverKey });
      await utils.novel.list.invalidate();
      setStory(emptyStory);
      setCover(null);
      toast.success("เพิ่มนิยายเรื่องใหม่แล้ว");
      setTab("episode");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เพิ่มนิยายไม่สำเร็จ");
    } finally { setCreating(false); }
  }

  async function handleAddEpisode(event: FormEvent) {
    event.preventDefault();
    if (!audio || !episode.novelId) { toast.error("กรุณาเลือกนิยายและไฟล์เสียง"); return; }
    setAdding(true);
    try {
      const saved = await upload.mutateAsync({
        kind: "audio", fileName: audio.name, contentType: audio.type || "audio/mpeg", contentBase64: await fileToBase64(audio),
      });
      await addEpisode.mutateAsync({ ...episode, audioKey: saved.key });
      await utils.novel.list.invalidate();
      if (novels.find((novel) => novel.id === episode.novelId)) {
        await utils.novel.detail.invalidate({ slug: novels.find((novel) => novel.id === episode.novelId)!.slug });
      }
      setEpisode((value) => ({ novelId: value.novelId, number: value.number + 1, title: "", duration: 0 }));
      setAudio(null);
      toast.success("อัปโหลดและเพิ่มตอนใหม่แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เพิ่มตอนไม่สำเร็จ");
    } finally { setAdding(false); }
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("รูปปกต้องไม่เกิน 5 MB"); return; }
    setCover(file);
  }

  async function chooseAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith("audio/")) { toast.error("กรุณาเลือกไฟล์เสียง"); return; }
    if (file.size > 30 * 1024 * 1024) { toast.error("ไฟล์เสียงต้องไม่เกิน 30 MB"); return; }
    setAudio(file);
    try {
      const duration = await audioDuration(file);
      setEpisode((value) => ({ ...value, duration }));
    } catch { /* duration can be entered manually */ }
  }

  return (
    <main className="page-shell min-h-[85dvh] py-10 md:py-16">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-kicker">พื้นที่ผู้ดูแล</p>
          <h1 className="mt-2 font-display text-4xl font-semibold md:text-6xl">จัดการคลังนิยาย</h1>
          <p className="mt-3 text-[var(--muted)]">สวัสดี {user.name || "ผู้ดูแล"} · ไฟล์ทั้งหมดถูกเก็บอย่างปลอดภัยบนระบบคลาวด์</p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex flex-wrap gap-2">
            <Badge variant={statsQuery.data?.pendingCount ? "default" : "secondary"}>
              <Bell size={12} /> รออนุมัติ {statsQuery.data?.pendingCount ?? 0}
            </Badge>
            <Badge variant={statsQuery.data?.unreadSignups ? "default" : "secondary"}>
              <Crown size={12} /> ผู้สมัครใหม่ {statsQuery.data?.unreadSignups ?? 0}
            </Badge>
          </div>
          <Link to="/library" className="button-secondary self-start">ดูหน้าคลัง</Link>
        </div>
      </div>

      <div className="mt-9 grid grid-cols-3 border-y border-[var(--line)]">
        <AdminStat icon={<BookOpen size={20} />} value={novels.length} label="นิยายทั้งหมด" />
        <AdminStat icon={<Layers3 size={20} />} value={novels.reduce((sum, novel) => sum + novel.episodeCount, 0)} label="ตอนทั้งหมด" />
        <AdminStat icon={<Headphones size={20} />} value={new Set(novels.map((novel) => novel.category)).size} label="หมวดหมู่" />
      </div>

      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-[var(--line)]" role="tablist" aria-label="เครื่องมือผู้ดูแล">
        {([{ id: "story", label: "เพิ่มนิยาย" }, { id: "episode", label: "อัปโหลดตอน" }, { id: "manage", label: "จัดการเรื่องและตอน" }, { id: "member", label: "สมาชิกและการชำระเงิน" }] as const).map((item) => (
          <button type="button" role="tab" aria-selected={tab === item.id} key={item.id} onClick={() => setTab(item.id)} className={`admin-tab ${tab === item.id ? "active" : ""}`}>{item.label}</button>
        ))}
      </div>

      {tab === "story" && (
        <form onSubmit={handleCreateStory} className="admin-form">
          <div className="form-intro"><span>01</span><div><h2>ข้อมูลนิยายเรื่องใหม่</h2><p>เพิ่มรายละเอียดและปกก่อนอัปโหลดตอนเสียง</p></div></div>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="ชื่อเรื่อง"><input required maxLength={255} value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} placeholder="เช่น เมืองหลังม่านหมอก" /></Field>
            <Field label="นักเขียน / ผู้บรรยาย"><input required maxLength={255} value={story.author} onChange={(e) => setStory({ ...story, author: e.target.value })} placeholder="ชื่อผู้สร้างสรรค์" /></Field>
            <Field label="หมวดหมู่"><select value={story.category} onChange={(e) => setStory({ ...story, category: e.target.value })}>{["แฟนตาซี", "โรแมนติก", "สืบสวน", "สยองขวัญ", "ไซไฟ", "ชีวิต"].map((item) => <option key={item}>{item}</option>)}</select></Field>
            <label className="flex min-h-14 items-center gap-3 self-end pb-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={story.featured} onChange={(e) => setStory({ ...story, featured: e.target.checked })} /> แสดงในเรื่องเด่นหน้าแรก</label>
          </div>
          <Field label="เรื่องย่อ"><textarea required minLength={10} maxLength={5000} rows={5} value={story.description} onChange={(e) => setStory({ ...story, description: e.target.value })} placeholder="เล่าจุดเริ่มต้นและเสน่ห์ของเรื่องนี้..." /></Field>
          <div>
            <span className="form-label">รูปปก (ไม่บังคับ · สูงสุด 5 MB)</span>
            <label className="upload-zone">
              {coverPreview ? <img src={coverPreview} alt="ตัวอย่างปก" className="h-24 w-20 object-cover" /> : <Image size={28} className="text-[var(--accent)]" />}
              <span><strong>{cover ? cover.name : "เลือกรูปปกนิยาย"}</strong><small>JPG, PNG หรือ WebP · แนวตั้ง 3:4</small></span>
              <input type="file" accept="image/*" onChange={chooseCover} className="sr-only" />
            </label>
          </div>
          <button type="submit" disabled={creating} className="button-primary self-start">{creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} {creating ? "กำลังบันทึก..." : "เพิ่มนิยาย"}</button>
        </form>
      )}

      {tab === "episode" && (
        <form onSubmit={handleAddEpisode} className="admin-form">
          <div className="form-intro"><span>02</span><div><h2>อัปโหลดตอนเสียง</h2><p>เลือกเรื่องและเพิ่มไฟล์เสียงทีละตอน</p></div></div>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="นิยาย"><select required value={episode.novelId} onChange={(e) => setEpisode({ ...episode, novelId: Number(e.target.value) })}><option value={0} disabled>เลือกเรื่อง</option>{novels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title}</option>)}</select></Field>
            <Field label="เลขตอน"><input required type="number" min={1} max={10000} value={episode.number} onChange={(e) => setEpisode({ ...episode, number: Number(e.target.value) })} /></Field>
            <Field label="ชื่อตอน"><input required maxLength={255} value={episode.title} onChange={(e) => setEpisode({ ...episode, title: e.target.value })} placeholder="ชื่อประจำตอน" /></Field>
            <Field label="ความยาว (วินาที)"><input required type="number" min={0} max={86400} value={episode.duration} onChange={(e) => setEpisode({ ...episode, duration: Number(e.target.value) })} /></Field>
          </div>
          <div>
            <span className="form-label">ไฟล์เสียง (สูงสุด 30 MB)</span>
            <label className="upload-zone">
              <FileAudio size={30} className="text-[var(--accent)]" />
              <span><strong>{audio ? audio.name : "เลือกไฟล์เสียงสำหรับตอนนี้"}</strong><small>{audio ? `${(audio.size / 1024 / 1024).toFixed(1)} MB · อ่านความยาวอัตโนมัติแล้ว` : "MP3, M4A, WAV หรือ OGG"}</small></span>
              <input type="file" accept="audio/*" onChange={chooseAudio} className="sr-only" />
            </label>
          </div>
          <button type="submit" disabled={adding || !novels.length} className="button-primary self-start">{adding ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />} {adding ? "กำลังอัปโหลด..." : "อัปโหลดและเพิ่มตอน"}</button>
          {!novels.length && <p className="text-sm text-[var(--muted)]">เพิ่มนิยายอย่างน้อยหนึ่งเรื่องก่อนอัปโหลดตอน</p>}
        </form>
      )}

      {tab === "manage" && (
        <div className="mt-8">
          {novelsQuery.isLoading ? <div className="h-48 animate-pulse bg-[var(--surface)]" /> : novels.length ? (
            <div className="admin-story-list">
              {novels.map((novel) => (
                <article key={novel.id} className="admin-story-row">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <button type="button" className="flex min-h-14 flex-1 items-center gap-3 text-left" onClick={() => setExpandedId(expandedId === novel.id ? null : novel.id)} aria-expanded={expandedId === novel.id}>
                      <ChevronDown size={18} className={`shrink-0 transition-transform ${expandedId === novel.id ? "rotate-180" : ""}`} />
                      <span><strong className="block font-display text-lg">{novel.title}</strong><small className="text-[var(--muted)]">{novel.category} · {novel.episodeCount} ตอน</small></span>
                    </button>
                    <div className="flex gap-2">
                      <Link to={`/story/${novel.slug}`} className="button-compact">ดูหน้าเรื่อง</Link>
                      <button type="button" className="button-danger" onClick={async () => {
                        if (!window.confirm(`ลบ “${novel.title}” และทุกตอนถาวรใช่หรือไม่`)) return;
                        try { await deleteNovel.mutateAsync({ id: novel.id }); await utils.novel.list.invalidate(); toast.success("ลบนิยายแล้ว"); }
                        catch (error) { toast.error(error instanceof Error ? error.message : "ลบไม่สำเร็จ"); }
                      }}><Trash2 size={16} /> ลบเรื่อง</button>
                    </div>
                  </div>
                  {expandedId === novel.id && (
                    <>
                      <CoverEditor novelId={novel.id} title={novel.title} coverUrl={novel.coverUrl} />
                      <EpisodeManager slug={novel.slug} />
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : <div className="empty-state"><p>ยังไม่มีนิยายในคลัง</p><button type="button" className="button-primary mt-4" onClick={() => setTab("story")}>เพิ่มเรื่องแรก</button></div>}
        </div>
      )}

      {tab === "member" && <MembershipPanel novels={novels} />}
    </main>
  );
}

function CoverEditor({ novelId, title, coverUrl }: { novelId: number; title: string; coverUrl: string | null }) {
  const utils = trpc.useUtils();
  const upload = trpc.admin.upload.useMutation();
  const updateCover = trpc.admin.updateCover.useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (picked.size > 5 * 1024 * 1024) { toast.error("รูปปกต้องไม่เกิน 5 MB"); return; }
    setFile(picked);
  }

  async function refresh() {
    await Promise.all([utils.novel.list.invalidate(), utils.novel.detail.invalidate()]);
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const saved = await upload.mutateAsync({
        kind: "cover", fileName: file.name, contentType: file.type, contentBase64: await fileToBase64(file),
      });
      await updateCover.mutateAsync({ id: novelId, coverKey: saved.key });
      await refresh();
      setFile(null);
      toast.success("เปลี่ยนรูปปกแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "เปลี่ยนรูปปกไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm(`ลบรูปปกของ “${title}” ใช่หรือไม่`)) return;
    setSaving(true);
    try {
      await updateCover.mutateAsync({ id: novelId, coverKey: null });
      await refresh();
      toast.success("ลบรูปปกแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบรูปปกไม่สำเร็จ");
    } finally { setSaving(false); }
  }

  const shown = preview || coverUrl;
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--line)] bg-[var(--bg)] px-4 py-4 sm:flex-row sm:items-center">
      <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--surface)]">
        {shown ? <img src={shown} alt={`ปก ${title}`} className="h-full w-full object-cover" /> : <Image size={26} className="text-[var(--muted)]" />}
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div>
          <strong className="block text-sm">รูปปกนิยาย</strong>
          <small className="text-[var(--muted)]">{file ? `ไฟล์ใหม่: ${file.name} — กด “บันทึกปกใหม่” เพื่อใช้งาน` : "JPG, PNG หรือ WebP · แนวตั้ง 3:4 · ไม่เกิน 5 MB"}</small>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="button-compact cursor-pointer">
            <Upload size={16} /> {coverUrl || file ? "เลือกรูปใหม่" : "เลือกรูปปก"}
            <input type="file" accept="image/*" onChange={choose} className="sr-only" disabled={saving} />
          </label>
          {file && (
            <>
              <button type="button" className="button-primary" disabled={saving} onClick={save}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : null} {saving ? "กำลังบันทึก..." : "บันทึกปกใหม่"}
              </button>
              <button type="button" className="button-compact" disabled={saving} onClick={() => setFile(null)}>ยกเลิก</button>
            </>
          )}
          {!file && coverUrl && <button type="button" className="button-danger" disabled={saving} onClick={remove}><Trash2 size={16} /> ลบปก</button>}
        </div>
      </div>
    </div>
  );
}

function EpisodeManager({ slug }: { slug: string }) {
  const detail = trpc.novel.detail.useQuery({ slug });
  const utils = trpc.useUtils();
  const remove = trpc.admin.deleteEpisode.useMutation();
  return (
    <div className="border-t border-[var(--line)] bg-[var(--bg)] px-4 py-3">
      {detail.isLoading ? <p className="py-3 text-sm text-[var(--muted)]">กำลังโหลดตอน...</p> : detail.data?.episodes.length ? detail.data.episodes.map((episode) => (
        <div key={episode.id} className="flex min-h-14 items-center gap-3 border-b border-[var(--line)] py-2 last:border-0">
          <span className="w-8 text-xs text-[var(--muted)]">{episode.number.toString().padStart(2, "0")}</span>
          <span className="flex-1 text-sm">{episode.title}</span>
          <button type="button" className="icon-button text-[var(--danger)]" aria-label={`ลบตอน ${episode.title}`} onClick={async () => {
            if (!window.confirm(`ลบตอน “${episode.title}” ใช่หรือไม่`)) return;
            try { await remove.mutateAsync({ id: episode.id }); await utils.novel.detail.invalidate({ slug }); await utils.novel.list.invalidate(); toast.success("ลบตอนแล้ว"); }
            catch (error) { toast.error(error instanceof Error ? error.message : "ลบตอนไม่สำเร็จ"); }
          }}><Trash2 size={17} /></button>
        </div>
      )) : <p className="py-3 text-sm text-[var(--muted)]">เรื่องนี้ยังไม่มีตอนเสียง</p>}
    </div>
  );
}

function AdminStat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="flex flex-col gap-2 border-r border-[var(--line)] px-3 py-5 last:border-0 md:flex-row md:items-center md:gap-4 md:px-6"><span className="text-[var(--accent)]">{icon}</span><div><strong className="block text-2xl font-medium md:text-3xl">{value}</strong><span className="text-xs text-[var(--muted)] md:text-sm">{label}</span></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="form-label">{label}</span>{children}</label>;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function audioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { const duration = Math.round(audio.duration); URL.revokeObjectURL(url); resolve(Number.isFinite(duration) ? duration : 0); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("อ่านความยาวไฟล์ไม่สำเร็จ")); };
    audio.src = url;
  });
}

function MembershipPanel({ novels }: { novels: NovelSummary[] }) {
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <MembershipSettingsCard />
      <SignupsCard />
      <div className="xl:col-span-2"><PaymentQueueCard /></div>
      <div className="xl:col-span-2"><EpisodeLockCard novels={novels} /></div>
    </div>
  );
}

function MembershipSettingsCard() {
  const utils = trpc.useUtils();
  const settings = trpc.admin.getMembershipSettings.useQuery();
  const update = trpc.admin.updateMembershipSettings.useMutation();
  const uploadQr = trpc.admin.setPaymentQr.useMutation();
  const clearQr = trpc.admin.clearPaymentQr.useMutation();
  const [priceLabel, setPriceLabel] = useState("");
  const [memberDays, setMemberDays] = useState("30");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!settings.data || loaded) return;
    setPriceLabel(settings.data.priceLabel);
    setMemberDays(String(settings.data.memberDays));
    setLoaded(true);
  }, [settings.data, loaded]);

  async function refresh() {
    await Promise.all([utils.admin.getMembershipSettings.invalidate(), utils.membership.info.invalidate()]);
  }

  async function toggle(checked: boolean) {
    try {
      await update.mutateAsync({ paymentsEnabled: checked });
      await refresh();
      toast.success(checked ? "เปิดระบบสมาชิกให้ผู้ใช้แจ้งโอนแล้ว" : "ปิดระบบสมาชิกแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ");
    }
  }

  async function save() {
    const days = Number(memberDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast.error("จำนวนวันต้องอยู่ระหว่าง 1 ถึง 3650 วัน");
      return;
    }
    try {
      await update.mutateAsync({ priceLabel: priceLabel.trim(), memberDays: Math.round(days) });
      await refresh();
      toast.success("บันทึกการตั้งค่าสมาชิกแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ");
    }
  }

  function chooseQr(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("กรุณาเลือกไฟล์รูปภาพ"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("รูป QR ต้องไม่เกิน 5 MB"); return; }
    void saveQr(file);
  }

  async function saveQr(file: File) {
    try {
      await uploadQr.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        contentBase64: await fileToBase64(file),
      });
      await refresh();
      toast.success("อัปโหลด QR รับโอนแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "อัปโหลด QR ไม่สำเร็จ");
    }
  }

  async function removeQr() {
    if (!window.confirm("ลบรูป QR รับโอนใช่หรือไม่")) return;
    try {
      await clearQr.mutateAsync();
      await refresh();
      toast.success("ลบรูป QR แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ลบรูป QR ไม่สำเร็จ");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">ตั้งค่าระบบสมาชิก</CardTitle>
        <CardDescription>เปิดรับแจ้งโอน ตั้งราคา จำนวนวัน และอัปโหลด QR รับเงิน</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 border border-[var(--line)] px-3 py-3">
          <div>
            <p className="text-sm font-medium">เปิดให้ผู้ใช้แจ้งโอน</p>
            <p className="text-xs text-[var(--muted)]">ปิดไว้เพื่อหยุดรับรายการชั่วคราว</p>
          </div>
          <Switch checked={Boolean(settings.data?.paymentsEnabled)} disabled={update.isPending} onCheckedChange={(checked) => void toggle(checked)} aria-label="เปิดหรือปิดระบบสมาชิก" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price-label">ราคาที่แสดง</Label>
            <Input id="price-label" maxLength={120} value={priceLabel} onChange={(event) => setPriceLabel(event.target.value)} placeholder="เช่น 99 บาท / 30 วัน" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-days">จำนวนวันต่อการอนุมัติ 1 ครั้ง</Label>
            <Input id="member-days" type="number" min={1} max={3650} value={memberDays} onChange={(event) => setMemberDays(event.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <Label>รูป QR รับโอน</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden border border-[var(--line)] bg-white">
              {settings.data?.qrUrl
                ? <img src={settings.data.qrUrl} alt="QR รับโอน" className="h-full w-full object-contain" />
                : <QrCode size={28} className="text-[var(--muted)]" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="button-compact cursor-pointer">
                <Upload size={16} /> {settings.data?.qrUrl ? "เปลี่ยนรูป QR" : "อัปโหลดรูป QR"}
                <input type="file" accept="image/*" className="sr-only" onChange={chooseQr} disabled={uploadQr.isPending} />
              </label>
              {settings.data?.qrUrl && (
                <button type="button" className="button-danger" onClick={() => void removeQr()} disabled={clearQr.isPending}>
                  <Trash2 size={16} /> ลบ QR
                </button>
              )}
              {uploadQr.isPending && <span className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> กำลังอัปโหลด...</span>}
            </div>
          </div>
          <p className="text-xs text-[var(--muted)]">รูปภาพจะแสดงให้ผู้ใช้เห็นตอนกดปลดล็อกตอนที่ล็อกไว้ · ไม่เกิน 5 MB</p>
        </div>

        <Button disabled={update.isPending} onClick={() => void save()}>
          {update.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} บันทึกการตั้งค่า
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentQueueCard() {
  const utils = trpc.useUtils();
  const pending = trpc.admin.pendingPayments.useQuery(undefined, { refetchInterval: 15000 });
  const decide = trpc.admin.decidePayment.useMutation();
  const [busyId, setBusyId] = useState<number | null>(null);
  const rows = pending.data ?? [];

  async function review(requestId: number, action: "approve" | "reject") {
    setBusyId(requestId);
    try {
      const result = await decide.mutateAsync({ requestId, action });
      await Promise.all([
        utils.admin.pendingPayments.invalidate(),
        utils.admin.membershipStats.invalidate(),
        utils.admin.recentSignups.invalidate(),
        utils.membership.info.invalidate(),
      ]);
      toast.success(action === "approve"
        ? `อนุมัติแล้ว สมาชิกมีผลถึง ${formatThaiDate(result.memberUntil)}`
        : "ปฏิเสธรายการแจ้งโอนแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ตรวจสอบรายการไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">รายการรออนุมัติ</CardTitle>
        <CardDescription>ตรวจยอดเงินเข้าบัญชีเองแล้วกดอนุมัติ ระบบจะเปิดสิทธิ์ให้ทันที</CardDescription>
      </CardHeader>
      <CardContent>
        {pending.isLoading ? (
          <div className="h-24 animate-pulse bg-[var(--surface)]" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้แจ้ง</TableHead>
                <TableHead>ยอดเงิน</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead>เวลาแจ้ง</TableHead>
                <TableHead className="text-right">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="block text-sm font-medium">{row.userName || "ไม่ระบุชื่อ"}</span>
                    <span className="block text-xs text-[var(--muted)]">{row.userEmail || "ไม่มีอีเมล"}</span>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.amount.toLocaleString("th-TH")} บาท</TableCell>
                  <TableCell className="max-w-[240px] whitespace-normal text-sm text-[var(--muted)]">{row.note || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-[var(--muted)]">{formatThaiDateTime(row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={busyId === row.id} onClick={() => void review(row.id, "approve")}>
                        {busyId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} อนุมัติ
                      </Button>
                      <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void review(row.id, "reject")}>
                        <X size={14} /> ปฏิเสธ
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-[var(--muted)]">ยังไม่มีรายการแจ้งโอนที่รอตรวจสอบ</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function EpisodeLockCard({ novels }: { novels: NovelSummary[] }) {
  const utils = trpc.useUtils();
  const [novelId, setNovelId] = useState(0);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const episodesQuery = trpc.admin.listEpisodesForAdmin.useQuery({ novelId }, { enabled: novelId > 0 });
  const setPremium = trpc.admin.setEpisodePremium.useMutation();

  useEffect(() => {
    if (!novelId && novels[0]) setNovelId(novels[0].id);
  }, [novels, novelId]);

  async function toggle(episodeId: number, isPremium: boolean) {
    setBusyId(episodeId);
    try {
      await setPremium.mutateAsync({ episodeId, isPremium });
      await Promise.all([
        utils.admin.listEpisodesForAdmin.invalidate({ novelId }),
        utils.novel.detail.invalidate(),
      ]);
      toast.success(isPremium ? "ล็อกตอนนี้ให้สมาชิกเท่านั้นแล้ว" : "ปลดล็อกตอนนี้ให้ทุกคนฟังแล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกการล็อกตอนไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  const term = query.trim().toLowerCase();
  const rows = (episodesQuery.data ?? []).filter((item) => !term || `${item.number} ${item.title}`.toLowerCase().includes(term));
  const lockedCount = (episodesQuery.data ?? []).filter((item) => item.isPremium).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg"><Lock size={18} className="text-[var(--accent)]" /> ล็อกรายตอน</CardTitle>
        <CardDescription>ตอนที่ล็อกไว้จะเล่นได้เฉพาะสมาชิกที่ยังไม่หมดอายุ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lock-novel">เลือกเรื่อง</Label>
            <select id="lock-novel" className="h-10 w-full border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]" value={novelId} onChange={(event) => setNovelId(Number(event.target.value))}>
              <option value={0} disabled>เลือกเรื่อง</option>
              {novels.map((novel) => <option key={novel.id} value={novel.id} className="bg-[var(--surface)]">{novel.title}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lock-search">ค้นหาตอน</Label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <Input id="lock-search" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เลขตอนหรือชื่อตอน" />
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--muted)]">ล็อกอยู่ {lockedCount} ตอน จากทั้งหมด {episodesQuery.data?.length ?? 0} ตอน</p>

        {episodesQuery.isLoading ? (
          <div className="h-24 animate-pulse bg-[var(--surface)]" />
        ) : rows.length ? (
          <div className="max-h-[420px] overflow-y-auto border border-[var(--line)]">
            {rows.map((item) => (
              <div key={item.id} className="flex min-h-14 items-center gap-3 border-b border-[var(--line)] px-3 py-2 last:border-0">
                <span className="w-9 text-xs text-[var(--muted)]">{item.number.toString().padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.title}</span>
                  {!item.hasAudio && <span className="text-xs text-[var(--danger)]">ยังไม่มีไฟล์เสียง</span>}
                </span>
                {item.isPremium && <Badge variant="secondary"><Lock size={12} /> สมาชิก</Badge>}
                <Switch
                  checked={item.isPremium}
                  disabled={busyId === item.id}
                  onCheckedChange={(checked) => void toggle(item.id, checked)}
                  aria-label={`ล็อกตอน ${item.title}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{novelId ? "ไม่พบตอนที่ตรงกับคำค้น" : "เลือกเรื่องก่อนเพื่อดูรายการตอน"}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SignupsCard() {
  const utils = trpc.useUtils();
  const signups = trpc.admin.recentSignups.useQuery({ limit: 20 }, { refetchInterval: 15000 });
  const markSeen = trpc.admin.markSignupsSeen.useMutation();
  const rows = signups.data ?? [];
  const unread = rows.filter((row) => row.unread).length;

  async function acknowledge() {
    try {
      await markSeen.mutateAsync();
      await Promise.all([utils.admin.recentSignups.invalidate(), utils.admin.membershipStats.invalidate()]);
      toast.success("รับทราบผู้สมัครใหม่แล้ว");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกการรับทราบไม่สำเร็จ");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">ผู้สมัครใหม่</CardTitle>
        <CardDescription>สมาชิกที่เพิ่งเข้าสู่ระบบครั้งแรก เรียงจากใหม่ไปเก่า</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={unread ? "default" : "secondary"}>
            <Bell size={12} /> ยังไม่รับทราบ {unread} คน
          </Badge>
          <Button size="sm" variant="outline" disabled={!unread || markSeen.isPending} onClick={() => void acknowledge()}>
            {markSeen.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} รับทราบแล้ว
          </Button>
        </div>
        {signups.isLoading ? (
          <div className="h-24 animate-pulse bg-[var(--surface)]" />
        ) : rows.length ? (
          <div className="max-h-[320px] overflow-y-auto border border-[var(--line)]">
            {rows.map((row) => (
              <div key={row.id} className="flex min-h-14 items-center gap-3 border-b border-[var(--line)] px-3 py-2 last:border-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-ink)]">
                  {(row.name || row.email || "ผ").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{row.name || "ไม่ระบุชื่อ"}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">{row.email || "ไม่มีอีเมล"} · {formatThaiDateTime(row.createdAt)}</span>
                </span>
                {row.unread && <Badge variant="default">ใหม่</Badge>}
                {row.memberUntil && new Date(row.memberUntil).getTime() > Date.now() && <Badge variant="outline">สมาชิก</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">ยังไม่มีผู้ใช้ในระบบ</p>
        )}
      </CardContent>
    </Card>
  );
}

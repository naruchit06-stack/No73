import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { NovelCard } from "@/components/NovelCard";

export default function Library() {
  const { data: novels = [], isLoading, error, refetch } = trpc.novel.list.useQuery();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const categories = ["ทั้งหมด", ...new Set(novels.map((novel) => novel.category))];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return novels.filter((novel) => {
      const matchesCategory = category === "ทั้งหมด" || novel.category === category;
      const matchesQuery = !term || `${novel.title} ${novel.author} ${novel.description}`.toLowerCase().includes(term);
      return matchesCategory && matchesQuery;
    });
  }, [novels, query, category]);

  return (
    <main className="page-shell min-h-[80dvh] py-12 md:py-20">
      <div className="max-w-3xl">
        <p className="section-kicker">คลังนิยายเสียง</p>
        <h1 className="font-display text-5xl font-semibold leading-tight md:text-7xl">เลือกโลกใบใหม่<br />ให้เสียงพาไป</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted)]">ค้นหาจากชื่อเรื่อง นักเขียน หรือเลือกหมวดที่ตรงกับอารมณ์ของคุณ</p>
      </div>

      <div className="mt-10 border-y border-[var(--line)] py-6">
        <label className="search-field">
          <Search size={20} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อเรื่องหรือนักเขียน" />
          {query && <button type="button" onClick={() => setQuery("")} className="icon-button -my-2" aria-label="ล้างคำค้นหา"><X size={18} /></button>}
        </label>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="กรองตามหมวดหมู่">
          {categories.map((item) => (
            <button type="button" key={item} onClick={() => setCategory(item)} className={`filter-chip ${category === item ? "active" : ""}`} aria-pressed={category === item}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-7 mt-8 flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">พบ {filtered.length} เรื่อง</p>
        {(query || category !== "ทั้งหมด") && (
          <button type="button" className="text-link" onClick={() => { setQuery(""); setCategory("ทั้งหมด"); }}>ล้างตัวกรอง</button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="aspect-[3/4] animate-pulse bg-[var(--surface)]" />)}</div>
      ) : error ? (
        <div className="empty-state"><p>โหลดคลังนิยายไม่สำเร็จ</p><button type="button" className="button-secondary mt-4" onClick={() => void refetch()}>ลองใหม่</button></div>
      ) : filtered.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
          {filtered.map((novel) => <NovelCard key={novel.slug} novel={novel} />)}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={30} className="text-[var(--accent)]" />
          <h2 className="mt-4 font-display text-2xl">ยังไม่พบเรื่องที่ค้นหา</h2>
          <p className="mt-2 text-[var(--muted)]">ลองใช้คำค้นที่สั้นลง หรือเลือกดูทุกหมวด</p>
          <button type="button" className="button-secondary mt-5" onClick={() => { setQuery(""); setCategory("ทั้งหมด"); }}>ดูนิยายทั้งหมด</button>
        </div>
      )}
    </main>
  );
}

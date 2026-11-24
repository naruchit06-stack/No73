import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AudioLines, ChevronDown, Download, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useAuth } from "@/hooks/useAuth";

const links = [
  { to: "/", label: "หน้าแรก" },
  { to: "/library", label: "คลังนิยาย" },
  { to: "/#continue", label: "ฟังต่อ" },
];

export function SiteHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { canInstall, needsIosHint, install } = usePwaInstall();

  function handleInstall() {
    if (needsIosHint) {
      toast("บน iPhone/iPad: กดปุ่มแชร์ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”", { duration: 8000 });
      return;
    }
    void install();
  }

  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="site-header">
      <div className="page-shell flex h-[72px] items-center justify-between gap-4">
        <Link to="/" className="flex min-h-11 items-center gap-2 text-[var(--text)]" aria-label="No.73 หน้าแรก">
          <AudioLines className="text-[var(--accent)]" size={25} aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">No.73</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="เมนูหลัก">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive && link.to !== "/#continue" ? "active" : ""}`}>
              {link.label}
            </NavLink>
          ))}
          {user?.role === "admin" && <NavLink to="/admin" className="nav-link">หลังบ้าน</NavLink>}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {canInstall && (
            <button type="button" onClick={handleInstall} className="button-secondary flex items-center gap-2">
              <Download size={16} aria-hidden="true" /> ติดตั้งแอพ
            </button>
          )}
          {isAuthenticated ? (
            <details className="relative">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--line)] px-3 text-sm text-[var(--text)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] font-semibold text-[var(--accent-ink)]">
                  {(user?.name || "ผ").slice(0, 1)}
                </span>
                <span className="max-w-28 truncate">{user?.name || "ผู้ฟัง"}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-[52px] z-50 w-48 border border-[var(--line)] bg-[var(--surface-strong)] p-2 shadow-2xl">
                {user?.role === "admin" && <Link to="/admin" className="menu-item">จัดการหลังบ้าน</Link>}
                <button type="button" onClick={logout} className="menu-item flex w-full items-center gap-2 text-left">
                  <LogOut size={16} aria-hidden="true" /> ออกจากระบบ
                </button>
              </div>
            </details>
          ) : (
            <Link to="/login" className="button-secondary">เข้าสู่ระบบ</Link>
          )}
        </div>

        <button
          type="button"
          className="icon-button md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div id="mobile-menu" className={`mobile-menu md:hidden ${open ? "open" : ""}`} aria-hidden={!open}>
        <nav className="page-shell flex flex-col py-3" aria-label="เมนูมือถือ">
          {links.map((link) => <Link key={link.to} to={link.to} className="mobile-nav-link">{link.label}</Link>)}
          {user?.role === "admin" && <Link to="/admin" className="mobile-nav-link">จัดการหลังบ้าน</Link>}
          {canInstall && (
            <button type="button" onClick={handleInstall} className="mobile-nav-link flex items-center gap-2 text-left text-[var(--accent)]">
              <Download size={16} aria-hidden="true" /> ติดตั้งเป็นแอพบนเครื่อง
            </button>
          )}
          {isAuthenticated ? (
            <button type="button" onClick={logout} className="mobile-nav-link text-left">ออกจากระบบ ({user?.name || "ผู้ฟัง"})</button>
          ) : (
            <Link to="/login" className="mobile-nav-link text-[var(--accent)]">เข้าสู่ระบบเพื่อบันทึกการฟัง</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

import { useSearchParams } from "react-router";
import { AudioLines } from "lucide-react";

const ERRORS: Record<string, string> = {
  google: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง",
  state: "เซสชันล็อกอินหมดอายุ กรุณาลองอีกครั้ง",
  config: "ระบบล็อกอินยังตั้งค่าไม่ครบ กรุณาติดต่อผู้ดูแล",
};

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const [params] = useSearchParams();
  const error = params.get("error");

  return (
    <main className="page-shell flex min-h-[80dvh] items-center justify-center py-12">
      <div className="w-full max-w-sm border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
        <AudioLines className="mx-auto text-[var(--accent)]" size={34} aria-hidden="true" />
        <h1 className="mt-3 font-display text-3xl font-semibold">No.73</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">เข้าสู่ระบบเพื่อบันทึกตำแหน่งการฟังและฟังต่อได้ทุกอุปกรณ์</p>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--danger)]">{ERRORS[error] ?? ERRORS.google}</p>}
        <a
          href="/api/auth/google"
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-white px-4 text-sm font-medium text-[#1f1f1f] transition hover:bg-neutral-100"
        >
          <GoogleLogo /> เข้าสู่ระบบด้วย Google
        </a>
      </div>
    </main>
  );
}

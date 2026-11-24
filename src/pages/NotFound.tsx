import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="page-shell flex min-h-[75dvh] flex-col items-center justify-center text-center">
      <p className="font-display text-[clamp(6rem,20vw,12rem)] leading-none text-[var(--line-strong)]">404</p>
      <h1 className="mt-2 font-display text-3xl">หน้านี้หลงอยู่ในเรื่องอีกบท</h1>
      <p className="mt-3 text-[var(--muted)]">ลิงก์อาจไม่ถูกต้อง หรือหน้าที่คุณตามหาถูกย้ายไปแล้ว</p>
      <Link to="/" className="button-primary mt-7"><ArrowLeft size={18} /> กลับหน้าแรก</Link>
    </main>
  );
}

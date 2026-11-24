import { getDb } from "../api/queries/connection";
import { episodes, novels } from "./schema";
import { eq } from "drizzle-orm";

const audioSamples = [
  "https://download.samplelib.com/mp3/sample-15s.mp3",
  "https://download.samplelib.com/mp3/sample-12s.mp3",
  "https://download.samplelib.com/mp3/sample-9s.mp3",
  "https://download.samplelib.com/mp3/sample-6s.mp3",
];

const demoNovels = [
  {
    slug: "city-behind-the-mist",
    title: "เมืองหลังม่านหมอก",
    author: "อรุณ แสงจันทร์",
    category: "แฟนตาซี",
    featured: true,
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=900&q=85",
    description: "เมื่อหมอกปกคลุมเมืองเก่าเป็นคืนสุดท้าย นักแผนที่หนุ่มพบทางเข้าสู่อีกโลกที่มีกฎของตัวเอง เขาต้องออกเดินทางเพื่อหาคำตอบว่าทำไมเสียงของเขาจึงดังขึ้นในความทรงจำของคนแปลกหน้า",
    episodes: ["ผู้มาเยือนในราตรี", "แผนที่ที่ไม่มีถนน", "ประตูใต้สะพานหิน", "ชื่อที่ลืมไม่ลง"],
  },
  {
    slug: "letters-to-the-stars",
    title: "จดหมายถึงดวงดาว",
    author: "พิมพ์ชนก วรศิริ",
    category: "โรแมนติก",
    featured: true,
    coverUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85",
    description: "จดหมายที่ไม่มีผู้รับกลับได้รับคำตอบจากปลายทางที่อยู่ไกลเกินกว่าจะเดินทางไปถึง เรื่องราวของสองคนที่ค่อย ๆ เรียนรู้ความหมายของการรอคอยผ่านเสียงและตัวหนังสือ",
    episodes: ["แสงจากปลายฟ้า", "ตราประทับสีน้ำเงิน", "คืนที่ฝนไม่ตก", "คำตอบจากดวงดาว"],
  },
  {
    slug: "the-last-room-case",
    title: "คดีลับห้องสุดท้าย",
    author: "ธนกฤต อินทรสุข",
    category: "สืบสวน",
    featured: true,
    coverUrl: "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=900&q=85",
    description: "นักสืบสาวได้รับเทปเสียงปริศนาจากคดีที่ปิดไปแล้วสิบปี ทุกเสียงในห้องสุดท้ายกลายเป็นหลักฐาน แต่เสียงที่เธอคุ้นเคยที่สุดอาจทำให้คดีนี้ไม่เหมือนเดิมอีกต่อไป",
    episodes: ["เทปที่ไม่มีเจ้าของ", "รอยเท้าบนพื้นเปียก", "พยานหมายเลขศูนย์", "ห้องที่ไม่มีอยู่จริง"],
  },
  {
    slug: "house-without-shadow",
    title: "เสียงเรียกจากบ้านไร้เงา",
    author: "กมลวรรณ รัตนา",
    category: "สยองขวัญ",
    featured: false,
    coverUrl: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=900&q=85",
    description: "บ้านหลังเก่ากลางทุ่งนามีเงาของทุกสิ่ง ยกเว้นเงาของผู้ที่เคยอาศัยอยู่ เมื่อเสียงเรียกชื่อดังขึ้นตอนเที่ยงคืน ผู้มาเยือนต้องเลือกว่าจะตอบรับหรือเดินหนี",
    episodes: ["บ้านหลังที่สิบสาม", "เสียงใต้พื้นไม้", "อย่ามองหลังม่าน", "รุ่งเช้าที่ไม่มาถึง"],
  },
  {
    slug: "moon-code",
    title: "โค้ดเงาจันทร์",
    author: "ณัฐพล อนาคต",
    category: "ไซไฟ",
    featured: false,
    coverUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=900&q=85",
    description: "วิศวกรสื่อสารบนสถานีอวกาศรับรหัสที่ส่งมาจากอนาคตของตัวเอง เขามีเวลาเพียงไม่กี่วันเพื่อแกะข้อความก่อนที่วงโคจรของสถานีจะพาทุกคนเข้าสู่เงามืดของดวงจันทร์",
    episodes: ["สัญญาณนอกวงโคจร", "วินาทีที่หายไป", "เงาของโลก", "ผู้ส่งสารคนสุดท้าย"],
  },
  {
    slug: "yesterday-cafe",
    title: "ร้านกาแฟวันวาน",
    author: "ศิริพร ใจดี",
    category: "ชีวิต",
    featured: false,
    coverUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85",
    description: "ร้านกาแฟเล็ก ๆ ที่เปิดเฉพาะวันที่ใครบางคนอยากย้อนกลับไปพบความทรงจำ ทุกถ้วยมาพร้อมเรื่องเล่าของผู้คนที่เคยนั่งอยู่ตรงเก้าอี้ตัวเดิม",
    episodes: ["ถ้วยแรกของฤดูฝน", "เก้าอี้ริมหน้าต่าง", "คนที่มาสายเสมอ", "กลิ่นกาแฟวันสุดท้าย"],
  },
];

async function seed() {
  const db = getDb();
  console.log("Seeding demo library...");
  for (const item of demoNovels) {
    await db.insert(novels).values(item).onDuplicateKeyUpdate({
      set: {
        title: item.title,
        author: item.author,
        category: item.category,
        featured: item.featured,
        coverUrl: item.coverUrl,
        description: item.description,
      },
    });
    const [novel] = await db.select().from(novels).where(eq(novels.slug, item.slug)).limit(1);
    for (const [index, title] of item.episodes.entries()) {
      const audioUrl = audioSamples[index % audioSamples.length];
      await db.insert(episodes).values({
        novelId: novel.id,
        number: index + 1,
        title,
        duration: [15, 12, 9, 6][index % 4],
        audioUrl,
      }).onDuplicateKeyUpdate({ set: { title, audioUrl } });
    }
  }
  console.log("Seeded 6 novels and 24 episodes.");
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

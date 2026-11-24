import { and, asc, desc, eq, sql } from "drizzle-orm";
import { paymentRequests, settings, users } from "@db/schema";
import type { User } from "@db/schema";
import { getDb } from "./connection";

export const settingKeys = ["paymentsEnabled", "priceLabel", "memberDays", "qrKey", "qrUrl"] as const;
export type SettingKey = (typeof settingKeys)[number];

const settingDefaults: Record<SettingKey, string> = {
  paymentsEnabled: "0",
  priceLabel: "",
  memberDays: "30",
  qrKey: "",
  qrUrl: "",
};

export type MembershipSettings = {
  paymentsEnabled: boolean;
  priceLabel: string;
  memberDays: number;
  qrKey: string;
  qrUrl: string;
};

export async function readMembershipSettings(): Promise<MembershipSettings> {
  const rows = await getDb().select().from(settings);
  const values: Record<string, string> = { ...settingDefaults };
  for (const row of rows) {
    if (row.value !== null && row.key in settingDefaults) values[row.key] = row.value;
  }
  const days = Math.floor(Number(values.memberDays));
  return {
    paymentsEnabled: values.paymentsEnabled === "1",
    priceLabel: values.priceLabel,
    memberDays: Number.isFinite(days) && days > 0 ? days : 30,
    qrKey: values.qrKey,
    qrUrl: values.qrUrl,
  };
}

export async function writeMembershipSettings(entries: Partial<Record<SettingKey, string>>) {
  const db = getDb();
  for (const key of settingKeys) {
    const value = entries[key];
    if (value === undefined) continue;
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }
}

export function isMemberActive(user: Pick<User, "memberUntil"> | null | undefined) {
  if (!user?.memberUntil) return false;
  return new Date(user.memberUntil).getTime() > Date.now();
}

export function canPlayPremium(user: Pick<User, "role" | "memberUntil"> | null | undefined) {
  if (!user) return false;
  return user.role === "admin" || isMemberActive(user);
}

export function membershipDaysLeft(user: Pick<User, "memberUntil"> | null | undefined) {
  if (!user?.memberUntil) return 0;
  const left = new Date(user.memberUntil).getTime() - Date.now();
  return left > 0 ? Math.ceil(left / 86_400_000) : 0;
}

export async function findUserById(userId: number) {
  const [row] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function extendMembership(userId: number, days: number) {
  const db = getDb();
  const user = await findUserById(userId);
  if (!user) return null;
  const now = Date.now();
  const base = user.memberUntil ? Math.max(now, new Date(user.memberUntil).getTime()) : now;
  const memberUntil = new Date(base + days * 86_400_000);
  await db.update(users).set({ memberUntil }).where(eq(users.id, userId));
  return memberUntil;
}

export async function findPendingRequest(userId: number) {
  const [row] = await getDb()
    .select()
    .from(paymentRequests)
    .where(and(eq(paymentRequests.userId, userId), eq(paymentRequests.status, "pending")))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(1);
  return row ?? null;
}

export async function createPaymentRequest(userId: number, amount: number, note: string) {
  const [created] = await getDb()
    .insert(paymentRequests)
    .values({ userId, amount, note: note.slice(0, 500), status: "pending" })
    .$returningId();
  return created.id;
}

export async function listMyRequests(userId: number) {
  const rows = await getDb()
    .select({
      id: paymentRequests.id,
      amount: paymentRequests.amount,
      note: paymentRequests.note,
      status: paymentRequests.status,
      createdAt: paymentRequests.createdAt,
      reviewedAt: paymentRequests.reviewedAt,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.userId, userId))
    .orderBy(desc(paymentRequests.createdAt))
    .limit(50);
  return rows;
}

export async function listPendingPayments() {
  return getDb()
    .select({
      id: paymentRequests.id,
      userId: paymentRequests.userId,
      amount: paymentRequests.amount,
      note: paymentRequests.note,
      createdAt: paymentRequests.createdAt,
      userName: users.name,
      userEmail: users.email,
      memberUntil: users.memberUntil,
    })
    .from(paymentRequests)
    .innerJoin(users, eq(paymentRequests.userId, users.id))
    .where(eq(paymentRequests.status, "pending"))
    .orderBy(asc(paymentRequests.createdAt))
    .limit(100);
}

export async function listRecentSignups(limit: number) {
  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      role: users.role,
      memberUntil: users.memberUntil,
      notifiedSignup: users.notifiedSignup,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    memberUntil: row.memberUntil,
    createdAt: row.createdAt,
    unread: !row.notifiedSignup,
  }));
}

export async function markSignupsSeen() {
  await getDb().update(users).set({ notifiedSignup: true }).where(eq(users.notifiedSignup, false));
  return { ok: true };
}

async function countRows(query: PromiseLike<{ total: number }[]>) {
  const [row] = await query;
  return Number(row?.total ?? 0);
}

export async function membershipStats() {
  const db = getDb();
  const [pendingCount, unreadSignups, memberCount] = await Promise.all([
    countRows(
      db
        .select({ total: sql<number>`count(*)` })
        .from(paymentRequests)
        .where(eq(paymentRequests.status, "pending")),
    ),
    countRows(
      db
        .select({ total: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.notifiedSignup, false)),
    ),
    countRows(
      db
        .select({ total: sql<number>`count(*)` })
        .from(users)
        .where(sql`${users.memberUntil} > now()`),
    ),
  ]);
  return { pendingCount, unreadSignups, memberCount };
}

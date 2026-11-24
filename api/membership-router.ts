import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, adminQuery, authedQuery, publicQuery } from "./middleware";
import {
  canPlayPremium,
  createPaymentRequest,
  extendMembership,
  findPendingRequest,
  isMemberActive,
  listMyRequests,
  listPendingPayments,
  listRecentSignups,
  markSignupsSeen,
  membershipStats,
  readMembershipSettings,
  writeMembershipSettings,
} from "./queries/membership";
import { getDb } from "./queries/connection";
import { episodes, paymentRequests } from "@db/schema";
import { storage } from "./lib/storage";

async function resolveQrUrl(config: Awaited<ReturnType<typeof readMembershipSettings>>) {
  if (config.qrKey) {
    try {
      const signed = await storage.getPresignedUrl({ key: config.qrKey });
      return signed.url;
    } catch {
      return config.qrUrl || null;
    }
  }
  return config.qrUrl || null;
}

async function membershipSettingsPayload() {
  const config = await readMembershipSettings();
  return {
    paymentsEnabled: config.paymentsEnabled,
    priceLabel: config.priceLabel,
    memberDays: config.memberDays,
    qrUrl: await resolveQrUrl(config),
  };
}

export const membershipRouter = createRouter({
  info: publicQuery.query(async ({ ctx }) => {
    const config = await readMembershipSettings();
    const user = ctx.user;
    const pending = user ? await findPendingRequest(user.id) : null;
    return {
      paymentsEnabled: config.paymentsEnabled,
      priceLabel: config.priceLabel,
      memberDays: config.memberDays,
      qrUrl: await resolveQrUrl(config),
      memberUntil: user?.memberUntil ?? null,
      isMember: isMemberActive(user ?? null),
      canPlayPremium: canPlayPremium(user ?? null),
      pendingRequest: pending
        ? {
            id: pending.id,
            amount: pending.amount,
            note: pending.note,
            status: pending.status,
            createdAt: pending.createdAt,
          }
        : null,
    };
  }),

  submitPayment: authedQuery
    .input(
      z.object({
        amount: z.number().int().min(1).max(1_000_000),
        note: z.string().trim().max(500).optional().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const config = await readMembershipSettings();
      if (!config.paymentsEnabled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ระบบสมาชิกยังไม่เปิดให้แจ้งโอน" });
      }
      const existing = await findPendingRequest(ctx.user.id);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "PAYMENT_PENDING" });
      }
      const requestId = await createPaymentRequest(ctx.user.id, input.amount, input.note);
      return { id: requestId, status: "pending" as const };
    }),

  myRequests: authedQuery.query(({ ctx }) => listMyRequests(ctx.user.id)),
});

export const adminMembershipProcedures = {
  listEpisodesForAdmin: adminQuery
    .input(z.object({ novelId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({
          id: episodes.id,
          novelId: episodes.novelId,
          number: episodes.number,
          title: episodes.title,
          duration: episodes.duration,
          isPremium: episodes.isPremium,
          hasAudio: episodes.audioKey,
        })
        .from(episodes)
        .where(eq(episodes.novelId, input.novelId))
        .orderBy(asc(episodes.number));
      return rows.map((row) => ({
        id: row.id,
        novelId: row.novelId,
        number: row.number,
        title: row.title,
        duration: row.duration,
        isPremium: row.isPremium,
        hasAudio: Boolean(row.hasAudio),
      }));
    }),

  setEpisodePremium: adminQuery
    .input(z.object({ episodeId: z.number().int().positive(), isPremium: z.boolean() }))
    .mutation(async ({ input }) => {
      const [result] = await getDb()
        .update(episodes)
        .set({ isPremium: input.isPremium })
        .where(eq(episodes.id, input.episodeId));
      if (!result.affectedRows) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบตอนนี้" });
      }
      return { ok: true };
    }),

  getMembershipSettings: adminQuery.query(() => membershipSettingsPayload()),

  updateMembershipSettings: adminQuery
    .input(
      z.object({
        paymentsEnabled: z.boolean().optional(),
        priceLabel: z.string().trim().max(120).optional(),
        memberDays: z.number().int().min(1).max(3650).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await writeMembershipSettings({
        ...(input.paymentsEnabled === undefined ? {} : { paymentsEnabled: input.paymentsEnabled ? "1" : "0" }),
        ...(input.priceLabel === undefined ? {} : { priceLabel: input.priceLabel }),
        ...(input.memberDays === undefined ? {} : { memberDays: String(input.memberDays) }),
      });
      return membershipSettingsPayload();
    }),

  setPaymentQr: adminQuery
    .input(
      z.object({
        fileName: z.string().min(1).max(180),
        contentType: z.string().min(1).max(100),
        contentBase64: z.string().min(1).max(8_000_000),
      }),
    )
    .mutation(async ({ input }) => {
      if (!input.contentType.startsWith("image/")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาเลือกไฟล์รูปภาพ" });
      }
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      if (!bytes.byteLength) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์ว่างเปล่า" });
      }
      if (bytes.byteLength > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "รูป QR ต้องไม่เกิน 5 MB" });
      }
      const previous = await readMembershipSettings();
      const rawExtension = input.fileName.includes(".") ? input.fileName.split(".").pop() : "";
      const extension = rawExtension?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `membership/qr/${crypto.randomUUID()}.${extension}`,
        contentType: input.contentType,
      });
      const signed = await storage.getPresignedUrl({ key: saved.key });
      await writeMembershipSettings({ qrKey: saved.key, qrUrl: signed.url });
      if (previous.qrKey && previous.qrKey !== saved.key) {
        await storage.deleteFile({ fileKey: previous.qrKey }).catch(() => undefined);
      }
      return { qrKey: saved.key, qrUrl: signed.url };
    }),

  clearPaymentQr: adminQuery.mutation(async () => {
    const previous = await readMembershipSettings();
    await writeMembershipSettings({ qrKey: "", qrUrl: "" });
    if (previous.qrKey) {
      await storage.deleteFile({ fileKey: previous.qrKey }).catch(() => undefined);
    }
    return { ok: true };
  }),

  pendingPayments: adminQuery.query(() => listPendingPayments()),

  decidePayment: adminQuery
    .input(
      z.object({
        requestId: z.number().int().positive(),
        action: z.enum(["approve", "reject"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [request] = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.id, input.requestId))
        .limit(1);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการแจ้งโอนนี้" });
      }
      if (request.status !== "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ได้รับการตรวจสอบแล้ว" });
      }
      const status = input.action === "approve" ? "approved" : "rejected";
      const [result] = await db
        .update(paymentRequests)
        .set({ status, reviewedBy: ctx.user.id, reviewedAt: new Date() })
        .where(and(eq(paymentRequests.id, input.requestId), eq(paymentRequests.status, "pending")));
      if (!result.affectedRows) {
        throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ได้รับการตรวจสอบแล้ว" });
      }
      if (status === "rejected") {
        return { status, memberUntil: null };
      }
      const config = await readMembershipSettings();
      const memberUntil = await extendMembership(request.userId, config.memberDays);
      return { status, memberUntil };
    }),

  recentSignups: adminQuery
    .input(z.object({ limit: z.number().int().min(1).max(100).optional().default(20) }).optional())
    .query(({ input }) => listRecentSignups(input?.limit ?? 20)),

  markSignupsSeen: adminQuery.mutation(() => markSignupsSeen()),

  membershipStats: adminQuery.query(() => membershipStats()),
};

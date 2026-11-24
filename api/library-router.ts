import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import {
  deleteEpisodeAndFile,
  deleteNovelAndFiles,
  findContinueListening,
  findNovelBySlug,
  findNovelWithEpisodes,
  findNovels,
  saveListeningPosition,
} from "./queries/library";
import { getDb } from "./queries/connection";
import { episodes, novels } from "@db/schema";
import { storage } from "./lib/storage";
import { canPlayPremium } from "./queries/membership";
import { adminMembershipProcedures } from "./membership-router";

const premiumAudioTtlSeconds = 300;

export const novelRouter = createRouter({
  list: publicQuery.query(() => findNovels()),
  detail: publicQuery
    .input(z.object({ slug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const result = await findNovelBySlug(input.slug, ctx.user?.id, canPlayPremium(ctx.user));
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบนิยายเรื่องนี้" });
      return result;
    }),
  getEpisodeAudio: authedQuery
    .input(z.object({ episodeId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const [episode] = await getDb()
        .select()
        .from(episodes)
        .where(eq(episodes.id, input.episodeId))
        .limit(1);
      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบตอนนี้" });
      if (episode.isPremium && !canPlayPremium(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "MEMBERS_ONLY" });
      }
      if (!episode.audioKey) {
        if (!episode.audioUrl) {
          throw new TRPCError({ code: "NOT_FOUND", message: "ตอนนี้ยังไม่มีไฟล์เสียง" });
        }
        return { url: episode.audioUrl, expiresInSeconds: null };
      }
      const signed = await storage.getPresignedUrl({
        key: episode.audioKey,
        expiresInSeconds: premiumAudioTtlSeconds,
      });
      return { url: signed.url, expiresInSeconds: premiumAudioTtlSeconds };
    }),
});

export const progressRouter = createRouter({
  list: authedQuery.query(({ ctx }) => findContinueListening(ctx.user.id, canPlayPremium(ctx.user))),
  save: authedQuery
    .input(
      z.object({
        episodeId: z.number().int().positive(),
        position: z.number().int().min(0).max(86400),
        duration: z.number().int().min(0).max(86400),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await saveListeningPosition(
        ctx.user.id,
        input.episodeId,
        input.position,
        input.duration,
      );
      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบตอนนี้" });
      return saved;
    }),
});

export const adminRouter = createRouter({
  ...adminMembershipProcedures,
  upload: adminQuery
    .input(
      z.object({
        kind: z.enum(["cover", "audio"]),
        fileName: z.string().min(1).max(180),
        contentType: z.string().min(1).max(100),
        contentBase64: z.string().min(1).max(45_000_000),
      }),
    )
    .mutation(async ({ input }) => {
      const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
      const maxBytes = input.kind === "audio" ? 30 * 1024 * 1024 : 5 * 1024 * 1024;
      if (bytes.byteLength > maxBytes) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "ไฟล์มีขนาดใหญ่เกินกำหนด" });
      }
      if (input.kind === "audio" && !input.contentType.startsWith("audio/")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาเลือกไฟล์เสียง" });
      }
      if (input.kind === "cover" && !input.contentType.startsWith("image/")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาเลือกไฟล์รูปภาพ" });
      }
      const rawExtension = input.fileName.includes(".") ? input.fileName.split(".").pop() : "";
      const extension = rawExtension?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
        (input.kind === "audio" ? "mp3" : "jpg");
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `novels/${input.kind === "audio" ? "audio" : "covers"}/${crypto.randomUUID()}.${extension}`,
        contentType: input.contentType,
      });
      return { key: saved.key, size: saved.size, contentType: saved.contentType };
    }),

  createNovel: adminQuery
    .input(
      z.object({
        title: z.string().trim().min(1).max(255),
        author: z.string().trim().min(1).max(255),
        category: z.string().trim().min(1).max(80),
        description: z.string().trim().min(10).max(5000),
        coverKey: z.string().max(512).optional(),
        featured: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const [{ id }] = await getDb()
        .insert(novels)
        .values({ ...input, slug, coverUrl: null })
        .$returningId();
      return { id, slug };
    }),

  addEpisode: adminQuery
    .input(
      z.object({
        novelId: z.number().int().positive(),
        number: z.number().int().positive().max(10000),
        title: z.string().trim().min(1).max(255),
        duration: z.number().int().min(0).max(86400),
        audioKey: z.string().min(1).max(512),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await findNovelWithEpisodes(input.novelId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบนิยาย" });
      if (result.episodes.some((episode) => episode.number === input.number)) {
        throw new TRPCError({ code: "CONFLICT", message: "เลขตอนนี้มีอยู่แล้ว" });
      }
      const [{ id }] = await getDb()
        .insert(episodes)
        .values({ ...input, audioUrl: null })
        .$returningId();
      return { id };
    }),

  updateCover: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        // null = remove the cover
        coverKey: z.string().min(1).max(512).startsWith("novels/covers/").nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [novel] = await db.select().from(novels).where(eq(novels.id, input.id)).limit(1);
      if (!novel) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบนิยาย" });
      await db
        .update(novels)
        .set({ coverKey: input.coverKey, coverUrl: null })
        .where(eq(novels.id, input.id));
      // Delete the previous file only after the DB points at the new one.
      if (novel.coverKey && novel.coverKey !== input.coverKey) {
        try {
          await storage.deleteFile({ fileKey: novel.coverKey });
        } catch {
          /* an orphaned old file is harmless */
        }
      }
      return { ok: true };
    }),

  deleteNovel: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const deleted = await deleteNovelAndFiles(input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  deleteEpisode: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const deleted = await deleteEpisodeAndFile(input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),
});

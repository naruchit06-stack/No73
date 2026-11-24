import { and, asc, desc, eq, sql } from "drizzle-orm";
import { episodes, listeningProgress, novels } from "@db/schema";
import { getDb } from "./connection";
import { storage } from "../lib/storage";

async function coverMap(keys: (string | null)[]) {
  const validKeys = keys.filter((key): key is string => Boolean(key));
  if (!validKeys.length) return new Map<string, string>();
  const result = await storage.getPresignedUrls({ keys: validKeys });
  return new Map(result.urls.map((item) => [item.key, item.url]));
}

export async function findNovels() {
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(novels).orderBy(desc(novels.featured), desc(novels.createdAt)),
    db
      .select({ novelId: episodes.novelId, count: sql<number>`count(*)` })
      .from(episodes)
      .groupBy(episodes.novelId),
  ]);
  const covers = await coverMap(rows.map((row) => row.coverKey));
  const countMap = new Map(counts.map((item) => [item.novelId, Number(item.count)]));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    category: row.category,
    description: row.description,
    coverUrl: row.coverKey ? (covers.get(row.coverKey) ?? null) : row.coverUrl,
    featured: row.featured,
    episodeCount: countMap.get(row.id) ?? 0,
    createdAt: row.createdAt,
  }));
}

export async function findNovelBySlug(slug: string, userId?: number, playPremium = false) {
  const db = getDb();
  const [novel] = await db.select().from(novels).where(eq(novels.slug, slug)).limit(1);
  if (!novel) return null;
  const episodeRows = await db
    .select()
    .from(episodes)
    .where(eq(episodes.novelId, novel.id))
    .orderBy(asc(episodes.number));

  const keys = episodeRows
    .filter((row) => !row.isPremium)
    .map((row) => row.audioKey)
    .filter((key): key is string => Boolean(key));
  const audioUrls = keys.length
    ? new Map((await storage.getPresignedUrls({ keys })).urls.map((item) => [item.key, item.url]))
    : new Map<string, string>();

  const progressRows = userId
    ? await db
        .select()
        .from(listeningProgress)
        .where(eq(listeningProgress.userId, userId))
    : [];
  const progressMap = new Map(progressRows.map((row) => [row.episodeId, row]));
  const covers = await coverMap([novel.coverKey]);

  return {
    novel: {
      id: novel.id,
      slug: novel.slug,
      title: novel.title,
      author: novel.author,
      category: novel.category,
      description: novel.description,
      coverUrl: novel.coverKey ? (covers.get(novel.coverKey) ?? null) : novel.coverUrl,
      featured: novel.featured,
      episodeCount: episodeRows.length,
      createdAt: novel.createdAt,
    },
    episodes: episodeRows.map((episode) => ({
      id: episode.id,
      novelId: episode.novelId,
      number: episode.number,
      title: episode.title,
      duration: episode.duration,
      isPremium: episode.isPremium,
      locked: episode.isPremium && !playPremium,
      audioUrl: episode.isPremium
        ? null
        : episode.audioKey
          ? (audioUrls.get(episode.audioKey) ?? null)
          : episode.audioUrl,
      progress: progressMap.get(episode.id)
        ? {
            position: progressMap.get(episode.id)!.position,
            duration: progressMap.get(episode.id)!.duration,
          }
        : null,
    })),
  };
}

export async function findContinueListening(userId: number, playPremium = false) {
  const db = getDb();
  const rows = await db
    .select({ progress: listeningProgress, episode: episodes, novel: novels })
    .from(listeningProgress)
    .innerJoin(episodes, eq(listeningProgress.episodeId, episodes.id))
    .innerJoin(novels, eq(episodes.novelId, novels.id))
    .where(eq(listeningProgress.userId, userId))
    .orderBy(desc(listeningProgress.updatedAt))
    .limit(12);
  const [covers, audio] = await Promise.all([
    coverMap(rows.map((row) => row.novel.coverKey)),
    (async () => {
      const keys = rows
        .filter((row) => !row.episode.isPremium)
        .map((row) => row.episode.audioKey)
        .filter((key): key is string => Boolean(key));
      if (!keys.length) return new Map<string, string>();
      const result = await storage.getPresignedUrls({ keys });
      return new Map(result.urls.map((item) => [item.key, item.url]));
    })(),
  ]);
  return rows.map((row) => ({
    episodeId: row.episode.id,
    novelSlug: row.novel.slug,
    novelTitle: row.novel.title,
    episodeNumber: row.episode.number,
    episodeTitle: row.episode.title,
    coverUrl: row.novel.coverKey ? (covers.get(row.novel.coverKey) ?? null) : row.novel.coverUrl,
    isPremium: row.episode.isPremium,
    locked: row.episode.isPremium && !playPremium,
    audioUrl: row.episode.isPremium
      ? null
      : row.episode.audioKey
        ? (audio.get(row.episode.audioKey) ?? null)
        : row.episode.audioUrl,
    position: row.progress.position,
    duration: row.progress.duration || row.episode.duration,
    updatedAt: row.progress.updatedAt,
  }));
}

export async function saveListeningPosition(
  userId: number,
  episodeId: number,
  position: number,
  duration: number,
) {
  const db = getDb();
  const [episode] = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1);
  if (!episode) return null;
  await db
    .insert(listeningProgress)
    .values({ userId, episodeId, position, duration })
    .onDuplicateKeyUpdate({ set: { position, duration, updatedAt: new Date() } });
  return { ok: true };
}

export async function findNovelWithEpisodes(novelId: number) {
  const db = getDb();
  const [novel] = await db.select().from(novels).where(eq(novels.id, novelId)).limit(1);
  if (!novel) return null;
  const episodeRows = await db
    .select()
    .from(episodes)
    .where(eq(episodes.novelId, novelId))
    .orderBy(asc(episodes.number));
  return { novel, episodes: episodeRows };
}

export async function deleteNovelAndFiles(novelId: number) {
  const db = getDb();
  const result = await findNovelWithEpisodes(novelId);
  if (!result) return false;
  const keys = [result.novel.coverKey, ...result.episodes.map((episode) => episode.audioKey)]
    .filter((key): key is string => Boolean(key));
  await db.delete(novels).where(eq(novels.id, novelId));
  if (keys.length) await storage.deleteFiles({ fileKeys: keys });
  return true;
}

export async function deleteEpisodeAndFile(episodeId: number) {
  const db = getDb();
  const [episode] = await db.select().from(episodes).where(eq(episodes.id, episodeId)).limit(1);
  if (!episode) return false;
  await db.delete(episodes).where(and(eq(episodes.id, episodeId), eq(episodes.novelId, episode.novelId)));
  if (episode.audioKey) await storage.deleteFile({ fileKey: episode.audioKey });
  return true;
}

/**
 * storage.ts — S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2,
 * MinIO, DigitalOcean Spaces, ...).
 *
 * The bucket stays PRIVATE: the database stores only object keys, and the site hands
 * the browser short-lived presigned GET URLs (never store URLs — they expire).
 *
 * Env:
 *   S3_BUCKET             required
 *   S3_ACCESS_KEY_ID      required
 *   S3_SECRET_ACCESS_KEY  required
 *   S3_REGION             default "auto" (R2) — use e.g. "ap-southeast-1" on AWS
 *   S3_ENDPOINT           omit for AWS S3; e.g. https://<account>.r2.cloudflarestorage.com
 *   S3_FORCE_PATH_STYLE   "true" for MinIO and some providers
 *   S3_URL_TTL_SECONDS    presigned URL lifetime, default 43200 (12 h)
 */
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageErrorCode = "STORAGE_NOT_CONFIGURED" | "STORAGE_INVALID_INPUT" | "STORAGE_UPSTREAM_ERROR";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export interface UploadFileInput {
  fileContent: Uint8Array | string;
  /** Object key, e.g. "novels/covers/<uuid>.jpg". Same key overwrites. */
  fileName: string;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  size: number;
  contentType: string;
}

const MAX_DELETE_BATCH = 1000;

function assertValidKey(key: string): void {
  const bytes = new TextEncoder().encode(key).length;
  if (!key || bytes > 1024 || key.startsWith("/") || key.includes("//") || key.includes("\\") || key.split("/").includes("..")) {
    throw new StorageError("STORAGE_INVALID_INPUT", `Invalid object key: ${key.slice(0, 80)}`);
  }
}

export class Storage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttl: number;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new StorageError(
        "STORAGE_NOT_CONFIGURED",
        "ยังไม่ได้ตั้งค่าที่เก็บไฟล์: ต้องมี S3_BUCKET, S3_ACCESS_KEY_ID และ S3_SECRET_ACCESS_KEY ใน .env",
      );
    }
    this.bucket = bucket;
    this.ttl = Math.min(Math.max(Number(process.env.S3_URL_TTL_SECONDS) || 43200, 60), 7 * 24 * 3600);
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
      // Newer SDK versions add checksum params that R2/B2/MinIO may reject.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async uploadFile(input: UploadFileInput): Promise<UploadResult> {
    assertValidKey(input.fileName);
    const body = typeof input.fileContent === "string" ? new TextEncoder().encode(input.fileContent) : input.fileContent;
    if (body.byteLength === 0) throw new StorageError("STORAGE_INVALID_INPUT", "ไฟล์ว่างเปล่า");
    const contentType = input.contentType || "application/octet-stream";
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.fileName,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      );
    } catch (error) {
      throw new StorageError("STORAGE_UPSTREAM_ERROR", `อัปโหลดไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { key: input.fileName, size: body.byteLength, contentType };
  }

  async getPresignedUrl(input: { key: string; download?: boolean; expiresInSeconds?: number }): Promise<{ key: string; url: string }> {
    assertValidKey(input.key);
    const expiresIn = input.expiresInSeconds
      ? Math.min(Math.max(Math.floor(input.expiresInSeconds), 15), this.ttl)
      : this.ttl;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: input.key }),
      { expiresIn },
    );
    return { key: input.key, url };
  }

  /** Signing is local (no network call), so this is cheap even for many keys. */
  async getPresignedUrls(input: { keys: string[] }): Promise<{
    urls: { key: string; url: string }[];
    failures: { key: string; message: string }[];
  }> {
    const urls: { key: string; url: string }[] = [];
    const failures: { key: string; message: string }[] = [];
    await Promise.all(
      [...new Set(input.keys)].map(async (key) => {
        try {
          urls.push(await this.getPresignedUrl({ key }));
        } catch (error) {
          failures.push({ key, message: error instanceof Error ? error.message : String(error) });
        }
      }),
    );
    return { urls, failures };
  }

  /** Idempotent: deleting a missing key succeeds. */
  async deleteFile(input: { fileKey: string }): Promise<boolean> {
    assertValidKey(input.fileKey);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: input.fileKey }));
    } catch (error) {
      throw new StorageError("STORAGE_UPSTREAM_ERROR", `ลบไฟล์ไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
  }

  async deleteFiles(input: { fileKeys: string[] }): Promise<{ deleted: string[]; failed: { key: string; message: string }[] }> {
    const keys = [...new Set(input.fileKeys)];
    keys.forEach(assertValidKey);
    const deleted: string[] = [];
    const failed: { key: string; message: string }[] = [];
    for (let i = 0; i < keys.length; i += MAX_DELETE_BATCH) {
      const batch = keys.slice(i, i + MAX_DELETE_BATCH);
      try {
        const res = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
          }),
        );
        deleted.push(...(res.Deleted ?? []).map((item) => item.Key ?? "").filter(Boolean));
        failed.push(...(res.Errors ?? []).map((item) => ({ key: item.Key ?? "", message: item.Message ?? "unknown" })));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push(...batch.map((key) => ({ key, message })));
      }
    }
    return { deleted, failed };
  }
}

/** Lazy singleton: importing this file never fails if storage is not configured yet. */
let instance: Storage | undefined;
export const storage: Storage = new Proxy({} as Storage, {
  get(_target, prop) {
    instance ??= new Storage();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageProvider } from "@/lib/env";
import { sanitizeFileName } from "@/lib/security";

const LOCAL_STORAGE_ROOT = path.join(process.cwd(), "storage", "protected");
const legacyPublicRoot = path.join(process.cwd(), "public");
const signedUrlSecret = process.env.AUTH_SECRET ?? "development-only-change-me";

type StoredFileInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "auto",
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
    credentials: process.env.STORAGE_ACCESS_KEY && process.env.STORAGE_SECRET_KEY ? {
      accessKeyId: process.env.STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.STORAGE_SECRET_KEY
    } : undefined
  });
}

export function getProtectedStoragePath(storageKey: string) {
  return path.join(LOCAL_STORAGE_ROOT, storageKey);
}

export async function storeProtectedFile(input: StoredFileInput) {
  const provider = getStorageProvider();
  const key = `uploads/${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  if (provider === "local") {
    const absolutePath = getProtectedStoragePath(key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, input.buffer);
    return { storageKey: key, storageProvider: "local", checksum };
  }

  if (!process.env.STORAGE_BUCKET) {
    throw new Error("Cloud storage bucket is not configured.");
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType
    })
  );
  return { storageKey: key, storageProvider: provider, checksum };
}

export async function resolveDocumentPath(storageKey: string) {
  const localPath = getProtectedStoragePath(storageKey);
  try {
    await fs.access(localPath);
    return localPath;
  } catch {
    return path.join(legacyPublicRoot, storageKey);
  }
}

export function createSignedDocumentToken(documentId: string, userId: string, expiresAt: number) {
  const payload = `${documentId}:${userId}:${expiresAt}`;
  const signature = createHmac("sha256", signedUrlSecret).update(payload).digest("hex");
  return `${expiresAt}.${signature}`;
}

export function verifySignedDocumentToken(documentId: string, userId: string, token: string) {
  const [expiresAtValue, signature] = token.split(".");
  const expiresAt = Number.parseInt(expiresAtValue ?? "", 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false;
  const expected = createSignedDocumentToken(documentId, userId, expiresAt).split(".")[1];
  return signature === expected;
}

export async function getSignedDocumentUrl(storageKey: string, expiresInSeconds = 300) {
  const provider = getStorageProvider();
  if (provider === "local") {
    return null;
  }
  if (!process.env.STORAGE_BUCKET) {
    throw new Error("Cloud storage bucket is not configured.");
  }
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: storageKey
    }),
    { expiresIn: expiresInSeconds }
  );
}

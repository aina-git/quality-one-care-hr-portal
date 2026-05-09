import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lightweight liveness + readiness probe for Railway. Returns 200 with a
// small status payload when the app is up AND can reach Postgres. Returns
// 503 with the failing component when Postgres is unreachable so Railway's
// auto-restart can kick in instead of black-boxing a stuck process.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let dbError: string | null = null;

  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ok = dbOk;
  const body = {
    status: ok ? "ok" : "degraded",
    ts: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    db: { ok: dbOk, latencyMs: dbLatencyMs, error: dbError },
    totalLatencyMs: Date.now() - start,
  };
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}

"use client";

import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-lg rounded-3xl border border-orange-100 bg-white/95 p-8 shadow-2xl">
        <p className="inline-flex rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">Admin Console</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">This page hit a snag.</h1>
        <p className="mt-2 text-sm text-slate-700">
          The full error has been logged. Retry, jump to the admin dashboard, or check the audit log.
        </p>
        {error?.message && (
          <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-slate-700">Technical details</summary>
            <p className="mt-2 break-words font-mono text-slate-600">{error.message}</p>
          </details>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}><RotateCw size={16} /> Try again</Button>
          <Button asChild variant="outline"><Link href="/admin/dashboard"><ArrowLeft size={16} /> Admin dashboard</Link></Button>
        </div>
      </div>
    </main>
  );
}

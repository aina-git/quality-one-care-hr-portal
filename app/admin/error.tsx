"use client";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-orange-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-orange-600">Admin Console</p>
        <h1 className="mt-2 text-2xl font-semibold">This admin page could not be loaded.</h1>
        <p className="mt-2 text-sm text-muted-foreground">The request was logged with safe error details. Retry when you are ready.</p>
        <Button type="button" className="mt-4" onClick={reset}>Retry</Button>
      </div>
    </main>
  );
}

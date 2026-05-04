"use client";

import { Button } from "@/components/ui/button";

export default function ApplicantError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-lg border border-orange-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-orange-600">Applicant Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">We could not load this page right now.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again in a moment. If the issue continues, contact Quality One Care HR support.</p>
        <Button type="button" className="mt-4" onClick={reset}>Retry</Button>
      </div>
    </main>
  );
}

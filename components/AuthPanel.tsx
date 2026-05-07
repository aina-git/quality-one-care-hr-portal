import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AuthPanel({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: { label: string; href: string; action: string };
}) {
  return (
    <main className="medical-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative background */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-300/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" aria-hidden />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_minmax(420px,560px)] lg:items-center">
        {/* Brand panel — desktop only */}
        <div className="hidden flex-col gap-6 px-6 lg:flex">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-orange-700 shadow-sm">
              Quality One Care
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              We Care with <span className="text-orange-600">Golden Hands.</span>
            </h1>
            <p className="mt-3 text-base text-slate-700">
              Maryland home health for pediatric and adult patients. This is the secure portal where applicants apply, HR reviews credentials, and the Director of Nursing approves new hires.
            </p>
          </div>
          <ul className="grid gap-3 text-sm text-slate-700">
            <li className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>Your information is private — only Quality One Care HR / DON / Admin can see it.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>Save and continue any time — your progress saves automatically.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>Need help? Email <span className="font-medium text-orange-700">info@qualityonecare.com</span> or call <span className="font-medium text-orange-700">(301) 658-7141</span>.</span>
            </li>
          </ul>
        </div>

        {/* Auth card */}
        <div className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <div className="mb-6">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700 lg:hidden">
              Quality One Care
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
          {children}
          <p className="mt-6 text-center text-sm text-slate-600">
            {footer.label}{" "}
            <Link href={footer.href} className="font-semibold text-orange-700 hover:text-orange-800 hover:underline">
              {footer.action}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

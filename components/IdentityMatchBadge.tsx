"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

type Snapshot = {
  name: string | null;
  address: string | null;
  dateOfBirth: string | null;
  licenseNumber: string | null;
  licenseType: string | null;
  sourceFileName: string | null;
};

type Props = {
  /** The address the user is currently typing */
  currentAddress: string;
  /** The full name on the applicant's account */
  applicantName: string;
};

function normalize(value: string): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyContains(haystack: string, needle: string): boolean {
  const a = normalize(haystack);
  const b = normalize(needle);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function nameMatches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

/**
 * Real-time identity check. Pulls the latest extracted name + address off
 * the applicant's uploaded ID/driver's license, then compares against what
 * they're typing now (currentAddress) and the name on their account.
 *
 * States:
 *   - hidden — no ID document on file yet (silent — applicant may not have
 *     uploaded their ID at this point in the flow)
 *   - emerald check — both name and address match the document
 *   - amber warning — name OR address mismatch (with details)
 *   - blue info — fields too short to compare yet
 */
export function IdentityMatchBadge({ currentAddress, applicantName }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/applicant/identity-snapshot")
      .then(async (res) => res.ok ? (await res.json()) as Snapshot : null)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const status = useMemo(() => {
    if (!loaded || !snapshot) return null;
    if (!snapshot.address && !snapshot.name) return null; // No ID on file
    const trimmedAddress = (currentAddress ?? "").trim();
    if (trimmedAddress.length < 6) return null; // Not enough to compare
    const addressOk = snapshot.address ? fuzzyContains(snapshot.address, trimmedAddress) || fuzzyContains(trimmedAddress, snapshot.address) : null;
    const nameOk = snapshot.name && applicantName ? nameMatches(applicantName, snapshot.name) : null;

    return {
      addressOk,
      nameOk,
      docAddress: snapshot.address,
      docName: snapshot.name,
      sourceFile: snapshot.sourceFileName
    };
  }, [loaded, snapshot, currentAddress, applicantName]);

  if (!status) return null;
  const allGood = status.addressOk !== false && status.nameOk !== false && (status.addressOk === true || status.nameOk === true);
  const anyMismatch = status.addressOk === false || status.nameOk === false;

  if (allGood) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="font-medium">Matches your driver&apos;s license</p>
          {status.sourceFile && <p className="text-emerald-800/80">Confirmed against <span className="font-mono">{status.sourceFile}</span></p>}
        </div>
      </div>
    );
  }

  if (anyMismatch) {
    return (
      <div className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Heads up — this doesn&apos;t fully match your driver&apos;s license</p>
            <ul className="mt-1 grid gap-0.5">
              {status.nameOk === false && status.docName && (
                <li>• Name on document: <span className="font-mono">{status.docName}</span> · on account: <span className="font-mono">{applicantName}</span></li>
              )}
              {status.addressOk === false && status.docAddress && (
                <li>• Address on document: <span className="font-mono">{status.docAddress}</span></li>
              )}
            </ul>
            <p className="mt-1.5 text-[11px] italic text-amber-800">If your driver&apos;s license shows a different address, use the address that matches it. HR will see this flag during verification.</p>
          </div>
        </div>
      </div>
    );
  }

  // Some fields couldn't be compared yet but at least one matched.
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
      <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-blue-600" />
      <p>Comparing against your uploaded ID…</p>
    </div>
  );
}

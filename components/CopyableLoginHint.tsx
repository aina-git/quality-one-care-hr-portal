"use client";

import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";

type Props = {
  email: string;
  label?: string;
};

export function CopyableLoginHint({ email, label = "Sign in with" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <span className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
      <KeyRound size={11} className="text-amber-700" />
      <span>{label}</span>
      <span className="font-mono text-amber-950">{email}</span>
      <button
        type="button"
        onClick={copy}
        className="ml-0.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 hover:bg-amber-200"
        title="Copy login email"
      >
        <Copy size={10} /> {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const categories = [
  "Application Form",
  "Resume",
  "License",
  "CPR Certificate",
  "ID or Work Authorization",
  "Annual Physical",
  "TB Test or Chest X-ray",
  "Training Certificate",
  "Reference Document",
  "Background Check",
  "NSO Insurance",
  "Other Supporting Document"
];

const modeDefaults = {
  paper: "Application Form",
  supporting_documents: "Resume",
  digital: "Resume"
};

export function QuickCredentialUploadForm({
  intakeMode = "supporting_documents"
}: {
  intakeMode?: "paper" | "supporting_documents" | "digital";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [category, setCategory] = useState(modeDefaults[intakeMode]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = formRef.current;
    if (!form) {
      setMessage("Upload form is not ready. Please refresh and try again.");
      return;
    }

    try {
      setBusy(true);
      const formData = new FormData(form);
      formData.set("category", category);
      formData.set("intakeMode", intakeMode);
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: getCsrfHeaders(),
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "Upload failed. Please try again.");
        return;
      }
      setMessage("Document uploaded and processed for review.");
      formRef.current?.reset();
      router.refresh();
    } catch {
      setMessage("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="qoc-card grid gap-4 rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
        <FileUp className="mt-0.5 h-5 w-5 text-blue-700" />
        <div>
          <p className="font-semibold">Unified Document Intake Engine</p>
          <p className="mt-1">Uploaded files are classified, organized, and routed into the same applicant profile and HR workflow.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)_auto]">
        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-md border bg-white px-3 text-sm">
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="h-11 rounded-md border bg-white px-3 py-2 text-sm" />
        <Button type="submit" disabled={busy}><UploadCloud size={16} /> {busy ? "Uploading..." : "Upload"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Accepted files: PDF, PNG, JPG, JPEG, DOCX. Maximum size: 10MB.</p>
      {message ? <p className="text-sm font-medium text-orange-700">{message}</p> : null}
    </form>
  );
}

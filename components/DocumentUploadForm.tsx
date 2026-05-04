"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/lib/csrf-client";

const categories = [
  "Resume",
  "Scanned Application Form",
  "License",
  "CPR Certificate",
  "Training Certificate",
  "Reference Document",
  "Other Supporting Document"
];

export function DocumentUploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
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
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-[220px_1fr_auto]">
        <select name="category" className="h-10 rounded-md border bg-white px-3 text-sm">
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <input
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="rounded-md border bg-white px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={busy}>
          <Upload size={16} /> {busy ? "Processing..." : "Upload"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Accepted: PDF, PNG, JPG, JPEG, DOCX. Maximum size: 10MB.</p>
      {message && <p className="text-sm text-orange-700">{message}</p>}
    </form>
  );
}

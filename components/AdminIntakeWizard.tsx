"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, FileText, Send, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCsrfHeaders } from "@/lib/csrf-client";

const documentCategories = [
  "Application Form",
  "Licenses & Background",
  "IDs / SSN / Passport",
  "Resume & Cover Letter",
  "Combined Package",
  "Other Supporting Document"
];

type Created = {
  application: { id: string; status: string };
  user: { id: string; email: string; name: string | null };
};

type UploadedDoc = {
  id: string;
  fileName: string;
  documentType: string;
  status: "uploading" | "processing" | "ready" | "failed";
  message?: string;
};

export function AdminIntakeWizard() {
  // Stage 1 form state
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailIsTemporary, setEmailIsTemporary] = useState(false);
  const [phoneIsTemporary, setPhoneIsTemporary] = useState(false);
  const [desiredRole, setDesiredRole] = useState("Home Health Care");
  const [tempPassword, setTempPassword] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [createMessage, setCreateMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Stage 2 upload state
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [uploadCategory, setUploadCategory] = useState(documentCategories[0]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  async function createApplicant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateMessage("");
    const response = await fetch("/api/admin/applications", {
      method: "POST",
      headers: getCsrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email, name, desiredRole, tempPassword, phone, emailIsTemporary, phoneIsTemporary, intakeMode: "paper_intake" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCreateMessage(payload.error ?? "Could not create application.");
      setCreating(false);
      return;
    }
    setCreated(payload as Created);
    setCreateMessage("");
    setCreating(false);
  }

  async function uploadDoc(file: File) {
    if (!created) return;
    const tempKey = `pending-${Date.now()}-${file.name}`;
    setDocs((prev) => [...prev, { id: tempKey, fileName: file.name, documentType: uploadCategory, status: "uploading" }]);
    const body = new FormData();
    body.append("file", file);
    body.append("category", uploadCategory);
    const response = await fetch(`/api/admin/applications/${created.application.id}/upload`, {
      method: "POST",
      headers: getCsrfHeaders(),
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDocs((prev) => prev.map((d) => d.id === tempKey ? { ...d, status: "failed", message: payload.error ?? "Upload failed." } : d));
      return;
    }
    const doc = payload.document;
    setDocs((prev) => prev.map((d) => d.id === tempKey ? {
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      status: "ready"
    } : d));
  }

  async function submitForReview() {
    if (!created) return;
    setSubmitting(true);
    setSubmitMessage("");
    const response = await fetch(`/api/admin/applications/${created.application.id}/submit`, {
      method: "POST",
      headers: getCsrfHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSubmitMessage(payload.error ?? "Could not submit for review.");
      setSubmitting(false);
      return;
    }
    setSubmittedAt(new Date().toLocaleString("en-US"));
    setSubmitting(false);
  }

  if (submittedAt && created) {
    return (
      <div className="grid gap-5">
        <Card className="border-2 border-emerald-300">
          <CardContent className="p-6 grid gap-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={22} />
              <p className="text-lg font-semibold">Submitted for HR review</p>
            </div>
            <p className="text-sm text-slate-700">
              {created.user.name ?? created.user.email}'s application has been routed into the HR Review Queue.
              You can now open the review screen to walk through documents, AI findings, and forward to DON approval.
            </p>
            <p className="text-xs text-slate-500">Submitted {submittedAt}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild>
                <Link href={`/admin/applications/${created.application.id}/review`}>Open the review screen</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/hr-review-queue">Open HR Review Queue</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/admin/applications/new">Intake another application</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus size={20} className="text-orange-600" />
            Intake a paper application
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid gap-3 text-sm text-slate-700">
          <p>
            Use this page when an existing nurse hands in a paper or scanned application and will not register online themselves.
            You will create a thin applicant account, upload their scanned documents, and route the application into the HR Review Queue.
            The AI / OCR pipeline runs the same way it does for self-service applicants.
          </p>
        </CardContent>
      </Card>

      <Card className={created ? "opacity-70" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">1</span>
            Applicant identity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {created ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">{created.user.name ?? created.user.email}</p>
              <p className="text-xs">Application id <code className="bg-white px-1 rounded">{created.application.id}</code> — status <code className="bg-white px-1 rounded">{created.application.status}</code></p>
            </div>
          ) : (
            <form onSubmit={createApplicant} className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5 md:col-span-2">
                <Label htmlFor="name">Applicant full name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jatta Fatmata" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">Applicant email <span className="text-xs text-slate-500">(use placeholder if not yet known)</span></Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="applicant@example.com or placeholder@qoc.local" />
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <input type="checkbox" checked={emailIsTemporary} onChange={(e) => setEmailIsTemporary(e.target.checked)} />
                  This is a temporary placeholder — prompt the applicant to confirm their real email later
                </label>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Applicant mobile <span className="text-xs text-slate-500">(any number works for now)</span></Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="555-123-4567" />
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <input type="checkbox" checked={phoneIsTemporary} onChange={(e) => setPhoneIsTemporary(e.target.checked)} />
                  This is a temporary placeholder — prompt the applicant to confirm their real phone later
                </label>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="desiredRole">Position applied for</Label>
                <Input id="desiredRole" value={desiredRole} onChange={(e) => setDesiredRole(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tempPassword">Temporary password (8+ chars)</Label>
                <Input id="tempPassword" type="text" required minLength={8} value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="A password the applicant can use later" />
              </div>
              {createMessage ? (
                <div role="alert" className="md:col-span-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {createMessage}
                </div>
              ) : null}
              <div className="md:col-span-2">
                <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create applicant + application"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {created && !submittedAt ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">2</span>
              Upload paper documents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid gap-3">
            <p className="text-sm text-slate-700">
              Upload each scanned PDF or photo. The AI will OCR handwriting, extract dates, and flag mismatches. You can upload multiple files; do one category at a time.
              Supported: PDF, PNG, JPG, JPEG, DOCX. Max 10 MB each.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="uploadCategory">Document type for the next upload</Label>
                <select
                  id="uploadCategory"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="h-10 rounded-md border bg-white px-3 text-sm"
                >
                  {documentCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-white px-4 py-2 text-sm font-medium hover:bg-orange-50 hover:text-orange-700">
                <Upload size={16} /> Choose file
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void uploadDoc(f);
                  }}
                />
              </label>
            </div>

            {docs.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No documents uploaded yet.</p>
            ) : (
              <div className="grid gap-2">
                {docs.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <FileText size={16} className="text-slate-500" />
                    <span className="font-medium">{d.fileName}</span>
                    <span className="text-xs text-slate-500">— {d.documentType}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                      d.status === "ready" ? "bg-emerald-100 text-emerald-800" :
                      d.status === "failed" ? "bg-red-100 text-red-800" :
                      "bg-amber-100 text-amber-800"
                    }`}>
                      {d.status === "uploading" ? "Uploading..." : d.status === "ready" ? "Saved + AI processing" : d.status === "failed" ? "Failed" : "Processing"}
                    </span>
                    {d.message ? <span className="w-full text-xs text-red-700">{d.message}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {created && !submittedAt ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">3</span>
              Send to HR review
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid gap-3">
            <p className="text-sm text-slate-700">
              Once you've uploaded everything you have on hand, route the application into the HR Review Queue.
              The reviewer (you) will see all documents with AI extracted fields, can request corrections, and forward to DON approval.
            </p>
            {submitMessage ? (
              <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{submitMessage}</div>
            ) : null}
            <div>
              <Button onClick={submitForReview} disabled={submitting || docs.filter((d) => d.status === "ready").length === 0}>
                <Send size={16} /> {submitting ? "Submitting..." : "Submit for HR review"}
              </Button>
              {docs.filter((d) => d.status === "ready").length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Upload at least one document before submitting.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

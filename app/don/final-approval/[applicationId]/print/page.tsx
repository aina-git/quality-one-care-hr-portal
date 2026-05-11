import Image from "next/image";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getVerificationChecklist, summarizeChecklist } from "@/services/verification/verificationService";

function label(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function DonFinalApprovalPrintPage({ params }: { params: Promise<{ applicationId: string }> }) {
  await requireRole(["admin", "super_admin_hr", "don_approver", "executive_view_only"]);
  const { applicationId } = await params;
  const checklist = await getVerificationChecklist(applicationId);
  if (!checklist) redirect("/admin/dashboard");

  const summary = summarizeChecklist(checklist);
  const application = checklist.application;
  const applicant = application.applicantProfile;
  const latestLicense = application.licenses[0];

  return (
    <main className="mx-auto max-w-6xl bg-white px-8 py-8 text-slate-950 print:px-0">
      <style>{`
        @media print {
          body { background: white; }
          body > header, aside, nav, button { display: none !important; }
          main { max-width: none !important; }
        }
      `}</style>
      <div className="grid gap-3 border-b pb-5 text-center">
        <div className="mx-auto h-20 w-64 relative">
          <Image src="/logo.png" alt="Quality One Care" fill className="object-contain" />
        </div>
        <p className="text-sm font-semibold">Quality One Care Home Health Inc.</p>
        <h1 className="text-2xl font-semibold">Final Employment Verification for Hire Approval</h1>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <p>Applicant Name: <span className="font-semibold">{applicant.user.name ?? applicant.user.email}</span></p>
        <p>Position: <span className="font-semibold">{application.desiredRole ?? "Not recorded"}</span></p>
        <p>Phone: <span className="font-semibold">{applicant.phone ?? "Not recorded"}</span></p>
        <p>Email: <span className="font-semibold">{applicant.user.email}</span></p>
        <p>License Type: <span className="font-semibold">{latestLicense?.type ?? "Not recorded"}</span></p>
        <p>License Number: <span className="font-semibold">{latestLicense?.licenseNumber ?? "Not recorded"}</span></p>
        <p>Application Submitted: <span className="font-semibold">{application.submittedAt ? application.submittedAt.toLocaleString("en-US") : "Not submitted"}</span></p>
        <p>Completion: <span className="font-semibold">{summary.completionPercentage}%</span></p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Verification Summary</h2>
        <div className="mt-2 grid grid-cols-4 gap-3 text-sm">
          <p className="border p-2">Overall Status<br /><span className="font-semibold">{label(checklist.status)}</span></p>
          <p className="border p-2">Critical Missing<br /><span className="font-semibold">{summary.criticalBlockers.length}</span></p>
          <p className="border p-2">Expired Items<br /><span className="font-semibold">{summary.expiredItems.length}</span></p>
          <p className="border p-2">Failed Items<br /><span className="font-semibold">{summary.failedItems.length}</span></p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr>
              {["Checklist item", "Required standard", "Status", "Result", "Expiration date", "Evidence", "Verified by", "Verified date", "Notes"].map((heading) => (
                <th key={heading} className="border bg-slate-100 p-2 text-left">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checklist.items.map((item) => (
              <tr key={item.id}>
                <td className="border p-2 align-top">{item.title}</td>
                <td className="border p-2 align-top">{item.requirement}</td>
                <td className="border p-2 align-top">{label(item.status)}</td>
                <td className="border p-2 align-top">{item.result ?? "-"}</td>
                <td className="border p-2 align-top">{item.expirationDate ? item.expirationDate.toLocaleDateString("en-US") : "-"}</td>
                <td className="border p-2 align-top">{item.document ? item.document.fileName : "-"}</td>
                <td className="border p-2 align-top">{item.verifiedByUser ? item.verifiedByUser.name ?? item.verifiedByUser.email : "-"}</td>
                <td className="border p-2 align-top">{item.verifiedAt ? item.verifiedAt.toLocaleDateString("en-US") : "-"}</td>
                <td className="border p-2 align-top">{item.notes ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid gap-3 border-t pt-5 text-sm">
        <h2 className="text-lg font-semibold">DON Decision</h2>
        <p>Decision: <span className="font-semibold">{label(checklist.donDecision)}</span></p>
        <p>Comments: <span className="font-semibold">{checklist.donComment ?? "-"}</span></p>
        <p>DON/Admin Name: <span className="font-semibold">{checklist.approvedByUser ? checklist.approvedByUser.name ?? checklist.approvedByUser.email : "-"}</span></p>
        <p>Date/Time: <span className="font-semibold">{(checklist.approvedAt ?? checklist.rejectedAt)?.toLocaleString("en-US") ?? "-"}</span></p>
        <div className="mt-10 grid grid-cols-2 gap-8">
          <p className="border-t pt-2">DON Signature</p>
          <p className="border-t pt-2">Date</p>
        </div>
      </section>

      <div className="mt-6 flex gap-3 justify-center print:hidden" data-no-print>
        <a
          href={`/don/final-approval/${applicationId}/application-print`}
          className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Print QOC Employment Application
        </a>
      </div>
    </main>
  );
}

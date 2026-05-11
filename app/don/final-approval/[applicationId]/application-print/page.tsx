import Image from "next/image";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  type ApplicationFormData,
  type EmployerEntry,
  type EducationEntry,
  type ReferenceEntry,
  QOC_NURSING_DUTIES,
  mergeApplicationFormData
} from "@/services/intake/applicationFormSchema";

const headerBg = "bg-[#F97316] text-white";
const cellClass = "border border-slate-300 px-2 py-1.5 text-xs";
const labelClass = "font-semibold text-slate-800";

function val(v: string | undefined | null) {
  return v?.trim() || "";
}

function yesNo(v: "yes" | "no" | "" | undefined) {
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return "";
}

function check(v: boolean) {
  return v ? "☑" : "☐";
}

export default async function QocApplicationPrintPage({ params }: { params: Promise<{ applicationId: string }> }) {
  await requireRole(["admin", "super_admin_hr", "don_approver", "hr", "executive_view_only"]);
  const { applicationId } = await params;

  const step = await prisma.intakeStep.findUnique({
    where: { applicationId_stepKey: { applicationId, stepKey: "application_form" } }
  });
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicantProfile: { include: { user: true } } }
  });
  if (!application) redirect("/admin/dashboard");

  const form: ApplicationFormData = mergeApplicationFormData(step?.data);
  const emp1 = form.employer1;
  const emp2 = form.employer2;

  return (
    <main className="mx-auto max-w-[850px] bg-white px-6 py-6 text-slate-950 print:px-0 print:py-0 print:max-w-none">
      <style>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body > header, aside, nav, button, [data-no-print] { display: none !important; }
          main { max-width: none !important; margin: 0; padding: 12px; }
          .page-break { page-break-before: always; }
        }
        @page { size: letter; margin: 0.4in; }
      `}</style>

      {/* ═══ PAGE 1 ═══ */}
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-orange-500 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14">
            <Image src="/logo.png" alt="QOC" fill className="object-contain" />
          </div>
          <div>
            <p className="text-base font-bold text-orange-600">Quality One Care</p>
            <p className="text-xs text-slate-600">Home Health Inc.</p>
            <p className="text-[10px] italic text-slate-500">We Care with Golden Hands.</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-700">
          <p className="font-bold text-orange-600">Quality One Care Home Health, Inc.</p>
          <p>9221 Colesville Road, Silver Spring, MD 20910</p>
          <p>(301) 658-7141 &middot; qualityonecare.com</p>
        </div>
      </div>

      <h1 className="mt-3 text-center text-xl font-bold tracking-wide">EMPLOYMENT APPLICATION</h1>

      {/* ── PERSONAL INFORMATION ── */}
      <SectionHeader>Personal Information</SectionHeader>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={cellClass}><span className={labelClass}>First Name:</span> {val(form.firstName)}</td>
            <td className={cellClass}><span className={labelClass}>Last Name:</span> {val(form.lastName)}</td>
            <td className={cellClass}><span className={labelClass}>Date:</span> {val(form.dateOfApplication)}</td>
          </tr>
          <tr>
            <td className={cellClass}><span className={labelClass}>Address:</span> {val(form.address)}</td>
            <td className={cellClass}><span className={labelClass}>City:</span> {val(form.city)}</td>
            <td className={cellClass}><span className={labelClass}>State:</span> {val(form.state)} &nbsp; <span className={labelClass}>Zip code:</span> {val(form.zipCode)}</td>
          </tr>
          <tr>
            <td className={cellClass}><span className={labelClass}>Social Security #:</span> {form.ssn ? "•••-••-" + form.ssn.slice(-4) : ""}</td>
            <td className={cellClass} colSpan={2}><span className={labelClass}>Are you a United States Citizen or legally eligible to work in U.S.?</span></td>
          </tr>
          <tr>
            <td className={cellClass}><span className={labelClass}>Phone:</span> {val(form.phone)}</td>
            <td className={cellClass} colSpan={2}>{check(form.usAuthorized === "yes")} Yes &nbsp; {check(form.usAuthorized === "no")} No</td>
          </tr>
          <tr>
            <td className={cellClass} colSpan={3}><span className={labelClass}>Email:</span> {val(form.email)}</td>
          </tr>
          <tr>
            <td className={cellClass} colSpan={2}>
              <span className={labelClass}>Title / Position Applying For:</span> {val(form.positionAppliedFor)}<br />
              <span className={labelClass}>Other position, write here:</span> {val(form.otherPosition)}<br />
              <span className={labelClass}>Work Preference:</span> {val(form.workPreference)}
            </td>
            <td className={cellClass}>
              <span className={labelClass}>Shift:</span> {val(form.shift)}<br />
              <span className={labelClass}>Date Available to Work?</span> {val(form.dateAvailableToWork)}<br />
              <span className={labelClass}>Salary Desired:</span> {val(form.salaryDesired)}
            </td>
          </tr>
          <tr>
            <td className={cellClass} colSpan={3}>
              <span className={labelClass}>Have you been convicted of a felony?</span> {check(form.felonyConviction === "yes")} Yes &nbsp; {check(form.felonyConviction === "no")} No
            </td>
          </tr>
          {form.felonyConviction === "yes" && (
            <tr>
              <td className={cellClass} colSpan={3}><span className={labelClass}>If Yes, explain:</span> {val(form.felonyExplanation)}</td>
            </tr>
          )}
          <tr>
            <td className={cellClass} colSpan={3}>
              <span className={labelClass}>Have you ever applied to this agency before</span> {check(form.appliedBefore === "yes")} Yes &nbsp; {check(form.appliedBefore === "no")} No
            </td>
          </tr>
          <tr>
            <td className={cellClass} colSpan={3}>
              <span className={labelClass}>Are you currently employed?</span> {check(form.currentlyEmployed === "yes")} Yes &nbsp; {check(form.currentlyEmployed === "no")} No
              {form.currentlyEmployed === "yes" && (
                <span className="ml-4"><span className={labelClass}>If so, may we contact your present employer?</span> {check(form.mayContactEmployer === "yes")} Yes &nbsp; {check(form.mayContactEmployer === "no")} No</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── EDUCATION ── */}
      <SectionHeader>Education</SectionHeader>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-orange-50">
            <th className={`${cellClass} text-left w-28`}></th>
            <th className={`${cellClass} text-left`}>Name and Location</th>
            <th className={`${cellClass} text-left w-24`}># Years attended</th>
            <th className={`${cellClass} text-left w-28`}>Date graduated</th>
            <th className={`${cellClass} text-left w-32`}>Degree/Diploma</th>
          </tr>
        </thead>
        <tbody>
          <EduRow label="High School" entry={form.highSchool} />
          <EduRow label="College" entry={form.college} />
          <EduRow label="Certificate/License" entry={form.certificateLicense} />
        </tbody>
      </table>

      {/* ── EMPLOYMENT HISTORY #1 ── */}
      <SectionHeader>Employment History</SectionHeader>
      <EmployerPrint label="1st" entry={emp1} />

      {/* Experience summary bar */}
      <div className="mt-2 flex items-center gap-4 rounded border border-orange-300 bg-orange-50 px-3 py-2 text-xs">
        <span className="font-semibold">How Many Years of Pediatric Experience:</span>
        <span className="border-b border-slate-400 min-w-[60px] inline-block text-center">{val(form.pediatricYearsTotal)}</span>
        <span className="font-semibold ml-4">How Many Years of Non-Pediatric Experience:</span>
        <span className="border-b border-slate-400 min-w-[60px] inline-block text-center">{val(form.nonPediatricYearsTotal)}</span>
      </div>

      {/* ═══ PAGE 2 ═══ */}
      <div className="page-break" />

      {/* Page 2 header */}
      <div className="flex items-center justify-between border-b-2 border-orange-500 pb-3 mt-2 print:mt-0">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14">
            <Image src="/logo.png" alt="QOC" fill className="object-contain" />
          </div>
          <div>
            <p className="text-base font-bold text-orange-600">Quality One Care</p>
            <p className="text-xs text-slate-600">Home Health Inc.</p>
            <p className="text-[10px] italic text-slate-500">We Care with Golden Hands.</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-700">
          <p className="font-bold text-orange-600">Quality One Care Home Health, Inc.</p>
          <p>9221 Colesville Road, Silver Spring, MD 20910</p>
          <p>(301) 658-7141 &middot; qualityonecare.com</p>
        </div>
      </div>

      {/* ── EMPLOYMENT HISTORY #2 ── */}
      <SectionHeader>Employment History</SectionHeader>
      <EmployerPrint label="2nd" entry={emp2} />

      {/* ── PERSONAL REFERENCES ── */}
      <SectionHeader>Personal References</SectionHeader>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-orange-50">
            <th className={`${cellClass} text-left`}>Name</th>
            <th className={`${cellClass} text-left`}>Relationship</th>
            <th className={`${cellClass} text-left w-40`}>Phone #</th>
          </tr>
        </thead>
        <tbody>
          <RefRow entry={form.reference1} />
          <RefRow entry={form.reference2} />
          <RefRow entry={form.reference3} />
        </tbody>
      </table>

      {/* ── AUTHORIZATION ── */}
      <SectionHeader>Authorization</SectionHeader>
      <div className="border border-slate-300 p-3 text-[11px] leading-relaxed text-slate-700">
        <p>I certify that information contained in this application is true and complete to the best of my knowledge. I understand that any false information or significant omissions may disqualify me from further consideration of employment and, in the event I become employed, may result in the termination of my employment if discovered at a later date.</p>
        <p className="mt-2">I authorize investigation and verification of all statements contained herein and the references and former employers and employees to give you any and all information concerning my previous employment, including: education, employment verification, personal references and criminal records. I release Quality One Care from all liability for any damage that may result from receiving and/or using such information.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Applicant&apos;s Signature:</p>
          <div className="border-b-2 border-slate-400 pb-1 min-h-[28px] text-sm italic">
            {val(form.signatureName)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Date:</p>
          <div className="border-b-2 border-slate-400 pb-1 min-h-[28px] text-sm">
            {val(form.signatureDate)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 border-t border-orange-400 pt-2 text-center text-[10px] text-slate-500">
        <p className="font-semibold text-orange-600">Quality One Care Home Health, Inc.</p>
        <p>9221 Colesville Road, Silver Spring, MD 20910 | Phone: (301) 658-7141 | Fax: (301) 658-2328 | info@qualityonecare.com</p>
        <p>Mon - Fri: 9am - 5pm | qualityonecare.com</p>
      </div>

      {/* Print button (hidden on print) */}
      <div data-no-print className="mt-6 flex gap-3 justify-center">
        <button onClick={() => {}} className="rounded bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700 print:hidden" data-print-trigger>
          Print Application
        </button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('[data-print-trigger]')?.addEventListener('click',()=>window.print())` }} />
    </main>
  );
}

/* ── Sub-components ── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${headerBg} mt-4 rounded-t px-3 py-1.5 text-center text-xs font-bold tracking-widest uppercase`}>
      {children}
    </div>
  );
}

function EduRow({ label, entry }: { label: string; entry: EducationEntry }) {
  return (
    <tr>
      <td className={`${cellClass} font-semibold bg-slate-50`}>{label}</td>
      <td className={cellClass}>{val(entry.nameAndLocation)}</td>
      <td className={cellClass}>{val(entry.yearsAttended)}</td>
      <td className={cellClass}>{val(entry.dateGraduated)}</td>
      <td className={cellClass}>{val(entry.degreeDiploma)}</td>
    </tr>
  );
}

function RefRow({ entry }: { entry: ReferenceEntry }) {
  return (
    <tr>
      <td className={`${cellClass}`}><span className={labelClass}>Name:</span> {val(entry.name)}</td>
      <td className={`${cellClass}`}><span className={labelClass}>Relationship:</span> {val(entry.relationship)}</td>
      <td className={`${cellClass}`}><span className={labelClass}>Phone #:</span> {val(entry.phone)}</td>
    </tr>
  );
}

function EmployerPrint({ label, entry }: { label: string; entry: EmployerEntry }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr>
          <td className={cellClass} colSpan={2}><span className={labelClass}>Name of the {label} Previous Employer:</span> {val(entry.employerName)}</td>
          <td className={cellClass}><span className={labelClass}>Phone:</span> {val(entry.employerPhone)}</td>
        </tr>
        <tr>
          <td className={cellClass} colSpan={3}><span className={labelClass}>Address:</span> {val(entry.employerAddress)}</td>
        </tr>
        <tr>
          <td className={cellClass}><span className={labelClass}>From:</span> {val(entry.from)}</td>
          <td className={cellClass}><span className={labelClass}>To:</span> {val(entry.to)}</td>
          <td className={cellClass}><span className={labelClass}>Position/Job Title:</span> {val(entry.positionJobTitle)}</td>
        </tr>
        <tr>
          <td className={cellClass} colSpan={2}><span className={labelClass}>Name of Supervisor:</span> {val(entry.supervisorName)}</td>
          <td className={`${cellClass} align-top`} rowSpan={4}>
            <p className={`${labelClass} mb-1`}>Job Duties performed at the previous job:</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              {QOC_NURSING_DUTIES.map((duty) => (
                <span key={duty}>{check(entry.duties.includes(duty))} {duty}</span>
              ))}
              <span>{check(!!entry.otherDuties)} Others: {val(entry.otherDuties)}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td className={cellClass} colSpan={2}><span className={labelClass}>Telephone:</span> {val(entry.supervisorPhone)}</td>
        </tr>
        <tr>
          <td className={cellClass}><span className={labelClass}>Start Pay:</span> {val(entry.startPay)}</td>
          <td className={cellClass}><span className={labelClass}>End Pay:</span> {val(entry.endPay)}</td>
        </tr>
        <tr>
          <td className={cellClass} colSpan={2}><span className={labelClass}>Reason for Leaving:</span> {val(entry.reasonForLeaving)}</td>
        </tr>
      </tbody>
    </table>
  );
}

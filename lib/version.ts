export const APP_VERSION = "2.4.0";

export const APP_NAME = "Quality One Care HR Operations Portal";

export const APP_COPYRIGHT = {
  builder: "Abiodun Aina",
  company: "Quality One Care Home Health Inc.",
  year: 2025,
  notice:
    "All rights reserved. This software and its source code are the exclusive property of Quality One Care Home Health Inc. Unauthorized reproduction, distribution, or use of this software in whole or in part is strictly prohibited."
};

export type VersionEntry = {
  version: string;
  date: string;
  title: string;
  highlights: string[];
};

export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "2.4.0",
    date: "2026-05-11",
    title: "HR Assistant Role + Strict Access Control",
    highlights: [
      "New HR Assistant role with restricted read-only dashboard",
      "HR Assistant sees only their own dashboard and application list",
      "Strict role isolation: every role locked to their own section",
      "Only HR Coordinator and Admin can manage users and system settings",
      "DON, Scheduler, Executive each blocked from other role areas",
      "HR Coordinator label updated across the portal"
    ]
  },
  {
    version: "2.3.0",
    date: "2026-05-11",
    title: "Advanced Verification Intelligence",
    highlights: [
      "Application completeness gate with SSN, employer, and reference validation",
      "Employment gap detector flags gaps of 3+ months between employers",
      "Stale pending alert highlights verification items stuck 7+ days",
      "Duplicate applicant detection across name, email, phone, and SSN",
      "Document identity fallback recovers names and addresses from uploaded IDs",
      "CGIS prefilled background check form in verification checklist",
      "Maryland Case Search marked as non-expirable"
    ]
  },
  {
    version: "2.2.0",
    date: "2026-05-10",
    title: "QOC-Auto Integration",
    highlights: [
      "QOC-Auto quick-action buttons on Applications page",
      "Voice dictation input on every intake wizard textarea"
    ]
  },
  {
    version: "2.1.0",
    date: "2026-05-09",
    title: "OCR + Reliability + Mobile",
    highlights: [
      "Anthropic Claude vision OCR provider for document processing",
      "50MB file upload support with health probe endpoint",
      "Global error boundary and mobile-responsive navigation drawer",
      "Nodemailer types fix for production builds"
    ]
  },
  {
    version: "2.0.0",
    date: "2026-05-07",
    title: "Dashboard Overhaul + Admin Search",
    highlights: [
      "Real search bar with global applicant and document search",
      "Horizontal tab navigation on every admin queue",
      "Applicant case file streamlined to essential tabs",
      "Calendar edit and delete with timezone fix",
      "Clickable task tiles and overdue banners",
      "Weather widget with 7-day forecast and ZIP-based location"
    ]
  },
  {
    version: "1.9.0",
    date: "2026-05-06",
    title: "Excel Monitor + Dashboard Navigation",
    highlights: [
      "Excel Credential Monitor with Postgres persistence and SMTP transport",
      "Test-send button and audit logs for credential alerts",
      "Dedicated extra-notification-addresses section",
      "All dashboard stat cards and notification center items now navigate on click"
    ]
  },
  {
    version: "1.8.0",
    date: "2026-05-05",
    title: "Address Intelligence + Identity Matching",
    highlights: [
      "Live address autocomplete on every applicant address field",
      "Real-time identity match badge confirming typed info against uploaded IDs",
      "Auto-prefill name and address into W-9, W-4, MW507 from intake data",
      "MBON and Nursys verification URL fixes with MM/DD/YYYY date format",
      "CJIS/CGIS background check URL and login email surfaced on verification pages",
      "Default sender set to hr@qualityonecare.com"
    ]
  },
  {
    version: "1.7.0",
    date: "2026-05-04",
    title: "Live Notifications + SMS",
    highlights: [
      "Inline Quick Fix button on every critical blocker",
      "Non-expirable verification categories (Employment History, References, OIG)",
      "Live email and SMS-via-email-gateway on every status change",
      "Real-time applicant monitor with shareable invite link",
      "Phone-based registration with SMS login codes"
    ]
  },
  {
    version: "1.6.0",
    date: "2026-05-03",
    title: "Workflow Polish + Branded Auth",
    highlights: [
      "HR identity cross-check overrides for false positives",
      "Deduplicated notification badge counts",
      "Admin user delete and full account wipe post-DON decision",
      "Applicant-facing hero landing page and wizard-first CTA",
      "Branded login and registration pages",
      "Smart cleanup that preserves real applicants"
    ]
  },
  {
    version: "1.5.0",
    date: "2026-05-02",
    title: "Applicant Intake Wizard",
    highlights: [
      "14-step guided intake wizard for new applicants",
      "Application Form, Hep B and Influenza Declinations",
      "RN/LPN Job Description, Wage Deduction Authorization",
      "Pre-Employment Medical Clearance and TB Screening",
      "Professional References, Direct Deposit, W-9, W-4, MW507",
      "Skills Competency Checklist and Clinical Judgment Test",
      "New Hire Checklist with finalize-and-submit flow"
    ]
  },
  {
    version: "1.4.0",
    date: "2026-05-02",
    title: "HR Tools + OCR Auto-Mapping",
    highlights: [
      "HR inline editing for contact info, pediatric experience, employment, licenses",
      "Auto-map high-confidence OCR extractions to profile fields",
      "HR upload documents on behalf of applicant",
      "Direct navigation from open issues to fix location",
      "Push application to Verification without resolving every issue",
      "Real blocker reasons on verification page"
    ]
  },
  {
    version: "1.3.0",
    date: "2026-05-01",
    title: "Calendar + Admin Intake",
    highlights: [
      "Calendar event forms with validation and Eastern-time labels",
      "Admin can create and submit applications for paper applicants",
      "Emergency admin password reset script",
      "Intake location management for multi-site operations"
    ]
  },
  {
    version: "1.2.0",
    date: "2026-05-01",
    title: "Excel Monitor + Production Readiness",
    highlights: [
      "Excel Credential Monitor for license expiration tracking",
      "Admin cleanup endpoint and dashboard widgets",
      "Persistent volume uploads for production deployment"
    ]
  },
  {
    version: "1.1.0",
    date: "2026-04-30",
    title: "Showcase-Ready Release",
    highlights: [
      "Role-named dashboard banners and applicant progress timeline",
      "Document preview with friendly error pages",
      "Verification status respects HR manual decisions",
      "Seeded demo applicants with real PDF documents"
    ]
  },
  {
    version: "1.0.0",
    date: "2026-04-29",
    title: "Initial Production Deployment",
    highlights: [
      "Core HR Portal with role-based access control",
      "Application management with full lifecycle tracking",
      "Document upload, OCR, and AI-powered review engine",
      "15-item verification checklist with DON approval workflow",
      "Notifications, interview scheduling, and onboarding",
      "Deployed to Railway and Cloudflare"
    ]
  }
];

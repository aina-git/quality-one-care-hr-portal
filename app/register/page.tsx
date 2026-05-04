import { cookies } from "next/headers";
import { AuthPanel } from "@/components/AuthPanel";
import { ApplicantRegistrationForm } from "@/components/ApplicantRegistrationForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const csrfToken = (await cookies()).get("qoc_csrf")?.value ?? "";
  const message =
    params.error === "exists"
      ? "An account already exists for that email."
      : params.error
        ? "Enter a valid email and a password of at least 8 characters."
        : null;

  return (
    <AuthPanel
      title="Applicant Registration"
      description="Applicants may self-register. HR and Admin accounts are created by administrators only."
      footer={{ label: "Already have an account?", href: "/login", action: "Login" }}
    >
      {message && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>}
      <ApplicantRegistrationForm csrfToken={csrfToken} />
    </AuthPanel>
  );
}

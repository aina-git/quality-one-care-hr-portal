import { cookies } from "next/headers";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ForgotPasswordPage() {
  const csrfToken = (await cookies()).get("qoc_csrf")?.value ?? "";
  return (
    <AuthPanel
      title="Password Recovery"
      description="Use your registered contact information. For security, recovery instructions are only sent when the information matches our records."
      footer={{ label: "Remembered your password?", href: "/login", action: "Return to login" }}
    >
      <form action="/api/auth/recovery/request" method="post" className="grid gap-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="grid gap-2">
          <Label htmlFor="accountType">Account type</Label>
          <select id="accountType" name="accountType" className="h-10 rounded-md border bg-white px-3 text-sm">
            <option value="applicant">Applicant</option>
            <option value="staff">HR / Staff</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contactMethod">Recovery lookup</Label>
          <select id="contactMethod" name="contactMethod" className="h-10 rounded-md border bg-white px-3 text-sm">
            <option value="email">Registered email address</option>
            <option value="phone">Registered phone number</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="identifier">Email or phone</Label>
          <Input id="identifier" name="identifier" required autoComplete="username" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="verificationDate">Applicant application creation date or date of birth</Label>
          <Input id="verificationDate" name="verificationDate" type="date" />
          <p className="text-xs text-muted-foreground">Required for applicant recovery. Staff recovery uses registered email and one-time code.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="channel">Send code by</Label>
          <select id="channel" name="channel" className="h-10 rounded-md border bg-white px-3 text-sm">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          HR/staff accounts cannot be recovered using phone number and application date only. Phone-only staff recovery requires Admin/Super HR approval.
        </div>
        <Button type="submit" className="w-full">Send recovery code</Button>
        <Link href="/verify-recovery-code" className="text-center text-sm font-medium text-orange-700 hover:text-orange-800">
          Already have a recovery code?
        </Link>
      </form>
    </AuthPanel>
  );
}

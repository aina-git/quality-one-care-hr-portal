import { cookies } from "next/headers";
import { AuthPanel } from "@/components/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const csrfToken = (await cookies()).get("qoc_csrf")?.value ?? "";
  return (
    <AuthPanel
      title="Create New Password"
      description="Choose a new password for your Quality One Care portal account."
      footer={{ label: "Back to login?", href: "/login", action: "Login" }}
    >
      {params.error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">This reset link is invalid, expired, or the passwords did not match.</div> : null}
      <form action="/api/auth/recovery/reset" method="post" className="grid gap-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <input type="hidden" name="resetToken" value={params.token ?? ""} />
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={!params.token}>Reset password</Button>
      </form>
    </AuthPanel>
  );
}

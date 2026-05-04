import { cookies } from "next/headers";
import { AuthPanel } from "@/components/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function VerifyRecoveryCodePage({
  searchParams
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const csrfToken = (await cookies()).get("qoc_csrf")?.value ?? "";
  return (
    <AuthPanel
      title="Verify Recovery Code"
      description="Enter the code sent to your registered email or phone. Codes expire after 10 minutes."
      footer={{ label: "Need a new code?", href: "/forgot-password", action: "Start recovery again" }}
    >
      {params.notice ? <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{params.notice}</div> : null}
      {params.error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">The code could not be verified. Request a new code if it expired.</div> : null}
      <form action="/api/auth/recovery/verify" method="post" className="grid gap-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="grid gap-2">
          <Label htmlFor="identifier">Registered email or phone</Label>
          <Input id="identifier" name="identifier" required autoComplete="username" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="code">One-time code</Label>
          <Input id="code" name="code" inputMode="numeric" maxLength={8} required />
        </div>
        <Button type="submit" className="w-full">Verify code</Button>
      </form>
    </AuthPanel>
  );
}

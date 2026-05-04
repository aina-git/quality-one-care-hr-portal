import { cookies } from "next/headers";
import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams;
  const csrfToken = (await cookies()).get("qoc_csrf")?.value ?? "";
  return (
    <AuthPanel
      title="Staff and Applicant Login"
      description="Use your Quality One Care portal credentials."
      footer={{ label: "Applying for the first time?", href: "/register", action: "Create applicant account" }}
    >
      {params.error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Invalid email or password.</div>}
      {"reset" in params && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Password reset complete. Please log in with your new password.</div>}
      <form action="/api/auth/login" method="post" className="grid gap-4">
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full">Login</Button>
        <Link href="/forgot-password" className="text-center text-sm font-medium text-orange-700 hover:text-orange-800">
          Forgot Password?
        </Link>
      </form>
    </AuthPanel>
  );
}

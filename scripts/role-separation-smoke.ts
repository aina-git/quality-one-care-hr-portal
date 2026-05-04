import { SignJWT } from "jose";
import { prisma } from "../lib/prisma";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-change-me");

async function cookieFor(user: { id: string; email: string; name: string | null; role: string }) {
  const token = await new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
  return `qoc_session=${token}`;
}

async function fetchText(path: string, cookie: string) {
  const response = await fetch(`http://localhost:3000${path}`, { headers: { cookie }, redirect: "manual" });
  return { response, text: await response.text().catch(() => "") };
}

async function main() {
  const superAdmin = await prisma.user.findFirst({ where: { role: "super_admin_hr", isActive: true } });
  const applicant = await prisma.user.findFirst({ where: { role: "applicant", isActive: true } });
  if (!superAdmin || !applicant) throw new Error("Missing Super Admin or Applicant user for smoke test.");
  const adminCookie = await cookieFor(superAdmin);
  const applicantCookie = await cookieFor(applicant);

  const adminPaths = ["/admin/dashboard", "/admin/notifications", "/admin/calendar", "/admin/tasks", "/admin/applications", "/admin/hr-review-queue", "/admin/verification-queue"];
  const adminResults = [];
  for (const path of adminPaths) {
    const { response, text } = await fetchText(path, adminCookie);
    adminResults.push({
      path,
      status: response.status,
      location: response.headers.get("location"),
      hasSuperAdminShell: text.includes("Super Admin HR"),
      hasApplicantShell: text.includes("Applicant Portal") || text.includes("Start your application first"),
      hasApplicantLink: text.includes('href="/applicant')
    });
  }
  const genericNotifications = await fetch("http://localhost:3000/notifications", { headers: { cookie: adminCookie }, redirect: "manual" });
  const applicantAdmin = await fetch("http://localhost:3000/admin/dashboard", { headers: { cookie: applicantCookie }, redirect: "manual" });
  const notificationPage = adminResults.find((result) => result.path === "/admin/notifications");
  const dashboardPage = adminResults.find((result) => result.path === "/admin/dashboard");

  const failures = [
    ...adminResults.filter((result) => result.status !== 200).map((result) => `${result.path} did not load`),
    ...adminResults.filter((result) => !result.hasSuperAdminShell).map((result) => `${result.path} did not show Super Admin shell`),
    ...adminResults.filter((result) => result.hasApplicantShell).map((result) => `${result.path} rendered Applicant shell`),
    ...adminResults.filter((result) => result.hasApplicantLink).map((result) => `${result.path} contains applicant link`),
    genericNotifications.status !== 307 && "Super Admin /notifications did not redirect to /admin/notifications",
    !(genericNotifications.headers.get("location") ?? "").includes("/admin/notifications") && "Super Admin notification redirect target is wrong",
    applicantAdmin.status !== 307 && "Applicant was not redirected away from admin dashboard",
    !(applicantAdmin.headers.get("location") ?? "").includes("/applicant/dashboard") && "Applicant admin redirect target is wrong",
    !notificationPage && "Admin notification page missing",
    !dashboardPage && "Admin dashboard missing"
  ].filter(Boolean);

  console.log(JSON.stringify({ ok: failures.length === 0, failures, adminResults, redirects: { genericNotifications: genericNotifications.headers.get("location"), applicantAdmin: applicantAdmin.headers.get("location") } }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().finally(async () => prisma.$disconnect());

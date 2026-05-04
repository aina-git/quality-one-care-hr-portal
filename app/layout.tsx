import type { Metadata } from "next";
import { BrandHeader } from "@/components/BrandHeader";
import { JobRunnerBootstrap } from "@/components/JobRunnerBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quality One Care – HR Application Portal",
  description: "Phase 1 HR application portal for Quality One Care."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <JobRunnerBootstrap />
        <BrandHeader />
        {children}
      </body>
    </html>
  );
}

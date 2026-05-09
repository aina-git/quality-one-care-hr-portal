import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
  experimental: {
    serverActions: {
      // 50 MB to comfortably cover scanned multi-page PDFs and high-res
      // photos of licenses / IDs that applicants upload from phones.
      // Smaller values (the previous 2 MB) silently 413 on real-world docs.
      bodySizeLimit: "50mb"
    }
  }
};

export default nextConfig;

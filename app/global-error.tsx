"use client";

import { useEffect } from "react";

// Last-resort error boundary for the whole app. Triggered when the layout
// itself crashes — section-level error.tsx files (admin, hr, applicant)
// catch errors inside their tree, but if RootLayout throws, only this
// boundary remains. Must render its own <html>/<body>.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to Railway logs. When a real logging service is
    // wired up, swap this for logger.error.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("GlobalError:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>
            The app hit an unexpected error. Try again — most issues clear up on
            a refresh. If it keeps happening, contact HR with the reference below.
          </p>
          {error.digest && (
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 11,
                color: "#64748b",
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 16,
                wordBreak: "break-all",
              }}
            >
              ref: {error.digest}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: "#334155",
                color: "#e2e8f0",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

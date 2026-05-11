"use client";

import { useState } from "react";
import { Download, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const QOC_AUTO_URL = "http://127.0.0.1:8888";

export function QocCheckEmailsButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const r = await fetch(`${QOC_AUTO_URL}/api/qoc/check-emails`, { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        alert(
          "QOC-Auto checked both inboxes (hr@ and aaina@):\n\n" +
          (data.output || "").slice(0, 800)
        );
      } else {
        alert("Error: " + (data.error || "unknown"));
      }
    } catch (e: any) {
      alert(
        "Could not reach QOC-Auto on this machine.\n\n" +
        "Make sure QOC-Auto is running at http://127.0.0.1:8888\n\n" +
        "Error: " + e.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      size="sm"
      title="Calls QOC-Auto to scan hr@ and aaina@ inboxes for new credential attachments and auto-file them."
      className="gap-2"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
      {loading ? "Checking inboxes..." : "Check emails for credentials"}
    </Button>
  );
}

export function QocRecentCredentialsButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const r = await fetch(`${QOC_AUTO_URL}/api/qoc/recent-credentials`);
      const data = await r.json();
      if (data.count === 0) {
        alert("No credentials have been filed by QOC-Auto yet.");
        return;
      }
      const list = (data.items || [])
        .slice(0, 20)
        .map((x: any) => `  • ${x.clinician}/${x.filename}  (${x.size_kb} KB)`)
        .join("\n");
      const more = data.count > 20 ? `\n\n...and ${data.count - 20} more.` : "";
      alert(`QOC-Auto has filed ${data.count} credential(s):\n\n${list}${more}`);
    } catch (e: any) {
      alert("Could not reach QOC-Auto. Make sure it is running at http://127.0.0.1:8888\n\n" + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      size="sm"
      title="Shows all credentials QOC-Auto has filed from emails."
      className="gap-2"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {loading ? "Loading..." : "View filed credentials"}
    </Button>
  );
}

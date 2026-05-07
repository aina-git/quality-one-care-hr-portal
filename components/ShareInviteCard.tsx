"use client";

import { useState } from "react";
import { Copy, ExternalLink, Mail, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  registrationUrl: string;
};

const EMAIL_TEMPLATE = (url: string) => ({
  subject: "Invitation to apply — Quality One Care Home Health",
  body: `Hello,

Thank you for your interest in Quality One Care Home Health, Inc.

To start your application, please click the link below to create your applicant account. The application is a guided online packet — each step is short and your progress saves automatically.

${url}

If you have questions, reach us at info@qualityonecare.com or (301) 658-7141.

— Quality One Care HR`
});

export function ShareInviteCard({ registrationUrl }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — fallback below
    }
  }

  function openMail() {
    const tpl = EMAIL_TEMPLATE(registrationUrl);
    const href = `mailto:?subject=${encodeURIComponent(tpl.subject)}&body=${encodeURIComponent(tpl.body)}`;
    window.location.href = href;
  }

  function openSms() {
    const text = `Apply to Quality One Care Home Health: ${registrationUrl}`;
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Share2 size={18} className="mt-1 flex-shrink-0 text-blue-700" />
          <div className="flex-1">
            <p className="font-semibold text-blue-950">Share the application link</p>
            <p className="mt-0.5 text-xs text-blue-800">
              Send this URL to any applicant. They register, then walk through the guided packet — you watch their progress here.
            </p>
            <div className="mt-3 flex flex-wrap items-stretch gap-2">
              <input
                readOnly
                value={registrationUrl}
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="h-9 min-w-[260px] flex-1 rounded-md border border-blue-200 bg-white px-3 font-mono text-xs"
              />
              <Button type="button" size="sm" onClick={copyUrl} variant="outline">
                <Copy size={14} /> {copied ? "Copied!" : "Copy"}
              </Button>
              <Button type="button" size="sm" onClick={openMail} variant="outline">
                <Mail size={14} /> Email it
              </Button>
              <Button type="button" size="sm" onClick={openSms} variant="outline">
                <ExternalLink size={14} /> Text it
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

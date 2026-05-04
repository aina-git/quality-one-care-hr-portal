import type { MessageChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sanitizeText } from "@/lib/security";
import { sendCommunication } from "@/services/communications/communicationService";

const channels = ["in_app", "email", "sms", "whatsapp"];

export async function POST(request: Request) {
  const user = await requireAuth();
  if (user.role === "executive_view_only") {
    return NextResponse.json({ error: "Executive access is read only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const channel = sanitizeText(body.channel, 80);
  const applicationId = sanitizeText(body.applicationId, 100);
  if (!applicationId || !channels.includes(channel)) {
    return NextResponse.json({ error: "Application and channel are required." }, { status: 400 });
  }
  try {
    const log = await sendCommunication({
      applicationId,
      senderId: user.id,
      senderRole: user.role,
      channel: channel as MessageChannel,
      subject: sanitizeText(body.subject, 200),
      body: sanitizeText(body.body, 5000)
    });
    return NextResponse.json({ log, status: log.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Message could not be sent." }, { status: 400 });
  }
}

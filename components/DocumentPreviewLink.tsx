import { getSession } from "@/lib/auth";
import { createSignedDocumentToken } from "@/services/storage/storageService";

export async function DocumentPreviewLink({
  documentId,
  label = "Open source document"
}: {
  documentId: string;
  label?: string;
}) {
  const session = await getSession();
  if (!session) return null;
  const token = createSignedDocumentToken(documentId, session.id, Date.now() + 5 * 60 * 1000);
  return (
    <a
      href={`/api/documents/${documentId}?token=${encodeURIComponent(token)}`}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-semibold text-blue-700 hover:text-blue-900"
    >
      {label}
    </a>
  );
}

import { createSignedDocumentToken } from "@/services/storage/storageService";

export function ProfilePhoto({
  document,
  viewerUserId,
  name,
  size = "md"
}: {
  document: { id: string; fileName: string } | null | undefined;
  viewerUserId: string;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const classes = size === "lg" ? "h-28 w-28" : size === "sm" ? "h-12 w-12" : "h-20 w-20";
  if (!document) {
    return <div className={`${classes} flex items-center justify-center rounded-full border bg-slate-100 text-xs font-semibold text-slate-500`}>No Photo</div>;
  }
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const token = createSignedDocumentToken(document.id, viewerUserId, expiresAt);
  return (
    <img
      src={`/api/documents/${document.id}?token=${encodeURIComponent(token)}`}
      alt={`${name ?? "Applicant"} profile photo`}
      className={`${classes} rounded-full border-4 border-white object-cover shadow`}
    />
  );
}

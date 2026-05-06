"use client";

import { ArrowRight } from "lucide-react";

// Maps a ValidationIssue's section/fieldKey to the right anchor + label on
// the review page so HR can jump straight to the place that needs fixing.
// The component is intentionally generic — sections coming from the
// validator/AI are mapped loosely (case-insensitive substring) so naming
// drift doesn't silently strip the action button.
function targetFor(section: string, fieldKey: string | null) {
  const s = (section || "").toLowerCase();
  const f = (fieldKey || "").toLowerCase();

  if (s.includes("document") || /resume|application[_ ]?form|cpr|license[_ ]?file|reference[_ ]?letter/.test(f)) {
    return { anchor: "card-documents", label: "Upload here" };
  }
  if (s.includes("personal") || s.includes("contact") || /phone|address|email|date[_ ]?of[_ ]?birth|name/.test(f)) {
    return { anchor: "card-contact", label: "Edit contact" };
  }
  if (s.includes("pediatric")) {
    return { anchor: "card-pediatric", label: "Edit pediatric experience" };
  }
  if (s.includes("employment")) {
    return { anchor: "card-employment", label: "Add employment record" };
  }
  if (s.includes("license") && !s.includes("certif")) {
    return { anchor: "card-licenses", label: "Add license" };
  }
  if (s.includes("certif")) {
    return { anchor: "card-certifications", label: "Add certification" };
  }
  if (s.includes("reference")) {
    return { anchor: "card-references", label: "Add reference" };
  }
  return null;
}

export function HrIssueFixLink({ section, fieldKey }: { section: string; fieldKey: string | null }) {
  const target = targetFor(section, fieldKey);
  if (!target) return null;

  function jump(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const el = document.getElementById(target!.anchor);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Update the URL hash so editors that open-on-hash see it on next render.
    history.replaceState(null, "", `#${target!.anchor}`);
    // Briefly highlight the target so it's obvious where to look.
    el.classList.add("ring-2", "ring-orange-400", "ring-offset-2");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-orange-400", "ring-offset-2");
    }, 1600);
  }

  return (
    <a
      href={`#${target.anchor}`}
      onClick={jump}
      className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-900 underline-offset-2 hover:underline"
    >
      {target.label} <ArrowRight size={12} />
    </a>
  );
}

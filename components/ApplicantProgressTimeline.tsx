import type { ApplicantProgressStage } from "@/services/applicantProgressService";

const toneClasses: Record<ApplicantProgressStage["tone"], { dot: string; card: string; text: string }> = {
  gray: { dot: "bg-slate-500", card: "border-slate-200 bg-slate-50", text: "text-slate-700" },
  blue: { dot: "bg-blue-600", card: "border-blue-200 bg-blue-50", text: "text-blue-800" },
  orange: { dot: "bg-orange-600", card: "border-orange-200 bg-orange-50", text: "text-orange-800" },
  purple: { dot: "bg-purple-600", card: "border-purple-200 bg-purple-50", text: "text-purple-800" },
  teal: { dot: "bg-teal-600", card: "border-teal-200 bg-teal-50", text: "text-teal-800" },
  green: { dot: "bg-emerald-600", card: "border-emerald-200 bg-emerald-50", text: "text-emerald-800" },
  red: { dot: "bg-red-600", card: "border-red-200 bg-red-50", text: "text-red-800" }
};

export function ApplicantProgressTimeline({
  stages,
  compact = false
}: {
  stages: ApplicantProgressStage[];
  compact?: boolean;
}) {
  const completed = stages.filter((stage) => stage.complete).length;
  const percent = Math.round((completed / stages.length) * 100);

  return (
    <div className="grid gap-4">
      <div className="rounded-full bg-slate-100">
        <div className="qoc-progress-bar h-2 rounded-full bg-orange-500" style={{ width: `${percent}%` }} />
      </div>
      <div className={compact ? "grid gap-2 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
        {stages.map((stage) => {
          const tone = toneClasses[stage.tone];
          const activeClass = stage.active ? `${tone.card} ring-2 ring-offset-2 ring-orange-200` : stage.complete ? tone.card : "border-slate-200 bg-white";
          return (
            <div key={stage.key} className={`qoc-slide-in qoc-card rounded-xl border p-3 ${activeClass}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-3 w-3 rounded-full ${stage.complete || stage.active ? tone.dot : "bg-slate-300"}`} />
                <div>
                  <p className={`text-sm font-semibold ${stage.complete || stage.active ? tone.text : "text-slate-600"}`}>{stage.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {stage.date ? stage.date.toLocaleString("en-US") : stage.complete ? "Complete" : "Pending"}
                  </p>
                  {stage.active ? <p className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-orange-700">Current stage</p> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

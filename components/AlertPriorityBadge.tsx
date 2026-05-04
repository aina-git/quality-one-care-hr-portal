import { cn } from "@/lib/utils";

const classes = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  normal: "border-slate-200 bg-slate-100 text-slate-700"
} as const;

export function AlertPriorityBadge({ priority }: { priority: "critical" | "high" | "normal" }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", classes[priority])}>
      {priority === "critical" ? "Critical" : priority === "high" ? "High" : "Normal"}
    </span>
  );
}

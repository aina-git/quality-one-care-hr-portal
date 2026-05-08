import Link from "next/link";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, Clock, MessageSquare, Sparkles, Stethoscope } from "lucide-react";

const iconMap = {
  alert: AlertTriangle,
  bell: Bell,
  calendar: CalendarDays,
  check: CheckCircle2,
  clock: Clock,
  message: MessageSquare,
  ai: Sparkles,
  care: Stethoscope
};

const colors = {
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-800",
  purple: "border-purple-200 bg-purple-50 text-purple-800",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  gray: "border-slate-200 bg-slate-50 text-slate-800"
};

export function OperationalPulse({
  label,
  value,
  icon = "clock",
  color = "blue",
  href
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof iconMap;
  color?: keyof typeof colors;
  href?: string;
}) {
  const Icon = iconMap[icon];
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
    </>
  );
  const className = `qoc-card rounded-xl border p-4 shadow-sm ${colors[color]}`;

  if (href) {
    return (
      <Link href={href} className={`${className} block transition hover:-translate-y-0.5 hover:shadow-md`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

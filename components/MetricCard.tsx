import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const card = (
    <Card className="qoc-card rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
  return href ? <a href={href} className="block focus:outline-none focus:ring-2 focus:ring-orange-400">{card}</a> : card;
}

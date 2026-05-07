import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  stepKey: string;
  title: string;
};

export function PlaceholderStep({ title }: Props) {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-50">
      <CardContent className="p-6 text-sm text-slate-600 flex items-start gap-3">
        <Construction size={20} className="text-slate-400 mt-0.5" />
        <div>
          <p className="font-semibold text-slate-900">{title} — coming soon</p>
          <p className="mt-1">This step is part of the new intake wizard. The form itself is being built; in the meantime, use Previous / Next to move through the wizard.</p>
        </div>
      </CardContent>
    </Card>
  );
}

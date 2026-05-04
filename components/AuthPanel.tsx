import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthPanel({
  title,
  description,
  children,
  footer
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: { label: string; href: string; action: string };
}) {
  return (
    <main className="medical-gradient flex min-h-[calc(100vh-6rem)] items-start justify-center px-4 py-12 sm:min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {children}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer.label}{" "}
            <Link href={footer.href} className="font-medium text-orange-600 hover:text-orange-700">
              {footer.action}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

import { AuthShell } from "@/components/auth/auth-shell";

export const dynamic = "force-dynamic";

export default function ExperimentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthShell>
      <div className="h-dvh w-full flex flex-col">
        {children}
      </div>
    </AuthShell>
  );
}

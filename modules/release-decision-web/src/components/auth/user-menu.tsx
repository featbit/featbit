"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/featbit-auth/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { profile, organization, logout } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!profile) return null;

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
      router.replace("/login");
    });
  };

  const Icon = isPending ? Loader2 : LogOut;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex size-6 items-center justify-center rounded-md bg-brand text-brand-foreground text-[10px] font-medium"
          title={`${profile.name || profile.email} (${profile.email})`}
        >
          {initials(profile.name, profile.email)}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          disabled={isPending}
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon className={isPending ? "animate-spin" : ""} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-medium">
        {initials(profile.name, profile.email)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {profile.name || profile.email}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {organization?.name || profile.email}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleLogout}
        disabled={isPending}
        title="Sign out"
        aria-label="Sign out"
      >
        <Icon className={isPending ? "animate-spin" : ""} />
      </Button>
    </div>
  );
}

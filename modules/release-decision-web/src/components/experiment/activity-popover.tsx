"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollText } from "lucide-react";
import type { Activity } from "@/generated/prisma";

export function ActivityPopover({ activities }: { activities: Activity[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-7 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted transition-colors"
        title="Recent activity"
      >
        <ScrollText className="size-3" />
        <span>Audit log</span>
        {activities.length > 0 && (
          <span className="text-[10px] tabular-nums rounded bg-muted px-1">
            {activities.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 max-h-80 overflow-y-auto rounded-lg border bg-background shadow-lg z-50 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Activity
          </p>
          {activities.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">
              No activity yet
            </p>
          ) : (
            <div className="space-y-1.5">
              {activities.slice(0, 15).map((a) => (
                <div key={a.id} className="text-xs">
                  <p className="leading-tight">{a.title}</p>
                  <p
                    className="text-[10px] text-muted-foreground/60"
                    suppressHydrationWarning
                  >
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

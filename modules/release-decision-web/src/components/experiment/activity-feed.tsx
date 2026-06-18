import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import type { Activity } from "@/generated/prisma";

const TYPE_ICON: Record<string, string> = {
  stage_change: "🔄",
  sandbox_event: "🖥️",
  decision: "⚖️",
  note: "📝",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No activity yet
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-2 text-xs">
                <span className="shrink-0 mt-0.5">
                  {TYPE_ICON[activity.type] ?? "·"}
                </span>
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{activity.title}</p>
                  {activity.detail && (
                    <p className="text-muted-foreground mt-0.5 line-clamp-2">
                      {activity.detail}
                    </p>
                  )}
                  <p className="text-muted-foreground/60 mt-0.5">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

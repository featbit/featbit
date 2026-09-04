import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Experiment } from "@/lib/release-decision-types";
import { FlagPickerBody } from "./flag-picker-body";

export function FlagPickerSheet({
  experiment,
  open,
  onOpenChange,
}: {
  experiment: Experiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isChanging = Boolean(experiment.flagKey);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:min-w-2xl">
        <SheetHeader className="border-b pr-12">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Flag className="size-4 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle>
                {isChanging ? "Change feature flag" : "Select a feature flag"}
              </SheetTitle>
              <SheetDescription className="mt-1">
                Choose an existing FeatBit flag for this experiment. Targeting,
                variations, and toggle state remain managed in FeatBit.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 p-4">
          <FlagPickerBody
            active={open}
            experimentId={experiment.id}
            experimentFlagKey={experiment.flagKey}
            experimentProjectKey={experiment.featbitProjectKey}
            experimentEnvId={experiment.featbitEnvId}
            onConfirmed={(flagKey) => {
              onOpenChange(false);
              toast.success(
                isChanging
                  ? "Feature flag changed"
                  : "Feature flag selected",
                {
                  description: `${flagKey} is now bound to this experiment.`,
                },
              );
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
